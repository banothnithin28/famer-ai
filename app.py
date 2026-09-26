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
from urllib.parse import urlencode
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

# Load environment variables from .env file
load_dotenv()

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


def fetch_live_weather(latitude, longitude):
    cache_key = (round(latitude, 3), round(longitude, 3))
    now = time.time()
    with weather_cache_lock:
        cached = weather_cache.get(cache_key)
        if cached and now - cached['cached_at'] < WEATHER_CACHE_TTL_SECONDS:
            return cached['data']

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
    with urlopen(request, timeout=12) as response:
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

# Configure Gemini (new google-genai SDK)
_GEMINI_API_KEY = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
_PRIMARY_GEMINI_MODEL = (os.getenv('GEMINI_MODEL') or 'gemini-3.5-flash-lite').strip()
_CANDIDATE_GEMINI_MODELS = list(dict.fromkeys([
    _PRIMARY_GEMINI_MODEL,
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.5-flash',
]))

_FARMING_SYSTEM_PROMPT = """You are Farmer AI, an agricultural assistant designed to help farmers.

Answer the farmer's actual question directly and clearly.

You can help with:
* crops
* crop selection
* crop diseases
* plant health
* pests
* fertilizers
* urea
* irrigation
* soil
* weather
* farming practices
* government agricultural schemes
* farming knowledge
* agricultural technology
* market information
* farm management

Use simple language that farmers can understand.
If the farmer asks a general question, answer the question directly.
If the farmer asks about fertilizer, explain the fertilizer rather than talking about irrigation.
If the farmer asks about a disease, discuss the disease rather than giving generic weather advice.
If the farmer asks about weather, use the available weather information if provided.
If the farmer asks about current prices, current government schemes, or other time-sensitive information, do not invent values. Explain that current information should be verified from a reliable/current source (e.g. local Mandi, e-NAM, or local Agriculture Department/KVK). If verified reference guidelines below apply, provide them as approximate reference figures.
If the farmer provides crop, location, or symptoms, use those details in the answer.
Do not repeatedly ask the farmer to provide crop, location, symptoms, and weather when those details are not necessary.
Be conversational, respectful, and helpful.
Never answer an unrelated question with a generic irrigation response.

LANGUAGE RULES:
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

if _GEMINI_API_KEY:
    try:
        gemini_client = genai.Client(api_key=_GEMINI_API_KEY)
        print(f"[OK] Gemini AI chatbot initialized (primary: {_PRIMARY_GEMINI_MODEL}, fallbacks: {_CANDIDATE_GEMINI_MODELS})")
    except Exception as _e:
        gemini_client = None
        print(f"[WARN] Failed to initialize Gemini client: {_e}")
else:
    gemini_client = None
    print("[WARN] GEMINI_API_KEY not set — chatbot will report service unavailable")


chat_rate_limit = {}
chat_rate_limit_lock = threading.Lock()
CHAT_RATE_WINDOW_SECONDS = 3600
CHAT_RATE_MAX_REQUESTS = 30

@app.after_request
def add_cors_headers(response):
    request_origin = request.headers.get('Origin', '').rstrip('/')
    if request_origin in app.config['CORS_ALLOWED_ORIGINS']:
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

@app.route('/uploads/<path:filename>')
def send_upload(filename):
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to view uploaded files.'}), 401

    clean_filename = os.path.basename(filename)
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
        try:
            latitude = float(request.args.get('latitude', ''))
            longitude = float(request.args.get('longitude', ''))
        except (TypeError, ValueError):
            return jsonify({
                'success': False,
                'error': 'Please provide a valid region or latitude and longitude.'
            }), 400

        if not -90 <= latitude <= 90:
            return jsonify({
                'success': False,
                'error': 'Latitude is outside the valid range.'
            }), 400

        if not -180 <= longitude <= 180:
            return jsonify({
                'success': False,
                'error': 'Longitude is outside the valid range.'
            }), 400

        weather = fetch_live_weather(latitude, longitude)

        return jsonify({
            'success': True,
            **weather
        })

    except Exception:
        app.logger.exception('Live weather request failed')

        return jsonify({
            'success': False,
            'error': 'Weather information is temporarily unavailable.'
        }), 503


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


# 5. AI Chatbot API (powered by Google Gemini)
def build_farmer_context(user, plant_id, latitude, longitude):
    """
    Gathers helpful farm and farmer context for Gemini without exposing sensitive credentials.
    """
    context = {}
    if user:
        conn = get_db()
        context['farmer_name'] = user['name']
        context['farmer_location'] = user['location']
        profile = conn.execute(
            "SELECT farm_size_acres, soil_type, primary_crop FROM farmer_profiles WHERE user_id = ?",
            (user['id'],)
        ).fetchone()
        if profile:
            if profile['farm_size_acres']:
                context['farm_size_acres'] = profile['farm_size_acres']
            if profile['soil_type']:
                context['soil_type'] = profile['soil_type']
            if profile['primary_crop']:
                context['primary_crop'] = profile['primary_crop']

        user_plants = conn.execute(
            "SELECT crop_name, field_name, location FROM plants WHERE user_id = ? LIMIT 5",
            (user['id'],)
        ).fetchall()
        if user_plants:
            context['registered_crops'] = [dict(p) for p in user_plants]

        if plant_id:
            plant = conn.execute(
                "SELECT id, crop_name, field_name, location, notes FROM plants WHERE id = ? AND user_id = ?",
                (plant_id, user['id'])
            ).fetchone()
            if plant:
                context['selected_plant'] = dict(plant)
                scans = conn.execute(
                    "SELECT disease_name, confidence, severity, symptoms, created_at FROM disease_scans WHERE plant_id = ? AND user_id = ? ORDER BY id DESC LIMIT 3",
                    (plant_id, user['id'])
                ).fetchall()
                if scans:
                    context['recent_scans'] = [dict(s) for s in scans]
        else:
            recent_scan = conn.execute(
                "SELECT disease_name, confidence, severity, symptoms, created_at FROM disease_scans WHERE user_id = ? ORDER BY id DESC LIMIT 1",
                (user['id'],)
            ).fetchone()
            if recent_scan:
                context['latest_disease_scan'] = dict(recent_scan)
        conn.close()

    if latitude is not None and longitude is not None:
        try:
            weather = fetch_live_weather(float(latitude), float(longitude))
            if weather and weather.get('current'):
                curr = weather['current']
                context['live_weather'] = {
                    'temperature': f"{curr.get('temperature')}°C",
                    'humidity': f"{curr.get('humidity')}%",
                    'condition': curr.get('condition'),
                    'rain': f"{curr.get('rain', 0)} mm"
                }
        except Exception:
            pass

    return context


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


def chat_response(data):
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

    context = build_farmer_context(user, plant_id, data.get('latitude'), data.get('longitude'))

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

    if gemini_client:
        contents = format_gemini_contents(data.get('history', []), message)
        gen_config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            max_output_tokens=700,
            temperature=0.4,
        )

        for model_name in _CANDIDATE_GEMINI_MODELS:
            try:
                response = gemini_client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=gen_config,
                )
                text = (response.text or '').strip()
                if text:
                    reply = text
                    return jsonify({'success': True, 'reply': reply, 'powered_by': f'gemini ({model_name})'})
            except Exception as e:
                last_error = str(e)
                app.logger.warning("Gemini generation with %s failed: %s", model_name, str(e))

    # Log backend failure details safely without exposing keys
    if last_error:
        app.logger.error("Gemini failed across all candidate models: %s", last_error)

    # Friendly greeting if offline or failing
    msg_clean = message.lower().strip().rstrip('!?.')
    if msg_clean in ('hi', 'hello', 'hey', 'namaste'):
        return jsonify({
            'success': True,
            'reply': 'Namaste! 🌾 I am Farmer AI. How can I help with your crops, fertilizers, pests, or farming practices today?',
            'powered_by': 'local_greeting'
        })

    # Return honest error instead of fake / unrelated fallback
    return jsonify({
        'success': False,
        'error': 'Farmer AI is temporarily unavailable. Please try again in a few moments.'
    }), 503



@app.route('/api/gemini/chat', methods=['POST'])
def api_gemini_chat():
    return chat_response(request.get_json(silent=True) or {})


@app.route('/api/chat', methods=['POST'])
def api_chat():
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


# 2. Expense Management Endpoints
@app.route('/api/expenses', methods=['GET'])
def api_get_expenses():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'Please sign in to view expenses.'}), 401

    cat_filter = request.args.get('category', '').strip()
    crop_filter = request.args.get('crop', '').strip()
    month_filter = request.args.get('month', '').strip()
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
        query += " AND (LOWER(category) LIKE ? OR LOWER(crop) LIKE ? OR LOWER(field_name) LIKE ? OR LOWER(description) LIKE ?)"
        term = f"%{search.lower()}%"
        params.extend([term, term, term, term])

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
        receipt_path = str(data.get('receipt_path', '')).strip() or None
    else:
        date_val = str(request.form.get('date', '')).strip()
        cat_val = str(request.form.get('category', '')).strip()
        amount_raw = request.form.get('amount')
        crop_val = str(request.form.get('crop', '')).strip()
        field_val = str(request.form.get('field_name', '')).strip()
        desc_val = str(request.form.get('description', '')).strip()
        receipt_path = str(request.form.get('receipt_path', '')).strip() or None

        if 'receipt' in request.files and request.files['receipt'].filename:
            try:
                receipt_path = save_farm_media(request.files['receipt'])
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

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO farm_expenses (user_id, date, category, amount, crop, field_name, description, receipt_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (user['id'], date_val, cat_val, amount_val, crop_val, field_val, desc_val, receipt_path))
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
    else:
        date_val = str(request.form.get('date', existing['date'])).strip()
        cat_val = str(request.form.get('category', existing['category'])).strip()
        amount_raw = request.form.get('amount', existing['amount'])
        crop_val = str(request.form.get('crop', existing['crop'] or '')).strip()
        field_val = str(request.form.get('field_name', existing['field_name'] or '')).strip()
        desc_val = str(request.form.get('description', existing['description'] or '')).strip()
        receipt_path = request.form.get('receipt_path', existing['receipt_path'])

        if 'receipt' in request.files and request.files['receipt'].filename:
            try:
                receipt_path = save_farm_media(request.files['receipt'])
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

    conn.execute("""
        UPDATE farm_expenses
        SET date = ?, category = ?, amount = ?, crop = ?, field_name = ?, description = ?, receipt_path = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
    """, (date_val, cat_val, amount_val, crop_val, field_val, desc_val, receipt_path, expense_id, user['id']))
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


if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() in ('true', '1', 'yes')
    app_url = f"http://127.0.0.1:{port}"
    print(f"[OK] Starting Farmer AI Application Server on {app_url}")
    if not debug or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        threading.Timer(1.0, lambda: webbrowser.open(app_url)).start()
    app.run(debug=debug, port=port)
