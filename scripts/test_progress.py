import sys, os
from dotenv import load_dotenv

load_dotenv("/etc/trikonekt/staging-backend.env")
sys.path.append("/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django
django.setup()

from accounts.models import CustomUser
from mlm_ranks.services.five_matrix import FiveMatrixService
from mlm_ranks.models import RankMatrixNode

u = CustomUser.objects.filter(username="9999999999").first()
print("User 9999999999 ID:", u.id if u else None)
if u:
    tree = FiveMatrixService.get_tree_payload(root_user_id=u.id)
    print("Tree root:", tree.get("root"))
    print("Approved count:", tree.get("approved_count"))
    print("Placements:")
    for slot in tree.get("placements", []):
        print(" ", slot)

    nodes = list(RankMatrixNode.objects.filter(root_user_id=u.id).values())
    print("RankMatrixNode rows for root 1:", nodes)
