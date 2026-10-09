import os, sys, django
sys.path.append("/srv/trikonekt/staging/backend")
if os.path.exists("/etc/trikonekt/staging-backend.env"):
    with open("/etc/trikonekt/staging-backend.env") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from accounts.models import CustomUser
from business.models import AutoPoolAccount

print("=== USERS ===")
for u in CustomUser.objects.all():
    print(f"ID: {u.id}, Username: {u.username}, Phone: {u.phone}, Staff: {u.is_staff}, Super: {u.is_superuser}, RegisteredBy: {getattr(u, 'registered_by_id', None)}")

print("=== SENTINEL POOL ACCOUNTS ===")
for a in AutoPoolAccount.objects.filter(source_type="SENTINEL"):
    print(f"ID: {a.id}, Pool: {a.pool_type}, Owner: {a.owner_id}, Username: {a.username_key}, Status: {a.status}")
