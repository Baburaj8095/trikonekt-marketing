#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from business.models import AutoPoolAccount
from accounts.models import CustomUser
from django.db.models import Count, Q

print("=" * 80)
print("CURRENT MATRIX STATUS CHECK")
print("=" * 80)

# Total counts
five_total = AutoPoolAccount.objects.filter(pool_type='FIVE_150').count()
three_total = AutoPoolAccount.objects.filter(pool_type='THREE_150').count()

print(f"\n[1] Total Accounts in Database:")
print(f"    FIVE_150 accounts:  {five_total}")
print(f"    THREE_150 accounts: {three_total}")
print(f"    Status: {'✓ BALANCED' if five_total == three_total else '✗ UNBALANCED'}")

# Get admin user
try:
    admin_user = CustomUser.objects.get(username='admin')
    admin_five = AutoPoolAccount.objects.filter(
        owner_id=admin_user.id, 
        pool_type='FIVE_150'
    ).count()
    admin_three = AutoPoolAccount.objects.filter(
        owner_id=admin_user.id, 
        pool_type='THREE_150'
    ).count()
    
    print(f"\n[2] Admin User (ID: {admin_user.id}) Matrix Counts:")
    print(f"    FIVE_150 accounts:  {admin_five}")
    print(f"    THREE_150 accounts: {admin_three}")
    print(f"    Status: {'✓ BALANCED' if admin_five == admin_three else '✗ UNBALANCED'}")
    
    # Check recently created accounts
    from django.utils import timezone
    from datetime import timedelta
    recently = timezone.now() - timedelta(minutes=15)
    
    recent_admin_five = AutoPoolAccount.objects.filter(
        owner_id=admin_user.id,
        pool_type='FIVE_150',
        created_at__gte=recently
    ).count()
    recent_admin_three = AutoPoolAccount.objects.filter(
        owner_id=admin_user.id,
        pool_type='THREE_150',
        created_at__gte=recently
    ).count()
    
    print(f"\n[3] Admin User - Recently Created (last 15 min):")
    print(f"    FIVE_150 accounts:  {recent_admin_five}")
    print(f"    THREE_150 accounts: {recent_admin_three}")
    
except CustomUser.DoesNotExist:
    print("\n[2] Admin user not found")

# Get unbalanced users
unbalanced = (
    AutoPoolAccount.objects
    .values('owner_id')
    .annotate(
        five_count=Count('id', filter=Q(pool_type='FIVE_150')),
        three_count=Count('id', filter=Q(pool_type='THREE_150'))
    )
    .exclude(five_count=3)  # Exclude having exactly 3 FIVE
    .exclude(five_count=0)  # Exclude having 0 accounts
    .order_by('-five_count')[:10]
)

print(f"\n[4] Top 10 Unbalanced Users (excluding those with exactly 3 FIVE):")
print(f"    {'User ID':<10} {'FIVE':<8} {'THREE':<8} {'Diff':<8}")
print(f"    {'-' * 40}")
for record in unbalanced:
    diff = record['five_count'] - record['three_count']
    print(f"    {record['owner_id']:<10} {record['five_count']:<8} {record['three_count']:<8} {diff:<8}")

# Check if any users have THREE == 95
users_with_95_three = (
    AutoPoolAccount.objects
    .values('owner_id')
    .annotate(three_count=Count('id', filter=Q(pool_type='THREE_150')))
    .filter(three_count=95)
)

print(f"\n[5] Users with THREE_150 count = 95:")
if users_with_95_three.exists():
    for record in users_with_95_three:
        owner_id = record['owner_id']
        try:
            user = CustomUser.objects.get(id=owner_id)
            five_count = AutoPoolAccount.objects.filter(
                owner_id=owner_id,
                pool_type='FIVE_150'
            ).count()
            print(f"    User ID: {owner_id} ({user.username}) - FIVE: {five_count}, THREE: 95")
        except:
            print(f"    User ID: {owner_id} - FIVE: ?, THREE: 95")
else:
    print("    No users found with THREE_150 count = 95")

print("\n" + "=" * 80)
