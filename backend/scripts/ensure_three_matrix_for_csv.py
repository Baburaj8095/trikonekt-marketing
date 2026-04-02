"""
Ensure THREE_150 exists for users listed in a CSV (default file: missing_5matrix_45d_after.csv).
Dry-run by default; set APPLY=true to actually create rows.

Usage (dry-run):
  python backend/manage.py shell -c "exec(open('backend/scripts/ensure_three_matrix_for_csv.py').read())"
Apply (destructive/create rows):
  PowerShell:
    $env:APPLY='true'; python backend/manage.py shell -c "exec(open('backend/scripts/ensure_three_matrix_for_csv.py').read())"
  bash:
    APPLY=true python backend/manage.py shell -c "exec(open('backend/scripts/ensure_three_matrix_for_csv.py').read())"

CSV format expected: first column is user_id (no header required). If file not found, script exits.
"""
import os
import csv
from datetime import datetime
from django.utils import timezone

APPLY = str(os.environ.get('APPLY', '')).lower() in ('1', 'true', 'yes')
CSV_FILE = os.environ.get('CSV_FILE', 'missing_5matrix_45d_after.csv')


def run():
    if not os.path.exists(CSV_FILE):
        print(f"CSV file not found: {CSV_FILE}")
        return

    from accounts.models import CustomUser
    from business.models import AutoPoolAccount

    to_create = []
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        rdr = csv.reader(f)
        for row in rdr:
            if not row:
                continue
            uid = row[0].strip()
            if not uid or uid.lower() == 'user_id':
                continue
            try:
                uid_int = int(uid)
            except Exception:
                continue
            u = CustomUser.objects.filter(id=uid_int).first()
            if not u:
                print(f"User not found: {uid_int}")
                continue
            has_three = AutoPoolAccount.objects.filter(owner=u, pool_type='THREE_150').exists()
            if not has_three:
                to_create.append((u.id, getattr(u, 'username', None)))

    if not to_create:
        print('No missing THREE_150 accounts found for CSV users.')
        return

    print(f"Found {len(to_create)} users missing THREE_150. APPLY={APPLY}")
    for uid, uname in to_create[:50]:
        print('sample', uid, uname)

    if not APPLY:
        print('\nDry-run complete. Set APPLY=true to create missing THREE_150 rows.')
        return

    # Create rows
    for uid, uname in to_create:
        u = CustomUser.objects.get(id=uid)
        try:
            acc = AutoPoolAccount.create_three_150_for_user(u, amount=None, source_type='RETRY_PLACEMENT', source_id=f'retry-{datetime.utcnow().isoformat(timespec="seconds")}')
            if acc:
                print('CREATED THREE_150 for', uid, 'id=', acc.id)
            else:
                print('SKIP create returned None for', uid)
        except Exception as e:
            print('ERROR creating for', uid, e)


if __name__ == '__main__':
    run()
