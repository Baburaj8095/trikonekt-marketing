from accounts.models import CustomUser
from accounts.views import wallet_me_history
from rest_framework.test import APIRequestFactory, force_authenticate

u = CustomUser.objects.filter(phone="9999999999").first()
factory = APIRequestFactory()
request = factory.get("/api/accounts/wallet/me/history/")
force_authenticate(request, user=u)
resp = wallet_me_history(request)
data = resp.data
print("=== LIVE API OUTPUT FOR 9999999999 ===")
print("layer_matrix_earned:", data.get("layer_matrix_earned"))
print("layer_income_all_sources:", data.get("layer_income_all_sources"))
print("5 Blocks (FIVE_LAYER):", data.get("category_stats", {}).get("FIVE_LAYER"))
print("3 Blocks (THREE_LAYER):", data.get("category_stats", {}).get("THREE_LAYER"))
print("e-Edu Layer (E_EDU_LAYER):", data.get("category_stats", {}).get("E_EDU_LAYER"))
