from django.core.management.base import BaseCommand, CommandParser
from django.db.models import Q

from accounts.models import CustomUser


class Command(BaseCommand):
    help = (
        "Backfill account_active=True for all Agency accounts. "
        "Matches users with role='agency' OR category starting with 'agency'. "
        "Optionally include business accounts."
    )

    def add_arguments(self, parser: CommandParser):
        parser.add_argument(
            "--include-business",
            action="store_true",
            help="Also activate Business accounts (category='business').",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show counts only; do not perform updates.",
        )

    def handle(self, *args, **options):
        include_business: bool = bool(options.get("include_business"))
        dry_run: bool = bool(options.get("dry_run"))

        agency_q = Q(role="agency") | Q(category__startswith="agency")
        base_q = agency_q
        if include_business:
            base_q = base_q | Q(category="business")

        inactive_qs = CustomUser.objects.filter(base_q, account_active=False)

        total_inactive = inactive_qs.count()
        total_agencies = CustomUser.objects.filter(agency_q).count()
        total_business = CustomUser.objects.filter(category="business").count()

        self.stdout.write(self.style.NOTICE(f"Inactive matching accounts: {total_inactive}"))
        self.stdout.write(f"Total agencies: {total_agencies}; business: {total_business}")

        if dry_run:
            self.stdout.write(self.style.SUCCESS("Dry run: no updates performed."))
            return

        updated = inactive_qs.update(account_active=True)
        self.stdout.write(self.style.SUCCESS(f"Activated {updated} accounts."))
