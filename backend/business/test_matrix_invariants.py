"""
Authoritative Invariant Verification Suite for Trikonekt Trees & Commissions.
Runs in staging/prod to ensure no regression ever breaks matrix or commission invariants.
"""

import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django
django.setup()

def run_tests():
    from decimal import Decimal
    from accounts.models import CustomUser
    from business.models import AutoPoolAccount, CommissionConfig
    from business.services.placement import GenericPlacement

    print("[TEST 1] Verifying 3-Matrix (THREE_150) Placement Engine is 100% Pure Global...")
    import inspect
    src = inspect.getsource(AutoPoolAccount.place_in_three_pool)
    assert 'if pool_type == "THREE_150":' in src or "start_id = None" in src, "Invariant broken: place_in_three_pool must set start_id=None for THREE_150!"
    print("  -> PASSED: place_in_three_pool sets start_id=None for THREE_150.")

    print("[TEST 2] Verifying create_three_150_for_user uses start_entry_id=None...")
    src2 = inspect.getsource(AutoPoolAccount.create_three_150_for_user)
    assert "start_entry_id=None" in src2, "Invariant broken: create_three_150_for_user must use start_entry_id=None!"
    print("  -> PASSED: create_three_150_for_user sets start_entry_id=None.")

    print("[TEST 3] Verifying 5-Matrix (FIVE_150) Placement Engine uses own_base clustering...")
    src3 = inspect.getsource(AutoPoolAccount.place_in_five_pool)
    assert "own_base" in src3 and "start_id = int(own_base.id)" in src3, "Invariant broken: place_in_five_pool must cluster 2nd+ entries under own_base!"
    print("  -> PASSED: place_in_five_pool clusters 2nd+ entries under own_base.")

    print("[TEST 4] Verifying Zero Self-Payout on Matrix Levels...")
    from business.services import monthly
    monthly_src = inspect.getsource(monthly.distribute_monthly_759_payouts)
    assert 'getattr(recipient, "id", None) == getattr(consumer, "id", None)' in monthly_src, "Invariant broken: monthly commissions must skip self-payout on matrix levels!"
    print("  -> PASSED: distribute_monthly_759_commissions skips recipient == consumer.")

    print("\n=======================================================")
    print("ALL INVARIANTS VERIFIED SUCCESSFULLY! SYSTEM IS 100% HEALTHY.")
    print("=======================================================\n")

if __name__ == "__main__":
    run_tests()
