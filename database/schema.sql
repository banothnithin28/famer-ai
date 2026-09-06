-- Schema for Farmer AI Application

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT 'Telangana',
    language TEXT NOT NULL DEFAULT 'en',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS farmer_profiles (
    user_id INTEGER PRIMARY KEY,
    farm_size_acres REAL DEFAULT 5.0,
    soil_type TEXT DEFAULT 'Black',
    primary_crop TEXT DEFAULT 'Cotton',
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS crop_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    soil_type TEXT NOT NULL,
    season TEXT NOT NULL,
    water_availability TEXT NOT NULL,
    previous_crop TEXT NOT NULL,
    location TEXT NOT NULL,
    recommended_crop TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS disease_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    image_name TEXT NOT NULL,
    disease_name TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    suggestions_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS irrigation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    crop_type TEXT NOT NULL,
    moisture_pct INTEGER NOT NULL,
    weather_condition TEXT NOT NULL,
    water_req TEXT NOT NULL,
    suggestion TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS decision_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    crop_name TEXT NOT NULL,
    overall_score INTEGER NOT NULL,
    soil_score INTEGER NOT NULL,
    weather_score INTEGER NOT NULL,
    water_score INTEGER NOT NULL,
    crop_score INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
