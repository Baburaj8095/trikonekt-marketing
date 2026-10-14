import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from accounts.models import CustomUser
from accounts.views_tree import MyMatrix5EntriesTree
from rest_framework.test import APIRequestFactory, force_authenticate

u = CustomUser.objects.filter(username="9999999999").first()
factory = APIRequestFactory()

# 5-Blocks test
req5 = factory.get('/api/accounts/my/matrix/tree5/entries/?pool=FIVE_150')
force_authenticate(req5, user=u)
view = MyMatrix5EntriesTree.as_view()
res5 = view(req5)
print("5-Blocks View Status:", res5.status_code)
d5 = res5.data
print("5-Blocks Root:", d5.get("username_key"), "Account ID:", d5.get("account_id"), "Owner ID:", d5.get("owner_id"))
print("5-Blocks Children count:", len(d5.get("children", [])))

# 3-Blocks test
req3 = factory.get('/api/accounts/my/matrix/tree5/entries/?pool=THREE_150')
force_authenticate(req3, user=u)
res3 = view(req3)
print("3-Blocks View Status:", res3.status_code)
d3 = res3.data
print("3-Blocks Root:", d3.get("username_key"), "Account ID:", d3.get("account_id"), "Owner ID:", d3.get("owner_id"))
print("3-Blocks Children count:", len(d3.get("children", [])))
