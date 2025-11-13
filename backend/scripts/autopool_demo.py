# Demo script to validate percent-based autopool payouts end-to-end.
# Usage:
#   cd backend && python manage.py shell -c "exec(open('scripts/autopool_demo.py','r',encoding='utf-8').read())"

from django.contrib.auth import get_user_model
from accounts.models import WalletTransaction
from business.models import CommissionConfig
from business.services import activation as activation_service
from business.services.activation import activate_150_active as _a150
import json as _json

# 1) Ensure config is set (percents mode)
cfg = CommissionConfig.get_solo()
cfg.five_matrix_levels = 6
cfg.five_matrix_percents_json = [10, 8, 6, 4, 2, 1]
cfg.three_matrix_levels = 15
cfg.three_matrix_percents_json = [5, 4, 3, 2, 2, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
cfg.three_matrix_amounts_json = []
cfg.save()

# 2) Create a small upline chain: upline2_test -> sponsor_test -> child_test
User = get_user_model()

sponsor2, _ = User.objects.get_or_create(
    username="upline2_test",
    defaults={"password": "pass1234", "category": "consumer", "role": "user"},
)

sponsor, _ = User.objects.get_or_create(
    username="sponsor_test",
    defaults={"password": "pass1234", "category": "consumer", "role": "user", "registered_by": sponsor2},
)
if not sponsor.registered_by_id:
    sponsor.registered_by = sponsor2
    sponsor.save(update_fields=["registered_by"])

child, _ = User.objects.get_or_create(
    username="child_test",
    defaults={"password": "pass1234", "category": "consumer", "role": "user", "registered_by": sponsor},
)
if not child.registered_by_id:
    child.registered_by = sponsor
    child.save(update_fields=["registered_by"])

# 3) Trigger 50 activation once (idempotent on repeat)
created_50 = activation_service.activate_50(child, {"type": "shell_demo", "id": "SELF50_DEMO"}, package_code="SELF_50")
print("activate_50 created:", created_50)

# 4) Trigger 150 Active once to test 5-matrix as well (idempotent)
created_150 = _a150(child, {"type": "shell_demo", "id": "PRIME150_DEMO"})
print("activate_150_active created:", created_150)

# 5) Dump recent transactions for the three users
rows = list(
    WalletTransaction.objects.filter(user__username__in=["child_test", "sponsor_test", "upline2_test"])
    .order_by("-created_at")
    .values("user__username", "type", "amount", "balance_after", "meta", "created_at")[:50]
)
print(_json.dumps(rows, default=str, indent=2))

# 6) Show current config arrays and base amounts
cfg = CommissionConfig.get_solo()
dump = {
    "prime_activation_amount": str(cfg.prime_activation_amount),
    "global_activation_amount": str(cfg.global_activation_amount),
    "five_matrix_levels": cfg.five_matrix_levels,
    "five_matrix_percents_json": cfg.five_matrix_percents_json,
    "three_matrix_levels": cfg.three_matrix_levels,
    "three_matrix_percents_json": cfg.three_matrix_percents_json,
}
print(_json.dumps({"config": dump}, ensure_ascii=False, indent=2))
