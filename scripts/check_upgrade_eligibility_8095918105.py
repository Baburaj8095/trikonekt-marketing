from accounts.models import CustomUser
from mlm_ranks.views import UserUpgradeEligibilityView
from rest_framework.test import APIRequestFactory, force_authenticate
import json

u = CustomUser.objects.filter(phone='8095918105').first()
factory = APIRequestFactory()
request = factory.get('/api/mlm/ranks/user/upgrade-eligibility/')
force_authenticate(request, user=u)
view = UserUpgradeEligibilityView.as_view()
response = view(request)
data = response.data

print("UPGRADE_ELIGIBILITY for 8095918105:")
print(json.dumps(data, indent=2, default=str))
