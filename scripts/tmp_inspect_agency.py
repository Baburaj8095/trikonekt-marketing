
import json
from accounts.models import CustomUser, AgencyRegionAssignment
from business.models import CommissionConfig

print("--- CommissionConfig master_commission_json ---")
cfg = CommissionConfig.get_solo()
master = cfg.master_commission_json or {}
print(json.dumps({
    'geo_mode': master.get('geo_mode', {}),
    'geo_fixed': master.get('geo_fixed', {}),
    'direct_bonus': master.get('direct_bonus', {}),
    'products': master.get('products', {}),
    'tax': master.get('tax', {}),
}, indent=2))

print("--- Agency users in DB ---")
for u in CustomUser.objects.filter(category__startswith='agency_'):
    print(f"  ID: {u.id}, Phone: {u.phone}, Username: {u.username}, Category: {u.category}, Name: {u.first_name} {u.last_name}")

print("--- Captains in DB ---")
for u in CustomUser.objects.filter(category__icontains='captain'):
    print(f"  ID: {u.id}, Phone: {u.phone}, Username: {u.username}, Category: {u.category}")

print("--- Region Assignments in DB ---")
for r in AgencyRegionAssignment.objects.all():
    print(f"  ID: {r.id}, User: {r.user.phone}, Category: {r.user.category}, Level: {r.level}, Pincode: {r.pincode}, District: {r.district}, State: {getattr(r.state, 'name', r.state)}")
