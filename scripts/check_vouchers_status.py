import os, sys

env_file = "/etc/trikonekt/staging-backend.env"
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

sys.path.insert(0, "/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()
from accounts.models import ConsumerVoucher, CustomUser

for u in CustomUser.objects.filter(username__in=["8095918103", "8095918105"]):
    print(f"=== User {u.username} (id={u.id}) ===")
    for v in ConsumerVoucher.objects.filter(assigned_to=u).order_by("-created_at"):
        print(f"  Code: {v.code} | Amount: {v.amount} | Status: {v.status} | RedeemedAt: {v.redeemed_at}")
