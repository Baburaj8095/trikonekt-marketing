
import json
from business.models import CommissionConfig

cfg_obj = CommissionConfig.objects.first()
if not cfg_obj:
    print("NO CONFIG FOUND")
else:
    cfg = cfg_obj.master_commission_json or {}
    print("=== spp_1000_config ===")
    print(json.dumps(cfg.get("spp_1000_config"), indent=2))
    print("=== direct_bonus ===")
    print(json.dumps(cfg.get("direct_bonus"), indent=2))
    print("=== active_direct_bonus_amount ===")
    print(cfg_obj.active_direct_bonus_amount)
    print("=== active_self_bonus_amount ===")
    print(cfg_obj.active_self_bonus_amount)
