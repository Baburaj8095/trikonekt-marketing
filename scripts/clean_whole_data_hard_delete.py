import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import transaction, connection
from django.contrib.auth import get_user_model
from accounts.models import (
    Wallet, WalletAccount, WalletTransaction, FinancialTransaction, LedgerEntry,
    ConsumerVoucher, RewardPointsAccount, RewardPointsTransaction,
    RewardPointsHold, WithdrawalRequest
)
from business.models import (
    AutoPoolAccount, SubscriptionActivation, UserMatrixProgress,
    ReferralJoinPayout, FranchisePayout, PromoPurchase, PromoProductOrder,
    Promo759Subscription, PackageInvoice
)
from mlm_ranks.models import (
    RankMatrixRoot, RankMatrixNode, RankUpgrade, UpgradeCommission,
    CommissionHold, RankUpgradePayment, Rank
)

User = get_user_model()

print("==================================================")
print("STARTING FULL SYSTEM HARD DELETE & CLEAN RESET")
print("==================================================")

with transaction.atomic():
    # 1. HARD DELETE all Transactional & Financial Records
    deleted_counts = {}
    
    deleted_counts['WalletTransaction'] = WalletTransaction.objects.all().delete()[0]
    deleted_counts['LedgerEntry'] = LedgerEntry.objects.all().delete()[0]
    deleted_counts['FinancialTransaction'] = FinancialTransaction.objects.all().delete()[0]
    deleted_counts['ConsumerVoucher'] = ConsumerVoucher.objects.all().delete()[0]
    deleted_counts['RewardPointsTransaction'] = RewardPointsTransaction.objects.all().delete()[0]
    deleted_counts['RewardPointsHold'] = RewardPointsHold.objects.all().delete()[0]
    deleted_counts['WithdrawalRequest'] = WithdrawalRequest.objects.all().delete()[0]
    deleted_counts['SubscriptionActivation'] = SubscriptionActivation.objects.all().delete()[0]
    deleted_counts['UserMatrixProgress'] = UserMatrixProgress.objects.all().delete()[0]
    deleted_counts['ReferralJoinPayout'] = ReferralJoinPayout.objects.all().delete()[0]
    deleted_counts['FranchisePayout'] = FranchisePayout.objects.all().delete()[0]
    deleted_counts['PromoPurchase'] = PromoPurchase.objects.all().delete()[0]
    deleted_counts['PromoProductOrder'] = PromoProductOrder.objects.all().delete()[0]
    deleted_counts['Promo759Subscription'] = Promo759Subscription.objects.all().delete()[0]
    deleted_counts['PackageInvoice'] = PackageInvoice.objects.all().delete()[0]

    # 2. HARD DELETE all MLM Rank & Tree Nodes
    deleted_counts['CommissionHold'] = CommissionHold.objects.all().delete()[0]
    deleted_counts['RankUpgradePayment'] = RankUpgradePayment.objects.all().delete()[0]
    deleted_counts['UpgradeCommission'] = UpgradeCommission.objects.all().delete()[0]
    deleted_counts['RankUpgrade'] = RankUpgrade.objects.all().delete()[0]
    deleted_counts['RankMatrixNode'] = RankMatrixNode.objects.all().delete()[0]
    deleted_counts['RankMatrixRoot'] = RankMatrixRoot.objects.all().delete()[0]

    # 3. Clean AutoPool Accounts (Non-sentinel or wipe with raw SQL truncate / delete cascade)
    cursor = connection.cursor()
    cursor.execute("DELETE FROM business_autopoolaccount WHERE source_type != 'SENTINEL';")
    deleted_counts['AutoPoolAccount (Non-Sentinel)'] = cursor.rowcount

    # 4. Remove test downline users (keeping only admin and 9999999999)
    test_users = User.objects.exclude(username__in=['admin', '9999999999'])
    for tu in test_users:
        print(f"Hard deleting test user: {tu.username} (ID {tu.id})")
        tu.delete()

    # 5. HARD RESET all WalletAccount balances to 0.00
    for wa in WalletAccount.objects.all():
        wa.current_balance = Decimal("0.00")
        wa.available_balance = Decimal("0.00")
        wa.locked_balance = Decimal("0.00")
        wa.pending_balance = Decimal("0.00")
        wa.save(update_fields=['current_balance', 'available_balance', 'locked_balance', 'pending_balance'])
    
    # 6. HARD RESET legacy Wallets
    for w in Wallet.objects.all():
        w.franchise_total_earning = Decimal("0.00")
        w.franchise_active_work = Decimal("0.00")
        w.franchise_inactive_work = Decimal("0.00")
        w.franchise_self_rebirth = Decimal("0.00")
        w.franchise_company_marketing = Decimal("0.00")
        w.franchise_reward_points = Decimal("0.00")
        w.franchise_shopping_scanner = Decimal("0.00")
        w.save()

    # 7. HARD RESET RewardPointsAccount
    for rp in RewardPointsAccount.objects.all():
        rp.balance = Decimal("0.00")
        rp.total_earned = Decimal("0.00")
        rp.total_redeemed = Decimal("0.00")
        rp.total_held = Decimal("0.00")
        rp.save()

    # 8. Re-initialize Official Top Root Sponsor 9999999999
    root_user = User.objects.filter(username='9999999999').first()
    admin_user = User.objects.filter(username='admin').first()

    if root_user:
        root_user.sponsor_id = f"TR-{root_user.id:010d}"
        root_user.set_password("123456")
        root_user.save()

        # Initialize RankMatrixRoot for 9999999999 (L1 Prime Starter)
        l1_rank = Rank.objects.filter(level_number=1).first() or Rank.objects.first()
        if l1_rank:
            RankMatrixRoot.objects.create(root_user=root_user, rank=l1_rank)
            print(f"Re-initialized RankMatrixRoot for 9999999999 (Rank: {l1_rank.rank_name})")

    # 9. Ensure Clean AutoPool Sentinel Roots for admin
    if admin_user:
        for pool in ['FIVE_150', 'THREE_150']:
            ap = AutoPoolAccount.objects.filter(pool_type=pool, source_type='SENTINEL').first()
            if not ap:
                AutoPoolAccount.objects.create(
                    owner=admin_user,
                    username_key='admin',
                    entry_amount=Decimal('0.00'),
                    pool_type=pool,
                    status='ACTIVE',
                    user_entry_index=1,
                    position=None,
                    source_type='SENTINEL',
                    source_id=pool,
                    parent_account=None,
                    level=0
                )
        print("Verified AutoPool sentinel roots for admin.")

print("\n--- DELETED RECORDS SUMMARY (HARD DELETED) ---")
for k, v in deleted_counts.items():
    print(f"  {k}: {v} deleted")

print("\n--- REMAINING USERS ---")
for u in User.objects.all():
    print(f"  User: {u.username} (ID {u.id}) | Role: {u.role} | Sponsor: {u.sponsor_id}")

print("\n--- REMAINING WALLETS & BALANCES ---")
for wa in WalletAccount.objects.all():
    print(f"  WA ID {wa.id} | User: {wa.user.username} | Type: {wa.wallet_type} | Bal: {wa.current_balance}")

print("\n==================================================")
print("CLEAN RESET COMPLETE - SYSTEM IS 100% FRESH")
print("==================================================")
