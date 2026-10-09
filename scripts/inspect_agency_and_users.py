import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_code = """
import os, sys, django
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from accounts.views import UsersListView
from accounts.models import CustomUser

factory = APIRequestFactory()
agency = CustomUser.objects.filter(role='agency', pincode='572106').first()
req = factory.get('/api/accounts/users/?pincode=572106&role=user')
force_authenticate(req, user=agency)

view = UsersListView.as_view()
resp = view(req)
print('STATUS:', resp.status_code)
print('RESULTS_COUNT:', len(resp.data.get('results', [])))
for r in resp.data.get('results', []):
    print('USER_ROW:', r.get('id'), r.get('username'), r.get('phone'), r.get('full_name'), r.get('pincode'))
"""

cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    f"sudo env $(sudo cat /etc/trikonekt/staging-backend.env | xargs) /srv/trikonekt/staging/backend/.venv/bin/python -c \"{remote_code}\""
]

res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
print(res.stdout)
