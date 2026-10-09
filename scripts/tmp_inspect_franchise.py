import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from accounts.models import CustomUser, AgencyRegionAssignment

agencies = list(CustomUser.objects.filter(category__startswith='agency_').values('id', 'phone', 'category', 'username'))
print("Total Existing Agency Users:", len(agencies))
for a in agencies[:10]:
    print("  ", a)

assignments = list(AgencyRegionAssignment.objects.all().values('id', 'user__phone', 'level', 'pincode', 'district', 'state__name'))
print("Total Existing Region Assignments:", len(assignments))
for ass in assignments[:10]:
    print("  ", ass)
