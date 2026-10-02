import os
import sqlite3
from werkzeug.security import generate_password_hash
from dotenv import load_dotenv

load_dotenv()

def init_db(db_path=None):
    db_path = db_path or os.getenv('DB_PATH', os.path.join(os.path.dirname(__file__), 'farmer.db'))
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')

    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    with open(schema_path, 'r', encoding='utf-8') as f:
        cursor.executescript(f.read())

    # Insert default demo user if not exists
    cursor.execute("SELECT id FROM users WHERE email = ?", ("ramesh@farmer.ai",))
    user = cursor.fetchone()
    if not user:
        pwd_hash = generate_password_hash("password123")
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, location, language) VALUES (?, ?, ?, ?, ?)",
            ("Ramesh", "ramesh@farmer.ai", pwd_hash, "Telangana", "te")
        )
        user_id = cursor.lastrowid
        cursor.execute(
            "INSERT INTO farmer_profiles (user_id, farm_size_acres, soil_type, primary_crop) VALUES (?, ?, ?, ?)",
            (user_id, 8.5, "Black", "Cotton")
        )
        print("[OK] Created demo farmer user: ramesh@farmer.ai / password123 (Telangana - Telugu)")
    else:
        user_id = user[0]

    # Check and add last_login_at column to users if missing
    cursor.execute("PRAGMA table_info(users)")
    user_columns = [col[1] for col in cursor.fetchall()]
    if 'last_login_at' not in user_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP")
        print("[OK] Migrated users table with last_login_at column")

    # Check and add plant_id column to disease_scans if missing
    cursor.execute("PRAGMA table_info(disease_scans)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'plant_id' not in columns:
        cursor.execute("ALTER TABLE disease_scans ADD COLUMN plant_id INTEGER REFERENCES plants(id) ON DELETE SET NULL")
        print("[OK] Migrated disease_scans table with plant_id column")

    disease_scan_columns = [col[1] for col in cursor.execute("PRAGMA table_info(disease_scans)").fetchall()]
    if 'severity' not in disease_scan_columns:
        cursor.execute("ALTER TABLE disease_scans ADD COLUMN severity TEXT NOT NULL DEFAULT 'Unknown'")
    if 'symptoms' not in disease_scan_columns:
        cursor.execute("ALTER TABLE disease_scans ADD COLUMN symptoms TEXT")

    # Check and add bill scanning columns to farm_expenses if missing
    cursor.execute("PRAGMA table_info(farm_expenses)")
    expense_columns = [col[1] for col in cursor.fetchall()]
    if 'bill_number' not in expense_columns:
        cursor.execute("ALTER TABLE farm_expenses ADD COLUMN bill_number TEXT")
    if 'vendor_name' not in expense_columns:
        cursor.execute("ALTER TABLE farm_expenses ADD COLUMN vendor_name TEXT")
    if 'vendor_phone' not in expense_columns:
        cursor.execute("ALTER TABLE farm_expenses ADD COLUMN vendor_phone TEXT")
    if 'vendor_address' not in expense_columns:
        cursor.execute("ALTER TABLE farm_expenses ADD COLUMN vendor_address TEXT")
    if 'receipt_source' not in expense_columns:
        cursor.execute("ALTER TABLE farm_expenses ADD COLUMN receipt_source TEXT DEFAULT 'MANUAL'")
    if 'raw_extracted_json' not in expense_columns:
        cursor.execute("ALTER TABLE farm_expenses ADD COLUMN raw_extracted_json TEXT")
    if 'tax' not in expense_columns:
        cursor.execute("ALTER TABLE farm_expenses ADD COLUMN tax REAL DEFAULT 0.0")
    if 'discount' not in expense_columns:
        cursor.execute("ALTER TABLE farm_expenses ADD COLUMN discount REAL DEFAULT 0.0")
    if 'payment_method' not in expense_columns:
        cursor.execute("ALTER TABLE farm_expenses ADD COLUMN payment_method TEXT")
    if 'scanned_at' not in expense_columns:
        cursor.execute("ALTER TABLE farm_expenses ADD COLUMN scanned_at TIMESTAMP")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_farm_expenses_user_bill ON farm_expenses(user_id, bill_number)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_farm_expenses_user_source ON farm_expenses(user_id, receipt_source)")
    print("[OK] Migrated farm_expenses table with bill scanning columns and indexes")

    conn.commit()
    conn.close()
    print(f"[OK] SQLite Database initialized at {db_path}")

if __name__ == '__main__':
    init_db()

