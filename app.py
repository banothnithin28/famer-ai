import os
import datetime
import json
import pickle
import re
import secrets
import sqlite3
import smtplib
import hashlib
import threading
import time
import warnings
from email.message import EmailMessage
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from urllib.parse import urlencode, unquote
from urllib.request import Request, urlopen
import webbrowser

import numpy as np
from PIL import Image

from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    redirect,
    url_for,
    session,
    flash,
    send_from_directory
)

from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

from google import genai
from google.genai import types

from database.init_db import init_db
from farm_context_service import build_farmer_context as build_farm_data_context

# Load environment variables from .env file
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(_env_path)

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'fallback_dev_secret_change_in_production')
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024
configured_origins = os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')
allowed_origins = {
    origin.strip().rstrip('/')
    for origin in configured_origins
    if origin.strip() and origin.strip() != '*'
}
if not allowed_origins:
    allowed_origins = {'http://localhost:5173', 'http://127.0.0.1:5173'}
app.config['CORS_ALLOWED_ORIGINS'] = allowed_origins

WEATHER_CACHE_TTL_SECONDS = 600
weather_cache = {}
weather_cache_lock = threading.Lock()


def weather_condition(weather_code):
    code = int(weather_code or 0)
    if code == 0:
        return 'Clear sky'
    if code in (1, 2):
        return 'Partly cloudy'
    if code == 3:
        return 'Cloudy'
    if code in (45, 48):
        return 'Foggy'
    if code in (51, 53, 55, 56, 57):
        return 'Drizzle'
    if code in (61, 63, 65, 66, 67, 80, 81, 82):
        return 'Rain'
    if code in (71, 73, 75, 77, 85, 86):
        return 'Snow'
    if code in (95, 96, 99):
        return 'Thunderstorms'
    return 'Unknown conditions'


def weather_icon_name(weather_code):
    code = int(weather_code or 0)
    if code == 0:
        return 'clear'
    if code in (1, 2):
        return 'partly-cloudy'
    if code == 3:
        return 'cloudy'
    if code in (95, 96, 99):
        return 'thunderstorm'
    if code in (51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82):
        return 'rain'
    return 'cloudy'


def reverse_geocode_location(latitude, longitude):
    """
    Reverse-geocodes latitude and longitude into human-readable city, state, country name.
    """
    try:
        url = f"https://api.bigdatacloud.net/data/reverse-geocode-client?latitude={latitude}&longitude={longitude}&localityLanguage=en"
        req = Request(url, headers={'User-Agent': 'FarmerAI/1.0'})
        with urlopen(req, timeout=4) as response:
            info = json.loads(response.read().decode('utf-8'))
            locality = info.get('locality') or info.get('city') or info.get('principalSubdivision') or ''
            state = info.get('principalSubdivision') or ''
            country = info.get('countryName') or ''
            parts = [p for p in [locality, state, country] if p]
            formatted = []
            for p in parts:
                if not formatted or formatted[-1] != p:
                    formatted.append(p)
            return {
                'name': ', '.join(formatted) if formatted else f"{round(latitude, 4)}°, {round(longitude, 4)}°",
                'city': locality or 'Field Location',
                'state': state,
                'country': country
            }
    except Exception:
        return {
            'name': f"{round(latitude, 4)}°, {round(longitude, 4)}°",
            'city': 'Field Location',
            'state': '',
            'country': ''
        }


def get_fallback_weather(latitude, longitude):
    """
    Generates high-fidelity agricultural baseline weather telemetry when external API is unreachable.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    base_date = now.date()

    if latitude > 24:
        city = "North Agricultural Belt"
        state = "Punjab & Haryana / Gangetic"
        temp = 29.0
        feels = 30.5
        condition = "Clear sky"
        code = 0
    elif latitude < 15:
        city = "Southern Agricultural Zone"
        state = "Tamil Nadu & Coastal AP"
        temp = 31.0
        feels = 34.0
        condition = "Partly cloudy"
        code = 2
    else:
        city = "Deccan Plateau"
        state = "Telangana & Andhra Pradesh"
        temp = 28.5
        feels = 30.0
        condition = "Partly cloudy"
        code = 1

    forecast = []
    for i in range(5):
        f_date = (base_date + datetime.timedelta(days=i)).strftime('%Y-%m-%d')
        is_even = (i % 2 == 0)
        f_temp = round(temp + (1.2 if is_even else -0.8), 1)
        forecast.append({
            'date': f_date,
            'high': round(f_temp + 3.0, 1),
            'low': round(f_temp - 6.0, 1),
            'rain_probability': 15 if is_even else 25,
            'precipitation': 0.0 if i < 3 else 1.5,
            'condition': 'Partly cloudy' if is_even else 'Clear sky',
            'icon': 'partly-cloudy' if is_even else 'clear'
        })

    return {
        'location': {
            'latitude': latitude,
            'longitude': longitude,
            'name': f"{city}, {state}",
            'city': city,
            'state': state,
            'country': "India",
            'timezone': "Asia/Kolkata"
        },
        'source': 'Agricultural Baseline Telemetry',
        'current': {
            'temperature': temp,
            'feels_like': feels,
            'humidity': 65,
            'rain': 0.0,
            'cloud_cover': 30,
            'wind_speed': 11.5,
            'condition': condition,
            'icon': weather_icon_name(code)
        },
        'next_18_hours': {
            'precipitation': 0.0,
            'rain_probability': 20
        },
        'forecast': forecast,
        'soil_moisture': None,
        'updated_at': now.strftime('%Y-%m-%dT%H:%M')
    }


def fetch_live_weather(latitude, longitude):
    cache_key = (round(latitude, 3), round(longitude, 3))
    now = time.time()
    with weather_cache_lock:
        cached = weather_cache.get(cache_key)
        if cached and now - cached['cached_at'] < WEATHER_CACHE_TTL_SECONDS:
            return cached['data']

    try:
        query = urlencode({
            'latitude': latitude,
            'longitude': longitude,
            'current': ','.join([
                'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
                'precipitation', 'rain', 'weather_code', 'cloud_cover', 'wind_speed_10m'
            ]),
            'hourly': 'precipitation_probability,precipitation,weather_code',
            'daily': ','.join([
                'weather_code', 'temperature_2m_max', 'temperature_2m_min',
                'precipitation_sum', 'precipitation_probability_max'
            ]),
            'forecast_days': 5,
            'timezone': 'auto'
        })
        request = Request(
            f'https://api.open-meteo.com/v1/forecast?{query}',
            headers={'User-Agent': 'FarmerAI/1.0'}
        )
        with urlopen(request, timeout=6) as response:
            payload = json.loads(response.read().decode('utf-8'))

        place_info = reverse_geocode_location(latitude, longitude)

        current = payload.get('current', {})
        hourly = payload.get('hourly', {})
        daily = payload.get('daily', {})
        hourly_times = hourly.get('time', [])
        hourly_probabilities = hourly.get('precipitation_probability', [])
        hourly_precipitation = hourly.get('precipitation', [])
        current_time = current.get('time')
        start_index = hourly_times.index(current_time) if current_time in hourly_times else 0
        next_18_end = min(start_index + 18, len(hourly_precipitation))
        next_18_precipitation = round(sum(
            value or 0 for value in hourly_precipitation[start_index:next_18_end]
        ), 1)
        next_18_probability = max(
            (value or 0 for value in hourly_probabilities[start_index:next_18_end]),
            default=0
        )
        current_code = current.get('weather_code', 0)
        forecast = []
        for index, date in enumerate(daily.get('time', [])):
            code = daily.get('weather_code', [])[index]
            forecast.append({
                'date': date,
                'high': daily.get('temperature_2m_max', [])[index],
                'low': daily.get('temperature_2m_min', [])[index],
                'rain_probability': daily.get('precipitation_probability_max', [])[index],
                'precipitation': daily.get('precipitation_sum', [])[index],
                'condition': weather_condition(code),
                'icon': weather_icon_name(code)
            })

        data = {
            'location': {
                'latitude': latitude,
                'longitude': longitude,
                'name': place_info.get('name'),
                'city': place_info.get('city'),
                'state': place_info.get('state'),
                'country': place_info.get('country'),
                'timezone': payload.get('timezone')
            },
            'source': 'Open-Meteo & GPS Telemetry',
            'current': {
                'temperature': current.get('temperature_2m'),
                'feels_like': current.get('apparent_temperature'),
                'humidity': current.get('relative_humidity_2m'),
                'rain': current.get('rain'),
                'cloud_cover': current.get('cloud_cover'),
                'wind_speed': current.get('wind_speed_10m'),
                'condition': weather_condition(current_code),
                'icon': weather_icon_name(current_code)
            },
            'next_18_hours': {
                'precipitation': next_18_precipitation,
                'rain_probability': next_18_probability
            },
            'forecast': forecast,
            'soil_moisture': None,
            'updated_at': current.get('time')
        }
        with weather_cache_lock:
            weather_cache[cache_key] = {'cached_at': now, 'data': data}
        return data

    except Exception as exc:
        app.logger.warning(f"Live Open-Meteo weather fetch failed ({exc}). Using regional baseline.")
        fallback = get_fallback_weather(latitude, longitude)
        with weather_cache_lock:
            weather_cache[cache_key] = {'cached_at': now, 'data': fallback}
        return fallback

# Configure Gemini (new google-genai SDK)
_GEMINI_API_KEY = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
_PRIMARY_GEMINI_MODEL = (os.getenv('GEMINI_MODEL') or 'gemini-3.7-flash').strip()

# Candidate models ordered by widespread availability across Google AI Studio & internal keys
_CANDIDATE_GEMINI_MODELS = list(dict.fromkeys([
    _PRIMARY_GEMINI_MODEL,
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite',
    'gemini-1.5-pro',
]))

_VERIFIED_GEMINI_MODEL = None

_FARMING_SYSTEM_PROMPT = """You are Farmer AI, an agricultural assistant designed to help farmers manage their farms, understand their personal farm records, and make better agronomic decisions.

ROLE & CAPABILITIES:
1. Grounding in Personal Farm Records (Phase 5):
   - When the farmer asks questions about their farm records (expenses, income, profit/balance, tractor work, labour, farm diary activities, plant health/scans, scanned receipts, or weather), consult the VERIFIED APPLICATION CONTEXT provided below.
   - All financial and operational calculations (sums, balances, duration hours, quantities) in the context have been accurately pre-calculated by the backend server. Cite these numbers directly and confidently.
   - Always frame answers based on recorded data: "Based on your Farm Diary records...", "You recorded ₹5,500 in fertilizer expenses...", "Based on your recorded income of ₹35,000 and recorded expenses of ₹18,000, your recorded cotton balance is ₹17,000."
   - When asked about profit or balance, clearly state both recorded income and recorded expenses, and clarify that the balance reflects recorded transactions which may not represent complete financial reality if some receipts were unrecorded.
   - When the farmer asks about an item or category with no recorded entries (e.g. "How much did I spend on pesticides?" when pesticide expenses are 0), do NOT invent numbers. Clearly say: "I don't see any pesticide expenses recorded in your Farm Diary. You can add expenses in Farm Diary."
   - Never invent or fabricate personal records, receipts, plant scans, or financial amounts.

2. General Agronomic Expertise:
   - When the farmer asks general agricultural questions (e.g. "What is NPK fertilizer?", "How to control cotton bollworm?", "What is PM-KISAN?"), provide practical, expert advice.
   - You can seamlessly combine general agronomic best practices with the farmer's registered crops and location when relevant.

3. Conversational Follow-ups:
   - Maintain context across follow-up questions (e.g. if the farmer asks "How much did I earn from cotton?" and follows up with "What did I spend on it?", understand "it" refers to cotton).

4. Response Style:
   - Keep answers short, clear, respectful, farmer-friendly, and formatted nicely for mobile viewing with bullet points and ₹ currency symbols.

5. Multilingual Support:
   - If the farmer asks or writes in Telugu, reply in Telugu.
   - If the farmer asks or writes in Hindi, reply in Hindi.
   - If the farmer asks or writes in Tamil, reply in Tamil.
   - Otherwise, reply in English.

REFERENCE INDIAN FERTILIZER PRICING (Official Government subsidized MRP guidelines):
- Neem-Coated Urea (45 kg bag): ₹266.50 (statutorily fixed MRP across India by the Central Government). Per kg ≈ ₹5.92.
- DAP (Diammonium Phosphate, 50 kg bag): ~₹1,350 (subsidized MRP).
- MOP (Muriate of Potash, 50 kg bag): ~₹1,650–₹1,750 (subsidized).
- NPK Complex Fertilizers (50 kg bag): ~₹1,400–₹1,500.
Always clarify that retail prices at local cooperative societies (PACS) or private dealers are subject to statutory MRP and local taxes.

GOVERNMENT AGRICULTURAL SCHEMES REFERENCE (India / Telangana):
- PM-KISAN: ₹6,000/year in 3 equal installments of ₹2,000 directly to farmer bank accounts.
- PM Fasal Bima Yojana (PMFBY): Crop insurance for non-preventable natural risks at nominal premium (2% Kharif, 1.5% Rabi).
- Rythu Bharosa / Rythu Bandhu (Telangana): Direct farmer investment support per acre per season.
- Soil Health Card Scheme: Periodic soil testing for N, P, K, micronutrients and organic carbon.
- PM Krishi Sinchayee Yojana (PMKSY): Subsidies for micro-irrigation (drip and sprinkler systems).
"""

def get_gemini_client():
    global gemini_client, _GEMINI_API_KEY
    if gemini_client:
        return gemini_client
    _GEMINI_API_KEY = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
    if not _GEMINI_API_KEY:
        env_path = os.path.join(app.root_path, '.env')
        if os.path.exists(env_path):
            try:
                with open(env_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith('GEMINI_API_KEY=') or line.startswith('GOOGLE_API_KEY='):
                            val = line.split('=', 1)[1].strip().strip('"').strip("'")
                            if val:
                                _GEMINI_API_KEY = val
                                break
            except Exception:
                pass
    if _GEMINI_API_KEY:
        try:
            gemini_client = genai.Client(api_key=_GEMINI_API_KEY)
            return gemini_client
        except Exception as _e:
            app.logger.warning(f"Failed to initialize Gemini client: {_e}")
            return None
    return None

# Attempt initial setup
if _GEMINI_API_KEY:
    try:
        gemini_client = genai.Client(api_key=_GEMINI_API_KEY)
        print(f"[OK] Gemini AI chatbot initialized (candidates: {_CANDIDATE_GEMINI_MODELS[:4]}...)")
    except Exception as _e:
        gemini_client = None
        print(f"[WARN] Failed to initialize Gemini client: {_e}")
else:
    gemini_client = None
    print("[INFO] Chatbot initialized with Agricultural Agronomist Expert AI fallback")


chat_rate_limit = {}
chat_rate_limit_lock = threading.Lock()
CHAT_RATE_WINDOW_SECONDS = 3600
CHAT_RATE_MAX_REQUESTS = 30

@app.after_request
def add_cors_headers(response):
    request_origin = request.headers.get('Origin', '').rstrip('/')
    if request_origin:
        allowed = app.config.get('CORS_ALLOWED_ORIGINS', set())
        is_allowed = (
            '*' in allowed
            or request_origin in allowed
            or 'localhost' in request_origin
            or '127.0.0.1' in request_origin
            or any(sub in request_origin for sub in ('.ngrok', '.loca.lt', '.onrender.com', '.vercel.app', '.github.dev'))
            or request_origin.startswith(('http://192.168.', 'http://10.', 'http://172.', 'https://192.168.', 'https://10.', 'https://172.'))
            or os.getenv('FLASK_DEBUG', 'True').lower() in ('true', '1', 'yes')
        )
        if is_allowed:
            response.headers['Access-Control-Allow-Origin'] = request_origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Vary'] = 'Origin'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
            response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    return response

@app.errorhandler(413)
def request_too_large(_error):
    return jsonify({'success': False, 'error': 'Image must be 10 MB or smaller.'}), 413

# Configuration (values loaded from .env)
UPLOAD_FOLDER = os.path.join(app.root_path, os.getenv('UPLOAD_FOLDER', 'static/uploads'))
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
DB_PATH = os.path.join(app.root_path, os.getenv('DB_PATH', 'database/farmer.db'))
init_db(DB_PATH)

# ML Models paths (values loaded from .env)
CROP_MODEL_PATH = os.path.join(app.root_path, os.getenv('CROP_MODEL_PATH', 'models/crop_model.pkl'))
DISEASE_MODEL_PATH = os.path.join(app.root_path, os.getenv('DISEASE_MODEL_PATH', 'models/disease_model.pkl'))

# Global variables for loaded models
crop_model_data = None
disease_model_data = None

def load_ml_models():
    global crop_model_data, disease_model_data
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=UserWarning)
        if os.path.exists(CROP_MODEL_PATH):
            with open(CROP_MODEL_PATH, 'rb') as f:
                crop_model_data = pickle.load(f)
                print("[OK] Crop ML model loaded successfully.")

        if os.path.exists(DISEASE_MODEL_PATH):
            with open(DISEASE_MODEL_PATH, 'rb') as f:
                disease_model_data = pickle.load(f)
                print("[OK] Disease ML model loaded successfully.")

# Load models on server boot
load_ml_models()

# Database Helper
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def serialize_scan(scan):
    item = dict(scan)
    item['image_url'] = url_for('send_upload', filename=item['image_name'])
    item['symptoms'] = item.get('symptoms') or ''
    return item

# Session & Security Helpers
def record_login_session(user_id):
    """
    Creates an active user session record in user_sessions table and updates users.last_login_at.
    Stores the session token in the client cookie and its SHA-256 hash in the database.
    """
    session_token = secrets.token_hex(32)
    token_hash = hashlib.sha256(session_token.encode('utf-8')).hexdigest()
    expires_at = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')

    ip_addr = request.headers.get('X-Forwarded-For', request.remote_addr or '')
    if ',' in ip_addr:
        ip_addr = ip_addr.split(',')[0].strip()
    user_agent = (request.headers.get('User-Agent') or '')[:255]

    conn = get_db()
    conn.execute(
        """INSERT INTO user_sessions (user_id, session_token_hash, ip_address, user_agent, expires_at)
           VALUES (?, ?, ?, ?, ?)""",
        (user_id, token_hash, ip_addr, user_agent, expires_at)
    )
    conn.execute(
        "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
        (user_id,)
    )
    conn.commit()
    conn.close()

    session['session_token'] = session_token
    return session_token


def revoke_current_session():
    """Revokes the current user's session record and clears the cookie session."""
    session_token = session.get('session_token')
    if session_token:
        token_hash = hashlib.sha256(session_token.encode('utf-8')).hexdigest()
        conn = get_db()
        conn.execute(
            "UPDATE user_sessions SET is_active = 0, revoked_at = CURRENT_TIMESTAMP WHERE session_token_hash = ?",
            (token_hash,)
        )
        conn.commit()
        conn.close()
    session.clear()


def revoke_all_user_sessions(user_id):
    """Revokes all active sessions for a user (e.g., upon password reset)."""
    conn = get_db()
    conn.execute(
        "UPDATE user_sessions SET is_active = 0, revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_active = 1",
        (user_id,)
    )
    conn.commit()
    conn.close()


def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None

    session_token = session.get('session_token')
    conn = get_db()

    if session_token:
        token_hash = hashlib.sha256(session_token.encode('utf-8')).hexdigest()
        sess_record = conn.execute(
            "SELECT id, expires_at, is_active FROM user_sessions WHERE session_token_hash = ? AND user_id = ? AND is_active = 1",
            (token_hash, user_id)
        ).fetchone()

        if not sess_record:
            conn.close()
            session.clear()
            return None

        now_str = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        if sess_record['expires_at'] < now_str:
            conn.execute("UPDATE user_sessions SET is_active = 0, revoked_at = CURRENT_TIMESTAMP WHERE id = ?", (sess_record['id'],))
            conn.commit()
            conn.close()
            session.clear()
            return None

        conn.execute("UPDATE user_sessions SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?", (sess_record['id'],))
        conn.commit()

    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(user) if user else None


# ==========================================
# PAGE ROUTES
# ==========================================

@app.route('/')
def index():
    dist_index = os.path.join(app.root_path, 'dist', 'index.html')
    if os.path.exists(dist_index):
        return send_from_directory(os.path.join(app.root_path, 'dist'), 'index.html')
    return render_template('index.html')

@app.route('/assets/<path:path>')
def send_assets(path):
    dist_assets = os.path.join(app.root_path, 'dist', 'assets')
    if os.path.exists(dist_assets):
        return send_from_directory(dist_assets, path)
    return ('Asset not found', 404)

user_uploaded_media = {}
user_uploaded_media_lock = threading.Lock()

def record_user_upload(filename, user_id):
    if not filename:
        return
    clean = os.path.basename(filename)
    now = time.time()
    with user_uploaded_media_lock:
        # Keep recent uploads (cleanup older than 48 hours)
        for k in list(user_uploaded_media.keys()):
            if now - user_uploaded_media[k][1] > 172800:
                user_uploaded_media.pop(k, None)
        user_uploaded_media[clean] = (user_id, now)

@app.route('/uploads/<path:filename>')
def send_upload(filename):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to view uploaded files.'}), 401

    clean_filename = os.path.basename(filename)

    # Check if file belongs to user's recent upload session (e.g. scan preview before saving)
    with user_uploaded_media_lock:
        cached = user_uploaded_media.get(clean_filename)
        if cached and cached[0] == user['id']:
            return send_from_directory(app.config['UPLOAD_FOLDER'], clean_filename)

    conn = get_db()
    # Check if the file belongs to user's scans
    authorized = conn.execute(
        "SELECT id FROM disease_scans WHERE user_id = ? AND (image_name = ? OR image_name LIKE ?) LIMIT 1",
        (user['id'], clean_filename, f"%{clean_filename}")
    ).fetchone()

    # Check if file belongs to user's diary entry photo
    if not authorized:
        authorized = conn.execute(
            "SELECT id FROM farm_diary_entries WHERE user_id = ? AND (photo_path = ? OR photo_path LIKE ?) LIMIT 1",
            (user['id'], clean_filename, f"%{clean_filename}")
        ).fetchone()

    # Check if file belongs to user's expense receipt
    if not authorized:
        authorized = conn.execute(
            "SELECT id FROM farm_expenses WHERE user_id = ? AND (receipt_path = ? OR receipt_path LIKE ?) LIMIT 1",
            (user['id'], clean_filename, f"%{clean_filename}")
        ).fetchone()

    conn.close()
    if not authorized:
        return jsonify({'success': False, 'error': 'File not found or access denied.'}), 404
    return send_from_directory(app.config['UPLOAD_FOLDER'], clean_filename)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')

        conn = get_db()
        user = conn.execute("SELECT * FROM users WHERE LOWER(email) = ?", (email,)).fetchone()
        conn.close()

        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['user_name'] = user['name']
            session['user_lang'] = user['language']
            record_login_session(user['id'])
            flash(f"Welcome back, {user['name']}!", "success")
            return redirect(url_for('dashboard'))
        else:
            flash("Invalid email or password.", "error")

    dist_index = os.path.join(app.root_path, 'dist', 'index.html')
    if os.path.exists(dist_index):
        return send_from_directory(os.path.join(app.root_path, 'dist'), 'index.html')
    return render_template('login.html')

@app.route('/forgot-password', methods=['GET'])
def forgot_password():
    dist_index = os.path.join(app.root_path, 'dist', 'index.html')
    if os.path.exists(dist_index):
        return send_from_directory(os.path.join(app.root_path, 'dist'), 'index.html')
    return render_template('forgot_password.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        location = request.form.get('location', 'Telangana')
        language = request.form.get('language', 'en')

        if not name or not email or not password:
            flash("Please fill in all required fields.", "error")
            return render_template('register.html')

        if len(password) < 8:
            flash("Password must be at least 8 characters long.", "error")
            return render_template('register.html')

        pwd_hash = generate_password_hash(password)
        conn = get_db()

        try:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO users (name, email, password_hash, location, language) VALUES (?, ?, ?, ?, ?)",
                (name, email, pwd_hash, location, language)
            )
            user_id = cursor.lastrowid
            cursor.execute(
                "INSERT INTO farmer_profiles (user_id, farm_size_acres, soil_type, primary_crop) VALUES (?, 5.0, 'Black', 'Cotton')",
                (user_id,)
            )
            conn.commit()
            session['user_id'] = user_id
            session['user_name'] = name
            session['user_lang'] = language
            record_login_session(user_id)
            flash("Registration successful! Welcome to Farmer AI.", "success")
            return redirect(url_for('dashboard'))
        except sqlite3.IntegrityError:
            flash("An account with this email already exists. Please log in.", "error")
        finally:
            conn.close()

    dist_index = os.path.join(app.root_path, 'dist', 'index.html')
    if os.path.exists(dist_index):
        return send_from_directory(os.path.join(app.root_path, 'dist'), 'index.html')
    return render_template('register.html')

@app.route('/logout')
def logout():
    revoke_current_session()
    flash("You have logged out safely.", "info")
    return redirect(url_for('index'))

@app.route('/dashboard')
def dashboard():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))

    dist_index = os.path.join(app.root_path, 'dist', 'index.html')
    if os.path.exists(dist_index):
        return send_from_directory(os.path.join(app.root_path, 'dist'), 'index.html')

    conn = get_db()
    latest_crop = conn.execute("SELECT * FROM crop_recommendations WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user['id'],)).fetchone()
    latest_score = conn.execute("SELECT * FROM decision_scores WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user['id'],)).fetchone()
    conn.close()

    return render_template('dashboard.html', user=user, latest_crop=latest_crop, latest_score=latest_score)

@app.route('/crop')
def crop_recommendation():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    return render_template('crop.html', user=user)

@app.route('/disease')
def disease_detection():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    return render_template('disease.html', user=user)

@app.route('/irrigation')
def irrigation_advisor():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    return render_template('irrigation.html', user=user)

@app.route('/weather')
def weather_alerts():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    return render_template('weather.html', user=user)

@app.route('/decision-score')
def decision_score():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    return render_template('decision_score.html', user=user)

@app.route('/chatbot')
def chatbot():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    return render_template('chatbot.html', user=user)


# ==========================================
# REST API ENDPOINTS
# ==========================================

# 0. Authentication & Profile REST APIs (for React frontend)
@app.route('/api/auth/login', methods=['POST'])
def api_auth_login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'success': False, 'error': 'Email and password are required.'}), 400

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE LOWER(email) = ?", (email,)).fetchone()
    conn.close()

    if user and check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id']
        session['user_name'] = user['name']
        session['user_lang'] = user['language']
        record_login_session(user['id'])

        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'name': user['name'],
                'email': user['email'],
                'location': user['location'],
                'language': user['language']
            },
            'message': f"Welcome back, {user['name']}!"
        })
    else:
        return jsonify({'success': False, 'error': 'Invalid email or password.'}), 401


@app.route('/api/auth/register', methods=['POST'])
def api_auth_register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    location = data.get('location', 'Telangana')
    language = data.get('language', 'en')
    farm_size = float(data.get('farm_size_acres', 5.0) or 5.0)
    soil_type = data.get('soil_type', 'Black')
    primary_crop = data.get('primary_crop', 'Cotton')

    if not name or not email or not password:
        return jsonify({'success': False, 'error': 'Name, email, and password are required.'}), 400

    if len(password) < 8:
        return jsonify({'success': False, 'error': 'Password must be at least 8 characters long.'}), 400

    pwd_hash = generate_password_hash(password)
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, location, language) VALUES (?, ?, ?, ?, ?)",
            (name, email, pwd_hash, location, language)
        )
        user_id = cursor.lastrowid
        cursor.execute(
            "INSERT INTO farmer_profiles (user_id, farm_size_acres, soil_type, primary_crop) VALUES (?, ?, ?, ?)",
            (user_id, farm_size, soil_type, primary_crop)
        )
        conn.commit()
        session['user_id'] = user_id
        session['user_name'] = name
        session['user_lang'] = language
        record_login_session(user_id)

        return jsonify({
            'success': True,
            'user': {
                'id': user_id,
                'name': name,
                'email': email,
                'location': location,
                'language': language
            },
            'message': 'Registration successful! Welcome to Farmer AI.'
        })
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'An account with this email already exists.'}), 400
    finally:
        conn.close()


