"""
FAST BATCH RESTORE: recreate 183 missing FIVE_150 entries in seconds.
Pre-computes all open tree slots in memory, then batch-creates entries.
"""
import os, sys, time, django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.db import connection, transaction
from django.db.models import Count, Max
from business.models import AutoPoolAccount
from django.contrib.auth import get_user_model
from decimal import Decimal

User = get_user_model()
start = time.time()

# ── 1. Identify what's missing ───────────────────────────────────────────────
five_counts = dict(
    AutoPoolAccount.objects.filter(pool_type="FIVE_150")
    .values("owner_id").annotate(cnt=Count("id")).values_list("owner_id", "cnt")
)
three_counts = dict(
    AutoPoolAccount.objects.filter(pool_type="THREE_150")
    .values("owner_id").annotate(cnt=Count("id")).values_list("owner_id", "cnt")
)

users_needed = {}
for uid, tc in three_counts.items():
    fc = five_counts.get(uid, 0)
    if tc > fc:
        users_needed[uid] = tc - fc

total_needed = sum(users_needed.values())
print(f"Need to create {total_needed} FIVE_150 entries for {len(users_needed)} users")

if total_needed == 0:
    print("Nothing to do!")
    sys.exit(0)

# ── 2. Fix entry_idx=1 for users missing it ──────────────────────────────────
for uid in users_needed:
    has_idx1 = AutoPoolAccount.objects.filter(
        pool_type="FIVE_150", owner_id=uid, user_entry_index=1
    ).exists()
    if not has_idx1:
        lowest = AutoPoolAccount.objects.filter(
            pool_type="FIVE_150", owner_id=uid
        ).order_by("user_entry_index").first()
        if lowest and lowest.user_entry_index != 1:
            old = lowest.user_entry_index
            lowest.user_entry_index = 1
            lowest.save(update_fields=["user_entry_index"])
            print(f"  Fixed idx {old}->1 for user {uid}")

# ── 3. Pre-compute ALL open slots in BFS order (in memory) ──────────────────
# Get all FIVE_150 entries with their child count
all_entries = list(
    AutoPoolAccount.objects.filter(pool_type="FIVE_150")
    .values_list("id", "level")
    .order_by("level", "id")
)

# Get occupied positions per parent
occupied = {}
for row in AutoPoolAccount.objects.filter(
    pool_type="FIVE_150", parent_account__isnull=False
).values_list("parent_account_id", "position"):
    occupied.setdefault(row[0], set()).add(row[1])

# Build open slot list: (parent_id, position, child_level) sorted by level ASC, id ASC
open_slots = []
for eid, level in all_entries:
    if level >= 10:
        continue
    used = occupied.get(eid, set())
    for pos in range(1, 6):
        if pos not in used:
            open_slots.append((eid, pos, level + 1))

print(f"Available slots: {len(open_slots)} (need {total_needed})")

# ── 4. Assign slots and batch create using direct SQL for speed ──────────────
# Build the list of entries to create
entries_to_create = []
slot_idx = 0

# Get current max entry_index per user
max_idx = dict(
    AutoPoolAccount.objects.filter(pool_type="FIVE_150")
    .values("owner_id").annotate(m=Max("user_entry_index")).values_list("owner_id", "m")
)

# Preload users
user_map = {u.id: u for u in User.objects.filter(id__in=users_needed.keys())}

for uid, count in sorted(users_needed.items()):
    cur_max = max_idx.get(uid, 0)
    user = user_map.get(uid)
    if not user:
        print(f"  SKIP user {uid}: not found")
        continue
    
    for i in range(count):
        if slot_idx >= len(open_slots):
            print(f"  ERROR: ran out of slots at user {uid} entry {i+1}")
            break
        parent_id, position, child_level = open_slots[slot_idx]
        slot_idx += 1
        cur_max += 1
        
        uname = AutoPoolAccount._next_username_key(user, "FIVE_150")
        entries_to_create.append({
            "owner_id": uid,
            "username_key": uname,
            "entry_amount": Decimal("150.00"),
            "pool_type": "FIVE_150",
            "status": "ACTIVE",
            "parent_account_id": parent_id,
            "level": child_level,
            "position": position,
            "user_entry_index": cur_max,
            "source_type": "RESTORATION",
            "source_id": f"fast_restore_{uid}_{i+1}",
        })

print(f"Prepared {len(entries_to_create)} entries, inserting...")

# ── 5. Bulk insert ───────────────────────────────────────────────────────────
created = 0
errors = 0
with transaction.atomic():
    for entry in entries_to_create:
        try:
            AutoPoolAccount.objects.create(**entry)
            created += 1
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  Error: {e}")

elapsed = time.time() - start

# ── 6. Verify ────────────────────────────────────────────────────────────────
five_final = AutoPoolAccount.objects.filter(pool_type="FIVE_150").count()
three_final = AutoPoolAccount.objects.filter(pool_type="THREE_150").count()

print(f"\n{'='*60}")
print(f"DONE in {elapsed:.1f}s")
print(f"Created: {created}, Errors: {errors}")
print(f"FIVE_150: {five_final}  THREE_150: {three_final}")
print(f"Match: {'YES' if five_final == three_final else 'NO - gap: ' + str(three_final - five_final)}")
print(f"{'='*60}")
