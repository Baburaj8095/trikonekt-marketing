import os, sys
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
# Temporarily patch settings before connection
from django.conf import settings
django.setup()

# Check DATABASES options
print("Original options:", settings.DATABASES['default']['OPTIONS'].get('options'))
settings.DATABASES['default']['OPTIONS'].pop('options', None)

from django.db import connection
try:
    with connection.cursor() as cur:
        cur.execute("SELECT current_database(), current_user;")
        print("DJANGO VIA RDS PROXY SUCCESS:", cur.fetchone())
except Exception as e:
    print("DJANGO VIA RDS PROXY ERROR:", e)
