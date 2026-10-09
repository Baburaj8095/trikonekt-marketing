import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.contrib.auth import get_user_model

User = get_user_model()
u_admin = User.objects.filter(username='admin').first()
u78 = User.objects.filter(id=78).first()

if u78 and u_admin:
    u78.registered_by = u_admin
    u78.sponsor_id = u_admin.username
    u78.save(update_fields=['registered_by', 'sponsor_id'])
    print(f"Updated User 78 (9999999999) sponsor to User 1 (admin): registered_by={u78.registered_by}, sponsor_id={u78.sponsor_id}")

# Verify upline service
from mlm_ranks.services.upline import UplineService
sponsor_78 = UplineService.get_direct_sponsor(u78)
print(f"UplineService.get_direct_sponsor(9999999999) => {sponsor_78}")
