from scripts.run_remote_helper import run_remote

VERIFY_SCRIPT = """
from accounts.models import CustomUser, Wallet, WalletTransaction, RewardPointsAccount
from business.models import AutoPoolAccount, PromoPurchase, PromoMonthlyBox, UserMatrixProgress
from mlm_ranks.models import RankUpgrade

u = CustomUser.objects.filter(phone='9700000001').first()
w = Wallet.objects.filter(user=u).first()
rp = RewardPointsAccount.objects.filter(user=u).first()

print('=== USER VERIFICATION ===')
print('Phone:', u.phone)
print('Account Active:', u.account_active)
print('Sponsor ID:', u.sponsor_id)
print('Registered By Phone:', u.registered_by.phone if u.registered_by else None)
print('Pincode:', u.pincode)
print('AutoPool Accounts Count:', AutoPoolAccount.objects.filter(owner=u).count())
print('UserMatrixProgress Count:', UserMatrixProgress.objects.filter(user=u).count())
print('PromoPurchases Count:', PromoPurchase.objects.filter(user=u).count())
print('PromoMonthlyBox Count:', PromoMonthlyBox.objects.filter(user=u).count())
print('RankUpgrade Count:', RankUpgrade.objects.filter(user=u).count())
print('Wallet Balances:', {'balance': str(w.balance), 'main': str(w.main_balance), 'withdrawable': str(w.withdrawable_balance)} if w else None)
print('Reward Points:', str(rp.balance_points) if rp else None)
print('Wallet Tx Count:', WalletTransaction.objects.filter(user=u).count())
"""

if __name__ == "__main__":
    run_remote(VERIFY_SCRIPT)
