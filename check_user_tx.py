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

from accounts.models import CustomUser, WalletTransaction

u = CustomUser.objects.filter(username="9999999999").first()
print(f"User: {u.id} ({u.username})")
for t in WalletTransaction.objects.filter(user=u).order_by("-created_at")[:10]:
    d = {k: v for k, v in t.__dict__.items() if not k.startswith('_')}
    print(d)
