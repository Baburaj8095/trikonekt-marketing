
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
