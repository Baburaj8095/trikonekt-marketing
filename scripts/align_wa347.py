import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from decimal import Decimal
from accounts.models import WalletAccount

w = WalletAccount.objects.get(id=347)
w.current_balance = Decimal('5284.25')
w.available_balance = Decimal('5284.25')
w.save(update_fields=['current_balance', 'available_balance'])
print("WalletAccount 347 aligned to 5284.25")
