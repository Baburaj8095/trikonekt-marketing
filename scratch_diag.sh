set -a
source /etc/trikonekt/staging-backend.env
set +a
cd /srv/trikonekt/staging/backend
.venv/bin/python manage.py shell << 'EOF'
import json
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from adminapi.views import AdminDailySalesReportView

User = get_user_model()
u1 = User.objects.filter(id=1).first()
factory = APIRequestFactory()

req = factory.get("/admin/analytics/sales/?from=2026-10-05&to=2026-10-05")
force_authenticate(req, user=u1)
resp = AdminDailySalesReportView.as_view()(req)
print("Keys in resp.data:", resp.data.keys())
print("Data:", resp.data)
EOF
