import os
import json
import pickle
import re
import secrets
import sqlite3
import threading
import time
import warnings
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import webbrowser
import numpy as np
from PIL import Image
from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash, send_from_directory
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
        'location': {'latitude': latitude, 'longitude': longitude, 'timezone': payload.get('timezone')},
        'source': 'Open-Meteo',
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
_GEMINI_MODEL   = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash')
_FARMING_SYSTEM_PROMPT = """You are Farmer AI Assistant, a calm and practical agricultural helper for farmers.

Rules:
1. Answer the exact question in simple, practical language. Use short sentences and short lists.
2. Treat scan results as possible AI predictions, never confirmed diagnoses.
3. Never interpret model confidence as disease severity. Say confidence changed, not that disease became worse.
4. Use only the supplied context. If a value is unavailable, say it is unavailable.
5. Do not invent weather, soil moisture, disease details, dates, or pesticide doses.
6. Give general care guidance. For serious crop loss or uncertain cases, recommend a local agricultural expert.
7. For chemical advice, avoid exact doses unless the farmer supplies a verified product label and crop context.
8. Keep normal answers to 2-5 sentences unless a list is needed.

LANGUAGE RULES:
- If the user writes in Telugu → reply ONLY in Telugu.
- If the user writes in Hindi → reply ONLY in Hindi.
- Otherwise → reply in English.

KNOWN INDIAN FERTILIZER PRICES (approximate, as of 2025):
- Urea (45 kg bag): ₹266.50 (government subsidized MRP). Per kg ≈ ₹5.9.
- DAP (Diammonium Phosphate, 50 kg): ₹1,350 (subsidized). Per kg ≈ ₹27.
- MOP (Muriate of Potash, 50 kg): ₹1,700 (approx). Per kg ≈ ₹34.
- NPK 10:26:26 (50 kg): ₹1,470 (approx).
- SSP (Single Super Phosphate, 50 kg): ₹400–₹450 (approx).
- Neem-coated Urea (45 kg): ₹266.50 (same as urea, mandatory coating).
"""
if _GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=_GEMINI_API_KEY)
    print(f"[OK] Gemini AI chatbot initialized ({_GEMINI_MODEL})")
else:
    gemini_client = None
    print("[WARN] GEMINI_API_KEY not set — chatbot will use fallback mode")

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

# Session User Helper
def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    conn = get_db()
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
        email = request.form.get('email')
        password = request.form.get('password')

        conn = get_db()
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        conn.close()

        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['user_name'] = user['name']
            session['user_lang'] = user['language']
            flash(f"Welcome back, {user['name']}!", "success")
            return redirect(url_for('dashboard'))
        else:
            flash("Invalid email or password. Try demo: ramesh@farmer.ai / password123", "error")

    return render_template('login.html')

@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        new_password = request.form.get('new_password', '')
        confirm_password = request.form.get('confirm_password', '')

        if not email or not new_password or not confirm_password:
            flash("Please fill in all fields.", "error")
            return render_template('forgot_password.html', email=email)

        if len(new_password) < 6:
            flash("Password must be at least 6 characters long.", "error")
            return render_template('forgot_password.html', email=email)

        if new_password != confirm_password:
            flash("Passwords do not match. Please verify and try again.", "error")
            return render_template('forgot_password.html', email=email)

        conn = get_db()
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

        if not user:
            conn.close()
            flash("No farmer account found with that email address. Please check your email or register.", "error")
            return render_template('forgot_password.html', email=email)

        new_hash = generate_password_hash(new_password)
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user['id']))
        conn.commit()
        conn.close()

        flash("Password updated successfully! You can now log in with your new password.", "success")
        return redirect(url_for('login'))

    return render_template('forgot_password.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        password = request.form.get('password')
        location = request.form.get('location', 'Telangana')
        language = request.form.get('language', 'en')

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
                (user_id, 5.0, "Black", "Cotton")
            )
            conn.commit()
            session['user_id'] = user_id
            session['user_name'] = name
            session['user_lang'] = language
            flash("Registration successful! Welcome to Farmer AI.", "success")
            return redirect(url_for('dashboard'))
        except sqlite3.IntegrityError:
            flash("Email already registered. Please login.", "error")
        finally:
            conn.close()

    return render_template('register.html')

@app.route('/logout')
def logout():
    session.clear()
    flash("You have logged out safely.", "info")
    return redirect(url_for('index'))

@app.route('/dashboard')
def dashboard():
    user = get_current_user()
    if not user:
        return redirect(url_for('login'))

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
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'success': False, 'error': 'Email and password are required.'}), 400

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if user and check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id']
        session['user_name'] = user['name']
        session['user_lang'] = user['language']
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
        return jsonify({'success': False, 'error': 'Invalid email or password. Try demo: ramesh@farmer.ai / password123'}), 401

@app.route('/api/auth/register', methods=['POST'])
def api_auth_register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    location = data.get('location', 'Telangana')
    language = data.get('language', 'en')
    farm_size = float(data.get('farm_size_acres', 5.0) or 5.0)
    soil_type = data.get('soil_type', 'Black')
    primary_crop = data.get('primary_crop', 'Cotton')

    if not name or not email or not password:
        return jsonify({'success': False, 'error': 'Name, email, and password are required.'}), 400

    if len(password) < 6:
        return jsonify({'success': False, 'error': 'Password must be at least 6 characters long.'}), 400

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

