import os, sys

sys.path.append("/srv/trikonekt/staging/backend")
if os.path.exists("/etc/trikonekt/staging-backend.env"):
    with open("/etc/trikonekt/staging-backend.env") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from django.contrib.auth import get_user_model
from business.services.monthly import distribute_monthly_759_payouts
from business.models import PromoPurchase, AutoPoolAccount
from accounts.models import WalletTransaction, WalletAccount

User = get_user_model()
u = User.objects.filter(username="9999999999").first()
p_spp = PromoPurchase.objects.filter(id=2).first()

with open("/tmp/monthly_res.txt", "w") as out:
    out.write("RUNNING distribute_monthly_759_payouts for user 9999999999 and PromoPurchase #2:\n")
    try:
        res = distribute_monthly_759_payouts(u, is_first_month=True, source={"type": "MONTHLY_FIRST_SEASON-1", "id": p_spp.id})
        out.write(f"RESULT: {res}\n")
    except Exception as e:
        import traceback
        out.write(traceback.format_exc())

    out.write("\nAUTOPOOL ACCOUNTS FOR USER:\n")
    for a in AutoPoolAccount.objects.filter(owner=u):
        out.write(f"ID={a.id}, pool={a.pool_type}, source={a.source_type}, index={a.user_entry_index}\n")

    out.write("\nWALLET TRANSACTIONS FOR USER:\n")
    for t in WalletTransaction.objects.filter(user=u):
        out.write(f"ID={t.id}, type={t.type}, amt={t.amount}, source={t.source_type}:{t.source_id}\n")

    out.write("\nSPONSOR (admin) TRANSACTIONS:\n")
    admin = User.objects.filter(username="admin").first()
    for t in WalletTransaction.objects.filter(user=admin):
        out.write(f"ID={t.id}, type={t.type}, amt={t.amount}, source={t.source_type}:{t.source_id}\n")
