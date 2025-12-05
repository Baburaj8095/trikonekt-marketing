from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import CustomUser


class Command(BaseCommand):
    help = "Restore pincodes for specific users from known backup (derived from provided log)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Preview changes without writing to the database.",
        )

    def handle(self, *args, **opts):
        dry_run = bool(opts.get("dry_run"))

        # Mapping derived from the provided run log: before 'pincode' (left side) -> after (right side).
        # We restore the BEFORE values per user ID below.
        # Only users where pincode was actually changed are included.
        restore_map = {
            2836: "585103",
            2843: "585101",
            2863: "591307",
            2864: "560073",
            2865: "782001",
            2866: "573101",
            2867: "560091",
            2868: "562123",
            2869: "587301",
            2870: "580020",
            2871: "580023",
            2872: "580020",
            2877: "580008",
            2879: "580020",
            2892: "586201",
            2894: "560073",
            2896: "591307",
            2899: "580118",
            2900: "580031",
            2903: "560032",
            2904: "560092",
            2911: "431712",
        }

        self.stdout.write(self.style.NOTICE(f"Restoring pincodes for {len(restore_map)} users (dry_run={dry_run})"))

        total = len(restore_map)
        changed = 0
        unchanged = 0
        missing = 0

        for i, (user_id, pin) in enumerate(sorted(restore_map.items()), start=1):
            try:
                u = CustomUser.objects.get(id=user_id)
            except CustomUser.DoesNotExist:
                missing += 1
                self.stdout.write(self.style.WARNING(f"[{i}/{total}] id={user_id}: user not found"))
                continue

            before_pin = u.pincode or ""
            if before_pin == pin:
                unchanged += 1
                self.stdout.write(f"[{i}/{total}] {u.id} {u.username}: no change (already '{pin}')")
                continue

            self.stdout.write(
                self.style.SUCCESS(
                    f"[{i}/{total}] {u.id} {u.username}: revert pincode '{before_pin}' -> '{pin}'"
                )
            )

            if not dry_run:
                try:
                    with transaction.atomic():
                        u.pincode = pin
                        u.save(update_fields=["pincode"])
                    changed += 1
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"[{i}/{total}] {u.id} {u.username}: FAILED to save pincode -> {e}"))
            else:
                changed += 1  # would update

        self.stdout.write("")
        self.stdout.write(self.style.NOTICE(f"Done. changed={changed}, unchanged={unchanged}, missing={missing}, total={total}"))
        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run mode: no changes were written."))
