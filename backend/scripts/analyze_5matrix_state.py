"""
Analyze current 5-MATRIX state before migration
"""
from business.models import AutoPoolAccount
from accounts.models import CustomUser
from django.db.models import Count
from collections import defaultdict

print("\n" + "="*80)
print("5-MATRIX ANALYSIS: Current State Before Migration")
print("="*80)

five_matrix = AutoPoolAccount.objects.filter(pool_type='FIVE_150').select_related('owner', 'parent_account')

total_entries = five_matrix.count()
unique_users = five_matrix.values('owner').distinct().count()

print("\n[1] TOTAL FIVE_150 ENTRIES: {:,}".format(total_entries))
print("[2] UNIQUE USERS WITH 5-MATRIX: {:,}".format(unique_users))

# Users with self-accounts
print("\n[3] USERS WITH SELF-ACCOUNTS (Multiple entry_idx):")
print("-" * 80)

user_entry_counts = five_matrix.values('owner').annotate(
    entry_count=Count('user_entry_index', distinct=True)
).filter(entry_count__gt=1).order_by('-entry_count')

users_with_selfs = user_entry_counts.count()
print("    Total users with self-accounts: {:,}".format(users_with_selfs))

if users_with_selfs > 0:
    print("\n    Breakdown by number of self-accounts:")
    breakdown = user_entry_counts.values('entry_count').annotate(
        count=Count('owner')
    ).order_by('-entry_count')
    
    for row in breakdown:
        entries = row['entry_count']
        count = row['count']
        print("    * Have {} account(s): {:,} users".format(entries, count))

# Scattered placement analysis
print("\n[4] PARENT ACCOUNT ANALYSIS (Where users are placed):")
print("-" * 80)

user_parents = defaultdict(set)
for acc in five_matrix:
    parent_id = acc.parent_account_id if acc.parent_account_id else 'NULL_ROOT'
    user_parents[acc.owner_id].add(parent_id)

scattered_users = {uid: parents for uid, parents in user_parents.items() if len(parents) > 1}
print("    Users with SCATTERED positions (multiple parents): {:,}".format(len(scattered_users)))

if len(scattered_users) > 0:
    sample_scattered = list(scattered_users.items())[:5]
    print("\n    Sample (first 5 scattered users):")
    for user_id, parent_ids in sample_scattered:
        try:
            user = CustomUser.objects.get(id=user_id)
            num_parents = len(parent_ids)
            print("    * User {} (ID: {})".format(user.phone, user_id))
            print("      - Positions scattered across {} different parents".format(num_parents))
            
            pos_by_parent = defaultdict(list)
            for acc in five_matrix.filter(owner_id=user_id):
                parent_key = acc.parent_account_id if acc.parent_account_id else 'NULL'
                if acc.position:
                    pos_by_parent[parent_key].append(acc.position)
            
            for parent_id, positions in pos_by_parent.items():
                pos_owner = "USER_ROOT" if parent_id == 'NULL' else "Parent{}".format(parent_id)
                print("        {} positions {}".format(pos_owner, sorted(positions)))
        except CustomUser.DoesNotExist:
            pass

# Self-account migration opportunity
print("\n[5] SELF-ACCOUNT MIGRATION OPPORTUNITY:")
print("-" * 80)

users_needing_consolidation = 0
total_self_accounts = 0

for owner_id in set(five_matrix.values_list('owner_id', flat=True)):
    user_accs = five_matrix.filter(owner_id=owner_id)
    entry_indices = user_accs.values_list('user_entry_index', flat=True).distinct()
    
    if len(entry_indices) > 1:
        users_needing_consolidation += 1
        total_self_accounts += len(entry_indices) - 1

print("    Users with self-accounts: {:,}".format(users_needing_consolidation))
print("    Total self-accounts created: {:,}".format(total_self_accounts))

# Root account status
print("\n[6] ROOT ACCOUNT STATUS:")
print("-" * 80)

all_users_in_5matrix = set(five_matrix.values_list('owner_id', flat=True))
users_with_root = set(
    five_matrix.filter(
        user_entry_index=0,
        parent_account__isnull=True
    ).values_list('owner_id', flat=True)
)

users_without_root = all_users_in_5matrix - users_with_root
print("    Users WITH valid root (entry_idx=0, parent=NULL): {:,}".format(len(users_with_root)))
print("    Users WITHOUT valid root: {:,}".format(len(users_without_root)))

if len(users_without_root) > 0 and len(users_without_root) <= 20:
    print("\n    Users without proper root:")
    for user_id in list(users_without_root):
        try:
            user = CustomUser.objects.get(id=user_id)
            accounts = five_matrix.filter(owner_id=user_id)
            print("    * User {} (ID: {})".format(user.phone, user_id))
            print("      - Accounts: {}".format(accounts.count()))
            for acc in accounts[:3]:
                print("         entry_idx={}, parent_id={}, pos={}".format(
                    acc.user_entry_index, acc.parent_account_id, acc.position))
        except CustomUser.DoesNotExist:
            pass
elif len(users_without_root) > 20:
    print("\n    Sample users without proper root (first 5):")
    for user_id in list(users_without_root)[:5]:
        try:
            user = CustomUser.objects.get(id=user_id)
            accounts = five_matrix.filter(owner_id=user_id)
            print("    * User {} (ID: {})".format(user.phone, user_id))
            print("      - Accounts: {}".format(accounts.count()))
            for acc in accounts[:3]:
                print("         entry_idx={}, parent_id={}, pos={}".format(
                    acc.user_entry_index, acc.parent_account_id, acc.position))
        except CustomUser.DoesNotExist:
            pass

# Migration strategy
print("\n[7] SAFE MIGRATION STRATEGY:")
print("-" * 80)

print("\nPHASE 1: Consolidate Self-Accounts Under Main Root")
print("  For each user with self-accounts (entry_idx > 0):")
print("    - Find or create main root (entry_idx=0, parent=NULL)")
print("    - Update all self-account positions to point to main root")
print("    - NOT touching positions of other users")
print("  Impact: ~{} self-account positions consolidated".format(max(total_self_accounts, 0)))
print("  Risk:   LOW (only touching entries of same owner)")

print("\nPHASE 2: (Optional) Full Re-rooting")
print("  For users scattered across different parent_accounts:")
print("    - Create root if missing")
print("    - Reparent ALL positions to user root")
print("  Impact: ~{} scattered positions consolidated".format(len(scattered_users)))
print("  Risk:   MEDIUM (affects commission calculation paths)")

print("\nSUMMARY:")
print("  - Users with self-accounts: {:,}".format(users_needing_consolidation))
print("  - Total self-accounts: {:,}".format(total_self_accounts))
print("  - Users without valid root: {:,}".format(len(users_without_root)))
print("  - Users with scattered positions: {:,}".format(len(scattered_users)))

print("\nRECOMMENDATION:")
print("-" * 80)
print("\nPHASE 1 FIRST: Self-Account Consolidation")
print("  - Safe: only touches self-account entries of same owner")
print("  - Quick: can run in hours, not weeks")
print("  - Low risk: no inter-user relationships affected")
print("  - Fixes: {} positions immediately".format(total_self_accounts if total_self_accounts > 0 else 0))

print("\nTHEN: Evaluate need for PHASE 2")
print("  - Phase 2 addresses scattered root issue")
print("  - Requires more validation")
print("  - Can be done after Phase 1 success")

print("\n" + "="*80)
