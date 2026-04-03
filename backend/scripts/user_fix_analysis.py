"""
Comprehensive Analysis: Current Users + Fix Impact
Shows which users need fixing and how placement will work
"""
from business.models import AutoPoolAccount
from accounts.models import CustomUser
from django.db.models import Count, Q
from collections import defaultdict
import json

print("\n" + "="*80)
print("USER FIX ANALYSIS: Current State vs After Fix")
print("="*80)

five_matrix = AutoPoolAccount.objects.filter(pool_type='FIVE_150').select_related('owner', 'parent_account')

# [1] Users needing fix
print("\n[1] USERS NEEDING FIX")
print("-" * 80)

# Category A: Users WITHOUT root (all 118)
all_user_ids = set(five_matrix.values_list('owner_id', flat=True))
users_with_root = set(
    five_matrix.filter(
        user_entry_index=0,
        parent_account__isnull=True
    ).values_list('owner_id', flat=True)
)
users_without_root = all_user_ids - users_with_root

print("Total users in 5-MATRIX: {}".format(len(all_user_ids)))
print("Users WITHOUT valid root: {} (ALL NEED ROOT CREATED)".format(len(users_without_root)))
print("Users WITH valid root: {} (already have roots)".format(len(users_with_root)))

# [2] Users with scattered positions
print("\n[2] USERS WITH SCATTERED POSITIONS")
print("-" * 80)

user_parents = defaultdict(set)
for acc in five_matrix:
    parent_id = acc.parent_account_id if acc.parent_account_id else 'NULL'
    user_parents[acc.owner_id].add(parent_id)

scattered_users = {uid: parents for uid, parents in user_parents.items() if len(parents) > 1}
simple_users = {uid: parents for uid, parents in user_parents.items() if len(parents) == 1}

print("Users with SCATTERED positions (multiple parents): {}".format(len(scattered_users)))
print("Users with SIMPLE placement (single parent): {}".format(len(simple_users)))

# [3] Breakdown by scatter severity
print("\n[3] SCATTER SEVERITY ANALYSIS")
print("-" * 80)

scatter_severity = defaultdict(int)
for uid, parents in scattered_users.items():
    num_parents = len(parents)
    scatter_severity[num_parents] += 1

print("Distribution by number of different parents:")
for num_parents in sorted(scatter_severity.keys()):
    count = scatter_severity[num_parents]
    print("  {} different parents: {} users".format(num_parents, count))

# [4] Sample users - most scattered
print("\n[4] MOST SCATTERED USERS (Top 10)")
print("-" * 80)

scatter_sorted = sorted(scattered_users.items(), key=lambda x: len(x[1]), reverse=True)[:10]
for user_id, parent_ids in scatter_sorted:
    try:
        user = CustomUser.objects.get(id=user_id)
        num_accs = five_matrix.filter(owner_id=user_id).count()
        num_parents = len(parent_ids)
        print("\n  User {} (ID: {})".format(user.phone, user_id))
        print("    - Accounts: {}".format(num_accs))
        print("    - Scattered across {} parents".format(num_parents))
        
        # Show position distribution
        pos_by_parent = defaultdict(list)
        for acc in five_matrix.filter(owner_id=user_id):
            parent_key = acc.parent_account_id if acc.parent_account_id else 'NULL'
            if acc.position:
                pos_by_parent[parent_key].append(acc.position)
        
        for i, (parent_id, positions) in enumerate(pos_by_parent.items()):
            if i < 5:  # Show first 5 parents
                pos_owner = "USER_ROOT" if parent_id == 'NULL' else "Parent{}".format(parent_id)
                print("      {} positions {}".format(pos_owner, sorted(positions)))
            elif i == 5:
                remaining = len(pos_by_parent) - 5
                print("      ... and {} more parents".format(remaining))
                break
    except CustomUser.DoesNotExist:
        pass

# [5] Self-account breakdown
print("\n[5] SELF-ACCOUNT BREAKDOWN")
print("-" * 80)

users_with_selfs = 0
total_selfs = 0

for owner_id in all_user_ids:
    user_accs = five_matrix.filter(owner_id=owner_id)
    entry_indices = user_accs.values_list('user_entry_index', flat=True).distinct()
    
    if len(entry_indices) > 1:
        users_with_selfs += 1
        total_selfs += len(entry_indices) - 1

print("Users with self-accounts: {}".format(users_with_selfs))
print("Total self-accounts to consolidate: {}".format(total_selfs))

# [6] Placement type analysis
print("\n[6] FIX IMPACT BY USER TYPE")
print("-" * 80)

# Type A: Simple users (single parent, likely already placed correctly)
type_a_count = len([uid for uid, parents in user_parents.items() if len(parents) == 1])
# Type B: Scattered but not too bad (2-5 parents)
type_b_count = len([uid for uid, parents in scattered_users.items() if 2 <= len(parents) <= 5])
# Type C: Very scattered (6+ parents)
type_c_count = len([uid for uid, parents in scattered_users.items() if len(parents) > 5])

