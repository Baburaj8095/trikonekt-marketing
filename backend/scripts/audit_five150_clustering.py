"""
Audit existing FIVE_150 entries to check if 2nd+ entries
are placed under the user's base (first) entry.
"""
import os, sys, django
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from business.models import AutoPoolAccount
from django.db.models import Count

# Find users with more than 1 FIVE_150 entry
multi = list(
    AutoPoolAccount.objects
    .filter(pool_type='FIVE_150')
    .values('owner_id', 'owner__username')
    .annotate(cnt=Count('id'))
    .filter(cnt__gt=1)
    .order_by('-cnt')
)

print("Users with multiple FIVE_150 entries:")
print("=" * 70)

total_extra = 0
needs_move = []

for row in multi:
    uid = row['owner_id']
    uname = row['owner__username']
    cnt = row['cnt']
    total_extra += (cnt - 1)

    entries = list(AutoPoolAccount.objects.filter(
        owner_id=uid, pool_type='FIVE_150'
    ).order_by('user_entry_index').values_list(
        'id', 'username_key', 'user_entry_index', 'parent_account_id', 'level', 'position'
    ))

    print(f"\nUser {uid} ({uname}): {cnt} entries")
    base_id = entries[0][0] if entries else None

    for eid, ukey, idx, pid, lvl, pos in entries:
        marker = ' [BASE]' if eid == base_id else ''
        is_under_base = ''

        if eid != base_id and pid:
            # Walk up parents to see if base_id is an ancestor
            cur = pid
            depth = 0
            found = False
            while cur and depth < 30:
                if cur == base_id:
                    found = True
                    break
                try:
                    parent = AutoPoolAccount.objects.filter(id=cur).values_list('parent_account_id', flat=True).first()
                    cur = parent
                    depth += 1
                except Exception:
                    break
            if found:
                is_under_base = ' -> UNDER BASE (OK)'
            else:
                is_under_base = ' -> NOT under base (NEEDS MOVE)'
                needs_move.append({
                    'entry_id': eid,
                    'owner_id': uid,
                    'username': uname,
                    'username_key': ukey,
                    'base_id': base_id,
                    'current_parent': pid,
                    'level': lvl,
                    'position': pos,
                })

        print(f"  id={eid} key={ukey} idx={idx} parent={pid} level={lvl} pos={pos}{marker}{is_under_base}")

print(f"\n{'=' * 70}")
print(f"Summary:")
print(f"  Users with multiple FIVE_150 entries: {len(multi)}")
print(f"  Total extra entries (2nd+): {total_extra}")
print(f"  Entries already under base (OK): {total_extra - len(needs_move)}")
print(f"  Entries NOT under base (need move): {len(needs_move)}")
total_five = AutoPoolAccount.objects.filter(pool_type='FIVE_150').count()
print(f"  Total FIVE_150 entries: {total_five}")

if needs_move:
    print(f"\nEntries that need re-placement:")
    print("-" * 70)
    for nm in needs_move:
        print(f"  entry_id={nm['entry_id']} ({nm['username_key']}) owner={nm['owner_id']} ({nm['username']}) base_id={nm['base_id']} current_parent={nm['current_parent']}")
