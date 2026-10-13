import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from accounts.models import CustomUser
from business.models import PromoMonthlyBox, PromoPurchase, AutoPoolAccount

print("Checking and backfilling first_purchase_activated_at for active users...")
active_users = CustomUser.objects.filter(account_active=True).order_by("id")

for u in active_users:
    if not u.first_purchase_activated_at:
        # 1. Earliest PromoMonthlyBox box 1
        b1 = PromoMonthlyBox.objects.filter(user=u, box_number=1).order_by("id").first()
        if b1 and b1.created_at:
            u.first_purchase_activated_at = b1.created_at
            u.save(update_fields=["first_purchase_activated_at"])
            print(f"User {u.id} ({u.username}): stamped first_purchase_activated_at = {b1.created_at} (from PromoMonthlyBox #1)")
            continue

        # 2. Earliest AutoPoolAccount
        ap = AutoPoolAccount.objects.filter(owner=u, pool_type="FIVE_150").order_by("id").first()
        if ap and ap.created_at:
            u.first_purchase_activated_at = ap.created_at
            u.save(update_fields=["first_purchase_activated_at"])
            print(f"User {u.id} ({u.username}): stamped first_purchase_activated_at = {ap.created_at} (from AutoPoolAccount)")
            continue

        # 3. Earliest PromoPurchase
        pp = PromoPurchase.objects.filter(user=u, status__in=["approved", "completed"]).order_by("id").first()
        if pp:
            ts = pp.approved_at or pp.requested_at or pp.created_at
            if ts:
                u.first_purchase_activated_at = ts
                u.save(update_fields=["first_purchase_activated_at"])
                print(f"User {u.id} ({u.username}): stamped first_purchase_activated_at = {ts} (from PromoPurchase)")
                continue

        # 4. Fallback to date_joined
        u.first_purchase_activated_at = u.date_joined
        u.save(update_fields=["first_purchase_activated_at"])
        print(f"User {u.id} ({u.username}): fallback stamped first_purchase_activated_at = {u.date_joined}")
    else:
        print(f"User {u.id} ({u.username}): already stamped = {u.first_purchase_activated_at}")

print("\n--- Current Active Users Sorted by Activation Time ---")
sorted_users = CustomUser.objects.filter(account_active=True, category="consumer").order_by("first_purchase_activated_at", "id")
for idx, su in enumerate(sorted_users, 1):
    print(f"{idx}. ID: #{su.id} | Username: {su.username} | Activation Time: {su.first_purchase_activated_at}")
