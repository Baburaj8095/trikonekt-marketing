#!/usr/bin/env python
"""
Matrix Recovery - Uses proper placement methods with RECOVERY source type.
Both create_five_150_for_user and create_three_150_for_user are now patched
to allow unlimited RECOVERY sources (bypassing max_allowed=1 limit).
"""
import os
import sys
import django
from decimal import Decimal as D
from collections import defaultdict

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
sys.path.insert(0, backend_path)
django.setup()

from business.models import PromoPurchase, AutoPoolAccount
from accounts.models import WalletTransaction, CustomUser
from coupons.models import CouponSubmission

APPLY = '--apply' in sys.argv

print("\n" + "=" * 80)
print("MATRIX ACCOUNT RECOVERY")
print("=" * 80 + "\n")

expected_matrices = defaultdict(lambda: {'five': 0, 'three': 0})
seen_package_first = defaultdict(set)

# Collect expected account counts per user
purchases = PromoPurchase.objects.filter(status='APPROVED').select_related('package')
for p in purchases:
    uid = p.user_id
    code = getattr(p.package, 'code', '')
    price = float(getattr(p.package, 'price', 0) or 0)
    qty = int(getattr(p, 'quantity', 1) or 1)

    creates_matrix = False
    if price <= 200:
        creates_matrix = True
    elif price >= 750:
        if code not in seen_package_first[uid]:
            creates_matrix = True
            seen_package_first[uid].add(code)

    if creates_matrix:
        expected_matrices[uid]['five'] += qty
        expected_matrices[uid]['three'] += qty

self_allocs = WalletTransaction.objects.filter(
    type='SELF_ACCOUNT_DEBIT', source_type='SELF_250_PACK'
)
for alloc in self_allocs:
    uid = alloc.user_id
    expected_matrices[uid]['five'] += 1
    expected_matrices[uid]['three'] += 1

ecoupons = CouponSubmission.objects.filter(
    status='AGENCY_APPROVED', code_ref__value=D('150.00')
)
for ec in ecoupons:
    uid = ec.consumer_id
    expected_matrices[uid]['five'] += 1
    expected_matrices[uid]['three'] += 1

print(f"Total users with expected accounts: {len(expected_matrices)}")

# Build list of users needing accounts
to_fix = []
total_missing_five = 0
total_missing_three = 0

for uid in expected_matrices.keys():
    actual_five = AutoPoolAccount.objects.filter(owner_id=uid, pool_type='FIVE_150', status='ACTIVE').count()
    actual_three = AutoPoolAccount.objects.filter(owner_id=uid, pool_type='THREE_150', status='ACTIVE').count()

    missing_five = max(0, expected_matrices[uid]['five'] - actual_five)
    missing_three = max(0, expected_matrices[uid]['three'] - actual_three)

    if missing_five == 0 and missing_three == 0:
        continue

    try:
        user = CustomUser.objects.get(pk=uid)
        role = getattr(user, 'role', '')
        category = getattr(user, 'category', '')
        if role in ['agency', 'employee', 'staff']:
            continue
    except Exception:
        continue

    to_fix.append({
        'user': user,
        'missing_five': missing_five,
        'missing_three': missing_three,
    })
    total_missing_five += missing_five
    total_missing_three += missing_three

print(f"Users needing fix: {len(to_fix)}")
print(f"Missing FIVE_150: {total_missing_five}")
print(f"Missing THREE_150: {total_missing_three}")
print(f"Total to create: {total_missing_five + total_missing_three}")

if not APPLY:
    print("\nDRY-RUN mode. Run with --apply to execute.")
    print("=" * 80 + "\n")
    sys.exit(0)

print("\nStarting account creation...")
created_five = 0
created_three = 0
failed_five = 0
failed_three = 0

for i, item in enumerate(to_fix):
    user = item['user']
    uid = user.id

    # Create missing FIVE_150
    for j in range(item['missing_five']):
        try:
            acc = AutoPoolAccount.create_five_150_for_user(
                user=user,
                amount=D('150.00'),
                source_type='RECOVERY',
                source_id=f'BATCH_FIX_{j}',
                max_allowed=1,
            )
            if acc:
                created_five += 1
            else:
                failed_five += 1
                print(f"  [SKIP] FIVE user={uid} #{j+1}: returned None")
        except Exception as e:
            failed_five += 1
            print(f"  [ERR] FIVE user={uid} #{j+1}: {e}")

    # Create missing THREE_150
    for j in range(item['missing_three']):
        try:
            acc = AutoPoolAccount.create_three_150_for_user(
                user=user,
                amount=D('150.00'),
                source_type='RECOVERY',
                source_id=f'BATCH_FIX_{j}',
                max_allowed=1,
            )
            if acc:
                created_three += 1
            else:
                failed_three += 1
                print(f"  [SKIP] THREE user={uid} #{j+1}: returned None")
        except Exception as e:
            failed_three += 1
            print(f"  [ERR] THREE user={uid} #{j+1}: {e}")

    if (i + 1) % 10 == 0:
        print(f"  Progress: {i+1}/{len(to_fix)} users | FIVE: {created_five} created, {failed_five} failed | THREE: {created_three} created, {failed_three} failed")

print(f"\n{'='*80}")
print(f"RECOVERY COMPLETE")
print(f"  FIVE_150 created: {created_five}  failed/skip: {failed_five}")
print(f"  THREE_150 created: {created_three}  failed/skip: {failed_three}")

# Final counts
final_five = AutoPoolAccount.objects.filter(pool_type='FIVE_150', status='ACTIVE').count()
final_three = AutoPoolAccount.objects.filter(pool_type='THREE_150', status='ACTIVE').count()
print(f"\nFinal DB counts:")
print(f"  FIVE_150: {final_five}")
print(f"  THREE_150: {final_three}")
print(f"  Balanced: {'YES' if abs(final_five - final_three) <= 5 else 'NO (diff=' + str(abs(final_five-final_three)) + ')'}")
print("=" * 80 + "\n")
