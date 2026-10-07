#!/usr/bin/env python3
"""
Authoritative User Reset & Purge Script for Trikonekt Growth Backend.
Safely resets or deletes a test user across all 11 relational tables:
1. business_autopoolaccount (5-matrix & 3-matrix seats)
2. business_promomonthlybox (SPP monthly box tracking)
3. business_promopurchase (PRIME750, MONTHLY759, etc.)
4. mlm_ranks_upgradecommission (Upline rank bonuses)
5. mlm_ranks_rankupgrade (Academic / MLM Rank upgrades)
6. accounts_wallettransaction (Ledgers & Transactions)
7. accounts_wallet (Aggregate balances -> 0.00)
8. accounts_consumervoucher (P2P gift cards)
9. coupons_couponcode (Coupons)
10. coupons_audittrail (Audit logs)
11. accounts_customuser (Profile status / Password reset / Hard delete)
"""

import os
import sys
import argparse
from decimal import Decimal

# Ensure backend settings are loaded
sys.path.insert(0, "/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

try:
    import django
    django.setup()
    from django.db import transaction
    from django.db.models import Q
    from accounts.models import CustomUser, Wallet, WalletTransaction, RewardPointsAccount, RewardPointsTransaction
    from business.models import AutoPoolAccount, PromoPurchase, PromoMonthlyBox, UserMatrixProgress
    from mlm_ranks.models import RankUpgrade, UpgradeCommission, RankMatrixNode, RankUpgradePayment
    from coupons.models import AuditTrail
    try:
        from accounts.models import ConsumerVoucher
    except ImportError:
        ConsumerVoucher = None
    try:
        from coupons.models import CouponCode
    except ImportError:
        CouponCode = None
except Exception as e:
    print(f"Error bootstrapping Django environment: {e}")
    sys.exit(1)


def find_user(identifier):
    raw = str(identifier or "").strip()
    if not raw:
        return None
    clean = raw.replace("+91", "").replace("TK-", "").replace("TK", "")
    digits = "".join([c for c in raw if c.isdigit()])
    phone_10 = digits[-10:] if len(digits) >= 10 else digits

    return (
        CustomUser.objects.filter(username__iexact=raw).first()
        or CustomUser.objects.filter(phone__iexact=raw).first()
        or CustomUser.objects.filter(phone__iexact=phone_10).first()
        or CustomUser.objects.filter(username__iexact=phone_10).first()
    )


def reset_or_delete_user(identifier, action="reset", default_password="123456"):
    user = find_user(identifier)
    if not user:
        print(f"[ERROR] User '{identifier}' not found in database.")
        return False

    if user.username == "admin" or getattr(user, "category", "") == "admin":
        print("[CRITICAL] Cannot reset or delete admin root account!")
        return False

    uname = user.username
    uid = user.id
    print(f"==================================================")
    print(f"Initiating {action.upper()} for user: {uname} (ID: {uid})")
    print(f"==================================================")

    with transaction.atomic():
        # 1. Safely Delete AutoPoolAccount (Matrix entries)
        # Avoid SET_NULL constraint violation on uniq_single_sentinel_per_pool
        # and uniq_autopool_sibling_position collisions.
        # Delete leaf nodes of the user first iteratively.
        while True:
            user_leaves = AutoPoolAccount.objects.filter(owner=user).exclude(
                id__in=AutoPoolAccount.objects.exclude(parent_account__isnull=True).values_list("parent_account_id", flat=True)
            )
            count = user_leaves.count()
            if count == 0:
                break
            user_leaves.delete()

        # If any user pools remain with children (e.g. downlines from other users):
        remaining_pools = list(AutoPoolAccount.objects.filter(owner=user))
        pools_count = len(remaining_pools)
        for pool in remaining_pools:
            fallback = pool.parent_account
            if not fallback:
                fallback = AutoPoolAccount.objects.filter(
                    pool_type=pool.pool_type, parent_account__isnull=True
                ).exclude(id=pool.id).first()
            children = list(AutoPoolAccount.objects.filter(parent_account=pool))
            for child in children:
                if fallback:
                    taken_positions = set(
                        AutoPoolAccount.objects.filter(parent_account=fallback, pool_type=child.pool_type)
                        .values_list("position", flat=True)
                    )
                    next_pos = 1
                    while next_pos in taken_positions:
                        next_pos += 1
                    child.parent_account = fallback
                    child.position = next_pos
                    child.save(update_fields=["parent_account", "position"])
                else:
                    child.delete()
            pool.delete()
        print(f"1. AutoPoolAccount deleted: all nodes for user {uname} removed safely.")
        matrix_prog_deleted = UserMatrixProgress.objects.filter(user=user).delete()
        print(f"1b. UserMatrixProgress deleted: {matrix_prog_deleted}")

        # 2. Delete PromoMonthlyBox (SPP Monthly box entries)
        boxes_deleted = PromoMonthlyBox.objects.filter(user=user).delete()
        print(f"2. PromoMonthlyBox deleted: {boxes_deleted}")

        # 3. Delete PromoPurchase
        purchases_deleted = PromoPurchase.objects.filter(user=user).delete()
        print(f"3. PromoPurchase deleted: {purchases_deleted}")

        # 4. Delete UpgradeCommission
        comm_deleted = UpgradeCommission.objects.filter(
            Q(to_user=user) | Q(from_user=user) | Q(upgrade__user=user)
        ).delete()
        print(f"4. UpgradeCommission deleted: {comm_deleted}")

        # 5. Delete RankUpgrade, RankMatrixNode, RankUpgradePayment
        ranks_deleted = RankUpgrade.objects.filter(user=user).delete()
        print(f"5. RankUpgrade deleted: {ranks_deleted}")
        rnodes_deleted = RankMatrixNode.objects.filter(
            Q(root_user_id=uid) | Q(placed_user_id=uid) | Q(parent_user_id=uid)
        ).delete()
        print(f"5b. RankMatrixNode deleted: {rnodes_deleted}")
        try:
            rpay_deleted = RankUpgradePayment.objects.filter(upgrade__user=user).delete()
            print(f"5c. RankUpgradePayment deleted: {rpay_deleted}")
        except Exception as e:
            print(f"5c. RankUpgradePayment reset note: {e}")

        # 5d. Reset RewardPointsAccount and Transactions
        try:
            rpt_deleted = RewardPointsTransaction.objects.filter(user=user).delete()
            RewardPointsAccount.objects.filter(user=user).update(
                balance_points=Decimal("0.00"),
                lifetime_earned_points=Decimal("0.00"),
                lifetime_redeemed_points=Decimal("0.00"),
            )
            print(f"5d. RewardPoints reset: tx_deleted={rpt_deleted}")
        except Exception as e:
            print(f"5d. RewardPoints reset note: {e}")

        # 6. Delete WalletTransaction for this user + undo sponsor bonus transactions from this user
        tx_deleted = WalletTransaction.objects.filter(user=user).delete()
        sponsor_tx_deleted = WalletTransaction.objects.filter(
            Q(meta__from_user_id=uid) | Q(meta__from_user=uname)
        ).delete()
        print(f"6. WalletTransaction deleted: User={tx_deleted}, Sponsor={sponsor_tx_deleted}")

        # 7. Reset User Wallet & Pockets
        w = Wallet.objects.filter(user=user).first()
        if w:
            w.balance = Decimal("0.00")
            w.main_balance = Decimal("0.00")
            w.withdrawable_balance = Decimal("0.00")
            w.total_earnings = Decimal("0.00")
            w.total_withdrawn = Decimal("0.00")
            if hasattr(w, "self_account_balance"):
                w.self_account_balance = Decimal("0.00")
            if hasattr(w, "bonus_wallet"):
                w.bonus_wallet = Decimal("0.00")
            w.save()

        # Reset WalletAccount pockets
        try:
            from accounts.models import WalletAccount, LedgerEntry, FinancialTransaction
            WalletAccount.objects.filter(user=user).update(
                current_balance=Decimal("0.00"),
                available_balance=Decimal("0.00"),
                pending_balance=Decimal("0.00"),
                locked_balance=Decimal("0.00")
            )
            LedgerEntry.objects.filter(Q(user=user) | Q(financial_transaction__user=user)).delete()
            FinancialTransaction.objects.filter(user=user).delete()
            print("7. Wallet & Pocket balances reset to 0.00.")
        except Exception as e:
            print(f"7. Pocket reset note: {e}")

        # 8. ConsumerVoucher
        if ConsumerVoucher:
            cv_deleted = ConsumerVoucher.objects.filter(Q(assigned_to=user) | Q(creator=user)).delete()
            print(f"8. ConsumerVoucher deleted: {cv_deleted}")

        # 9. CouponCode
        if CouponCode:
            cc_deleted = CouponCode.objects.filter(
                Q(assigned_consumer=user) | Q(issued_by=user)
            ).delete()
            print(f"9. CouponCode deleted: {cc_deleted}")

        # 10. AuditTrail
        audit_deleted = AuditTrail.objects.filter(
            Q(actor=user) | Q(metadata__contains={"user_id": uid})
        ).delete()
        print(f"10. AuditTrail entries deleted: {audit_deleted}")

        # 11. CustomUser action
        if action == "delete":
            if w:
                w.delete()
            user.delete()
            print(f"11. User '{uname}' completely DELETED from CustomUser table.")
        else:
            user.account_active = False
            user.is_active = True
            if hasattr(user, "current_rank"):
                user.current_rank = None
            if hasattr(user, "current_rank_id"):
                user.current_rank_id = None
            user.set_password(default_password)
            user.save()
            print(f"11. User '{uname}' RESET to unpurchased state with password '{default_password}'.")

    # Post-reset verification
    remaining_pools = list(AutoPoolAccount.objects.all().values("id", "pool_type", "owner__username"))
    print(f"--------------------------------------------------")
    print(f"Remaining AutoPoolAccount nodes in tree: {remaining_pools}")
    print(f"Action '{action}' successfully completed for {uname}.")
    print(f"==================================================")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Trikonekt User Growth Reset Utility")
    parser.add_argument("--phone", "-p", required=True, help="User phone number or username")
    parser.add_argument("--action", "-a", choices=["reset", "delete"], default="reset", help="reset (default) or delete")
    parser.add_argument("--password", default="123456", help="Default password after reset (default: 123456)")
    args = parser.parse_args()

    reset_or_delete_user(args.phone, action=args.action, default_password=args.password)
