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
from mlm_ranks.models import RankMatrixNode, RankUpgrade, UpgradeCommission

print("=== CHECKING RankMatrixNode ON EC2 ===")
print("Total RankMatrixNode count:", RankMatrixNode.objects.count())
for node in RankMatrixNode.objects.all()[:20]:
    print(f"Node #{node.id}: placed_user={getattr(node.placed_user, 'username', None)} -> parent_user={getattr(node.parent_user, 'username', None)}")

print("\n=== CHECKING UpgradeCommission ON EC2 ===")
print("Total UpgradeCommission count:", UpgradeCommission.objects.count())
for uc in UpgradeCommission.objects.all()[:30]:
    print(f"UC #{uc.id} | Upgrade #{uc.upgrade_id} | Type: {uc.commission_type} | From: {getattr(uc.from_user, 'username', None)} -> To: {getattr(uc.to_user, 'username', None)} | Lvl: {uc.level} | Amt: {uc.commission_amount} | Status: {uc.status}")