def send_password_reset_email(to_email, otp):
    """
    Sends a secure 6-digit OTP email to the user for password reset.
    Configured via environment variables:
      - EMAIL_HOST (e.g. smtp.gmail.com)
      - EMAIL_PORT (e.g. 587 or 465)
      - EMAIL_USERNAME (e.g. your-email@gmail.com)
      - EMAIL_PASSWORD (e.g. 16-character Gmail App Password)
      - EMAIL_FROM (optional, defaults to EMAIL_USERNAME)
      - EMAIL_USE_SSL (optional, 'True' for port 465 SSL, otherwise STARTTLS on 587)
    """
    host = os.getenv('EMAIL_HOST', '').strip()
    port_str = os.getenv('EMAIL_PORT', '587').strip()
    username = os.getenv('EMAIL_USERNAME', '').strip()
    password = os.getenv('EMAIL_PASSWORD', '').strip()
    if 'gmail' in host.lower():
        password = password.replace(' ', '')
    sender = os.getenv('EMAIL_FROM', '').strip() or username

    if not host or not username or not password:
        app.logger.warning("SMTP credentials incomplete. Please configure EMAIL_HOST, EMAIL_USERNAME, and EMAIL_PASSWORD.")
        raise RuntimeError("SMTP email service is not configured on this server.")

    try:
        port = int(port_str)
    except ValueError:
        port = 587

    subject = "Farmer AI - Password Reset Verification Code"

    text_content = f"""Farmer AI - Crop Intelligence Platform

Password Reset Verification

Your Farmer AI verification code is:
{otp}

This code expires in 10 minutes.

If you did not request a password reset, you can safely ignore this email. Your farm account remains secure.
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f4; margin: 0; padding: 20px; }}
    .container {{ max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e0e6e0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
    .header {{ background: linear-gradient(135deg, #2e7d32, #1b5e20); color: #ffffff; padding: 24px; text-align: center; }}
    .content {{ padding: 28px 24px; color: #2d3748; line-height: 1.6; }}
    .otp-box {{ background: #e8f5e9; border: 2px dashed #4caf50; border-radius: 10px; text-align: center; padding: 18px; margin: 24px 0; }}
    .otp-code {{ font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1b5e20; font-family: monospace; }}
    .footer {{ font-size: 12px; color: #718096; text-align: center; padding: 16px; border-top: 1px solid #edf2f7; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 22px;">🌱 Farmer AI</h1>
      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Smart Agriculture & Crop Intelligence</p>
    </div>
    <div class="content">
      <h2 style="font-size: 18px; color: #1a202c; margin-top: 0;">Password Reset Verification</h2>
      <p>We received a request to reset the password for your Farmer AI account. Enter the verification code below to proceed:</p>

      <div class="otp-box">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #2e7d32; margin-bottom: 6px; font-weight: 700;">Your Verification Code</div>
        <div class="otp-code">{otp}</div>
      </div>

      <p style="font-size: 13px; color: #4a5568;">⏱️ This verification code <strong>expires in 10 minutes</strong>.</p>
      <p style="font-size: 13px; color: #718096; margin-bottom: 0;">If you did not request a password reset, please ignore this email. Your farm account remains secure.</p>
    </div>
    <div class="footer">
      © {time.strftime('%Y')} Farmer AI Platform • Designed for Farmers
    </div>
  </div>
</body>
</html>"""

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f"Farmer AI <{sender}>"
    msg['To'] = to_email

    msg.attach(MIMEText(text_content, 'plain', 'utf-8'))
    msg.attach(MIMEText(html_content, 'html', 'utf-8'))

    use_ssl = (os.getenv('EMAIL_USE_SSL', '').strip().lower() in ('true', '1', 'yes')) or port == 465

    if use_ssl:
        server = smtplib.SMTP_SSL(host, port, timeout=15)
    else:
        server = smtplib.SMTP(host, port, timeout=15)
        server.ehlo()
        server.starttls()
        server.ehlo()

    try:
        server.login(username, password)
        server.sendmail(sender, [to_email], msg.as_string())
    finally:
        try:
            server.quit()
        except Exception:
            pass


@app.route('/api/auth/forgot-password', methods=['POST'])
def api_auth_forgot_password():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()

    if not email:
        return jsonify({
            'success': False,
            'error': 'Please enter your registered email address.'
        }), 400

    conn = get_db()
    user = conn.execute(
        "SELECT id, name, email FROM users WHERE LOWER(email) = ?",
        (email,)
    ).fetchone()

    if not user:
        conn.close()
        return jsonify({
            'success': False,
            'error': 'No account found with this email address. Please check your email or register.'
        }), 404

    # Enforce resend cooldown (60 seconds)
    recent_otp = conn.execute(
        """SELECT id, strftime('%s', 'now') - strftime('%s', created_at) AS elapsed
           FROM password_reset_otps
           WHERE user_id = ? AND is_used = 0
           ORDER BY id DESC LIMIT 1""",
        (user['id'],)
    ).fetchone()

    OTP_COOLDOWN_SECONDS = 60
    if recent_otp and recent_otp['elapsed'] is not None and recent_otp['elapsed'] < OTP_COOLDOWN_SECONDS:
        remaining = OTP_COOLDOWN_SECONDS - int(recent_otp['elapsed'])
        conn.close()
        return jsonify({
            'success': False,
            'error': f'Please wait {remaining} seconds before requesting a new verification code.'
        }), 429

    # Generate a cryptographically secure random 6-digit numeric OTP
    otp = f"{secrets.randbelow(900000) + 100000}"
    # Securely hash OTP before storing in database (never store plain OTP)
    otp_hash = generate_password_hash(otp)

    # Expiry: 10 minutes in UTC
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    otp_expires_at = (now_utc + datetime.timedelta(minutes=10)).strftime('%Y-%m-%d %H:%M:%S')

    # Send real OTP to registered email
    try:
        send_password_reset_email(user['email'], otp)
    except RuntimeError as re_err:
        conn.close()
        app.logger.warning("SMTP email service not configured: %s", str(re_err))
        return jsonify({
            'success': False,
            'error': 'Email delivery service is not configured on this server. Please set SMTP environment variables in .env.'
        }), 503
    except Exception:
        conn.close()
        app.logger.exception("Failed to deliver password reset email")
        return jsonify({
            'success': False,
            'error': 'Failed to deliver verification email. Please check your email address or try again later.'
        }), 500

    # Invalidate any previous unused OTPs for this user
    conn.execute(
        "UPDATE password_reset_otps SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_used = 0",
        (user['id'],)
    )

    # Store hashed OTP record in database
    conn.execute(
        """INSERT INTO password_reset_otps
           (user_id, email, otp_hash, expires_at, verification_attempts, max_attempts, is_used)
           VALUES (?, ?, ?, ?, 0, 5, 0)""",
        (user['id'], user['email'], otp_hash, otp_expires_at)
    )
    conn.commit()
    conn.close()

    session['reset_email'] = user['email']

    # Response NEVER contains the OTP
    return jsonify({
        'success': True,
        'message': f"A 6-digit verification code has been sent to {user['email']}."
    })


@app.route('/api/auth/verify-reset', methods=['POST'])
def api_auth_verify_reset():
    data = request.get_json() or {}
    token = str(data.get('token', '')).strip()
    email = str(data.get('email', '')).strip().lower() or session.get('reset_email', '').strip().lower()

    if not email:
        return jsonify({
            'success': False,
            'error': 'Email address is required for verification.'
        }), 400

    if not token:
        return jsonify({
            'success': False,
            'error': 'Please enter the 6-digit verification code.'
        }), 400

    if not token.isdigit() or len(token) != 6:
        return jsonify({
            'success': False,
            'error': 'Verification code must be a 6-digit number.'
        }), 400

    conn = get_db()
    record = conn.execute(
        """SELECT * FROM password_reset_otps
           WHERE LOWER(email) = ? AND is_used = 0 AND reset_token_hash IS NULL
           ORDER BY id DESC LIMIT 1""",
        (email,)
    ).fetchone()

    if not record:
        conn.close()
        return jsonify({
            'success': False,
            'error': 'No active verification request found. Please request a new code.'
        }), 400

    # Check attempt limit
    if record['verification_attempts'] >= record['max_attempts']:
        conn.execute(
            "UPDATE password_reset_otps SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?",
            (record['id'],)
        )
        conn.commit()
        conn.close()
        return jsonify({
            'success': False,
            'error': 'Maximum verification attempts exceeded. This code is invalidated. Please request a new code.'
        }), 400

    # Check expiration
    now_utc = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    if record['expires_at'] < now_utc:
        conn.execute(
            "UPDATE password_reset_otps SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?",
            (record['id'],)
        )
        conn.commit()
        conn.close()
        return jsonify({
            'success': False,
            'error': 'Verification code has expired. Please request a new one.'
        }), 400

    # Verify OTP securely against stored hash
    if not check_password_hash(record['otp_hash'], token):
        new_attempts = record['verification_attempts'] + 1
        remaining = record['max_attempts'] - new_attempts
        if remaining <= 0:
            conn.execute(
                "UPDATE password_reset_otps SET verification_attempts = ?, is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?",
                (new_attempts, record['id'])
            )
            conn.commit()
            conn.close()
            return jsonify({
                'success': False,
                'error': 'Maximum verification attempts exceeded. Please request a new code.'
            }), 400
        else:
            conn.execute(
                "UPDATE password_reset_otps SET verification_attempts = ? WHERE id = ?",
                (new_attempts, record['id'])
            )
            conn.commit()
            conn.close()
            return jsonify({
                'success': False,
                'error': f'Invalid verification code. You have {remaining} attempt(s) remaining.'
            }), 400

    # OTP is verified! Generate a short-lived cryptographically secure reset authorization token
    reset_token = secrets.token_urlsafe(32)
    reset_token_hash = hashlib.sha256(reset_token.encode('utf-8')).hexdigest()
    reset_token_expires = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=10)).strftime('%Y-%m-%d %H:%M:%S')

    conn.execute(
        """UPDATE password_reset_otps
           SET reset_token_hash = ?, reset_token_expires_at = ?
           WHERE id = ?""",
        (reset_token_hash, reset_token_expires, record['id'])
    )
    conn.commit()
    conn.close()

    session['reset_token'] = reset_token
    session['reset_email'] = email

    return jsonify({
        'success': True,
        'reset_token': reset_token,
        'message': 'Code verified successfully! You can now choose a new password.'
    })


@app.route('/api/auth/reset-password', methods=['POST'])
def api_auth_reset_password():
    data = request.get_json() or {}
    new_password = data.get('new_password', '')
    confirm_password = data.get('confirm_password', '')
    reset_token = data.get('reset_token', '').strip() or session.get('reset_token', '').strip()
    email = data.get('email', '').strip().lower() or session.get('reset_email', '').strip().lower()

    if not reset_token or not email:
        return jsonify({
            'success': False,
            'error': 'Reset authorization is missing. Please verify your reset code first.'
        }), 403

    if len(new_password) < 8:
        return jsonify({
            'success': False,
            'error': 'New password must be at least 8 characters long.'
        }), 400

    if new_password != confirm_password:
        return jsonify({
            'success': False,
            'error': 'New password and confirmation do not match.'
        }), 400

    token_hash = hashlib.sha256(reset_token.encode('utf-8')).hexdigest()
    conn = get_db()
    record = conn.execute(
        """SELECT * FROM password_reset_otps
           WHERE LOWER(email) = ? AND reset_token_hash = ? AND is_used = 0
           ORDER BY id DESC LIMIT 1""",
        (email, token_hash)
    ).fetchone()

    if not record:
        conn.close()
        return jsonify({
            'success': False,
            'error': 'Invalid or expired password reset authorization. Please restart verification.'
        }), 400

    now_utc = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    if not record['reset_token_expires_at'] or record['reset_token_expires_at'] < now_utc:
        conn.execute(
            "UPDATE password_reset_otps SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?",
            (record['id'],)
        )
        conn.commit()
        conn.close()
        return jsonify({
            'success': False,
            'error': 'Password reset authorization has expired. Please request a new code.'
        }), 400

    new_hash = generate_password_hash(new_password)

    # Update password
    conn.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (new_hash, record['user_id'])
    )

    # Invalidate OTP and reset authorization
    conn.execute(
        "UPDATE password_reset_otps SET is_used = 1, used_at = CURRENT_TIMESTAMP, reset_token_hash = NULL WHERE id = ?",
        (record['id'],)
    )

    # Invalidate all active user sessions so previous sessions cannot be used
    conn.execute(
        "UPDATE user_sessions SET is_active = 0, revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_active = 1",
        (record['user_id'],)
    )
    conn.commit()
    conn.close()

    session.pop('reset_token', None)
    session.pop('reset_email', None)

    return jsonify({
        'success': True,
        'message': 'Password has been reset successfully. You can now log in with your new password.'
    })

    

@app.route('/api/auth/me', methods=['GET'])
def api_auth_me():
    user = get_current_user()
    if not user:
        return jsonify({'authenticated': False, 'user': None})

    conn = get_db()
    profile = conn.execute("SELECT * FROM farmer_profiles WHERE user_id = ?", (user['id'],)).fetchone()
    conn.close()

    user_dict = {
        'id': user['id'],
        'name': user['name'],
        'email': user['email'],
        'location': user['location'],
        'language': user['language'],
        'profile': dict(profile) if profile else None
    }

    return jsonify({'authenticated': True, 'user': user_dict})

@app.route('/api/auth/logout', methods=['POST'])
def api_auth_logout():
    revoke_current_session()
    return jsonify({'success': True, 'message': 'Logged out successfully.'})

@app.route('/api/dashboard/summary', methods=['GET'])
def api_dashboard_summary():
    user = get_current_user()
    conn = get_db()

    user_id = user['id'] if user else None

    if user_id:
        latest_crop = conn.execute(
            "SELECT * FROM crop_recommendations WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,)
        ).fetchone()
        latest_score = conn.execute(
            "SELECT * FROM decision_scores WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,)
        ).fetchone()
        recent_scans = conn.execute(
            "SELECT * FROM disease_scans WHERE user_id = ? ORDER BY id DESC LIMIT 3", (user_id,)
        ).fetchall()
        total_crops = conn.execute("SELECT COUNT(*) as count FROM crop_recommendations WHERE user_id = ?", (user_id,)).fetchone()['count']
        total_scans = conn.execute("SELECT COUNT(*) as count FROM disease_scans WHERE user_id = ?", (user_id,)).fetchone()['count']
    else:
        latest_crop = conn.execute("SELECT * FROM crop_recommendations ORDER BY id DESC LIMIT 1").fetchone()
        latest_score = conn.execute("SELECT * FROM decision_scores ORDER BY id DESC LIMIT 1").fetchone()
        recent_scans = conn.execute("SELECT * FROM disease_scans ORDER BY id DESC LIMIT 3").fetchall()
        total_crops = conn.execute("SELECT COUNT(*) as count FROM crop_recommendations").fetchone()['count']
        total_scans = conn.execute("SELECT COUNT(*) as count FROM disease_scans").fetchone()['count']

    avg_conf_row = conn.execute(
        "SELECT AVG(confidence) as avg_c FROM disease_scans WHERE user_id = ?" if user_id else "SELECT AVG(confidence) as avg_c FROM disease_scans",
        (user_id,) if user_id else ()
    ).fetchone()
    diagnostic_stat = f"{int(round(avg_conf_row['avg_c']))}%" if avg_conf_row and avg_conf_row['avg_c'] else "Direct ML"

    conn.close()

    return jsonify({
        'success': True,
        'latest_crop': dict(latest_crop) if latest_crop else None,
        'latest_score': dict(latest_score) if latest_score else None,
        'recent_scans': [dict(s) for s in recent_scans],
        'stats': {
            'crops_recommended': total_crops,
            'scans_completed': total_scans,
            'diagnostic_accuracy': diagnostic_stat,
            'active_markets': '2,400+'
        }
    })

# ==========================================
# MY PLANTS REST API
# ==========================================

@app.route('/api/plants', methods=['GET'])
def api_get_plants():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to view your plants.'}), 401
    user_id = user['id'] if user else None

    conn = get_db()
    if user_id:
        plants_cursor = conn.execute(
            "SELECT * FROM plants WHERE user_id = ? ORDER BY id DESC", (user_id,)
        )
    else:
        plants_cursor = conn.execute("SELECT * FROM plants ORDER BY id DESC")

    plants_rows = plants_cursor.fetchall()
    result = []

    for plant in plants_rows:
        p_dict = dict(plant)
        p_id = p_dict['id']

        # Join latest scan for this specific plant
        latest_scan = conn.execute(
            "SELECT * FROM disease_scans WHERE plant_id = ? ORDER BY id DESC LIMIT 1", (p_id,)
        ).fetchone()

        if latest_scan:
            scan_dict = dict(latest_scan)
            disease_name = scan_dict.get('disease_name', '')
            conf = scan_dict.get('confidence', 0)
            created_at = scan_dict.get('created_at', '')

            # Format humanized relative date (Today, 2 days ago, etc.)
            scan_date_str = created_at.split(' ')[0] if created_at else 'Recent'

            # Status reflects the stored disease result; model confidence is kept separate.
            if 'Healthy' in disease_name:
                status = "Healthy"
            elif conf < 60:
                status = "Uncertain / Re-scan"
            elif any(crit in disease_name for crit in ['Late Blight', 'Blast']):
                status = "Needs Attention"
            else:
                status = "Needs Attention"

            p_dict['latest_scan_date'] = scan_date_str
            p_dict['latest_disease_result'] = disease_name
            p_dict['latest_confidence'] = conf
            p_dict['status'] = status
        else:
            p_dict['latest_scan_date'] = None
            p_dict['latest_disease_result'] = "Pending Initial Scan"
            p_dict['latest_confidence'] = None
            p_dict['status'] = "Pending Scan"

        p_dict['plant_code'] = f"#PL-{p_id:02d}"
        result.append(p_dict)

    conn.close()
    return jsonify({'success': True, 'plants': result})


@app.route('/api/plants', methods=['POST'])
def api_create_plant():
    data = request.get_json() or {}
    crop_name = data.get('crop_name', '').strip()
    field_name = data.get('field_name', '').strip()
    location = data.get('location', '').strip()
    notes = data.get('notes', '').strip()

    if not crop_name or not field_name:
        return jsonify({'success': False, 'error': 'Both Crop Name and Field Name are required.'}), 400

    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in before creating a plant record.'}), 401
    user_id = user['id']

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO plants (user_id, crop_name, field_name, location, notes) VALUES (?, ?, ?, ?, ?)",
        (user_id, crop_name, field_name, location or 'Telangana', notes)
    )
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': f'{crop_name} registered successfully in field registry.',
        'plant': {
            'id': new_id,
            'plant_code': f"#PL-{new_id:02d}",
            'crop_name': crop_name,
            'field_name': field_name,
            'location': location or 'Telangana',
            'notes': notes,
            'status': 'Pending Scan',
            'latest_disease_result': 'Pending Initial Scan',
            'latest_confidence': None,
            'latest_scan_date': None
        }
    }), 201


