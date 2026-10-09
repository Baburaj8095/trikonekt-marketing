import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_code = '''
from dotenv import load_dotenv
load_dotenv("/etc/trikonekt/staging-backend.env")
import psycopg2, os
conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()

# 1. Check all users in staging with account_active=True or is_staff=True or role='admin'
cur.execute("""
SELECT id, username, phone, role, category, is_staff, is_superuser, account_active
FROM accounts_customuser
WHERE account_active = TRUE OR is_staff = TRUE OR role = 'admin' OR category = 'staff';
""")
print("All Active / Staff / Admin users in staging:")
for r in cur.fetchall():
    print(r)
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/check_active_users.py\n{remote_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/check_active_users.py"]
res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)
