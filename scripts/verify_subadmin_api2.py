
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
    print(f"\nCOUNTS: Community Consumers (accounts_customuser) = {c_count} | Admin Portal Users (accounts_admin_portal_user) = {a_count}")