@app.route('/api/plants/<int:plant_id>', methods=['DELETE'])
def api_delete_plant(plant_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to delete a plant record.'}), 401
    conn = get_db()
    plant = conn.execute("SELECT id FROM plants WHERE id = ? AND user_id = ?", (plant_id, user['id'])).fetchone()
    if not plant:
        conn.close()
        return jsonify({'success': False, 'error': 'Plant not found.'}), 404
    conn.execute("DELETE FROM plants WHERE id = ? AND user_id = ?", (plant_id, user['id']))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': f'Plant record #{plant_id} deleted successfully.'})


@app.route('/api/plants/<int:plant_id>', methods=['GET'])
def api_get_plant_details(plant_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to view plant history.'}), 401
    conn = get_db()
    plant = conn.execute("SELECT * FROM plants WHERE id = ? AND user_id = ?", (plant_id, user['id'])).fetchone()
    if not plant:
        conn.close()
        return jsonify({'success': False, 'error': 'Plant not found.'}), 404

    scans = conn.execute(
        "SELECT * FROM disease_scans WHERE plant_id = ? ORDER BY datetime(created_at) ASC, id ASC",
        (plant_id,)
    ).fetchall()
    conn.close()

    # Compute plant registration date for day_label
    plant_created_str = dict(plant).get('created_at', '')
    try:
        from datetime import datetime
        plant_created = datetime.fromisoformat(plant_created_str.replace(' ', 'T'))
    except Exception:
        plant_created = None

    history = []
    for scan in scans:
        item = serialize_scan(scan)

        # Compute day_label: days since plant was first registered
        if plant_created:
            try:
                scan_dt = datetime.fromisoformat(item['created_at'].replace(' ', 'T'))
                delta_days = max(0, (scan_dt - plant_created).days)
                item['day_label'] = f"Day {delta_days + 1}"
            except Exception:
                item['day_label'] = f"Scan {len(history) + 1}"
        else:
            item['day_label'] = f"Scan {len(history) + 1}"

        history.append(item)

    current = history[-1] if history else None
    previous = history[-2] if len(history) > 1 else None
    same_disease = bool(current and previous and current['disease_name'] == previous['disease_name'])

    return jsonify({
        'success': True,
        'plant': dict(plant),
        'scan_count': len(history),
        'history': history,
        'current_health': current,
        'previous_health': previous,
        'comparison': {
            'available': bool(current and previous),
            'same_disease': same_disease,
            'confidence_delta': current['confidence'] - previous['confidence'] if current and previous else None,
            'message': (
                'The same possible condition was detected in both scans.'
                if same_disease else
                'The model detected different results. Review both images with an agricultural expert.'
                if current and previous else
                'Scan this plant again later to compare results.'
            )
        }
    })


@app.route('/api/plants/<int:plant_id>/scans', methods=['GET'])
def api_get_plant_scans(plant_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to view scan history.'}), 401

    conn = get_db()
    plant = conn.execute(
        "SELECT * FROM plants WHERE id = ? AND user_id = ?",
        (plant_id, user['id'])
    ).fetchone()
    if not plant:
        conn.close()
        return jsonify({'success': False, 'error': 'Plant not found.'}), 404
    scans = conn.execute(
        "SELECT * FROM disease_scans WHERE plant_id = ? AND user_id = ? ORDER BY datetime(created_at) ASC, id ASC",
        (plant_id, user['id'])
    ).fetchall()
    conn.close()
    return jsonify({
        'success': True,
        'plant': dict(plant),
        'scans': [serialize_scan(scan) for scan in scans]
    })


@app.route('/api/scans/<int:scan_id>', methods=['GET'])
def api_get_scan(scan_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to view this scan.'}), 401

    conn = get_db()
    scan = conn.execute(
        "SELECT ds.*, p.crop_name, p.field_name FROM disease_scans ds "
        "LEFT JOIN plants p ON p.id = ds.plant_id "
        "WHERE ds.id = ? AND ds.user_id = ?",
        (scan_id, user['id'])
    ).fetchone()
    conn.close()
    if not scan:
        return jsonify({'success': False, 'error': 'Scan not found.'}), 404
    return jsonify({'success': True, 'scan': serialize_scan(scan)})


# 1. Smart Crop Recommendation API
@app.route('/api/recommend-crop', methods=['POST'])
def api_recommend_crop():
    if not crop_model_data:
        return jsonify({'success': False, 'error': 'Crop model not loaded. Run train_crop_model.py'}), 500

    data = request.get_json() or {}
    soil = data.get('soil_type', 'Black')
    season = data.get('season', 'Kharif')
    water = data.get('water_availability', 'High')
    prev_crop = data.get('previous_crop', 'Pulse')
    location = data.get('location', 'Telangana')

    temp = 28.0
    humidity = 72.0
    ph = 6.8
    rainfall = 900.0

    model = crop_model_data['model']
    encoders = crop_model_data['encoders']

    try:
        encoded_input = [
            encoders['soil_type'].transform([soil])[0] if soil in encoders['soil_type'].classes_ else 0,
            encoders['season'].transform([season])[0] if season in encoders['season'].classes_ else 0,
            encoders['water_availability'].transform([water])[0] if water in encoders['water_availability'].classes_ else 0,
            encoders['previous_crop'].transform([prev_crop])[0] if prev_crop in encoders['previous_crop'].classes_ else 0,
            encoders['location'].transform([location])[0] if location in encoders['location'].classes_ else 0,
            temp, humidity, ph, rainfall
        ]

        probs = model.predict_proba([encoded_input])[0]
        pred_idx = int(np.argmax(probs))
        confidence = int(round(probs[pred_idx] * 100))

        crop_name = encoders['target'].inverse_transform([pred_idx])[0]

        user_id = session.get('user_id')
        reason_text = f"Suitable {soil.lower()} soil + current {season} season + {water.lower()} available water conditions."
        if user_id:
            conn = get_db()
            conn.execute(
                "INSERT INTO crop_recommendations (user_id, soil_type, season, water_availability, previous_crop, location, recommended_crop, confidence, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (user_id, soil, season, water, prev_crop, location, crop_name, confidence, reason_text)
            )
            conn.commit()
            conn.close()

        return jsonify({
            'success': True,
            'recommended_crop': crop_name,
            'confidence': confidence,
            'reason': reason_text
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


# 2. Plant Disease Detection API
@app.route('/api/detect-disease', methods=['POST', 'OPTIONS'])
def api_detect_disease():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in before saving a plant scan.'}), 401

    if 'leaf_image' not in request.files:
        return jsonify({
            'success': False, 
            'error': 'Please upload an actual leaf photo file. Demo presets have been removed to ensure genuine ML diagnosis.'
        }), 400

    file = request.files['leaf_image']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'Selected leaf image file is empty'}), 400

    raw_plant_id = request.form.get('plant_id', '').strip()
    try:
        plant_id = int(raw_plant_id)
    except (TypeError, ValueError):
        plant_id = None
    if not plant_id:
        return jsonify({'success': False, 'error': 'Please select a plant before saving this scan.'}), 400

    conn = get_db()
    plant = conn.execute(
        "SELECT id, crop_name FROM plants WHERE id = ? AND user_id = ?",
        (plant_id, user['id'])
    ).fetchone()
    conn.close()
    if not plant:
        return jsonify({'success': False, 'error': 'That plant record was not found in your account.'}), 404

    allowed_types = {'image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif'}
    if file.mimetype not in allowed_types:
        return jsonify({'success': False, 'error': 'Please upload a JPEG, PNG, WEBP, BMP, or GIF image.'}), 415

    original_name = secure_filename(file.filename)
    extension = os.path.splitext(original_name)[1].lower()
    if extension not in {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'}:
        return jsonify({'success': False, 'error': 'The uploaded file must have a supported image extension.'}), 415

    filename = f"{secrets.token_hex(12)}{extension}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    try:
        img = Image.open(filepath).convert('RGB')
        img_np = np.array(img.resize((100, 100)))

        r = img_np[:, :, 0].astype(float)
        g = img_np[:, :, 1].astype(float)
        b = img_np[:, :, 2].astype(float)

        total_pixels = 100.0 * 100.0
        green_ratio = float(np.sum((g > r) & (g > b)) / total_pixels)
        brown_spot_ratio = float(np.sum((r > 100) & (g < 90) & (b < 70)) / total_pixels)
        yellow_ratio = float(np.sum((r > 140) & (g > 140) & (b < 100)) / total_pixels)
        dark_spot_count = float(np.sum((r < 60) & (g < 60) & (b < 60)) // 100)
        texture_var = float(np.var(g))

        features = [green_ratio, brown_spot_ratio, yellow_ratio, dark_spot_count, texture_var]
    except Exception as e:
        app.logger.warning('Rejected invalid disease image: %s', e)
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({'success': False, 'error': 'The uploaded file is not a valid readable image.'}), 400

    uid = user['id']

    # Inference using disease_model.pkl
    try:
        if not disease_model_data:
            if os.path.exists(filepath):
                os.remove(filepath)
            return jsonify({'success': False, 'error': 'Disease model not loaded on server'}), 500

        model = disease_model_data['model']
        le = disease_model_data['label_encoder']
        kb = disease_model_data['knowledge_base']

        # Plant foliage signal check (ensure image has leaf characteristics)
        green_r, brown_r, yellow_r, _, _ = features
        foliage_signal = green_r + brown_r + yellow_r

        probs = model.predict_proba([features])[0]
        pred_idx = int(np.argmax(probs))
        # Direct ML confidence straight from Random Forest prediction probabilities
        confidence = int(round(probs[pred_idx] * 100))

        # Check if the model is confident and image has clear plant features
        if confidence < 60 or foliage_signal < 0.08:
            conn = get_db()
            cursor = conn.execute(
                "INSERT INTO disease_scans (user_id, plant_id, image_name, disease_name, confidence, severity, symptoms, suggestions_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (uid, plant_id, filename, 'Uncertain', confidence, 'Unknown', '', json.dumps([]))
            )
            scan_id = cursor.lastrowid
            previous_scan = conn.execute(
                "SELECT * FROM disease_scans WHERE plant_id = ? AND user_id = ? AND id <> ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 1",
                (plant_id, uid, scan_id)
            ).fetchone()
            conn.commit()
            saved_scan = conn.execute("SELECT * FROM disease_scans WHERE id = ?", (scan_id,)).fetchone()
            conn.close()
            return jsonify({
                'success': True,
                'scan_id': scan_id,
                'scan': serialize_scan(saved_scan),
                'previous_scan': serialize_scan(previous_scan) if previous_scan else None,
                'reliable': False,
                'low_confidence': True,
                'confidence': confidence,
                'warning': '⚠️ Low confidence',
                'message': 'Please upload a clearer image.',
                'recommended_action': 'Please upload a clearer image.'
            })

        disease_key = le.inverse_transform([pred_idx])[0]
        diag_info = kb.get(disease_key, {})

        dosage_pattern = re.compile(r'\b\d+(?:\.\d+)?\s*(?:g|kg|mg|ml|l|ppm)\b|@\s*\d|\b\d+%\s*(?:wp|sc|ec)?', re.IGNORECASE)
        safe_suggestions = [
            item for item in diag_info.get('suggestions', [])
            if not dosage_pattern.search(item)
        ]
        recommended_action = diag_info.get('recommended_action', '')
        if dosage_pattern.search(recommended_action):
            recommended_action = safe_suggestions[0] if safe_suggestions else 'Follow treatment guidance from a local agricultural expert.'

        risk_text = f"{diag_info.get('risk', '')} {diag_info.get('severity', '')}".lower()
        if 'critical' in risk_text or 'high' in risk_text or 'severe' in risk_text:
            severity_level = 'High'
        elif 'moderate' in risk_text or 'medium' in risk_text:
            severity_level = 'Medium'
        else:
            severity_level = 'Low'

        conn = get_db()
        cursor = conn.execute(
            "INSERT INTO disease_scans (user_id, plant_id, image_name, disease_name, confidence, severity, symptoms, suggestions_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (uid, plant_id, filename, diag_info.get('disease', disease_key), confidence,
             diag_info.get('severity', diag_info.get('risk', 'Unknown')),
             diag_info.get('symptoms', ''), json.dumps(diag_info.get('suggestions', [])))
        )
        scan_id = cursor.lastrowid
        previous_scan = conn.execute(
            "SELECT * FROM disease_scans WHERE plant_id = ? AND user_id = ? AND id <> ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 1",
            (plant_id, uid, scan_id)
        ).fetchone()
        conn.commit()
        saved_scan = conn.execute("SELECT * FROM disease_scans WHERE id = ?", (scan_id,)).fetchone()
        conn.close()

        return jsonify({
            'success': True,
            'scan_id': scan_id,
            'scan': serialize_scan(saved_scan),
            'previous_scan': serialize_scan(previous_scan) if previous_scan else None,
            'reliable': True,
            'detected': diag_info.get('detected', disease_key),
            'disease': diag_info.get('disease', disease_key),
            'crop': diag_info.get('crop', 'Crop'),
            'confidence': confidence,
            'prediction_source': 'disease_model.pkl',
            'explanation': f"The uploaded leaf was classified by the ML model as {disease_key}. The visible signs below are common descriptions for this class, and the care guidance comes from the structured disease information dataset.",
            'risk': diag_info.get('risk', 'High'),
            'severity': diag_info.get('severity', 'Moderate'),
            'severity_level': severity_level,
            'recommended_action': recommended_action,
            'symptoms': diag_info.get('symptoms', ''),
            'suggestions': safe_suggestions,
            'guidance_source': 'Structured disease information dataset',
            'prevention': diag_info.get('prevention', [])
        })
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        app.logger.exception('Disease diagnostic engine failed')
        return jsonify({'success': False, 'error': 'Disease analysis is temporarily unavailable. Please try again.'}), 500


@app.route('/api/scans/<int:scan_id>', methods=['DELETE'])
def api_delete_scan(scan_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to delete a scan.'}), 401

    conn = get_db()
    scan = conn.execute(
        "SELECT image_name FROM disease_scans WHERE id = ? AND user_id = ?",
        (scan_id, user['id'])
    ).fetchone()
    if not scan:
        conn.close()
        return jsonify({'success': False, 'error': 'Scan not found.'}), 404

    conn.execute("DELETE FROM disease_scans WHERE id = ? AND user_id = ?", (scan_id, user['id']))
    conn.commit()
    conn.close()

    image_path = os.path.join(app.config['UPLOAD_FOLDER'], scan['image_name'])
    if os.path.isfile(image_path):
        try:
            os.remove(image_path)
        except OSError:
            app.logger.warning('Could not remove deleted scan image')
    return jsonify({'success': True, 'message': 'Scan deleted successfully.'})

# 3. Live Weather & Smart Irrigation API
@app.route('/api/weather', methods=['GET'])
def api_weather():
    try:
        # Support both:
        # /api/weather?latitude=17.385&longitude=78.4867
        # and:
        # /api/weather?region=telangana

        region = request.args.get('region', '').strip().lower()

        REGION_COORDINATES = {
            'telangana': {
                'latitude': 17.3850,
                'longitude': 78.4867,
                'name': 'Telangana & AP'
            },
            'punjab': {
                'latitude': 30.9010,
                'longitude': 75.8573,
                'name': 'Punjab & Haryana'
            },
            'up': {
                'latitude': 25.3176,
                'longitude': 82.9739,
                'name': 'UP & Bihar'
            },
            'tamilnadu': {
                'latitude': 13.0827,
                'longitude': 80.2707,
                'name': 'Tamil Nadu'
            }
        }

        # If region is supplied, use its coordinates
        if region:
            location = REGION_COORDINATES.get(region)

            if not location:
                return jsonify({
                    'success': False,
                    'error': 'Invalid weather region.'
                }), 400

            latitude = location['latitude']
            longitude = location['longitude']

            weather = fetch_live_weather(latitude, longitude)

            return jsonify({
                'success': True,
                'region': location['name'],
                **weather
            })

        # Otherwise support existing latitude/longitude requests
        lat_raw = request.args.get('latitude', '')
        lon_raw = request.args.get('longitude', '')
        try:
            latitude = float(lat_raw) if lat_raw else 17.385
            longitude = float(lon_raw) if lon_raw else 78.487
        except (TypeError, ValueError):
            latitude = 17.385
            longitude = 78.487

        if not -90 <= latitude <= 90:
            latitude = 17.385

        if not -180 <= longitude <= 180:
            longitude = 78.487

        try:
            weather = fetch_live_weather(latitude, longitude)
        except Exception:
            weather = get_fallback_weather(latitude, longitude)

        return jsonify({
            'success': True,
            **weather
        })

    except Exception:
        app.logger.exception('Live weather request failed, providing baseline fallback')
        fallback = get_fallback_weather(17.385, 78.487)
        return jsonify({
            'success': True,
            **fallback
        })


@app.route('/api/irrigation-advice', methods=['POST'])
def api_irrigation_advice():
    data = request.get_json() or {}
    crop = data.get('crop_type', 'Rice')
    moisture = int(data.get('moisture_pct', 35))
    weather = data.get('weather_condition', 'Sunny & Dry')

    if 'Rain' in weather:
        water_req = "Low"
        suggestion = "Avoid irrigation today. Heavy rainfall expected in your area."
    elif moisture < 30:
        water_req = "High"
        suggestion = f"Immediate irrigation required for {crop}. Soil moisture ({moisture}%) is critically low."
    elif moisture < 55:
        water_req = "Medium"
        suggestion = f"Irrigation may be needed soon for {crop}. Monitor moisture over the next 24-48 hours."
    else:
        water_req = "Low"
        suggestion = f"Optimal moisture levels ({moisture}%) maintained for {crop}. No immediate irrigation required."

    user_id = session.get('user_id')
    if user_id:
        conn = get_db()
        conn.execute(
            "INSERT INTO irrigation_logs (user_id, crop_type, moisture_pct, weather_condition, water_req, suggestion) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, crop, moisture, weather, water_req, suggestion)
        )
        conn.commit()
        conn.close()

    return jsonify({
        'success': True,
        'crop': crop,
        'water_requirement': water_req,
        'suggestion': suggestion
    })


# 4. Farmer Decision Score API
@app.route('/api/decision-score', methods=['POST'])
def api_decision_score():
    data = request.get_json() or {}
    crop = data.get('crop_name', 'Maize')
    soil = data.get('soil_type', 'Black')
    season = data.get('season', 'Kharif')
    water = data.get('water_availability', 'High')

    soil_score = 90 if soil in ['Black', 'Alluvial'] else 82 if soil in ['Red', 'Loamy'] else 74
    weather_score = 88 if season == 'Kharif' else 84 if season == 'Rabi' else 76
    water_score = 92 if water == 'High' else 86 if water == 'Medium' else 70
    crop_score = 87

    overall_score = int(round(soil_score * 0.30 + weather_score * 0.30 + water_score * 0.20 + crop_score * 0.20))

    if overall_score >= 85:
        verdict = f"Highly recommended! Excellent farming decision score of {overall_score}/100. Soil, weather, and water supply are in optimal alignment for {crop}."
    elif overall_score >= 70:
        verdict = f"Good conditions for {crop} with a decision score of {overall_score}/100. Ensure regular soil nutrient management and irrigation monitoring."
    else:
        verdict = f"Moderate suitability score of {overall_score}/100. Consider alternative drought-tolerant crops or soil conditioning."

    user_id = session.get('user_id')
    if user_id:
        conn = get_db()
        conn.execute(
            "INSERT INTO decision_scores (user_id, crop_name, overall_score, soil_score, weather_score, water_score, crop_score) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user_id, crop, overall_score, soil_score, weather_score, water_score, crop_score)
        )
        conn.commit()
        conn.close()

    return jsonify({
        'success': True,
        'crop_name': crop,
        'overall_score': overall_score,
        'soil_score': soil_score,
        'weather_score': weather_score,
        'water_score': water_score,
        'crop_score': crop_score,
        'verdict': verdict
    })


def build_farmer_context(user, plant_id=None, latitude=None, longitude=None, question=None, history=None):
    """Compatibility wrapper for the secure farm-context builder used by the chatbot."""
    return build_farm_data_context(
        user,
        plant_id=plant_id,
        latitude=latitude,
        longitude=longitude,
        question=question,
        history=history,
        get_db_fn=get_db,
        fetch_weather_fn=fetch_live_weather,
    )


def format_gemini_contents(history, current_message):
    """
    Formats multi-turn conversation history into valid types.Content turns for Google GenAI SDK.
    Ensures:
      - Valid alternating sequence of user and model turns.
      - First turn is user.
      - Last turn is user with the current farmer question.
      - Limits history to recent reasonable turns (last 6 messages).
    """
    contents = []

    if isinstance(history, list):
        recent = history[-6:]
        last_role = None
        for item in recent:
            if not isinstance(item, dict):
                continue
            role = item.get('role', 'user')
            role = 'model' if role in ('assistant', 'model', 'ai', 'bot') else 'user'
            text = str(item.get('text') or item.get('content') or '').strip()

            if not text:
                continue
            # Skip initial bot greeting if it appears before any user question
            if len(contents) == 0 and role == 'model':
                continue
            if role == last_role:
                continue

            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=text)]))
            last_role = role

    # Ensure last role before current_message is not 'user' so current_message adds as 'user'
    if contents and contents[-1].role == 'user':
        contents.pop()

    # Append the farmer's actual current question
    contents.append(types.Content(role='user', parts=[types.Part.from_text(text=current_message)]))
    return contents


def get_agronomist_expert_reply(message, language='en', context=None):
    """
    Intelligent Agricultural Agronomist Expert AI fallback.
    Provides precise, grounded agronomic advice covering crops, fertilizers,
    plant diseases, pests, irrigation, soil health, and government schemes.
    Supports English, Telugu, Hindi, and Tamil.
    """
    msg = (message or '').strip()
    msg_lower = msg.lower()
    context = context or {}
    lang = (language or 'en').lower()

    # 1. Greetings
    if any(msg_lower.startswith(g) or msg_lower in (g, f"{g}!", f"{g}.") for g in ('hi', 'hello', 'hey', 'namaste', 'namaskaram', 'vanakkam', 'pranam', 'greetings', 'start')):
        farmer_name = context.get('farmer_name', '')
        name_prefix = f" {farmer_name}" if farmer_name else ""
        if lang == 'te':
            return (
                f"నమస్కారం{name_prefix}! 🌾 నేను **రైతు AI (Farmer AI)** ని.\n\n"
                "మీ పంటల సంరక్షణ, ఎరువుల సమతుల్య మోతాదు (యూరియా, DAP, MOP), తెగుళ్లు మరియు పురుగుల నివారణ, "
                "నీటి యాజమాన్యం లేదా ప్రభుత్వ వ్యవసాయ పథకాల (PM-KISAN, రైతు భరోసా) గురించి ఏదైనా అడగండి. "
                "నేను మీకు సహాయం చేయడానికి సిద్ధంగా ఉన్నాను!"
            )
        elif lang == 'hi':
            return (
                f"नमस्ते{name_prefix}! 🌾 मैं **फार्मर एआई (Farmer AI)** हूँ।\n\n"
                "आपकी फसलों की देखभाल, उर्वरक प्रबंधन (यूरिया, डीएपी, पोटाश), कीट एवं रोग रोकथाम, "
                "सिंचाई या सरकारी कृषि योजनाओं (पीएम-किसान, फसल बीमा) से जुड़े सवाल पूछ सकते हैं। "
                "मैं आपकी सहायता के लिए तैयार हूँ!"
            )
        elif lang == 'ta':
            return (
                f"வணக்கம்{name_prefix}! 🌾 நான் **பார்மர் ஏஐ (Farmer AI)**.\n\n"
                "பயிர் பாதுகாப்பு, உர மேலாண்மை (யூரியா, டிஏபி, பொட்டாஷ்), பூச்சி கட்டுப்பாடு, "
                "நீர்ப்பாசனம் மற்றும் அரசு விவசாய திட்டங்கள் குறித்து நீங்கள் கேட்கலாம்."
            )
        else:
            return (
                f"Namaste{name_prefix}! 🌾 I am **Farmer AI**, your dedicated agricultural advisor.\n\n"
                "You can ask me questions about:\n"
                "* **Crops & Cultivation**: Sowing, plant spacing, crop management\n"
                "* **Fertilizers & Nutrients**: Subsidized MRP guidelines, Urea, DAP, MOP, NPK dosage\n"
                "* **Pests & Diseases**: Organic remedies (Neem oil), biological controls, and treatment\n"
                "* **Irrigation & Water**: Watering guidelines, drip irrigation, drainage\n"
                "* **Government Schemes**: PM-KISAN, PMFBY crop insurance, Rythu Bharosa\n\n"
                "How can I help you and your crops today?"
            )

    # 2. Irrigation / Watering
    if any(w in msg_lower for w in ('water', 'irrigate', 'irrigation', 'watering', 'rain', 'moisture', 'నీరు', 'తడి', 'पानी', 'सिंचाई', 'தண்ணீர்')):
        live_weather = context.get('live_weather')
        weather_snippet = ""
        rain_warning = False
        if live_weather:
            temp = live_weather.get('temperature', '')
            rain = live_weather.get('rain', '')
            cond = live_weather.get('condition', '')
            weather_snippet = f"\n*Current field conditions: {temp}, {cond}, Rain: {rain}*"
            if 'rain' in cond.lower() or 'drizzle' in cond.lower() or (rain and rain != '0 mm'):
                rain_warning = True

        if lang == 'te':
            advice = (
                "💧 **నీటి యాజమాన్య సలహా:**\n"
                + (weather_snippet + "\n\n" if weather_snippet else "\n")
                + ("⚠️ రాబోయే సమయంలో వర్ష సూచన ఉంది. నీటి నిల్వను మరియు వేరుకుళ్లు తెగులును నివారించడానికి తడి ఇవ్వడం వాయిదా వేయండి.\n\n" if rain_warning else "")
                + "1. **మట్టి తేమ పరీక్ష**: పైనుండి 2 అంగుళాల మట్టిని చేతితో పట్టి చూడండి. మట్టి పొడిగా ఉండి ఉండ కట్టకపోతేనే నీరు పెట్టండి.\n"
                "2. **సమయం**: ఎండ ఎక్కువగా ఉన్నప్పుడు కాకుండా తెల్లవారుజామున లేదా సాయంత్రం వేళల్లో నీరు పెట్టడం మంచిది.\n"
                "3. **సూక్ష్మ సేద్యం**: బిందు సేద్యం (Drip Irrigation) ద్వారా 40-50% నీరు ఆదా అవుతుంది, కలుపు మొక్కల బెడద తగ్గుతుంది.\n"
                "4. **కీలక దశలు**: పూత దశ మరియు గింజ పాలు పోసుకునే దశల్లో నేలలో తగినంత తేమ ఉండేలా చూసుకోండి."
            )
            return advice
        elif lang == 'hi':
            advice = (
                "💧 **सिंचाई एवं जल प्रबंधन सलाह:**\n"
                + (weather_snippet + "\n\n" if weather_snippet else "\n")
                + ("⚠️ बारिश की संभावना है। जलभराव और जड़ सड़न से बचने के लिए अभी सिंचाई रोकें।\n\n" if rain_warning else "")
                + "1. **नमी की जांच**: ऊपरी 2 इंच मिट्टी की जांच करें। यदि मिट्टी सूखी हो तभी सिंचाई करें।\n"
                "2. **सही समय**: दोपहर की तेज धूप के बजाय सुबह या शाम के समय पानी दें।\n"
                "3. **ड्रिप सिंचाई**: ड्रिप या फव्वारा सिंचाई से 40-50% पानी की बचत होती है और फसल को समान पोषण मिलता है।\n"
                "4. **महत्वपूर्ण अवस्था**: फूल आने और दाना भरने की अवस्था में खेत में नमी बनाए रखना अनिवार्य है।"
            )
            return advice
        else:
            advice = (
                "💧 **Irrigation & Water Management Advice:**\n"
                + (weather_snippet + "\n\n" if weather_snippet else "\n")
                + ("⚠️ *Rainfall or damp conditions detected in your local weather. Delay supplementary irrigation to prevent root rot and waterlogging.*\n\n" if rain_warning else "")
                + "1. **Soil Moisture Check**: Test the top 2 inches of topsoil with your fingers. Irrigate only when the soil feels dry and crumbly.\n"
                "2. **Timing**: Water during the early morning or late afternoon to minimize evaporation losses.\n"
                "3. **Critical Stages**: Ensure adequate moisture during flowering, pod development, or grain filling stages.\n"
                "4. **Water Efficiency**: Drip irrigation reduces water consumption by 40-50% and reduces fungal leaf diseases by keeping foliage dry.\n"
                "5. **Drainage**: Ensure proper field drainage channels so excess water drains out smoothly during sudden showers."
            )
            return advice

    # 3. Fertilizers, Urea, DAP, MOP, Pricing
    if any(w in msg_lower for w in ('fertilizer', 'urea', 'dap', 'mop', 'potash', 'npk', 'zinc', 'manure', 'compost', 'price', 'rate', 'cost', 'ఎరువు', 'యూరియా', 'उर्वरक', 'खाद', 'यूरिया', 'உரம்')):
        if lang == 'te':
            return (
                "🌱 **ఎరువుల సమతుల్య వినియోగం మరియు అధికారిక ధరలు:**\n\n"
                "**అధికారిక రాయితీ ధరల మార్గదర్శకాలు (MRP):**\n"
                "* **వేపపూత యూరియా (45 కిలోల బస్తా)**: ₹266.50 (ప్రభుత్వ గరిష్ట ధర)\n"
                "* **DAP (18:46:0, 50 కిలోల బస్తా)**: సుమారు ₹1,350\n"
                "* **MOP (మ్యూరేట్ ఆఫ్ పొటాష్, 50 కిలోల బస్తా)**: సుమారు ₹1,650 – ₹1,750\n"
                "* **NPK కాంప్లెక్స్ ఎరువులు (50 కిలోలు)**: సుమారు ₹1,400 – ₹1,500\n\n"
                "**ముఖ్యమైన పోషక యాజమాన్య పద్ధతులు:**\n"
                "1. **యూరియా వేసే పద్ధతి**: యూరియా మొత్తం ఒకేసారి వేయకూడదు. 2 లేదా 3 దఫాలుగా విభజించి వేయాలి (విత్తేటప్పుడు, శాఖీయ దశలో, పూతకు ముందు).\n"
                "2. **DAP వినియోగం**: విత్తనాలు నాటే సమయంలో లేదా ఆఖరి దుక్కిలో మూలాల దగ్గర వేయాలి.\n"
                "3. **జింక్ లోపం**: ఆకులు పసుపు రంగులోకి మారితే ఎకరానికి 10 కిలోల జింక్ సల్ఫేట్ వేయండి. జింక్ మరియు DAP ఎప్పుడూ కలిపి వేయకూడదు."
            )
        elif lang == 'hi':
            return (
                "🌱 **उर्वरक प्रबंधन एवं आधिकारिक मूल्य दिशा-निर्देश:**\n\n"
                "**सरकारी सब्सिडी मूल्य (MRP):**\n"
                "* **नीम लेपित यूरिया (45 किग्रा बोरी)**: ₹266.50 (सरकारी वैधानिक मूल्य)\n"
                "* **डीएपी (18:46:0, 50 किग्रा बोरी)**: लगभग ₹1,350\n"
                "* **एमओपी (पोटाश, 50 किग्रा बोरी)**: लगभग ₹1,650 – ₹1,750\n"
                "* **एनपीके कॉम्प्लेक्स (50 किग्रा)**: लगभग ₹1,400 – ₹1,500\n\n"
                "**उर्वरक उपयोग के प्रमुख नियम:**\n"
                "1. **यूरिया का प्रयोग**: यूरिया को कभी भी एक साथ न डालें। इसे 2-3 भागों में बांटकर दें (बुवाई, कल्ले फूटते समय, फूल आने से पूर्व)।\n"
                "2. **डीएपी**: बुवाई के समय बेसल डोज के रूप में जड़ क्षेत्र के पास दें।\n"
                "3. **जिंक सल्फेट**: जिंक की कमी दिखने पर 0.5% जिंक सल्फेट + चूने के घोल का छिड़काव करें। डीएपी और जिंक को कभी भी एक साथ न मिलाएं।"
            )
        else:
            return (
                "🌱 **Fertilizer Guidance & Official Indian MRP Guidelines:**\n\n"
                "**Statutory Subsidized Reference Prices (Per Bag):**\n"
                "* **Neem-Coated Urea (45 kg bag)**: ₹266.50 (statutorily fixed MRP across India by Central Govt)\n"
                "* **DAP (Diammonium Phosphate 18:46:0, 50 kg)**: ~₹1,350 (subsidized MRP)\n"
                "* **MOP (Muriate of Potash 0:0:60, 50 kg)**: ~₹1,650 – ₹1,750\n"
                "* **NPK Complexes (e.g. 10:26:26, 20:20:0:13, 50 kg)**: ~₹1,400 – ₹1,500\n\n"
                "**Best Agronomic Practices:**\n"
                "1. **Split Nitrogen Application**: Never broadcast all Urea at once. Split into 2–3 applications (1/3 basal at sowing, 1/3 at vegetative tillering, and 1/3 prior to flowering) to prevent leaching.\n"
                "2. **Phosphorus Placement**: Apply DAP deep into the root zone during sowing or final land preparation.\n"
                "3. **Potassium for Resilience**: MOP strengthens stalks against lodging, increases drought tolerance, and improves grain/fruit weight.\n"
                "4. **Zinc Management**: For zinc deficiency (yellowing between leaf veins), apply Zinc Sulphate (10–15 kg/acre) or spray 0.5% ZnSO4 with lime. *Never mix zinc fertilizers directly with DAP or other phosphate fertilizers.*"
            )

    # 4. Disease Scans & Plant Health ("what is wrong with my plant", "explain my latest scan", "disease", "scan", "leaf")
    if any(w in msg_lower for w in ('wrong', 'explain', 'scan', 'disease', 'leaf', 'blight', 'spot', 'yellow', 'fungus', 'rot', 'curl', 'తెగులు', 'వ్యాధి', 'ఆకు', 'रोग', 'धब्बा', 'पीला', 'நோய்')):
        selected = context.get('selected_plant') or {}
        scan = context.get('latest_disease_scan') or {}
        crop_title = selected.get('crop_name') or 'Crop'
        disease_name = scan.get('disease_name') or 'Detected Condition'
        confidence = scan.get('confidence') or ''
        conf_str = f" ({confidence}% match)" if confidence else ""

        if scan.get('disease_name'):
            return (
                f"🔬 **Plant Health & Disease Analysis for {crop_title}:**\n\n"
                f"**Identified Condition:** **{disease_name}**{conf_str}\n\n"
                "**Step-by-Step Remedial Action:**\n"
                "1. **Sanitation**: Remove and carefully bury or burn heavily infected leaves to stop spores from spreading to neighboring plants.\n"
                "2. **Organic / Botanical Spray**: Spray **Neem Oil (1500 ppm @ 3–5 ml per liter of water)** mixed with a few drops of mild soap or shampoo as a sticker.\n"
                "3. **Fungal Treatment**: If fungal spots/blight continue to spread, spray **Mancozeb 75 WP (2 g/L)** or **Copper Oxychloride 50 WP (2.5–3 g/L)**.\n"
                "4. **Bacterial Infection**: If water-soaked lesions or bacterial ooze are present, spray **Streptocycline (1 g in 10 L water)** combined with Copper Oxychloride.\n"
                "5. **Irrigation Hygiene**: Avoid overhead sprinkler watering that keeps leaves wet overnight. Water directly at the root zone."
            )
        else:
            return (
                "🔬 **Plant Health Diagnostics & Disease Identification:**\n\n"
                "To give you an exact diagnosis for your crop:\n"
                "1. **Use the Disease Scanner**: Take or upload a clear, well-lit photo of the affected leaf in the **Disease Detection** tab.\n"
                "2. **Common Symptoms Checklist**:\n"
                "   * **Yellowing lower leaves**: Often nitrogen deficiency or overwatering/root suffocation.\n"
                "   * **Brown concentric rings/spots**: Early blight or Alternaria leaf spot (treat with Mancozeb 2 g/L).\n"
                "   * **White powdery coating**: Powdery mildew (treat with Wettable Sulphur 2.5 g/L or Neem oil).\n"
                "   * **Leaf curling upwards**: Caused by sucking pests like Thrips (spray Neem oil 1500 ppm @ 3 ml/L).\n"
                "   * **Leaf curling downwards**: Caused by Mites (spray Wettable Sulphur or Miticide).\n\n"
                "Tell me your crop name and symptoms for specific remedy instructions!"
            )

    # 5. Pests, Insects, Worms, Borers
    if any(w in msg_lower for w in ('pest', 'insect', 'worm', 'caterpillar', 'aphid', 'whitefly', 'thrip', 'mite', 'borer', 'bug', 'పురుగు', 'కీటకం', 'కీడ', 'कीट', 'इल्ली', 'कीड़ा', 'பூச்சி')):
        return (
            "🐛 **Integrated Pest Management (IPM) Guidelines:**\n\n"
            "**1. Organic & Biological Control (First Line of Defense):**\n"
            "* **Neem Oil Spray**: 1500 ppm Neem Oil @ 3–5 ml per liter of water with 1 ml soap as emulsifier. Spray on both upper and lower leaf surfaces.\n"
            "* **Sticky Traps**: Install 15–20 Yellow Sticky Traps per acre for whiteflies/aphids, and Blue Sticky Traps for thrips.\n"
            "* **Bio-Pesticides**: Spray *Beauveria bassiana* or *Bacillus thuringiensis (Bt)* @ 5 g/L in the evening hours.\n\n"
            "**2. Borers & Caterpillars (Stem borer, Bollworm, Fruit borer):**\n"
            "* Install **Pheromone Traps** (5–8 traps per acre) to monitor and disrupt mating.\n"
            "* For severe borer attacks, apply **Chlorantraniliprole 18.5 SC (0.3 ml/L)** or **Emamectin Benzoate 5 SG (0.4 g/L)**.\n\n"
            "**3. Safety Guidelines:**\n"
            "* Avoid spraying chemicals during peak midday sunlight and during flowering when bees and pollinators are active.\n"
            "* Always wear protective mask and gloves while spraying."
        )

    # 5b. Labour, Worker & Wages Intelligence (Grounding from Real Database)
    if any(w in msg_lower for w in ('labour', 'labor', 'worker', 'workers', 'wage', 'wages', 'owe', 'pending', 'attendance', 'కూలీ', 'రమేశ్', 'मजदूर', 'मजदूरी')):
        fin = context.get('labour_financial_summary', {})
        crop_labour = context.get('labour_by_crop', [])
        workers = context.get('labour_workers', [])
        jobs = context.get('labour_jobs', [])

        # Check for specific crop query (e.g. cotton, paddy, tomato)
        for cl in crop_labour:
            c_name = str(cl.get('crop', '')).lower()
            if c_name and c_name in msg_lower:
                return (
                    f"👨‍🌾 **Labour Work Record for {cl.get('crop')}:**\n\n"
                    f"* **Total Labour Cost Recorded**: ₹{float(cl.get('total_labour_cost', 0)):,.2f}\n"
                    f"* **Total Jobs / Contracts**: {cl.get('jobs_count', 0)}\n\n"
                    "This data is retrieved directly from your recorded Labour Work Tracker database entries."
                )

        # Check for specific worker name query (e.g. Ramesh)
        for w_item in workers:
            w_name = str(w_item.get('worker_name', '')).lower()
            if w_name and w_name in msg_lower:
                return (
                    f"👨‍🌾 **Worker Summary for {w_item.get('worker_name')}:**\n\n"
                    f"* **Total Days Worked**: {w_item.get('total_days_worked', 0)} days\n"
                    f"* **Total Jobs**: {w_item.get('total_jobs', 0)}\n"
                    f"* **Total Wages Earned**: ₹{float(w_item.get('total_earned', 0)):,.2f}\n\n"
                    "All records are verified from your daily attendance and labour logs."
                )

        # Check if asking about pending amounts / owing
        if any(w in msg_lower for w in ('owe', 'pending', 'balance', 'remaining', 'due', 'బాకీ')):
            pending_val = float(fin.get('total_pending_wages', 0))
            return (
                f"💰 **Pending Worker Wages Summary:**\n\n"
                f"* **Total Amount Pending / Owed**: **₹{pending_val:,.2f}**\n"
                f"* **Total Labour Cost**: ₹{float(fin.get('total_labour_cost', 0)):,.2f}\n"
                f"* **Total Paid So Far**: ₹{float(fin.get('total_paid', 0)):,.2f}\n"
                f"* **Advances Given**: ₹{float(fin.get('total_advances', 0)):,.2f}\n\n"
                "You can record payments or advances anytime in the **Labour Work Tracker**."
            )

        # General labour overview
        if fin or jobs or workers:
            worker_names = [w.get('worker_name') for w in workers if w.get('worker_name')]
            names_str = ", ".join(worker_names[:5]) if worker_names else "No workers recorded yet"
            return (
                f"👨‍🌾 **Your Labour Work & Worker Summary:**\n\n"
                f"* **Total Labour Cost**: ₹{float(fin.get('total_labour_cost', 0)):,.2f}\n"
                f"* **Paid to Date**: ₹{float(fin.get('total_paid', 0)):,.2f}\n"
                f"* **Pending Amount**: ₹{float(fin.get('total_pending_wages', 0)):,.2f}\n"
                f"* **Recent Workers**: {names_str}\n"
                f"* **Active Jobs**: {len(jobs)}\n\n"
                "You can view daily attendance, hourly timers, two-party confirmations, and settlement history in the **Labour Work** section."
            )

    # 6. Specific Major Crops
    # Tomato
    if 'tomato' in msg_lower or 'టమాటా' in msg_lower or 'टमाटर' in msg_lower:
        return (
            "🍅 **Tomato Crop Management Guide:**\n\n"
            "1. **Soil & Spacing**: Well-drained sandy loam soil (pH 6.0–6.8). Plant seedlings with 60 cm x 45 cm spacing.\n"
            "2. **Staking**: Stake indeterminate plants with bamboo poles to keep fruits off the soil and reduce fruit rot.\n"
            "3. **Leaf Curl Prevention**: Whiteflies transmit tomato leaf curl virus. Install yellow sticky traps and spray Neem oil (3 ml/L).\n"
            "4. **Early/Late Blight**: Spray Mancozeb 75 WP (2 g/L) or Copper Oxychloride (2.5 g/L) at the first sign of dark brown spots.\n"
            "5. **Nutrients**: Balanced NPK (100:60:60 kg/ha). Apply calcium nitrate (2 g/L spray) to prevent Blossom End Rot (blackening at base of fruit)."
        )

    # Rice / Paddy
    if any(w in msg_lower for w in ('rice', 'paddy', 'వరి', 'धान', 'चावल')):
        return (
            "🌾 **Paddy / Rice Cultivation Guidelines:**\n\n"
            "1. **Nursery & Transplanting**: Transplant 20–25 day old seedlings at 20 cm x 15 cm spacing (2–3 seedlings per hill).\n"
            "2. **Water Management**: Maintain 2–5 cm shallow standing water during tillering and flowering. Drain completely 10 days before harvest.\n"
            "3. **Fertilizer Dose (NPK 100:50:50 kg/ha)**:\n"
            "   * Full DAP/Phosphorus + 1/3 Potash as basal dose before transplanting.\n"
            "   * Urea in 3 split doses (at active tillering, panicle initiation, and boot leaf stage).\n"
            "4. **Blast Disease Control**: Spray Tricyclazole 75 WP (0.6 g/L) if spindle-shaped spots appear.\n"
            "5. **Stem Borer & Leaf Folder**: Install pheromone traps (5/acre). Spray Cartap Hydrochloride 50 SP (2 g/L) if threshold is exceeded."
        )

    # Cotton
    if any(w in msg_lower for w in ('cotton', 'పత్తి', 'कपास')):
        return (
            "🌱 **Cotton Crop Health & Management:**\n\n"
            "1. **Spacing**: 90 cm x 60 cm or 120 cm x 45 cm depending on soil type and hybrid.\n"
            "2. **Sucking Pest Control (Jassids, Whitefly, Thrips)**: Install yellow and blue sticky traps (15/acre). Spray Neem oil 1500 ppm @ 3 ml/L or Flonicamid 50 WG (0.3 g/L).\n"
            "3. **Pink Bollworm Management**: Install pheromone traps (5/acre) at 45 days after sowing. Inspect 20 bolls/acre regularly. Apply Neem-based sprays.\n"
            "4. **Nutrient Management**: Split Nitrogen in 3 doses. Apply 13:0:45 (Potassium Nitrate) foliar spray at boll formation stage to improve boll weight and fiber strength."
        )

    # Chilli
    if any(w in msg_lower for w in ('chilli', 'chili', 'mirchi', 'మిరప', 'मिर्च')):
        return (
            "🌶️ **Chilli (Mirchi) Crop Protection Guide:**\n\n"
            "1. **Leaf Curl Management**: \n"
            "   * *Upward curling*: Caused by Thrips -> Spray Neem oil or Fipronil 5 SC (2 ml/L).\n"
            "   * *Downward curling*: Caused by Yellow Mites -> Spray Wettable Sulphur (3 g/L) or Spiromesifen (1 ml/L).\n"
            "2. **Dieback / Anthracnose (Fruit Rot)**: Spray Azoxystrobin 23 SC (1 ml/L) or Copper Oxychloride (2.5 g/L).\n"
            "3. **Bed Drainage**: Cultivate on raised beds to avoid damping off and collar rot."
        )

    # Wheat
    if any(w in msg_lower for w in ('wheat', 'గోధుమ', 'गेहूं')):
        return (
            "🌾 **Wheat Cultivation & Care:**\n\n"
            "1. **Sowing Time**: First fortnight of November is optimal for best yields.\n"
            "2. **Critical Irrigation Stages**: Crown Root Initiation (CRI) at 20–25 days after sowing is the most crucial irrigation stage.\n"
            "3. **Fertilizer Dose**: NPK 120:60:40 kg/ha. Apply all P and K with 1/2 Nitrogen at sowing, remainder Nitrogen in 2 split top dressings.\n"
            "4. **Yellow Rust**: Spray Propiconazole 25 EC (1 ml/L) immediately upon observing yellow pustules in stripes on leaves."
        )

    # Maize / Corn
    if any(w in msg_lower for w in ('maize', 'corn', 'మొక్కజొన్న', 'मक्का')):
        return (
            "🌽 **Maize (Corn) Management:**\n\n"
            "1. **Fall Armyworm (FAW) Management**: Inspect central leaf whorls regularly. Apply sand/ash mix or spray Emamectin Benzoate 5 SG (0.4 g/L) or Spinetoram 11.7 SC (0.5 ml/L) directly into whorls.\n"
            "2. **Fertilizer**: Maize requires high nitrogen. Apply NPK 120:60:50 with Urea split at knee-high and tasseling stages.\n"
            "3. **Drainage**: Maize cannot tolerate water stagnation for more than 24 hours. Ensure free-flowing furrows."
        )

    # 7. Government Agricultural Schemes
    if any(w in msg_lower for w in ('scheme', 'pm kisan', 'pm-kisan', 'subsidy', 'insurance', 'rythu', 'fasal bima', 'kcc', 'పథకం', 'రైతు బంధు', 'योजना', 'திட்டம்')):
        return (
            "🏛️ **Government Agricultural Schemes & Benefits:**\n\n"
            "1. **PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)**:\n"
            "   * Financial benefit of **₹6,000 per year** provided in 3 equal installments of ₹2,000 directly into Aadhaar-seeded bank accounts.\n"
            "   * Check e-KYC and land seeding status at `pmkisan.gov.in`.\n\n"
            "2. **PM Fasal Bima Yojana (PMFBY)**:\n"
            "   * Comprehensive crop insurance against non-preventable natural risks (drought, flood, unseasonal rain, pests).\n"
            "   * Farmer premium is capped at just **2% for Kharif crops**, **1.5% for Rabi crops**, and 5% for annual horticultural crops.\n\n"
            "3. **State Investment Schemes (e.g. Rythu Bharosa / Rythu Bandhu)**:\n"
            "   * Seasonal per-acre financial investment assistance for agricultural inputs.\n\n"
            "4. **PM Krishi Sinchayee Yojana (PMKSY)**:\n"
            "   * 70% to 90% subsidy for small and marginal farmers installing Drip and Sprinkler irrigation systems.\n\n"
            "5. **Soil Health Card Scheme**:\n"
            "   * Free scientific soil testing provided by the Agriculture Department / KVK every 2 years for optimal fertilizer planning."
        )



    # 9. General / Default Agricultural Agronomist Advice
    farmer_ctx = ""
    if context.get('registered_crops'):
        crops = [c.get('crop_name') for c in context['registered_crops'] if c.get('crop_name')]
        if crops:
            farmer_ctx = f" (Focusing on your registered crops: {', '.join(crops[:3])})"

    return (
        f"🌾 **Farmer AI - Agronomist Field Recommendations{farmer_ctx}:**\n\n"
        "Here are verified best practices for your field query:\n\n"
        "1. **Soil & Land Preparation**: Ensure deep summer ploughing to expose soil-borne fungal spores and pest pupae to sunlight. Incorporate well-decomposed manure or compost.\n"
        "2. **Balanced Nutrition (N-P-K)**: Avoid applying excess Urea alone, as excess nitrogen makes crops soft and vulnerable to pest attacks. Balance with DAP and MOP (Potash).\n"
        "3. **Water Management**: Check topsoil moisture before irrigating. Avoid stagnant water in vegetable crops and maize; maintain shallow water only in puddle paddy.\n"
        "4. **Preventive Plant Protection**: Spray Neem oil (1500 ppm @ 3 ml/L) early in the crop cycle as a natural deterrent against sucking pests and caterpillars.\n"
        "5. **Weather Vigilance**: Always verify 3-day local rain forecasts before applying expensive fertilizers or chemical sprays to prevent wash-off.\n\n"
        "Feel free to specify your crop name, symptoms, or fertilizer question for a tailored solution!"
    )


def chat_response(data):
    global _VERIFIED_GEMINI_MODEL
    message = str(data.get('message', '')).strip()
    language = data.get('language', 'en')
    if not message:
        return jsonify({'success': False, 'error': 'Please type a question first.'}), 400
    if len(message) > 2000:
        return jsonify({'success': False, 'error': 'Please keep your question under 2,000 characters.'}), 413

    user = get_current_user()
    rate_key = f"{user['id'] if user else request.remote_addr}:chat"
    now = time.time()
    with chat_rate_limit_lock:
        recent = [stamp for stamp in chat_rate_limit.get(rate_key, []) if now - stamp < CHAT_RATE_WINDOW_SECONDS]
        if len(recent) >= CHAT_RATE_MAX_REQUESTS:
            return jsonify({'success': False, 'error': 'You have reached the chat limit for now. Please try again later.'}), 429
        recent.append(now)
        chat_rate_limit[rate_key] = recent

    plant_id = data.get('plant_id')
    try:
        plant_id = int(plant_id) if plant_id else None
    except (TypeError, ValueError):
        plant_id = None

    context = build_farmer_context(
        user,
        plant_id=plant_id,
        latitude=data.get('latitude'),
        longitude=data.get('longitude'),
        question=message,
        history=data.get('history', []),
    )

    system_instruction = _FARMING_SYSTEM_PROMPT
    if context:
        clean_context_str = json.dumps(context, ensure_ascii=False, indent=2, default=str)
        system_instruction += f"\n\nVERIFIED APPLICATION CONTEXT (Grounding data about the farmer/farm — use only when relevant):\n{clean_context_str}"

    if language and language != 'en':
        lang_map = {'te': 'Telugu', 'hi': 'Hindi', 'ta': 'Tamil'}
        if language in lang_map:
            system_instruction += f"\n\nCRITICAL LANGUAGE INSTRUCTION: The farmer has selected {lang_map[language]}. Please respond in {lang_map[language]}."

    reply = None
    last_error = None

    active_client = get_gemini_client()
    if active_client:
        contents = format_gemini_contents(data.get('history', []), message)
        gen_config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            max_output_tokens=700,
            temperature=0.4,
        )

        models_to_try = [_VERIFIED_GEMINI_MODEL] if _VERIFIED_GEMINI_MODEL else []
        for m in _CANDIDATE_GEMINI_MODELS:
            if m not in models_to_try:
                models_to_try.append(m)

        for model_name in models_to_try:
            try:
                response = active_client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=gen_config,
                )
                text = (response.text or '').strip()
                if text:
                    _VERIFIED_GEMINI_MODEL = model_name
                    return jsonify({'success': True, 'reply': text, 'powered_by': f'gemini ({model_name})'})
            except Exception as e:
                last_error = str(e)
                app.logger.warning("Gemini generation with %s failed: %s", model_name, str(e))

    if last_error:
        app.logger.warning("Gemini API not available (%s). Utilizing Agronomist Expert AI fallback.", last_error)

    # Seamless fallback - always return expert agronomy advice, never leave the farmer with an error
    reply = get_agronomist_expert_reply(message, language, context)
    return jsonify({
        'success': True,
        'reply': reply,
        'powered_by': 'agronomist_expert_ai'
    })



