import os
import sys
import django

sys.path.append('/srv/trikonekt/app/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from accounts.models import CustomUser
from accounts.views import WalletMe

try:
    user = CustomUser.objects.filter(username='9999999999').first()
    if not user:
        print("User 9999999999 not found!")
    else:
        print("User ID:", user.id)
        
        # Mock request with APIRequestFactory
        factory = APIRequestFactory()
        request = factory.get('/accounts/wallet/me/')
        force_authenticate(request, user=user)
        
        # Invoke view
        view = WalletMe.as_view()
        response = view(request)
        
        print("Status code:", response.status_code)
        print("Response data:")
        from pprint import pprint
        pprint(response.data)
        
except Exception as e:
    print("Error:", e)
