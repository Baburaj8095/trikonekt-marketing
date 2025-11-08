import sys
from typing import List, Optional

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.text import slugify

from accounts.models import CustomUser, AgencyRegionAssignment
from locations.models import Country, State, City


def _norm_csv(val: Optional[str]) -> List[str]:
    if not val:
        return []
    parts = [x.strip() for x in val.split(",")]
    return [p for p in parts if p]


def _safe_slug(val: str) -> str:
    s = slugify(val or "", allow_unicode=False)
    return s.replace("-", "")


def _ensure_country_india() -> Country:
    india = Country.objects.filter(name__iexact="india").first()
    if not india:
        existing = Country.objects.filter(id=101).first()
        if existing:
            india = existing
        else:
            india = Country.objects.create(id=101, name="India", iso2="IN")
    return india


def _ensure_state(country: Country, name: str) -> State:
    st = State.objects.filter(country=country, name__iexact=name).first()
    if not st:
        st = State.objects.create(country=country, name=name)
    return st


def _ensure_city(state: State, name: str) -> City:
    c = City.objects.filter(state=state, name__iexact=name).first()
    if not c:
        c = City.objects.filter(state=state, name__icontains=name).first()
    if not c:
        c = City.objects.create(state=state, name=name)
    return c


def _resolve_state(country: Country, state_name: str) -> State:
    st = State.objects.filter(country=country, name__iexact=state_name).first()
    if not st:
        st = State.objects.filter(country=country, name__icontains=state_name).first()
    if not st:
        raise CommandError(f"State '{state_name}' not found and auto-create disabled in resolver.")
    return st


def _ensure_user(
    *,
    username: str,
    category: str,
    role: str,
    password: str,
    sponsor_user: Optional[CustomUser] = None,
    email: Optional[str] = None,
    full_name: Optional[str] = None,
    phone: Optional[str] = None,
    country: Optional[Country] = None,
    state: Optional[State] = None,
    city: Optional[City] = None,
    pincode: Optional[str] = None,
    is_staff: Optional[bool] = None,
    is_superuser: Optional[bool] = None,
) -> CustomUser:
    defaults = {
        "email": email or f"{username}@example.com",
        "full_name": full_name or username.replace("_", " ").title(),
        "phone": phone or "9999999999",
        "category": category,
        "role": role,
        "is_active": True,
    }
    if is_staff is not None:
        defaults["is_staff"] = bool(is_staff)
    if is_superuser is not None:
        defaults["is_superuser"] = bool(is_superuser)

    u, created = CustomUser.objects.get_or_create(username=username, defaults=defaults)

    changed = False
    # keep core flags in sync
    if u.category != category:
        u.category = category
        changed = True
    if u.role != role:
        u.role = role
        changed = True
    if is_staff is not None and bool(u.is_staff) != bool(is_staff):
        u.is_staff = bool(is_staff)
        changed = True
    if is_superuser is not None and bool(u.is_superuser) != bool(is_superuser):
        u.is_superuser = bool(is_superuser)
        changed = True

    # sponsor chain
    if sponsor_user:
        sponsor_code = getattr(sponsor_user, "prefixed_id", None) or sponsor_user.username
        if u.sponsor_id != sponsor_code:
            u.sponsor_id = sponsor_code
            changed = True
        if u.registered_by_id != sponsor_user.id:
            u.registered_by = sponsor_user
            changed = True

    # profile/location
    if email and u.email != email:
        u.email = email
        changed = True
    if full_name and u.full_name != full_name:
        u.full_name = full_name
        changed = True
    if phone and u.phone != phone:
        u.phone = phone
        changed = True
    if country and (u.country_id != getattr(country, "id", None)):
        u.country = country
        changed = True
    if state and (u.state_id != getattr(state, "id", None)):
        u.state = state
        changed = True
    if city and (u.city_id != getattr(city, "id", None)):
        u.city = city
        changed = True
    if pincode is not None and str(u.pincode or "") != str(pincode):
        u.pincode = str(pincode)
        changed = True

    # deterministic password for (re)seeding
    u.set_password(password)
    changed = True

    if changed:
        u.save()
    return u


def _assign_pincode(user: CustomUser, state: Optional[State], pin: str):
    AgencyRegionAssignment.objects.get_or_create(
        user=user,
        level="pincode",
        pincode=str(pin),
        defaults=dict(state=state, district=""),
    )


def _find_pincode_user(pin: str) -> CustomUser:
    """
    Find the agency_pincode user who owns the given pincode via AgencyRegionAssignment.
    Fallback to conventional username TRP_{pin}.
    """
    u = (
        CustomUser.objects.filter(
            category="agency_pincode",
            region_assignments__level="pincode",
            region_assignments__pincode=str(pin),
        )
        .order_by("id")
        .first()
    )
    if u:
        return u
    alt = CustomUser.objects.filter(username=f"TRP_{pin}", category="agency_pincode").first()
    if alt:
        return alt
    raise CommandError(f"No agency_pincode user found for pincode {pin}. Seed pincode user first.")