@app.route('/api/auth/forgot-password', methods=['POST'])
def api_auth_forgot_password():
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    new_password = data.get('new_password', '')
    confirm_password = data.get('confirm_password', '')

    if not email or not new_password or not confirm_password:
        return jsonify({'success': False, 'error': 'All fields are required.'}), 400

    if len(new_password) < 6:
        return jsonify({'success': False, 'error': 'Password must be at least 6 characters long.'}), 400

    if new_password != confirm_password:
        return jsonify({'success': False, 'error': 'Passwords do not match.'}), 400

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    if not user:
        conn.close()
        return jsonify({'success': False, 'error': 'No farmer account found with that email address.'}), 404

    new_hash = generate_password_hash(new_password)
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user['id']))
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Password reset successful! You can now log in with your new password.'
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
    session.clear()
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


# 3. Smart Irrigation Advisor API
@app.route('/api/weather', methods=['GET'])
def api_weather():
    try:
        latitude = float(request.args.get('latitude', ''))
        longitude = float(request.args.get('longitude', ''))
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': 'Valid latitude and longitude are required.'}), 400
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        return jsonify({'success': False, 'error': 'Latitude or longitude is outside the valid range.'}), 400

    try:
        return jsonify({'success': True, **fetch_live_weather(latitude, longitude)})
    except Exception:
        app.logger.warning('Live weather request failed')
        return jsonify({'success': False, 'error': 'Weather information is temporarily unavailable.'}), 503


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
def fallback_farmer_reply(message):
    message_lower = message.lower()
    if message_lower in ('hi', 'hello', 'hey'):
        return 'Namaste! How can I help with your crop today?'
    if 'water' in message_lower or 'irrigation' in message_lower:
        return 'Check the latest rain forecast and your soil before watering. If rain is expected soon, extra irrigation may not be needed.'
    if 'disease' in message_lower or 'blight' in message_lower or 'fungus' in message_lower:
        return 'A scan can show a possible disease, but it is not a confirmed diagnosis. Remove badly affected leaves, monitor new growth, and consult a local agricultural expert if symptoms spread.'
    if any(term in message_lower for term in ('pest', 'insect', 'worm', 'caterpillar', 'aphid', 'whitefly', 'thrip', 'mite', 'borer')):
        return 'For pest control, inspect the underside of leaves, remove heavily affected plant parts, and use neem-based treatment according to the product label. Avoid spraying during flowering when pollinators are active, and consult your local agricultural expert before using chemical pesticides.'
    if any(term in message_lower for term in ('fertilizer', 'urea', 'dap', 'mop', 'npk', 'nutrient', 'manure', 'compost')):
        return 'Use a soil test before choosing fertilizer. Apply well-decomposed organic manure during field preparation, and split nitrogen applications rather than applying all urea at once. Follow the crop-specific dose on the label or from your local KVK.'
    if any(term in message_lower for term in ('suggest', 'recommend', 'which crop', 'what crop', 'grow', 'sow', 'cultivate')):
        return 'Crop choice depends on your soil, season, water availability, and local market. A soil test and advice from your nearest KVK can identify the best crop and variety for your field.'
    if any(term in message_lower for term in ('price', 'mandi', 'market', 'sell', 'profit', 'rate', 'income')):
        return 'Compare current prices at nearby mandis and e-NAM before selling. Keep harvested produce clean and dry, and ask your local Farmer Producer Organization about collective selling options.'
    return 'I can help with watering, crop diseases, pests, fertilizer, crop selection, and market planning. Please include your crop, location, symptoms, and recent weather for more specific advice.'


def build_farmer_context(user, plant_id, latitude, longitude):
    context = {'plant': None, 'scans': [], 'weather': None}
    if plant_id and user:
        conn = get_db()
        plant = conn.execute(
            "SELECT id, crop_name, field_name, location, notes, created_at FROM plants WHERE id = ? AND user_id = ?",
            (plant_id, user['id'])
        ).fetchone()
        if plant:
            scans = conn.execute(
                "SELECT id, disease_name, confidence, severity, symptoms, created_at FROM disease_scans WHERE plant_id = ? AND user_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 5",
                (plant_id, user['id'])
            ).fetchall()
            context['plant'] = dict(plant)
            context['scans'] = [dict(scan) for scan in scans]
        conn.close()

    if latitude is not None and longitude is not None:
        try:
            context['weather'] = fetch_live_weather(float(latitude), float(longitude))
        except (TypeError, ValueError, Exception):
            context['weather'] = None
    return context


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
    language_names = {'en': 'English', 'te': 'simple Telugu', 'hi': 'simple Hindi', 'ta': 'simple Tamil'}
    selected_language = language_names.get(language, 'English')
    context_prompt = (
        f"Farmer question:\n{message}\n\n"
        f"Reply in {selected_language}.\n\n"
        f"Verified context (say unavailable when absent; do not infer missing values):\n"
        f"{json.dumps(context, ensure_ascii=False, default=str)}"
    )

    if gemini_client:
        try:
            response = gemini_client.models.generate_content(
                model=_GEMINI_MODEL,
                contents=context_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=_FARMING_SYSTEM_PROMPT,
                    max_output_tokens=512,
                    temperature=0.4,
                )
            )
            reply = (response.text or '').strip()
            if reply:
                return jsonify({'success': True, 'reply': reply, 'powered_by': 'gemini'})
        except Exception:
            app.logger.warning('Gemini API request failed')

    return jsonify({'success': True, 'reply': fallback_farmer_reply(message), 'powered_by': 'fallback'})


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
