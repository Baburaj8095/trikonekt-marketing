import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from accounts.models import WalletTransaction, WalletAccount

User = get_user_model()

u_root = User.objects.filter(username='9999999999').first()
u_buyer = User.objects.filter(username='8095918105').first()

print("ALL TRANSACTIONS TO 9999999999 FROM 8095918105 (IN CHRONOLOGICAL ORDER):")
txs = WalletTransaction.objects.filter(user=u_root).order_by('id')
for wt in txs:
    meta = wt.meta or {}
    from_u = str(meta.get('from_user') or meta.get('from_user_id') or meta.get('payer') or '')
    if '8095918105' in from_u or str(u_buyer.id) in from_u or '8095' in str(wt.meta):
        print(f"TX #{wt.id} | Amount: ₹{wt.amount:7.2f} | Src: {wt.source_type:22s} | Type: {wt.type:20s} | Meta: {meta}")
