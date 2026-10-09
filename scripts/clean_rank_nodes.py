import sys, os
from dotenv import load_dotenv

load_dotenv("/etc/trikonekt/staging-backend.env")
sys.path.append("/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django
django.setup()

from django.db.models import F
from mlm_ranks.models import RankMatrixNode

bad_nodes = RankMatrixNode.objects.filter(root_user_id=F("placed_user_id"))
print("Found bad self-placed nodes count:", bad_nodes.count())
for b in bad_nodes:
    print("Deleting node:", b.id, "root:", b.root_user_id, "placed:", b.placed_user_id, "parent:", b.parent_user_id)
deleted = bad_nodes.delete()
print("Delete result:", deleted)

all_nodes = list(RankMatrixNode.objects.filter(root_user_id=1).values())
print("Remaining nodes for root_user_id=1:", all_nodes)
