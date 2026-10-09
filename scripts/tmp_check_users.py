
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import AutoPoolAccount, PromoPurchase, PromoMonthlyBox
from mlm_ranks.models import RankUpgrade, UpgradeCommission

phones = ['9999999999', '8095918105']
users = CustomUser.objects.filter(phone__in=phones) | CustomUser.objects.filter(username__in=phones)
print("FOUND USERS:", [(u.id, u.username, u.phone, u.account_active) for u in users])

for u in users:
    uid = u.id
    uname = u.username
    print(f"\n==========================================")
    print(f"Data for user {uname} (ID: {uid}):")
    print(f"PromoPurchase: {PromoPurchase.objects.filter(user=u).count()}")
    print(f"PromoMonthlyBox: {PromoMonthlyBox.objects.filter(user=u).count()}")
    print(f"AutoPoolAccount: {AutoPoolAccount.objects.filter(owner=u).count()}")
    print(f"RankUpgrade: {RankUpgrade.objects.filter(user=u).count()}")
    print(f"UpgradeCommission (to or from): {UpgradeCommission.objects.filter(to_user=u).count() + UpgradeCommission.objects.filter(from_user=u).count()}")
    print(f"WalletTransaction (direct): {WalletTransaction.objects.filter(user=u).count()}")
    print(f"WalletTransaction (from as sponsor): {WalletTransaction.objects.filter(meta__from_user_id=uid).count()}")
    w = Wallet.objects.filter(user=u).first()
    if w:
        print(f"Wallet: balance={w.balance}, main={w.main_balance}, withdrawable={w.withdrawable_balance}, self={getattr(w, 'self_account_balance', 0)}")
