-- Farmer AI initial PostgreSQL schema for Supabase staging.
-- Generated from database.models metadata; schema only, no data is copied.
-- Review this file before applying it to any database.

-- Table: users
CREATE TABLE users (
	id BIGSERIAL NOT NULL, 
	name TEXT NOT NULL, 
	email TEXT NOT NULL, 
	password_hash TEXT NOT NULL, 
	location TEXT DEFAULT 'Telangana' NOT NULL, 
	language TEXT DEFAULT 'en' NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	last_login_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (email)
);

-- Table: crop_recommendations
CREATE TABLE crop_recommendations (
	id BIGSERIAL NOT NULL, 
	user_id BIGINT NOT NULL, 
	soil_type TEXT NOT NULL, 
	season TEXT NOT NULL, 
	water_availability TEXT NOT NULL, 
	previous_crop TEXT NOT NULL, 
	location TEXT NOT NULL, 
	recommended_crop TEXT NOT NULL, 
	confidence INTEGER NOT NULL, 
	reason TEXT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Table: decision_scores
CREATE TABLE decision_scores (
	id BIGSERIAL NOT NULL, 
	user_id BIGINT NOT NULL, 
	crop_name TEXT NOT NULL, 
	overall_score INTEGER NOT NULL, 
	soil_score INTEGER NOT NULL, 
	weather_score INTEGER NOT NULL, 
	water_score INTEGER NOT NULL, 
	crop_score INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Table: farm_diary_entries
CREATE TABLE farm_diary_entries (
	id BIGSERIAL NOT NULL, 
	user_id BIGINT NOT NULL, 
	date TEXT NOT NULL, 
	crop TEXT, 
	field_name TEXT, 
	activity_type TEXT NOT NULL, 
	description TEXT, 
	notes TEXT, 
	photo_path TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Table: farm_expenses
CREATE TABLE farm_expenses (
	id BIGSERIAL NOT NULL, 
	user_id BIGINT NOT NULL, 
	date TEXT NOT NULL, 
	category TEXT NOT NULL, 
	amount DOUBLE PRECISION NOT NULL, 
	crop TEXT, 
	field_name TEXT, 
	description TEXT, 
	receipt_path TEXT, 
	bill_number TEXT, 
	vendor_name TEXT, 
	vendor_phone TEXT, 
	vendor_address TEXT, 
	receipt_source TEXT DEFAULT 'MANUAL', 
	raw_extracted_json TEXT, 
	tax DOUBLE PRECISION DEFAULT 0.0, 
	discount DOUBLE PRECISION DEFAULT 0.0, 
	payment_method TEXT, 
	scanned_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Table: farm_income
CREATE TABLE farm_income (
	id BIGSERIAL NOT NULL, 
	user_id BIGINT NOT NULL, 
	date TEXT NOT NULL, 
	crop TEXT NOT NULL, 
	quantity DOUBLE PRECISION NOT NULL, 
	unit TEXT DEFAULT 'kg' NOT NULL, 
	selling_price DOUBLE PRECISION NOT NULL, 
	total_amount DOUBLE PRECISION NOT NULL, 
	buyer_name TEXT, 
	notes TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Table: farmer_profiles
CREATE TABLE farmer_profiles (
	user_id BIGINT NOT NULL, 
	farm_size_acres DOUBLE PRECISION DEFAULT 5.0, 
	soil_type TEXT DEFAULT 'Black', 
	primary_crop TEXT DEFAULT 'Cotton', 
	PRIMARY KEY (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Table: irrigation_logs
CREATE TABLE irrigation_logs (
	id BIGSERIAL NOT NULL, 
	user_id BIGINT NOT NULL, 
	crop_type TEXT NOT NULL, 
	moisture_pct INTEGER NOT NULL, 
	weather_condition TEXT NOT NULL, 
	water_req TEXT NOT NULL, 
	suggestion TEXT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Table: password_reset_otps
CREATE TABLE password_reset_otps (
	id BIGSERIAL NOT NULL, 
	user_id BIGINT NOT NULL, 
	email TEXT NOT NULL, 
	otp_hash TEXT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	verification_attempts INTEGER DEFAULT 0 NOT NULL, 
	max_attempts INTEGER DEFAULT 5 NOT NULL, 
	is_used INTEGER DEFAULT 0 NOT NULL, 
	used_at TIMESTAMP WITHOUT TIME ZONE, 
	reset_token_hash TEXT, 
	reset_token_expires_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Table: plants
CREATE TABLE plants (
	id BIGSERIAL NOT NULL, 
	user_id BIGINT NOT NULL, 
	crop_name TEXT NOT NULL, 
	field_name TEXT NOT NULL, 
	location TEXT NOT NULL, 
	notes TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Table: user_sessions
CREATE TABLE user_sessions (
	id BIGSERIAL NOT NULL, 
	user_id BIGINT NOT NULL, 
	session_token_hash TEXT NOT NULL, 
	ip_address TEXT, 
	user_agent TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	last_activity_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	is_active INTEGER DEFAULT 1 NOT NULL, 
	revoked_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	UNIQUE (session_token_hash)
);

-- Table: alerts
CREATE TABLE alerts (
	id BIGSERIAL NOT NULL, 
	user_id BIGINT NOT NULL, 
	plant_id BIGINT, 
	status TEXT NOT NULL, 
	message TEXT NOT NULL, 
	read INTEGER DEFAULT 0 NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE SET NULL
);

-- Table: disease_scans
CREATE TABLE disease_scans (
	id BIGSERIAL NOT NULL, 
	user_id BIGINT NOT NULL, 
	plant_id BIGINT, 
	image_name TEXT NOT NULL, 
	disease_name TEXT NOT NULL, 
	confidence INTEGER NOT NULL, 
	severity TEXT DEFAULT 'Unknown' NOT NULL, 
	symptoms TEXT, 
	suggestions_json TEXT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE SET NULL
);

-- Table: labour_jobs
CREATE TABLE labour_jobs (
	id BIGSERIAL NOT NULL, 
	job_id TEXT NOT NULL, 
	join_token TEXT NOT NULL, 
	farmer_id BIGINT NOT NULL, 
	worker_id BIGINT, 
	worker_name TEXT NOT NULL, 
	worker_phone TEXT, 
	work_type TEXT NOT NULL, 
	crop TEXT NOT NULL, 
	field_name TEXT NOT NULL, 
	work_date TEXT NOT NULL, 
	expected_start_date TEXT, 
	expected_end_date TEXT, 
	payment_type TEXT DEFAULT 'per_day' NOT NULL, 
	rate DOUBLE PRECISION NOT NULL, 
	num_workers INTEGER DEFAULT 1 NOT NULL, 
	status TEXT DEFAULT 'CREATED' NOT NULL, 
	farmer_agreed INTEGER DEFAULT 0 NOT NULL, 
	worker_agreed INTEGER DEFAULT 0 NOT NULL, 
	farmer_confirmed INTEGER DEFAULT 0 NOT NULL, 
	worker_confirmed INTEGER DEFAULT 0 NOT NULL, 
	total_working_seconds BIGINT DEFAULT 0 NOT NULL, 
	total_days_worked DOUBLE PRECISION DEFAULT 0.0 NOT NULL, 
	total_earned DOUBLE PRECISION DEFAULT 0.0 NOT NULL, 
	total_paid DOUBLE PRECISION DEFAULT 0.0 NOT NULL, 
	total_advance DOUBLE PRECISION DEFAULT 0.0 NOT NULL, 
	pending_amount DOUBLE PRECISION DEFAULT 0.0 NOT NULL, 
	expense_id BIGINT, 
	notes TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	UNIQUE (job_id), 
	UNIQUE (join_token), 
	FOREIGN KEY(farmer_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(worker_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(expense_id) REFERENCES farm_expenses (id) ON DELETE SET NULL
);

-- Table: tractor_jobs
CREATE TABLE tractor_jobs (
	id BIGSERIAL NOT NULL, 
	job_id TEXT NOT NULL, 
	join_token TEXT NOT NULL, 
	farmer_id BIGINT NOT NULL, 
	driver_id BIGINT, 
	driver_name TEXT, 
	driver_phone TEXT, 
	tractor_number TEXT, 
	crop TEXT NOT NULL, 
	field_name TEXT NOT NULL, 
	work_type TEXT NOT NULL, 
	work_date TEXT NOT NULL, 
	field_size DOUBLE PRECISION DEFAULT 0.0, 
	rate DOUBLE PRECISION NOT NULL, 
	rate_unit TEXT DEFAULT 'per_hour' NOT NULL, 
	status TEXT DEFAULT 'CREATED' NOT NULL, 
	total_working_seconds BIGINT DEFAULT 0 NOT NULL, 
	calculated_amount DOUBLE PRECISION DEFAULT 0.0 NOT NULL, 
	final_amount DOUBLE PRECISION DEFAULT 0.0 NOT NULL, 
	expense_id BIGINT, 
	notes TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	UNIQUE (job_id), 
	UNIQUE (join_token), 
	FOREIGN KEY(farmer_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(driver_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(expense_id) REFERENCES farm_expenses (id) ON DELETE SET NULL
);

-- Table: labour_agreements
CREATE TABLE labour_agreements (
	id BIGSERIAL NOT NULL, 
	labour_job_id BIGINT NOT NULL, 
	farmer_id BIGINT NOT NULL, 
	worker_id BIGINT, 
	terms_summary TEXT NOT NULL, 
	farmer_agreed_at TIMESTAMP WITHOUT TIME ZONE, 
	worker_agreed_at TIMESTAMP WITHOUT TIME ZONE, 
	status TEXT DEFAULT 'PENDING' NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(labour_job_id) REFERENCES labour_jobs (id) ON DELETE CASCADE, 
	FOREIGN KEY(farmer_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(worker_id) REFERENCES users (id) ON DELETE SET NULL
);

-- Table: labour_disputes
CREATE TABLE labour_disputes (
	id BIGSERIAL NOT NULL, 
	labour_job_id BIGINT NOT NULL, 
	raised_by BIGINT NOT NULL, 
	reason TEXT NOT NULL, 
	description TEXT, 
	evidence_text TEXT, 
	status TEXT DEFAULT 'OPEN' NOT NULL, 
	resolution TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	resolved_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(labour_job_id) REFERENCES labour_jobs (id) ON DELETE CASCADE, 
	FOREIGN KEY(raised_by) REFERENCES users (id) ON DELETE CASCADE
);

-- Table: labour_work_events
CREATE TABLE labour_work_events (
	id BIGSERIAL NOT NULL, 
	labour_job_id BIGINT NOT NULL, 
	event_type TEXT NOT NULL, 
	performed_by BIGINT NOT NULL, 
	server_timestamp TEXT NOT NULL, 
	notes TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(labour_job_id) REFERENCES labour_jobs (id) ON DELETE CASCADE, 
	FOREIGN KEY(performed_by) REFERENCES users (id) ON DELETE CASCADE
);

-- Table: labour_work_sessions
CREATE TABLE labour_work_sessions (
	id BIGSERIAL NOT NULL, 
	labour_job_id BIGINT NOT NULL, 
	session_type TEXT DEFAULT 'HOURLY_WORK' NOT NULL, 
	start_time TEXT NOT NULL, 
	end_time TEXT, 
	duration_seconds BIGINT DEFAULT 0, 
	status TEXT DEFAULT 'RUNNING' NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(labour_job_id) REFERENCES labour_jobs (id) ON DELETE CASCADE
);

-- Table: labour_workers
CREATE TABLE labour_workers (
	id BIGSERIAL NOT NULL, 
	labour_job_id BIGINT NOT NULL, 
	user_id BIGINT, 
	name TEXT NOT NULL, 
	phone TEXT, 
	role TEXT DEFAULT 'worker', 
	total_days DOUBLE PRECISION DEFAULT 0.0, 
	total_hours DOUBLE PRECISION DEFAULT 0.0, 
	total_earned DOUBLE PRECISION DEFAULT 0.0, 
	total_paid DOUBLE PRECISION DEFAULT 0.0, 
	total_advance DOUBLE PRECISION DEFAULT 0.0, 
	pending_amount DOUBLE PRECISION DEFAULT 0.0, 
	status TEXT DEFAULT 'ACTIVE', 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(labour_job_id) REFERENCES labour_jobs (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- Table: tractor_disputes
CREATE TABLE tractor_disputes (
	id BIGSERIAL NOT NULL, 
	tractor_job_id BIGINT NOT NULL, 
	raised_by BIGINT NOT NULL, 
	reason TEXT NOT NULL, 
	description TEXT, 
	status TEXT DEFAULT 'OPEN' NOT NULL, 
	resolution TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	resolved_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(tractor_job_id) REFERENCES tractor_jobs (id) ON DELETE CASCADE, 
	FOREIGN KEY(raised_by) REFERENCES users (id) ON DELETE CASCADE
);

-- Table: tractor_work_events
CREATE TABLE tractor_work_events (
	id BIGSERIAL NOT NULL, 
	tractor_job_id BIGINT NOT NULL, 
	event_type TEXT NOT NULL, 
	performed_by BIGINT NOT NULL, 
	server_timestamp TEXT NOT NULL, 
	notes TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(tractor_job_id) REFERENCES tractor_jobs (id) ON DELETE CASCADE, 
	FOREIGN KEY(performed_by) REFERENCES users (id) ON DELETE CASCADE
);

-- Table: labour_advances
CREATE TABLE labour_advances (
	id BIGSERIAL NOT NULL, 
	labour_job_id BIGINT NOT NULL, 
	worker_id BIGINT, 
	worker_name TEXT NOT NULL, 
	farmer_id BIGINT NOT NULL, 
	amount DOUBLE PRECISION NOT NULL, 
	advance_date TEXT NOT NULL, 
	payment_method TEXT DEFAULT 'Cash' NOT NULL, 
	reference_no TEXT, 
	notes TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(labour_job_id) REFERENCES labour_jobs (id) ON DELETE CASCADE, 
	FOREIGN KEY(worker_id) REFERENCES labour_workers (id) ON DELETE SET NULL, 
	FOREIGN KEY(farmer_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Table: labour_attendance
CREATE TABLE labour_attendance (
	id BIGSERIAL NOT NULL, 
	labour_job_id BIGINT NOT NULL, 
	worker_id BIGINT, 
	worker_name TEXT NOT NULL, 
	date TEXT NOT NULL, 
	status TEXT NOT NULL, 
	day_fraction DOUBLE PRECISION DEFAULT 1.0 NOT NULL, 
	hours_worked DOUBLE PRECISION DEFAULT 0.0, 
	rate_applied DOUBLE PRECISION NOT NULL, 
	wage_amount DOUBLE PRECISION NOT NULL, 
	notes TEXT, 
	created_by BIGINT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(labour_job_id) REFERENCES labour_jobs (id) ON DELETE CASCADE, 
	FOREIGN KEY(worker_id) REFERENCES labour_workers (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE CASCADE
);

-- Table: labour_breaks
CREATE TABLE labour_breaks (
	id BIGSERIAL NOT NULL, 
	labour_job_id BIGINT NOT NULL, 
	session_id BIGINT, 
	start_time TEXT NOT NULL, 
	end_time TEXT, 
	duration_seconds BIGINT DEFAULT 0, 
	reason TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(labour_job_id) REFERENCES labour_jobs (id) ON DELETE CASCADE, 
	FOREIGN KEY(session_id) REFERENCES labour_work_sessions (id) ON DELETE CASCADE
);

-- Table: labour_payments
CREATE TABLE labour_payments (
	id BIGSERIAL NOT NULL, 
	labour_job_id BIGINT NOT NULL, 
	worker_id BIGINT, 
	worker_name TEXT NOT NULL, 
	farmer_id BIGINT NOT NULL, 
	amount DOUBLE PRECISION NOT NULL, 
	payment_date TEXT NOT NULL, 
	payment_method TEXT DEFAULT 'Cash' NOT NULL, 
	reference_no TEXT, 
	notes TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(labour_job_id) REFERENCES labour_jobs (id) ON DELETE CASCADE, 
	FOREIGN KEY(worker_id) REFERENCES labour_workers (id) ON DELETE SET NULL, 
	FOREIGN KEY(farmer_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_farm_diary_user_act ON farm_diary_entries (user_id, activity_type);
CREATE INDEX idx_farm_diary_user_crop ON farm_diary_entries (user_id, crop);
CREATE INDEX idx_farm_diary_user_date ON farm_diary_entries (user_id, date);
CREATE INDEX idx_farm_expenses_user_bill ON farm_expenses (user_id, bill_number);
CREATE INDEX idx_farm_expenses_user_cat ON farm_expenses (user_id, category);
CREATE INDEX idx_farm_expenses_user_crop ON farm_expenses (user_id, crop);
CREATE INDEX idx_farm_expenses_user_date ON farm_expenses (user_id, date);
CREATE INDEX idx_farm_expenses_user_source ON farm_expenses (user_id, receipt_source);
CREATE INDEX idx_farm_income_user_crop ON farm_income (user_id, crop);
CREATE INDEX idx_farm_income_user_date ON farm_income (user_id, date);
CREATE INDEX idx_password_reset_otps_email ON password_reset_otps (email, is_used);
CREATE INDEX idx_password_reset_otps_user ON password_reset_otps (user_id, is_used);
CREATE INDEX idx_user_sessions_lookup ON user_sessions (session_token_hash, is_active);
CREATE INDEX idx_user_sessions_user ON user_sessions (user_id, is_active);
CREATE INDEX idx_labour_jobs_date ON labour_jobs (work_date);
CREATE INDEX idx_labour_jobs_farmer ON labour_jobs (farmer_id, status);
CREATE INDEX idx_labour_jobs_job_id ON labour_jobs (job_id);
CREATE INDEX idx_labour_jobs_join_token ON labour_jobs (join_token);
CREATE INDEX idx_labour_jobs_worker ON labour_jobs (worker_id, status);
CREATE INDEX idx_tractor_jobs_date ON tractor_jobs (work_date);
CREATE INDEX idx_tractor_jobs_driver ON tractor_jobs (driver_id, status);
CREATE INDEX idx_tractor_jobs_farmer ON tractor_jobs (farmer_id, status);
CREATE INDEX idx_tractor_jobs_job_id ON tractor_jobs (job_id);
CREATE INDEX idx_tractor_jobs_join_token ON tractor_jobs (join_token);
CREATE INDEX idx_labour_agreements_job ON labour_agreements (labour_job_id);
CREATE INDEX idx_labour_disputes_job ON labour_disputes (labour_job_id, status);
CREATE INDEX idx_labour_events_job ON labour_work_events (labour_job_id, id);
CREATE INDEX idx_labour_events_type ON labour_work_events (event_type);
CREATE INDEX idx_labour_workers_job ON labour_workers (labour_job_id);
CREATE INDEX idx_tractor_disputes_job ON tractor_disputes (tractor_job_id, status);
CREATE INDEX idx_tractor_events_job ON tractor_work_events (tractor_job_id, id);
CREATE INDEX idx_tractor_events_type ON tractor_work_events (event_type);
CREATE INDEX idx_labour_advances_farmer ON labour_advances (farmer_id);
CREATE INDEX idx_labour_advances_job ON labour_advances (labour_job_id);
CREATE INDEX idx_labour_attendance_date ON labour_attendance (date);
CREATE UNIQUE INDEX idx_labour_attendance_unique ON labour_attendance (labour_job_id, worker_name, date);
CREATE INDEX idx_labour_payments_farmer ON labour_payments (farmer_id);
CREATE INDEX idx_labour_payments_job ON labour_payments (labour_job_id);
