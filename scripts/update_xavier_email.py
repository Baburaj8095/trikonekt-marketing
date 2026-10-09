import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_code = '''
from dotenv import load_dotenv
load_dotenv("/etc/trikonekt/staging-backend.env")
import psycopg2, os
conn = psycopg2.connect(os.environ["DATABASE_URL"])
conn.autocommit = True
cur = conn.cursor()

cur.execute("""
UPDATE accounts_customuser
SET email = 'xavierprakashkumar@gmail.com'
WHERE username = 'xavier';
""")

cur.execute("SELECT id, username, full_name, email, role, is_staff, is_superuser FROM accounts_customuser WHERE username = 'xavier';")
print("Updated user:", cur.fetchone())
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/update_xavier_email.py\n{remote_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/update_xavier_email.py"]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)
