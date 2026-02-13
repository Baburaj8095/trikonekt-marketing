from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from accounts.models import CustomUser

# Reuse the canonical sponsor resolver implemented in the existing maintenance command
try:
    from accounts.management.commands.backfill_registered_by_from_sponsor_id import resolve_sponsor_user
except Exception:
    resolve_sponsor_user = None


class Command(BaseCommand):
    help = (
        "Bulk-create Consumer accounts in a numeric username range and link them to a sponsor.\n"
        "Example:\n"
        "  python manage.py bulk_create_consumers --sponsor 0000000002 --start 8095000001 --count 10 "
        "--password 12345678 --pincode 585103\n"
        "Usernames created: 8095000001 .. 8095000010"
    )

    def add_arguments(self, parser):
        parser.add_argument("--sponsor", required=True, help="Sponsor token (e.g., TR-0000000002, 0000000002, phone, or username).")
        parser.add_argument("--start", type=int, required=True, help="Starting numeric username (inclusive).")
        parser.add_argument("--count", type=int, default=1, help="How many sequential usernames to create.")
        parser.add_argument("--password", default="12345678", help="Plain password to set for all created users.")
        parser.add_argument("--pincode", required=True, help="Pincode to assign to all created users.")
        parser.add_argument("--dry-run", action="store_true", help="Preview without committing changes.")

    def handle(self, *args, **opts):
        sponsor_token = (opts.get("sponsor") or "").strip()
        start = int(opts.get("start"))
        count = int(opts.get("count") or 0)
        password = opts.get("password") or "12345678"
        pincode = (opts.get("pincode") or "").strip()
        dry_run = bool(opts.get("dry_run"))

        if not sponsor_token:
            raise CommandError("Missing --sponsor")
        if count <= 0:
            raise CommandError("--count must be >= 1")
        if not pincode:
            raise CommandError("Missing --pincode")

        if resolve_sponsor_user is None:
            raise CommandError("Unable to import sponsor resolver. Ensure accounts.management.commands.backfill_registered_by_from_sponsor_id is present.")

        sponsor = resolve_sponsor_user(sponsor_token)
        if not sponsor:
            raise CommandError(f"Could not resolve sponsor from token: {sponsor_token}")

        self.stdout.write(self.style.NOTICE(f"Sponsor resolved: id={sponsor.id}, username={sponsor.username}, prefixed_id={getattr(sponsor, 'prefixed_id', '')}"))

        planned = []
        for i in range(count):
            uname = str(start + i)
            planned.append(uname)

        # Report existence
        exists = set(
            CustomUser.objects.filter(username__in=planned).values_list("username", flat=True)
        )
        to_create = [u for u in planned if u not in exists]
        self.stdout.write(self.style.NOTICE(f"Total requested={len(planned)}; already exists={len(exists)}; to create={len(to_create)}"))

        if dry_run:
            for u in planned:
                if u in exists:
                    self.stdout.write(f"- SKIP (exists): {u}")
                else:
                    self.stdout.write(f"- CREATE: {u} (pincode={pincode}, category=consumer, role=user)")
            self.stdout.write(self.style.SUCCESS("Dry-run complete. Re-run without --dry-run to apply."))
            return

        created = 0
        for uname in planned:
            if uname in exists:
                self.stdout.write(f"- SKIP (exists): {uname}")
                continue
            try:
                with transaction.atomic():
                    user = CustomUser.objects.create_user(
                        username=uname,
                        password=password,
                        pincode=pincode,
                        category="consumer",
                        role="user",
                        registered_by=sponsor,
                    )
                created += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"- CREATED: {uname} prefixed_id={getattr(user, 'prefixed_id', '')} sponsor=({sponsor.id},{sponsor.username})"
                    )
                )
            except Exception as e:
                self.stderr.write(self.style.WARNING(f"- FAILED: {uname} error={e}"))

        self.stdout.write(self.style.SUCCESS(f"Done. Created={created}, Skipped={len(exists)}"))
