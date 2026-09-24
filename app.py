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
        return jsonify({'success': False, 'error': 'Please sign in to view plant photos.'}), 401

    conn = get_db()
    scan = conn.execute(
        "SELECT id FROM disease_scans WHERE user_id = ? AND image_name = ? LIMIT 1",
        (user['id'], filename)
    ).fetchone()
    conn.close()
    if not scan:
        return jsonify({'success': False, 'error': 'Photo not found.'}), 404
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

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



if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() in ('true', '1', 'yes')
    app_url = f"http://127.0.0.1:{port}"
    print(f"[OK] Starting Farmer AI Application Server on {app_url}")
    if not debug or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        threading.Timer(1.0, lambda: webbrowser.open(app_url)).start()
    app.run(debug=debug, port=port)
