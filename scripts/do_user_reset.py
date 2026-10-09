import sys
from scripts.run_remote_helper import run_remote

RESET_SCRIPT = """
from django.db import transaction, connection
from django.db.models import Q
from decimal import Decimal
from accounts.models import (
    CustomUser, Wallet, WalletTransaction, RewardPointsAccount, 
    RewardPointsTransaction, WalletAccount, LedgerEntry, FinancialTransaction
)
from business.models import AutoPoolAccount, PromoPurchase, PromoMonthlyBox, UserMatrixProgress
from mlm_ranks.models import RankUpgrade, UpgradeCommission, RankMatrixNode, RankUpgradePayment

phone = '9700000001'
sponsor_phone = '9999999999'

user = CustomUser.objects.filter(phone=phone).first()
sponsor = CustomUser.objects.filter(phone=sponsor_phone).first()

if not user:
    print(f"[ERROR] User with phone {phone} not found.")
    sys.exit(1)
if not sponsor:
    print(f"[ERROR] Sponsor with phone {sponsor_phone} not found.")
    sys.exit(1)

print(f"Target User: {user.username} (ID: {user.id})")
print(f"Target Sponsor: {sponsor.username} (ID: {sponsor.id}, Prefixed ID: {sponsor.prefixed_id})")

with transaction.atomic():
    uid = user.id
    
    # 1. First detach children of user accounts to prevent cascade / SET_NULL collision
    user_pools = list(AutoPoolAccount.objects.filter(owner=user))
    print(f"Found {len(user_pools)} user pools: {[p.id for p in user_pools]}")
    
    for pool in user_pools:
        children = list(AutoPoolAccount.objects.filter(parent_account=pool).exclude(owner=user))
        for child in children:
            target_parent = pool.parent_account
            if not target_parent:
                target_parent = AutoPoolAccount.objects.filter(pool_type=child.pool_type, parent_account__isnull=True).first()
            
            max_pos = 5 if child.pool_type == 'FIVE_150' else 3
            taken_pos = set(AutoPoolAccount.objects.filter(parent_account=target_parent).values_list('position', flat=True))
            avail_pos = [p for p in range(1, max_pos + 1) if p not in taken_pos]
            
            if avail_pos:
                child.parent_account = target_parent
                child.position = avail_pos[0]
                child.save(update_fields=['parent_account', 'position'])
            else:
                candidates = AutoPoolAccount.objects.filter(pool_type=child.pool_type).exclude(owner=user).order_by('id')
                for c in candidates:
                    taken = set(AutoPoolAccount.objects.filter(parent_account=c).values_list('position', flat=True))
                    open_slots = [p for p in range(1, max_pos + 1) if p not in taken]
                    if open_slots and c.id != pool.id:
                        child.parent_account = c
                        child.position = open_slots[0]
                        child.save(update_fields=['parent_account', 'position'])
                        break
                        
    # Now safely delete user's AutoPoolAccounts via raw SQL leaf-first
    user_pool_ids = [p.id for p in user_pools]
    if user_pool_ids:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM business_autopoolaccount WHERE owner_id = %s AND parent_account_id IS NOT NULL", [uid])
            cursor.execute("DELETE FROM business_autopoolaccount WHERE owner_id = %s", [uid])
        print(f"1. AutoPoolAccount deleted: all rows for user ID {uid} removed cleanly via SQL.")

    # 2. UserMatrixProgress
    ump_del = UserMatrixProgress.objects.filter(user=user).delete()
    print(f"2. UserMatrixProgress deleted: {ump_del}")

    # 3. PromoMonthlyBox
    pmb_del = PromoMonthlyBox.objects.filter(user=user).delete()
    print(f"3. PromoMonthlyBox deleted: {pmb_del}")

    # 4. PromoPurchase
    pp_del = PromoPurchase.objects.filter(user=user).delete()
    print(f"4. PromoPurchase deleted: {pp_del}")

    # 5. UpgradeCommission
    uc_del = UpgradeCommission.objects.filter(Q(to_user=user) | Q(from_user=user) | Q(upgrade__user=user)).delete()
    print(f"5. UpgradeCommission deleted: {uc_del}")

    # 6. RankUpgrade, RankMatrixNode, RankUpgradePayment
    ru_del = RankUpgrade.objects.filter(user=user).delete()
    rmn_del = RankMatrixNode.objects.filter(Q(root_user_id=uid) | Q(placed_user_id=uid) | Q(parent_user_id=uid)).delete()
    rup_del = RankUpgradePayment.objects.filter(upgrade__user=user).delete()
    print(f"6. RankUpgrade: {ru_del}, RankMatrixNode: {rmn_del}, RankUpgradePayment: {rup_del}")

    # 7. WalletTransaction
    wtx_user = WalletTransaction.objects.filter(user=user).delete()
    wtx_sponsor = WalletTransaction.objects.filter(Q(meta__from_user_id=uid) | Q(meta__from_user=user.username)).delete()
    print(f"7. WalletTransaction deleted: user={wtx_user}, sponsor_meta={wtx_sponsor}")

    # 8. Reset Wallet Balances
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
        print("8. Wallet reset to 0.00.")

    # 9. WalletAccount Pockets & Ledgers
    WalletAccount.objects.filter(user=user).update(
        current_balance=Decimal("0.00"),
        available_balance=Decimal("0.00"),
        pending_balance=Decimal("0.00"),
        locked_balance=Decimal("0.00")
    )
    LedgerEntry.objects.filter(Q(user=user) | Q(financial_transaction__user=user)).delete()
    FinancialTransaction.objects.filter(user=user).delete()
    print("9. Pockets & Ledgers reset.")

    # 10. RewardPoints
    RewardPointsTransaction.objects.filter(user=user).delete()
    RewardPointsAccount.objects.filter(user=user).update(
        balance_points=Decimal("0.00")
    )
    print("10. Reward Points reset.")

    # 11. Reset CustomUser
    user.account_active = False
    user.is_active = True
    user.first_purchase_activated_at = None
    user.registered_by = sponsor
    user.sponsor_id = sponsor.prefixed_id or sponsor.phone
    user.pincode = "572106"
    if hasattr(user, "current_rank"):
        user.current_rank = None
    user.set_password("123456")
    user.save()
    print(f"11. CustomUser reset: account_active=False, sponsor_id={user.sponsor_id}, registered_by={user.registered_by.phone}, password=123456")

print("==================================================")
print("USER RESET COMPLETED SUCCESSFULLY")
print("==================================================")
"""

if __name__ == "__main__":
    run_remote(RESET_SCRIPT)
