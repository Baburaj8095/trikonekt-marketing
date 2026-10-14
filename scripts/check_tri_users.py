import os, sys
env_path = "/etc/trikonekt/staging-backend.env"
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()
sys.path.insert(0, "/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django; django.setup()
from accounts.models import CustomUser
for u in CustomUser.objects.filter(username__in=["1000000101", "8095918105", "9999999999"]):
    print("USER:", u.id, u.username, f"'{u.first_name}'", f"'{u.last_name}'", u.role)
for u in CustomUser.objects.filter(first_name__icontains="Trikonekt"):
    print("TRIKONEKT USER:", u.id, u.username, f"'{u.first_name}'", f"'{u.last_name}'", u.role)
