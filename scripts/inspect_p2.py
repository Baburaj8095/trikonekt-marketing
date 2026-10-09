import os, sys

sys.path.append("/srv/trikonekt/staging/backend")
if os.path.exists("/etc/trikonekt/staging-backend.env"):
    with open("/etc/trikonekt/staging-backend.env") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from business.models import PromoPurchase
p2 = PromoPurchase.objects.filter(id=2).first()
with open("/tmp/p2.txt", "w") as out:
    if p2:
        out.write(f"ID: {p2.id}\n")
        out.write(f"User: {p2.user.username}\n")
        out.write(f"Package: {p2.package.code} ({p2.package.type})\n")
        out.write(f"Status: {p2.status}\n")
        out.write(f"Boxes JSON: {getattr(p2, 'boxes_json', None)}\n")
        out.write(f"Package number: {getattr(p2, 'package_number', None)}\n")
        for f in p2._meta.fields:
            out.write(f"  {f.name}: {getattr(p2, f.name)}\n")
    else:
        out.write("PromoPurchase 2 not found\n")
