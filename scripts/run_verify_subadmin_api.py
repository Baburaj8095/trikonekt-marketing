import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_test = '''
import os
import sys
import django

sys.path.insert(0, "/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.test import RequestFactory
from adminapi.views_rbac import AdminUsersListCreate
from accounts.models import CustomUser

rf = RequestFactory()
request = rf.get("/api/admin/users/?admin_only=1")
# create mock user with is_superuser=True
mock_user = CustomUser(id=1, username="admin", is_superuser=True, is_staff=True)
request.user = mock_user

view = AdminUsersListCreate.as_view()
response = view(request)
print("STATUS CODE:", response.status_code)
print("DATA:")
import json
print(json.dumps(response.data, indent=2, default=str))
'''

with open("scripts/verify_subadmin_api.py", "w", encoding="utf-8") as f:
    f.write(remote_test)

scp_cmd = [
    "scp",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    r"scripts\verify_subadmin_api.py",
    f"{ec2_user}@{ec2_ip}:/tmp/verify_subadmin_api.py"
]
subprocess.run(scp_cmd, check=True)

ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    "/srv/trikonekt/staging/backend/.venv/bin/python /tmp/verify_subadmin_api.py"
]
subprocess.run(ssh_cmd, check=True)
