import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "trikonekt.settings")
django.setup()

from accounts.models import CustomUser, WalletTransaction
from mlm_ranks.models import UpgradeCommission
from django.db.models import Sum, Q

u = CustomUser.objects.filter(phone='9999999999').first()
print('User:', u)
if u:
    txs = WalletTransaction.objects.filter(user=u, amount__gt=0)
    print('Total credit txs count:', txs.count())
    
    for t in txs.values('type', 'source_type').distinct():
        sub = txs.filter(type=t['type'], source_type=t['source_type'])
        print(f"type={t['type']}, source_type={t['source_type']}: count={sub.count()}, sum={sub.aggregate(s=Sum('amount'))['s']}")
        
    print('--- UpgradeCommission ---')
    for uc in UpgradeCommission.objects.filter(to_user=u).values('commission_type', 'status').distinct():
        sub = UpgradeCommission.objects.filter(to_user=u, commission_type=uc['commission_type'], status=uc['status'])
        print(f"commission_type={uc['commission_type']}, status={uc['status']}: count={sub.count()}, sum={sub.aggregate(s=Sum('commission_amount'))['s']}")
