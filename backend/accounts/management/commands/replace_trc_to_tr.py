from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction


class Command(BaseCommand):
    help = (
        "Rename usernames from TRC<phone> to TR<phone>.\n"
        "- By default, only category='consumer' users are processed.\n"
        "- Uses safe per-user updates with collision checks.\n"
        "- Supports --dry-run to preview without writing."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview changes without writing.",
        )
        parser.add_argument(
            "--include-non-consumers",
            action="store_true",
            help="Also rename non-consumer accounts (by default only consumers are processed).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Process at most N records (useful for testing).",
        )
        parser.add_argument(
            "--starts-with",
            type=str,
            default="TRC",
            help="Current username prefix to replace (default: TRC).",
        )
        parser.add_argument(
            "--new-prefix",
            type=str,
            default="TR",
            help="New username prefix to set (default: TR).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        dry_run = bool(options.get("dry_run"))
        include_non_consumers = bool(options.get("include_non_consumers"))
        old_prefix = str(options.get("starts_with") or "TRC")
        new_prefix = str(options.get("new_prefix") or "TR")
        limit = options.get("limit")

        User = get_user_model()

        qs = User.objects.filter(username__startswith=old_prefix).order_by("id")
        # Restrict to consumers unless explicitly overridden
        if not include_non_consumers and hasattr(User, "category"):
            qs = qs.filter(category="consumer")

        if limit:
            qs = qs[: int(limit)]

        total = qs.count()
        scope = "all categories" if include_non_consumers else "category='consumer'"
        self.stdout.write(f"Found {total} users with username starting with '{old_prefix}' in {scope}.")
        if dry_run:
            self.stdout.write("[DRY RUN] No changes will be written.")

        renamed = 0
        skipped_collision = 0
        skipped_nochange = 0
        skipped_invalid = 0

        for user in qs:
            old_username = user.username or ""
            if not old_username.startswith(old_prefix):
                skipped_invalid += 1
                continue

            # Prefer using phone when username pattern exactly matches TRC+phone
            tail_from_username = old_username[len(old_prefix):]
            if getattr(user, "phone", None):
                expected = f"{old_prefix}{user.phone}"
                if old_username == expected:
                    new_username = f"{new_prefix}{user.phone}"
                else:
                    new_username = f"{new_prefix}{tail_from_username}"
            else:
                new_username = f"{new_prefix}{tail_from_username}"

            if old_username == new_username:
                skipped_nochange += 1
                continue

            # Ensure uniqueness before updating
            if User.objects.filter(username=new_username).exclude(pk=user.pk).exists():
                self.stdout.write(f"COLLISION: {old_username} -> {new_username} (skipped)")
                skipped_collision += 1
                continue

            if dry_run:
                self.stdout.write(f"Would rename {old_username} -> {new_username}")
            else:
                user.username = new_username
                user.save(update_fields=["username"])
                self.stdout.write(f"Renamed {old_username} -> {new_username}")
            renamed += 1

        if dry_run:
            self.stdout.write("Dry run complete (no data written).")

        self.stdout.write(self.style.SUCCESS(
            f"Summary: renamed={renamed}, collisions={skipped_collision}, nochange={skipped_nochange}, invalid={skipped_invalid}"
        ))
