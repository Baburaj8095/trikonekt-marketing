"""
Cleanup duplicate 3/5-matrix AutoPoolAccount rows created within a lookback window.

Usage (dry-run, default):
  python backend/manage.py shell -c "exec(open('backend/scripts/cleanup_duplicate_matrices.py').read())"

Apply deletion (destructive):
  PowerShell:
    $env:APPLY='true'; python backend/manage.py shell -c "exec(open('backend/scripts/cleanup_duplicate_matrices.py').read())"
  bash:
    APPLY=true python backend/manage.py shell -c "exec(open('backend/scripts/cleanup_duplicate_matrices.py').read())"

Notes:
- The script keeps the earliest created row per (owner_id, pool_type, source_type+source_id) when source_id is present.
- If source_id is empty, it keeps the earliest row per (owner_id, pool_type).
- Only considers rows created within the last `DAYS` (env var, default 45).
- Sentinel root rows (parent_account IS NULL) are ignored.
- Before deleting, the script writes a CSV backup `cleanup_duplicates_backup_<ts>.csv` listing rows it would delete.
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
    print(f"Cutoff: {cutoff} (DAYS={DAYS}), APPLY={APPLY}")

    qs = AutoPoolAccount.objects.filter(created_at__gte=cutoff).exclude(parent_account__isnull=True)

    # Build groups keyed by (owner_id, pool_type, source_key)
    groups = {}
    for row in qs.values('id', 'owner_id', 'pool_type', 'source_type', 'source_id', 'created_at'):
        owner = row['owner_id']
        pool = row['pool_type']
        src_id = row.get('source_id') or ''
        src_type = row.get('source_type') or ''
        if src_id:
            key = (owner, pool, 'BY_SOURCE', src_type, src_id)
        else:
            key = (owner, pool, 'BY_OWNER')
        groups.setdefault(key, []).append(row)

    # Decide rows to delete: for each group keep earliest created_at and delete others
    to_delete = []
    for key, items in groups.items():
        if len(items) <= 1:
            continue
        # sort by created_at ascending
        items_sorted = sorted(items, key=lambda x: x['created_at'] or datetime.min)
        keep = items_sorted[0]
        extras = items_sorted[1:]
        for ex in extras:
            to_delete.append(ex)

    if not to_delete:
        print("No duplicate rows found to delete in the lookback window.")
        return

    # Backup CSV
    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    backup_path = os.path.join(os.getcwd(), f'cleanup_duplicates_backup_{ts}.csv')
    with open(backup_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['id','owner_id','pool_type','source_type','source_id','created_at'])
        w.writeheader()
        for r in to_delete:
            w.writerow({k: (r.get(k) or '') for k in w.fieldnames})
    print(f"Backup of {len(to_delete)} rows written to: {backup_path}")

    # Show sample
    print('Sample rows to delete (first 20):')
    for r in to_delete[:20]:
        print(r)

    if not APPLY:
        print('\nDry-run mode. Set environment variable APPLY=true to actually delete these rows.')
        return

    # Proceed to delete (within transaction)
    ids_to_delete = [int(r['id']) for r in to_delete]
    print(f"Deleting {len(ids_to_delete)} rows... (this is destructive)")
    try:
        with transaction.atomic():
            # Use queryset delete for efficiency
            deleted, _ = AutoPoolAccount.objects.filter(id__in=ids_to_delete).delete()
        print(f"Deleted {deleted} objects (ORM count reported).")
        print(f"If you need to restore, use the backup CSV at: {backup_path}")
    except Exception as e:
        print('Error deleting rows:', e)


if __name__ == '__main__':
    run()
