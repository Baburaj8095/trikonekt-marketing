import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_code = '''
from dotenv import load_dotenv
load_dotenv("/etc/trikonekt/staging-backend.env")
import psycopg2, os
conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()
cur.execute("SELECT id, username, role, category, is_staff, is_superuser, identity_type FROM accounts_customuser WHERE username IN ('rayaru', 'xavier', 'leela', 'admin');")
for row in cur.fetchall():
    print(row)
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/check_cat.py\n{remote_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/check_cat.py"]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)
