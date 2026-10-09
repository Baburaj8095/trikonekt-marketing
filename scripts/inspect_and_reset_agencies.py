import sys
from scripts.run_remote_helper import run_remote

RESET_AGENCIES_SCRIPT = """
from django.db import transaction
from django.db.models import Q
from decimal import Decimal
from accounts.models import (
    CustomUser, Wallet, WalletTransaction, RewardPointsAccount, 
    RewardPointsTransaction, WalletAccount, LedgerEntry, FinancialTransaction
)

agency_phones = ['9800000001', '9800000002', '9800000003', '9800000004', '9800000005', '9800000006']
users = list(CustomUser.objects.filter(phone__in=agency_phones).order_by('id'))

print(f"Found {len(users)} agency users to reset:")
for u in users:
    print(f"  - ID: {u.id}, Username: {u.username}, Phone: {u.phone}")

with transaction.atomic():
    for u in users:
        uid = u.id
        
        # 1. Delete all WalletTransaction records for this agency
        tx_deleted, _ = WalletTransaction.objects.filter(user=u).delete()
        
        # 2. Delete LedgerEntry and FinancialTransaction
        le_deleted, _ = LedgerEntry.objects.filter(Q(user=u) | Q(financial_transaction__user=u)).delete()
        ft_deleted, _ = FinancialTransaction.objects.filter(user=u).delete()
        
        # 3. Reset Wallet balance fields to 0.00
        w = Wallet.objects.filter(user=u).first()
        if w:
            w.balance = Decimal("0.00")
            w.main_balance = Decimal("0.00")
            w.withdrawable_balance = Decimal("0.00")
            if hasattr(w, "total_earnings"):
                w.total_earnings = Decimal("0.00")
            if hasattr(w, "total_withdrawn"):
                w.total_withdrawn = Decimal("0.00")
            if hasattr(w, "self_account_balance"):
                w.self_account_balance = Decimal("0.00")
            if hasattr(w, "bonus_wallet"):
                w.bonus_wallet = Decimal("0.00")
            w.save()
        else:
            w = Wallet.objects.create(
                user=u,
                balance=Decimal("0.00"),
                main_balance=Decimal("0.00"),
                withdrawable_balance=Decimal("0.00")
            )
            
        # 4. Reset WalletAccount pockets
        WalletAccount.objects.filter(user=u).update(
            current_balance=Decimal("0.00"),
            available_balance=Decimal("0.00"),
            pending_balance=Decimal("0.00"),
            locked_balance=Decimal("0.00")
        )
        
        # 5. Reset RewardPointsAccount
        RewardPointsTransaction.objects.filter(user=u).delete()
        RewardPointsAccount.objects.filter(user=u).update(balance_points=Decimal("0.00"))
        
        print(f"Reset {u.username} ({u.phone}): Deleted {tx_deleted} WalletTx, {le_deleted} Ledgers, {ft_deleted} FinTx. Balances set to 0.00.")

print("==================================================")
print("ALL 6 AGENCIES WALLET HISTORY CLEARED SUCCESSFULLY")
print("==================================================")
"""

if __name__ == "__main__":
    run_remote(RESET_AGENCIES_SCRIPT)
