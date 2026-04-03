"""
RESTORE_FIVE150_ENTRIES.PY
==========================
Restore missing FIVE_150 (5-matrix) entries that were deleted by
cleanup_excess_entries.py and cleanup_with_reparenting.py.

Strategy:
---------
1. Use THREE_150 entry counts as the ground truth (THREE_150 was never touched)
2. For each user where THREE_150 count > FIVE_150 count, recreate the difference
3. Use the model's own placement logic (place_in_five_pool) for correct BFS placement
4. First fix 3 users (121, 124, 362) who lost their entry_idx=1

Run with:
    python manage.py shell < scripts/restore_five150_entries.py
"""

import os
import sys
import django
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.db import transaction
from django.db.models import Count, Max
from django.contrib.auth import get_user_model
from business.models import AutoPoolAccount
from decimal import Decimal

User = get_user_model()

# ── Step 0: Pre-flight snapshot ──────────────────────────────────────────────
print("=" * 70)
print("FIVE_150 RESTORATION SCRIPT")
print("=" * 70)

five_total_before = AutoPoolAccount.objects.filter(pool_type="FIVE_150").count()
three_total = AutoPoolAccount.objects.filter(pool_type="THREE_150").count()
print(f"\nPre-restoration counts:")
print(f"  FIVE_150: {five_total_before}")
print(f"  THREE_150: {three_total} (reference)")

# ── Step 1: Identify missing entries ─────────────────────────────────────────
five_counts = dict(
    AutoPoolAccount.objects.filter(pool_type="FIVE_150")
    .values("owner_id")
    .annotate(cnt=Count("id"))
    .values_list("owner_id", "cnt")
)
three_counts = dict(
    AutoPoolAccount.objects.filter(pool_type="THREE_150")
    .values("owner_id")
    .annotate(cnt=Count("id"))
    .values_list("owner_id", "cnt")
)

users_to_restore = {}
for uid, tc in sorted(three_counts.items()):
    fc = five_counts.get(uid, 0)
    if tc > fc:
        users_to_restore[uid] = tc - fc

total_to_create = sum(users_to_restore.values())
print(f"\nUsers needing restoration: {len(users_to_restore)}")
print(f"Total FIVE_150 entries to recreate: {total_to_create}")

if total_to_create == 0:
    print("\nNo entries to restore. Exiting.")
    sys.exit(0)

# ── Step 2: Fix entry_idx=1 for users who lost their primary entry ──────────
print("\n── Fixing missing entry_idx=1 ──")
fixed_idx1 = 0
for uid in list(users_to_restore.keys()):
    has_idx1 = AutoPoolAccount.objects.filter(
        pool_type="FIVE_150", owner_id=uid, user_entry_index=1
    ).exists()
    if not has_idx1:
        # Get entry with lowest user_entry_index
        lowest = (
            AutoPoolAccount.objects.filter(pool_type="FIVE_150", owner_id=uid)
            .order_by("user_entry_index")
            .first()
        )
        if lowest and lowest.user_entry_index != 1:
            old_idx = lowest.user_entry_index
            lowest.user_entry_index = 1
            lowest.save(update_fields=["user_entry_index"])
            fixed_idx1 += 1
            print(f"  User {uid}: renamed entry_idx={old_idx} -> 1 (entry ID={lowest.id})")

print(f"  Fixed entry_idx=1 for {fixed_idx1} users")

# ── Step 3: Recreate missing entries using placement logic ───────────────────
print("\n── Recreating missing FIVE_150 entries ──")
created = 0
errors = []

for uid, missing_count in sorted(users_to_restore.items()):
    try:
        user = User.objects.get(id=uid)
    except User.DoesNotExist:
        errors.append(f"User {uid}: does not exist")
        continue

    for i in range(missing_count):
        try:
            acc = AutoPoolAccount.place_in_five_pool(
                user,
                pool_type="FIVE_150",
                amount=Decimal("150.00"),
                source_type="RESTORATION",
                source_id=f"restore_five150_{uid}_{i+1}",
            )
            if acc:
                created += 1
            else:
                errors.append(f"User {uid} entry {i+1}/{missing_count}: place_in_five_pool returned None")
        except Exception as e:
            errors.append(f"User {uid} entry {i+1}/{missing_count}: {type(e).__name__}: {e}")

# ── Step 4: Post-restoration verification ────────────────────────────────────
print(f"\n── Results ──")
print(f"  Entries created: {created} / {total_to_create}")
print(f"  Errors: {len(errors)}")

if errors:
    print("\n── Errors ──")
    for e in errors[:30]:
        print(f"  {e}")
    if len(errors) > 30:
        print(f"  ... and {len(errors) - 30} more")

# Final counts
five_total_after = AutoPoolAccount.objects.filter(pool_type="FIVE_150").count()
print(f"\n── Final counts ──")
print(f"  FIVE_150 before: {five_total_before}")
print(f"  FIVE_150 after:  {five_total_after}")
print(f"  THREE_150:       {three_total}")
print(f"  Match: {'YES' if five_total_after == three_total else 'NO - still ' + str(three_total - five_total_after) + ' short'}")

# Check per-user balance
still_mismatch = 0
five_counts_after = dict(
    AutoPoolAccount.objects.filter(pool_type="FIVE_150")
    .values("owner_id")
    .annotate(cnt=Count("id"))
    .values_list("owner_id", "cnt")
)
for uid, tc in three_counts.items():
    fc = five_counts_after.get(uid, 0)
    if tc != fc:
        still_mismatch += 1
        if still_mismatch <= 10:
            print(f"  Still mismatched: User {uid} THREE_150={tc} FIVE_150={fc}")

print(f"\n  Users still mismatched: {still_mismatch}")
print("=" * 70)
print("RESTORATION COMPLETE")
print("=" * 70)
