"""
Check if any existing 5-MATRIX trees exceed max_depth=10
"""
from business.models import AutoPoolAccount
from django.db.models import Max, Count

print("\n" + "="*80)
print("MAX DEPTH CHECK: 5-MATRIX Trees")
print("="*80)

five_matrix = AutoPoolAccount.objects.filter(pool_type='FIVE_150')

# Get max level in database
max_level_in_db = five_matrix.aggregate(Max('level'))['level__max']

print("\n[1] DEEPEST LEVEL IN DATABASE")
print("-" * 80)
print("    Max level found: {}".format(max_level_in_db if max_level_in_db else "None"))
print("    Configured max_depth: 10")

if max_level_in_db and max_level_in_db > 10:
    print("\n    WARNING: Trees exceed max_depth=10!")
    print("    Deepest level: {}".format(max_level_in_db))
else:
    print("\n    Status: OK - All trees within limit")

# Distribution by level
print("\n[2] LEVEL DISTRIBUTION")
print("-" * 80)

level_dist = five_matrix.values('level').annotate(
    count=Count('*')
).order_by('level')

for row in level_dist:
    level = row['level']
    count = row['count']
    status = "OK" if level <= 10 else "EXCEED"
    print("    Level {}: {} entries [{}]".format(level, count, status))

# Check for any entries at level > 10
exceeding = five_matrix.filter(level__gt=10).count()
print("\n[3] ENTRIES EXCEEDING MAX_DEPTH=10")
print("-" * 80)
print("    Count: {}".format(exceeding))

if exceeding > 0:
    print("\n    Entries at dangerous levels:")
    dangerous = five_matrix.filter(level__gt=10).values('owner_id', 'level').annotate(
        count=Count('*')
    ).order_by('-level')
    
    for row in dangerous[:5]:
        print("    - Owner ID {}: {} entries at level {}".format(
            row['owner_id'], row['count'], row['level']))

print("\n[4] PHASE 0 & 1 SAFETY ANALYSIS")
print("-" * 80)

if exceeding == 0 and (not max_level_in_db or max_level_in_db <= 10):
    print("    SAFE: No depth violations detected")
    print("    Phase 0 & 1 can proceed without depth concerns")
else:
    print("    WARNING: Depth violations detected")
    print("    Phase 0 & 1 still safe (only update parent pointers)")
    print("    But: New placements may fail if tree already at max_depth")

print("\n" + "="*80)
