import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

code = """
from accounts.models import (
    CustomUser, Wallet, WalletTransaction, WalletAccount,
    RewardPointsAccount, RewardPointsTransaction, ConsumerVoucher,
    LedgerEntry, FinancialTransaction
)
from business.models import (
    AutoPoolAccount, UserMatrixProgress, PromoMonthlyBox,
    PromoPurchase, SubscriptionActivation
)
from mlm_ranks.models import (
    RankUpgrade, UpgradeCommission, RankMatrixNode, RankUpgradePayment
)
from coupons.models import CouponCode, AuditTrail
from django.db import transaction

phone = '9700000001'
sponsor_phone = '9999999999'

u = CustomUser.objects.filter(phone=phone).first() or CustomUser.objects.filter(username=phone).first()
sponsor = CustomUser.objects.filter(phone=sponsor_phone).first() or CustomUser.objects.filter(username=sponsor_phone).first()

if not u:
    print(f"Error: User {phone} not found!")
    sys.exit(1)

if not sponsor:
    print(f"Error: Sponsor {sponsor_phone} not found!")
    sys.exit(1)

print(f"=== RESETTING USER {u.username} (ID: {u.id}) ===")
print(f"Setting Sponsor to: {sponsor.username} (ID: {sponsor.id})")

with transaction.atomic():
    uid = u.id

    # 1. Delete Matrix Seats & Progress
    d_seats = AutoPoolAccount.objects.filter(owner_id=uid).delete()
    d_prog = UserMatrixProgress.objects.filter(user_id=uid).delete()
    print(f"Deleted AutoPoolAccount: {d_seats[0]}, UserMatrixProgress: {d_prog[0]}")

    # 2. Delete Promo/SPP & Subscriptions
    d_box = PromoMonthlyBox.objects.filter(user_id=uid).delete()
    d_promo = PromoPurchase.objects.filter(user_id=uid).delete()
    d_sub = SubscriptionActivation.objects.filter(user_id=uid).delete()
    print(f"Deleted PromoMonthlyBox: {d_box[0]}, PromoPurchase: {d_promo[0]}, Subscriptions: {d_sub[0]}")

    # 3. Delete Rank Upgrades & Nodes
    d_upg_comm = UpgradeCommission.objects.filter(user_id=uid).delete()
    d_upg_pay = RankUpgradePayment.objects.filter(upgrade__user_id=uid).delete()
    d_upg = RankUpgrade.objects.filter(user_id=uid).delete()
    d_nodes = RankMatrixNode.objects.filter(placed_user_id=uid).delete()
    print(f"Deleted RankUpgrade: {d_upg[0]}, UpgradeCommission: {d_upg_comm[0]}, RankMatrixNode: {d_nodes[0]}")

    # 4. Delete Wallet Transactions & Reset Wallets
    d_tx = WalletTransaction.objects.filter(user_id=uid).delete()
    print(f"Deleted WalletTransaction: {d_tx[0]}")

    w = Wallet.objects.filter(user_id=uid).first()
    if w:
        w.balance = 0.00
        w.self_account_balance = 0.00
        w.withdrawable_balance = 0.00
        w.total_earnings = 0.00
        w.total_withdrawn = 0.00
        w.save()
        print("Wallet balances reset to 0.00")

    WalletAccount.objects.filter(wallet__user_id=uid).update(balance=0.00)
    RewardPointsAccount.objects.filter(user_id=uid).update(balance=0.00)
    RewardPointsTransaction.objects.filter(user_id=uid).delete()
    ConsumerVoucher.objects.filter(assigned_to_id=uid).delete()
    CouponCode.objects.filter(assigned_to_id=uid).delete()

    # 5. Reset User Profile & Configure Sponsor
    u.referred_by = sponsor
    u.registered_by = sponsor
    u.sponsor_id = sponsor.username
    u.account_active = False
    u.is_active = True
    u.role = 'user'
    u.category = 'consumer'
    u.pincode = '572106'
    u.set_password('123456')
    u.save()

    print(f"User {u.username} successfully reset and configured with Sponsor {sponsor.username}!")
    print("User is now in clean state ready for initial purchase.")
"""

run_remote(code)
