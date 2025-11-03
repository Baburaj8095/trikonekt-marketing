import os
import sys
import importlib
from pathlib import Path

# Ensure backend is on sys.path
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402
django.setup()

from django.db import connection  # noqa: E402
from django.contrib.auth import get_user_model  # noqa: E402


MODELS = [
    "market.models.Product",
    "market.models.Banner",
    "market.models.PurchaseRequest",
    "coupons.models.CouponCode",
    "uploads.models.DashboardCard",
    "uploads.models.LuckyDrawSubmission",
    "uploads.models.LuckyCouponAssignment",
    "business.models.CommissionConfig",
    "business.models.AutoPoolAccount",
    "locations.models.Country",
    "locations.models.State",
    "locations.models.City",
]


def main():
    cfg = connection.settings_dict
    print("Database connection:")
    print(f"  ENGINE: {cfg.get('ENGINE')}")
    print(f"  NAME  : {cfg.get('NAME')}")
    host = cfg.get('HOST') or ''
    port = cfg.get('PORT') or ''
    if host or port:
        print(f"  HOST  : {host}")
        print(f"  PORT  : {port}")
    print("")

    # Users
    try:
        User = get_user_model()
        print(f"Users ({User._meta.label}): {User.objects.count()}")
    except Exception as e:
        print(f"Users ERROR: {e}")

    for path in MODELS:
        try:
            module_path, class_name = path.rsplit(".", 1)
            model = getattr(importlib.import_module(module_path), class_name)
            print(f"{model._meta.label}: {model.objects.count()}")
        except Exception as e:
            print(f"{path} ERROR: {e}")

    print("\nDone.")


if __name__ == "__main__":
    main()
