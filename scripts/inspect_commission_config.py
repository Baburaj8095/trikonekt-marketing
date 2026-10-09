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

from business.models import CommissionConfig
import json

cfg = CommissionConfig.get_solo()
print("COMMISSION CONFIG FIELDS:")
for f in cfg._meta.fields:
    val = getattr(cfg, f.name)
    if isinstance(val, dict):
        print(f"{f.name}: (JSON with keys {list(val.keys())})")
    else:
        print(f"{f.name}: {val}")

print("\nMASTER COMMISSION JSON:")
print(json.dumps(cfg.master_commission_json, indent=2))
