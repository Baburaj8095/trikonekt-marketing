
import json
from business.models import CommissionConfig

cfg = CommissionConfig.get_solo()
master = cfg.master_commission_json or {}
print("=== COMMISSION CONFIG MASTER ===")
print("geo_fixed:", json.dumps(master.get('geo_fixed', {}), indent=2))
print("geo_mode:", json.dumps(master.get('geo_mode', {}), indent=2))
print("direct_bonus:", json.dumps(master.get('direct_bonus', {}), indent=2))
