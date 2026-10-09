import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_code = '''
from dotenv import load_dotenv
load_dotenv("/etc/trikonekt/staging-backend.env")
import os, sys
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
sys.path.insert(0, "/srv/trikonekt/staging/backend")
import django
django.setup()

import psycopg2
from django.contrib.auth.hashers import make_password

conn = psycopg2.connect(os.environ["DATABASE_URL"])
conn.autocommit = True
cur = conn.cursor()

# 1. Create dedicated admin portal users table
cur.execute("""
CREATE TABLE IF NOT EXISTS accounts_admin_portal_user (
    id SERIAL PRIMARY KEY,
    username VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) DEFAULT '',
    email VARCHAR(254) DEFAULT '',
    phone VARCHAR(32) DEFAULT '',
    role VARCHAR(50) DEFAULT 'super_admin',
    is_superuser BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
""")
print("Created/Ensured accounts_admin_portal_user table.")

# 2. Insert or update the 4 admins
admins = [
    {"username": "admin", "password": "Tri@2026", "full_name": "Trikonekt SuperAdmin", "email": "admin@trikonekt.in", "phone": "9999999990"},
    {"username": "rayaru", "password": "Tri@2026", "full_name": "Rayaru", "email": "rayaru@trikonekt.in", "phone": "9900000001"},
    {"username": "xavier", "password": "Tri@2026", "full_name": "Xavier", "email": "xavierprakashkumar@gmail.com", "phone": "9900000002"},
    {"username": "leela", "password": "Tri@2026", "full_name": "Leela", "email": "leela@trikonekt.in", "phone": "9900000003"},
]

for a in admins:
    hashed_pw = make_password(a["password"])
    cur.execute("""
    INSERT INTO accounts_admin_portal_user (username, password_hash, full_name, email, phone, role, is_superuser, is_active)
    VALUES (%s, %s, %s, %s, %s, 'super_admin', TRUE, TRUE)
    ON CONFLICT (username) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        role = 'super_admin',
        is_superuser = TRUE,
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP;
    """, [a["username"], hashed_pw, a["full_name"], a["email"], a["phone"]])

cur.execute("SELECT id, username, full_name, email, role, is_superuser, is_active FROM accounts_admin_portal_user;")
print("Current Dedicated Admin Users:")
for r in cur.fetchall():
    print(r)
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/create_admin_table.py\n{remote_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/create_admin_table.py"]
res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)
