import os
import sys

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from django.test import RequestFactory
from accounts.models import CustomUser
from adminapi.views.matrix_tree import AdminMatrixTree5View
from business.models import AutoPoolAccount

u_admin = CustomUser.objects.filter(id=1).first()
factory = RequestFactory()

print("AutoPool Accounts currently in DB:", list(AutoPoolAccount.objects.values('id', 'owner__username', 'pool_type', 'position', 'status')))

for pool in ["FIVE_750", "FIVE_150", "THREE_750", "THREE_150"]:
    for ident in ["9999999999", "admin", ""]:
        req = factory.get(f'/api/admin/matrix/tree5/?pool={pool}&identifier={ident}&source=auto')
        req.user = u_admin
        try:
            resp = AdminMatrixTree5View.as_view()(req)
            data = resp.data
            root_name = data.get('username') if data else 'None'
            root_id = data.get('id') if data else 'None'
            print(f"Pool={pool}, Ident='{ident}' -> Root User: {root_name} (ID: {root_id})")
        except Exception as e:
            print(f"Pool={pool}, Ident='{ident}' -> ERROR: {e}")
