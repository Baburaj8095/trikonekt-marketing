
import os
import sys

if os.path.exists("/etc/trikonekt/staging-backend.env"):
    with open("/etc/trikonekt/staging-backend.env") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.strip().split("=", 1)
                os.environ[k.strip()] = v.strip()

sys.path.insert(0, "/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from django.db import connection

with connection.cursor() as cur:
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'accounts_wallet';")
    print("COLUMNS IN accounts_wallet:")
    for r in cur.fetchall():
        print(f"  {r[0]} ({r[1]})")

    cur.execute("SELECT * FROM accounts_wallet WHERE user_id = 1;")
    print("\nROW IN accounts_wallet FOR USER 1:")
    print(cur.fetchone())

    # Check transactions for user 1 in accounts_wallettransaction
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'accounts_wallettransaction';")
    print("\nCOLUMNS IN accounts_wallettransaction:")
    for r in cur.fetchall():
        print(f"  {r[0]} ({r[1]})")

    cur.execute("SELECT * FROM accounts_wallettransaction WHERE wallet_id IN (SELECT id FROM accounts_wallet WHERE user_id = 1) OR user_id = 1;")
    rows = cur.fetchall()
    print(f"\nTOTAL ROWS IN accounts_wallettransaction FOR USER 1: {len(rows)}")
    for r in rows:
        print(r)
