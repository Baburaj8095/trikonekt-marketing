from django.core.management.base import BaseCommand
from django.db import connection
from importlib import import_module


MODELS = [
    "django.contrib.auth.get_user_model",  # special case handler
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


class Command(BaseCommand):
    help = "Print row counts for key models to verify data migration. Uses current DATABASES['default'] connection."

    def handle(self, *args, **options):
        cfg = connection.settings_dict
        self.stdout.write(self.style.NOTICE("Database connection:"))
        self.stdout.write(f"  ENGINE: {cfg.get('ENGINE')}")
        self.stdout.write(f"  NAME  : {cfg.get('NAME')}")
        host = cfg.get('HOST') or ''
        port = cfg.get('PORT') or ''
        if host or port:
            self.stdout.write(f"  HOST  : {host}")
            self.stdout.write(f"  PORT  : {port}")
        self.stdout.write("")

        total_models = 0
        failures = 0

        # Handle auth user model specially
        from django.contrib.auth import get_user_model
        try:
            User = get_user_model()
            cnt = User.objects.count()
            self.stdout.write(f"Users ({User._meta.label}): {cnt}")
            total_models += 1
        except Exception as e:
            self.stderr.write(f"Users ({User._meta.label}) ERROR: {e}")
            failures += 1

        for path in MODELS:
            if path == "django.contrib.auth.get_user_model":
                continue
            try:
                module_path, class_name = path.rsplit(".", 1)
                model = getattr(import_module(module_path), class_name)
            except Exception as e:
                self.stderr.write(f"{path} IMPORT ERROR: {e}")
                failures += 1
                continue

            try:
                cnt = model.objects.count()
                self.stdout.write(f"{model._meta.label}: {cnt}")
                total_models += 1
            except Exception as e:
                self.stderr.write(f"{model._meta.label} QUERY ERROR: {e}")
                failures += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Finished. Models checked: {total_models}, failures: {failures}"))
