import os
import sys
import argparse
from decimal import Decimal

# Setup Django environment
if '/srv/trikonekt/staging/backend' not in sys.path:
    sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

from django.db import transaction, models
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import AutoPoolAccount
from accounts.wallet_engine import WalletEngine

def cleanup_unfunded_rebirths(phone='9999999999', dry_run=True):
    user = CustomUser.objects.filter(phone=phone).first()
    if not user:
        print(f"Error: User with phone {phone} not found.")
        return

    w = Wallet.get_or_create_for_user(user)

    # 1. Calculate funded ceiling
    total_self_cr = WalletTransaction.objects.filter(
        user=user, amount__gt=0, type="SELF_ACCOUNT_CREDIT"
    ).aggregate(total=models.Sum("amount"))["total"] or Decimal("0.00")

    max_funded_packs = int(total_self_cr // Decimal("250.00"))
    total_debits_qs = WalletTransaction.objects.filter(
        user=user, type="SELF_ACCOUNT_DEBIT"
    ).order_by("id")

    total_debits_count = total_debits_qs.count()
    excess_count = max(0, total_debits_count - max_funded_packs)

    print("==================================================")
    print(f"CLEANUP AUDIT FOR USER {user.phone} ({user.username})")
    print("==================================================")
    print(f"Total 25% Self Credits: ₹{total_self_cr:,.2f}")
    print(f"Max Legitimate Funded IDs: {max_funded_packs}")
    print(f"Current Recorded Debit IDs: {total_debits_count}")
    print(f"Excess Unfunded IDs to Remove: {excess_count}")
    print(f"Dry Run Mode: {dry_run}")
    print("--------------------------------------------------")

    if excess_count == 0:
        print("Everything is already in balance. No excess IDs found.")
        return

    # Identify the excess debits (the latest excess_count transactions)
    excess_debits = list(total_debits_qs.reverse()[:excess_count])
    excess_debit_ids = [tx.id for tx in excess_debits]

    # Extract pack indexes from source_id or meta
    pack_indexes_to_remove = set()
    for tx in excess_debits:
        sid = str(tx.source_id or "").strip()
        if sid.isdigit():
            pack_indexes_to_remove.add(sid)
        meta_idx = tx.meta.get("pack_index") if tx.meta else None
        if meta_idx:
            pack_indexes_to_remove.add(str(meta_idx))

    print(f"Targeting {len(excess_debit_ids)} WalletTransaction rows to remove.")
    print(f"Targeted pack indexes: {sorted(list(pack_indexes_to_remove), key=lambda x: int(x) if x.isdigit() else 0)}")

    # Target matching AutoPoolAccount seats
    excess_m5_seats = AutoPoolAccount.objects.filter(
        owner=user,
        pool_type="FIVE_150",
        source_type="SELF_REBIRTH_250",
        source_id__in=pack_indexes_to_remove
    )
    excess_m3_seats = AutoPoolAccount.objects.filter(
        owner=user,
        pool_type="THREE_150",
        source_type="SELF_REBIRTH_250",
        source_id__in=pack_indexes_to_remove
    )

    print(f"Targeting {excess_m5_seats.count()} 5-Matrix Rebirth seats to remove.")
    print(f"Targeting {excess_m3_seats.count()} 3-Matrix Rebirth seats to remove.")

    expected_residual_balance = total_self_cr - (Decimal(max_funded_packs) * Decimal("250.00"))
    print(f"Expected Residual Self Account Balance: ₹{expected_residual_balance:.2f}")

    if dry_run:
        print("\n[DRY RUN COMPLETE] No database changes were made.")
        print("To execute these removals, run with: --commit")
        return

    # Execute removal within a safe atomic transaction block
    with transaction.atomic():
        deleted_m5, _ = excess_m5_seats.delete()
        deleted_m3, _ = excess_m3_seats.delete()
        deleted_txs, _ = WalletTransaction.objects.filter(id__in=excess_debit_ids).delete()

        # Update wallet balance to legitimate residual amount
        w = Wallet.objects.select_for_update().get(pk=w.pk)
        w.self_account_balance = expected_residual_balance
        w.save(update_fields=["self_account_balance", "updated_at"])

        # Reconcile double-entry WalletEngine
        try:
            WalletEngine.reconcile_wallet_accounts(user)
        except Exception as e:
            print(f"WalletEngine reconciliation warning: {e}")

    print("\n==================================================")
    print("SUCCESSFULLY APPLIED CLEANUP")
    print("==================================================")
    print(f"Deleted {deleted_txs} WalletTransaction debit rows.")
    print(f"Deleted {deleted_m5} 5-Matrix Rebirth seats.")
    print(f"Deleted {deleted_m3} 3-Matrix Rebirth seats.")
    print(f"Reconciled Self Account Pocket balance to: ₹{expected_residual_balance:.2f}")
    print("==================================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cleanup unfunded rebirth IDs")
    parser.add_argument("--phone", default="9999999999", help="Phone number of the root user")
    parser.add_argument("--commit", action="store_true", help="Commit changes to database")
    args = parser.parse_args()

    cleanup_unfunded_rebirths(phone=args.phone, dry_run=not args.commit)
