"""
PHASE 0 (SIMPLIFIED): Create primary entry (entry_idx=1) for all 118 users in FIVE_150
Simple direct creation, no GenericPlacement complexity.
"""
from business.models import AutoPoolAccount
from accounts.models import CustomUser
from decimal import Decimal

print("\n" + "="*80)
print("PHASE 0 (SIMPLIFIED): Creating Primary Entries for FIVE_150")
print("="*80)

# Get the global root
pool_root = AutoPoolAccount.objects.filter(parent_account__isnull=True, pool_type='FIVE_150').first()

if not pool_root:
    print("ERROR: Global FIVE_150 root not found!")
    print("="*80)
    exit(1)

print(f"\nGlobal root: ID {pool_root.id} (Owner: {pool_root.owner_id})")

# Find all users with FIVE_150 entries
five_matrix = AutoPoolAccount.objects.filter(pool_type='FIVE_150')
all_user_ids = list(set(five_matrix.values_list('owner_id', flat=True)))

print(f"Total users in FIVE_150: {len(all_user_ids)}")
print("Creating primary entries (entry_idx=1) under global root...\n")

created = 0
already_exist = 0
errors = 0

# Find next position under root if needed (1-5 positions per parent)
existing_children = AutoPoolAccount.objects.filter(
    parent_account=pool_root,
    pool_type='FIVE_150'
).count()

next_position = (existing_children % 5) + 1
current_depth = 1

for i, user_id in enumerate(all_user_ids):
    try:
        user = CustomUser.objects.get(id=user_id)
        
        # Check if entry_idx=1 already exists
        existing = AutoPoolAccount.objects.filter(
            owner=user,
            pool_type='FIVE_150',
            user_entry_index=1
        ).exists()
        
        if existing:
            already_exist += 1
            continue
        
        # Determine position (1-5 for 5-matrix, wrap around)
        position = ((i - already_exist) % 5) + 1
        
        # Create entry directly under global root
        AutoPoolAccount.objects.create(
            owner=user,
            pool_type='FIVE_150',
            user_entry_index=1,
            parent_account=pool_root,
            position=position,
            level=current_depth + 1,
            status='ACTIVE',
            username_key=getattr(user, 'username', '') or str(user_id),
            entry_amount=Decimal('150.00'),
            source_type='PHASE_0_FIX',
            source_id=f'primary_entry_{user_id}',
        )
        
        created += 1
        
        # Progress indicator
        if (created + already_exist + errors) % 20 == 0:
            print(f"  Processed {created + already_exist + errors} users... (Created: {created})")
    
    except CustomUser.DoesNotExist:
        errors += 1
    except Exception as e:
        errors += 1
        try:
            err_msg = str(e)[:60]
            if 'duplicate' not in err_msg.lower():
                print(f"  ERROR user {user_id}: {err_msg}")
        except:
            pass

print("\n" + "-"*80)
print("PHASE 0 RESULT")
print("-"*80)
print(f"Primary entries created:   {created}")
print(f"Already existed:           {already_exist}")
print(f"Errors/Skipped:            {errors}")
print(f"Total:                     {created + already_exist + errors}")

# Verify
with_primary = AutoPoolAccount.objects.filter(
    pool_type='FIVE_150',
    user_entry_index=1
).values_list('owner_id', flat=True).distinct().count()

print(f"\nVerification: {with_primary} users now have primary entries (entry_idx=1)")
print(f"Status: {'✓ SUCCESS' if created > 50 else '⚠ PARTIAL'}")
print("="*80)
