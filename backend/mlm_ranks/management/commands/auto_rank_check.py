from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction

from mlm_ranks.services.eligibility import RankEligibilityService


class Command(BaseCommand):
    help = "Daily rank checker: recompute Prime-750 gated directs/team size for users and cache on UserRank."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=1000, help="Max users to process (default 1000).")
        parser.add_argument("--offset", type=int, default=0, help="Skip first N users (default 0).")
        parser.add_argument("--only-user-id", type=int, default=None, help="Process a single user id.")
        parser.add_argument("--dry-run", action="store_true", help="Compute only; rely on service to persist minimal counters.")

    def handle(self, *args, **options):
        limit = int(options.get("limit") or 1000)
        offset = int(options.get("offset") or 0)
        only_user_id = options.get("only_user_id")
        dry = bool(options.get("dry_run"))

        try:
            from accounts.models import CustomUser
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Failed to import accounts.CustomUser: {e}"))
            return

        qs = CustomUser.objects.all().order_by("id")
        qs = qs.filter(is_active=True)
        if only_user_id:
            qs = qs.filter(id=int(only_user_id))
        if offset:
            qs = qs[offset:]
        if limit:
            qs = qs[:limit]

        total = 0
        eligible = 0
        errors = 0

        for user in qs.iterator():
            total += 1
            try:
                # RankEligibilityService.evaluate() persists cached direct_count and total_team_size
                res = RankEligibilityService.evaluate(user)
                if res and res.eligible:
                    eligible += 1
                # No explicit writes here other than service's cached counters.
                # Further auto-upgrade is not performed; payment/initiation is manual per business rules.
            except Exception as e:
                errors += 1
                self.stderr.write(self.style.WARNING(f"User {getattr(user, 'id', '?')}: {e}"))
                continue

        self.stdout.write(self.style.SUCCESS(f"Checked users: {total}, eligible (next rank): {eligible}, errors: {errors}"))
