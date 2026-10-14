import sys
import os

env_file = "/etc/trikonekt/staging-backend.env"
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

staging_backend_dir = os.environ.get("GROWTH_BACKEND_DIR", "/srv/trikonekt/staging/backend")
if os.path.exists(staging_backend_dir):
    sys.path.insert(0, staging_backend_dir)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from accounts.models import CustomUser, WalletTransaction
from business.models import PromoPurchase, AutoPoolAccount

u = CustomUser.objects.filter(phone='9000000006').first()
print(f"User 9000000006: ID={u.id}, username={u.username}, phone={u.phone}")

for p in PromoPurchase.objects.filter(user=u):
    print(f"PromoPurchase: pkg_id={p.package_id}, status={p.status}, amount={getattr(p, 'amount', getattr(p, 'price', getattr(p, 'total_amount', 'N/A')))}")

for ap in AutoPoolAccount.objects.filter(owner=u):
    print(f"AutoPoolAccount: pool={ap.pool_type}, level={ap.level}, parent={ap.parent_account_id}")

txs = WalletTransaction.objects.filter(user=u).order_by('id')
print(f"WalletTransactions of 9000000006 ({txs.count()}):")
for t in txs:
    print(f"  Type={t.type}, Amount={t.amount}, Desc={t.description}")
