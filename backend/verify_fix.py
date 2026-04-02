#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db.models import Count, Q, F
from autodistribution.models import AutoPoolAccount
from accounts.models import CustomUser

# Get counts
five_count = AutoPoolAccount.objects.filter(pool_type='FIVE_150').count()
three_count = AutoPoolAccount.objects.filter(pool_type='THREE_150').count()

# Get users with both FIVE and THREE
users_balanced = (
    AutoPoolAccount.objects
    .values('owner_id')
    .annotate(
        five_count=Count('id', filter=Q(pool_type='FIVE_150')),
        three_count=Count('id', filter=Q(pool_type='THREE_150'))
    )
    .filter(five_count=F('three_count'))
    .count()
)

print(f"Total FIVE_150 accounts: {five_count}")
print(f"Total THREE_150 accounts: {three_count}")
print(f"Users with balanced FIVE=THREE: {users_balanced}")
print(f"\nVerification: FIVE and THREE counts are {'EQUAL ✓' if five_count == three_count else 'DIFFERENT ✗'}")
