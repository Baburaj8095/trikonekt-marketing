import sys, os
env_path = "/etc/trikonekt/staging-backend.env"
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from accounts.models import CustomUser, WalletTransaction
from django.db.models import Sum

print("=== CHECKING RANK_OVERFLOW TRANSACTIONS ON EC2 ===")
overflow_txs = WalletTransaction.objects.filter(type="RANK_OVERFLOW")
print(f"Total RANK_OVERFLOW count: {overflow_txs.count()}")
total_overflow = overflow_txs.aggregate(s=Sum("amount"))["s"] or 0
print(f"Total RANK_OVERFLOW amount: Rs. {total_overflow}")

for tx in overflow_txs[:15]:
    print(f"  TX #{tx.id} | User: {getattr(tx.user, 'username', None)} | Amt: Rs.{tx.amount} | Meta: {tx.meta}")
