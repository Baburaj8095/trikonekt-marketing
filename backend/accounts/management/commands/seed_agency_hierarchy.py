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


def _pick_cap(items: List[str], cap: int) -> List[str]:
    if len(items) > cap:
        return items[:cap]
    return items


def _safe_slug(val: str) -> str:
    # slugify but keep alphanumerics only for username part
    s = slugify(val or "", allow_unicode=False)
    return s.replace("-", "")


def _get_country_india() -> Optional[Country]:
    # Prefer India by name; do not assume id=101 in case data differs.
    try:
        return Country.objects.filter(name__iexact="india").first()
    except Exception:
        return None

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
        c = City.objects.create(state=state, name=name)
    return c

def _resolve_or_create_state(state_id: Optional[int], state_name: Optional[str], country: Optional[Country]) -> State:
    try:
        return _resolve_state(state_id, state_name, country)
    except CommandError:
        if country and state_name:
            return _ensure_state(country, state_name)
        raise


def _resolve_state(state_id: Optional[int], state_name: Optional[str], country: Optional[Country]) -> State:
    qs = State.objects.all()
    if country:
        qs = qs.filter(country=country)
    if state_id:
        st = qs.filter(id=state_id).first()
        if not st:
            raise CommandError(f"State with id={state_id} not found (country scope: {country.name if country else 'ANY'}).")
        return st
    if state_name:
        st = qs.filter(name__iexact=state_name).first()
        if not st:
            # try case-insensitive contains
            st = qs.filter(name__icontains=state_name).first()
        if not st:
            raise CommandError(f"State named '{state_name}' not found (country scope: {country.name if country else 'ANY'}).")
        return st
    raise CommandError("Provide either --state_id or --state_name.")


def _resolve_districts(state: State, district_names: List[str]) -> List[str]:
    if not district_names:
        return []
    resolved = []
    for dn in district_names:
        c = City.objects.filter(state=state, name__iexact=dn).first()
        if not c:
            # try contains
            c = City.objects.filter(state=state, name__icontains=dn).first()
        if not c:
            print(f"[WARN] District '{dn}' not found under state '{state.name}'. Skipping.", file=sys.stderr)
            continue
        resolved.append(c.name)
    # de-dup while preserving order
    seen = set()
    uniq = []
    for d in resolved:
        if d.lower() in seen:
            continue
        seen.add(d.lower())
        uniq.append(d)
    return uniq


def _ensure_user(username: str,
                 category: str,
                 sponsor_user: CustomUser,
                 password: str,
                 email: Optional[str] = None,
                 full_name: Optional[str] = None,
                 phone: Optional[str] = None,
                 country: Optional[Country] = None,
                 state: Optional[State] = None,
                 city: Optional[City] = None,
                 pincode: Optional[str] = None) -> CustomUser:
    defaults = {
        "email": email or f"{username}@example.com",
        "full_name": full_name or username.replace("_", " ").title(),
        "phone": phone or "9999999999",
        "category": category,
        "role": "agency",
        "is_active": True,
    }
    u, created = CustomUser.objects.get_or_create(username=username, defaults=defaults)
    # update mutable fields on re-run
    changed = False
    if u.category != category:
        u.category = category
        changed = True
    if u.role != "agency":
        u.role = "agency"
        changed = True
    # set sponsor chain (use prefixed_id if available)
    sponsor_code = None
    if sponsor_user:
        sponsor_code = getattr(sponsor_user, "prefixed_id", None) or sponsor_user.username
    if sponsor_code and u.sponsor_id != sponsor_code:
        u.sponsor_id = sponsor_code
        changed = True
    if sponsor_user and u.registered_by_id != sponsor_user.id:
        u.registered_by = sponsor_user
        changed = True
    # keep email/phone/full_name refreshed (safe defaults)
    if email and u.email != email:
        u.email = email
        changed = True
    if full_name and u.full_name != full_name:
        u.full_name = full_name
        changed = True
    if phone and u.phone != phone:
        u.phone = phone
        changed = True
    # assign location fields if provided
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
    # set password every run to be deterministic/demo-friendly
    u.set_password(password)
    changed = True
    if changed:
        u.save()
    return u


def _assign_state(user: CustomUser, state: State):
    AgencyRegionAssignment.objects.get_or_create(
        user=user,
        level="state",
        state=state,
        defaults=dict(district="", pincode="")
    )


def _assign_district(user: CustomUser, state: State, district_name: str):
    # UniqueConstraint is on user+state+district for level=district
    AgencyRegionAssignment.objects.get_or_create(
        user=user,
        level="district",
        state=state,
        district=district_name,
        defaults=dict(pincode="")
    )


