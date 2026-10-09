
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
    # 1. Inspect user 9999999999 balances in accounts_customuser
    cur.execute("""
        SELECT id, username, wallet_balance, total_earning, total_withdrawn, self_account_balance
        FROM accounts_customuser
        WHERE username = '9999999999' OR id = 1;
    """)
    print("USER 9999999999 BALANCES IN accounts_customuser:")
    for r in cur.fetchall():
        print(r)

    # 2. Check all tables with 'wallet' or 'transaction' in name
    cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND (table_name LIKE '%wallet%' OR table_name LIKE '%transaction%' OR table_name LIKE '%ledger%');
    """)
    print("\nWALLET / TRANSACTION TABLES:")
    wallet_tables = [r[0] for r in cur.fetchall()]
    for t in wallet_tables:
        print(f" - {t}")

    # 3. Check recent transactions for user_id = 1 (9999999999)
    for t in wallet_tables:
        try:
            cur.execute(f"SELECT * FROM {t} WHERE user_id = 1 LIMIT 5;")
            rows = cur.fetchall()
            if rows:
                print(f"\nROWS IN {t} FOR USER 1:")
                for r in rows:
                    print(r)
        except Exception as e:
            pass
