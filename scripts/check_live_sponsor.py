
import json
from business.models import CommissionConfig

cfg_obj = CommissionConfig.objects.filter(package__isnull=True).first()
if not cfg_obj:
    print("NO MASTER CONFIG FOUND")
else:
    cfg = cfg_obj.master_commission_json or {}
    print("=== spp_1000_config ===")
    print(json.dumps(cfg.get("spp_1000_config"), indent=2))
    print("=== direct_bonus ===")
    print(json.dumps(cfg.get("direct_bonus"), indent=2))
    print("=== taxes_and_charges ===")
    print(json.dumps(cfg.get("taxes_and_charges"), indent=2))

for c in CommissionConfig.objects.filter(package__isnull=False):
    print(f"=== Package {c.package.package_code} (price={c.package.price}) ===")
    print(f"Direct Bonus: {c.direct_bonus}")
