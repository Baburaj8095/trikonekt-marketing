import os
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402
django.setup()

from business.models import CommissionConfig  # noqa: E402
from business.services.commission_policy import CommissionPolicy  # noqa: E402


def q2(x):
    try:
        return float(Decimal(str(x)).quantize(Decimal("0.01")))
    except Exception:
        return 0.0


def main():
    cfg = CommissionConfig.get_solo()
    master = dict(getattr(cfg, "master_commission_json", {}) or {})

    # Monthly 759 desired config for testing:
    # - Strict monthly_759 block with base_amount, agency_enabled, and L1..L5 fixed amounts
    # - Geo agency distribution for 759 in FIXED rupees per role (same map as 150 for test)
    MONTHLY_BASE = q2(759)
    MONTHLY_LEVELS_FIXED = [q2(x) for x in [50, 40, 30, 20, 10]]  # L1..L5 (adjust as needed)

    GEO_FIXED_759 = {
        "sub_franchise": q2(15),
        "pincode": q2(4),
        "pincode_coord": q2(2),
        "district": q2(1),
        "district_coord": q2(1),
        "state": q2(1),
        "state_coord": q2(1),
        "employee": q2(2),
        "royalty": q2(10),
    }

    # monthly_759 block
    monthly = dict(master.get("monthly_759", {}) or {})
    monthly["base_amount"] = MONTHLY_BASE
    monthly["agency_enabled"] = True
    monthly["levels_fixed"] = MONTHLY_LEVELS_FIXED
    master["monthly_759"] = monthly

    # geo_mode and geo_fixed for "759"
    gm = dict(master.get("geo_mode", {}) or {})
    gm["759"] = "fixed"
    master["geo_mode"] = gm

    gf = dict(master.get("geo_fixed", {}) or {})
    gf["759"] = GEO_FIXED_759
    master["geo_fixed"] = gf

    # Keep commissions node coherent with master
    try:
        commissions = CommissionPolicy._synth_from_master(master)
    except Exception:
        commissions = dict(master.get("commissions", {}) or {})
    master["commissions"] = commissions

    cfg.master_commission_json = master
    cfg.enable_pool_distribution = True
    cfg.enable_geo_distribution = True
    try:
        cfg.save(update_fields=["master_commission_json", "enable_pool_distribution", "enable_geo_distribution", "updated_at"])
    except Exception:
        cfg.save()

    print("Configured MONTHLY 759:")
    print("- monthly_759.base_amount =", master.get("monthly_759", {}).get("base_amount"))
    print("- monthly_759.agency_enabled =", master.get("monthly_759", {}).get("agency_enabled"))
    print("- monthly_759.levels_fixed =", master.get("monthly_759", {}).get("levels_fixed"))
    print("- geo_mode[759] =", master.get("geo_mode", {}).get("759"))
    print("- geo_fixed[759] =", master.get("geo_fixed", {}).get("759"))


if __name__ == "__main__":
    main()