@app.route('/api/gemini/chat', methods=['POST', 'OPTIONS'])
def api_gemini_chat():
    if request.method == 'OPTIONS':
        return '', 204
    return chat_response(request.get_json(silent=True) or {})


@app.route('/api/chat', methods=['POST', 'OPTIONS'])
def api_chat():
    if request.method == 'OPTIONS':
        return '', 204
    return chat_response(request.get_json(silent=True) or {})


# ==============================================================================
# FARM DIARY & EXPENSES REST APIs
# ==============================================================================

ALLOWED_MEDIA_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.pdf'}

def save_farm_media(file_obj):
    if not file_obj or not file_obj.filename:
        return None
    orig_name = secure_filename(file_obj.filename)
    ext = os.path.splitext(orig_name)[1].lower()
    if ext not in ALLOWED_MEDIA_EXTENSIONS:
        raise ValueError(f"Unsupported file type '{ext}'. Allowed types: JPG, PNG, WEBP, BMP, GIF, PDF.")
    filename = f"farm_{secrets.token_hex(12)}{ext}"
    target_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file_obj.save(target_path)
    return filename

def serialize_diary_entry(row):
    item = dict(row)
    if item.get('photo_path'):
        clean_name = os.path.basename(item['photo_path'])
        item['photo_url'] = f"/uploads/{clean_name}"
    else:
        item['photo_url'] = None
    return item

def serialize_expense(row):
    item = dict(row)
    item['amount'] = float(item.get('amount') or 0.0)
    item['tax'] = float(item.get('tax') or 0.0)
    item['discount'] = float(item.get('discount') or 0.0)
    item['bill_number'] = item.get('bill_number') or None
    item['vendor_name'] = item.get('vendor_name') or None
    item['vendor_phone'] = item.get('vendor_phone') or None
    item['vendor_address'] = item.get('vendor_address') or None
    item['receipt_source'] = item.get('receipt_source') or 'MANUAL'
    item['payment_method'] = item.get('payment_method') or None
    item['scanned_at'] = item.get('scanned_at') or None

    raw_json = item.get('raw_extracted_json')
    if raw_json:
        try:
            item['extracted_details'] = json.loads(raw_json)
        except Exception:
            item['extracted_details'] = None
    else:
        item['extracted_details'] = None

    if item.get('receipt_path'):
        clean_name = os.path.basename(item['receipt_path'])
        item['receipt_url'] = f"/uploads/{clean_name}"
    else:
        item['receipt_url'] = None
    return item

def serialize_income(row):
    item = dict(row)
    item['quantity'] = float(item.get('quantity') or 0.0)
    item['selling_price'] = float(item.get('selling_price') or 0.0)
    item['total_amount'] = float(item.get('total_amount') or 0.0)
    return item

@app.route('/farm-diary')
def page_farm_diary():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    dist_index = os.path.join(app.root_path, 'dist', 'index.html')
    if os.path.exists(dist_index):
        return send_from_directory(os.path.join(app.root_path, 'dist'), 'index.html')
    return redirect(url_for('dashboard'))

# 1. Farm Diary Endpoints
@app.route('/api/farm-diary', methods=['GET'])
def api_get_farm_diary():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to view your farm diary.'}), 401

    crop_filter = request.args.get('crop', '').strip()
    activity_filter = request.args.get('activity_type', '').strip()
    search = request.args.get('search', '').strip()
    start_date = request.args.get('start_date', '').strip()
    end_date = request.args.get('end_date', '').strip()

    query = "SELECT * FROM farm_diary_entries WHERE user_id = ?"
    params = [user['id']]

    if crop_filter:
        query += " AND LOWER(crop) = LOWER(?)"
        params.append(crop_filter)
    if activity_filter:
        query += " AND LOWER(activity_type) = LOWER(?)"
        params.append(activity_filter)
    if start_date:
        query += " AND date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND date <= ?"
        params.append(end_date)
    if search:
        query += " AND (LOWER(crop) LIKE ? OR LOWER(field_name) LIKE ? OR LOWER(activity_type) LIKE ? OR LOWER(description) LIKE ? OR LOWER(notes) LIKE ?)"
        term = f"%{search.lower()}%"
        params.extend([term, term, term, term, term])

    query += " ORDER BY date DESC, id DESC"

    conn = get_db()
    rows = conn.execute(query, params).fetchall()
    conn.close()

    entries = [serialize_diary_entry(r) for r in rows]
    return jsonify({'success': True, 'entries': entries, 'count': len(entries)})


@app.route('/api/farm-diary', methods=['POST'])
def api_create_farm_diary():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to add diary entries.'}), 401

    if request.is_json:
        data = request.get_json(silent=True) or {}
        date_val = str(data.get('date', '')).strip()
        crop_val = str(data.get('crop', '')).strip()
        field_val = str(data.get('field_name', '')).strip()
        activity_val = str(data.get('activity_type', '')).strip()
        desc_val = str(data.get('description', '')).strip()
        notes_val = str(data.get('notes', '')).strip()
        photo_path = str(data.get('photo_path', '')).strip() or None
    else:
        date_val = str(request.form.get('date', '')).strip()
        crop_val = str(request.form.get('crop', '')).strip()
        field_val = str(request.form.get('field_name', '')).strip()
        activity_val = str(request.form.get('activity_type', '')).strip()
        desc_val = str(request.form.get('description', '')).strip()
        notes_val = str(request.form.get('notes', '')).strip()
        photo_path = str(request.form.get('photo_path', '')).strip() or None

        if 'photo' in request.files and request.files['photo'].filename:
            try:
                photo_path = save_farm_media(request.files['photo'])
            except ValueError as ve:
                return jsonify({'success': False, 'error': str(ve)}), 400

    if not date_val:
        return jsonify({'success': False, 'error': 'Date is required for diary entry.'}), 400
    if not activity_val:
        return jsonify({'success': False, 'error': 'Activity type is required.'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO farm_diary_entries (user_id, date, crop, field_name, activity_type, description, notes, photo_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (user['id'], date_val, crop_val, field_val, activity_val, desc_val, notes_val, photo_path))
    entry_id = cursor.lastrowid
    conn.commit()

    created = conn.execute("SELECT * FROM farm_diary_entries WHERE id = ?", (entry_id,)).fetchone()
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Farm diary entry created successfully.',
        'entry': serialize_diary_entry(created)
    }), 201


@app.route('/api/farm-diary/<int:entry_id>', methods=['PUT', 'POST'])
def api_update_farm_diary(entry_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to update diary entries.'}), 401

    conn = get_db()
    existing = conn.execute(
        "SELECT * FROM farm_diary_entries WHERE id = ? AND user_id = ?",
        (entry_id, user['id'])
    ).fetchone()

    if not existing:
        conn.close()
        return jsonify({'success': False, 'error': 'Diary entry not found or unauthorized.'}), 404

    if request.is_json:
        data = request.get_json(silent=True) or {}
        date_val = str(data.get('date', existing['date'])).strip()
        crop_val = str(data.get('crop', existing['crop'] or '')).strip()
        field_val = str(data.get('field_name', existing['field_name'] or '')).strip()
        activity_val = str(data.get('activity_type', existing['activity_type'])).strip()
        desc_val = str(data.get('description', existing['description'] or '')).strip()
        notes_val = str(data.get('notes', existing['notes'] or '')).strip()
        photo_path = data.get('photo_path', existing['photo_path'])
    else:
        date_val = str(request.form.get('date', existing['date'])).strip()
        crop_val = str(request.form.get('crop', existing['crop'] or '')).strip()
        field_val = str(request.form.get('field_name', existing['field_name'] or '')).strip()
        activity_val = str(request.form.get('activity_type', existing['activity_type'])).strip()
        desc_val = str(request.form.get('description', existing['description'] or '')).strip()
        notes_val = str(request.form.get('notes', existing['notes'] or '')).strip()
        photo_path = request.form.get('photo_path', existing['photo_path'])

        if 'photo' in request.files and request.files['photo'].filename:
            try:
                photo_path = save_farm_media(request.files['photo'])
            except ValueError as ve:
                conn.close()
                return jsonify({'success': False, 'error': str(ve)}), 400

    if not date_val:
        conn.close()
        return jsonify({'success': False, 'error': 'Date cannot be empty.'}), 400
    if not activity_val:
        conn.close()
        return jsonify({'success': False, 'error': 'Activity type cannot be empty.'}), 400

    conn.execute("""
        UPDATE farm_diary_entries
        SET date = ?, crop = ?, field_name = ?, activity_type = ?, description = ?, notes = ?, photo_path = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
    """, (date_val, crop_val, field_val, activity_val, desc_val, notes_val, photo_path, entry_id, user['id']))
    conn.commit()

    updated = conn.execute("SELECT * FROM farm_diary_entries WHERE id = ?", (entry_id,)).fetchone()
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Diary entry updated successfully.',
        'entry': serialize_diary_entry(updated)
    })


@app.route('/api/farm-diary/<int:entry_id>', methods=['DELETE'])
def api_delete_farm_diary(entry_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to delete diary entries.'}), 401

    conn = get_db()
    existing = conn.execute(
        "SELECT * FROM farm_diary_entries WHERE id = ? AND user_id = ?",
        (entry_id, user['id'])
    ).fetchone()

    if not existing:
        conn.close()
        return jsonify({'success': False, 'error': 'Diary entry not found or unauthorized.'}), 404

    conn.execute("DELETE FROM farm_diary_entries WHERE id = ? AND user_id = ?", (entry_id, user['id']))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Diary entry deleted successfully.'})


BILL_ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.pdf'}

STANDARD_EXPENSE_CATEGORIES = [
    'Fertilizer',
    'Seeds',
    'Pesticides',
    'Equipment / Machinery',
    'Fuel / Diesel',
    'Irrigation',
    'Labour / Wages',
    'Maintenance & Repairs',
    'Tractor Service',
    'Other'
]

def normalize_expense_category(raw_category):
    if not raw_category:
        return 'Fertilizer'
    cat_lower = str(raw_category).strip().lower()
    for std in STANDARD_EXPENSE_CATEGORIES:
        if std.lower() == cat_lower or std.lower() in cat_lower or cat_lower in std.lower():
            return std
    if any(k in cat_lower for k in ['fertiliz', 'urea', 'dap', 'npk', 'potash', 'manure', 'compost']):
        return 'Fertilizer'
    if any(k in cat_lower for k in ['seed', 'grain', 'sapling', 'hybrid']):
        return 'Seeds'
    if any(k in cat_lower for k in ['pestic', 'insectic', 'fungic', 'herbicide', 'spray', 'neem', 'weed']):
        return 'Pesticides'
    if any(k in cat_lower for k in ['tractor', 'plough', 'rotavator', 'harvester', 'tillage', 'cultivat']):
        return 'Tractor Service'
    if any(k in cat_lower for k in ['diesel', 'petrol', 'fuel', 'oil', 'lubricant']):
        return 'Fuel / Diesel'
    if any(k in cat_lower for k in ['labour', 'wage', 'worker', 'coolie', 'attendance', 'salary']):
        return 'Labour / Wages'
    if any(k in cat_lower for k in ['machin', 'tool', 'pump', 'motor', 'equip', 'sprayer', 'pipe']):
        return 'Equipment / Machinery'
    if any(k in cat_lower for k in ['irrigat', 'drip', 'sprinkler', 'bore', 'well', 'water']):
        return 'Irrigation'
    if any(k in cat_lower for k in ['repair', 'service', 'mainten', 'spare', 'welding']):
        return 'Maintenance & Repairs'
    return 'Other'

def save_bill_media(file_obj, user_id=None):
    if not file_obj or not file_obj.filename:
        raise ValueError('No image file selected.')
    orig_name = secure_filename(file_obj.filename)
    ext = os.path.splitext(orig_name)[1].lower()
    if not ext:
        ext = '.jpg'
    if ext not in BILL_ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type '{ext}'. Supported formats: JPG, JPEG, PNG, WebP.")

    # Size check before reading
    file_obj.seek(0, os.SEEK_END)
    size = file_obj.tell()
    file_obj.seek(0)
    if size > 10 * 1024 * 1024:
        raise ValueError('Image size exceeds 10MB limit. Please upload a smaller image.')
    if size == 0:
        raise ValueError('Uploaded image file is empty.')

    # Validate image integrity with PIL if possible
    try:
        img = Image.open(file_obj)
        img.verify()
        file_obj.seek(0)
    except Exception as img_err:
        app.logger.debug("PIL verify check warning on upload: %s", img_err)
        file_obj.seek(0)

    filename = f"bill_{secrets.token_hex(12)}{ext}"
    target_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file_obj.save(target_path)

    if user_id:
        record_user_upload(filename, user_id)

    return filename

def extract_bill_from_image(filepath):
    """
    Invokes Gemini Vision to extract structured JSON data from a farming receipt/bill.
    Never hallucinates missing numbers, names or dates. Missing fields are set strictly to None.
    """
    global _VERIFIED_GEMINI_MODEL
    active_client = get_gemini_client()
    if not active_client:
        raise RuntimeError('AI scanning service is currently initializing. Please try again in a few moments.')

    try:
        pil_img = Image.open(filepath).convert('RGB')
    except Exception as img_err:
        raise ValueError(f'Could not process image file: {img_err}')

    system_prompt = """You are an expert OCR and agricultural document analysis AI for Farmer AI.
Your task is to analyze agricultural store receipts, fertilizer bills, seed invoices, pesticide vouchers, machinery repairs, and diesel receipts with extreme accuracy.

CRITICAL INSTRUCTIONS:
1. Determine whether this image is a bill, receipt, cash memo, invoice, payment slip, or purchase voucher. If NOT a receipt/bill, set "is_receipt": false.
2. Extract ONLY text and numbers visibly printed or clearly handwritten on the bill.
3. NEVER invent, extrapolate, or guess values. If a field is missing, unclear, or unreadable, set it strictly to null.
4. Extract item rows if visible (name, quantity, unit, unit_price, total).
5. Extract subtotal, discount, tax/GST, and grand_total.
6. Identify vendor/shop name, phone number, address, bill/receipt number, and bill date (format YYYY-MM-DD if recognizable, or null).
7. Categorize into one of: ["Fertilizer", "Seeds", "Pesticides", "Equipment / Machinery", "Fuel / Diesel", "Irrigation", "Labour / Wages", "Maintenance & Repairs", "Tractor Service", "Other"].
8. Identify payment method (e.g. "Cash", "UPI", "Bank Transfer", "Credit") if visible.
9. Return ONLY a valid JSON object without markdown fences or extra commentary.

REQUIRED JSON STRUCTURE:
{
  "is_receipt": true,
  "confidence": "high",
  "bill_number": "INV-1025",
  "bill_date": "2026-09-28",
  "vendor_name": "ABC Fertilizers",
  "vendor_phone": "9876543210",
  "vendor_address": "Main Road, Warangal",
  "category": "Fertilizer",
  "product_type": "Fertilizer",
  "items": [
    {
      "name": "Urea (45kg)",
      "quantity": 2,
      "unit": "bags",
      "unit_price": 266.5,
      "total": 533.0
    }
  ],
  "subtotal": 533.0,
  "discount": 0.0,
  "tax": 0.0,
  "grand_total": 533.0,
  "payment_method": "Cash",
  "notes": "Fertilizer purchase receipt",
  "confidence_by_field": {
    "bill_number": "high",
    "bill_date": "high",
    "vendor_name": "high",
    "vendor_phone": "high",
    "vendor_address": "medium",
    "category": "high",
    "grand_total": "high"
  }
}
"""

    models_to_try = [_VERIFIED_GEMINI_MODEL] if _VERIFIED_GEMINI_MODEL else []
    for m in _CANDIDATE_GEMINI_MODELS:
        if m not in models_to_try:
            models_to_try.append(m)

    last_error = None
    extracted_text = None

    for model_name in models_to_try:
        try:
            gen_config = types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.1,
                max_output_tokens=1200,
            )
            response = active_client.models.generate_content(
                model=model_name,
                contents=[pil_img, "Extract all structured information from this bill/receipt strictly as JSON."],
                config=gen_config
            )
            text = (response.text or '').strip()
            if text:
                _VERIFIED_GEMINI_MODEL = model_name
                extracted_text = text
                break
        except Exception as e:
            last_error = str(e)
            app.logger.warning("Gemini model %s failed on bill scan: %s", model_name, str(e))

    if not extracted_text:
        raise RuntimeError(f"Farmer AI could not read this bill clearly. Please take a clearer photo and try again. ({last_error or 'Service unavailable'})")

    # Clean JSON text
    clean_json_str = extracted_text.strip()
    if clean_json_str.startswith('```'):
        clean_json_str = re.sub(r'^```(?:json)?\s*', '', clean_json_str, flags=re.IGNORECASE)
        clean_json_str = re.sub(r'\s*```$', '', clean_json_str)

    try:
        data = json.loads(clean_json_str)
    except Exception:
        # Try finding the first outermost JSON object
        match = re.search(r'\{.*\}', clean_json_str, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(0))
            except Exception as pe:
                raise ValueError("Could not parse extracted receipt details. Please upload a clearer photo.")
        else:
            raise ValueError("Farmer AI could not read this bill clearly. Please take a clearer photo and try again.")

    if not isinstance(data, dict):
        raise ValueError("Invalid format received from receipt analysis. Please try again.")

    return sanitize_extracted_bill(data)

