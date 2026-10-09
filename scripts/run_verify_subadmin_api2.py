import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_test = '''
import os
import sys

if os.path.exists("/etc/trikonekt/staging-backend.env"):
    with open("/etc/trikonekt/staging-backend.env") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

sys.path.insert(0, "/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from adminapi.views_rbac import AdminUsersListCreate
from accounts.models import CustomUser

factory = APIRequestFactory()
request = factory.get("/api/admin/users/?admin_only=1")
mock_user = CustomUser(id=1, username="admin", is_superuser=True, is_staff=True, is_active=True)
force_authenticate(request, user=mock_user)

view = AdminUsersListCreate.as_view()
response = view(request)
print("=== GET /api/admin/users/?admin_only=1 ===")
print("STATUS CODE:", response.status_code)
import json
print(json.dumps(response.data, indent=2, default=str))

# Check counts in accounts_customuser vs accounts_admin_portal_user
from django.db import connection
with connection.cursor() as cur:
    cur.execute("SELECT COUNT(*) FROM accounts_customuser;")
    c_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM accounts_admin_portal_user;")
    a_count = cur.fetchone()[0]
    print(f"\\nCOUNTS: Community Consumers (accounts_customuser) = {c_count} | Admin Portal Users (accounts_admin_portal_user) = {a_count}")
'''

with open("scripts/verify_subadmin_api2.py", "w", encoding="utf-8") as f:
    f.write(remote_test)

scp_cmd = [
    "scp",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    r"scripts\verify_subadmin_api2.py",
    f"{ec2_user}@{ec2_ip}:/tmp/verify_subadmin_api2.py"
]
subprocess.run(scp_cmd, check=True)

ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    "/srv/trikonekt/staging/backend/.venv/bin/python /tmp/verify_subadmin_api2.py"
]
subprocess.run(ssh_cmd, check=True)
