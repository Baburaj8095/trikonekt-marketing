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

ids = (1041, 1043, 1045)
tables = [
    "business_autopoolaccount",
    "business_userpincodestats",
    "business_usermatrixprogress",
    "business_rankupgrade",
    "business_promopurchase",
    "business_franchiseepurchaserequest",
    "business_ecoupon",
    "accounts_walletaccount",
    "accounts_wallet",
    "accounts_kyc",
    "accounts_userdevice",
    "accounts_admin_totp",
]

for t in tables:
    try:
        cur.execute(f"DELETE FROM {t} WHERE user_id IN %s;", [ids])
    except Exception as e:
        pass
    try:
        cur.execute(f"DELETE FROM {t} WHERE owner_id IN %s;", [ids])
    except Exception as e:
        pass

cur.execute("DELETE FROM accounts_customuser WHERE id IN %s;", [ids])
print("Successfully purged shadow consumer IDs 1041, 1043, 1045.")

cur.execute("SELECT COUNT(*) FROM accounts_customuser WHERE category = 'consumer';")
print("Verified Community Consumers count:", cur.fetchone()[0])
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/cleanup_mirror_users.py\n{remote_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/cleanup_mirror_users.py"]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)
