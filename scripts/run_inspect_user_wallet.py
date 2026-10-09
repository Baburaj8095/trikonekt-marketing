import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_script = r'''
import os
import sys

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

with connection.cursor() as cur:
    print("=== accounts_wallet FOR USER 1 ===")
    cur.execute("SELECT * FROM accounts_wallet WHERE user_id = 1;")
    for r in cur.fetchall():
        print(r)

    print("\n=== accounts_walletaccount FOR USER 1 ===")
    try:
        cur.execute("SELECT * FROM accounts_walletaccount WHERE user_id = 1;")
        for r in cur.fetchall():
            print(r)
    except Exception as e:
        print("Error:", e)

    print("\n=== accounts_wallettransaction FOR USER 1 ===")
    try:
        cur.execute("SELECT id, user_id, amount, transaction_type, purpose, balance_after, created_at FROM accounts_wallettransaction WHERE user_id = 1 ORDER BY id DESC LIMIT 10;")
        for r in cur.fetchall():
            print(r)
    except Exception as e:
        print("Error:", e)

    print("\n=== accounts_financialtransaction FOR USER 1 ===")
    try:
        cur.execute("SELECT id, user_id, amount, transaction_type, purpose, balance_after, created_at FROM accounts_financialtransaction WHERE user_id = 1 ORDER BY id DESC LIMIT 10;")
        for r in cur.fetchall():
            print(r)
    except Exception as e:
        print("Error:", e)

    print("\n=== accounts_ledgerentry FOR USER 1 ===")
    try:
        cur.execute("SELECT id, user_id, amount, entry_type, description, balance_after, created_at FROM accounts_ledgerentry WHERE user_id = 1 ORDER BY id DESC LIMIT 10;")
        for r in cur.fetchall():
            print(r)
    except Exception as e:
        print("Error:", e)

    print("\n=== business_referraljoinpayout FOR USER 1 ===")
    try:
        cur.execute("SELECT * FROM business_referraljoinpayout WHERE recipient_user_id = 1 OR buyer_user_id = 1 ORDER BY id DESC LIMIT 10;")
        for r in cur.fetchall():
            print(r)
    except Exception as e:
        print("Error:", e)
'''

with open("scripts/inspect_user_wallet_data.py", "w", encoding="utf-8") as f:
    f.write(remote_script)

scp_cmd = [
    "scp",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    r"scripts\inspect_user_wallet_data.py",
    f"{ec2_user}@{ec2_ip}:/tmp/inspect_user_wallet_data.py"
]
subprocess.run(scp_cmd, check=True)

ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    "/srv/trikonekt/staging/backend/.venv/bin/python /tmp/inspect_user_wallet_data.py"
]
subprocess.run(ssh_cmd, check=True)
