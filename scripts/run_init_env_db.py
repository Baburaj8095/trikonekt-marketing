import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_init = '''
import os
import sys

# Load /etc/trikonekt/staging-backend.env
if os.path.exists("/etc/trikonekt/staging-backend.env"):
    with open("/etc/trikonekt/staging-backend.env") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

sys.path.insert(0, "/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from django.db import connection

# Create tables in currently active DB (PostgreSQL / default)
with connection.cursor() as cur:
    cur.execute("""
        CREATE TABLE IF NOT EXISTS accounts_admin_portal_user (
            id SERIAL PRIMARY KEY,
            username VARCHAR(150) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(255) DEFAULT '',
            email VARCHAR(254) DEFAULT '',
            phone VARCHAR(32) DEFAULT '',
            role VARCHAR(64) DEFAULT 'Super Admin',
            is_superuser BOOLEAN DEFAULT TRUE,
            is_active BOOLEAN DEFAULT TRUE,
            last_login TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS accounts_admin_totp (
            id SERIAL PRIMARY KEY,
            username VARCHAR(150) UNIQUE NOT NULL,
            secret_key VARCHAR(64) NOT NULL,
            is_enabled BOOLEAN DEFAULT FALSE,
            backup_codes JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            confirmed_at TIMESTAMPTZ NULL
        );
    """)
    # Also verify accounts
    cur.execute("SELECT id, username, email, full_name, role, is_superuser, is_active FROM accounts_admin_portal_user ORDER BY id;")
    rows = cur.fetchall()
    print("=== ACCOUNTS IN accounts_admin_portal_user ===")
    for r in rows:
        print(r)

print("Environment and DB tables validated successfully!")
'''

with open("scripts/init_env_db.py", "w", encoding="utf-8") as f:
    f.write(remote_init)

scp_cmd = [
    "scp",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    r"scripts\init_env_db.py",
    f"{ec2_user}@{ec2_ip}:/tmp/init_env_db.py"
]
subprocess.run(scp_cmd, check=True)

ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    "sudo -E /srv/trikonekt/staging/backend/.venv/bin/python /tmp/init_env_db.py"
]
subprocess.run(ssh_cmd, check=True)
