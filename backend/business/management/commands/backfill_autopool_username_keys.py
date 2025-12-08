from django.core.management.base import BaseCommand, CommandParser
from django.db import transaction
from typing import Iterable

from business.models import AutoPoolAccount
from django.contrib.auth import get_user_model


User = get_user_model()


class Command(BaseCommand):
    help = (
        "Backfill username_key labels for AutoPoolAccount so that per (user, pool_type):\n"
        "  - First ACTIVE account uses base username (e.g., TR1234567890)\n"
        "  - Subsequent ACTIVE accounts use hyphenated suffixes (TR1234567890-2, TR1234567890-3, ...)\n"
        "This mirrors the new placement logic and is safe to re-run.\n"
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply updates (otherwise dry-run).",
        )
        parser.add_argument(
            "--pool",
            choices=["THREE_150", "FIVE_150", "THREE_50", "all"],
            default="all",
            help="Restrict to a specific pool type or process all.",
        )
        parser.add_argument(
            "--user",
            help="Restrict to a specific user by username or numeric id.",
        )
        parser.add_argument(
            "--include-nonactive",
            action="store_true",
            help="Include non-ACTIVE accounts in numbering sequence (default: only ACTIVE accounts are numbered).",
        )

    def handle(self, *args, **options):
        apply = bool(options.get("apply"))
        pool = str(options.get("pool") or "all")
        user_filter = options.get("user")
        include_nonactive = bool(options.get("include_nonactive"))

        pool_types = ["THREE_150", "FIVE_150", "THREE_50"] if pool == "all" else [pool]

        users_qs = User.objects.all()
        if user_filter:
            if user_filter.isdigit():
                users_qs = users_qs.filter(id=int(user_filter))
            else:
                users_qs = users_qs.filter(username=user_filter)

        users: Iterable[User] = users_qs.iterator()

        updated_total = 0
        scanned_total = 0

        for u in users:
            base_username = (getattr(u, "username", "") or "").strip()
            if not base_username:
                # Fallback to user id if no username present
                base_username = f"user-{u.id}"

            for pt in pool_types:
                # Determine the ordered list to compute labels on
                label_qs = AutoPoolAccount.objects.filter(owner=u, pool_type=pt).order_by("id")
                if not include_nonactive:
                    label_qs = label_qs.filter(status="ACTIVE")

                # Build mapping: account id -> new label
                new_labels = {}
                for idx, acc in enumerate(label_qs.iterator(), start=1):
                    new_key = base_username if idx == 1 else f"{base_username}-{idx}"
                    new_labels[acc.id] = new_key

                if not new_labels:
                    continue

                # Apply labels only to ACTIVE accounts by default (and to any account present in the mapping if include_nonactive)
                if include_nonactive:
                    target_qs = AutoPoolAccount.objects.filter(owner=u, pool_type=pt, id__in=new_labels.keys())
                else:
                    target_qs = AutoPoolAccount.objects.filter(owner=u, pool_type=pt, status="ACTIVE", id__in=new_labels.keys())

                with transaction.atomic():
                    for acc in target_qs.select_for_update().order_by("id"):
                        scanned_total += 1
                        desired = new_labels.get(acc.id)
                        if not desired or desired == acc.username_key:
                            continue
                        if apply:
                            acc.username_key = desired
                            acc.save(update_fields=["username_key"])
                        updated_total += 1 if apply else 0
                        self.stdout.write(
                            f"{'[APPLY] ' if apply else '[DRY]  '}User={u.username} Pool={pt} Acc#{acc.id} "
                            f"{acc.username_key} -> {desired}"
                        )

        if apply:
            self.stdout.write(self.style.SUCCESS(f"Done. Updated {updated_total} username_key values. Scanned {scanned_total} rows."))
        else:
            self.stdout.write(self.style.WARNING(f"Dry-run complete. Would update {updated_total} rows if --apply. Scanned {scanned_total} rows."))