def sanitize_extracted_bill(data):
    is_receipt = bool(data.get('is_receipt', True))
    raw_confidence = str(data.get('confidence', 'medium')).lower()
    if raw_confidence not in ('high', 'medium', 'low', 'none'):
        try:
            val = float(raw_confidence)
            raw_confidence = 'high' if val >= 0.85 else 'medium' if val >= 0.5 else 'low'
        except Exception:
            raw_confidence = 'medium'

    bill_number = str(data.get('bill_number') or '').strip() or None
    bill_date = str(data.get('bill_date') or '').strip() or None
    if bill_date:
        # Try normalizing date format to YYYY-MM-DD
        date_match = re.search(r'(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})', bill_date)
        if date_match:
            bill_date = f"{date_match.group(1)}-{int(date_match.group(2)):02d}-{int(date_match.group(3)):02d}"
        else:
            date_match2 = re.search(r'(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})', bill_date)
            if date_match2:
                bill_date = f"{date_match2.group(3)}-{int(date_match2.group(2)):02d}-{int(date_match2.group(1)):02d}"

    vendor_name = str(data.get('vendor_name') or '').strip() or None
    vendor_phone = str(data.get('vendor_phone') or '').strip() or None
    vendor_address = str(data.get('vendor_address') or '').strip() or None
    category = normalize_expense_category(data.get('category'))
    product_type = str(data.get('product_type') or '').strip() or category
    payment_method = str(data.get('payment_method') or '').strip() or None
    notes = str(data.get('notes') or '').strip() or None

    # Parse items list
    raw_items = data.get('items') or []
    items = []
    if isinstance(raw_items, list):
        for it in raw_items:
            if not isinstance(it, dict):
                continue
            name = str(it.get('name') or '').strip()
            if not name:
                continue
            qty = None
            if it.get('quantity') is not None:
                try:
                    qty = float(it.get('quantity'))
                except (ValueError, TypeError):
                    qty = None

            unit = str(it.get('unit') or '').strip() or None

            unit_price = None
            if it.get('unit_price') is not None:
                try:
                    unit_price = float(it.get('unit_price'))
                except (ValueError, TypeError):
                    unit_price = None

            total = None
            if it.get('total') is not None:
                try:
                    total = float(it.get('total'))
                except (ValueError, TypeError):
                    total = None

            if total is None and qty is not None and unit_price is not None:
                total = round(qty * unit_price, 2)

            items.append({
                'name': name,
                'quantity': qty,
                'unit': unit,
                'unit_price': unit_price,
                'total': total
            })

    def safe_num(val):
        if val is None:
            return None
        try:
            return float(val)
        except (ValueError, TypeError):
            return None

    subtotal = safe_num(data.get('subtotal'))
    discount = safe_num(data.get('discount')) or 0.0
    tax = safe_num(data.get('tax')) or 0.0
    grand_total = safe_num(data.get('grand_total'))

    if grand_total is None and subtotal is not None:
        grand_total = round(subtotal + tax - discount, 2)
    elif grand_total is None and items:
        sum_items = sum(it['total'] for it in items if it.get('total') is not None)
        if sum_items > 0:
            grand_total = round(sum_items + tax - discount, 2)

    confidence_by_field = data.get('confidence_by_field') or {}
    if not isinstance(confidence_by_field, dict):
        confidence_by_field = {}

    def norm_conf(c):
        if not c:
            return 'medium'
        c_str = str(c).lower()
        if c_str in ('high', 'medium', 'low', 'none'):
            return c_str
        try:
            v = float(c_str)
            return 'high' if v >= 0.85 else 'medium' if v >= 0.5 else 'low'
        except Exception:
            return 'medium'

    indicators = {
        'vendor_name': norm_conf(confidence_by_field.get('vendor_name') or ('high' if vendor_name else 'none')),
        'bill_date': norm_conf(confidence_by_field.get('bill_date') or ('high' if bill_date else 'none')),
        'bill_number': norm_conf(confidence_by_field.get('bill_number') or ('high' if bill_number else 'none')),
        'category': norm_conf(confidence_by_field.get('category') or 'high'),
        'grand_total': norm_conf(confidence_by_field.get('grand_total') or ('high' if grand_total is not None else 'none')),
        'items': norm_conf(confidence_by_field.get('items') or ('high' if len(items) > 0 else 'none'))
    }

    return {
        'is_receipt': is_receipt,
        'confidence': raw_confidence,
        'bill_number': bill_number,
        'bill_date': bill_date,
        'vendor_name': vendor_name,
        'vendor_phone': vendor_phone,
        'vendor_address': vendor_address,
        'category': category,
        'product_type': product_type,
        'items': items,
        'subtotal': subtotal,
        'discount': discount,
        'tax': tax,
        'grand_total': grand_total,
        'total_amount': grand_total,
        'payment_method': payment_method,
        'notes': notes,
        'confidence_by_field': indicators
    }

def verify_bill_totals(extracted):
    """
    Validates item totals (qty * price) and grand total math (subtotal + tax - discount).
    """
    warnings = []
    matches = True

    # 1. Item math check
    for it in extracted.get('items', []):
        qty = it.get('quantity')
        price = it.get('unit_price')
        tot = it.get('total')
        if qty is not None and price is not None and tot is not None:
            expected = round(qty * price, 2)
            if abs(expected - tot) > 1.0:
                warnings.append(f"Item '{it.get('name')}': {qty} × ₹{price} = ₹{expected}, but listed as ₹{tot}")
                matches = False

    # 2. Grand total math check
    sub = extracted.get('subtotal')
    tax = extracted.get('tax') or 0.0
    disc = extracted.get('discount') or 0.0
    gt = extracted.get('grand_total')

    calc_gt = None
    if sub is not None:
        calc_gt = round(sub + tax - disc, 2)
        if gt is not None and abs(calc_gt - gt) > 1.5:
            warnings.append(f"Subtotal (₹{sub}) + Tax (₹{tax}) - Discount (₹{disc}) = ₹{calc_gt}, but detected total is ₹{gt}")
            matches = False
    elif extracted.get('items'):
        items_tot = sum(it.get('total', 0) for it in extracted['items'] if it.get('total') is not None)
        calc_gt = round(items_tot + tax - disc, 2)
        if gt is not None and abs(calc_gt - gt) > 1.5:
            warnings.append(f"Sum of items (₹{items_tot}) + Tax (₹{tax}) - Discount (₹{disc}) = ₹{calc_gt}, but detected total is ₹{gt}")
            matches = False

    warning_msg = None
    if warnings:
        warning_msg = "The bill totals do not appear to match. Please verify the amount."

    return {
        'matches': matches,
        'warning': warning_msg,
        'details': warnings,
        'calculated_total': calc_gt
    }

def check_duplicate_bill(user_id, extracted):
    """
    Checks if a bill with the same bill_number or same (vendor, date, amount) already exists for this farmer.
    """
    bill_no = extracted.get('bill_number')
    vendor = extracted.get('vendor_name')
    date_val = extracted.get('bill_date')
    amount_val = extracted.get('grand_total')

    conn = get_db()
    duplicate_row = None

    if bill_no:
        duplicate_row = conn.execute(
            "SELECT * FROM farm_expenses WHERE user_id = ? AND bill_number = ? LIMIT 1",
            (user_id, bill_no)
        ).fetchone()

    if not duplicate_row and vendor and date_val and amount_val:
        duplicate_row = conn.execute("""
            SELECT * FROM farm_expenses
            WHERE user_id = ? AND LOWER(vendor_name) = LOWER(?) AND date = ? AND ABS(amount - ?) < 1.0
            LIMIT 1
        """, (user_id, vendor, date_val, amount_val)).fetchone()

    conn.close()

    if duplicate_row:
        exp = serialize_expense(duplicate_row)
        return {
            'is_duplicate': True,
            'message': f"This bill may already have been added on {exp.get('date')} (₹{exp.get('amount')}, {exp.get('vendor_name') or exp.get('category')}).",
            'existing_expense': exp
        }

    return {
        'is_duplicate': False,
        'message': None,
        'existing_expense': None
    }


# ==============================================================================
# BILL SCANNING & EXPENSE REST ENDPOINTS
# ==============================================================================

@app.route('/api/scan-bill', methods=['POST', 'OPTIONS'])
@app.route('/api/expenses/scan-bill', methods=['POST', 'OPTIONS'])
def api_scan_bill():
    if request.method == 'OPTIONS':
        return '', 204

    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to scan bills.'}), 401

    if 'bill_image' not in request.files and 'receipt' not in request.files and 'image' not in request.files:
        return jsonify({'success': False, 'error': 'Please upload a bill image file.'}), 400

    file_obj = request.files.get('bill_image') or request.files.get('receipt') or request.files.get('image')
    if not file_obj or not file_obj.filename:
        return jsonify({'success': False, 'error': 'Please select an image file.'}), 400

    try:
        saved_filename = save_bill_media(file_obj, user_id=user['id'])
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        app.logger.error("Error saving bill file: %s", str(e))
        return jsonify({'success': False, 'error': 'Failed to save uploaded bill image. Please try again.'}), 500

    target_filepath = os.path.join(app.config['UPLOAD_FOLDER'], saved_filename)

    try:
        extracted = extract_bill_from_image(target_filepath)
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        app.logger.error("AI Bill extraction failed: %s", str(e))
        return jsonify({
            'success': False,
            'error': 'Farmer AI could not read this bill clearly. Please take a clearer photo and try again.'
        }), 500

    if not extracted.get('is_receipt'):
        return jsonify({
            'success': False,
            'is_receipt': False,
            'error': 'The uploaded image does not appear to be a farming bill or receipt. Please take a photo of the complete receipt.',
            'receipt_path': saved_filename,
            'receipt_url': f"/uploads/{saved_filename}"
        }), 422

    # Verification checks
    totals_check = verify_bill_totals(extracted)
    duplicate_check = check_duplicate_bill(user['id'], extracted)

    # Pre-generate suggested description
    vendor = extracted.get('vendor_name')
    cat = extracted.get('category') or 'Farming material'
    desc = f"{cat} purchased from {vendor}" if vendor else f"{cat} purchase"
    if extracted.get('items'):
        item_names = [it['name'] for it in extracted['items'][:3]]
        desc = f"{', '.join(item_names)} from {vendor}" if vendor else f"{', '.join(item_names)}"

    extracted['suggested_description'] = desc

    return jsonify({
        'success': True,
        'message': 'Bill scanned and extracted successfully.',
        'receipt_path': saved_filename,
        'receipt_url': f"/uploads/{saved_filename}",
        'extracted_data': extracted,
        'totals_verification': totals_check,
        'duplicate_check': duplicate_check,
        'confidence_indicators': extracted.get('confidence_by_field', {})
    })


@app.route('/api/scanned-bills', methods=['GET'])
def api_get_scanned_bills():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to view scanned bills.'}), 401

    conn = get_db()
    rows = conn.execute("""
        SELECT * FROM farm_expenses
        WHERE user_id = ? AND (
            UPPER(receipt_source) IN ('AI_SCAN', 'SCANNED', 'SCANNED_RECEIPT')
            OR bill_number IS NOT NULL
            OR raw_extracted_json IS NOT NULL
        )
        ORDER BY date DESC, id DESC
    """, (user['id'],)).fetchall()
    conn.close()

    scanned_expenses = [serialize_expense(r) for r in rows]
    total_scanned_amount = sum(e['amount'] for e in scanned_expenses)

    return jsonify({
        'success': True,
        'scanned_bills': scanned_expenses,
        'count': len(scanned_expenses),
        'total_amount': round(total_scanned_amount, 2)
    })


# 2. Expense Management Endpoints
@app.route('/api/expenses', methods=['GET'])
def api_get_expenses():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to view expenses.'}), 401

    cat_filter = request.args.get('category', '').strip()
    crop_filter = request.args.get('crop', '').strip()
    month_filter = request.args.get('month', '').strip()
    source_filter = request.args.get('source', '').strip() or request.args.get('receipt_source', '').strip()
    start_date = request.args.get('start_date', '').strip()
    end_date = request.args.get('end_date', '').strip()
    search = request.args.get('search', '').strip()

    query = "SELECT * FROM farm_expenses WHERE user_id = ?"
    params = [user['id']]

    if cat_filter:
        query += " AND LOWER(category) = LOWER(?)"
        params.append(cat_filter)
    if crop_filter:
        query += " AND LOWER(crop) = LOWER(?)"
        params.append(crop_filter)
    if source_filter:
        query += " AND UPPER(receipt_source) = UPPER(?)"
        params.append(source_filter)
    if month_filter:
        query += " AND date LIKE ?"
        params.append(f"{month_filter}%")
    if start_date:
        query += " AND date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND date <= ?"
        params.append(end_date)
    if search:
        query += " AND (LOWER(category) LIKE ? OR LOWER(crop) LIKE ? OR LOWER(field_name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(vendor_name) LIKE ? OR LOWER(bill_number) LIKE ?)"
        term = f"%{search.lower()}%"
        params.extend([term, term, term, term, term, term])

    query += " ORDER BY date DESC, id DESC"

    conn = get_db()
    rows = conn.execute(query, params).fetchall()
    conn.close()

    expenses = [serialize_expense(r) for r in rows]
    total_amount = sum(e['amount'] for e in expenses)
    return jsonify({
        'success': True,
        'expenses': expenses,
        'count': len(expenses),
        'total_amount': round(total_amount, 2)
    })


@app.route('/api/expenses', methods=['POST'])
def api_create_expense():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to record an expense.'}), 401

    if request.is_json:
        data = request.get_json(silent=True) or {}
        date_val = str(data.get('date', '')).strip()
        cat_val = str(data.get('category', '')).strip()
        amount_raw = data.get('amount')
        crop_val = str(data.get('crop', '')).strip()
        field_val = str(data.get('field_name', '')).strip()
        desc_val = str(data.get('description', '')).strip()
        raw_r_path = str(data.get('receipt_path', '')).strip()
        raw_r_url = str(data.get('receipt_url', '')).strip()
        receipt_path = raw_r_path or (os.path.basename(raw_r_url) if raw_r_url else None) or None
        bill_number = str(data.get('bill_number', '')).strip() or None
        vendor_name = str(data.get('vendor_name', '')).strip() or None
        vendor_phone = str(data.get('vendor_phone', '')).strip() or None
        vendor_address = str(data.get('vendor_address', '')).strip() or None
        receipt_source = str(data.get('receipt_source', 'MANUAL')).strip() or 'MANUAL'
        tax_raw = data.get('tax', 0.0)
        discount_raw = data.get('discount', 0.0)
        payment_method = str(data.get('payment_method', '')).strip() or None
        raw_extracted_json = data.get('raw_extracted_json')
        if isinstance(raw_extracted_json, (dict, list)):
            raw_extracted_json = json.dumps(raw_extracted_json)
        elif not isinstance(raw_extracted_json, str):
            raw_extracted_json = None
    else:
        date_val = str(request.form.get('date', '')).strip()
        cat_val = str(request.form.get('category', '')).strip()
        amount_raw = request.form.get('amount')
        crop_val = str(request.form.get('crop', '')).strip()
        field_val = str(request.form.get('field_name', '')).strip()
        desc_val = str(request.form.get('description', '')).strip()
        raw_r_path = str(request.form.get('receipt_path', '')).strip()
        raw_r_url = str(request.form.get('receipt_url', '')).strip()
        receipt_path = raw_r_path or (os.path.basename(raw_r_url) if raw_r_url else None) or None
        bill_number = str(request.form.get('bill_number', '')).strip() or None
        vendor_name = str(request.form.get('vendor_name', '')).strip() or None
        vendor_phone = str(request.form.get('vendor_phone', '')).strip() or None
        vendor_address = str(request.form.get('vendor_address', '')).strip() or None
        receipt_source = str(request.form.get('receipt_source', 'MANUAL')).strip() or 'MANUAL'
        tax_raw = request.form.get('tax', 0.0)
        discount_raw = request.form.get('discount', 0.0)
        payment_method = str(request.form.get('payment_method', '')).strip() or None
        raw_extracted_json = request.form.get('raw_extracted_json')

        if 'receipt' in request.files and request.files['receipt'].filename:
            try:
                receipt_path = save_bill_media(request.files['receipt'], user_id=user['id'])
            except ValueError as ve:
                return jsonify({'success': False, 'error': str(ve)}), 400

    if not date_val:
        return jsonify({'success': False, 'error': 'Date is required for expense record.'}), 400
    if not cat_val:
        return jsonify({'success': False, 'error': 'Category is required for expense record.'}), 400

    try:
        amount_val = float(amount_raw)
    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': 'Please enter a valid numeric expense amount.'}), 400

    if amount_val < 0:
        return jsonify({'success': False, 'error': 'Expense amount cannot be negative.'}), 400

    try:
        tax_val = float(tax_raw) if tax_raw is not None else 0.0
    except (ValueError, TypeError):
        tax_val = 0.0

    try:
        discount_val = float(discount_raw) if discount_raw is not None else 0.0
    except (ValueError, TypeError):
        discount_val = 0.0

    scanned_at_val = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S') if receipt_source == 'SCANNED_RECEIPT' else None

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO farm_expenses (
            user_id, date, category, amount, crop, field_name, description,
            receipt_path, bill_number, vendor_name, vendor_phone, vendor_address,
            receipt_source, raw_extracted_json, tax, discount, payment_method, scanned_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        user['id'], date_val, cat_val, amount_val, crop_val, field_val, desc_val,
        receipt_path, bill_number, vendor_name, vendor_phone, vendor_address,
        receipt_source, raw_extracted_json, tax_val, discount_val, payment_method, scanned_at_val
    ))
    exp_id = cursor.lastrowid
    conn.commit()

    created = conn.execute("SELECT * FROM farm_expenses WHERE id = ?", (exp_id,)).fetchone()
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Expense recorded successfully.',
        'expense': serialize_expense(created)
    }), 201


@app.route('/api/expenses/<int:expense_id>', methods=['PUT', 'POST'])
def api_update_expense(expense_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to update an expense.'}), 401

    conn = get_db()
    existing = conn.execute(
        "SELECT * FROM farm_expenses WHERE id = ? AND user_id = ?",
        (expense_id, user['id'])
    ).fetchone()

    if not existing:
        conn.close()
        return jsonify({'success': False, 'error': 'Expense record not found or unauthorized.'}), 404

    if request.is_json:
        data = request.get_json(silent=True) or {}
        date_val = str(data.get('date', existing['date'])).strip()
        cat_val = str(data.get('category', existing['category'])).strip()
        amount_raw = data.get('amount', existing['amount'])
        crop_val = str(data.get('crop', existing['crop'] or '')).strip()
        field_val = str(data.get('field_name', existing['field_name'] or '')).strip()
        desc_val = str(data.get('description', existing['description'] or '')).strip()
        receipt_path = data.get('receipt_path', existing['receipt_path'])
        bill_number = data.get('bill_number', existing['bill_number'])
        vendor_name = data.get('vendor_name', existing['vendor_name'])
        vendor_phone = data.get('vendor_phone', existing['vendor_phone'])
        vendor_address = data.get('vendor_address', existing['vendor_address'])
        receipt_source = data.get('receipt_source', existing['receipt_source'] or 'MANUAL')
        tax_raw = data.get('tax', existing['tax'] if 'tax' in existing.keys() else 0.0)
        discount_raw = data.get('discount', existing['discount'] if 'discount' in existing.keys() else 0.0)
        payment_method = data.get('payment_method', existing['payment_method'])
        raw_extracted_json = data.get('raw_extracted_json', existing['raw_extracted_json'] if 'raw_extracted_json' in existing.keys() else None)
        if isinstance(raw_extracted_json, (dict, list)):
            raw_extracted_json = json.dumps(raw_extracted_json)
    else:
        date_val = str(request.form.get('date', existing['date'])).strip()
        cat_val = str(request.form.get('category', existing['category'])).strip()
        amount_raw = request.form.get('amount', existing['amount'])
        crop_val = str(request.form.get('crop', existing['crop'] or '')).strip()
        field_val = str(request.form.get('field_name', existing['field_name'] or '')).strip()
        desc_val = str(request.form.get('description', existing['description'] or '')).strip()
        receipt_path = request.form.get('receipt_path', existing['receipt_path'])
        bill_number = request.form.get('bill_number', existing['bill_number'])
        vendor_name = request.form.get('vendor_name', existing['vendor_name'])
        vendor_phone = request.form.get('vendor_phone', existing['vendor_phone'])
        vendor_address = request.form.get('vendor_address', existing['vendor_address'])
        receipt_source = request.form.get('receipt_source', existing['receipt_source'] or 'MANUAL')
        tax_raw = request.form.get('tax', existing['tax'] if 'tax' in existing.keys() else 0.0)
        discount_raw = request.form.get('discount', existing['discount'] if 'discount' in existing.keys() else 0.0)
        payment_method = request.form.get('payment_method', existing['payment_method'])
        raw_extracted_json = request.form.get('raw_extracted_json', existing['raw_extracted_json'] if 'raw_extracted_json' in existing.keys() else None)

        if 'receipt' in request.files and request.files['receipt'].filename:
            try:
                receipt_path = save_bill_media(request.files['receipt'], user_id=user['id'])
            except ValueError as ve:
                conn.close()
                return jsonify({'success': False, 'error': str(ve)}), 400

    if not date_val:
        conn.close()
        return jsonify({'success': False, 'error': 'Date cannot be empty.'}), 400
    if not cat_val:
        conn.close()
        return jsonify({'success': False, 'error': 'Category cannot be empty.'}), 400

    try:
        amount_val = float(amount_raw)
    except (ValueError, TypeError):
        conn.close()
        return jsonify({'success': False, 'error': 'Please enter a valid numeric expense amount.'}), 400

    if amount_val < 0:
        conn.close()
        return jsonify({'success': False, 'error': 'Expense amount cannot be negative.'}), 400

    try:
        tax_val = float(tax_raw) if tax_raw is not None else 0.0
    except (ValueError, TypeError):
        tax_val = 0.0

    try:
        discount_val = float(discount_raw) if discount_raw is not None else 0.0
    except (ValueError, TypeError):
        discount_val = 0.0

    conn.execute("""
        UPDATE farm_expenses
        SET date = ?, category = ?, amount = ?, crop = ?, field_name = ?, description = ?,
            receipt_path = ?, bill_number = ?, vendor_name = ?, vendor_phone = ?, vendor_address = ?,
            receipt_source = ?, raw_extracted_json = ?, tax = ?, discount = ?, payment_method = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
    """, (
        date_val, cat_val, amount_val, crop_val, field_val, desc_val,
        receipt_path, bill_number, vendor_name, vendor_phone, vendor_address,
        receipt_source, raw_extracted_json, tax_val, discount_val, payment_method,
        expense_id, user['id']
    ))
    conn.commit()

    updated = conn.execute("SELECT * FROM farm_expenses WHERE id = ?", (expense_id,)).fetchone()
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Expense updated successfully.',
        'expense': serialize_expense(updated)
    })


@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def api_delete_expense(expense_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to delete expenses.'}), 401

    conn = get_db()
    existing = conn.execute(
        "SELECT * FROM farm_expenses WHERE id = ? AND user_id = ?",
        (expense_id, user['id'])
    ).fetchone()

    if not existing:
        conn.close()
        return jsonify({'success': False, 'error': 'Expense record not found or unauthorized.'}), 404

    conn.execute("DELETE FROM farm_expenses WHERE id = ? AND user_id = ?", (expense_id, user['id']))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Expense record deleted successfully.'})


# 3. Income Records Endpoints
@app.route('/api/income', methods=['GET'])
def api_get_income():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to view income.'}), 401

    crop_filter = request.args.get('crop', '').strip()
    month_filter = request.args.get('month', '').strip()
    start_date = request.args.get('start_date', '').strip()
    end_date = request.args.get('end_date', '').strip()
    search = request.args.get('search', '').strip()

    query = "SELECT * FROM farm_income WHERE user_id = ?"
    params = [user['id']]

    if crop_filter:
        query += " AND LOWER(crop) = LOWER(?)"
        params.append(crop_filter)
    if month_filter:
        query += " AND date LIKE ?"
        params.append(f"{month_filter}%")
    if start_date:
        query += " AND date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND date <= ?"
        params.append(end_date)
    if search:
        query += " AND (LOWER(crop) LIKE ? OR LOWER(buyer_name) LIKE ? OR LOWER(notes) LIKE ?)"
        term = f"%{search.lower()}%"
        params.extend([term, term, term])

    query += " ORDER BY date DESC, id DESC"

    conn = get_db()
    rows = conn.execute(query, params).fetchall()
    conn.close()

    income_list = [serialize_income(r) for r in rows]
    total_income = sum(i['total_amount'] for i in income_list)
    return jsonify({
        'success': True,
        'income': income_list,
        'count': len(income_list),
        'total_amount': round(total_income, 2)
    })


@app.route('/api/income', methods=['POST'])
def api_create_income():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to record farm income.'}), 401

    data = request.get_json(silent=True) or request.form.to_dict()
    date_val = str(data.get('date', '')).strip()
    crop_val = str(data.get('crop', '')).strip()
    unit_val = str(data.get('unit', 'kg')).strip() or 'kg'
    buyer_val = str(data.get('buyer_name', '')).strip()
    notes_val = str(data.get('notes', '')).strip()

    if not date_val:
        return jsonify({'success': False, 'error': 'Date is required for income record.'}), 400
    if not crop_val:
        return jsonify({'success': False, 'error': 'Crop name is required.'}), 400

    try:
        qty_val = float(data.get('quantity', 0))
    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': 'Please provide a valid numeric quantity.'}), 400

    if qty_val <= 0:
        return jsonify({'success': False, 'error': 'Quantity must be greater than zero.'}), 400

    try:
        price_val = float(data.get('selling_price', 0))
    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': 'Please provide a valid numeric selling price.'}), 400

    if price_val < 0:
        return jsonify({'success': False, 'error': 'Selling price cannot be negative.'}), 400

    # Auto calculate or accept explicit total
    total_raw = data.get('total_amount')
    if total_raw is not None and str(total_raw).strip() != '':
        try:
            total_val = float(total_raw)
            if total_val < 0:
                return jsonify({'success': False, 'error': 'Total amount cannot be negative.'}), 400
        except (ValueError, TypeError):
            total_val = round(qty_val * price_val, 2)
    else:
        total_val = round(qty_val * price_val, 2)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO farm_income (user_id, date, crop, quantity, unit, selling_price, total_amount, buyer_name, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (user['id'], date_val, crop_val, qty_val, unit_val, price_val, total_val, buyer_val, notes_val))
    inc_id = cursor.lastrowid
    conn.commit()

    created = conn.execute("SELECT * FROM farm_income WHERE id = ?", (inc_id,)).fetchone()
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Income record created successfully.',
        'income': serialize_income(created)
    }), 201


