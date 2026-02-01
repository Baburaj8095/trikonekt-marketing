import json
from decimal import Decimal

from business.models import CommissionConfig


def conv(o):
    if isinstance(o, Decimal):
        return float(o)
    if isinstance(o, dict):
        return {k: conv(v) for k, v in o.items()}
    if isinstance(o, list):
        return [conv(x) for x in o]
    return o


cfg = CommissionConfig.get_solo()
data = {
    "id": cfg.id,
    "updated_at": str(cfg.updated_at),
    "master": conv(dict(getattr(cfg, "master_commission_json", {}) or {})),
}

# Write to project root (one level up from backend/)
with open(r"..\\diag_db_monthly_759.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
