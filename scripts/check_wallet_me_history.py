from accounts.models import CustomUser
from accounts.views import wallet_me_history
from rest_framework.test import APIRequestFactory, force_authenticate
import json

u = CustomUser.objects.filter(phone='9999999999').first()
factory = APIRequestFactory()
request = factory.get('/api/wallets/me/history/')
force_authenticate(request, user=u)
response = wallet_me_history(request)
data = response.data

keys_to_print = ['level_earnings', 'layer_matrix_earned', 'direct_edu_earned', 'e_edu_total_earned', 'income', 'current_limit', 'is_limit_reached', 'missing_income']
out = {k: data.get(k) for k in keys_to_print}
print("WALLET_ME_HISTORY:")
print(json.dumps(out, indent=2))
