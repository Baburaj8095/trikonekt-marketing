"""
Force cleanup duplicate 3/5-matrix AutoPoolAccount rows by (owner_id, pool_type).
Keeps earliest created row per (owner_id, pool_type) and deletes others within lookback window.

Usage (dry-run):
  python backend/manage.py shell -c "exec(open('backend/scripts/force_cleanup_duplicate_matrices.py').read())"
Apply (destructive):
  PowerShell:
    $env:APPLY='true'; python backend/manage.py shell -c "exec(open('backend/scripts/force_cleanup_duplicate_matrices.py').read())"
  bash:
    APPLY=true python backend/manage.py shell -c "exec(open('backend/scripts/force_cleanup_duplicate_matrices.py').read())"

This is more aggressive than the previous cleanup: it ignores `source_id` and treats any additional rows
for the same owner+pool as duplicates. Use with caution and review the backup CSV before applying.
"""

import os
import csv
from datetime import datetime, timedelta
from django.utils import timezone
from django.db import transaction

DAYS = int(os.environ.get('DAYS', '45'))
APPLY = str(os.environ.get('APPLY', '')).lower() in ('1', 'true', 'yes')


def run():
    from business.models import AutoPoolAccount

    cutoff = timezone.now() - timedelta(days=DAYS)
    print(f"Force cleanup cutoff: {cutoff} (DAYS={DAYS}), APPLY={APPLY})")

    qs = AutoPoolAccount.objects.filter(created_at__gte=cutoff).exclude(parent_account__isnull=True)

    # Group by (owner_id, pool_type)
    groups = {}
    for row in qs.values('id', 'owner_id', 'pool_type', 'source_type', 'source_id', 'created_at'):
        key = (row['owner_id'], row['pool_type'])
        groups.setdefault(key, []).append(row)

    to_delete = []
    for key, items in groups.items():
        if len(items) <= 1:
            continue
        items_sorted = sorted(items, key=lambda x: x['created_at'] or datetime.min)
        keep = items_sorted[0]
        extras = items_sorted[1:]
        for ex in extras:
            to_delete.append(ex)

    if not to_delete:
        print('No duplicates found by owner+pool in the lookback window.')
        return

    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    backup_path = os.path.join(os.getcwd(), f'force_cleanup_duplicates_backup_{ts}.csv')
    with open(backup_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['id','owner_id','pool_type','source_type','source_id','created_at'])
        w.writeheader()
        for r in to_delete:
            w.writerow({k: (r.get(k) or '') for k in w.fieldnames})
    print(f'Backup of {len(to_delete)} rows written to: {backup_path}')

    print('Sample rows to delete (first 20):')
    for r in to_delete[:20]:
        print(r)

    if not APPLY:
        print('\nDry-run mode. Set environment variable APPLY=true to actually delete these rows.')
        return

    ids_to_delete = [int(r['id']) for r in to_delete]
    print(f'Deleting {len(ids_to_delete)} rows... (this is destructive)')
    try:
        with transaction.atomic():
            deleted, _ = AutoPoolAccount.objects.filter(id__in=ids_to_delete).delete()
        print(f'Deleted {deleted} objects (ORM count reported).')
        print(f'If you need to restore, use the backup CSV at: {backup_path}')
    except Exception as e:
        print('Error deleting rows:', e)


if __name__ == '__main__':
    run()
