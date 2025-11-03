from django.core.management.base import BaseCommand
from django.db import transaction
from accounts.models import CustomUser


class Command(BaseCommand):
    help = "Backfill missing category and unique_id for existing users to stabilize admin listing."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only show what would be changed without saving."
        )

    @transaction.atomic
    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)

        total = CustomUser.objects.count()
        fixed_category = 0
        fixed_unique_id = 0
        fixed_role = 0

        self.stdout.write(self.style.NOTICE(f"Scanning {total} users..."))

        for u in CustomUser.objects.all().iterator():
            changed_fields = []

            # Ensure category has a valid value
            if not u.category:
                u.category = "consumer"
                changed_fields.append("category")
                fixed_category += 1

            # Ensure unique_id exists
            if not u.unique_id:
                # Use model's helper to avoid collisions
                u.unique_id = CustomUser.generate_unique_id()
                changed_fields.append("unique_id")
                fixed_unique_id += 1

            # Optional: ensure role is consistent with category
            # Keep existing role unless it's empty; then derive minimally
            if not u.role:
                # very conservative derive
                if u.category.startswith("agency_"):
                    u.role = "agency"
                elif u.category == "employee":
                    u.role = "employee"
                else:
                    u.role = "user"
                changed_fields.append("role")
                fixed_role += 1

            if changed_fields:
                if dry_run:
                    self.stdout.write(f"[DRY] Would update user id={u.id} username={u.username} fields={changed_fields}")
                else:
                    u.save(update_fields=changed_fields)

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run complete. No changes were saved."))
        else:
            self.stdout.write(self.style.SUCCESS("Backfill complete."))
        self.stdout.write(
            f"Summary: fixed_category={fixed_category}, fixed_unique_id={fixed_unique_id}, fixed_role={fixed_role}, total_users={total}"
        )
