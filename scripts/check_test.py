import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from business.models import CommissionConfig, RootConsumerConfig, AutoPoolAccount
from accounts.models import CustomUser

cfg = CommissionConfig.get_solo()
rc = RootConsumerConfig.get_solo()
print("Company user:", cfg.get_company_user())
print("tax_company_user:", getattr(cfg, "tax_company_user", None))
print("Root consumer:", rc.get_root_user())
print("Company category users:", list(CustomUser.objects.filter(category="company")))
print("User 9999999999:", CustomUser.objects.filter(username="9999999999").first())
print("User admin:", CustomUser.objects.filter(username="admin").first())

roots = AutoPoolAccount.objects.filter(parent_account__isnull=True)
print("AutoPoolAccount Roots:")
for r in roots:
    print(f"  id={r.id}, pool={r.pool_type}, owner={r.owner}, username_key={r.username_key}, user_entry_index={r.user_entry_index}")
