import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from accounts.models import CustomUser
from business.models import PromoPurchase, PromoMonthlyBox

users = CustomUser.objects.filter(account_active=True, category="consumer").order_by("id")
print(f"Total active consumers: {users.count()}")
for u in users:
    first_act = u.first_purchase_activated_at
    b1 = PromoMonthlyBox.objects.filter(user=u, box_number=1).first()
    p = PromoPurchase.objects.filter(user=u, status__in=["approved", "completed"]).order_by("id").first()
    print(f"ID: {u.id} | User: {u.username} | first_purchase_activated_at: {first_act} | Box1 date: {getattr(b1, 'created_at', None)} | Purchase approved: {getattr(p, 'approved_at', None) or getattr(p, 'requested_at', None)}")
