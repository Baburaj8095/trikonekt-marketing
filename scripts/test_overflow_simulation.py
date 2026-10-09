import os
import sys
from decimal import Decimal

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from django.utils import timezone
from accounts.models import CustomUser, Wallet, WalletTransaction
from mlm_ranks.models import Rank, UserRank, RankUpgrade, UpgradeCommission, CommissionHold, RankMatrixNode, RankMatrixRoot
from mlm_ranks.services.commission import CommissionDistributor
from mlm_ranks.services.five_matrix import FiveMatrixService
from mlm_ranks.services.config import COMPANY_ROOT_USER_ID

def run_test():
    print(f"=== TESTING RANK UPGRADES & OVERFLOW DISPATCH ===")
    print(f"Active COMPANY_ROOT_USER_ID: {COMPANY_ROOT_USER_ID}")

    # 1. Verify Root Sponsor User 9999999999 (User ID 2)
    root_user = CustomUser.objects.filter(phone="9999999999").first() or CustomUser.objects.filter(username="9999999999").first()
    if not root_user:
        print("Root User 9999999999 not found!")
        return

    admin_user = CustomUser.objects.filter(id=COMPANY_ROOT_USER_ID).first()
    print(f"Root User: ID {root_user.id} ({root_user.username})")
    print(f"Company Overflow User: ID {admin_user.id} ({admin_user.username})")

    # Bootstrap root user rank and rank matrix root
    r1 = Rank.objects.get(level_number=1)
    ur_root, _ = UserRank.objects.get_or_create(user=root_user, defaults={"current_rank": r1})
    ur_root.current_rank = Rank.objects.get(level_number=10) # Set Root to L10 so root is fully qualified
    ur_root.save()

    root_matrix = FiveMatrixService.ensure_root_for_rank1(root_user)
    print(f"Root Matrix initialized: ID {root_matrix.id}")

    # Create / Get Test Downline User 'test_downline_1'
    d1_user, created = CustomUser.objects.get_or_create(
        username="test_downline_1",
        defaults={
            "phone": "8888888881",
            "registered_by": root_user,
            "role": "CONSUMER",
            "account_active": True,
        }
    )
    d1_user.registered_by = root_user
    d1_user.save()

    # Place d1 in Root's 5-Matrix
    node = FiveMatrixService._place_node_for_root(
        root=root_matrix,
        child_user=d1_user,
        approved_at=timezone.now()
    )
    print(f"Downline {d1_user.username} placed in Root Matrix: Node ID {node.id}, Parent={node.parent_user.username}, Pos={node.position}, Depth={node.level_depth}")

    # Record Initial Balances
    w_root = Wallet.get_or_create_for_user(root_user)
    w_admin = Wallet.get_or_create_for_user(admin_user)
    init_root_bal = w_root.balance
    init_admin_bal = w_admin.balance
    print(f"\nInitial Balances -> Root: ₹{init_root_bal}, Company Overflow Box: ₹{init_admin_bal}")

    # TEST UPGRADE 1: Downline Upgrades to Layer 1 (₹250)
    print("\n--- [TEST 1] Downline Upgrades to Layer 1 (₹250) ---")
    up1 = RankUpgrade.objects.create(
        user=d1_user,
        from_rank=r1,
        to_rank=r1,
        upgrade_amount=Decimal("250.00"),
        net_amount=Decimal("250.00"),
        payment_status=RankUpgrade.STATUS_SUCCESS,
        upgraded_at=timezone.now()
    )
    CommissionDistributor.distribute(up1)

    w_root.refresh_from_db()
    w_admin.refresh_from_db()
    comms1 = UpgradeCommission.objects.filter(upgrade=up1)
    print(f"Commissions created for Up1 ({comms1.count()} rows):")
    for c in comms1:
        print(f"  - L{c.level} {c.commission_type}: ₹{c.commission_amount} -> {c.to_user.username} [{c.status}]")
    print(f"Balances after L1 -> Root: ₹{w_root.balance} (+₹{w_root.balance - init_root_bal}), Admin/Overflow: ₹{w_admin.balance} (+₹{w_admin.balance - init_admin_bal})")

    # TEST UPGRADE 2: Downline Upgrades to Layer 2 (₹500) -> 50% Direct to Root, 50% Overflow to Admin!
    print("\n--- [TEST 2] Downline Upgrades to Layer 2 (₹500) ---")
    r2 = Rank.objects.get(level_number=2)
    up2 = RankUpgrade.objects.create(
        user=d1_user,
        from_rank=r1,
        to_rank=r2,
        upgrade_amount=Decimal("500.00"),
        net_amount=Decimal("500.00"),
        payment_status=RankUpgrade.STATUS_SUCCESS,
        upgraded_at=timezone.now()
    )
    CommissionDistributor.distribute(up2)

    w_root.refresh_from_db()
    w_admin.refresh_from_db()
    comms2 = UpgradeCommission.objects.filter(upgrade=up2)
    print(f"Commissions created for Up2 ({comms2.count()} rows):")
    for c in comms2:
        print(f"  - L{c.level} {c.commission_type}: ₹{c.commission_amount} -> {c.to_user.username} [{c.status}]")
    print(f"Balances after L2 -> Root: ₹{w_root.balance} (+₹{w_root.balance - init_root_bal}), Admin/Overflow: ₹{w_admin.balance} (+₹{w_admin.balance - init_admin_bal})")

    # TEST UPGRADE 3: Downline Upgrades to Layer 3 (₹1,000) -> 50% Direct to Root, 50% Overflow to Admin!
    print("\n--- [TEST 3] Downline Upgrades to Layer 3 (₹1,000) ---")
    r3 = Rank.objects.get(level_number=3)
    up3 = RankUpgrade.objects.create(
        user=d1_user,
        from_rank=r2,
        to_rank=r3,
        upgrade_amount=Decimal("1000.00"),
        net_amount=Decimal("1000.00"),
        payment_status=RankUpgrade.STATUS_SUCCESS,
        upgraded_at=timezone.now()
    )
    CommissionDistributor.distribute(up3)

    w_root.refresh_from_db()
    w_admin.refresh_from_db()
    comms3 = UpgradeCommission.objects.filter(upgrade=up3)
    print(f"Commissions created for Up3 ({comms3.count()} rows):")
    for c in comms3:
        print(f"  - L{c.level} {c.commission_type}: ₹{c.commission_amount} -> {c.to_user.username} [{c.status}]")
    print(f"Balances after L3 -> Root: ₹{w_root.balance} (+₹{w_root.balance - init_root_bal}), Admin/Overflow: ₹{w_admin.balance} (+₹{w_admin.balance - init_admin_bal})")

    # Verification Summary
    print("\n=======================================================")
    print("VERIFICATION OF OVERFLOW AND COMMISSIONS:")
    print(f"1. Root (9999999999) earned: ₹{w_root.balance} (Expected: 75% of ₹125+₹125+₹250+₹500 = ₹750 gross * 0.75 = ₹562.50 in Main Wallet)")
    print(f"   Root Self Account: ₹{getattr(w_root, 'franchise_self_rebirth', 0)} (Expected: 25% of ₹750 = ₹187.50)")
    print(f"2. Company Overhead Overflow Box (User 1) earned: ₹{w_admin.balance} (Expected: ₹250 (L2 Match) + ₹500 (L3 Match) = ₹750.00)")
    print("=======================================================")

if __name__ == "__main__":
    run_test()
