import os, sys, django
sys.path.insert(0, '/srv/trikonekt/app/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from accounts.models import CustomUser, AgencyRegionAssignment

print('--- Agency Users ---')
for u in CustomUser.objects.filter(category__startswith='agency'):
    print(u.username, u.category, u.pincode, 'is_act=', u.is_active, 'acc_act=', getattr(u, 'account_active', None))

print('--- Region Assignments ---')
for a in AgencyRegionAssignment.objects.all():
    print(a.user.username, a.level, a.pincode, a.district)
