import os
import sqlite3
from werkzeug.security import generate_password_hash

def init_db():
    db_path = os.path.join(os.path.dirname(__file__), 'farmer.db')
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    with open(schema_path, 'r') as f:
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
        print("🌱 Created demo farmer user: ramesh@farmer.ai / password123 (Telangana - Telugu)")

    conn.commit()
    conn.close()
    print(f"✅ SQLite Database initialized at {db_path}")

if __name__ == '__main__':
    init_db()
