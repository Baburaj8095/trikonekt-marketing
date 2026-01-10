import os
import json
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402
django.setup()

from business.models import CommissionConfig  # noqa: E402


def main():
    cfg = CommissionConfig.get_solo()
    master = dict(getattr(cfg, "master_commission_json", {}) or {})

    out = {
        "enable_pool_distribution": bool(getattr(cfg, "enable_pool_distribution", False)),
        "enable_geo_distribution": bool(getattr(cfg, "enable_geo_distribution", False)),
        "prime_activation_amount": str(getattr(cfg, "prime_activation_amount", "")),
        "three_matrix_levels": int(getattr(cfg, "three_matrix_levels", 0) or 0),
        "five_matrix_levels": int(getattr(cfg, "five_matrix_levels", 0) or 0),
        "master_keys": sorted(list(master.keys())),
        "products.150.base_amount": str(((master.get("products") or {}).get("150") or {}).get("base_amount")),
        "geo_mode.150": (master.get("geo_mode") or {}).get("150"),
        "geo_fixed.150": (master.get("geo_fixed") or {}).get("150"),
        "consumer_matrix_5.150": (master.get("consumer_matrix_5") or {}).get("150"),
        "consumer_matrix_3.150": (master.get("consumer_matrix_3") or {}).get("150"),
        "commissions.prime_150": (master.get("commissions") or {}).get("prime_150"),
        "commissions.prime_750": (master.get("commissions") or {}).get("prime_750"),
        "policy_hash_safe": "",
    }

    # Validate policy load and capture prime_150 config as seen by engine
    try:
        from business.services.commission_policy import CommissionPolicy
        pol = CommissionPolicy.load()
        p150 = pol.prime150()
        out["policy_hash_safe"] = pol.policy_hash()
        out["prime_150_policy"] = {
            "direct_sponsor": str(p150.direct_sponsor),
            "direct_self": str(p150.direct_self),
            "enable_3_matrix": bool(p150.enable_3_matrix),
            "enable_5_matrix": bool(p150.enable_5_matrix),
            "coupon_activation_count": int(p150.coupon_activation_count),
            "reward_points_amount": str(p150.reward_points_amount),
        }
    except Exception as e:
        out["policy_error"] = f"{type(e).__name__}: {e}"

    # Write diagnostics file
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tmp"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "show_commission_config.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, default=str, indent=2)

    print(out_path)


if __name__ == "__main__":
    main()
