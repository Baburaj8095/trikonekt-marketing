import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.apps import apps
from accounts.models import (
    Wallet, WalletTransaction, FinancialTransaction, LedgerEntry,
    ConsumerVoucher, RewardPointsAccount, RewardPointsTransaction,
    RewardPointsHold, WithdrawalRequest
)
from business.models import (
    AutoPoolAccount, SubscriptionActivation, UserMatrixProgress,
    ReferralJoinPayout, FranchisePayout, PromoPurchase, PromoProductOrder
)
from mlm_ranks.models import (
    RankMatrixRoot, RankMatrixNode, RankUpgrade, UpgradeCommission,
    CommissionHold, RankUpgradePayment
)

User = get_user_model()

print("--- USERS IN SYSTEM ---")
for u in User.objects.all().order_by('id'):
    print(f"ID: {u.id} | Username: {u.username} | Role: {getattr(u, 'role', '')} | Sponsor: {getattr(u, 'sponsor_id', '')}")

print("\n--- RECORD COUNTS ACROSS SYSTEM ---")
print("Wallets:", Wallet.objects.count())
print("WalletTransactions:", WalletTransaction.objects.count())
print("FinancialTransactions:", FinancialTransaction.objects.count())
print("LedgerEntries:", LedgerEntry.objects.count())
print("ConsumerVouchers:", ConsumerVoucher.objects.count())
print("RewardPointsAccounts:", RewardPointsAccount.objects.count())
print("RewardPointsTransactions:", RewardPointsTransaction.objects.count())
print("WithdrawalRequests:", WithdrawalRequest.objects.count())
print("AutoPoolAccounts:", AutoPoolAccount.objects.count())
print("SubscriptionActivations:", SubscriptionActivation.objects.count())
print("UserMatrixProgress:", UserMatrixProgress.objects.count())
print("ReferralJoinPayouts:", ReferralJoinPayout.objects.count())
print("FranchisePayouts:", FranchisePayout.objects.count())
print("RankMatrixRoots:", RankMatrixRoot.objects.count())
print("RankMatrixNodes:", RankMatrixNode.objects.count())
print("RankUpgrades:", RankUpgrade.objects.count())
print("UpgradeCommissions:", UpgradeCommission.objects.count())
print("CommissionHolds:", CommissionHold.objects.count())
