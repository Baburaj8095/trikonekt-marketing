import os, django, pprint
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from adminapi.views import AdminWalletDetailView

factory = APIRequestFactory()
User = get_user_model()
admin_user = User.objects.filter(username='admin').first()

view_detail = AdminWalletDetailView.as_view()
req_detail = factory.get('/api/admin/wallets/1/')
force_authenticate(req_detail, user=admin_user)
res_detail = view_detail(req_detail, user_id=1)
print("=== WALLET DETAIL FOR USER 1 ===")
pprint.pprint(res_detail.data)