def _assign_pincode(user: CustomUser, state: Optional[State], pin: str):
    # UniqueConstraint is on user+pincode for level=pincode; state is optional context
    AgencyRegionAssignment.objects.get_or_create(
        user=user,
        level="pincode",
        pincode=str(pin),
        defaults=dict(state=state, district="")
    )


class Command(BaseCommand):
    help = "Seed a full agency hierarchy for a given State/Districts/Pincodes with sponsor chain."

    def add_arguments(self, parser):
        parser.add_argument("--state_id", type=int, help="State ID (preferred if known)")
        parser.add_argument("--state_name", type=str, help="State name (case-insensitive)")
        parser.add_argument("--districts", type=str, default="Kalaburgi,Vijayapura", help="CSV of 1-2 district names under the state")
        parser.add_argument("--pincodes", type=str, default="585101,585102,585103,585104", help="CSV of up to 4 pincodes")
        parser.add_argument("--password", type=str, default="Test@123", help="Password for all created users")
        parser.add_argument("--root_sponsor", type=str, default="admin", help="Root sponsor username (must exist)")
        parser.add_argument("--dry_run", action="store_true", help="Show what will be created without writing")

    @transaction.atomic
    def handle(self, *args, **options):
        state_id = options.get("state_id")
        state_name = options.get("state_name") or "Karnataka"
        district_csv = options.get("districts") or ""
        pin_csv = options.get("pincodes") or ""
        password = options.get("password") or "Test@123"
        root_sponsor_username = options.get("root_sponsor") or "admin"
        dry_run = bool(options.get("dry_run"))

        # Validate root sponsor
        root = CustomUser.objects.filter(username=root_sponsor_username).first()
        if not root:
            raise CommandError(f"Root sponsor user '{root_sponsor_username}' not found. Create it first (createsuperuser or shell).")

        india = _ensure_country_india()
        state = _resolve_or_create_state(state_id, state_name, india)
        districts_requested = _norm_csv(district_csv)
        districts_resolved = _resolve_districts(state, districts_requested)
        districts_resolved = _pick_cap(districts_resolved, 2)

        pincodes = _norm_csv(pin_csv)
        pincodes = [p for p in pincodes if p.isdigit()]
        pincodes = _pick_cap(pincodes, 4)

        if not districts_resolved:
            raise CommandError("No valid districts resolved. Provide at least one valid district under the given state.")
        if not pincodes:
            raise CommandError("Provide at least one numeric pincode (up to 4).")

        self.stdout.write(self.style.NOTICE(f"Seeding hierarchy under State='{state.name}', Districts={districts_resolved}, Pincodes={pincodes}, root_sponsor='{root.username}'"))
        if dry_run:
            self.stdout.write(self.style.WARNING("[DRY RUN] No changes will be written."))

        # Derive names for usernames
        st_slug = _safe_slug(state.name) or f"state{state.id}"
        d1 = districts_resolved[0]
        d1_slug = _safe_slug(d1)
        # Resolve City object for first district (used for user.city)
        d1_city = City.objects.filter(state=state, name__iexact=d1).first()
        if not d1_city:
            d1_city = City.objects.filter(state=state, name__icontains=d1).first()
        if not d1_city and d1:
            d1_city = _ensure_city(state, d1)

        # Planned usernames (deterministic)
        uname_sc = f"TRSC_{st_slug}"
        uname_state = f"TRS_{st_slug}"
        uname_dc = f"TRDC_{d1_slug}"
        uname_district = f"TRD_{d1_slug}"
        uname_pc = f"TRPC_{d1_slug}"
        uname_p = f"TRP_{pincodes[0]}"
        uname_sf = f"TRSF_{pincodes[0]}"

        created_users = []

        def add_summary(u: CustomUser, cat: str, assigns: List[str], sponsor: str):
            created_users.append({
                "username": u.username,
                "category": cat,
                "sponsor": sponsor,
                "assignments": assigns,
            })

        if dry_run:
            # Just show the plan
            created_users.extend([
                {"username": uname_sc, "category": "agency_state_coordinator", "sponsor": root.username, "assignments": [f"state:{state.name}"]},
                {"username": uname_state, "category": "agency_state", "sponsor": uname_sc, "assignments": [f"state:{state.name}"]},
                {"username": uname_dc, "category": "agency_district_coordinator", "sponsor": uname_state, "assignments": [f"district:{d}" for d in districts_resolved]},
                {"username": uname_district, "category": "agency_district", "sponsor": uname_dc, "assignments": [f"district:{d1}"]},
                {"username": uname_pc, "category": "agency_pincode_coordinator", "sponsor": uname_district, "assignments": [f"pincode:{p}" for p in pincodes]},
                {"username": uname_p, "category": "agency_pincode", "sponsor": uname_pc, "assignments": [f"pincode:{pincodes[0]}"]},
                {"username": uname_sf, "category": "agency_sub_franchise", "sponsor": uname_p, "assignments": [f"pincode:{pincodes[0]}"]},
            ])
        else:
            # Create hierarchy and assignments
            # 1) State Coordinator
            sc = _ensure_user(
                username=uname_sc,
                category="agency_state_coordinator",
                sponsor_user=root,
                password=password,
                email=f"{uname_sc}@example.com",
                full_name="State Coordinator",
                phone="9999990001",
                country=india,
                state=state,
                city=d1_city,
                pincode=pincodes[0],
            )
            _assign_state(sc, state)
            add_summary(sc, sc.category, [f"state:{state.name}"], root.username)

            # 2) State
            st_user = _ensure_user(
                username=uname_state,
                category="agency_state",
                sponsor_user=sc,
                password=password,
                email=f"{uname_state}@example.com",
                full_name="Agency State",
                phone="9999990002",
                country=india,
                state=state,
                city=d1_city,
                pincode=pincodes[0],
            )
            _assign_state(st_user, state)
            add_summary(st_user, st_user.category, [f"state:{state.name}"], sc.username)

            # 3) District Coordinator (max 2 districts)
            dc = _ensure_user(
                username=uname_dc,
                category="agency_district_coordinator",
                sponsor_user=st_user,
                password=password,
                email=f"{uname_dc}@example.com",
                full_name="District Coordinator",
                phone="9999990003",
                country=india,
                state=state,
                city=d1_city,
                pincode=pincodes[0],
            )
            for d in districts_resolved:
                _assign_district(dc, state, d)
            add_summary(dc, dc.category, [f"district:{d}" for d in districts_resolved], st_user.username)

            # 4) District (pick first district)
            ad = _ensure_user(
                username=uname_district,
                category="agency_district",
                sponsor_user=dc,
                password=password,
                email=f"{uname_district}@example.com",
                full_name="Agency District",
                phone="9999990004",
                country=india,
                state=state,
                city=d1_city,
                pincode=pincodes[0],
            )
            _assign_district(ad, state, d1)
            add_summary(ad, ad.category, [f"district:{d1}"], dc.username)

            # 5) Pincode Coordinator (up to 4 pins)
            pc = _ensure_user(
                username=uname_pc,
                category="agency_pincode_coordinator",
                sponsor_user=ad,
                password=password,
                email=f"{uname_pc}@example.com",
                full_name="Pincode Coordinator",
                phone="9999990005",
                country=india,
                state=state,
                city=d1_city,
                pincode=pincodes[0],
            )
            for p in pincodes:
                _assign_pincode(pc, state, p)
            add_summary(pc, pc.category, [f"pincode:{p}" for p in pincodes], ad.username)

            # 6) Pincode (first pin)
            p_user = _ensure_user(
                username=uname_p,
                category="agency_pincode",
                sponsor_user=pc,
                password=password,
                email=f"{uname_p}@example.com",
                full_name="Agency Pincode",
                phone="9999990006",
                country=india,
                state=state,
                city=d1_city,
                pincode=pincodes[0],
            )
            _assign_pincode(p_user, state, pincodes[0])
            add_summary(p_user, p_user.category, [f"pincode:{pincodes[0]}"], pc.username)

            # 7) Sub-Franchise (first pin)
            sf_user = _ensure_user(
                username=uname_sf,
                category="agency_sub_franchise",
                sponsor_user=p_user,
                password=password,
                email=f"{uname_sf}@example.com",
                full_name="Sub Franchise",
                phone="9999990007",
                country=india,
                state=state,
                city=d1_city,
                pincode=pincodes[0],
            )
            _assign_pincode(sf_user, state, pincodes[0])
            add_summary(sf_user, sf_user.category, [f"pincode:{pincodes[0]}"], p_user.username)

        # Output summary
        self.stdout.write(self.style.SUCCESS("Seed plan/result:"))
        for row in created_users:
            self.stdout.write(
                f" - {row['username']:>18} | {row['category']:>28} | sponsor={row['sponsor']:>8} | {', '.join(row['assignments'])}"
            )

        if dry_run:
            raise CommandError("Dry-run complete (no data written).")
