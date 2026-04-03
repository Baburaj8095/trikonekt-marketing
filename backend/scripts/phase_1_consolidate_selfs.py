"""
PHASE 1: Consolidate self-accounts under their user roots
Update all entry_idx > 0 to point to user's root
"""
from business.models import AutoPoolAccount
from accounts.models import CustomUser
from django.db import transaction
from django.db.models import Count

print("\n" + "="*80)
print("PHASE 1: Consolidating Self-Accounts Under Roots")
print("="*80)

five_matrix = AutoPoolAccount.objects.filter(pool_type='FIVE_150')

# Find users with self-accounts (entry_idx > 0)
users_with_selfs = []
total_positions = 0

for owner_id in set(five_matrix.values_list('owner_id', flat=True)):
    user_accs = five_matrix.filter(owner_id=owner_id, pool_type='FIVE_150')
    entry_indices = user_accs.values_list('user_entry_index', flat=True).distinct()
    
    if len(entry_indices) > 1:  # Has self-accounts
        users_with_selfs.append(owner_id)
        self_count = len(entry_indices) - 1  # -1 for main root
        total_positions += self_count

print("\nUsers with self-accounts: {}".format(len(users_with_selfs)))
print("Total positions to consolidate: {}".format(total_positions))
print("Consolidating...")

consolidated = 0
errors = 0

with transaction.atomic():
    for user_id in users_with_selfs:
        try:
            user = CustomUser.objects.get(id=user_id)
            
            # Get user's root
            root = five_matrix.filter(
                owner_id=user_id,
                user_entry_index=0,
                parent_account__isnull=True
            ).first()
            
            if not root:
                errors += 1
                print("  WARNING: No root found for user {}".format(user_id))
                continue
            
            # Update all self-accounts to point to root
            self_accs = five_matrix.filter(
                owner_id=user_id,
                user_entry_index__gt=0  # entry_idx > 0
            )
            
            count = self_accs.update(parent_account=root)
            consolidated += count
            
            if consolidated % 50 == 0:
                print("  {} positions consolidated...".format(consolidated))
        
        except Exception as e:
            errors += 1
            print("  ERROR consolidating user {}: {}".format(user_id, str(e)))

print("\nPHASE 1 COMPLETE")
print("-" * 80)
print("Positions consolidated: {}".format(consolidated))
print("Errors: {}".format(errors))
print("Status: {}".format("SUCCESS" if errors == 0 else "PARTIAL"))

if consolidated == total_positions:
    print("\n✓ All {} positions now consolidated under user roots!".format(consolidated))
else:
    print("\n⚠ {} / {} positions consolidated".format(consolidated, total_positions))

print("="*80)
