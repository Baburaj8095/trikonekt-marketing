from typing import List, Optional

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from accounts.models import CustomUser, AgencyRegionAssignment


def _norm_csv(val: Optional[str]) -> List[str]:
    if not val:
        return []
    parts = [x.strip() for x in val.split(",")]
    return [p for p in parts if p]


def _find_sf_for_pin(pin: str) -> Optional[CustomUser]:
    # Prefer by region assignment to the pincode
    sf = (
        CustomUser.objects.filter(
            category="agency_sub_franchise",
            region_assignments__level="pincode",
            region_assignments__pincode=str(pin),
        )
        .order_by("id")
        .first()
    )
    if sf:
        return sf
    # Fallback by older username pattern
    return CustomUser.objects.filter(username=f"TRSF_{pin}", category="agency_sub_franchise").first()


def _safe_rename_username(user: CustomUser, new_username: str, dry_run: bool) -> str:
    if user.username == new_username:
        return "unchanged"
    # Check for collision
    exists = CustomUser.objects.filter(username=new_username).exclude(id=user.id).exists()
    if exists:
        raise CommandError(
            f"Username '{new_username}' already exists (collision while renaming user id={user.id} '{user.username}')."
        )
    if not dry_run:
        user.username = new_username
        user.save(update_fields=["username"])
    return "renamed"


def _ensure_sf_pin_assignment(sf: CustomUser, pin: str, dry_run: bool):
    if AgencyRegionAssignment.objects.filter(
        user=sf, level="pincode", pincode=str(pin)
    ).exists():
        return
    if not dry_run:
        AgencyRegionAssignment.objects.get_or_create(
            user=sf, level="pincode", pincode=str(pin), defaults=dict(state=sf.state, district="")
        )


class Command(BaseCommand):
    help = (
        "Rename existing Sub-Franchise, Employee and Consumer usernames to phone-number format based on pincodes.\n"
        "Sub-Franchise: 9{PIN}000 (e.g., 9585102000)\n"
        "Employees: 9{PIN}{001..} (up to --employees per pin)\n"
        "Consumers: 9{PIN}{100..} (up to --consumers per pin)\n"
        "Also updates phone field to match username, and sets sponsor_id/registered_by to the Sub-Franchise."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--pincodes",
            type=str,
            required=True,
            help="CSV of pincodes to process (e.g., 585102,585103,585104)",
        )
        parser.add_argument(
            "--employees",
            type=int,
            default=5,
            help="Number of employees to rename per pincode (default 5). Existing employees are selected by pincode and SF sponsorship.",
        )
        parser.add_argument(
            "--consumers",
            type=int,
            default=10,
            help="Number of consumers to rename per pincode (default 10). Existing consumers are selected by pincode and SF sponsorship.",
        )
        parser.add_argument("--dry_run", action="store_true", help="Preview changes without writing")

    @transaction.atomic
    def handle(self, *args, **options):
        pins = [p for p in _norm_csv(options.get("pincodes")) if p.isdigit()]
        if not pins:
            raise CommandError("Provide at least one numeric pincode via --pincodes.")
        employees_cap = int(options.get("employees") or 5)
        consumers_cap = int(options.get("consumers") or 10)
        dry_run = bool(options.get("dry_run"))

        self.stdout.write(self.style.NOTICE(
            f"Renaming usernames to phone format for pins={pins} (employees_per={employees_cap}, consumers_per={consumers_cap})"
        ))
        if dry_run:
            self.stdout.write(self.style.WARNING("[DRY RUN] No changes will be written."))

        for pin in pins:
            target_sf_username = f"9{pin}000"

            # Locate Sub-Franchise for pin
            sf = _find_sf_for_pin(pin)
            if not sf:
                raise CommandError(
                    f"No Sub-Franchise found for pin={pin}. Create/assign a Sub-Franchise first."
                )

            # Sub-Franchise rename
            sf_action = _safe_rename_username(sf, target_sf_username, dry_run)
            # Update SF phone to match username
            if not dry_run:
                if sf.phone != sf.username:
                    sf.phone = sf.username
                    sf.save(update_fields=["phone"])
            # Ensure pincode assignment exists
            _ensure_sf_pin_assignment(sf, pin, dry_run)

            self.stdout.write(
                f"SF: {sf.username if sf_action != 'renamed' else target_sf_username} [{sf_action}] for pin={pin}"
            )

            # Employees under this SF and pin
            emp_qs = CustomUser.objects.filter(
                category="employee",
                pincode=str(pin),
            ).filter(
                Q(registered_by=sf) | Q(sponsor_id=sf.username)
            ).order_by("id")

            # Rename up to employees_cap
            idx = 1
            for emp in emp_qs[:employees_cap]:
                new_uname = f"9{pin}{idx:03d}"
                action = _safe_rename_username(emp, new_uname, dry_run)
                if not dry_run:
                    updates = []
                    if emp.phone != emp.username:
                        emp.phone = emp.username
                        updates.append("phone")
                    # Ensure sponsorship links point to SF (post-rename)
                    if emp.registered_by_id != sf.id:
                        emp.registered_by = sf
                        updates.append("registered_by")
                    if emp.sponsor_id != sf.username:
                        emp.sponsor_id = sf.username
                        updates.append("sponsor_id")
                    if updates:
                        emp.save(update_fields=list(set(updates)))
                self.stdout.write(f"  EMP: {emp.username if action!='renamed' else new_uname} [{action}]")
                idx += 1

            # Consumers under this SF and pin
            con_qs = CustomUser.objects.filter(
                category="consumer",
                pincode=str(pin),
            ).filter(
                Q(registered_by=sf) | Q(sponsor_id=sf.username)
            ).order_by("id")

            base = 100
            j = 0
            for con in con_qs[:consumers_cap]:
                new_uname = f"9{pin}{base + j:03d}"
                action = _safe_rename_username(con, new_uname, dry_run)
                if not dry_run:
                    updates = []
                    if con.phone != con.username:
                        con.phone = con.username
                        updates.append("phone")
                    if con.registered_by_id != sf.id:
                        con.registered_by = sf
                        updates.append("registered_by")
                    if con.sponsor_id != sf.username:
                        con.sponsor_id = sf.username
                        updates.append("sponsor_id")
                    if updates:
                        con.save(update_fields=list(set(updates)))
                self.stdout.write(f"  CON: {con.username if action!='renamed' else new_uname} [{action}]")
                j += 1

        if dry_run:
            raise CommandError("Dry-run complete (no data written).")
