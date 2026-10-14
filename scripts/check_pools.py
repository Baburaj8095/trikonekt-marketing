import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from accounts.models import CustomUser, Wallet, WalletAccount
u = CustomUser.objects.filter(username="9999999999").first()
print("WalletAccount fields:", [f.name for f in WalletAccount._meta.fields])
was = WalletAccount.objects.filter(user=u)
for wa in was:
    print({f.name: getattr(wa, f.name) for f in WalletAccount._meta.fields})

sys.path.insert(0, '/srv/trikonekt/tri-academy/backend/src/scripts')
from growth_bridge_exec import get_user_overview
print("get_user_overview for 9999999999:")
import json
print(json.dumps(get_user_overview("9999999999"), indent=2, default=str))
