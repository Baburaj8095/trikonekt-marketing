import sys, os
from dotenv import load_dotenv

load_dotenv("/etc/trikonekt/staging-backend.env")
sys.path.append("/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django
django.setup()

from django.db import transaction
from mlm_ranks.models import RankMatrixNode
from mlm_ranks.services.five_matrix import FiveMatrixService
from accounts.models import CustomUser

# Recompact positions for all roots & parents
roots = RankMatrixNode.objects.values_list("root_user_id", flat=True).distinct()
with transaction.atomic():
    for rid in roots:
        parents = RankMatrixNode.objects.filter(root_user_id=rid).values_list("parent_user_id", flat=True).distinct()
        for pid in parents:
            children = list(RankMatrixNode.objects.filter(root_user_id=rid, parent_user_id=pid).order_by("approved_at", "id"))
            for idx, child in enumerate(children, 1):
                if child.position != idx:
                    print(f"Updating root {rid}, parent {pid}, node {child.id} (user {child.placed_user_id}) from pos {child.position} -> {idx}")
                    child.position = idx
                    child.save(update_fields=["position"])

u = CustomUser.objects.filter(username="9999999999").first()
if u:
    tree = FiveMatrixService.get_tree_payload(root_user_id=u.id)
    print("Updated Tree for 9999999999:")
    print("Approved count:", tree.get("approved_count"))
    for slot in tree.get("placements", []):
        print(" ", slot)
