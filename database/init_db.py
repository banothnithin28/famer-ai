import os
import sqlite3
from werkzeug.security import generate_password_hash
from dotenv import load_dotenv

load_dotenv()

def init_db():
    db_path = os.getenv('DB_PATH', os.path.join(os.path.dirname(__file__), 'farmer.db'))
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

    # Check and add plant_id column to disease_scans if missing
    cursor.execute("PRAGMA table_info(disease_scans)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'plant_id' not in columns:
        cursor.execute("ALTER TABLE disease_scans ADD COLUMN plant_id INTEGER REFERENCES plants(id) ON DELETE SET NULL")
        print("[OK] Migrated disease_scans table with plant_id column")

    # Seed initial real plants for demo user if none exist
    cursor.execute("SELECT COUNT(*) FROM plants WHERE user_id = ?", (user_id,))
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO plants (user_id, crop_name, field_name, location, notes, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-5 days'))",
            (user_id, "Tomato", "Tomato Field #01", "Telangana - Block A", "Drip irrigated, healthy canopy.")
        )
        plant_1_id = cursor.lastrowid

        cursor.execute(
            "INSERT INTO plants (user_id, crop_name, field_name, location, notes, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-10 days'))",
            (user_id, "Paddy / Rice", "Paddy Field #02", "Telangana - East Basin", "Tillering stage, regular irrigation.")
        )
        plant_2_id = cursor.lastrowid

        # Add corresponding real scan records for these plants
        cursor.execute(
            "INSERT INTO disease_scans (user_id, plant_id, image_name, disease_name, confidence, suggestions_json, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-2 hours'))",
            (user_id, plant_1_id, "tomato_leaf_01.jpg", "Healthy Leaf", 94, '["Maintain routine organic care", "Continue optimal soil moisture"]', )
        )

        cursor.execute(
            "INSERT INTO disease_scans (user_id, plant_id, image_name, disease_name, confidence, suggestions_json, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))",
            (user_id, plant_2_id, "rice_leaf_blast.jpg", "Rice Leaf Blast", 71, '["Apply Tricyclazole 75% WP @ 0.6g/L", "Avoid excess nitrogen fertilizer"]', )
        )
        print("[OK] Seeded initial real database plants (Tomato Field #01 & Paddy Field #02)")

    conn.commit()
    conn.close()
    print(f"[OK] SQLite Database initialized at {db_path}")

if __name__ == '__main__':
    init_db()

