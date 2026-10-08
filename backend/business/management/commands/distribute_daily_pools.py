from django.core.management.base import BaseCommand
from business.services.daily_pool_distributor import execute_daily_pool_distribution


class Command(BaseCommand):
    help = "Execute daily midnight pool distribution (Royalty Tier 1, Tier 2, and Franchise pools) at 11:59 PM"

    def add_arguments(self, parser):
        parser.add_argument("--date", type=str, default="", help="Target date YYYY-MM-DD")
        parser.add_argument("--dry-run", action="store_true", help="Perform simulation without crediting wallets")
        parser.add_argument("--force", action="store_true", help="Force execution even if already distributed")

    def handle(self, *args, **options):
        target_date = options.get("date") or ""
        dry_run = options.get("dry_run", False)
        force = options.get("force", False)

        self.stdout.write(f"Executing daily pool distribution (date={target_date or 'today'}, dry_run={dry_run}, force={force})...")
        res = execute_daily_pool_distribution(target_date=target_date, dry_run=dry_run, force=force)
        self.stdout.write(str(res))
