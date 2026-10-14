import os, sys, django
sys.path.insert(0, "/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.db import connection

cursor = connection.cursor()
cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'business_franchisepayout';")
cols = [r[0] for r in cursor.fetchall()]
print(f"business_franchisepayout columns: {cols}")

cursor.execute("SELECT * FROM business_franchisepayout;")
rows = cursor.fetchall()
print(f"Total rows in business_franchisepayout: {len(rows)}")
for r in rows:
    print(r)
