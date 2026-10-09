import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_code = """
import os, sys, django
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from accounts.models import CustomUser, AgencyRegionAssignment
try:
    from accounts.models import State, District
except ImportError:
    State = District = None

print('Agency categories in CustomUser:')
for c in getattr(CustomUser, 'CATEGORY_CHOICES', []):
    if 'agency' in c[0]:
        print(' ', c)

print('\\nAgencyRegionAssignment fields:')
for f in AgencyRegionAssignment._meta.fields:
    print(' ', f.name, f.get_internal_type())

if State:
    print('\\nStates matching Karnataka / Goa:')
    for s in State.objects.filter(name__iregex=r'karnataka|goa'):
        print(' ', s.id, s.name)
if District:
    print('\\nDistricts matching Tumkur / Tumakuru / Hassan:')
    for d in District.objects.filter(name__iregex=r'tumkur|tumakuru|hassan'):
        print(' ', d.id, d.name, getattr(d, 'state_id', None))
"""

cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    f"sudo env $(sudo cat /etc/trikonekt/staging-backend.env | xargs) /srv/trikonekt/staging/backend/.venv/bin/python -c \"{remote_code}\""
]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("ERR:", res.stderr)
