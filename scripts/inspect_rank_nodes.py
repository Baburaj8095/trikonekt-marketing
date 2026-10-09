import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from mlm_ranks.models import RankMatrixRoot, RankMatrixNode, RankUpgrade, UserRank

User = get_user_model()

u_root = User.objects.filter(username='9999999999').first()
u_buyer = User.objects.filter(username='8095918105').first()

print("--- RANK MATRIX ROOTS ---")
for r in RankMatrixRoot.objects.all():
    print(f"Root ID {r.id} | Root User: {r.root_user.username} (ID {r.root_user.id}) | Rank: {r.rank.rank_name} (Level {r.rank.level_number})")

print("\n--- RANK MATRIX NODES ---")
for n in RankMatrixNode.objects.all():
    print(f"Node ID {n.id} | Root User: {n.root_user.username} (ID {n.root_user.id}) | Placed User: {n.placed_user.username} (ID {n.placed_user.id}) | Parent User: {n.parent_user.username if n.parent_user else 'None'} | Pos: {n.position} | Level Depth: {n.level_depth}")

print("\n--- USER RANKS & UPGRADES ---")
for ur in UserRank.objects.all():
    print(f"UserRank: {ur.user.username} | Current Rank: {ur.current_rank.rank_name}")

for ru in RankUpgrade.objects.all().order_by('id'):
    print(f"Upgrade #{ru.id} | User: {ru.user.username} | From: {ru.from_rank.rank_name if ru.from_rank else 'None'} -> To: {ru.to_rank.rank_name} | Amt: ₹{ru.upgrade_amount}")
