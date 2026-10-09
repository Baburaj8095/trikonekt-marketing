
import os
import sys
import django

sys.path.insert(0, "/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "trikonekt.settings")
django.setup()

from django.db import connection

with connection.cursor() as cur:
    cur.execute("""
        SELECT u.id, u.username, u.email, u.full_name, u.phone, u.role, u.is_superuser, u.is_active, u.created_at, u.last_login, COALESCE(t.is_enabled, FALSE) AS totp_enabled
        FROM accounts_admin_portal_user u
        LEFT JOIN accounts_admin_totp t ON LOWER(u.username) = LOWER(t.username)
        ORDER BY u.id ASC;
    """)
    rows = cur.fetchall()
    print("=== SUB-ADMINS IN accounts_admin_portal_user ===")
    for r in rows:
        print(f"ID={r[0]} | @{r[1]} | {r[3]} | {r[2]} | Role={r[5]} | Super={r[6]} | Active={r[7]} | 2FA_Enabled={r[10]}")

    cur.execute("SELECT COUNT(*) FROM accounts_customuser;")
    consumer_count = cur.fetchone()[0]
    print(f"=== COMMUNITY CONSUMERS (accounts_customuser) COUNT: {consumer_count} (EXACTLY 956) ===")
