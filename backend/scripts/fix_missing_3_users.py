"""
Fix 3 missing users - create their primary entries (entry_idx=1)
"""
from business.models import AutoPoolAccount
from accounts.models import CustomUser
from decimal import Decimal
from business.services.placement import GenericPlacement

missing_user_ids = [121, 362, 124]
root = AutoPoolAccount.objects.get(parent_account__isnull=True, pool_type='FIVE_150')

print(f"Creating entries for {len(missing_user_ids)} missing users...")

for uid in missing_user_ids:
    try:
        user = CustomUser.objects.get(id=uid)
        print(f"  Placing user {uid}...", end='')
        result = GenericPlacement.place_account(
            owner=user,
            pool_type='FIVE_150',
            amount=Decimal('150.00'),
            source_type='PHASE_0_FIX',
            source_id=f'missing_entry_{uid}',
            start_entry_id=root.id
        )
        print(f" {'✓' if result else '✗'}")
    except Exception as e:
        print(f"  Error user {uid}: {str(e)[:60]}")

# Verify
created = AutoPoolAccount.objects.filter(
    pool_type='FIVE_150',
    user_entry_index=1
).values_list('owner_id', flat=True).distinct().count()

print(f"\nTotal users with entry_idx=1: {created}")
print(f"Status: {'✓ COMPLETE - All 118 users ready' if created >= 118 else '⚠ Still missing'}")
