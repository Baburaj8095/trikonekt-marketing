
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
    # Update 9999999999 to non-admin, sponsor_id = NULL
    cur.execute("""
        UPDATE accounts_customuser
        SET is_staff = FALSE,
            is_superuser = FALSE,
            sponsor_id = NULL
        WHERE username = '9999999999' OR phone = '9999999999';
    """)
    print("Updated 9999999999 to non-admin with sponsor_id = NULL.")

    # Check updated record
    cur.execute("""
        SELECT id, username, full_name, phone, sponsor_id, is_staff, is_superuser, is_active
        FROM accounts_customuser
        WHERE username = '9999999999' OR phone = '9999999999';
    """)
    for r in cur.fetchall():
        print("UPDATED RECORD:", r)
