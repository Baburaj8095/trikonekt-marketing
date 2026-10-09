import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from accounts.models import WalletTransaction, LedgerEntry, WalletAccount
from business.models import CommissionConfig, PromoPurchase, Promo759Subscription

User = get_user_model()

u_root = User.objects.filter(username='9999999999').first()
u_buyer = User.objects.filter(username='8095918105').first()

print(f"ROOT USER: {u_root} (ID {u_root.id if u_root else None})")
print(f"BUYER USER: {u_buyer} (ID {u_buyer.id if u_buyer else None})")

print("\n=======================================================")
print("TRANSACTIONS CREDITED TO 9999999999 FROM 8095918105:")
print("=======================================================")

txs = WalletTransaction.objects.filter(user=u_root).order_by('id')
total_credited = 0
for wt in txs:
    meta = wt.meta or {}
    from_u = str(meta.get('from_user') or meta.get('from_user_id') or meta.get('payer') or '')
    if '8095918105' in from_u or str(u_buyer.id) in from_u or '8095' in str(wt.meta):
        print(f"TX #{wt.id:4d} | Amount: ₹{wt.amount:7.2f} | Type: {wt.type:20s} | Src: {wt.source_type:20s} | Ledger: {meta.get('ledger')}")
        print(f"          | Meta: {meta}")
        total_credited += float(wt.amount)

print(f"\nTOTAL RECEIVED BY 9999999999 DIRECTLY FROM 8095918105: ₹{total_credited:.2f}")

print("\n--- WALLET BALANCES OF 9999999999 ---")
for wa in WalletAccount.objects.filter(user=u_root):
    print(f"  {wa.wallet_type:22s}: Current = ₹{wa.current_balance:8.2f} | Available = ₹{wa.available_balance:8.2f}")
