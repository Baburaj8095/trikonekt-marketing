import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
if os.path.exists('/etc/trikonekt/staging-backend.env'):
    with open('/etc/trikonekt/staging-backend.env') as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                os.environ[k] = v

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from django.db import connection

with connection.cursor() as cur:
    cur.execute("""
        SELECT tgname, tgrelid::regclass, proname, prosrc
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE tgrelid::regclass::text LIKE 'accounts_%' OR tgrelid::regclass::text LIKE 'coupons_%';
    """)
    rows = cur.fetchall()
    print(f"Total triggers found: {len(rows)}")
    for row in rows:
        print(f"\nTrigger: {row[0]} on Table: {row[1]}, Func: {row[2]}")
        print("Function definition:")
        print(row[3])
