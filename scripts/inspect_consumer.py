import os, sys

sys.path.append('/srv/trikonekt/staging/backend')
if os.path.exists('/etc/trikonekt/staging-backend.env'):
    with open('/etc/trikonekt/staging-backend.env') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

u = User.objects.filter(username="admin-consumer").first()
if u:
    for field in u._meta.fields:
        print(f"{field.name}: {getattr(u, field.name)}", flush=True)
else:
    print("User admin-consumer not found", flush=True)
