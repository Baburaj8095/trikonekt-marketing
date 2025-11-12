from django.core.management.base import BaseCommand
from business.models import CommissionConfig


class Command(BaseCommand):
    help = "Set the direct referral join bonus to ₹15 in CommissionConfig.referral_join_fixed_json"

    def handle(self, *args, **options):
        cfg = CommissionConfig.get_solo()
        fixed = dict(getattr(cfg, "referral_join_fixed_json", {}) or {})
        fixed["direct"] = 15  # store as plain number for JSONField
        cfg.referral_join_fixed_json = fixed
        cfg.save(update_fields=["referral_join_fixed_json", "updated_at"])
        self.stdout.write(self.style.SUCCESS("Updated referral_join_fixed_json.direct to 15"))
