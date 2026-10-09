from accounts.models import CustomUser
from mlm_ranks.views import upgrade_eligibility
from rest_framework.test import APIRequestFactory, force_authenticate
import json

u = CustomUser.objects.filter(phone='9999999999').first()
factory = APIRequestFactory()
request = factory.get('/api/mlm/ranks/upgrade-eligibility/')
force_authenticate(request, user=u)
response = upgrade_eligibility(request)
data = response.data

print("UPGRADE_ELIGIBILITY:")
print(json.dumps(data, indent=2, default=str))
