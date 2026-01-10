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

    # Desired configuration:
    # - Geo agency distribution for 150 in FIXED rupees per role
    # - 5-matrix and 3-matrix fixed rupees per level
    # - Ensure base_amount exists for product 150
    # - Ensure prime_150 coupon_activation_count is at least 1
    GEO_FIXED_150 = {
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

    FIVE_LEVELS = 6
    THREE_LEVELS = 15

    # Example fixed rupees per level (adjust later if needed)
    FIVE_FIXED = [q2(x) for x in [20, 10, 5, 5, 5, 5]]
    THREE_FIXED = [q2(x) for x in [5, 4, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]]

    # products.150.base_amount
    products = dict(master.get("products", {}) or {})
    row150 = dict(products.get("150", {}) or {})
    row150["base_amount"] = q2(150)
    products["150"] = row150
    master["products"] = products

    # geo_mode and geo_fixed for "150"
    gm = dict(master.get("geo_mode", {}) or {})
    gm["150"] = "fixed"
    master["geo_mode"] = gm

    gf = dict(master.get("geo_fixed", {}) or {})
    gf["150"] = GEO_FIXED_150
    master["geo_fixed"] = gf

    # consumer_matrix_5 & consumer_matrix_3 fixed-amounts for "150"
    cm5_all = dict(master.get("consumer_matrix_5", {}) or {})
    cm3_all = dict(master.get("consumer_matrix_3", {}) or {})

    cm5_all["150"] = {
        "levels": int(FIVE_LEVELS),
        "fixed_amounts": FIVE_FIXED[:FIVE_LEVELS],
    }
    cm3_all["150"] = {
        "levels": int(THREE_LEVELS),
        "fixed_amounts": THREE_FIXED[:THREE_LEVELS],
    }

    master["consumer_matrix_5"] = cm5_all
    master["consumer_matrix_3"] = cm3_all

    # Keep commissions in sync with master keys
    try:
        commissions = CommissionPolicy._synth_from_master(master)
    except Exception:
        commissions = dict(master.get("commissions", {}) or {})

    # Ensure coupon activation count for prime_150 is at least 1 (controls matrix opening count)
    try:
        p150 = dict(commissions.get("prime_150", {}) or {})
        coupons = dict(p150.get("coupons", {}) or {})
        if int(coupons.get("activation_count") or 0) < 1:
            coupons["activation_count"] = 1
        p150["coupons"] = coupons
        commissions["prime_150"] = p150
    except Exception:
        pass

    master["commissions"] = commissions

    # Persist config and ensure toggles are on
    cfg.master_commission_json = master
    cfg.enable_pool_distribution = True
    cfg.enable_geo_distribution = True

    try:
        cfg.save(update_fields=["master_commission_json", "enable_pool_distribution", "enable_geo_distribution", "updated_at"])
    except Exception:
        cfg.save()

    # Output summary
    print("Configured PRIME 150:")
    print("- products.150.base_amount =", products["150"]["base_amount"])
    print("- geo_mode[150] =", master.get("geo_mode", {}).get("150"))
    print("- geo_fixed[150] =", master.get("geo_fixed", {}).get("150"))
    print("- consumer_matrix_5[150] =", master.get("consumer_matrix_5", {}).get("150"))
    print("- consumer_matrix_3[150] =", master.get("consumer_matrix_3", {}).get("150"))
    try:
        print("- commissions.prime_150.coupons.activation_count =", master["commissions"]["prime_150"]["coupons"]["activation_count"])
    except Exception:
        pass


if __name__ == "__main__":
    main()
