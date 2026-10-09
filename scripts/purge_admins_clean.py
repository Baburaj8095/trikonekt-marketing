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

admin_ids = (1034, 1040, 1042, 1044)

# Explicitly clean known related tables
tables = [
    "accounts_walletaccount",
    "accounts_wallet",
    "accounts_kyc",
    "accounts_userdevice",
    "business_autopoolaccount",
    "business_userpincodestats",
    "business_usermatrixprogress",
    "business_rankupgrade",
    "business_promopurchase",
    "business_franchiseepurchaserequest",
    "business_ecoupon",
    "adminapi_user_roles",
    "business_rootconsumerconfig",
]

for t in tables:
    try:
        cur.execute(f"DELETE FROM {t} WHERE user_id IN %s;", [admin_ids])
    except Exception:
        pass
    try:
        cur.execute(f"DELETE FROM {t} WHERE owner_id IN %s;", [admin_ids])
    except Exception:
        pass
    try:
        cur.execute(f"DELETE FROM {t} WHERE root_user_id IN %s;", [admin_ids])
    except Exception:
        pass

# Delete from accounts_customuser
cur.execute("DELETE FROM accounts_customuser WHERE id IN %s;", [admin_ids])
print("Deleted admin users from accounts_customuser successfully.")

cur.execute("SELECT COUNT(*) FROM accounts_customuser WHERE category = 'consumer';")
print("Verified Community Consumers total:", cur.fetchone()[0])

cur.execute("SELECT COUNT(*) FROM accounts_customuser WHERE account_active = TRUE;")
print("Verified Active Community Consumers count:", cur.fetchone()[0])
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/purge_admins_clean.py\n{remote_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/purge_admins_clean.py"]
res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)
