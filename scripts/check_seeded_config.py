import os, sys, json
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

from business.models import CommissionConfig
cfg = CommissionConfig.get_solo()
master = cfg.master_commission_json or {}

with open("/tmp/check_config.txt", "w") as out:
    out.write(f"PRODUCTS 750: {json.dumps(master.get('products', {}).get('750'))}\n")
    out.write(f"DIRECT BONUS 750: {json.dumps(master.get('direct_bonus', {}).get('750'))}\n")
    out.write(f"GEO FIXED 750: {json.dumps(master.get('geo_fixed', {}).get('750'))}\n")
    out.write(f"CONSUMER MATRIX 5 750: {json.dumps(master.get('consumer_matrix_5', {}).get('750'))}\n")
    out.write(f"CONSUMER MATRIX 3 750: {json.dumps(master.get('consumer_matrix_3', {}).get('750'))}\n")
    out.write(f"TYPED FIVE MATRIX AMOUNTS: {json.dumps(cfg.five_matrix_amounts_json)}\n")
    out.write(f"TYPED THREE MATRIX AMOUNTS: {json.dumps(cfg.three_matrix_amounts_json)}\n")
