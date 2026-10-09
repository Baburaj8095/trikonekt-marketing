
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
    cur.execute("SELECT id, username, full_name, phone, sponsor_id, is_staff, is_superuser, is_active, date_joined FROM accounts_customuser WHERE username = '9999999999' OR phone = '9999999999';")
    rows = cur.fetchall()
    print("USER 9999999999 IN accounts_customuser:")
    for r in rows:
        print(r)

    cur.execute("SELECT id, username, full_name, phone, sponsor_id, is_active, date_joined FROM accounts_customuser ORDER BY id ASC LIMIT 10;")
    print("\nTOP 10 USERS IN accounts_customuser (BY ID ASC):")
    for r in cur.fetchall():
        print(r)

    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE '%matrix%' OR table_name LIKE '%autopool%' OR table_name LIKE '%package%' OR table_name LIKE '%promo%');")
    print("\nRELEVANT TABLES:")
    for r in cur.fetchall():
        print(r[0])
