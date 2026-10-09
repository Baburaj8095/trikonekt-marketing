import os
import sys
import json

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

from accounts.models import CustomUser
from mlm_ranks.models import RankMatrixRoot, RankMatrixNode, RankUpgrade
from business.models import AutoPoolAccount

u = CustomUser.objects.filter(username='0101010101').first()
sp = CustomUser.objects.filter(username='8095918105').first()

print("=================================================================")
print("1. SPONSOR REFERRAL TREE (UNILEVEL / DIRECT SPONSOR CHAIN)")
print("=================================================================")
print(f"User: {u.username} ({u.full_name}) [ID: {u.id}]")
curr = u
depth = 1
while curr:
    parent = None
    if curr.registered_by:
        parent = curr.registered_by
    elif curr.sponsor_id:
        parent = CustomUser.objects.filter(username=curr.sponsor_id).first()
    if not parent or parent == curr:
        break
    print(f"  Level {depth} Upline: {parent.username} ({parent.full_name}) [ID: {parent.id}, Role: {getattr(parent, 'role', '')}]")
    curr = parent
    depth += 1

print("\n=================================================================")
print("2. RANK-1 FIVE-MATRIX PLACEMENT (RankMatrixNode)")
print("=================================================================")
nodes_as_child = list(RankMatrixNode.objects.filter(placed_user=u))
print(f"Total RankMatrixNode rows where 0101010101 is placed child: {len(nodes_as_child)}")
for n in nodes_as_child:
    print(f"  Root: {n.root_user.username} (ID {n.root_user_id}) | Parent: {n.parent_user.username} (ID {n.parent_user_id}) | Depth: {n.level_depth} | Position: {n.position} | Placed: {n.approved_at}")

# Also check who is sitting under 8095918105
nodes_as_parent = list(RankMatrixNode.objects.filter(parent_user=sp))
print(f"\nChildren placed under Sponsor 8095918105 in RankMatrixNode: {len(nodes_as_parent)}")
for n in nodes_as_parent:
    print(f"  Child: {n.placed_user.username} ({n.placed_user.full_name}) [ID {n.placed_user_id}] | Pos: {n.position} | Depth: {n.level_depth} | Root: {n.root_user.username}")

print("\n=================================================================")
print("3. AUTOPOOL MATRIX PLACEMENT (AutoPoolAccount)")
print("=================================================================")
ap_accounts = list(AutoPoolAccount.objects.filter(owner=u).order_by('id'))
print(f"AutoPool accounts owned by 0101010101: {len(ap_accounts)}")
for ap in ap_accounts:
    parent_owner = ap.parent_account.owner.username if ap.parent_account and ap.parent_account.owner else "None"
    print(f"  Account #{ap.id} | Pool: {ap.pool_type} | Level: {ap.level} | Matrix Pos: {ap.position} | Parent Account: #{ap.parent_account_id} (Owner: {parent_owner})")

# Let's trace upline parents in AutoPool 5-Matrix
ap_five = AutoPoolAccount.objects.filter(owner=u, pool_type='FIVE').first()
if ap_five:
    print("\nTracing 5-Block Autopool Upline Chain for 0101010101:")
    curr_ap = ap_five
    lvl = 1
    while curr_ap and curr_ap.parent_account:
        curr_ap = curr_ap.parent_account
        owner_name = curr_ap.owner.username if curr_ap.owner else "System"
        print(f"  5-Matrix Upline Level {lvl}: Account #{curr_ap.id} (Owner: {owner_name}) | Matrix Pos: {curr_ap.position}")
        lvl += 1

# Let's trace upline parents in AutoPool 3-Matrix
ap_three = AutoPoolAccount.objects.filter(owner=u, pool_type='THREE').first()
if ap_three:
    print("\nTracing 3-Block Autopool Upline Chain for 0101010101:")
    curr_ap = ap_three
    lvl = 1
    while curr_ap and curr_ap.parent_account:
        curr_ap = curr_ap.parent_account
        owner_name = curr_ap.owner.username if curr_ap.owner else "System"
        print(f"  3-Matrix Upline Level {lvl}: Account #{curr_ap.id} (Owner: {owner_name}) | Matrix Pos: {curr_ap.position}")
        lvl += 1
