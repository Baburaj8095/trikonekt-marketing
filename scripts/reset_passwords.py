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

new_pw = "123456"

for uname in ["admin", "9999999999"]:
    u = User.objects.filter(username=uname).first()
    if u:
        u.set_password(new_pw)
        u.save(update_fields=["password"])
        print(f"SUCCESS: Reset password for {uname} (ID={u.id}) to {new_pw}")
    else:
        print(f"ERROR: User {uname} not found")
