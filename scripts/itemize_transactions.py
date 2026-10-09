import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from accounts.models import WalletTransaction, WalletAccount

User = get_user_model()

u_root = User.objects.filter(username='9999999999').first()
u_buyer = User.objects.filter(username='8095918105').first()

txs = WalletTransaction.objects.filter(user=u_root).order_by('id')

print("ID   | Type                | Amount  | Main (75%) | Self (25%) | Description / Trigger")
print("-" * 80)

total_gross = 0
total_main = 0
total_self = 0

for wt in txs:
    meta = wt.meta or {}
    from_u = str(meta.get('from_user') or meta.get('from_user_id') or '')
    if '8095918105' in from_u or '81' in from_u:
        amt = float(wt.amount)
        gross = float(meta.get('gross') or amt)
        ledger = meta.get('ledger') or ('MAIN' if '75' in wt.type else 'SELF')
        
        # We group or print
        print(f"{wt.id:<5d}| {wt.type:<20s}| ₹{amt:7.2f} | Ledger: {ledger:<10s} | Src: {wt.source_type} | Kind: {meta.get('kind', meta.get('orig_type'))}")

print("\n--- WALLET ACCOUNTS SUMMARY FOR 9999999999 ---")
for wa in WalletAccount.objects.filter(user=u_root):
    print(f"  {wa.wallet_type:20s}: ₹{wa.current_balance:8.2f}")
