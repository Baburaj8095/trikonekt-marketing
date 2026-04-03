from business.models import AutoPoolAccount
from accounts.models import User
from django.db.models import Count, Q
from collections import defaultdict

print("\n" + "="*80)
print("5-MATRIX ANALYSIS: Current State Before Migration")
print("="*80)

# Query all FIVE_150 accounts
five_matrix = AutoPoolAccount.objects.filter(pool_type='FIVE_150').select_related('owner', 'parent_account')

print("\n[1] TOTAL FIVE_150 ENTRIES: {:,}".format(five_matrix.count()))

# Count unique users
unique_users = five_matrix.values('owner').distinct().count()
print("[2] UNIQUE USERS WITH 5-MATRIX: {:,}".format(unique_users))

# Find users with multiple entries (self-accounts)
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

# Analyze scattered placement
print("\n[4] PARENT ACCOUNT ANALYSIS (Where users are placed):")
print("-" * 80)

# Users with scattered positions (multiple different parent_accounts)
user_parents = defaultdict(set)
for acc in five_matrix:
    parent_id = acc.parent_account_id if acc.parent_account_id else 'NULL_ROOT'
    user_parents[acc.owner_id].add(parent_id)

scattered_users = {uid: parents for uid, parents in user_parents.items() if len(parents) > 1}
print("    Users with SCATTERED positions (multiple parents): {:,}".format(len(scattered_users)))

if len(scattered_users) > 0:
    # Sample showing scatter
    sample_scattered = list(scattered_users.items())[:5]
    print(f"\n   Sample (first 5 scattered users):")
    for user_id, parent_ids in sample_scattered:
        try:
            user = User.objects.get(id=user_id)
            num_parents = len(parent_ids)
            print(f"   * User {user.phone} (ID: {user_id})")
            print(f"     - Positions scattered across {num_parents} different parents")
            
            # Show distribution
            pos_by_parent = defaultdict(list)
            for acc in five_matrix.filter(owner_id=user_id):
                parent_key = acc.parent_account_id if acc.parent_account_id else 'NULL'
                if acc.position:
                    pos_by_parent[parent_key].append(acc.position)
            
            for parent_id, positions in pos_by_parent.items():
                pos_owner = "USER_ROOT" if parent_id == 'NULL' else f"Parent#{parent_id}"
                print(f"       {} positions {sorted(positions)}")
        except User.DoesNotExist:
            pass

# Consolidated analysis
print("\n5️⃣  SELF-ACCOUNT MIGRATION OPPORTUNITY:")
print("-" * 80)

# Users who have entry_idx > 0 (self-accounts)
users_needing_consolidation = 0
total_self_accounts = 0

for owner_id in set(five_matrix.values_list('owner_id', flat=True)):
    user_accs = five_matrix.filter(owner_id=owner_id)
    entry_indices = user_accs.values_list('user_entry_index', flat=True).distinct()
    
    if len(entry_indices) > 1:  # Has self-accounts
        users_needing_consolidation += 1
        total_self_accounts += len(entry_indices) - 1  # -1 for main account

print(f"   Users with self-accounts: {users_needing_consolidation:,}")
print(f"   Total self-accounts created: {total_self_accounts:,}")

# Check for missing roots
print("\n6️⃣  ROOT ACCOUNT STATUS:")
print("-" * 80)

# Users without proper root (entry_idx=0, parent=NULL)
all_users_in_5matrix = set(five_matrix.values_list('owner_id', flat=True))
users_with_root = set(
    five_matrix.filter(
        user_entry_index=0,
        parent_account__isnull=True
    ).values_list('owner_id', flat=True)
)

users_without_root = all_users_in_5matrix - users_with_root
print(f"   Users WITH valid root (entry_idx=0, parent=NULL): {len(users_with_root):,}")
print(f"   Users WITHOUT valid root: {len(users_without_root):,}")

if len(users_without_root) > 0:
    print(f"\n   Sample users without proper root (first 5):")
    for user_id in list(users_without_root)[:5]:
        try:
            user = User.objects.get(id=user_id)
            accounts = five_matrix.filter(owner_id=user_id)
            print(f"   • User {user.phone} (ID: {user_id})")
            print(f"     └─ Accounts: {accounts.count()}")
            for acc in accounts[:3]:
                print(f"        • entry_idx={acc.user_entry_index}, parent_id={acc.parent_account_id}, pos={acc.position}")
        except User.DoesNotExist:
            pass

# Safe migration path
print("\n7️⃣  SAFE MIGRATION STRATEGY (Self-Accounts Only):")
print("-" * 80)

print("""
PHASE 1: Consolidate Self-Accounts Under Main Root
  For each user with self-accounts (entry_idx > 0):
    ✓ Find or create main root (entry_idx=0, parent=NULL)
    ✓ Update all self-account positions to point to main root
    ✓ NOT touching positions of other users (no scatter re-rooting yet)
  
  Impact: ~{} self-account positions consolidated
  Risk:   LOW (only touching entries of same owner)
  
PHASE 2: (Optional) Full Re-rooting
  For users scattered across different parent_accounts:
    ✓ Create root if missing
    ✓ Reparent ALL positions to user root
  
  Impact: ~{} scattered positions consolidated
  Risk:   MEDIUM (affects commission calculation paths)

Current Status Summary:
  • Users with self-accounts: {:,}
  • Total self-accounts: {:,}
  • Users without valid root: {:,}
  • Scattered users: {:,}
""".format(
    max(total_self_accounts, 0),
    len(scattered_users),
    users_needing_consolidation,
    total_self_accounts,
    len(users_without_root),
    len(scattered_users)
))

print("\nRECOMMENDATION:")
print("-" * 80)
print("""
✅ START WITH PHASE 1: Self-Account Consolidation
   • Safe: only touches self-account entries of same owner
   • Quick: can run in hours, not weeks
   • Low risk: no inter-user relationships affected
   • Fixes: {} positions immediately
   
⏸️  THEN ASSESS: If commission issues occur, proceed to PHASE 2
   • Phase 2 addresses scattered root issue
   • But requires more extensive validation
   • Can be done after Phase 1 success
""".format(total_self_accounts if total_self_accounts > 0 else 0))

print("\n" + "="*80)
