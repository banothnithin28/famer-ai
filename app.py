import os
import json
import pickle
import sqlite3
import numpy as np
from PIL import Image
from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'fallback_dev_secret_change_in_production')

# Configure Gemini (new google-genai SDK)
_GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
_GEMINI_MODEL   = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash')
_FARMING_SYSTEM_PROMPT = """You are Kisan AI, a precise and helpful agricultural assistant for Indian farmers.

CRITICAL RULES — follow these strictly:
1. ALWAYS answer the EXACT question asked. If the farmer asks for a price or cost, give the ACTUAL price/cost — do not redirect to general advice.
2. For fertilizer prices (urea, DAP, MOP, etc.) give the current government MRP or market rate in Indian Rupees (₹) per bag (50 kg) and per kg.
3. For pesticide, seed, or input costs — give realistic Indian market prices.
4. Keep answers SHORT and DIRECT — 2 to 4 sentences maximum unless a list is needed.
5. Never give generic "best practices" when a specific fact (price, dose, timing) is asked.
6. If you don't know the exact current price, give the approximate range and say it may vary by state or season.

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
if _GOOGLE_API_KEY:
    gemini_client = genai.Client(api_key=_GOOGLE_API_KEY)
    print(f"[OK] Gemini AI chatbot initialized ({_GEMINI_MODEL})")
else:
    gemini_client = None
    print("[WARN] GOOGLE_API_KEY not set — chatbot will use fallback mode")

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    return response

# Configuration (values loaded from .env)
UPLOAD_FOLDER = os.path.join(app.root_path, os.getenv('UPLOAD_FOLDER', 'static/uploads'))
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
DB_PATH = os.path.join(app.root_path, os.getenv('DB_PATH', 'database/farmer.db'))

# ML Models paths (values loaded from .env)
CROP_MODEL_PATH = os.path.join(app.root_path, os.getenv('CROP_MODEL_PATH', 'models/crop_model.pkl'))
DISEASE_MODEL_PATH = os.path.join(app.root_path, os.getenv('DISEASE_MODEL_PATH', 'models/disease_model.pkl'))

# Global variables for loaded models
crop_model_data = None
disease_model_data = None

def load_ml_models():
    global crop_model_data, disease_model_data
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
        "SELECT AVG(confidence) as avg_c FROM disease_scans WHERE user_id = ?" if user_id else "SELECT AVG(confidence) as avg_c FROM disease_scans"
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

            # Dynamic health status and score based on authentic database scan
            if 'Healthy' in disease_name:
                status = "Healthy"
                health_score = max(conf, 92)
            elif conf < 60:
                status = "Uncertain / Re-scan"
                health_score = conf
            elif any(crit in disease_name for crit in ['Late Blight', 'Blast']):
                status = "Needs Attention"
                health_score = 71 if 'Blast' in disease_name else 65
            else:
                status = "Needs Attention"
                health_score = 78

            p_dict['latest_scan_date'] = scan_date_str
            p_dict['latest_disease_result'] = disease_name
            p_dict['latest_confidence'] = conf
            p_dict['status'] = status
            p_dict['health_score'] = health_score
        else:
            p_dict['latest_scan_date'] = None
            p_dict['latest_disease_result'] = "Pending Initial Scan"
            p_dict['latest_confidence'] = None
            p_dict['status'] = "Pending Scan"
            p_dict['health_score'] = None

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
    user_id = user['id'] if user else 1

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
            'health_score': None,
            'latest_disease_result': 'Pending Initial Scan',
            'latest_confidence': None,
            'latest_scan_date': None
        }
    }), 201


@app.route('/api/plants/<int:plant_id>', methods=['DELETE'])
def api_delete_plant(plant_id):
    conn = get_db()
    conn.execute("DELETE FROM plants WHERE id = ?", (plant_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': f'Plant record #{plant_id} deleted successfully.'})


@app.route('/api/plants/<int:plant_id>', methods=['GET'])
def api_get_plant_details(plant_id):
    conn = get_db()
    plant = conn.execute("SELECT * FROM plants WHERE id = ?", (plant_id,)).fetchone()
    if not plant:
        conn.close()
        return jsonify({'success': False, 'error': 'Plant not found.'}), 404

    scans = conn.execute(
        "SELECT * FROM disease_scans WHERE plant_id = ? ORDER BY datetime(created_at) ASC, id ASC",
        (plant_id,)
    ).fetchall()
    conn.close()

    def health_score(scan):
        disease = (scan['disease_name'] or '').lower()
        severity = (scan['severity'] or '').lower()
        if 'healthy' in disease:
            return 100
        if 'critical' in severity:
            return 30
        if 'severe' in severity or 'high' in severity:
            return 45
        if 'moderate' in severity:
            return 65
        if 'uncertain' in disease or 'unknown' in severity:
            return min(int(scan['confidence'] or 0), 59)
        return 75

    history = []
    for scan in scans:
        item = dict(scan)
        item['health_score'] = health_score(scan)
        item['image_url'] = url_for('send_upload', filename=scan['image_name'])
        item['symptoms'] = scan['symptoms'] or ''
        history.append(item)

    current = history[-1] if history else None
    previous = history[-2] if len(history) > 1 else None
    declining = bool(current and previous and current['health_score'] < previous['health_score'])
    new_disease = bool(
        current and 'healthy' not in current['disease_name'].lower() and
        (not previous or 'healthy' in previous['disease_name'].lower() or
         previous['disease_name'] != current['disease_name'])
    )

    return jsonify({
        'success': True,
        'plant': dict(plant),
        'history': history,
        'current_health': current,
        'previous_health': previous,
        'change_over_time': current['health_score'] - previous['health_score'] if current and previous else 0,
        'alerts': {'declining': declining, 'new_disease': new_disease}
    })


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

    if 'leaf_image' not in request.files:
        return jsonify({
            'success': False, 
            'error': 'Please upload an actual leaf photo file. Demo presets have been removed to ensure genuine ML diagnosis.'
        }), 400

    file = request.files['leaf_image']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'Selected leaf image file is empty'}), 400

    filename = secure_filename(file.filename)
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
        return jsonify({'success': False, 'error': f"Image decoding failed: {str(e)}"}), 400

    user_id = session.get('user_id')
    plant_id = request.form.get('plant_id')
    try:
        plant_id = int(plant_id) if plant_id else None
    except Exception:
        plant_id = None
    uid = user_id or 1

    # Inference using disease_model.pkl
    try:
        if not disease_model_data:
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
            conn.execute(
                "INSERT INTO disease_scans (user_id, plant_id, image_name, disease_name, confidence, severity, symptoms, suggestions_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (uid, plant_id, filename, 'Uncertain', confidence, 'Unknown', '', json.dumps([]))
            )
            conn.commit()
            conn.close()
            return jsonify({
                'success': True,
                'reliable': False,
                'low_confidence': True,
                'confidence': confidence,
                'warning': '⚠️ Low confidence',
                'message': 'Please upload a clearer image.',
                'recommended_action': 'Please upload a clearer image.'
            })

        disease_key = le.inverse_transform([pred_idx])[0]
        diag_info = kb.get(disease_key, list(kb.values())[0])

        conn = get_db()
        conn.execute(
            "INSERT INTO disease_scans (user_id, plant_id, image_name, disease_name, confidence, severity, symptoms, suggestions_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (uid, plant_id, filename, diag_info.get('disease', disease_key), confidence,
             diag_info.get('severity', diag_info.get('risk', 'Unknown')),
             diag_info.get('symptoms', ''), json.dumps(diag_info.get('suggestions', [])))
        )
        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'reliable': True,
            'detected': diag_info.get('detected', disease_key),
            'disease': diag_info.get('disease', disease_key),
            'crop': diag_info.get('crop', 'Crop'),
            'confidence': confidence,
            'risk': diag_info.get('risk', 'High'),
            'severity': diag_info.get('severity', 'Moderate'),
            'recommended_action': diag_info.get('recommended_action', 'Remove affected leaves and apply the recommended treatment.'),
            'symptoms': diag_info.get('symptoms', ''),
            'suggestions': diag_info.get('suggestions', []),
            'organic_remedy': diag_info.get('organicRemedy', ''),
            'chemical_remedy': diag_info.get('chemicalRemedy', ''),
            'prevention': diag_info.get('prevention', [])
        })
    except Exception as e:
        return jsonify({'success': False, 'error': f"Disease diagnostic engine error: {str(e)}"}), 500


# 3. Smart Irrigation Advisor API
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
@app.route('/api/chat', methods=['POST'])
def api_chat():
    data = request.get_json() or {}
    msg  = data.get('message', '').strip()
    lang = data.get('language', 'en')

    if not msg:
        return jsonify({'success': False, 'error': 'Message cannot be empty.'}), 400

    # ── Gemini path ──────────────────────────────────────────────────────────
    if gemini_client:
        try:
            lang_hint = ''
            if lang == 'te':
                lang_hint = ' (Please reply in Telugu / తెలుగులో సమాధానం ఇవ్వండి)'
            elif lang == 'hi':
                lang_hint = ' (Please reply in Hindi / हिंदी में उत्तर दें)'

            response = gemini_client.models.generate_content(
                model=_GEMINI_MODEL,
                contents=msg + lang_hint,
                config=types.GenerateContentConfig(
                    system_instruction=_FARMING_SYSTEM_PROMPT,
                    max_output_tokens=512,
                    temperature=0.7,
                )
            )
            reply = response.text.strip()
            return jsonify({'success': True, 'reply': reply, 'powered_by': 'gemini'})
        except Exception as e:
            print(f"[WARN] Gemini API error: {e}")

    # ── Rule-based fallback (when Gemini unavailable) ─────────────────────
    msg_lower = msg.lower()
    if 'bollworm' in msg_lower or 'pest' in msg_lower or 'cotton' in msg_lower:
        reply = "For cotton bollworm control: 1) Install pheromone traps (5/acre). 2) Spray Neem seed kernel extract (5%). 3) If severe, use Profenofos @ 2ml/L water."
    elif 'fertilizer' in msg_lower or 'paddy' in msg_lower or 'rice' in msg_lower:
        reply = "Recommended NPK ratio for paddy is 120:60:60 kg/ha. Apply 50% Nitrogen during land preparation, 25% at tillering, and 25% at panicle initiation."
    elif 'blight' in msg_lower or 'disease' in msg_lower or 'fungus' in msg_lower:
        reply = "To manage fungal blight: Remove infected leaves immediately, ensure adequate aeration between rows, and spray Copper Oxychloride (2.5 g/L)."
    elif 'water' in msg_lower or 'irrigation' in msg_lower or 'drought' in msg_lower:
        reply = "Adopt drip irrigation to save up to 40% water. Apply organic mulch around crop root zones to retain soil moisture in dry weather."
    else:
        reply = f"Thank you for your question. For optimal growth in your region, ensure balanced soil organic carbon, regular soil testing, and timely pest monitoring."

    if lang == 'te':
        if 'bollworm' in msg_lower or 'cotton' in msg_lower:
            reply = "పత్తిలో పురుగుల నివారణకు: 1) లింగమార్పిడి బుట్టలు (ఎకరానికి 5) ఏర్పాటు చేయండి. 2) వేపనూనె (5ml/L) పిచికారీ చేయండి."
        elif 'paddy' in msg_lower or 'rice' in msg_lower:
            reply = "వరిలో ఎరువుల వాడకం: NPK నిష్పత్తి 120:60:60 కేజీలు/హెక్టారుకు వర్తింపజేయండి."

    return jsonify({'success': True, 'reply': reply, 'powered_by': 'fallback'})


if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() in ('true', '1', 'yes')
    print(f"[OK] Starting Farmer AI Application Server on http://127.0.0.1:{port}")
    app.run(debug=debug, port=port)
