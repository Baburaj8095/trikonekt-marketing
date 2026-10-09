
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
