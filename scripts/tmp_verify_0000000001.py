
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import AutoPoolAccount, PromoPurchase, PromoMonthlyBox
from mlm_ranks.models import RankUpgrade, UpgradeCommission

u = CustomUser.objects.filter(username='0000000001').first() or CustomUser.objects.filter(phone='0000000001').first()
if not u:
    print("User 0000000001 not found.")
else:
    print(f"USER: ID={u.id}, username={u.username}, phone={u.phone}, active={u.account_active}")
    print(f"PromoPurchase: {PromoPurchase.objects.filter(user=u).count()}")
    print(f"PromoMonthlyBox: {PromoMonthlyBox.objects.filter(user=u).count()}")
    print(f"AutoPoolAccount: {AutoPoolAccount.objects.filter(owner=u).count()}")
    print(f"RankUpgrade: {RankUpgrade.objects.filter(user=u).count()}")
    print(f"UpgradeCommission (to or from): {UpgradeCommission.objects.filter(to_user=u).count() + UpgradeCommission.objects.filter(from_user=u).count()}")
    print(f"WalletTransaction (direct): {WalletTransaction.objects.filter(user=u).count()}")
    print(f"WalletTransaction (from as sponsor): {WalletTransaction.objects.filter(meta__from_user_id=u.id).count()}")
    w = Wallet.objects.filter(user=u).first()
    if w:
        print(f"Wallet: balance={w.balance}, main={w.main_balance}, withdrawable={w.withdrawable_balance}, self={getattr(w, 'self_account_balance', 0)}")
