import os, sys, django, json
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from business.models import CommissionConfig
cfg = CommissionConfig.get_solo()
ruc = (cfg.master_commission_json or {}).get("rank_upgrade_config")
print("rank_upgrade_config in master_commission_json:")
print(json.dumps(ruc, indent=2))
