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
    # 1. Get all column names of accounts_customuser
    cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'accounts_customuser'
        ORDER BY ordinal_position;
    """)
    print("COLUMNS IN accounts_customuser:")
    for r in cur.fetchall():
        print(f"  {r[0]} ({r[1]})")

    # 2. Find all wallet / transaction / ledger tables
    cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
    """)
    all_tables = [r[0] for r in cur.fetchall()]
    print("\nALL PUBLIC TABLES IN DB:")
    for t in all_tables:
        if any(w in t.lower() for w in ['wallet', 'transaction', 'history', 'ledger', 'balance', 'credit', 'rebirth', 'self', 'payout', 'commission']):
            print(f"  * {t}")
'''

with open("scripts/inspect_db_schema.py", "w", encoding="utf-8") as f:
    f.write(remote_script)

scp_cmd = [
    "scp",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    r"scripts\inspect_db_schema.py",
    f"{ec2_user}@{ec2_ip}:/tmp/inspect_db_schema.py"
]
subprocess.run(scp_cmd, check=True)

ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    "/srv/trikonekt/staging/backend/.venv/bin/python /tmp/inspect_db_schema.py"
]
subprocess.run(ssh_cmd, check=True)
