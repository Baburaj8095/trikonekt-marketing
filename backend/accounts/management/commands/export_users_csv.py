import csv
import os
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.utils.timezone import localtime

from accounts.models import CustomUser


class Command(BaseCommand):
    help = "Export all users with their roles/categories to a CSV file."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            type=str,
            default="fixtures/export/users_with_roles.csv",
            help="Output CSV path (relative to backend/ or absolute). Default: fixtures/export/users_with_roles.csv",
        )
        parser.add_argument(
            "--include-inactive",
            action="store_true",
            help="Include inactive users as well (default exports only active users).",
        )

    def handle(self, *args, **options):
        out_path = options["path"]
        include_inactive = options["include_inactive"]

        # Resolve output path relative to manage.py directory (backend/)
        base_dir = Path(__file__).resolve().parents[3]  # .../backend/
        out_file = Path(out_path)
        if not out_file.is_absolute():
            out_file = base_dir / out_file

        # Ensure parent directory exists
        out_file.parent.mkdir(parents=True, exist_ok=True)

        qs = CustomUser.objects.select_related("country", "state", "city", "registered_by")
        if not include_inactive:
            qs = qs.filter(is_active=True)

        # Define columns to export
        fieldnames = [
            "id",
            "username",
            "prefixed_id",
            "prefix_code",
            "role",
            "category",
            "full_name",
            "email",
            "phone",
            "sponsor_id",
            "registered_by",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
            "last_login",
            "country",
            "state",
            "city",
            "pincode",
            "depth",
            "matrix_position",
        ]

        count = 0
        # Use utf-8-sig to make Excel-friendly with BOM
        with open(out_file, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for u in qs.iterator():
                row = {
                    "id": u.id,
                    "username": u.username,
                    "prefixed_id": u.prefixed_id or "",
                    "prefix_code": u.prefix_code or "",
                    "role": u.role or "",
                    "category": u.category or "",
                    "full_name": u.full_name or "",
                    "email": u.email or "",
                    "phone": u.phone or "",
                    "sponsor_id": u.sponsor_id or "",
                    "registered_by": getattr(u.registered_by, "username", "") or "",
                    "is_active": u.is_active,
                    "is_staff": u.is_staff,
                    "is_superuser": u.is_superuser,
                    "date_joined": localtime(u.date_joined).isoformat() if u.date_joined else "",
                    "last_login": localtime(u.last_login).isoformat() if u.last_login else "",
                    "country": getattr(u.country, "name", "") or "",
                    "state": getattr(u.state, "name", "") or "",
                    "city": getattr(u.city, "name", "") or "",
                    "pincode": u.pincode or "",
                    "depth": u.depth if u.depth is not None else "",
                    "matrix_position": u.matrix_position if u.matrix_position is not None else "",
                }
                writer.writerow(row)
                count += 1

        self.stdout.write(self.style.SUCCESS(f"Exported {count} user(s) to {out_file}"))
