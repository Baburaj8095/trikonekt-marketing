import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.contrib.auth import get_user_model
from mlm_ranks.services.upline import UplineService
from mlm_ranks.models import RankUpgrade

User = get_user_model()
u_admin = User.objects.filter(username='admin').first()
u78 = User.objects.filter(id=78).first()
u81 = User.objects.filter(id=81).first()

print(f"User 78 registered_by: {getattr(u78, 'registered_by', None)}")
print(f"User 78 sponsor_id: {getattr(u78, 'sponsor_id', None)}")
print(f"User 78 direct sponsor via UplineService: {UplineService.get_direct_sponsor(u78)}")

print(f"\nUser 81 registered_by: {getattr(u81, 'registered_by', None)}")
print(f"User 81 sponsor_id: {getattr(u81, 'sponsor_id', None)}")
print(f"User 81 direct sponsor via UplineService: {UplineService.get_direct_sponsor(u81)}")

print("\n--- ALL UPGRADES AND WHO GOT PAID ---")
for ru in RankUpgrade.objects.all().order_by('id'):
    print(f"Upgrade #{ru.id} by User {ru.user.id} ({ru.user.username}) -> Rank L{ru.to_rank.level_number}:")
    for uc in ru.commissions.all():
        print(f"   -> Paid to User {uc.to_user.id} ({uc.to_user.username}) | Amt: ₹{uc.commission_amount} | Type: {uc.commission_type}")
