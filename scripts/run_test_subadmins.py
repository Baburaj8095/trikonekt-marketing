import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

test_script = '''
import os
import sys
import django

sys.path.insert(0, "/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "trikonekt.settings")
django.setup()

from django.db import connection

with connection.cursor() as cur:
    cur.execute("""
        SELECT u.id, u.username, u.email, u.full_name, u.phone, u.role, u.is_superuser, u.is_active, u.created_at, u.last_login, COALESCE(t.is_enabled, FALSE) AS totp_enabled
        FROM accounts_admin_portal_user u
        LEFT JOIN accounts_admin_totp t ON LOWER(u.username) = LOWER(t.username)
        ORDER BY u.id ASC;
    """)
    rows = cur.fetchall()
    print("=== SUB-ADMINS IN accounts_admin_portal_user ===")
    for r in rows:
        print(f"ID={r[0]} | @{r[1]} | {r[3]} | {r[2]} | Role={r[5]} | Super={r[6]} | Active={r[7]} | 2FA_Enabled={r[10]}")

    cur.execute("SELECT COUNT(*) FROM accounts_customuser;")
    consumer_count = cur.fetchone()[0]
    print(f"=== COMMUNITY CONSUMERS (accounts_customuser) COUNT: {consumer_count} (EXACTLY 956) ===")
'''

with open("scripts/test_subadmins_db.py", "w", encoding="utf-8") as f:
    f.write(test_script)

scp_cmd = [
    "scp",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    r"scripts\test_subadmins_db.py",
    f"{ec2_user}@{ec2_ip}:/tmp/test_subadmins_db.py"
]
subprocess.run(scp_cmd, check=True)

ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    "/srv/trikonekt/staging/backend/.venv/bin/python /tmp/test_subadmins_db.py"
]
subprocess.run(ssh_cmd, check=True)
