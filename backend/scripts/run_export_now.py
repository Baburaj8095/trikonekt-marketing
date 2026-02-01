from __future__ import annotations

import json
import os
import traceback
from decimal import Decimal
from pathlib import Path

# Resolve paths
BACKEND_DIR = Path(__file__).resolve().parents[1]  # .../v1/backend
PROJECT_ROOT = BACKEND_DIR.parent                  # .../v1

# Ensure correct CWD and settings
os.chdir(BACKEND_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# Bootstrap Django
import django  # noqa: E402

django.setup()

from business.models import CommissionConfig  # noqa: E402


def conv(o):
    if isinstance(o, Decimal):
        return float(o)
    if isinstance(o, dict):
        return {k: conv(v) for k, v in o.items()}
    if isinstance(o, list):
        return [conv(x) for x in o]
    return o


status_path = PROJECT_ROOT / "diag_export_status.txt"

try:
    cfg = CommissionConfig.get_solo()
    data = {
        "id": cfg.id,
        "updated_at": str(cfg.updated_at),
        "master": conv(dict(getattr(cfg, "master_commission_json", {}) or {})),
    }
    out_path = PROJECT_ROOT / "diag_db_monthly_759.json"
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    status_path.write_text("OK", encoding="utf-8")
except Exception as e:
    status_path.write_text(f"ERR: {repr(e)}\n{traceback.format_exc()}", encoding="utf-8")
