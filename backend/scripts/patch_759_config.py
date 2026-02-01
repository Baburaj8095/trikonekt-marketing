from django.db import transaction
from business.models import CommissionConfig


def _ensure_dict_path(root: dict, *keys: str):
    cur = root
    for k in keys:
        if k not in cur or not isinstance(cur[k], dict):
            cur[k] = {}
        cur = cur[k]
    return cur


def run():
    cfg = CommissionConfig.get_solo()
    m = dict(cfg.master_commission_json or {})

    # 1) Ensure monthly_759 exists and base_amount = 759.0
    monthly_759 = m.setdefault("monthly_759", {})
    # Force base_amount to 759.0
    monthly_759["base_amount"] = 759.0
    # If agency_enabled missing, keep it enabled by default
    if "agency_enabled" not in monthly_759:
        monthly_759["agency_enabled"] = True

    # 2) Ensure first month opens both 3 and 5 matrix for 759
    first_box_matrix = _ensure_dict_path(m, "commissions", "monthly_759", "first_box", "matrix")
    first_box_matrix["enable_3"] = True
    first_box_matrix["enable_5"] = True

    # 3) Ensure 3-matrix payout schedule for 759 exists (avoid empty schedule)
    cm3 = m.setdefault("consumer_matrix_3", {})
    cm3_759 = cm3.get("759") or {}
    # If missing or empty, try to copy from 150 as a reasonable default
    if not cm3_759 or (not cm3_759.get("fixed_amounts") and not cm3_759.get("percents")):
        src = cm3.get("150")
        if isinstance(src, dict) and (src.get("fixed_amounts") or src.get("percents")):
            cm3["759"] = {k: v for k, v in src.items() if k in ("levels", "fixed_amounts", "percents")}
        else:
            # Fallback minimal default to avoid zero payouts
            cm3["759"] = {
                "levels": 15,
                "fixed_amounts": [5.0, 2.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
            }

    with transaction.atomic():
        cfg.master_commission_json = m
        cfg.save(update_fields=["master_commission_json"])

    print("Patched CommissionConfig: monthly_759.base_amount=759, first_box matrix enable_3/enable_5=True, consumer_matrix_3.759 ensured.")


if __name__ == "__main__":
    run()
