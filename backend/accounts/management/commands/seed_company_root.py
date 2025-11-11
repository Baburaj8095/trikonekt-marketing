from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.crypto import get_random_string

from accounts.models import CustomUser


class Command(BaseCommand):
    help = "Seeds a Root Company user (TR-0000000001) and optionally a Company Manager (TRCM-xxxxxxxxxx) under it. Idempotent."

    def add_arguments(self, parser):
        parser.add_argument("--username", type=str, default="TRROOT", help="Root company username (default TRROOT)")
        parser.add_argument("--email", type=str, default="company@example.com", help="Root company email")
        parser.add_argument("--phone", type=str, default="9999999999", help="Root company phone (10 digits)")
        parser.add_argument("--password", type=str, default=None, help="Root company password (random if not provided)")

        parser.add_argument("--create-manager", action="store_true", help="Also create a Company Manager under the root")
        parser.add_argument("--manager-username", type=str, default=None, help="Company Manager username (defaults from phone)")
        parser.add_argument("--manager-email", type=str, default="manager@example.com", help="Company Manager email")
        parser.add_argument("--manager-phone", type=str, default="8888888888", help="Company Manager phone (10 digits)")
        parser.add_argument("--manager-password", type=str, default=None, help="Company Manager password (random if not provided)")

    @transaction.atomic
    def handle(self, *args, **options):
        # 1) Seed Root Company (category=company -> prefix TR -> TR-0000000001 on first allocation)
        root_existing = CustomUser.objects.filter(category="company").order_by("date_joined").first()
        if root_existing:
            self.stdout.write(self.style.WARNING(
                f"Root company already exists: {root_existing.username} | prefixed_id={root_existing.prefixed_id or '-'}"
            ))
            root_user = root_existing
        else:
            username = (options["username"] or "TRROOT").strip()
            base_username = username
            i = 1
            while CustomUser.objects.filter(username=username).exists():
                username = f"{base_username}-{i:02d}"
                i += 1

            password = options.get("password") or f"Root@{get_random_string(6)}"
            phone = "".join(c for c in (options.get("phone") or "9999999999") if c.isdigit())[:10]

            root_user = CustomUser.objects.create_user(
                username=username,
                email=options.get("email") or "company@example.com",
                password=password,
                role="user",  # role choices: user/agency/employee
            )
            # assign profile details
            root_user.full_name = "Company Root"
            root_user.phone = phone
            root_user.category = "company"  # maps to prefix TR
            # elevate for admin ops + relaxed sponsorship for agencies
            root_user.is_staff = True
            root_user.is_superuser = True
            root_user.is_active = True
            # Save triggers:
            #  - unique_id if missing
            #  - prefixed_id allocation with TR-0000000001 (if first)
            #  - sponsor_id defaults to own prefixed_id
            root_user.save()

            self.stdout.write(self.style.SUCCESS(
                f"Created Root Company user: {root_user.username} | prefixed_id={root_user.prefixed_id} | unique_id={root_user.unique_id}"
            ))
            self.stdout.write(self.style.MIGRATE_HEADING(
                f"Root password: {password} (change after login)"
            ))

        # 2) Optionally seed a Company Manager (TRCM-xxxxxxxxxx) under Root
        if options.get("create_manager"):
            m_phone = "".join(c for c in (options.get("manager_phone") or "8888888888") if c.isdigit())[:10]
            # Build a default manager username if not provided
            mgr_username = options.get("manager_username")
            if not mgr_username:
                mgr_username = f"TRCM{m_phone}"
                base_mgr = mgr_username
                j = 1
                while CustomUser.objects.filter(username=mgr_username).exists():
                    mgr_username = f"{base_mgr}-{j:02d}"
                    j += 1

            manager_existing = CustomUser.objects.filter(username__iexact=mgr_username).first()
            if manager_existing:
                self.stdout.write(self.style.WARNING(
                    f"Company Manager already exists: {manager_existing.username} | prefixed_id={manager_existing.prefixed_id or '-'}"
                ))
            else:
                mgr_password = options.get("manager_password") or f"Mgr@{get_random_string(6)}"
                manager = CustomUser.objects.create_user(
                    username=mgr_username,
                    email=options.get("manager_email") or "manager@example.com",
                    password=mgr_password,
                    role="user",
                )
                manager.full_name = "Company Manager"
                manager.phone = m_phone
                manager.category = "company_manager"  # maps to TRCM
                # upline
                manager.registered_by = root_user
                # Save to allocate TRCM-xxxxxxxxxx and persist
                manager.save()

                # Ensure sponsor_id stores upline's code (root)
                try:
                    if getattr(root_user, "prefixed_id", None):
                        manager.sponsor_id = root_user.prefixed_id
                        manager.save(update_fields=["sponsor_id"])
                except Exception:
                    pass

                self.stdout.write(self.style.SUCCESS(
                    f"Created Company Manager: {manager.username} | prefixed_id={manager.prefixed_id} | unique_id={manager.unique_id}"
                ))
                self.stdout.write(self.style.MIGRATE_HEADING(
                    f"Manager password: {mgr_password} (change after login)"
                ))

        self.stdout.write(self.style.SUCCESS("Seeding complete."))
