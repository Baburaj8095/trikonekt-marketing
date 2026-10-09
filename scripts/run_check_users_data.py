import subprocess

ssh_key_path = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

py_code = r"""
import json
import psycopg2

conn = psycopg2.connect("dbname=trikonekt user=postgres host=localhost")
cur = conn.cursor()

phones = ('9999999999', '8095918105')
cur.execute("SELECT id, username, phone, email, is_active FROM accounts_customuser WHERE phone IN %s OR username IN %s;", (phones, phones))
users = cur.fetchall()
print("Found users:", users)

for u in users:
    uid = u[0]
    uname = u[1]
    print(f"\n--- Data for user {uname} (ID: {uid}) ---")
    
    cur.execute("SELECT count(*) FROM business_promopurchase WHERE user_id = %s;", (uid,))
    print(f"PromoPurchase count: {cur.fetchone()[0]}")
    
    cur.execute("SELECT count(*) FROM business_promomonthlybox WHERE user_id = %s;", (uid,))
    print(f"PromoMonthlyBox count: {cur.fetchone()[0]}")

    cur.execute("SELECT count(*) FROM business_autopoolaccount WHERE owner_id = %s;", (uid,))
    print(f"AutoPoolAccount count: {cur.fetchone()[0]}")

    cur.execute("SELECT count(*) FROM mlm_ranks_rankupgrade WHERE user_id = %s;", (uid,))
    print(f"RankUpgrade count: {cur.fetchone()[0]}")

    cur.execute("SELECT count(*) FROM mlm_ranks_upgradecommission WHERE to_user_id = %s OR from_user_id = %s;", (uid, uid))
    print(f"UpgradeCommission count: {cur.fetchone()[0]}")

    cur.execute("SELECT count(*) FROM accounts_wallettransaction WHERE user_id = %s;", (uid,))
    print(f"WalletTransaction count: {cur.fetchone()[0]}")

    cur.execute("SELECT balance, main_balance, withdrawable_balance FROM accounts_wallet WHERE user_id = %s;", (uid,))
    row = cur.fetchone()
    print(f"Wallet balances: {row}")
"""

local_tmp_path = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\scripts\check_users_data.py"
with open(local_tmp_path, "w", encoding="utf-8") as f:
    f.write(py_code)

subprocess.run([
    "scp", "-i", ssh_key_path, "-o", "StrictHostKeyChecking=no",
    local_tmp_path, f"{ec2_user}@{ec2_ip}:/tmp/check_users_data.py"
], check=True)

remote_cmd = "/srv/trikonekt/app/backend/.venv/bin/python3 /tmp/check_users_data.py"
res = subprocess.run([
    "ssh", "-i", ssh_key_path, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}", remote_cmd
], capture_output=True, text=True)

print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)
