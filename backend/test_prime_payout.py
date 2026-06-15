import os
import django
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from accounts.models import CustomUser
from business.services.prime import (
    _matrix_open_cfg,
    _matrix_audit_exists_for_purchase,
    _matrix_any_prior_for_user,
    _is_consumer
)
from business.models import CommissionConfig
from business.services.prime import _resolve_base_amount

def test():
    username = "7975657678"
    pack_index = "5"
    print(f"=== DETAILED CONDITIONS TEST FOR {username} INDEX {pack_index} ===")
    user = CustomUser.objects.filter(username=username).first()
    if not user:
        print("User not found")
        return

    # 1. Check config and base amount
    cfg = CommissionConfig.get_solo()
    base150 = None
    try:
        base150 = _resolve_base_amount(cfg, "150", None)
        print(f"[+] _resolve_base_amount returned: {base150}")
    except Exception as e:
        print(f"[-] _resolve_base_amount raised exception: {e}")
        try:
            base150 = Decimal(getattr(cfg, "prime_activation_amount", 150) or 150)
            print(f"[+] Fallback base150 resolved to: {base150}")
        except Exception as e2:
            print(f"[-] Fallback base150 failed: {e2}")

    # 2. Check already_for_purchase
    src_type = "SELF_250_PACK"
    src_id = str(pack_index)
    already_for_purchase = _matrix_audit_exists_for_purchase(src_type, src_id, "150")
    print(f"[+] already_for_purchase: {already_for_purchase}")

    # 3. Check is_consumer
    is_consumer_val = _is_consumer(user)
    print(f"[+] _is_consumer(user): {is_consumer_val}")

    # 4. Check matrix config
    mode150, cfg_count150 = _matrix_open_cfg("150")
    print(f"[+] mode150: {mode150} | cfg_count150: {cfg_count150}")

    # 5. Evaluate perform_matrix condition
    perform_matrix = False
    if not already_for_purchase and is_consumer_val and base150 is not None:
        if src_type == "SELF_250_PACK":
            perform_matrix = True
        elif mode150 == "NEVER":
            perform_matrix = False
        elif mode150 == "FIRST_TIME_ONLY":
            perform_matrix = not _matrix_any_prior_for_user(user, "150")
        elif mode150 == "EVERY_PURCHASE":
            perform_matrix = True
    print(f"[+] Computed perform_matrix: {perform_matrix}")

    # 6. Check policy matrix enable
    from business.services.prime import CommissionPolicy
    policy = CommissionPolicy.load()
    p150 = policy.prime150()
    try:
        master_for_enable = dict(getattr(CommissionConfig.get_solo(), "master_commission_json", {}) or {})
        eff_enable_5 = bool(p150.enable_5_matrix) or CommissionPolicy._enabled_from_cm(master_for_enable, "consumer_matrix_5", "150")
        eff_enable_3 = bool(p150.enable_3_matrix) or CommissionPolicy._enabled_from_cm(master_for_enable, "consumer_matrix_3", "150")
        print(f"[+] Policy: eff_enable_5={eff_enable_5}, eff_enable_3={eff_enable_3}")
    except Exception as e:
        eff_enable_5 = bool(p150.enable_5_matrix)
        eff_enable_3 = bool(p150.enable_3_matrix)
        print(f"[+] Policy (Fallback): eff_enable_5={eff_enable_5}, eff_enable_3={eff_enable_3}")

if __name__ == "__main__":
    test()
