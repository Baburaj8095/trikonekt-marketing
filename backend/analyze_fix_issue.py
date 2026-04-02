#!/usr/bin/env python
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from business.models import PromoPurchase, AutoPoolAccount
from accounts.models import WalletTransaction, CustomUser
from coupons.models import CouponSubmission
from django.db.models import Count, Q
from decimal import Decimal as D

print("=" * 100)
print("DETAILED FIX ANALYSIS - DEBUGGING THE ISSUE")
print("=" * 100)

# Count all transaction sources
promo_count = PromoPurchase.objects.filter(status='APPROVED').count()
self_alloc_count = WalletTransaction.objects.filter(
    type='SELF_ACCOUNT_DEBIT', 
    source_type='SELF_250_PACK'
).count()
ecoupon_count = CouponSubmission.objects.filter(
    status='AGENCY_APPROVED', 
    code_ref__value=D('150.00')
).count()

total_txn_sources = promo_count + self_alloc_count + ecoupon_count

print(f"\n[1] Transaction Sources in Database:")
print(f"    Approved Promo Purchases: {promo_count}")
print(f"    Self Account 250 Allocations: {self_alloc_count}")
print(f"    E-Coupon 150 Approved: {ecoupon_count}")
print(f"    TOTAL: {total_txn_sources}")

# Count accounts by status
five_active = AutoPoolAccount.objects.filter(pool_type='FIVE_150', status='ACTIVE').count()
five_deleted = AutoPoolAccount.objects.filter(pool_type='FIVE_150', status='DELETED').count()
five_total = AutoPoolAccount.objects.filter(pool_type='FIVE_150').count()

three_active = AutoPoolAccount.objects.filter(pool_type='THREE_150', status='ACTIVE').count()
three_deleted = AutoPoolAccount.objects.filter(pool_type='THREE_150', status='DELETED').count()
three_total = AutoPoolAccount.objects.filter(pool_type='THREE_150').count()

print(f"\n[2] Account Status Breakdown:")
print(f"    FIVE_150 - ACTIVE: {five_active}, DELETED: {five_deleted}, TOTAL: {five_total}")
print(f"    THREE_150 - ACTIVE: {three_active}, DELETED: {three_deleted}, TOTAL: {three_total}")

# Check accounts by source_type
sentinel_five = AutoPoolAccount.objects.filter(pool_type='FIVE_150', source_type='SENTINEL').count()
sentinel_three = AutoPoolAccount.objects.filter(pool_type='THREE_150', source_type='SENTINEL').count()
recovery_five = AutoPoolAccount.objects.filter(pool_type='FIVE_150', source_type='RECOVERY').count()
recovery_three = AutoPoolAccount.objects.filter(pool_type='THREE_150', source_type='RECOVERY').count()

print(f"\n[3] Account Source Types:")
print(f"    FIVE_150 - SENTINEL: {sentinel_five}, RECOVERY: {recovery_five}")
print(f"    THREE_150 - SENTINEL: {sentinel_three}, RECOVERY: {recovery_three}")

# Expected total (each transaction source = 2 accounts)
expected_accounts = total_txn_sources * 2
actual_active_accounts = five_active + three_active
actual_total_accounts = five_total + three_total

print(f"\n[4] Expectations vs Reality:")
print(f"    Expected total accounts (txn × 2): {expected_accounts}")
print(f"    Actual ACTIVE accounts: {actual_active_accounts}")
print(f"    Actual TOTAL (including deleted): {actual_total_accounts}")
print(f"    Missing/Difference: {expected_accounts - actual_total_accounts}")

# Show top unbalanced users
from django.db.models import Count, Q, F

unbalanced = (
    AutoPoolAccount.objects
    .values('owner_id')
    .filter(status='ACTIVE')
    .annotate(
        five_count=Count('id', filter=Q(pool_type='FIVE_150')),
        three_count=Count('id', filter=Q(pool_type='THREE_150'))
    )
    .exclude(five_count=F('three_count'))
    .order_by('-five_count')[:15]
)

print(f"\n[5] Top 15 Unbalanced Users (FIVE ≠ THREE, ACTIVE only):")
print(f"    {'User ID':<10} {'Username':<20} {'FIVE':<8} {'THREE':<8} {'Diff':<8}")
print(f"    {'-' * 54}")

for record in unbalanced:
    try:
        user = CustomUser.objects.get(id=record['owner_id'])
        username = user.username[:18]
    except:
        username = "?(unknown)"
    
    diff = record['five_count'] - record['three_count']
    print(f"    {record['owner_id']:<10} {username:<20} {record['five_count']:<8} {record['three_count']:<8} {diff:<8}")

print("\n" + "=" * 100)
