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
from mlm_ranks.models import RankUpgrade, UpgradeCommission, RankMatrixNode, RankMatrixRoot, UserRank

print("--- ALL RankMatrixNodes ---")
for n in RankMatrixNode.objects.all().order_by('id'):
    pu = n.parent_user.phone if n.parent_user else "Root"
    u = n.placed_user.phone if n.placed_user else "None"
    print(f"Node id={n.id}, placed={u}, parent={pu}, level={n.level_depth}, pos={n.position}")

print("\n--- Recent RankUpgrades ---")
for up in RankUpgrade.objects.all().order_by('-id')[:20]:
    u_p = up.user.phone if up.user else "None"
    to_l = up.to_rank.level_number if up.to_rank else None
    print(f"Upgrade id={up.id}, user={u_p}, to_level={to_l}, amt={up.upgrade_amount}, status={up.payment_status}, created={up.created_at}")

print("\n--- Recent UpgradeCommissions ---")
for c in UpgradeCommission.objects.all().order_by('-id')[:20]:
    b_p = c.beneficiary.phone if c.beneficiary else "None/Overhead"
    src_u = c.upgrade.user.phone if c.upgrade and c.upgrade.user else "None"
    lvl = getattr(c, 'level_index', getattr(c, 'distance', getattr(c, 'matrix_level', 'unknown')))
    print(f"Commission id={c.id}, from={src_u}, to={b_p}, amt={c.amount}, level={lvl}, status={c.status}, reason={getattr(c, 'hold_reason', '')}")
