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
from business.models import PromoPurchase, AutoPoolAccount, PromoMonthlyBox
from accounts.models import WalletTransaction, WalletAccount

with open("/tmp/activity.txt", "w") as out:
    out.write("--- ALL PROMO PURCHASES IN DB ---\n")
    for p in PromoPurchase.objects.all():
        out.write(f"ID={p.id}, User={p.user.username}, package={p.package.code if p.package else None}, status={p.status}\n")

    out.write("\n--- ALL MONTHLY BOXES IN DB ---\n")
    for b in PromoMonthlyBox.objects.all():
        out.write(f"User={b.user.username}, month={b.month_number}, status={b.status}\n")

    out.write("\n--- AUTOPOOL ACCOUNTS ---\n")
    for a in AutoPoolAccount.objects.all().order_by("id"):
        out.write(f"Pool ID={a.id}, owner={a.owner.username}, pool={a.pool_type}, source={a.source_type}, index={a.user_entry_index}, pos={a.position}, parent={a.parent_account_id}\n")

    out.write("\n--- WALLET TRANSACTIONS ---\n")
    for t in WalletTransaction.objects.all().order_by("-id")[:20]:
        out.write(f"Tx ID={t.id}, user={t.user.username}, type={t.type}, amt={t.amount}, desc={t.description}\n")

    out.write("\n--- WALLET BALANCES ---\n")
    for w in WalletAccount.objects.all():
        out.write(f"User={w.user.username}, type={w.wallet_type}, balance={w.current_balance}\n")
