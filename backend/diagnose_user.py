import os
import sys
import django

sys.path.append('/srv/trikonekt/app/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from accounts.models import CustomUser, WalletTransaction
from accounts.views import _consumer_coupon_balances, _coupon_wallet_balance

try:
    user = CustomUser.objects.filter(username='9999999999').first()
    if not user:
        print("User 9999999999 not found!")
    else:
        print("User ID:", user.id)
        balances = _consumer_coupon_balances(user)
        print("Balances computed:", balances)
        
        print("\nRecent 20 transactions:")
        txs = WalletTransaction.objects.filter(user=user).order_by('-id')[:20]
        for t in txs:
            print(f"{t.id} | {t.type} | {t.amount} | {t.created_at}")
except Exception as e:
    print("Error:", e)
