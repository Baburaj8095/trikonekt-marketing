"""Balance the last 5-6 excess FIVE accounts by creating matching THREE."""
import os, sys, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))
django.setup()

from business.models import AutoPoolAccount
from accounts.models import CustomUser
from decimal import Decimal as D
from django.db import connection, transaction
from django.db.models import Count
from collections import defaultdict

def fast_find_slot(pool_type, width):
    with connection.cursor() as cur:
        cur.execute("""
            SELECT p.id, p.level, COALESCE(cc.cnt, 0)
            FROM business_autopoolaccount p
            LEFT JOIN (SELECT parent_account_id, COUNT(*) AS cnt FROM business_autopoolaccount WHERE pool_type = %s GROUP BY parent_account_id) cc ON cc.parent_account_id = p.id
            WHERE p.pool_type = %s AND p.status = 'ACTIVE' AND COALESCE(cc.cnt, 0) < %s
            ORDER BY p.level ASC, p.id ASC LIMIT 1
        """, [pool_type, pool_type, width])
        row = cur.fetchone()
    if not row:
        return None, None, None
    pid, plevel, _ = row
    existing = set(AutoPoolAccount.objects.filter(parent_account_id=pid, pool_type=pool_type).values_list('position', flat=True))
    for pos in range(1, width + 1):
        if pos not in existing:
            return pid, pos, (plevel or 0) + 1
    return None, None, None

# Find all users with FIVE > THREE
counts = defaultdict(lambda: [0, 0])
for row in AutoPoolAccount.objects.filter(pool_type='FIVE_150', status='ACTIVE', parent_account__isnull=False).values('owner_id').annotate(c=Count('id')):
    counts[row['owner_id']][0] = row['c']
for row in AutoPoolAccount.objects.filter(pool_type='THREE_150', status='ACTIVE', parent_account__isnull=False).values('owner_id').annotate(c=Count('id')):
    counts[row['owner_id']][1] = row['c']

excess_users = [(uid, f - t) for uid, (f, t) in counts.items() if f > t]
excess_users.sort(key=lambda x: x[1], reverse=True)
total_need = sum(n for _, n in excess_users)
print(f"Users with excess FIVE: {len(excess_users)}, total THREE to create: {total_need}")
for uid, n in excess_users:
    print(f"  uid={uid} excess={n}")

created = 0
for uid, need in excess_users:
    user = CustomUser.objects.get(pk=uid)
    for j in range(need):
        max_idx = AutoPoolAccount.objects.filter(owner=user, pool_type='THREE_150').order_by('-user_entry_index').values_list('user_entry_index', flat=True).first()
        entry_idx = (max_idx or 0) + 1
        pid, pos, lvl = fast_find_slot('THREE_150', 3)
        if pid is None:
            print(f"  No slot for uid={uid}")
            continue
        with transaction.atomic():
            AutoPoolAccount.objects.create(
                owner=user, pool_type='THREE_150',
                username_key=f"{user.username}_3_{entry_idx}",
                entry_amount=D('150.00'), status='ACTIVE',
                source_type='RECOVERY', source_id=f'BALANCE_{j}',
                user_entry_index=entry_idx,
                parent_account_id=pid, position=pos, level=lvl,
            )
            created += 1
            print(f"  + THREE uid={uid} idx={entry_idx}")

tf = AutoPoolAccount.objects.filter(pool_type='FIVE_150', status='ACTIVE').count()
tt = AutoPoolAccount.objects.filter(pool_type='THREE_150', status='ACTIVE').count()
balanced = "YES" if tf == tt else "NO"
print(f"\nCreated: {created} THREE")
print(f"Final: FIVE={tf} THREE={tt} diff={abs(tf-tt)}")
print(f"BALANCED: {balanced}")
