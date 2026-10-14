import os
import sys

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

if os.path.exists('/etc/trikonekt/staging-backend.env'):
    with open('/etc/trikonekt/staging-backend.env') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip().strip('"\'')

import django
django.setup()
from accounts.models import WalletTransaction

print('--- Sample transactions for MATRIX and LEVEL and E-EDU ---')
txs = WalletTransaction.objects.filter(
    type__in=['AUTOPOOL_BONUS_FIVE', 'AUTOPOOL_BONUS_THREE', 'LEVEL_BONUS', 'INCOME_CREDIT_75', 'DIRECT_REF_BONUS']
).order_by('-id')[:30]

for t in txs:
    print(f"ID: {t.id} | Type: {t.type} | SrcType: {t.source_type} | Amt: {t.amount} | Meta: {t.meta}")