class Command(BaseCommand):
    help = "Seed Sub-Franchises for given pincodes and create employees/consumers under each."

    def add_arguments(self, parser):
        parser.add_argument("--state_name", type=str, default="Karnataka", help="State name (e.g., Karnataka)")
        parser.add_argument("--district_name", type=str, default="Kalaburagi", help="District/City name (e.g., Kalaburagi)")
        parser.add_argument("--pincodes", type=str, default="585102,585103,585104", help="CSV of pincodes for which to create Sub-Franchises")
        parser.add_argument("--employees", type=int, default=5, help="Number of employees per Sub-Franchise")
        parser.add_argument("--consumers", type=int, default=10, help="Number of consumers per Sub-Franchise")
        parser.add_argument("--root_sponsor", type=str, default="admin", help="Sponsor username under which Sub-Franchises will be created")
        parser.add_argument("--password", type=str, default="Test@123", help="Password to set for all created users")
        parser.add_argument("--dry_run", action="store_true", help="Show plan without writing data")

    @transaction.atomic
    def handle(self, *args, **options):
        state_name = options.get("state_name") or "Karnataka"
        district_name = options.get("district_name") or "Kalaburagi"
        pins_csv = options.get("pincodes") or ""
        employees_per = int(options.get("employees") or 5)
        consumers_per = int(options.get("consumers") or 10)
        root_sponsor_username = options.get("root_sponsor") or "admin"
        password = options.get("password") or "Test@123"
        dry_run = bool(options.get("dry_run"))

        pins = [p for p in _norm_csv(pins_csv) if p.isdigit()]
        if not pins:
            raise CommandError("Provide at least one numeric pincode via --pincodes.")

        root = CustomUser.objects.filter(username=root_sponsor_username).first()
        if not root:
            raise CommandError(f"Root sponsor '{root_sponsor_username}' not found.")

        india = _ensure_country_india()
        # resolve or ensure state/city
        try:
            state = _resolve_state(india, state_name)
        except CommandError:
            state = _ensure_state(india, state_name)

        city = _ensure_city(state, district_name)

        self.stdout.write(self.style.NOTICE(
            f"Seeding Sub-Franchises in State='{state.name}', District='{city.name}', Pincodes={pins}, "
            f"employees_per={employees_per}, consumers_per={consumers_per}, sponsor='{root.username}'"
        ))
        if dry_run:
            self.stdout.write(self.style.WARNING("[DRY RUN] No changes will be written."))

        summary = []

        for pin in pins:
            sf_username = f"9{pin}000"
            # Determine sponsor as the pincode-level agency user for this pin
            sponsor_u = None
            sponsor_name = ""
            try:
                sponsor_u = _find_pincode_user(pin)
                sponsor_name = sponsor_u.username
            except CommandError:
                sponsor_name = f"TRP_{pin}"
            if dry_run:
                summary.append({"username": sf_username, "category": "agency_sub_franchise", "sponsor": sponsor_name, "pin": pin, "children": []})
                for i in range(1, employees_per + 1):
                    summary[-1]["children"].append({"username": f"9{pin}{i:03d}", "category": "employee"})
                for j in range(1, consumers_per + 1):
                    summary[-1]["children"].append({"username": f"9{pin}{100 + j - 1:03d}", "category": "consumer"})
                continue

            # Ensure Sub-Franchise
            if sponsor_u is None:
                raise CommandError(f"No agency_pincode sponsor found for pin {pin}. Seed pincode user (e.g., TRP_{pin}) first.")
            sf_user = _ensure_user(
                username=sf_username,
                category="agency_sub_franchise",
                role="agency",
                password=password,
                sponsor_user=sponsor_u,
                email=f"{sf_username}@example.com",
                full_name=f"Sub Franchise {pin}",
                phone=sf_username,
                country=india,
                state=state,
                city=city,
                pincode=pin,
            )
            _assign_pincode(sf_user, state, pin)

            # Employees
            children = []
            for i in range(1, employees_per + 1):
                emp_username = f"9{pin}{i:03d}"
                emp = _ensure_user(
                    username=emp_username,
                    category="employee",
                    role="employee",
                    password=password,
                    sponsor_user=sf_user,
                    email=f"{emp_username}@example.com",
                    full_name=f"Employee {pin}-{i:02d}",
                    phone=emp_username,
                    country=india,
                    state=state,
                    city=city,
                    pincode=pin,
                )
                children.append(emp.username)

            # Consumers
            for j in range(1, consumers_per + 1):
                cust_username = f"9{pin}{100 + j - 1:03d}"
                cust = _ensure_user(
                    username=cust_username,
                    category="consumer",
                    role="user",
                    password=password,
                    sponsor_user=sf_user,
                    email=f"{cust_username}@example.com",
                    full_name=f"Consumer {pin}-{j:02d}",
                    phone=cust_username,
                    country=india,
                    state=state,
                    city=city,
                    pincode=pin,
                )
                children.append(cust.username)

            summary.append({
                "username": sf_user.username,
                "category": sf_user.category,
                "sponsor": sponsor_name,
                "pin": pin,
                "children": children,
            })

        # Output summary
        self.stdout.write(self.style.SUCCESS("Seed plan/result:"))
        for row in summary:
            self.stdout.write(
                f" - {row['username']:>18} | agency_sub_franchise | pin={row['pin']} | sponsor={row['sponsor']}"
            )
            for ch in row.get("children", []):
                self.stdout.write(f"     -> {ch}")

        if dry_run:
            raise CommandError("Dry-run complete (no data written).")