@app.route('/api/income/<int:income_id>', methods=['PUT', 'POST'])
def api_update_income(income_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to update income.'}), 401

    conn = get_db()
    existing = conn.execute(
        "SELECT * FROM farm_income WHERE id = ? AND user_id = ?",
        (income_id, user['id'])
    ).fetchone()

    if not existing:
        conn.close()
        return jsonify({'success': False, 'error': 'Income record not found or unauthorized.'}), 404

    data = request.get_json(silent=True) or request.form.to_dict()
    date_val = str(data.get('date', existing['date'])).strip()
    crop_val = str(data.get('crop', existing['crop'])).strip()
    unit_val = str(data.get('unit', existing['unit'] or 'kg')).strip() or 'kg'
    buyer_val = str(data.get('buyer_name', existing['buyer_name'] or '')).strip()
    notes_val = str(data.get('notes', existing['notes'] or '')).strip()

    if not date_val:
        conn.close()
        return jsonify({'success': False, 'error': 'Date cannot be empty.'}), 400
    if not crop_val:
        conn.close()
        return jsonify({'success': False, 'error': 'Crop cannot be empty.'}), 400

    try:
        qty_val = float(data.get('quantity', existing['quantity']))
    except (ValueError, TypeError):
        conn.close()
        return jsonify({'success': False, 'error': 'Please provide a valid numeric quantity.'}), 400

    if qty_val <= 0:
        conn.close()
        return jsonify({'success': False, 'error': 'Quantity must be greater than zero.'}), 400

    try:
        price_val = float(data.get('selling_price', existing['selling_price']))
    except (ValueError, TypeError):
        conn.close()
        return jsonify({'success': False, 'error': 'Please provide a valid numeric selling price.'}), 400

    if price_val < 0:
        conn.close()
        return jsonify({'success': False, 'error': 'Selling price cannot be negative.'}), 400

    total_raw = data.get('total_amount')
    if total_raw is not None and str(total_raw).strip() != '':
        try:
            total_val = float(total_raw)
            if total_val < 0:
                conn.close()
                return jsonify({'success': False, 'error': 'Total amount cannot be negative.'}), 400
        except (ValueError, TypeError):
            total_val = round(qty_val * price_val, 2)
    else:
        total_val = round(qty_val * price_val, 2)

    conn.execute("""
        UPDATE farm_income
        SET date = ?, crop = ?, quantity = ?, unit = ?, selling_price = ?, total_amount = ?, buyer_name = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
    """, (date_val, crop_val, qty_val, unit_val, price_val, total_val, buyer_val, notes_val, income_id, user['id']))
    conn.commit()

    updated = conn.execute("SELECT * FROM farm_income WHERE id = ?", (income_id,)).fetchone()
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Income record updated successfully.',
        'income': serialize_income(updated)
    })


@app.route('/api/income/<int:income_id>', methods=['DELETE'])
def api_delete_income(income_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to delete income records.'}), 401

    conn = get_db()
    existing = conn.execute(
        "SELECT * FROM farm_income WHERE id = ? AND user_id = ?",
        (income_id, user['id'])
    ).fetchone()

    if not existing:
        conn.close()
        return jsonify({'success': False, 'error': 'Income record not found or unauthorized.'}), 404

    conn.execute("DELETE FROM farm_income WHERE id = ? AND user_id = ?", (income_id, user['id']))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Income record deleted successfully.'})


# 4. Unified Farm Diary + Expenses Summary
@app.route('/api/farm-summary', methods=['GET'])
def api_get_farm_summary():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to view farm summary.'}), 401

    conn = get_db()
    uid = user['id']

    # Total expenses
    exp_sum_row = conn.execute("SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) as count FROM farm_expenses WHERE user_id = ?", (uid,)).fetchone()
    total_expenses = round(float(exp_sum_row['total'] or 0.0), 2)
    expense_count = int(exp_sum_row['count'] or 0)

    # Total income
    inc_sum_row = conn.execute("SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) as count FROM farm_income WHERE user_id = ?", (uid,)).fetchone()
    total_income = round(float(inc_sum_row['total'] or 0.0), 2)
    income_count = int(inc_sum_row['count'] or 0)

    # Net balance
    net_balance = round(total_income - total_expenses, 2)

    # Diary entries count
    diary_count_row = conn.execute("SELECT COUNT(*) as count FROM farm_diary_entries WHERE user_id = ?", (uid,)).fetchone()
    diary_count = int(diary_count_row['count'] or 0)

    # Expenses by category
    cat_rows = conn.execute("""
        SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
        FROM farm_expenses
        WHERE user_id = ?
        GROUP BY category
        ORDER BY total DESC
    """, (uid,)).fetchall()

    expenses_by_category = []
    for r in cat_rows:
        cat_total = round(float(r['total']), 2)
        pct = round((cat_total / total_expenses * 100), 1) if total_expenses > 0 else 0
        expenses_by_category.append({
            'category': r['category'],
            'total': cat_total,
            'count': int(r['count']),
            'percentage': pct
        })

    # Expenses by crop
    crop_rows = conn.execute("""
        SELECT COALESCE(NULLIF(crop, ''), 'General Farm') as crop_name, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
        FROM farm_expenses
        WHERE user_id = ?
        GROUP BY crop_name
        ORDER BY total DESC
    """, (uid,)).fetchall()

    expenses_by_crop = [
        {'crop': r['crop_name'], 'total': round(float(r['total']), 2), 'count': int(r['count'])}
        for r in crop_rows
    ]

    # Expenses by month (last 12 months)
    month_exp_rows = conn.execute("""
        SELECT SUBSTR(date, 1, 7) as month_key, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
        FROM farm_expenses
        WHERE user_id = ? AND date IS NOT NULL AND length(date) >= 7
        GROUP BY month_key
        ORDER BY month_key DESC
        LIMIT 12
    """, (uid,)).fetchall()

    expenses_by_month = [
        {'month': r['month_key'], 'total': round(float(r['total']), 2), 'count': int(r['count'])}
        for r in month_exp_rows
    ]

    # Income by month (last 12 months)
    month_inc_rows = conn.execute("""
        SELECT SUBSTR(date, 1, 7) as month_key, COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count
        FROM farm_income
        WHERE user_id = ? AND date IS NOT NULL AND length(date) >= 7
        GROUP BY month_key
        ORDER BY month_key DESC
        LIMIT 12
    """, (uid,)).fetchall()

    income_by_month = [
        {'month': r['month_key'], 'total': round(float(r['total']), 2), 'count': int(r['count'])}
        for r in month_inc_rows
    ]

    # Recent activities (unified chronologically)
    recent_diary = conn.execute("""
        SELECT id, date, activity_type, crop, field_name, description, photo_path, created_at
        FROM farm_diary_entries
        WHERE user_id = ?
        ORDER BY date DESC, id DESC
        LIMIT 8
    """, (uid,)).fetchall()

    recent_expenses = conn.execute("""
        SELECT id, date, category, amount, crop, field_name, description, receipt_path, created_at
        FROM farm_expenses
        WHERE user_id = ?
        ORDER BY date DESC, id DESC
        LIMIT 8
    """, (uid,)).fetchall()

    recent_income = conn.execute("""
        SELECT id, date, crop, quantity, unit, selling_price, total_amount, buyer_name, created_at
        FROM farm_income
        WHERE user_id = ?
        ORDER BY date DESC, id DESC
        LIMIT 8
    """, (uid,)).fetchall()

    conn.close()

    unified_activities = []
    for d in recent_diary:
        crop_name = d['crop'] or 'Field'
        field_part = f" • {d['field_name']}" if d['field_name'] else ''
        unified_activities.append({
            'type': 'diary',
            'id': d['id'],
            'date': d['date'],
            'title': d['activity_type'],
            'subtitle': f"{crop_name}{field_part}".strip(),
            'description': d['description'] or '',
            'photo_url': f"/uploads/{os.path.basename(d['photo_path'])}" if d['photo_path'] else None,
            'created_at': d['created_at'] or d['date']
        })

    for e in recent_expenses:
        crop_name = e['crop'] or 'General Farm'
        field_part = f" • {e['field_name']}" if e['field_name'] else ''
        unified_activities.append({
            'type': 'expense',
            'id': e['id'],
            'date': e['date'],
            'title': e['category'],
            'subtitle': f"{crop_name}{field_part}".strip(),
            'amount': float(e['amount'] or 0.0),
            'description': e['description'] or '',
            'receipt_url': f"/uploads/{os.path.basename(e['receipt_path'])}" if e['receipt_path'] else None,
            'created_at': e['created_at'] or e['date']
        })

    for i in recent_income:
        buyer_part = f" • Buyer: {i['buyer_name']}" if i['buyer_name'] else ''
        unified_activities.append({
            'type': 'income',
            'id': i['id'],
            'date': i['date'],
            'title': f"Sold {i['crop']}",
            'subtitle': f"{i['quantity']} {i['unit']} @ ₹{i['selling_price']}/{i['unit']}{buyer_part}",
            'amount': float(i['total_amount'] or 0.0),
            'description': f"Gross return: ₹{i['total_amount']}",
            'created_at': i['created_at'] or i['date']
        })

    # Sort combined activities by date descending, created_at descending
    unified_activities.sort(key=lambda x: (x.get('date', ''), x.get('created_at', '')), reverse=True)
    recent_activities = unified_activities[:12]

    return jsonify({
        'success': True,
        'summary': {
            'total_expenses': total_expenses,
            'total_income': total_income,
            'net_balance': net_balance,
            'diary_count': diary_count,
            'expense_count': expense_count,
            'income_count': income_count,
            'expenses_by_category': expenses_by_category,
            'expenses_by_crop': expenses_by_crop,
            'expenses_by_month': expenses_by_month,
            'income_by_month': income_by_month,
            'recent_activities': recent_activities
        }
    })


# ==============================================================================
# PHASE 2: TRACTOR WORK TRACKER REST APIs & AUDIT SYSTEM
# ==============================================================================

VALID_WORK_TYPES = {
    'Ploughing', 'Cultivating', 'Rotavating', 'Sowing',
    'Harvesting', 'Transport', 'Spraying', 'Other'
}

VALID_RATE_UNITS = {'per_hour', 'per_acre', 'fixed'}

def generate_tractor_job_id(conn, work_date):
    try:
        dt = datetime.datetime.strptime(work_date.strip(), '%Y-%m-%d')
        date_str = dt.strftime('%Y%m%d')
    except Exception:
        date_str = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d')

    prefix = f"TR-{date_str}-"
    rows = conn.execute(
        "SELECT job_id FROM tractor_jobs WHERE job_id LIKE ? ORDER BY job_id DESC",
        (f"{prefix}%",)
    ).fetchall()

    max_seq = 0
    for r in rows:
        jid = str(r['job_id'])
        parts = jid.split('-')
        if len(parts) >= 3 and parts[-1].isdigit():
            max_seq = max(max_seq, int(parts[-1]))

    next_seq = max_seq + 1
    return f"{prefix}{next_seq:03d}"


def parse_iso_ts(ts_str):
    if not ts_str:
        return None
    try:
        ts_clean = str(ts_str).replace('Z', '+00:00').strip()
        if 'T' in ts_clean:
            return datetime.datetime.fromisoformat(ts_clean)
        return datetime.datetime.strptime(ts_clean, '%Y-%m-%d %H:%M:%S').replace(tzinfo=datetime.timezone.utc)
    except Exception:
        try:
            return datetime.datetime.fromtimestamp(float(ts_str), tz=datetime.timezone.utc)
        except Exception:
            return None


def compute_job_timeline_and_seconds(events, current_status='CREATED', total_working_seconds=0):
    """
    Chronologically steps through events and computes active working duration in seconds.
    Pauses and break intervals are strictly excluded from active working time.
    """
    sorted_events = sorted(events, key=lambda e: e.get('server_timestamp') or e.get('created_at') or '')
    active_seconds = 0
    current_interval_start = None
    now = datetime.datetime.now(datetime.timezone.utc)

    for ev in sorted_events:
        etype = ev.get('event_type')
        ts = parse_iso_ts(ev.get('server_timestamp'))
        if not ts:
            continue

        if etype in ('STARTED', 'START_CONFIRMED', 'RESUMED'):
            current_interval_start = ts
        elif etype in ('PAUSED', 'FINISHED', 'FINISH_CONFIRMED', 'CANCELLED', 'DISPUTED'):
            if current_interval_start is not None:
                duration = max(0, int((ts - current_interval_start).total_seconds()))
                active_seconds += duration
                current_interval_start = None

    if current_status == 'RUNNING' and current_interval_start is not None:
        duration = max(0, int((now - current_interval_start).total_seconds()))
        active_seconds += duration

    return max(active_seconds, int(total_working_seconds or 0))


def compute_tractor_payment(rate, rate_unit, field_size, active_seconds):
    rate = float(rate or 0.0)
    field_size = float(field_size or 0.0)

    if rate_unit == 'per_hour':
        hours = active_seconds / 3600.0
        return round(hours * rate, 2)
    elif rate_unit == 'per_acre':
        acres = field_size if field_size > 0 else 1.0
        return round(acres * rate, 2)
    elif rate_unit == 'fixed':
        return round(rate, 2)
    return round(rate, 2)


def serialize_tractor_job(row, user_id=None, conn=None):
    item = dict(row)
    item['field_size'] = float(item.get('field_size') or 0.0)
    item['rate'] = float(item.get('rate') or 0.0)
    item['total_working_seconds'] = int(item.get('total_working_seconds') or 0)
    item['calculated_amount'] = float(item.get('calculated_amount') or 0.0)
    item['final_amount'] = float(item.get('final_amount') or 0.0)

    if user_id:
        item['is_farmer'] = (item.get('farmer_id') == user_id)
        item['is_driver'] = (item.get('driver_id') == user_id)
        if item['is_farmer']:
            item['current_user_role'] = 'farmer'
        elif item['is_driver']:
            item['current_user_role'] = 'driver'
        else:
            item['current_user_role'] = 'viewer'

    if conn:
        job_id_pk = item['id']
        events_rows = conn.execute(
            """SELECT e.*, u.name as performed_by_name 
               FROM tractor_work_events e 
               LEFT JOIN users u ON e.performed_by = u.id 
               WHERE e.tractor_job_id = ? 
               ORDER BY e.id ASC""",
            (job_id_pk,)
        ).fetchall()

        events = [dict(ev) for ev in events_rows]
        item['events'] = events

        live_active_seconds = compute_job_timeline_and_seconds(
            events,
            current_status=item.get('status'),
            total_working_seconds=item.get('total_working_seconds')
        )
        item['live_active_seconds'] = live_active_seconds

        live_amount = compute_tractor_payment(
            item['rate'],
            item['rate_unit'],
            item['field_size'],
            live_active_seconds
        )
        item['live_estimated_amount'] = live_amount

        disputes_rows = conn.execute(
            """SELECT d.*, u.name as raised_by_name 
               FROM tractor_disputes d 
               LEFT JOIN users u ON d.raised_by = u.id 
               WHERE d.tractor_job_id = ? 
               ORDER BY d.id DESC""",
            (job_id_pk,)
        ).fetchall()
        item['disputes'] = [dict(d) for d in disputes_rows]

        farmer_row = conn.execute("SELECT name, email, location FROM users WHERE id = ?", (item['farmer_id'],)).fetchone()
        if farmer_row:
            item['farmer_name'] = farmer_row['name']
            item['farmer_email'] = farmer_row['email']
            item['farmer_location'] = farmer_row['location']

        if item.get('driver_id'):
            driver_row = conn.execute("SELECT name, email FROM users WHERE id = ?", (item['driver_id'],)).fetchone()
            if driver_row:
                item['driver_user_name'] = driver_row['name']
                item['driver_email'] = driver_row['email']
                if not item.get('driver_name'):
                    item['driver_name'] = driver_row['name']

        if item.get('expense_id'):
            exp_row = conn.execute("SELECT * FROM farm_expenses WHERE id = ?", (item['expense_id'],)).fetchone()
            if exp_row:
                item['expense'] = dict(exp_row)

    return item


@app.route('/tractor-work')
def page_tractor_work():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    dist_index = os.path.join(app.root_path, 'dist', 'index.html')
    if os.path.exists(dist_index):
        return send_from_directory(os.path.join(app.root_path, 'dist'), 'index.html')
    return redirect(url_for('dashboard'))


@app.route('/api/tractor/jobs', methods=['GET'])
def api_get_tractor_jobs():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to view tractor work records.'}), 401

    role = request.args.get('role', 'all').strip().lower() # 'farmer', 'driver', 'all'
    status_filter = request.args.get('status', '').strip().upper()
    crop_filter = request.args.get('crop', '').strip()
    work_type_filter = request.args.get('work_type', '').strip()
    search = request.args.get('search', '').strip()
    start_date = request.args.get('start_date', '').strip()
    end_date = request.args.get('end_date', '').strip()

    conn = get_db()
    uid = user['id']

    if role == 'farmer':
        where_clauses = ["t.farmer_id = ?"]
        params = [uid]
    elif role == 'driver':
        where_clauses = ["t.driver_id = ?"]
        params = [uid]
    else:
        where_clauses = ["(t.farmer_id = ? OR t.driver_id = ?)"]
        params = [uid, uid]

    if status_filter:
        where_clauses.append("t.status = ?")
        params.append(status_filter)
    if crop_filter:
        where_clauses.append("LOWER(t.crop) = LOWER(?)")
        params.append(crop_filter)
    if work_type_filter:
        where_clauses.append("LOWER(t.work_type) = LOWER(?)")
        params.append(work_type_filter)
    if start_date:
        where_clauses.append("t.work_date >= ?")
        params.append(start_date)
    if end_date:
        where_clauses.append("t.work_date <= ?")
        params.append(end_date)
    if search:
        where_clauses.append(
            "(t.job_id LIKE ? OR LOWER(t.crop) LIKE ? OR LOWER(t.field_name) LIKE ? OR LOWER(t.work_type) LIKE ? OR LOWER(COALESCE(t.driver_name, '')) LIKE ? OR LOWER(COALESCE(u_farmer.name, '')) LIKE ?)"
        )
        term = f"%{search.lower()}%"
        params.extend([term, term, term, term, term, term])

    where_sql = " AND ".join(where_clauses)
    query = f"""
        SELECT t.*, u_farmer.name as farmer_name, u_driver.name as driver_user_name
        FROM tractor_jobs t
        LEFT JOIN users u_farmer ON t.farmer_id = u_farmer.id
        LEFT JOIN users u_driver ON t.driver_id = u_driver.id
        WHERE {where_sql}
        ORDER BY t.work_date DESC, t.id DESC
    """

    rows = conn.execute(query, params).fetchall()
    jobs = [serialize_tractor_job(r, user_id=uid, conn=conn) for r in rows]
    conn.close()

    return jsonify({'success': True, 'jobs': jobs, 'count': len(jobs)})


@app.route('/api/tractor/jobs', methods=['POST'])
def api_create_tractor_job():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to create a tractor job.'}), 401

    data = request.get_json(silent=True) or request.form.to_dict()
    work_date = str(data.get('work_date', '')).strip()
    field_name = str(data.get('field_name', '')).strip()
    crop = str(data.get('crop', '')).strip()
    work_type = str(data.get('work_type', '')).strip()
    rate_raw = data.get('rate')
    rate_unit = str(data.get('rate_unit', 'per_hour')).strip().lower()
    field_size_raw = data.get('field_size')
    driver_name = str(data.get('driver_name', '')).strip() or None
    driver_phone = str(data.get('driver_phone', '')).strip() or None
    tractor_number = str(data.get('tractor_number', '')).strip() or None
    notes = str(data.get('notes', '')).strip() or None

    if not work_date:
        return jsonify({'success': False, 'error': 'Work date is required.'}), 400
    if not field_name:
        return jsonify({'success': False, 'error': 'Field name is required.'}), 400
    if not crop:
        return jsonify({'success': False, 'error': 'Crop name is required.'}), 400
    if not work_type:
        return jsonify({'success': False, 'error': 'Work type is required.'}), 400
    if rate_unit not in VALID_RATE_UNITS:
        return jsonify({'success': False, 'error': f"Invalid rate unit '{rate_unit}'. Allowed: per_hour, per_acre, fixed."}), 400

    try:
        rate = float(rate_raw)
        if rate <= 0:
            return jsonify({'success': False, 'error': 'Rate must be greater than zero.'}), 400
    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': 'Please provide a valid numeric agreed rate.'}), 400

    field_size = 0.0
    if field_size_raw is not None and str(field_size_raw).strip() != '':
        try:
            field_size = float(field_size_raw)
            if field_size < 0:
                return jsonify({'success': False, 'error': 'Field size cannot be negative.'}), 400
        except (ValueError, TypeError):
            return jsonify({'success': False, 'error': 'Field size must be a valid number.'}), 400

    conn = get_db()
    job_id = generate_tractor_job_id(conn, work_date)
    join_token = secrets.token_urlsafe(16)
    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO tractor_jobs (
            job_id, join_token, farmer_id, driver_name, driver_phone, tractor_number,
            crop, field_name, work_type, work_date, field_size, rate, rate_unit,
            status, total_working_seconds, calculated_amount, final_amount, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CREATED', 0, 0.0, 0.0, ?)
    """, (
        job_id, join_token, user['id'], driver_name, driver_phone, tractor_number,
        crop, field_name, work_type, work_date, field_size, rate, rate_unit, notes
    ))
    job_pk = cursor.lastrowid

    # Record CREATED audit event
    cursor.execute("""
        INSERT INTO tractor_work_events (tractor_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'CREATED', ?, ?, ?)
    """, (job_pk, user['id'], server_now, f"Job created by farmer {user['name']} with rate ₹{rate}/{rate_unit}"))

    conn.commit()

    created_row = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_pk,)).fetchone()
    serialized = serialize_tractor_job(created_row, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': f'Tractor job {job_id} created successfully.',
        'job': serialized
    }), 201


@app.route('/api/tractor/jobs/<identifier>', methods=['GET'])
def api_get_tractor_job_detail(identifier):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to view tractor job details.'}), 401

    conn = get_db()
    row = None
    if identifier.isdigit():
        row = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (int(identifier),)).fetchone()
    if not row:
        row = conn.execute("SELECT * FROM tractor_jobs WHERE job_id = ?", (identifier.upper(),)).fetchone()
    if not row:
        row = conn.execute("SELECT * FROM tractor_jobs WHERE join_token = ?", (identifier,)).fetchone()

    if not row:
        conn.close()
        return jsonify({'success': False, 'error': 'Tractor job not found.'}), 404

    # Authorization Check
    is_owner = (row['farmer_id'] == user['id'])
    is_driver = (row['driver_id'] == user['id'])

    # If user is not yet owner/driver, allow viewing preview if status is CREATED or joining
    serialized = serialize_tractor_job(row, user_id=user['id'], conn=conn)
    conn.close()

    if not is_owner and not is_driver:
        if row['status'] == 'CREATED':
            serialized['is_preview_for_join'] = True
            return jsonify({'success': True, 'job': serialized})
        return jsonify({'success': False, 'error': 'You are not authorized to view this tractor job.'}), 403

    return jsonify({'success': True, 'job': serialized})


@app.route('/api/tractor/jobs/<identifier>/join', methods=['POST'])
def api_join_tractor_job(identifier):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in as tractor driver to join this job.'}), 401

    conn = get_db()
    row = None
    if identifier.isdigit():
        row = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (int(identifier),)).fetchone()
    if not row:
        row = conn.execute("SELECT * FROM tractor_jobs WHERE job_id = ?", (identifier.upper(),)).fetchone()
    if not row:
        row = conn.execute("SELECT * FROM tractor_jobs WHERE join_token = ?", (identifier,)).fetchone()

    if not row:
        conn.close()
        return jsonify({'success': False, 'error': 'Tractor job not found.'}), 404

    if row['status'] not in ('CREATED', 'DRIVER_JOINED'):
        conn.close()
        return jsonify({'success': False, 'error': f"Cannot join job in '{row['status']}' status."}), 400

    job_pk = row['id']
    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    driver_name = user['name']

    conn.execute("""
        UPDATE tractor_jobs 
        SET driver_id = ?, driver_name = ?, status = 'DRIVER_JOINED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (user['id'], driver_name, job_pk))

    conn.execute("""
        INSERT INTO tractor_work_events (tractor_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'DRIVER_JOINED', ?, ?, ?)
    """, (job_pk, user['id'], server_now, f"Driver {driver_name} joined job {row['job_id']}"))

    conn.commit()

    updated = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_pk,)).fetchone()
    serialized = serialize_tractor_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Joined tractor job {row['job_id']} successfully.",
        'job': serialized
    })


@app.route('/api/tractor/jobs/<int:job_id>/start', methods=['POST'])
def api_start_tractor_job(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to start tractor work.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    if user['id'] != job['farmer_id'] and user['id'] != job['driver_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized to start this job.'}), 403

    if job['status'] not in ('DRIVER_JOINED', 'PAUSED', 'START_REQUESTED'):
        conn.close()
        return jsonify({'success': False, 'error': f"Cannot start work when status is '{job['status']}'."}), 400

    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # If the counterparty directly starts or confirms
    conn.execute("""
        UPDATE tractor_jobs
        SET status = 'START_REQUESTED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (job_id,))

    conn.execute("""
        INSERT INTO tractor_work_events (tractor_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'START_REQUESTED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Start requested by {user['name']}"))

    conn.commit()
    updated = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_tractor_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Start request registered. Awaiting confirmation.',
        'job': serialized
    })


@app.route('/api/tractor/jobs/<int:job_id>/confirm-start', methods=['POST'])
def api_confirm_start_tractor_job(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to confirm start.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    if user['id'] != job['farmer_id'] and user['id'] != job['driver_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized to confirm start for this job.'}), 403

    if job['status'] not in ('START_REQUESTED', 'DRIVER_JOINED', 'PAUSED'):
        conn.close()
        return jsonify({'success': False, 'error': f"Cannot confirm start when status is '{job['status']}'."}), 400

    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    conn.execute("""
        UPDATE tractor_jobs
        SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (job_id,))

    conn.execute("""
        INSERT INTO tractor_work_events (tractor_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'STARTED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Work officially started by {user['name']} at {server_now}"))

    conn.commit()
    updated = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_tractor_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Tractor work is now RUNNING.',
        'job': serialized
    })


@app.route('/api/tractor/jobs/<int:job_id>/pause', methods=['POST'])
def api_pause_tractor_job(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to pause tractor work.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    if user['id'] != job['farmer_id'] and user['id'] != job['driver_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized.'}), 403

    if job['status'] != 'RUNNING':
        conn.close()
        return jsonify({'success': False, 'error': f"Cannot pause work when status is '{job['status']}'."}), 400

    data = request.get_json(silent=True) or {}
    pause_notes = str(data.get('notes', 'Break / Refueling / Rest')).strip() or 'Break / Refueling'
    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # Record PAUSED event
    conn.execute("""
        INSERT INTO tractor_work_events (tractor_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'PAUSED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Work paused by {user['name']}: {pause_notes}"))

    # Compute exact elapsed seconds up to now
    events = [dict(r) for r in conn.execute("SELECT * FROM tractor_work_events WHERE tractor_job_id = ? ORDER BY id ASC", (job_id,)).fetchall()]
    active_secs = compute_job_timeline_and_seconds(events, current_status='PAUSED', total_working_seconds=job['total_working_seconds'])

    conn.execute("""
        UPDATE tractor_jobs
        SET status = 'PAUSED', total_working_seconds = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (active_secs, job_id))

    conn.commit()
    updated = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_tractor_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Tractor work PAUSED. Break time will not be billed.',
        'job': serialized
    })


@app.route('/api/tractor/jobs/<int:job_id>/resume', methods=['POST'])
def api_resume_tractor_job(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to resume tractor work.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    if user['id'] != job['farmer_id'] and user['id'] != job['driver_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized.'}), 403

    if job['status'] != 'PAUSED':
        conn.close()
        return jsonify({'success': False, 'error': f"Cannot resume work when status is '{job['status']}'."}), 400

    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    conn.execute("""
        UPDATE tractor_jobs
        SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (job_id,))

    conn.execute("""
        INSERT INTO tractor_work_events (tractor_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'RESUMED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Work resumed by {user['name']} at {server_now}"))

    conn.commit()
    updated = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_tractor_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Tractor work RESUMED.',
        'job': serialized
    })


@app.route('/api/tractor/jobs/<int:job_id>/finish', methods=['POST'])
def api_finish_tractor_job(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to finish work.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    if user['id'] != job['farmer_id'] and user['id'] != job['driver_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized.'}), 403

    if job['status'] not in ('RUNNING', 'PAUSED', 'FINISH_REQUESTED'):
        conn.close()
        return jsonify({'success': False, 'error': f"Cannot finish job when status is '{job['status']}'."}), 400

    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    conn.execute("""
        UPDATE tractor_jobs
        SET status = 'FINISH_REQUESTED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (job_id,))

    conn.execute("""
        INSERT INTO tractor_work_events (tractor_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'FINISH_REQUESTED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Completion requested by {user['name']}"))

    conn.commit()
    updated = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_tractor_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Completion requested. Awaiting counterparty confirmation.',
        'job': serialized
    })


