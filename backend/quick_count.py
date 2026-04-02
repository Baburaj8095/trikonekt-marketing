import os, sys, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
django.setup()
from business.models import AutoPoolAccount
f = AutoPoolAccount.objects.filter(pool_type='FIVE_150', status='ACTIVE').count()
t = AutoPoolAccount.objects.filter(pool_type='THREE_150', status='ACTIVE').count()
print(f"FIVE_150: {f}")
print(f"THREE_150: {t}")
print(f"Balanced: {'YES' if f == t else f'NO (diff={abs(f-t)})'}")
