import os
import sys
from decimal import Decimal

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from django.utils import timezone
from django.db import transaction
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import PromoPurchase, PromoPackage, AutoPoolAccount, CommissionConfig
from mlm_ranks.models import Rank, UserRank, RankUpgrade, UpgradeCommission, CommissionHold, RankMatrixNode, RankMatrixRoot
from mlm_ranks.services.commission import CommissionDistributor
from mlm_ranks.services.five_matrix import FiveMatrixService
from mlm_ranks.services.config import COMPANY_ROOT_USER_ID
from business.services.prime import distribute_prime_750_payouts
from business.services.monthly import distribute_monthly_759_payouts

def execute_5_directs_simulation():
    print("==========================================================================")
    print("STARTING 5 DIRECT SPONSORS SIMULATION (9999999991 to 9999999995)")
    print("Package Purchased per User: ₹2,000 Combo (₹750 Prime + ₹1,000 SPP + ₹250 e-Edu L1)")
    print("Root Sponsor: 9999999999 (No package purchased for Root)")
    print("==========================================================================\n")

    # 1. Setup Root Sponsor (9999999999)
    root_user, _ = CustomUser.objects.get_or_create(
        username="9999999999",
        defaults={
            "phone": "9999999999",
            "role": "CONSUMER",
            "account_active": True,
            "autopool_enabled": True,
        }
    )
    root_user.account_active = True
    root_user.autopool_enabled = True
    root_user.save()

    r1 = Rank.objects.filter(level_number=1).first()
    ur_root, _ = UserRank.objects.get_or_create(user=root_user, defaults={"current_rank": r1})
    ur_root.current_rank = r1
    ur_root.save()

    root_matrix = FiveMatrixService.ensure_root_for_rank1(root_user)
    w_root = Wallet.get_or_create_for_user(root_user)

    # Ensure packages exist
    pkg750 = PromoPackage.objects.filter(code='PRIME750').first() or PromoPackage.objects.filter(price=750).first()
    if not pkg750:
        pkg750 = PromoPackage.objects.create(code='PRIME750', name='Prime Promo 750', type='PRIME', price=Decimal('750.00'), is_active=True)

    pkg759 = PromoPackage.objects.filter(code='MONTHLY759').first() or PromoPackage.objects.filter(price=759).first()
    if not pkg759:
        pkg759 = PromoPackage.objects.create(code='MONTHLY759', name='Monthly SPP 1000', type='MONTHLY', price=Decimal('759.00'), is_active=True)

    direct_phones = [
        "9999999991",
        "9999999992",
        "9999999993",
        "9999999994",
        "9999999995"
    ]

    history_log = []

    for idx, phone in enumerate(direct_phones, start=1):
        print(f"\n>>>>>>>>>>>> [STEP {idx}/5] SPONSORING USER: {phone} <<<<<<<<<<<<")
        
        # 1. Create Downline User sponsored by 9999999999
        u, _ = CustomUser.objects.get_or_create(
            username=phone,
            defaults={
                "phone": phone,
                "registered_by": root_user,
                "role": "CONSUMER",
                "account_active": True,
                "autopool_enabled": True,
            }
        )
        u.registered_by = root_user
        u.account_active = True
        u.autopool_enabled = True
        u.save()

        bal_before = w_root.balance
        self_before = w_root.franchise_self_rebirth

        # --- PART 1: ₹750 Join Prime ---
        print(f"1. Purchasing Part 1: ₹750 Join Prime for {phone}...")
        p_join = PromoPurchase.objects.create(
            user=u,
            package=pkg750,
            status='APPROVED',
            prime750_choice='REDEEM',
            approved_at=timezone.now(),
        )
        distribute_prime_750_payouts(u, source={'type': 'PROMO_PURCHASE_APPROVAL', 'id': p_join.id})

        # --- PART 2: ₹1,000 Monthly SPP (1st Month) ---
        print(f"2. Purchasing Part 2: ₹1,000 SPP Monthly for {phone}...")
        p_spp = PromoPurchase.objects.create(
            user=u,
            package=pkg759,
            quantity=3,
            status='APPROVED',
            boxes_json=[1, 2, 3],
            approved_at=timezone.now(),
        )
        distribute_monthly_759_payouts(u, is_first_month=True, source={'type': 'PROMO_PURCHASE_APPROVAL', 'id': p_spp.id})

        # --- PART 3: ₹250 e-Edu Layer 1 Upgrade ---
        print(f"3. Purchasing Part 3: ₹250 e-Edu Layer 1 for {phone}...")
        up1 = RankUpgrade.objects.create(
            user=u,
            from_rank=r1,
            to_rank=r1,
            upgrade_amount=Decimal('250.00'),
            net_amount=Decimal('250.00'),
            payment_status=RankUpgrade.STATUS_SUCCESS,
            upgraded_at=timezone.now(),
        )
        # Place in 5-Matrix
        node = FiveMatrixService._place_node_for_root(
            root=root_matrix,
            child_user=u,
            approved_at=timezone.now()
        )
        CommissionDistributor.distribute(up1)

        # Refresh Root Wallet
        w_root.refresh_from_db()
        bal_after = w_root.balance
        self_after = w_root.franchise_self_rebirth

        earned_main = bal_after - bal_before
        earned_self = self_after - self_before
        total_earned_step = earned_main + earned_self

        # Check Matrix Placements
        ap_5 = AutoPoolAccount.objects.filter(owner=u, pool_type='FIVE_150').first()
        ap_3 = AutoPoolAccount.objects.filter(owner=u, pool_type='THREE_150').first()

        print(f"   • Tree 1 (5-Matrix): Seat ID {ap_5.id if ap_5 else 'N/A'}, Pos={ap_5.position if ap_5 else 'N/A'}")
        print(f"   • Tree 2 (3-Matrix): Seat ID {ap_3.id if ap_3 else 'N/A'}, Pos={ap_3.position if ap_3 else 'N/A'}")
        print(f"   • Tree 3 (e-Edu 5M): Node ID {node.id if node else 'N/A'}, Pos={node.position if node else 'N/A'}, Depth={node.level_depth if node else 'N/A'}")
        print(f"   >>> ROOT WALLET AFTER {phone}:")
        print(f"       Main Wallet Balance: ₹{bal_after} (+₹{earned_main})")
        print(f"       Self Account Pocket: ₹{self_after} (+₹{earned_self})")
        print(f"       Gross Commission for this User: ₹{total_earned_step}")

        history_log.append({
            "step": idx,
            "user": phone,
            "earned_main": earned_main,
            "earned_self": earned_self,
            "total_step": total_earned_step,
            "bal_after": bal_after,
            "self_after": self_after,
            "tree1_pos": getattr(ap_5, "position", "N/A"),
            "tree2_pos": getattr(ap_3, "position", "N/A"),
            "tree3_pos": getattr(node, "position", "N/A"),
        })

    print("\n==========================================================================")
    print("FINAL 5 DIRECT SPONSORS SIMULATION COMPLETE")
    print("==========================================================================")
    print(f"Root User: 9999999999")
    print(f"Total Main Wallet Balance: ₹{w_root.balance}")
    print(f"Total Self Account Pocket: ₹{w_root.franchise_self_rebirth}")
    print(f"Total Gross Commission:    ₹{w_root.balance + w_root.franchise_self_rebirth}")
    print(f"Directs Placed in 5M Tree: {RankMatrixNode.objects.filter(root_user=root_user).count()}")
    print("==========================================================================")

if __name__ == "__main__":
    execute_5_directs_simulation()
