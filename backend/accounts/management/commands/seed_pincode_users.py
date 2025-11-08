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


def _assign_pincode(user: CustomUser, state: Optional[State], pin: str):
    AgencyRegionAssignment.objects.get_or_create(
        user=user,
        level="pincode",
        pincode=str(pin),
        defaults=dict(state=state, district=""),
    )


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
) -> CustomUser:
    defaults = {
        "email": email or f"{username}@example.com",
        "full_name": full_name or username.replace("_", " ").title(),
        "phone": phone or "9999999999",
        "category": category,
        "role": role,
        "is_active": True,
    }
    u, created = CustomUser.objects.get_or_create(username=username, defaults=defaults)

    changed = False
    if u.category != category:
        u.category = category
        changed = True
    if u.role != role:
        u.role = role
        changed = True

    if sponsor_user:
        sponsor_code = getattr(sponsor_user, "prefixed_id", None) or sponsor_user.username
        if u.sponsor_id != sponsor_code:
            u.sponsor_id = sponsor_code
            changed = True
        if u.registered_by_id != sponsor_user.id:
            u.registered_by = sponsor_user
            changed = True

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

    u.set_password(password)
    changed = True

    if changed:
        u.save()
    return u


def _find_pc_for_pin(pin: str, district_name: Optional[str] = None) -> CustomUser:
    # First, find any PC that has assignment for this pin
    pc = (
        CustomUser.objects.filter(
            category="agency_pincode_coordinator",
            region_assignments__level="pincode",
            region_assignments__pincode=str(pin),
        )
        .order_by("id")
        .first()
    )
    if pc:
        return pc
    # Fallback by conventional username TRPC_{district_slug}
    if district_name:
        slug = _safe_slug(district_name)
        fallback = CustomUser.objects.filter(username=f"TRPC_{slug}", category="agency_pincode_coordinator").first()
        if fallback:
            return fallback
    raise CommandError(f"No pincode coordinator found for pin={pin}. Ensure the PC exists and has pincode assignment.")


class Command(BaseCommand):
    help = "Create agency_pincode users for given pincodes, sponsored by the Pincode Coordinator. Also assigns pincode to each created user."

    def add_arguments(self, parser):
        parser.add_argument("--state_name", type=str, default="Karnataka", help="State name (e.g., Karnataka)")
        parser.add_argument("--district_name", type=str, default="Kalaburagi", help="District/City name (e.g., Kalaburagi)")
        parser.add_argument("--pincodes", type=str, required=True, help="CSV of pincodes to create pincode users for")
        parser.add_argument("--password", type=str, default="Test@123", help="Password to set for created users")
        parser.add_argument("--dry_run", action="store_true", help="Show plan without writing data")

    @transaction.atomic
    def handle(self, *args, **options):
        state_name = options.get("state_name") or "Karnataka"
        district_name = options.get("district_name") or "Kalaburagi"
        pins_csv = options.get("pincodes")
        password = options.get("password") or "Test@123"
        dry_run = bool(options.get("dry_run"))

        pins = [p for p in _norm_csv(pins_csv or "") if p.isdigit()]
        if not pins:
            raise CommandError("Provide at least one numeric pincode via --pincodes.")

        india = _ensure_country_india()
        try:
            state = _resolve_state(india, state_name)
        except CommandError:
            state = _ensure_state(india, state_name)
        city = _ensure_city(state, district_name)

        self.stdout.write(self.style.NOTICE(
            f"Creating pincode users for pins={pins} in State='{state.name}', District='{city.name}'"
        ))
        if dry_run:
            self.stdout.write(self.style.WARNING("[DRY RUN] No changes will be written."))

        summary = []

        for pin in pins:
            pc = _find_pc_for_pin(pin, district_name=district_name)
            pc_name = pc.username if pc else "(none)"

            uname = f"TRP_{pin}"
            if dry_run:
                summary.append({"username": uname, "pin": pin, "sponsor": pc_name})
                continue

            p_user = _ensure_user(
                username=uname,
                category="agency_pincode",
                role="agency",
                password=password,
                sponsor_user=pc,
                email=f"{uname}@example.com",
                full_name=f"Agency Pincode {pin}",
                phone=f"99999{pin[-5:]}",
                country=india,
                state=state,
                city=city,
                pincode=pin,
            )
            _assign_pincode(p_user, state, pin)

            summary.append({"username": p_user.username, "pin": pin, "sponsor": pc_name})

        self.stdout.write(self.style.SUCCESS("Result:"))
        for row in summary:
            self.stdout.write(
                f" - {row['username']:>14} | pin={row['pin']} | sponsor={row['sponsor']}"
            )

        if dry_run:
            raise CommandError("Dry-run complete (no data written).")
