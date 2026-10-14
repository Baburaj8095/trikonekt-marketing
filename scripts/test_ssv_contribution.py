import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from accounts.models import CustomUser
from business.models import StateSSVPool
from business.services.self_rebirth import distribute_self_rebirth_250

u = CustomUser.objects.filter(phone='9999999999').first()
print("User:", u.id, u.username, "State:", u.state)

pool_before = StateSSVPool.objects.filter(state=u.state).first()
print("Pool before:", pool_before.accumulated_amount if pool_before else 0)

# Simulate what happens in self rebirth 5b
from business.services.self_rebirth import get_rebirth_config, _q2
from decimal import Decimal
conf = get_rebirth_config()
ssv_rate = _q2(conf.get("statewise_ssv_voucher", 1.0))
print("SSV rate:", ssv_rate, type(ssv_rate))
user_state = getattr(u, "state", None)
print("User state:", user_state)

pool, _ = StateSSVPool.objects.get_or_create(state=user_state)
print("Pool ID:", pool.id, "State ID:", pool.state_id, "State Name:", pool.state.name)
pool.accumulated_amount = (pool.accumulated_amount or Decimal("0.00")) + ssv_rate
pool.save(update_fields=["accumulated_amount", "last_updated_at"])
pool.refresh_from_db()
print("Pool after:", pool.accumulated_amount, "total_accumulated:", pool.total_accumulated())
