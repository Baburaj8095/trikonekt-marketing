import os, sys, django
sys.path.append("/srv/trikonekt/staging/backend")
if os.path.exists("/etc/trikonekt/staging-backend.env"):
    with open("/etc/trikonekt/staging-backend.env") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.db import connection
cursor = connection.cursor()
cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;")
tables = [r[0] for r in cursor.fetchall()]
print(f"Total tables in public schema: {len(tables)}")

from accounts.models import CustomUser
from business.models import PromoPackage, CommissionConfig
from mlm_ranks.models import Rank as MlmRank
from coupons.models import Coupon, CouponCode

print(f"CustomUser count: {CustomUser.objects.count()}")
for u in CustomUser.objects.all()[:15]:
    print(f"  User: {u.id} | {u.username} | phone={u.phone} | is_staff={u.is_staff} | is_superuser={u.is_superuser}")

print(f"PromoPackage count: {PromoPackage.objects.count()}")
for p in PromoPackage.objects.all():
    print(f"  Pkg: {p.id} | {p.code} | {p.name} | {p.price} | {p.type}")

cfg = CommissionConfig.objects.first()
print(f"CommissionConfig exists: {cfg is not None}")
if cfg:
    print(f"  tax_percent: {cfg.tax_percent}")

print(f"mlm_ranks.Rank count: {MlmRank.objects.count()}")
for r in MlmRank.objects.all().order_by('level_number'):
    print(f"  Rank: L{r.level_number} | {r.rank_name} | {r.upgrade_amount}")

print(f"Coupons count: {Coupon.objects.count()}, CouponCodes: {CouponCode.objects.count()}")

from locations.models import State, City
print(f"Locations - States: {State.objects.count()}, Cities: {City.objects.count()}")
