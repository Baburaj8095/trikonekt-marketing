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

state_model = AgencyRegionAssignment._meta.get_field('state').related_model
print('State model is:', state_model)
if state_model:
    print('States in DB:', list(state_model.objects.values('id', 'name')[:10]))

import inspect
try:
    from business.services import franchise
    print('\\nFranchise service methods:')
    for name, obj in inspect.getmembers(franchise):
        if inspect.isfunction(obj):
            print(' ', name)
    print('\\nfranchise.py source extract:')
    src = inspect.getsource(franchise)
    print(src[:2000])
except Exception as e:
    print('Err loading franchise service:', e)
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
