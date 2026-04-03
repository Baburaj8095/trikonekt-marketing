"""
Consolidate user's scattered self accounts under one parent
"""
from business.models import AutoPoolAccount

user_id = 395
pool_type = 'FIVE_150'

# Get first entry to use as reference parent
first_entry = AutoPoolAccount.objects.filter(
    owner_id=user_id, 
    pool_type=pool_type,
    user_entry_index=1
).first()

if not first_entry:
    print("No entry_idx=1 found for user {}".format(user_id))
    exit(1)

parent_id = first_entry.parent_account_id
print("Consolidating user {} self accounts under parent {}...".format(user_id, parent_id))
print("First entry (idx=1): ID {} -> Parent {}".format(first_entry.id, parent_id))
print()

# Get all entries for this user
entries = AutoPoolAccount.objects.filter(
    owner_id=user_id,
    pool_type=pool_type,
    user_entry_index__gte=1
).order_by('user_entry_index')

print("Before consolidation:")
for e in entries:
    print("  Idx:{} ID:{} Parent:{} Pos:{} Level:{}".format(
        e.user_entry_index, e.id, e.parent_account_id, e.position, e.level
    ))

# Consolidate: all should have same parent and positions 1-5
positions = [4, 5, 1, 2, 3]  # Assign positions
updated = 0

for i, entry in enumerate(entries, 1):
    if i == 1:
        # First entry stays as is
        continue
    
    entry.parent_account_id = parent_id
    entry.position = positions[i-1] if i <= len(positions) else i
    entry.level = 3
    entry.save()
    updated += 1
    print("  Updated entry idx={} (ID:{}) -> Parent:{} Pos:{}".format(
        entry.user_entry_index, entry.id, parent_id, entry.position
    ))

print()
print("After consolidation:")
entries_after = AutoPoolAccount.objects.filter(
    owner_id=user_id,
    pool_type=pool_type,
    user_entry_index__gte=1
).order_by('user_entry_index')

for e in entries_after:
    print("  Idx:{} ID:{} Parent:{} Pos:{} Level:{}".format(
        e.user_entry_index, e.id, e.parent_account_id, e.position, e.level
    ))

print()
print("✓ Consolidated {} entries".format(updated))
