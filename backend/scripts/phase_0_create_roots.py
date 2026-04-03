"""
PHASE 0: Create user roots for all 118 users without roots
"""
from business.models import AutoPoolAccount
from accounts.models import CustomUser

print("\n" + "="*80)
print("PHASE 0: Creating User Roots")
print("="*80)

five_matrix = AutoPoolAccount.objects.filter(pool_type='FIVE_150')

# Find all users
all_user_ids = list(set(five_matrix.values_list('owner_id', flat=True)))

print("\nTotal users in 5-MATRIX: {}".format(len(all_user_ids)))
print("Checking each user for root...")

roots_created = 0
already_existed = 0
skipped = 0

for user_id in all_user_ids:
    try:
        user = CustomUser.objects.get(id=user_id)
        
        # Check if root already exists
        root_exists = AutoPoolAccount.objects.filter(
            owner=user,
            pool_type='FIVE_150',
            user_entry_index=0,
            parent_account__isnull=True
        ).exists()
        
        if root_exists:
            already_existed += 1
            continue
        
        # Create new root
        AutoPoolAccount.objects.create(
            owner=user,
            pool_type='FIVE_150',
            user_entry_index=0,
            parent_account=None,
            position=None,
            level=1,
            status='ACTIVE',
            username_key=getattr(user, 'username', '') or str(user_id),
            entry_amount=0,
            source_type='PHASE_0_FIX',
            source_id='root_fix_{}'.format(user_id),
        )
        
        roots_created += 1
        if (roots_created + already_existed) % 20 == 0:
            print("  Processed {} users...".format(roots_created + already_existed))
    
    except CustomUser.DoesNotExist:
        skipped += 1
    except Exception:
        skipped += 1

print("\nPHASE 0 RESULT")
print("-" * 80)
print("New roots created: {}".format(roots_created))
print("Already existed: {}".format(already_existed))
print("Skipped: {}".format(skipped))
print("Status: {}".format("SUCCESS" if roots_created > 0 else "OK - All have roots"))

print("\n" + "="*80)
