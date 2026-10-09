import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
remote_code = '''
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
'''

with open("scripts/tmp_inspect_agency.py", "w") as f:
    f.write(remote_code)

subprocess.run(["scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", "scripts/tmp_inspect_agency.py", "ubuntu@65.0.40.184:/tmp/tmp_inspect_agency.py"], check=True)
cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    "ubuntu@65.0.40.184",
    "cd /srv/trikonekt/staging/backend && set -a && . /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python manage.py shell < /tmp/tmp_inspect_agency.py"
]
res = subprocess.run(cmd, capture_output=True, text=True)
print("STDOUT:\n", res.stdout)
if res.stderr:
    print("STDERR:\n", res.stderr)
