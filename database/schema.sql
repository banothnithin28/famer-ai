-- Schema for Farmer AI Application

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT 'Telangana',
    language TEXT NOT NULL DEFAULT 'en',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
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

CREATE TABLE IF NOT EXISTS plants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    crop_name TEXT NOT NULL,
    field_name TEXT NOT NULL,
    location TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS disease_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plant_id INTEGER,
    image_name TEXT NOT NULL,
    disease_name TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    severity TEXT NOT NULL DEFAULT 'Unknown',
    symptoms TEXT,
    suggestions_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(plant_id) REFERENCES plants(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plant_id INTEGER,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(plant_id) REFERENCES plants(id) ON DELETE SET NULL
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

CREATE TABLE IF NOT EXISTS password_reset_otps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    verification_attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    is_used INTEGER NOT NULL DEFAULT 0,
    used_at TIMESTAMP,
    reset_token_hash TEXT,
    reset_token_expires_at TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_user ON password_reset_otps(user_id, is_used);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email ON password_reset_otps(email, is_used);

CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_token_hash TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER NOT NULL DEFAULT 1,
    revoked_at TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_lookup ON user_sessions(session_token_hash, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, is_active);

-- Farm Diary & Activity Entries
CREATE TABLE IF NOT EXISTS farm_diary_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    crop TEXT,
    field_name TEXT,
    activity_type TEXT NOT NULL,
    description TEXT,
    notes TEXT,
    photo_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_farm_diary_user_date ON farm_diary_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_farm_diary_user_crop ON farm_diary_entries(user_id, crop);
CREATE INDEX IF NOT EXISTS idx_farm_diary_user_act ON farm_diary_entries(user_id, activity_type);

-- Farm Expenses
CREATE TABLE IF NOT EXISTS farm_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    crop TEXT,
    field_name TEXT,
    description TEXT,
    receipt_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_farm_expenses_user_date ON farm_expenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_farm_expenses_user_cat ON farm_expenses(user_id, category);
CREATE INDEX IF NOT EXISTS idx_farm_expenses_user_crop ON farm_expenses(user_id, crop);

-- Farm Income
CREATE TABLE IF NOT EXISTS farm_income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    crop TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'kg',
    selling_price REAL NOT NULL,
    total_amount REAL NOT NULL,
    buyer_name TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_farm_income_user_date ON farm_income(user_id, date);
CREATE INDEX IF NOT EXISTS idx_farm_income_user_crop ON farm_income(user_id, crop);

-- ==============================================================================
-- PHASE 2: TRACTOR WORK TRACKER
-- ==============================================================================

CREATE TABLE IF NOT EXISTS tractor_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT UNIQUE NOT NULL,
    join_token TEXT UNIQUE NOT NULL,
    farmer_id INTEGER NOT NULL,
    driver_id INTEGER,
    driver_name TEXT,
    driver_phone TEXT,
    tractor_number TEXT,
    crop TEXT NOT NULL,
    field_name TEXT NOT NULL,
    work_type TEXT NOT NULL,
    work_date TEXT NOT NULL,
    field_size REAL DEFAULT 0.0,
    rate REAL NOT NULL,
    rate_unit TEXT NOT NULL DEFAULT 'per_hour',
    status TEXT NOT NULL DEFAULT 'CREATED',
    total_working_seconds INTEGER NOT NULL DEFAULT 0,
    calculated_amount REAL NOT NULL DEFAULT 0.0,
    final_amount REAL NOT NULL DEFAULT 0.0,
    expense_id INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(farmer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(driver_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(expense_id) REFERENCES farm_expenses(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tractor_jobs_job_id ON tractor_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_tractor_jobs_join_token ON tractor_jobs(join_token);
CREATE INDEX IF NOT EXISTS idx_tractor_jobs_farmer ON tractor_jobs(farmer_id, status);
CREATE INDEX IF NOT EXISTS idx_tractor_jobs_driver ON tractor_jobs(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_tractor_jobs_date ON tractor_jobs(work_date);

CREATE TABLE IF NOT EXISTS tractor_work_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tractor_job_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    performed_by INTEGER NOT NULL,
    server_timestamp TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tractor_job_id) REFERENCES tractor_jobs(id) ON DELETE CASCADE,
    FOREIGN KEY(performed_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tractor_events_job ON tractor_work_events(tractor_job_id, id);
CREATE INDEX IF NOT EXISTS idx_tractor_events_type ON tractor_work_events(event_type);

CREATE TABLE IF NOT EXISTS tractor_disputes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tractor_job_id INTEGER NOT NULL,
    raised_by INTEGER NOT NULL,
    reason TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN',
    resolution TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    FOREIGN KEY(tractor_job_id) REFERENCES tractor_jobs(id) ON DELETE CASCADE,
    FOREIGN KEY(raised_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tractor_disputes_job ON tractor_disputes(tractor_job_id, status);

