import os
import sys

sys.path.insert(0, '/srv/trikonekt/staging/backend')
env_file = "/etc/trikonekt/staging-backend.env"
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from mlm_ranks.models import RankUpgrade, RankMatrixNode
from mlm_ranks.services.five_matrix import FiveMatrixService

ru = RankUpgrade.objects.get(id=214)
FiveMatrixService.on_rank1_approval(ru)

node = RankMatrixNode.objects.filter(placed_user=ru.user).first()
if node:
    print(f"SUCCESS! Node placed: Root={node.root_user.username}, Parent={node.parent_user.username}, Pos={node.position}, Depth={node.level_depth}")
else:
    print("Node not placed.")
