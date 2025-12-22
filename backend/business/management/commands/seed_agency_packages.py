from django.core.management.base import BaseCommand
from django.db import transaction
from decimal import Decimal

from accounts.models import CustomUser
from business.models import Package, AgencyPackageAssignment


class Command(BaseCommand):
    help = "Seed/Update agency joining fee packages and assign them to all existing agencies by category."

    # Package definitions (code, name, amount)
    PACKAGES = [
        ("AG_SF", "Sub-Franchise Joining Fee", Decimal("6000.00")),
        # Sub-franchise variants (visible to Sub-franchise users via catalog: code prefix AG_SF*)
        ("AG_SF_6K", "Sub-Franchise Prime 6K", Decimal("6000.00")),
        ("AG_SF_8K", "Sub-Franchise Prime 8K", Decimal("8000.00")),
        ("AG_SF_9K", "Sub-Franchise Prime 9K", Decimal("9000.00")),
        ("AG_SF_10K", "Sub-Franchise Prime 10K", Decimal("10000.00")),
        ("AG_SF_12K", "Sub-Franchise Prime 12K", Decimal("12000.00")),
        ("AG_SF_15K", "Sub-Franchise Prime 15K", Decimal("15000.00")),
        ("AG_PIN", "Pincode Agency Joining Fee", Decimal("100000.00")),
        ("AG_PIN_CRD", "Pincode Coordinator Joining Fee", Decimal("250000.00")),
        ("AG_DST", "District Agency Joining Fee", Decimal("400000.00")),
        ("AG_DST_CRD", "District Coordinator Joining Fee", Decimal("900000.00")),
        ("AG_ST", "State Agency Joining Fee", Decimal("1500000.00")),
        ("AG_ST_CRD", "State Coordinator Joining Fee", Decimal("2000000.00")),
    ]

    # Map user.category -> package.code
    CATEGORY_TO_PACKAGE = {
        "agency_sub_franchise": "AG_SF",
        "agency_pincode": "AG_PIN",
        "agency_pincode_coordinator": "AG_PIN_CRD",
        "agency_district": "AG_DST",
        "agency_district_coordinator": "AG_DST_CRD",
        "agency_state": "AG_ST",
        "agency_state_coordinator": "AG_ST_CRD",
    }

    def add_arguments(self, parser):
        parser.add_argument(
            "--assign-only",
            action="store_true",
            help="Only (re)assign packages to agencies, do not create/update package definitions.",
        )
        parser.add_argument(
            "--update-only",
            action="store_true",
            help="Only create/update Package rows, do not assign to users.",
        )

    @transaction.atomic
    def _upsert_packages(self):
        created = 0
        updated = 0
        code_to_obj = {}

        for code, name, amount in self.PACKAGES:
            pkg, was_created = Package.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "description": name,
                    "amount": amount,
                    "is_active": True,
                    # Important: do not default-assign to all agencies; assignments are category-specific
                    "is_default": False,
                },
            )
            if was_created:
                created += 1
            else:
                changed = False
                if pkg.name != name:
                    pkg.name = name
                    changed = True
                # keep description aligned, but do not erase custom text if admin changed it
                if not pkg.description:
                    pkg.description = name
                    changed = True
                if str(pkg.amount) != str(amount):
                    pkg.amount = amount
                    changed = True
                if not pkg.is_active:
                    pkg.is_active = True
                    changed = True
                # Ensure we don't auto-assign to all agencies globally (we assign by category)
                if pkg.is_default:
                    pkg.is_default = False
                    changed = True
                if changed:
                    pkg.save(update_fields=["name", "description", "amount", "is_active", "is_default", "updated_at"])
                    updated += 1
            code_to_obj[code] = pkg

        return created, updated, code_to_obj

    @transaction.atomic
    def _assign_to_agencies(self, code_to_obj: dict[str, Package]):
        total_checked = 0
        total_created = 0

        # Build per-category queryset and assign
        for category, pkg_code in self.CATEGORY_TO_PACKAGE.items():
            pkg = code_to_obj.get(pkg_code)
            if not pkg:
                continue
            # Fetch agencies in this category
            qs = CustomUser.objects.filter(category=category).only("id", "username", "role", "category")
            for user in qs.iterator(chunk_size=1000):
                total_checked += 1
                # Ensure one (agency, package) row
                _, created = AgencyPackageAssignment.objects.get_or_create(agency_id=user.id, package_id=pkg.id)
                if created:
                    total_created += 1

        return total_checked, total_created

    def handle(self, *args, **options):
        assign_only = bool(options.get("assign_only"))
        update_only = bool(options.get("update_only"))

        self.stdout.write(self.style.NOTICE("Seeding Agency Packages:"))

        code_to_obj = {}
        if not assign_only:
            created, updated, code_to_obj = self._upsert_packages()
            self.stdout.write(self.style.SUCCESS(f"  Packages -> created: {created}, updated: {updated}"))

        # If update_only, skip assignments
        if update_only:
            self.stdout.write(self.style.SUCCESS("Completed (packages updated only)."))
            return

        # Ensure we have package objects map (in case of --assign-only)
        if assign_only:
            code_to_obj = {p.code: p for p in Package.objects.filter(code__in=[c for c, *_ in self.PACKAGES])}

        checked, assigned = self._assign_to_agencies(code_to_obj)
        self.stdout.write(self.style.SUCCESS(f"  Assignments -> agencies checked: {checked}, new assignments: {assigned}"))
        self.stdout.write(self.style.SUCCESS("Done."))