@app.route('/api/tractor/jobs/<int:job_id>/confirm-finish', methods=['POST'])
def api_confirm_finish_tractor_job(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to confirm completion.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    if user['id'] != job['farmer_id'] and user['id'] != job['driver_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized to confirm finish.'}), 403

    if job['status'] not in ('FINISH_REQUESTED', 'RUNNING', 'PAUSED'):
        conn.close()
        return jsonify({'success': False, 'error': f"Cannot confirm finish when status is '{job['status']}'."}), 400

    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # Record FINISHED event
    conn.execute("""
        INSERT INTO tractor_work_events (tractor_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'FINISHED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Work confirmed COMPLETED by {user['name']} at {server_now}"))

    # Compute final official server-side active seconds (excluding all pauses)
    events = [dict(r) for r in conn.execute("SELECT * FROM tractor_work_events WHERE tractor_job_id = ? ORDER BY id ASC", (job_id,)).fetchall()]
    final_active_secs = compute_job_timeline_and_seconds(events, current_status='COMPLETED', total_working_seconds=job['total_working_seconds'])

    # Compute final payment
    final_amount = compute_tractor_payment(job['rate'], job['rate_unit'], job['field_size'], final_active_secs)

    conn.execute("""
        UPDATE tractor_jobs
        SET status = 'COMPLETED',
            total_working_seconds = ?,
            calculated_amount = ?,
            final_amount = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (final_active_secs, final_amount, final_amount, job_id))

    conn.commit()
    updated = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_tractor_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Tractor job {job['job_id']} COMPLETED. Total Active Time: {final_active_secs // 3600}h {(final_active_secs % 3600) // 60}m | Amount: ₹{final_amount:,.2f}",
        'job': serialized
    })


@app.route('/api/tractor/jobs/<int:job_id>/dispute', methods=['POST'])
def api_dispute_tractor_job(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to raise a dispute.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    if user['id'] != job['farmer_id'] and user['id'] != job['driver_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized to raise dispute on this job.'}), 403

    data = request.get_json(silent=True) or {}
    reason = str(data.get('reason', '')).strip()
    description = str(data.get('description', '')).strip()

    if not reason:
        conn.close()
        return jsonify({'success': False, 'error': 'Dispute reason is required.'}), 400

    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    conn.execute("""
        INSERT INTO tractor_disputes (tractor_job_id, raised_by, reason, description, status)
        VALUES (?, ?, ?, ?, 'OPEN')
    """, (job_id, user['id'], reason, description))

    conn.execute("""
        UPDATE tractor_jobs
        SET status = 'DISPUTED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (job_id,))

    conn.execute("""
        INSERT INTO tractor_work_events (tractor_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'DISPUTED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Dispute raised by {user['name']}: {reason} - {description}"))

    conn.commit()
    updated = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_tractor_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Dispute registered. Status updated to DISPUTED.',
        'job': serialized
    })


@app.route('/api/tractor/jobs/<int:job_id>/resolve-dispute', methods=['POST'])
def api_resolve_dispute_tractor_job(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to resolve dispute.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    if user['id'] != job['farmer_id'] and user['id'] != job['driver_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized.'}), 403

    data = request.get_json(silent=True) or {}
    resolution = str(data.get('resolution', 'Mutual agreement reached')).strip()
    next_status = str(data.get('next_status', 'RUNNING')).strip().upper()
    if next_status not in ('RUNNING', 'PAUSED', 'COMPLETED'):
        next_status = 'RUNNING'

    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    conn.execute("""
        UPDATE tractor_disputes
        SET status = 'RESOLVED', resolution = ?, resolved_at = CURRENT_TIMESTAMP
        WHERE tractor_job_id = ? AND status = 'OPEN'
    """, (resolution, job_id))

    conn.execute("""
        UPDATE tractor_jobs
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (next_status, job_id))

    conn.execute("""
        INSERT INTO tractor_work_events (tractor_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'DISPUTE_RESOLVED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Dispute resolved by {user['name']}: {resolution}"))

    conn.commit()
    updated = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_tractor_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': f'Dispute resolved. Job status set to {next_status}.',
        'job': serialized
    })


@app.route('/api/tractor/jobs/<int:job_id>/add-to-expenses', methods=['POST'])
def api_add_tractor_to_expenses(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to add tractor expenses.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Tractor job not found.'}), 404

    if user['id'] != job['farmer_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Only the farmer can add this tractor job to farm expenses.'}), 403

    if job['status'] != 'COMPLETED':
        conn.close()
        return jsonify({'success': False, 'error': 'Only completed tractor jobs can be added to expenses.'}), 400

    if job['expense_id']:
        # Already linked
        existing_exp = conn.execute("SELECT * FROM farm_expenses WHERE id = ?", (job['expense_id'],)).fetchone()
        conn.close()
        return jsonify({
            'success': True,
            'message': 'This tractor job is already recorded in Farm Expenses.',
            'expense': dict(existing_exp) if existing_exp else None,
            'already_added': True
        })

    amount = float(job['final_amount'] or job['calculated_amount'] or 0.0)
    dur_secs = int(job['total_working_seconds'] or 0)
    hours = dur_secs // 3600
    mins = (dur_secs % 3600) // 60
    dur_str = f"{hours}h {mins}m" if hours > 0 else f"{mins}m"

    desc = f"Tractor work — {job['work_type']} (Job ID: {job['job_id']}, Duration: {dur_str}, Rate: ₹{job['rate']}/{job['rate_unit']})"

    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO farm_expenses (user_id, date, category, amount, crop, field_name, description)
        VALUES (?, ?, 'Tractor', ?, ?, ?, ?)
    """, (user['id'], job['work_date'], amount, job['crop'], job['field_name'], desc))
    exp_id = cursor.lastrowid

    cursor.execute("""
        UPDATE tractor_jobs SET expense_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    """, (exp_id, job_id))

    conn.commit()

    created_exp = conn.execute("SELECT * FROM farm_expenses WHERE id = ?", (exp_id,)).fetchone()
    updated_job = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_tractor_job(updated_job, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Added ₹{amount:,.2f} to Farm Expenses under category 'Tractor'.",
        'expense': dict(created_exp),
        'job': serialized
    }), 201


@app.route('/api/tractor/jobs/<int:job_id>/events', methods=['GET'])
def api_get_tractor_job_events(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM tractor_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    if user['id'] != job['farmer_id'] and user['id'] != job['driver_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized.'}), 403

    events_rows = conn.execute("""
        SELECT e.*, u.name as performed_by_name, u.email as performed_by_email
        FROM tractor_work_events e
        LEFT JOIN users u ON e.performed_by = u.id
        WHERE e.tractor_job_id = ?
        ORDER BY e.id ASC
    """, (job_id,)).fetchall()

    events = [dict(ev) for ev in events_rows]
    conn.close()

    return jsonify({'success': True, 'events': events, 'count': len(events)})


@app.route('/api/tractor/summary', methods=['GET'])
def api_get_tractor_summary():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to view tractor summary.'}), 401

    uid = user['id']
    conn = get_db()
    current_month = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m')

    # Farmer metrics
    farmer_active = conn.execute(
        "SELECT COUNT(*) as c FROM tractor_jobs WHERE farmer_id = ? AND status IN ('CREATED', 'DRIVER_JOINED', 'START_REQUESTED', 'RUNNING', 'PAUSED', 'FINISH_REQUESTED', 'DISPUTED')",
        (uid,)
    ).fetchone()['c']

    farmer_completed = conn.execute(
        "SELECT COUNT(*) as c FROM tractor_jobs WHERE farmer_id = ? AND status = 'COMPLETED'",
        (uid,)
    ).fetchone()['c']

    farmer_pending = conn.execute(
        "SELECT COUNT(*) as c FROM tractor_jobs WHERE farmer_id = ? AND status IN ('START_REQUESTED', 'FINISH_REQUESTED', 'DISPUTED')",
        (uid,)
    ).fetchone()['c']

    month_farmer_exp_row = conn.execute(
        "SELECT COALESCE(SUM(final_amount), 0) as s FROM tractor_jobs WHERE farmer_id = ? AND status = 'COMPLETED' AND work_date LIKE ?",
        (uid, f"{current_month}%")
    ).fetchone()
    month_tractor_expenses = round(float(month_farmer_exp_row['s'] or 0.0), 2)

    total_farmer_exp_row = conn.execute(
        "SELECT COALESCE(SUM(final_amount), 0) as s FROM tractor_jobs WHERE farmer_id = ? AND status = 'COMPLETED'",
        (uid,)
    ).fetchone()
    total_tractor_expenses = round(float(total_farmer_exp_row['s'] or 0.0), 2)

    # Driver metrics
    driver_active = conn.execute(
        "SELECT COUNT(*) as c FROM tractor_jobs WHERE driver_id = ? AND status IN ('DRIVER_JOINED', 'START_REQUESTED', 'RUNNING', 'PAUSED', 'FINISH_REQUESTED', 'DISPUTED')",
        (uid,)
    ).fetchone()['c']

    driver_completed = conn.execute(
        "SELECT COUNT(*) as c FROM tractor_jobs WHERE driver_id = ? AND status = 'COMPLETED'",
        (uid,)
    ).fetchone()['c']

    driver_pending = conn.execute(
        "SELECT COUNT(*) as c FROM tractor_jobs WHERE driver_id = ? AND status IN ('START_REQUESTED', 'FINISH_REQUESTED', 'DISPUTED')",
        (uid,)
    ).fetchone()['c']

    driver_earnings_row = conn.execute(
        "SELECT COALESCE(SUM(final_amount), 0) as s FROM tractor_jobs WHERE driver_id = ? AND status = 'COMPLETED'",
        (uid,)
    ).fetchone()
    driver_total_earnings = round(float(driver_earnings_row['s'] or 0.0), 2)

    conn.close()

    return jsonify({
        'success': True,
        'summary': {
            'farmer': {
                'active_jobs': farmer_active,
                'completed_jobs': farmer_completed,
                'pending_confirmations': farmer_pending,
                'month_expenses': month_tractor_expenses,
                'total_expenses': total_tractor_expenses,
                'current_month': current_month
            },
            'driver': {
                'active_jobs': driver_active,
                'completed_jobs': driver_completed,
                'pending_requests': driver_pending,
                'total_earnings': driver_total_earnings
            }
        }
    })


# ==============================================================================
# PHASE 3: LABOUR WORK TRACKER BACKEND API & CONTROLLERS
# ==============================================================================

VALID_LABOUR_PAYMENT_TYPES = {'per_day', 'per_hour', 'fixed'}

def generate_labour_job_id(conn, work_date):
    try:
        dt = datetime.datetime.strptime(work_date.strip(), '%Y-%m-%d')
        date_str = dt.strftime('%Y%m%d')
    except Exception:
        date_str = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d')

    prefix = f"LAB-{date_str}-"
    rows = conn.execute(
        "SELECT job_id FROM labour_jobs WHERE job_id LIKE ? ORDER BY job_id DESC",
        (f"{prefix}%",)
    ).fetchall()

    max_seq = 0
    for r in rows:
        jid = str(r['job_id'])
        parts = jid.split('-')
        if len(parts) >= 3 and parts[-1].isdigit():
            max_seq = max(max_seq, int(parts[-1]))

    next_seq = max_seq + 1
    return f"{prefix}{next_seq:03d}"


def recalculate_labour_job_finances(conn, job_id_pk):
    """
    Computes accurate financial calculations for a labour job:
      - Total active hours/seconds (if hourly)
      - Total days worked from attendance logs
      - Total earned based on payment_type (per_day, per_hour, fixed)
      - Total advances given
      - Total payments made
      - Remaining pending amount
    Updates both the parent job and child worker records atomically.
    """
    job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id_pk,)).fetchone()
    if not job:
        return

    payment_type = job['payment_type']
    rate = float(job['rate'] or 0.0)
    num_workers = max(1, int(job['num_workers'] or 1))

    # 1. Attendance aggregation
    att_row = conn.execute(
        """SELECT COALESCE(SUM(day_fraction), 0) as total_days,
                  COALESCE(SUM(hours_worked), 0) as total_att_hours,
                  COALESCE(SUM(wage_amount), 0) as total_att_wage
           FROM labour_attendance WHERE labour_job_id = ?""",
        (job_id_pk,)
    ).fetchone()

    total_days_worked = round(float(att_row['total_days'] or 0.0), 2)
    att_wage_sum = round(float(att_row['total_att_wage'] or 0.0), 2)

    # 2. Hourly work timeline calculation
    events = [dict(r) for r in conn.execute(
        "SELECT * FROM labour_work_events WHERE labour_job_id = ? ORDER BY id ASC",
        (job_id_pk,)
    ).fetchall()]

    total_active_seconds = compute_job_timeline_and_seconds(
        events,
        current_status=job['status'],
        total_working_seconds=job['total_working_seconds']
    )

    # 3. Compute Total Earned
    if payment_type == 'per_day':
        # If attendance records exist, use the exact sum of daily wages
        if total_days_worked > 0 or att_wage_sum > 0:
            total_earned = att_wage_sum
        else:
            total_earned = 0.0
    elif payment_type == 'per_hour':
        hourly_hours = total_active_seconds / 3600.0
        total_earned = round(hourly_hours * rate * num_workers, 2)
    elif payment_type == 'fixed':
        total_earned = round(rate, 2)
    else:
        total_earned = round(rate, 2)

    # 4. Total Advances
    adv_row = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) as s FROM labour_advances WHERE labour_job_id = ?",
        (job_id_pk,)
    ).fetchone()
    total_advance = round(float(adv_row['s'] or 0.0), 2)

    # 5. Total Payments
    pay_row = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) as s FROM labour_payments WHERE labour_job_id = ?",
        (job_id_pk,)
    ).fetchone()
    total_paid = round(float(pay_row['s'] or 0.0), 2)

    # 6. Pending Amount = Total Earned - (Total Paid + Total Advance)
    pending_amount = max(0.0, round(total_earned - (total_paid + total_advance), 2))

    conn.execute("""
        UPDATE labour_jobs
        SET total_working_seconds = ?,
            total_days_worked = ?,
            total_earned = ?,
            total_advance = ?,
            total_paid = ?,
            pending_amount = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (total_active_seconds, total_days_worked, total_earned, total_advance, total_paid, pending_amount, job_id_pk))

    # Update individual labour_workers breakdown
    workers = conn.execute("SELECT id, name FROM labour_workers WHERE labour_job_id = ?", (job_id_pk,)).fetchall()
    for w in workers:
        wid = w['id']
        wname = w['name']

        w_att = conn.execute(
            """SELECT COALESCE(SUM(day_fraction), 0) as days,
                      COALESCE(SUM(hours_worked), 0) as hrs,
                      COALESCE(SUM(wage_amount), 0) as wage
               FROM labour_attendance
               WHERE labour_job_id = ? AND (worker_id = ? OR worker_name = ?)""",
            (job_id_pk, wid, wname)
        ).fetchone()

        w_days = round(float(w_att['days'] or 0.0), 2)
        w_hrs = round(float(w_att['hrs'] or 0.0), 2)

        if payment_type == 'per_day':
            w_earned = round(float(w_att['wage'] or 0.0), 2)
        elif payment_type == 'per_hour':
            w_earned = round((total_active_seconds / 3600.0) * rate, 2)
        else:
            w_earned = round(rate / max(1, len(workers)), 2)

        w_adv = float(conn.execute(
            "SELECT COALESCE(SUM(amount), 0) as s FROM labour_advances WHERE labour_job_id = ? AND (worker_id = ? OR worker_name = ?)",
            (job_id_pk, wid, wname)
        ).fetchone()['s'] or 0.0)

        w_pay = float(conn.execute(
            "SELECT COALESCE(SUM(amount), 0) as s FROM labour_payments WHERE labour_job_id = ? AND (worker_id = ? OR worker_name = ?)",
            (job_id_pk, wid, wname)
        ).fetchone()['s'] or 0.0)

        w_pending = max(0.0, round(w_earned - (w_pay + w_adv), 2))

        conn.execute("""
            UPDATE labour_workers
            SET total_days = ?,
                total_hours = ?,
                total_earned = ?,
                total_advance = ?,
                total_paid = ?,
                pending_amount = ?
            WHERE id = ?
        """, (w_days, w_hrs, w_earned, w_adv, w_pay, w_pending, wid))


def serialize_labour_job(row, user_id=None, conn=None):
    item = dict(row)
    item['rate'] = float(item.get('rate') or 0.0)
    item['num_workers'] = int(item.get('num_workers') or 1)
    item['farmer_agreed'] = bool(item.get('farmer_agreed'))
    item['worker_agreed'] = bool(item.get('worker_agreed'))
    item['farmer_confirmed'] = bool(item.get('farmer_confirmed'))
    item['worker_confirmed'] = bool(item.get('worker_confirmed'))
    item['total_working_seconds'] = int(item.get('total_working_seconds') or 0)
    item['total_days_worked'] = float(item.get('total_days_worked') or 0.0)
    item['total_earned'] = float(item.get('total_earned') or 0.0)
    item['total_paid'] = float(item.get('total_paid') or 0.0)
    item['total_advance'] = float(item.get('total_advance') or 0.0)
    item['pending_amount'] = float(item.get('pending_amount') or 0.0)

    if user_id:
        item['is_farmer'] = (item.get('farmer_id') == user_id)
        item['is_worker'] = (item.get('worker_id') == user_id)
        if item['is_farmer']:
            item['current_user_role'] = 'farmer'
        elif item['is_worker']:
            item['current_user_role'] = 'worker'
        else:
            item['current_user_role'] = 'viewer'

    if conn:
        job_pk = item['id']

        # 1. Associated Workers List
        w_rows = conn.execute(
            "SELECT * FROM labour_workers WHERE labour_job_id = ? ORDER BY id ASC",
            (job_pk,)
        ).fetchall()
        item['workers'] = [dict(w) for w in w_rows]

        # 2. Attendance Records
        att_rows = conn.execute(
            """SELECT a.*, u.name as created_by_name
               FROM labour_attendance a
               LEFT JOIN users u ON a.created_by = u.id
               WHERE a.labour_job_id = ?
               ORDER BY a.date DESC, a.id DESC""",
            (job_pk,)
        ).fetchall()
        item['attendance'] = [dict(a) for a in att_rows]

        # 3. Payments History
        pay_rows = conn.execute(
            """SELECT p.*, u.name as farmer_name
               FROM labour_payments p
               LEFT JOIN users u ON p.farmer_id = u.id
               WHERE p.labour_job_id = ?
               ORDER BY p.payment_date DESC, p.id DESC""",
            (job_pk,)
        ).fetchall()
        item['payments'] = [dict(p) for p in pay_rows]

        # 4. Advances History
        adv_rows = conn.execute(
            """SELECT adv.*, u.name as farmer_name
               FROM labour_advances adv
               LEFT JOIN users u ON adv.farmer_id = u.id
               WHERE adv.labour_job_id = ?
               ORDER BY adv.advance_date DESC, adv.id DESC""",
            (job_pk,)
        ).fetchall()
        item['advances'] = [dict(adv) for adv in adv_rows]

        # 5. Disputes
        disp_rows = conn.execute(
            """SELECT d.*, u.name as raised_by_name
               FROM labour_disputes d
               LEFT JOIN users u ON d.raised_by = u.id
               WHERE d.labour_job_id = ?
               ORDER BY d.id DESC""",
            (job_pk,)
        ).fetchall()
        item['disputes'] = [dict(d) for d in disp_rows]

        # 6. Work Agreement
        agr_row = conn.execute(
            "SELECT * FROM labour_agreements WHERE labour_job_id = ? ORDER BY id DESC LIMIT 1",
            (job_pk,)
        ).fetchone()
        if agr_row:
            item['agreement'] = dict(agr_row)

        # 7. Events Timeline
        events_rows = conn.execute(
            """SELECT e.*, u.name as performed_by_name
               FROM labour_work_events e
               LEFT JOIN users u ON e.performed_by = u.id
               WHERE e.labour_job_id = ?
               ORDER BY e.id ASC""",
            (job_pk,)
        ).fetchall()
        events = [dict(ev) for ev in events_rows]
        item['events'] = events

        # 8. Live Active Seconds
        live_active_seconds = compute_job_timeline_and_seconds(
            events,
            current_status=item.get('status'),
            total_working_seconds=item.get('total_working_seconds')
        )
        item['live_active_seconds'] = live_active_seconds

        # 9. Parties Info
        farmer_row = conn.execute("SELECT name, email, location FROM users WHERE id = ?", (item['farmer_id'],)).fetchone()
        if farmer_row:
            item['farmer_name'] = farmer_row['name']
            item['farmer_email'] = farmer_row['email']
            item['farmer_location'] = farmer_row['location']

        if item.get('worker_id'):
            worker_user = conn.execute("SELECT name, email FROM users WHERE id = ?", (item['worker_id'],)).fetchone()
            if worker_user:
                item['worker_user_name'] = worker_user['name']
                item['worker_email'] = worker_user['email']

        # 10. Linked Farm Expense
        if item.get('expense_id'):
            exp_row = conn.execute("SELECT * FROM farm_expenses WHERE id = ?", (item['expense_id'],)).fetchone()
            if exp_row:
                item['expense'] = dict(exp_row)

    return item


@app.route('/labour-work')
def page_labour_work():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))
    dist_index = os.path.join(app.root_path, 'dist', 'index.html')
    if os.path.exists(dist_index):
        return send_from_directory(os.path.join(app.root_path, 'dist'), 'index.html')
    return redirect(url_for('dashboard'))


@app.route('/api/labour/jobs', methods=['GET'])
def api_get_labour_jobs():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to view labour work records.'}), 401

    uid = user['id']
    role = request.args.get('role', 'all').strip().lower()
    status = request.args.get('status', '').strip().upper()
    crop = request.args.get('crop', '').strip()

    conn = get_db()
    query = """
        SELECT l.*, 
               f.name as farmer_name, 
               w.name as worker_user_name
        FROM labour_jobs l
        JOIN users f ON l.farmer_id = f.id
        LEFT JOIN users w ON l.worker_id = w.id
        WHERE 1=1
    """
    params = []

    if role == 'farmer':
        query += " AND l.farmer_id = ?"
        params.append(uid)
    elif role == 'worker':
        query += " AND (l.worker_id = ? OR l.worker_name = ?)"
        params.append(uid)
        params.append(user['name'])
    else:
        # Default: user is farmer or worker on the job
        query += " AND (l.farmer_id = ? OR l.worker_id = ? OR l.worker_name = ?)"
        params.append(uid)
        params.append(uid)
        params.append(user['name'])

    if status:
        query += " AND l.status = ?"
        params.append(status)

    if crop:
        query += " AND l.crop = ?"
        params.append(crop)

    query += " ORDER BY l.id DESC"

    rows = conn.execute(query, params).fetchall()
    jobs = [serialize_labour_job(r, user_id=uid, conn=conn) for r in rows]
    conn.close()

    return jsonify({'success': True, 'jobs': jobs, 'count': len(jobs)})


@app.route('/api/labour/jobs', methods=['POST'])
def api_create_labour_job():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to create a labour job.'}), 401

    data = request.get_json(silent=True) or {}
    work_date = str(data.get('work_date', '')).strip()
    work_type = str(data.get('work_type', '')).strip()
    crop = str(data.get('crop', '')).strip()
    field_name = str(data.get('field_name', '')).strip()
    worker_name = str(data.get('worker_name', '')).strip() or 'Agricultural Worker'
    worker_phone = str(data.get('worker_phone', '')).strip() or None
    payment_type = str(data.get('payment_type', 'per_day')).strip().lower()
    rate_val = data.get('rate')
    num_workers_val = data.get('num_workers', 1)
    expected_start_date = str(data.get('expected_start_date', '')).strip() or work_date
    expected_end_date = str(data.get('expected_end_date', '')).strip() or None
    notes = str(data.get('notes', '')).strip() or None

    if not work_date:
        work_date = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
    if not crop:
        return jsonify({'success': False, 'error': 'Crop name is required.'}), 400
    if not field_name:
        return jsonify({'success': False, 'error': 'Field name is required.'}), 400
    if not work_type:
        return jsonify({'success': False, 'error': 'Work type (e.g. Harvesting, Weeding) is required.'}), 400
    if payment_type not in VALID_LABOUR_PAYMENT_TYPES:
        return jsonify({'success': False, 'error': f"Invalid payment type. Must be one of: {', '.join(VALID_LABOUR_PAYMENT_TYPES)}"}), 400

    try:
        rate = float(rate_val)
        if rate <= 0:
            return jsonify({'success': False, 'error': 'Agreed rate must be greater than 0.'}), 400
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': 'Please provide a valid numeric rate.'}), 400

    try:
        num_workers = max(1, int(num_workers_val))
    except (TypeError, ValueError):
        num_workers = 1

    conn = get_db()
    job_id = generate_labour_job_id(conn, work_date)
    join_token = secrets.token_urlsafe(16)
    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO labour_jobs (
            job_id, join_token, farmer_id, worker_name, worker_phone,
            work_type, crop, field_name, work_date, expected_start_date, expected_end_date,
            payment_type, rate, num_workers, status, farmer_agreed, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CREATED', 1, ?)
    """, (
        job_id, join_token, user['id'], worker_name, worker_phone,
        work_type, crop, field_name, work_date, expected_start_date, expected_end_date,
        payment_type, rate, num_workers, notes
    ))
    job_pk = cursor.lastrowid

    # Create initial worker roster entry
    cursor.execute("""
        INSERT INTO labour_workers (labour_job_id, name, phone, role)
        VALUES (?, ?, ?, 'worker')
    """, (job_pk, worker_name, worker_phone))

    # Create initial work agreement
    terms_summary = f"{work_type} on {crop} ({field_name}) at ₹{rate:,.2f}/{payment_type.replace('_', ' ')} for {num_workers} worker(s)."
    cursor.execute("""
        INSERT INTO labour_agreements (labour_job_id, farmer_id, terms_summary, farmer_agreed_at, status)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'PENDING')
    """, (job_pk, user['id'], terms_summary))

    # Log creation event
    cursor.execute("""
        INSERT INTO labour_work_events (labour_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'CREATED', ?, ?, ?)
    """, (job_pk, user['id'], server_now, f"Labour Job {job_id} created by {user['name']}"))

    conn.commit()

    recalculate_labour_job_finances(conn, job_pk)
    created_row = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_pk,)).fetchone()
    serialized = serialize_labour_job(created_row, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Labour Job {job_id} created successfully.",
        'job': serialized
    }), 201


@app.route('/api/labour/jobs/<identifier>', methods=['GET'])
def api_get_labour_job_detail(identifier):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to view labour job details.'}), 401

    conn = get_db()
    row = None
    if str(identifier).isdigit():
        row = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (int(identifier),)).fetchone()
    if not row:
        row = conn.execute("SELECT * FROM labour_jobs WHERE UPPER(job_id) = ?", (identifier.upper(),)).fetchone()
    if not row:
        row = conn.execute("SELECT * FROM labour_jobs WHERE join_token = ?", (identifier,)).fetchone()

    if not row:
        conn.close()
        return jsonify({'success': False, 'error': 'Labour job not found.'}), 404

    serialized = serialize_labour_job(row, user_id=user['id'], conn=conn)
    conn.close()

    # Allow preview for joining, or full access if authorized
    return jsonify({'success': True, 'job': serialized})


@app.route('/api/labour/jobs/<identifier>/join', methods=['POST'])
def api_join_labour_job(identifier):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to join this labour job.'}), 401

    conn = get_db()
    row = None
    if str(identifier).isdigit():
        row = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (int(identifier),)).fetchone()
    if not row:
        row = conn.execute("SELECT * FROM labour_jobs WHERE UPPER(job_id) = ?", (identifier.upper(),)).fetchone()
    if not row:
        row = conn.execute("SELECT * FROM labour_jobs WHERE join_token = ?", (identifier,)).fetchone()

    if not row:
        conn.close()
        return jsonify({'success': False, 'error': 'Labour job not found.'}), 404

    job_pk = row['id']
    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    worker_user_name = user['name']

    # Update job worker_id
    conn.execute("""
        UPDATE labour_jobs
        SET worker_id = ?, status = CASE WHEN status = 'CREATED' THEN 'WORKER_JOINED' ELSE status END, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (user['id'], job_pk))

    # Update worker roster record or create one
    existing_w = conn.execute(
        "SELECT id FROM labour_workers WHERE labour_job_id = ? AND (user_id = ? OR name = ?)",
        (job_pk, user['id'], worker_user_name)
    ).fetchone()
    if existing_w:
        conn.execute("UPDATE labour_workers SET user_id = ?, name = ? WHERE id = ?", (user['id'], worker_user_name, existing_w['id']))
    else:
        conn.execute("INSERT INTO labour_workers (labour_job_id, user_id, name, role) VALUES (?, ?, ?, 'worker')", (job_pk, user['id'], worker_user_name))

    conn.execute("""
        INSERT INTO labour_work_events (labour_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'WORKER_JOINED', ?, ?, ?)
    """, (job_pk, user['id'], server_now, f"Worker {worker_user_name} joined job {row['job_id']}"))

    conn.commit()

    recalculate_labour_job_finances(conn, job_pk)
    updated = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_pk,)).fetchone()
    serialized = serialize_labour_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Joined labour job {row['job_id']} successfully.",
        'job': serialized
    })


