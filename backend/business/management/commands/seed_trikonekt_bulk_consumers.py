from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import CustomUser


class Command(BaseCommand):
    help = (
        "Seed TRIKONEKT bulk consumers:\n"
        " - Create 20 direct Consumers with usernames TR9000000001..TR9000000020 under sponsor 'TRIKONEKT'\n"
        " - Then create 7 direct Consumers each under TR9000000001..TR9000000005 (total 35),\n"
        "   with usernames TR9000000021..TR9000000055.\n"
        "All created/updated users are set with pincode and password as provided (defaults: 560001 / 12345678)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--pincode", type=str, default="560001", help="Pincode to set for all created users (default: 560001)")
        parser.add_argument("--password", type=str, default="12345678", help="Password to set for all created users (default: 12345678)")
        parser.add_argument("--dry-run", action="store_true", help="Print what would be created/updated without saving")

    def _make_username(self, number: int) -> str:
        # Format: TR + 10-digit number (e.g., TR9000000001)
        return f"TR{number:010d}"

    def _upsert_consumer(self, *, username: str, sponsor: CustomUser, pincode: str, password: str, dry_run: bool):
        """
        Create or update a consumer user with the exact requested attributes.
        Ensures:
          - role=user, category=consumer
          - is_staff=False, is_superuser=False
          - account_active=True
          - pincode set as provided
          - registered_by set to sponsor
          - password set to provided value
        Returns (created: bool, updated_fields: list[str])
        """
        updated_fields = []
        u = CustomUser.objects.filter(username=username).first()
        created = False

        if not u:
            created = True
            if dry_run:
                return True, ["create"]
            u = CustomUser(
                username=username,
                role="user",
                category="consumer",
                is_staff=False,
                is_superuser=False,
                account_active=True,
                pincode=pincode or "",
                registered_by=sponsor,
                full_name=username,
            )
            u.set_password(password)
            u.save()
            return True, ["create"]

        # Update fields to match requirements
        def _set(attr, val):
            nonlocal updated_fields
            cur = getattr(u, attr, None)
            if cur != val:
                setattr(u, attr, val)
                updated_fields.append(attr)

        _set("role", "user")
        _set("category", "consumer")
        _set("is_staff", False)
        _set("is_superuser", False)
        _set("account_active", True)
        _set("pincode", pincode or "")
        _set("registered_by", sponsor)
        # Set full_name best-effort if blank
        try:
            if not getattr(u, "full_name", ""):
                _set("full_name", username)
        except Exception:
            pass

        # Always set the requested password
        if not dry_run:
            u.set_password(password)
            # Password changes are not reflected via update_fields; note it in updated_fields marker
            updated_fields.append("password")

        if updated_fields and not dry_run:
            # Remove duplicates in case password marker duplicates
            uniq = []
            for f in updated_fields:
                if f not in uniq:
                    uniq.append(f)
            updated_fields = uniq
            # Only update non-password fields via update_fields optimization
            non_pwd_fields = [f for f in updated_fields if f != "password"]
            if non_pwd_fields:
                u.save(update_fields=non_pwd_fields)
            else:
                # Still persist any internal changes if any (unlikely)
                u.save()

        return created, updated_fields

    @transaction.atomic
    def handle(self, *args, **options):
        pincode: str = options.get("pincode") or "560001"
        password: str = options.get("password") or "12345678"
        dry_run: bool = bool(options.get("dry_run"))

        root = CustomUser.objects.filter(username="TRIKONEKT").first()
        if not root:
            raise CommandError("Root sponsor 'TRIKONEKT' not found. Run backend/scripts/set_root_trikonekt.py first.")

        created_total = 0
        updated_total = 0
        logs: list[str] = []

        # Batch 1: TR9000000001 .. TR9000000020 under TRIKONEKT
        first_start = 9000000001
        first_end = 9000000020

        self.stdout.write(self.style.MIGRATE_HEADING(f"Creating first batch {first_start}..{first_end} under TRIKONEKT (pincode={pincode})"))
        for n in range(first_start, first_end + 1):
            uname = self._make_username(n)
            created, fields = self._upsert_consumer(username=uname, sponsor=root, pincode=pincode, password=password, dry_run=dry_run)
            if created:
                created_total += 1
                logs.append(f"[CREATE] {uname} -> sponsor=TRIKONEKT")
            else:
                if fields:
                    updated_total += 1
                    logs.append(f"[UPDATE] {uname} fields={fields}")

        # Resolve sponsors TR9000000001..TR9000000005
        sponsors = []
        for i in range(1, 6):
            su = self._make_username(9000000000 + i)
            s = CustomUser.objects.filter(username=su).first()
            if not s:
                raise CommandError(f"Sponsor user not found: {su}. Ensure first batch created successfully.")
            sponsors.append(s)

        # Batch 2: TR9000000021 .. TR9000000055 (35 users) distributed 7 each to sponsors[0..4]
        second_start = 9000000021
        second_end = 9000000055
        if (second_end - second_start + 1) != 35:
            raise CommandError("Internal range error for second batch.")

        self.stdout.write(self.style.MIGRATE_HEADING(f"Creating second batch {second_start}..{second_end} under TR9000000001..TR9000000005 (7 each)"))
        current = second_start
        for sponsor in sponsors:
            for _ in range(7):
                uname = self._make_username(current)
                created, fields = self._upsert_consumer(username=uname, sponsor=sponsor, pincode=pincode, password=password, dry_run=dry_run)
                if created:
                    created_total += 1
                    logs.append(f"[CREATE] {uname} -> sponsor={sponsor.username}")
                else:
                    if fields:
                        updated_total += 1
                        logs.append(f"[UPDATE] {uname} fields={fields}")
                current += 1

        self.stdout.write(self.style.SUCCESS(f"Completed. Created={created_total}, Updated={updated_total}, DryRun={dry_run}"))
        # Print a concise summary mapping for verification
        self.stdout.write(self.style.NOTICE("Summary (first 10 log lines):"))
        for line in logs[:10]:
            self.stdout.write(line)
        if len(logs) > 10:
            self.stdout.write(f"... ({len(logs) - 10} more)")