print("Type A - Simple placement (1 parent): {} users".format(type_a_count))
print("  Impact: Just add user root, redirect entries to root")
print()
print("Type B - Moderate scatter (2-5 parents): {} users".format(type_b_count))
print("  Impact: Add root, consolidate self-accounts to root")
print()
print("Type C - Severe scatter (6+ parents): {} users".format(type_c_count))
print("  Impact: Add root, consolidate self-accounts, review placement history")

# [7] Placement working example
print("\n[7] HOW PLACEMENT WORKS AFTER FIX (Example: User 395)")
print("-" * 80)

try:
    example_user = CustomUser.objects.get(id=395)
    example_accounts = five_matrix.filter(owner_id=395)
    
    print("\nUSER: {} (ID: 395)".format(example_user.phone))
    print("\nBEFORE FIX (Current State):")
    print("  entry_idx=0: [MISSING ROOT]")
    
    pos_by_parent_before = defaultdict(list)
    for acc in example_accounts:
        parent_key = acc.parent_account_id if acc.parent_account_id else 'NULL'
        if acc.position:
            pos_by_parent_before[parent_key].append({
                'entry_idx': acc.user_entry_index,
                'pos': acc.position,
                'level': acc.level
            })
    
    for parent_id, items in sorted(pos_by_parent_before.items()):
        for item in items:
            pos_owner = "USER_ROOT" if parent_id == 'NULL' else "Parent{}".format(parent_id)
            print("  entry_idx={}: {} position {}, level {}".format(
                item['entry_idx'], pos_owner, item['pos'], item['level']))
    
    print("\nAFTER FIX (What Will Happen):")
    print("  ✓ Create user root: entry_idx=0, parent=NULL, level=1")
    print("  ✓ Consolidate all positions under user root")
    
    # Show proposed structure
    positions = sorted([acc.position for acc in example_accounts if acc.position])
    print("  entry_idx=0: USER_ROOT (new) - parent=NULL")
    for i, pos in enumerate(positions):
        entry_idx = i + 1
        print("  entry_idx={}: USER_ROOT position {}, level=1".format(entry_idx, pos))
    
    print("\nBENEFIT:")
    print("  - All 6 positions now under single root")
    print("  - No scattered parents")
    print("  - Tree structure clear and queryable")
    print("  - Commission calculation clean")
    
except CustomUser.DoesNotExist:
    print("Example user 395 not found in database")

# [8] Fix workflow
print("\n[8] FIX WORKFLOW")
print("-" * 80)

print("\nPHASE 0: Create User Roots")
print("  FOR each of {} users:".format(len(users_without_root)))
print("    CREATE AutoPoolAccount(")
print("      owner=user,")
print("      pool_type='FIVE_150',")
print("      entry_idx=0,")
print("      parent=NULL,")
print("      position=NULL,")
print("      level=1,")
print("      status='ACTIVE'")
print("    )")
print("  Result: {} new root records")
print()

print("PHASE 1: Consolidate Self-Accounts")
print("  FOR each of {} users with self-accounts:".format(users_with_selfs))
print("    UPDATE AutoPoolAccount")
print("    SET parent_account = user_root_id")
print("    WHERE owner=user AND entry_idx > 0")
print("  Result: {} positions now under their user root")
print()

print("PHASE 2: Code Fix")
print("  in create_five_150_for_user():")
print("    OLD: start_id = _sponsor_start_entry_id_for(user, 'FIVE_150')")
print("    NEW: start_id = _get_or_create_user_root(user, 'FIVE_150')")
print("  Result: Future users placed under their own root automatically")

# [9] Summary
print("\n[9] SUMMARY")
print("-" * 80)

print("\nUsers to Fix:")
print("  All 5-MATRIX users: {}".format(len(all_user_ids)))
print("    - Need root creation: {} (100%)".format(len(users_without_root)))
print("    - Need self-account consolidation: {} ({:.1f}%)".format(
    users_with_selfs, (users_with_selfs/len(all_user_ids)*100) if all_user_ids else 0))
print()

print("Records to Update:")
print("  New roots to create: {}".format(len(users_without_root)))
print("  Self-accounts to consolidate: {}".format(total_selfs))
print("  Total operations: {}".format(len(users_without_root) + total_selfs))
print()

print("Risk Assessment:")
print("  Phase 0: ZERO RISK - Add-only operation")
print("  Phase 1: LOW RISK - Simple parent pointer updates")
print("  Phase 2: ZERO RISK - Code change only, affects new users")
print()

print("Timeline:")
print("  Phase 0: Minutes (bulk insert)")
print("  Phase 1: Minutes (bulk update)")
print("  Phase 2: Hours (code review + deploy)")
print("  Total: < 1 hour downtime")

print("\n" + "="*80)