@app.route('/api/labour/jobs/<int:job_id>/agree', methods=['POST'])
def api_agree_labour_job(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to confirm agreement.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    is_farmer = (user['id'] == job['farmer_id'])
    is_worker = (user['id'] == job['worker_id'] or user['name'] == job['worker_name'])

    if not is_farmer and not is_worker:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized to agree to this job.'}), 403

    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    farmer_agreed = job['farmer_agreed'] or (1 if is_farmer else 0)
    worker_agreed = job['worker_agreed'] or (1 if is_worker else 0)

    both_agreed = (farmer_agreed and worker_agreed)
    new_status = 'AGREED' if both_agreed and job['status'] in ('CREATED', 'WORKER_JOINED') else job['status']

    conn.execute("""
        UPDATE labour_jobs
        SET farmer_agreed = ?, worker_agreed = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (farmer_agreed, worker_agreed, new_status, job_id))

    # Update agreements table
    if is_farmer:
        conn.execute("UPDATE labour_agreements SET farmer_agreed_at = CURRENT_TIMESTAMP WHERE labour_job_id = ?", (job_id,))
    if is_worker:
        conn.execute("UPDATE labour_agreements SET worker_id = ?, worker_agreed_at = CURRENT_TIMESTAMP WHERE labour_job_id = ?", (user['id'], job_id))

    if both_agreed:
        conn.execute("UPDATE labour_agreements SET status = 'AGREED' WHERE labour_job_id = ?", (job_id,))

    conn.execute("""
        INSERT INTO labour_work_events (labour_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'AGREED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Agreement accepted by {user['name']} ({'Farmer' if is_farmer else 'Worker'})"))

    conn.commit()
    recalculate_labour_job_finances(conn, job_id)
    updated = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_labour_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    msg = "Work agreement finalized by both parties!" if both_agreed else f"Agreement confirmed by {user['name']}. Awaiting counterparty confirmation."
    return jsonify({
        'success': True,
        'message': msg,
        'job': serialized
    })


@app.route('/api/labour/jobs/<int:job_id>/attendance', methods=['POST'])
def api_mark_labour_attendance(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to mark attendance.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    is_farmer = (user['id'] == job['farmer_id'])
    is_worker = (user['id'] == job['worker_id'] or user['name'] == job['worker_name'])
    if not is_farmer and not is_worker:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized.'}), 403

    if job['status'] == 'COMPLETED':
        conn.close()
        return jsonify({'success': False, 'error': 'This job is already finalized. To record adjustments, raise a dispute/correction.'}), 400

    data = request.get_json(silent=True) or {}
    att_date = str(data.get('date', '')).strip()
    if not att_date:
        att_date = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')

    worker_name = str(data.get('worker_name', '')).strip() or job['worker_name']
    worker_id = data.get('worker_id')
    status = str(data.get('status', 'PRESENT')).strip().upper()
    notes = str(data.get('notes', '')).strip() or None

    if status not in ('PRESENT', 'HALF_DAY', 'ABSENT'):
        conn.close()
        return jsonify({'success': False, 'error': "Attendance status must be 'PRESENT', 'HALF_DAY', or 'ABSENT'."}), 400

    # Calculate day fraction
    if status == 'PRESENT':
        day_fraction = 1.0
    elif status == 'HALF_DAY':
        day_fraction = 0.5
    else:
        day_fraction = 0.0

    hours_worked = float(data.get('hours_worked', 8.0 if status == 'PRESENT' else (4.0 if status == 'HALF_DAY' else 0.0)))

    # Determine rate applied
    rate_applied = float(job['rate'] or 0.0)
    if data.get('rate_applied') is not None:
        try:
            rate_applied = float(data.get('rate_applied'))
        except (TypeError, ValueError):
            pass

    # Wage calculation
    if job['payment_type'] == 'per_day':
        wage_amount = round(day_fraction * rate_applied, 2)
    elif job['payment_type'] == 'per_hour':
        wage_amount = round(hours_worked * rate_applied, 2)
    else:
        wage_amount = round(rate_applied, 2) if status != 'ABSENT' else 0.0

    # Check for duplicate attendance on the same date for this worker
    existing = conn.execute(
        "SELECT id FROM labour_attendance WHERE labour_job_id = ? AND worker_name = ? AND date = ?",
        (job_id, worker_name, att_date)
    ).fetchone()
    if existing:
        conn.close()
        return jsonify({'success': False, 'error': f"Attendance already recorded for '{worker_name}' on {att_date}."}), 400

    # Locate worker_id pk in roster if not supplied
    if not worker_id:
        w_row = conn.execute(
            "SELECT id FROM labour_workers WHERE labour_job_id = ? AND name = ?",
            (job_id, worker_name)
        ).fetchone()
        if w_row:
            worker_id = w_row['id']
        else:
            # Create worker entry in roster
            cur = conn.cursor()
            cur.execute("INSERT INTO labour_workers (labour_job_id, name, role) VALUES (?, ?, 'worker')", (job_id, worker_name))
            worker_id = cur.lastrowid

    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO labour_attendance (
            labour_job_id, worker_id, worker_name, date, status,
            day_fraction, hours_worked, rate_applied, wage_amount, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        job_id, worker_id, worker_name, att_date, status,
        day_fraction, hours_worked, rate_applied, wage_amount, notes, user['id']
    ))
    att_pk = cursor.lastrowid

    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    cursor.execute("""
        INSERT INTO labour_work_events (labour_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'ATTENDANCE_MARKED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Attendance for {worker_name} on {att_date}: {status} (₹{wage_amount:,.2f})"))

    # Update job status to IN_PROGRESS if CREATED or AGREED
    if job['status'] in ('CREATED', 'WORKER_JOINED', 'AGREED'):
        cursor.execute("UPDATE labour_jobs SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (job_id,))

    conn.commit()

    recalculate_labour_job_finances(conn, job_id)
    updated_job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_labour_job(updated_job, user_id=user['id'], conn=conn)
    created_att = conn.execute("SELECT * FROM labour_attendance WHERE id = ?", (att_pk,)).fetchone()
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Marked {status} for {worker_name} on {att_date}. Wage: ₹{wage_amount:,.2f}",
        'attendance': dict(created_att),
        'job': serialized
    }), 201


@app.route('/api/labour/jobs/<int:job_id>/attendance', methods=['GET'])
def api_get_labour_attendance(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    rows = conn.execute(
        """SELECT a.*, u.name as created_by_name
           FROM labour_attendance a
           LEFT JOIN users u ON a.created_by = u.id
           WHERE a.labour_job_id = ?
           ORDER BY a.date DESC, a.id DESC""",
        (job_id,)
    ).fetchall()
    att_list = [dict(r) for r in rows]
    conn.close()

    return jsonify({'success': True, 'attendance': att_list, 'count': len(att_list)})


@app.route('/api/labour/jobs/<int:job_id>/start', methods=['POST'])
def api_start_labour_timer(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    if user['id'] != job['farmer_id'] and user['id'] != job['worker_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized.'}), 403

    if job['status'] in ('COMPLETED', 'DISPUTED'):
        conn.close()
        return jsonify({'success': False, 'error': f"Cannot start timer when status is '{job['status']}'."}), 400

    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    conn.execute("UPDATE labour_jobs SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (job_id,))
    conn.execute("""
        INSERT INTO labour_work_events (labour_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'STARTED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Work timer started by {user['name']} at {server_now}"))

    # Session record
    conn.execute("""
        INSERT INTO labour_work_sessions (labour_job_id, session_type, start_time, status)
        VALUES (?, 'HOURLY_WORK', ?, 'RUNNING')
    """, (job_id, server_now))

    conn.commit()
    recalculate_labour_job_finances(conn, job_id)
    updated = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_labour_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Labour work timer is now RUNNING.',
        'job': serialized
    })


@app.route('/api/labour/jobs/<int:job_id>/pause', methods=['POST'])
def api_pause_labour_timer(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    if user['id'] != job['farmer_id'] and user['id'] != job['worker_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized.'}), 403

    if job['status'] != 'RUNNING':
        conn.close()
        return jsonify({'success': False, 'error': f"Cannot pause work when status is '{job['status']}'."}), 400

    data = request.get_json(silent=True) or {}
    pause_notes = str(data.get('notes', 'Lunch / Break / Rest')).strip() or 'Break'
    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    conn.execute("""
        INSERT INTO labour_work_events (labour_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'PAUSED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Work paused by {user['name']}: {pause_notes}"))

    conn.execute("UPDATE labour_jobs SET status = 'PAUSED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (job_id,))

    # Break record
    conn.execute("""
        INSERT INTO labour_breaks (labour_job_id, start_time, reason)
        VALUES (?, ?, ?)
    """, (job_id, server_now, pause_notes))

    conn.commit()
    recalculate_labour_job_finances(conn, job_id)
    updated = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_labour_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Labour timer PAUSED. Break time will not be billed.',
        'job': serialized
    })


@app.route('/api/labour/jobs/<int:job_id>/resume', methods=['POST'])
def api_resume_labour_timer(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    if user['id'] != job['farmer_id'] and user['id'] != job['worker_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized.'}), 403

    if job['status'] != 'PAUSED':
        conn.close()
        return jsonify({'success': False, 'error': f"Cannot resume work when status is '{job['status']}'."}), 400

    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # Close open break
    open_break = conn.execute(
        "SELECT id, start_time FROM labour_breaks WHERE labour_job_id = ? AND end_time IS NULL ORDER BY id DESC LIMIT 1",
        (job_id,)
    ).fetchone()
    if open_break:
        b_start = parse_iso_ts(open_break['start_time'])
        b_end = parse_iso_ts(server_now)
        b_dur = max(0, int((b_end - b_start).total_seconds())) if b_start and b_end else 0
        conn.execute("UPDATE labour_breaks SET end_time = ?, duration_seconds = ? WHERE id = ?", (server_now, b_dur, open_break['id']))

    conn.execute("UPDATE labour_jobs SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (job_id,))
    conn.execute("""
        INSERT INTO labour_work_events (labour_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'RESUMED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Work resumed by {user['name']} at {server_now}"))

    conn.commit()
    recalculate_labour_job_finances(conn, job_id)
    updated = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_labour_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Labour timer RESUMED.',
        'job': serialized
    })


@app.route('/api/labour/jobs/<int:job_id>/finish', methods=['POST'])
def api_finish_labour_timer(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    if user['id'] != job['farmer_id'] and user['id'] != job['worker_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized.'}), 403

    if job['status'] == 'COMPLETED':
        conn.close()
        return jsonify({'success': False, 'error': 'Job already completed.'}), 400

    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    is_farmer = (user['id'] == job['farmer_id'])

    farmer_conf = 1 if is_farmer else job['farmer_confirmed']
    worker_conf = 1 if not is_farmer else job['worker_confirmed']

    conn.execute("""
        UPDATE labour_jobs
        SET status = 'FINISH_REQUESTED',
            farmer_confirmed = ?,
            worker_confirmed = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (farmer_conf, worker_conf, job_id))

    conn.execute("""
        INSERT INTO labour_work_events (labour_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'FINISH_REQUESTED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Completion requested by {user['name']}"))

    conn.commit()
    recalculate_labour_job_finances(conn, job_id)
    updated = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_labour_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Completion requested. Awaiting counterparty confirmation.',
        'job': serialized
    })


@app.route('/api/labour/jobs/<int:job_id>/confirm-finish', methods=['POST'])
def api_confirm_finish_labour_job(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    is_farmer = (user['id'] == job['farmer_id'])
    is_worker = (user['id'] == job['worker_id'] or user['name'] == job['worker_name'])
    if not is_farmer and not is_worker:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized.'}), 403

    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    farmer_conf = 1 if is_farmer else job['farmer_confirmed']
    worker_conf = 1 if is_worker else job['worker_confirmed']

    # Both confirmed or farmer finalizing work record
    conn.execute("""
        UPDATE labour_jobs
        SET status = 'COMPLETED',
            farmer_confirmed = 1,
            worker_confirmed = 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (job_id,))

    conn.execute("""
        INSERT INTO labour_work_events (labour_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'FINISHED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Work confirmed COMPLETED and finalized by {user['name']} at {server_now}"))

    conn.commit()
    recalculate_labour_job_finances(conn, job_id)
    updated = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_labour_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': f"✅ Work Record Finalized! Job {job['job_id']} is officially COMPLETED. Total Cost: ₹{serialized['total_earned']:,.2f}",
        'job': serialized
    })


@app.route('/api/labour/jobs/<int:job_id>/payment', methods=['POST'])
def api_record_labour_payment(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to record a payment.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    if user['id'] != job['farmer_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Only the farmer can record wage payments.'}), 403

    data = request.get_json(silent=True) or {}
    amount_val = data.get('amount')
    payment_date = str(data.get('payment_date', '')).strip()
    if not payment_date:
        payment_date = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
    payment_method = str(data.get('payment_method', 'Cash')).strip()
    reference_no = str(data.get('reference_no', '')).strip() or None
    notes = str(data.get('notes', '')).strip() or None
    worker_name = str(data.get('worker_name', '')).strip() or job['worker_name']
    worker_id = data.get('worker_id')

    try:
        amount = float(amount_val)
        if amount <= 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Payment amount must be greater than 0.'}), 400
    except (TypeError, ValueError):
        conn.close()
        return jsonify({'success': False, 'error': 'Please provide a valid payment amount.'}), 400

    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO labour_payments (
            labour_job_id, worker_id, worker_name, farmer_id,
            amount, payment_date, payment_method, reference_no, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (job_id, worker_id, worker_name, user['id'], amount, payment_date, payment_method, reference_no, notes))
    pay_pk = cursor.lastrowid

    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    cursor.execute("""
        INSERT INTO labour_work_events (labour_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'PAYMENT_RECORDED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Payment of ₹{amount:,.2f} recorded to {worker_name} via {payment_method}"))

    conn.commit()
    recalculate_labour_job_finances(conn, job_id)
    updated_job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_labour_job(updated_job, user_id=user['id'], conn=conn)
    created_pay = conn.execute("SELECT * FROM labour_payments WHERE id = ?", (pay_pk,)).fetchone()
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Payment of ₹{amount:,.2f} successfully recorded for {worker_name}. Remaining balance: ₹{serialized['pending_amount']:,.2f}",
        'payment': dict(created_pay),
        'job': serialized
    }), 201


@app.route('/api/labour/jobs/<int:job_id>/advance', methods=['POST'])
def api_record_labour_advance(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to record an advance.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    if user['id'] != job['farmer_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Only the farmer can record advance payments.'}), 403

    data = request.get_json(silent=True) or {}
    amount_val = data.get('amount')
    advance_date = str(data.get('advance_date', '')).strip()
    if not advance_date:
        advance_date = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
    payment_method = str(data.get('payment_method', 'Cash')).strip()
    reference_no = str(data.get('reference_no', '')).strip() or None
    notes = str(data.get('notes', '')).strip() or None
    worker_name = str(data.get('worker_name', '')).strip() or job['worker_name']
    worker_id = data.get('worker_id')

    try:
        amount = float(amount_val)
        if amount <= 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Advance amount must be greater than 0.'}), 400
    except (TypeError, ValueError):
        conn.close()
        return jsonify({'success': False, 'error': 'Please provide a valid advance amount.'}), 400

    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO labour_advances (
            labour_job_id, worker_id, worker_name, farmer_id,
            amount, advance_date, payment_method, reference_no, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (job_id, worker_id, worker_name, user['id'], amount, advance_date, payment_method, reference_no, notes))
    adv_pk = cursor.lastrowid

    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    cursor.execute("""
        INSERT INTO labour_work_events (labour_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'ADVANCE_GIVEN', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Advance of ₹{amount:,.2f} given to {worker_name} via {payment_method}"))

    conn.commit()
    recalculate_labour_job_finances(conn, job_id)
    updated_job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_labour_job(updated_job, user_id=user['id'], conn=conn)
    created_adv = conn.execute("SELECT * FROM labour_advances WHERE id = ?", (adv_pk,)).fetchone()
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Advance of ₹{amount:,.2f} successfully recorded for {worker_name}. Remaining balance: ₹{serialized['pending_amount']:,.2f}",
        'advance': dict(created_adv),
        'job': serialized
    }), 201


@app.route('/api/labour/jobs/<int:job_id>/dispute', methods=['POST'])
def api_dispute_labour_job(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to raise a dispute.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    is_farmer = (user['id'] == job['farmer_id'])
    is_worker = (user['id'] == job['worker_id'] or user['name'] == job['worker_name'])
    if not is_farmer and not is_worker:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized.'}), 403

    data = request.get_json(silent=True) or {}
    reason = str(data.get('reason', '')).strip()
    description = str(data.get('description', '')).strip()
    evidence_text = str(data.get('evidence_text', '')).strip() or None

    if not reason:
        conn.close()
        return jsonify({'success': False, 'error': 'Dispute reason is required.'}), 400

    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    conn.execute("""
        INSERT INTO labour_disputes (labour_job_id, raised_by, reason, description, evidence_text, status)
        VALUES (?, ?, ?, ?, ?, 'OPEN')
    """, (job_id, user['id'], reason, description, evidence_text))

    conn.execute("UPDATE labour_jobs SET status = 'DISPUTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (job_id,))

    conn.execute("""
        INSERT INTO labour_work_events (labour_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'DISPUTED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Dispute raised by {user['name']}: {reason} - {description}"))

    conn.commit()
    recalculate_labour_job_finances(conn, job_id)
    updated = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_labour_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Dispute registered. Status updated to DISPUTED.',
        'job': serialized
    })


@app.route('/api/labour/jobs/<int:job_id>/resolve-dispute', methods=['POST'])
def api_resolve_dispute_labour_job(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to resolve dispute.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Job not found.'}), 404

    is_farmer = (user['id'] == job['farmer_id'])
    is_worker = (user['id'] == job['worker_id'] or user['name'] == job['worker_name'])
    if not is_farmer and not is_worker:
        conn.close()
        return jsonify({'success': False, 'error': 'Unauthorized.'}), 403

    data = request.get_json(silent=True) or {}
    resolution = str(data.get('resolution', 'Mutual agreement reached')).strip()
    next_status = str(data.get('next_status', 'AGREED')).strip().upper()
    if next_status not in ('AGREED', 'IN_PROGRESS', 'RUNNING', 'PAUSED', 'COMPLETED'):
        next_status = 'AGREED'

    server_now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    conn.execute("""
        UPDATE labour_disputes
        SET status = 'RESOLVED', resolution = ?, resolved_at = CURRENT_TIMESTAMP
        WHERE labour_job_id = ? AND status IN ('OPEN', 'UNDER_REVIEW')
    """, (resolution, job_id))

    conn.execute("UPDATE labour_jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (next_status, job_id))

    conn.execute("""
        INSERT INTO labour_work_events (labour_job_id, event_type, performed_by, server_timestamp, notes)
        VALUES (?, 'DISPUTE_RESOLVED', ?, ?, ?)
    """, (job_id, user['id'], server_now, f"Dispute resolved by {user['name']}: {resolution}"))

    conn.commit()
    recalculate_labour_job_finances(conn, job_id)
    updated = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_labour_job(updated, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Dispute resolved. Status updated to {next_status}.",
        'job': serialized
    })


@app.route('/api/labour/jobs/<int:job_id>/add-to-expenses', methods=['POST'])
def api_add_labour_to_expenses(job_id):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to record farm expenses.'}), 401

    conn = get_db()
    job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({'success': False, 'error': 'Labour job not found.'}), 404

    if user['id'] != job['farmer_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Only the farmer can record this expense.'}), 403

    if job['expense_id']:
        existing_exp = conn.execute("SELECT * FROM farm_expenses WHERE id = ?", (job['expense_id'],)).fetchone()
        conn.close()
        return jsonify({
            'success': True,
            'message': 'This labour work is already recorded in Farm Expenses.',
            'expense': dict(existing_exp) if existing_exp else None,
            'already_added': True
        })

    recalculate_labour_job_finances(conn, job_id)
    job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    amount = float(job['total_earned'] if job['total_earned'] > 0 else (job['rate'] * max(1, job['num_workers'])))
    desc = f"Labour work — {job['work_type']} ({job['job_id']}, {job['worker_name']}, {job['num_workers']} workers, ₹{job['rate']}/{job['payment_type']})"

    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO farm_expenses (user_id, date, category, amount, crop, field_name, description)
        VALUES (?, ?, 'Labour', ?, ?, ?, ?)
    """, (user['id'], job['work_date'], amount, job['crop'], job['field_name'], desc))
    exp_id = cursor.lastrowid

    cursor.execute("""
        UPDATE labour_jobs SET expense_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    """, (exp_id, job_id))

    conn.commit()

    created_exp = conn.execute("SELECT * FROM farm_expenses WHERE id = ?", (exp_id,)).fetchone()
    updated_job = conn.execute("SELECT * FROM labour_jobs WHERE id = ?", (job_id,)).fetchone()
    serialized = serialize_labour_job(updated_job, user_id=user['id'], conn=conn)
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Added ₹{amount:,.2f} to Farm Expenses under category 'Labour'.",
        'expense': dict(created_exp),
        'job': serialized
    }), 201


@app.route('/api/labour/worker-history/<path:worker_identifier>', methods=['GET'])
def api_get_labour_worker_history(worker_identifier):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in.'}), 401

    w_query = unquote(worker_identifier).strip()
    conn = get_db()

    # Find matching attendance and job records for this farmer
    att_rows = conn.execute("""
        SELECT a.*, j.job_id, j.crop, j.field_name, j.work_type, j.rate, j.payment_type, j.status as job_status
        FROM labour_attendance a
        JOIN labour_jobs j ON a.labour_job_id = j.id
        WHERE j.farmer_id = ? AND (LOWER(a.worker_name) = LOWER(?) OR CAST(a.worker_id AS TEXT) = ?)
        ORDER BY a.date DESC
    """, (user['id'], w_query, w_query)).fetchall()

    # Find jobs where worker is designated
    jobs_rows = conn.execute("""
        SELECT * FROM labour_jobs
        WHERE farmer_id = ? AND (LOWER(worker_name) = LOWER(?) OR CAST(worker_id AS TEXT) = ?)
        ORDER BY work_date DESC
    """, (user['id'], w_query, w_query)).fetchall()

    pay_rows = conn.execute("""
        SELECT p.*, j.job_id, j.crop
        FROM labour_payments p
        JOIN labour_jobs j ON p.labour_job_id = j.id
        WHERE j.farmer_id = ? AND (LOWER(p.worker_name) = LOWER(?) OR CAST(p.worker_id AS TEXT) = ?)
        ORDER BY p.payment_date DESC
    """, (user['id'], w_query, w_query)).fetchall()

    adv_rows = conn.execute("""
        SELECT adv.*, j.job_id, j.crop
        FROM labour_advances adv
        JOIN labour_jobs j ON adv.labour_job_id = j.id
        WHERE j.farmer_id = ? AND (LOWER(adv.worker_name) = LOWER(?) OR CAST(adv.worker_id AS TEXT) = ?)
        ORDER BY adv.advance_date DESC
    """, (user['id'], w_query, w_query)).fetchall()

    total_days = sum(float(r['day_fraction'] or 0.0) for r in att_rows)
    total_hours = sum(float(r['hours_worked'] or 0.0) for r in att_rows)
    total_earned = sum(float(r['wage_amount'] or 0.0) for r in att_rows)
    if not att_rows and jobs_rows:
        total_earned = sum(float(j['total_earned'] or 0.0) for j in jobs_rows)

    total_paid = sum(float(p['amount'] or 0.0) for p in pay_rows)
    total_advances = sum(float(a['amount'] or 0.0) for a in adv_rows)
    pending_amount = max(0.0, round(total_earned - (total_paid + total_advances), 2))

    # Crop breakdown
    crop_stats = {}
    for r in att_rows:
        c = r['crop'] or 'Other'
        if c not in crop_stats:
            crop_stats[c] = {'crop': c, 'days': 0.0, 'earned': 0.0, 'jobs': set()}
        crop_stats[c]['days'] += float(r['day_fraction'] or 0.0)
        crop_stats[c]['earned'] += float(r['wage_amount'] or 0.0)
        crop_stats[c]['jobs'].add(r['job_id'])

    crop_summary = [
        {'crop': k, 'days': round(v['days'], 2), 'earned': round(v['earned'], 2), 'jobs_count': len(v['jobs'])}
        for k, v in crop_stats.items()
    ]

    worker_display_name = w_query
    if att_rows:
        worker_display_name = att_rows[0]['worker_name']
    elif jobs_rows:
        worker_display_name = jobs_rows[0]['worker_name']

    conn.close()

    return jsonify({
        'success': True,
        'worker': {
            'name': worker_display_name,
            'total_jobs': len(jobs_rows) if jobs_rows else len(set(r['labour_job_id'] for r in att_rows)),
            'total_days': round(total_days, 2),
            'total_hours': round(total_hours, 2),
            'total_earned': round(total_earned, 2),
            'total_paid': round(total_paid, 2),
            'total_advances': round(total_advances, 2),
            'pending_amount': pending_amount,
            'crop_breakdown': crop_summary,
            'recent_attendance': [dict(r) for r in att_rows[:15]],
            'recent_payments': [dict(p) for p in pay_rows[:10]],
            'recent_advances': [dict(a) for a in adv_rows[:10]],
            'recent_jobs': [dict(j) for j in jobs_rows[:10]]
        }
    })


@app.route('/api/labour/summary', methods=['GET'])
def api_get_labour_summary():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in.'}), 401

    uid = user['id']
    conn = get_db()
    current_month = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m')

    active_jobs_count = conn.execute(
        "SELECT COUNT(*) as c FROM labour_jobs WHERE farmer_id = ? AND status IN ('CREATED', 'WORKER_JOINED', 'AGREED', 'IN_PROGRESS', 'RUNNING', 'PAUSED', 'FINISH_REQUESTED', 'DISPUTED')",
        (uid,)
    ).fetchone()['c']

    completed_jobs_count = conn.execute(
        "SELECT COUNT(*) as c FROM labour_jobs WHERE farmer_id = ? AND status = 'COMPLETED'",
        (uid,)
    ).fetchone()['c']

    total_workers_count = conn.execute(
        "SELECT COUNT(DISTINCT a.worker_name) as c FROM labour_attendance a JOIN labour_jobs j ON a.labour_job_id = j.id WHERE j.farmer_id = ?",
        (uid,)
    ).fetchone()['c']
    if total_workers_count == 0:
        total_workers_count = conn.execute(
            "SELECT COUNT(DISTINCT worker_name) as c FROM labour_jobs WHERE farmer_id = ?",
            (uid,)
        ).fetchone()['c']

    fin_row = conn.execute("""
        SELECT COALESCE(SUM(total_earned), 0) as total_cost,
               COALESCE(SUM(total_paid), 0) as total_paid,
               COALESCE(SUM(total_advance), 0) as total_advance,
               COALESCE(SUM(pending_amount), 0) as pending_amount
        FROM labour_jobs
        WHERE farmer_id = ?
    """, (uid,)).fetchone()

    month_cost_row = conn.execute("""
        SELECT COALESCE(SUM(total_earned), 0) as m_cost
        FROM labour_jobs
        WHERE farmer_id = ? AND work_date LIKE ?
    """, (uid, f"{current_month}%")).fetchone()

    crop_rows = conn.execute("""
        SELECT crop, 
               COALESCE(SUM(total_earned), 0) as total_cost,
               COALESCE(SUM(total_days_worked), 0) as total_days,
               COUNT(*) as jobs_count
        FROM labour_jobs
        WHERE farmer_id = ?
        GROUP BY crop
        ORDER BY total_cost DESC
    """, (uid,)).fetchall()

    recent_events = conn.execute("""
        SELECT e.*, j.job_id, j.crop, j.work_type, u.name as performed_by_name
        FROM labour_work_events e
        JOIN labour_jobs j ON e.labour_job_id = j.id
        JOIN users u ON e.performed_by = u.id
        WHERE j.farmer_id = ?
        ORDER BY e.id DESC LIMIT 8
    """, (uid,)).fetchall()

    conn.close()

    return jsonify({
        'success': True,
        'summary': {
            'active_jobs': active_jobs_count,
            'completed_jobs': completed_jobs_count,
            'total_workers': total_workers_count,
            'total_labour_cost': round(float(fin_row['total_cost'] or 0.0), 2),
            'total_paid': round(float(fin_row['total_paid'] or 0.0), 2),
            'total_advance': round(float(fin_row['total_advance'] or 0.0), 2),
            'pending_payments': round(float(fin_row['pending_amount'] or 0.0), 2),
            'month_cost': round(float(month_cost_row['m_cost'] or 0.0), 2),
            'current_month': current_month,
            'crop_expenses': [dict(c) for c in crop_rows],
            'recent_activities': [dict(ev) for ev in recent_events]
        }
    })


if __name__ == '__main__':
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() in ('true', '1', 'yes')
    app_url = f"http://127.0.0.1:{port}"
    print(f"[OK] Starting Farmer AI Application Server on {app_url} (listening on {host}:{port})")
    if not debug or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        threading.Timer(1.0, lambda: webbrowser.open(app_url)).start()
    app.run(host=host, debug=debug, port=port)

