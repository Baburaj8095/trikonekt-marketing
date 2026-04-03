"""
PHASE 0 (CORRECTED): Create primary entry (entry_idx=1) for all 118 users in FIVE_150
This ensures all users have a consistent entry point under the global root.
Future placements will start from this entry and spread properly.
"""
from business.models import AutoPoolAccount
from accounts.models import CustomUser
from decimal import Decimal

print("\n" + "="*80)
print("PHASE 0 (CORRECTED): Creating Primary Entries for FIVE_150")
print("="*80)

# Get the global root
pool_root = AutoPoolAccount.objects.filter(parent_account__isnull=True, pool_type='FIVE_150').first()

if not pool_root:
    print("ERROR: Global FIVE_150 root not found!")
    print("="*80)
    exit(1)

print(f"\nGlobal root: ID {pool_root.id} (Owner: {pool_root.owner_id})")
print(f"Using global root as parent for primary entries\n")

# Find all users with FIVE_150 entries
five_matrix = AutoPoolAccount.objects.filter(pool_type='FIVE_150')
all_user_ids = list(set(five_matrix.values_list('owner_id', flat=True)))

print(f"Total users in FIVE_150: {len(all_user_ids)}")
print("Creating primary entries (entry_idx=1) for all users...\n")

from business.services.placement import GenericPlacement

created = 0
already_exist = 0
errors = 0

for i, user_id in enumerate(all_user_ids):
    try:
        user = CustomUser.objects.get(id=user_id)
        
        # Check if entry_idx=1 already exists
        existing = AutoPoolAccount.objects.filter(
            owner=user,
            pool_type='FIVE_150',
            user_entry_index=1
        ).first()
        
        if existing:
            already_exist += 1
            continue
        
        # Place user's primary entry under global root using GenericPlacement
        result = GenericPlacement.place_account(
            owner=user,
            pool_type='FIVE_150',
            amount=Decimal('150.00'),
            source_type='PHASE_0_FIX',
            source_id=f'primary_entry_{user_id}',
            start_entry_id=pool_root.id
        )
        
        if result:
            created += 1
        else:
            errors += 1
        
        # Progress indicator
        if (created + already_exist + errors) % 20 == 0:
            print(f"  Processed {created + already_exist + errors} users... (Created: {created}, Exist: {already_exist}, Errors: {errors})")
    
    except CustomUser.DoesNotExist:
        errors += 1
    except Exception as e:
        errors += 1
        try:
            print(f"  ERROR user {user_id}: {str(e)[:50]}")
        except:
            pass

print("\n" + "-"*80)
print("PHASE 0 RESULT")
print("-"*80)
print(f"Primary entries created:   {created}")
print(f"Already existed:           {already_exist}")
print(f"Errors/Skipped:            {errors}")
print(f"Total processed:           {created + already_exist + errors}")
print(f"Status: {'SUCCESS' if errors == 0 else 'PARTIAL SUCCESS'}")

# Verify
with_primary = AutoPoolAccount.objects.filter(
    pool_type='FIVE_150',
    user_entry_index=1
).values_list('owner_id', flat=True).distinct().count()

print(f"\nVerification: {with_primary} users now have primary entries (entry_idx=1)")
print("="*80)
