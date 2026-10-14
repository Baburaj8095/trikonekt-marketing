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

from accounts.models import CustomUser
from mlm_ranks.models import RankUpgrade, UpgradeCommission

users_to_check = ["9008420822", "7483362779", "9110201094", "7026122552"]
for ustr in users_to_check:
    u = CustomUser.objects.filter(username=ustr).first()
    if not u:
        continue
    print(f"\n================ UPGRADES FOR {u.username} (ID {u.id}) ================")
    upgs = RankUpgrade.objects.filter(user=u).order_by("id")
    for up in upgs:
        comms = UpgradeCommission.objects.filter(upgrade=up)
        comms_str = ", ".join([f"{c.commission_type} to {getattr(c.to_user, 'username', None)} (Rs.{c.commission_amount})" for c in comms])
        print(f"Upgrade #{up.id} | L{up.from_rank.level_number}->L{up.to_rank.level_number} | status: {up.payment_status} | Comms ({comms.count()}): [{comms_str}]")
