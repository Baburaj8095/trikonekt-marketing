import os, django, pprint
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from adminapi.views import AdminWalletReconcileView

factory = APIRequestFactory()
User = get_user_model()
admin_user = User.objects.filter(username='admin').first()

view_rec = AdminWalletReconcileView.as_view()
req_rec = factory.get('/api/admin/wallets/reconcile/')
force_authenticate(req_rec, user=admin_user)
res_rec = view_rec(req_rec)

pprint.pprint(res_rec.data)
