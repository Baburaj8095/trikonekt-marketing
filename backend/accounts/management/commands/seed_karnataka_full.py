import sys
from typing import List, Optional, Dict, Set, Tuple

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.text import slugify

from accounts.models import CustomUser, AgencyRegionAssignment, PrefixSequence, create_wallet_for_new_user, handle_new_user_post_save
from locations.models import Country, State, City
from django.db.models.signals import post_save

# Reuse offline pincode index utilities
from locations.views import _build_district_index, india_place_variants

# Preview sequencing state (for --preview_numbers)
PREVIEW_ENABLED = False
PREVIEW_NEXT: Dict[str, int] = {}


# ------------------------
# Helpers: geo ensure/resolve
# ------------------------
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


# ------------------------
# Helpers: assignments
# ------------------------
def _assign_state(user: CustomUser, state: State):
    AgencyRegionAssignment.objects.get_or_create(
        user=user,
        level="state",
        state=state,
        defaults=dict(district="", pincode="")
    )


def _assign_district(user: CustomUser, state: State, district_name: str):
    AgencyRegionAssignment.objects.get_or_create(
        user=user,
        level="district",
        state=state,
        district=district_name,
        defaults=dict(pincode="")
    )


def _assign_pincode(user: CustomUser, state: Optional[State], pin: str):
    AgencyRegionAssignment.objects.get_or_create(
        user=user,
        level="pincode",
        pincode=str(pin),
        defaults=dict(state=state, district="")
    )


# ------------------------
# Helpers: sponsor chain and users
# ------------------------
def _alloc_username_and_prefixed(category: str) -> Tuple[str, str, str]:
    """
    Allocate once from PrefixSequence and build:
      - username: PREFIX + 10-digit sequence (no hyphen)
      - prefixed_id: PREFIX-10-digit sequence (with hyphen)
      - prefix: PREFIX
    """
    prefix = CustomUser.category_to_prefix(category)
    next_num = PrefixSequence.allocate_next(prefix)
    num = f"{next_num:010d}"
    return f"{prefix}{num}", f"{prefix}-{num}", prefix


def _preview_username(category: str) -> str:
    """
    For dry-run, do not consume sequence. Show a preview shape.
    """
    return f"{CustomUser.category_to_prefix(category)}??????????"


def _preview_numbered_username(category: str) -> str:
    """
    Show the next sequential username (without consuming the sequence).
    Uses in-memory counters per prefix so numbers increase 1,2,3... during the same dry-run.
    If no PrefixSequence row exists, preview starts at ...0000000001.
    """
    prefix = CustomUser.category_to_prefix(category)
    # Initialize from DB only once per prefix, then increment in-memory for subsequent calls
    try:
        n = PREVIEW_NEXT.get(prefix)
    except Exception:
        n = None
    if n is None:
        try:
            p = PrefixSequence.objects.filter(prefix=prefix).first()
            last = int(getattr(p, "last_number", 0) or 0)
        except Exception:
            last = 0
        n = last + 1
    # Store next value for subsequent calls
    try:
        PREVIEW_NEXT[prefix] = n + 1
    except Exception:
        pass
    return f"{prefix}{n:010d}"


def _preview_for(category: str, numbered: bool) -> str:
    """
    Helper to pick placeholder preview or numbered preview based on flag.
    """
    return _preview_numbered_username(category) if numbered else _preview_username(category)


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
    prefixed_id_value: Optional[str] = None,
    prefix_code_value: Optional[str] = None,
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
    if prefixed_id_value:
        defaults["prefixed_id"] = prefixed_id_value
    if prefix_code_value:
        defaults["prefix_code"] = prefix_code_value

    u, created = CustomUser.objects.get_or_create(username=username, defaults=defaults)

    changed = False
    # sync flags and core profile on re-run
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

    if sponsor_user:
        sponsor_code = getattr(sponsor_user, "prefixed_id", None) or sponsor_user.username
        if u.sponsor_id != sponsor_code:
            u.sponsor_id = sponsor_code
            changed = True
        if u.registered_by_id != sponsor_user.id:
            u.registered_by = sponsor_user
            changed = True

    # Ensure prefixed fields if we created without defaults (or legacy user)
    if prefixed_id_value and not getattr(u, "prefixed_id", None):
        u.prefixed_id = prefixed_id_value
        changed = True
    if prefix_code_value and (getattr(u, "prefix_code", "") or "") != prefix_code_value:
        u.prefix_code = prefix_code_value
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

    # deterministic password for (re)seeding
    u.set_password(password)
    changed = True

    if changed:
        u.save()
    return u


# ------------------------
# Pincode selection for a district
# ------------------------
def _pick_pincodes_for_district(district_name: str, state_name: str, max_count: int = 4) -> List[str]:
    """
    Use offline index to find pincodes for a district within a state; return <=4 sorted codes.
    Includes synonym variants and fuzzy fallbacks (e.g., Bangalore/Bengaluru/Bengaluru Urban).
    """
    idx = _build_district_index() or {}
    pins: Set[str] = set()
    skey = (state_name or "").strip().lower()
    variants = india_place_variants(district_name) or [district_name]

    # 1) Direct and synonym lookups (state-qualified and global)
    for d in variants:
        dkey = (d or "").strip().lower()
        pins.update(idx.get((skey, dkey), set()))
        pins.update(idx.get(("", dkey), set()))
    if pins:
        return sorted(pins)[:max_count]

    # 2) Special-case Bengaluru (Urban/Rural) when asked as Bangalore/Bengaluru
    try:
        vset = {(v or "").strip().lower() for v in variants}
        if any("bangalore" in v or "bengaluru" in v for v in vset):
            for dkey in ("bengaluru urban", "bengaluru", "bengaluru rural"):
                pins.update(idx.get((skey, dkey), set()))
                pins.update(idx.get(("", dkey), set()))
            if pins:
                return sorted(pins)[:max_count]
    except Exception:
        pass

    # 3) Fuzzy match against available district keys in index
    try:
        import difflib
        # Collect all available district keys filtered by state (and also global)
        dkeys = set(d for s, d in idx.keys() if (not skey or s == skey or s == ""))
        # Try fuzzy against each variant
        for v in variants:
            vkey = (v or "").strip().lower()
            close = difflib.get_close_matches(vkey, list(dkeys), n=5, cutoff=0.75)
            for ck in close:
                pins.update(idx.get((skey, ck), set()))
                pins.update(idx.get(("", ck), set()))
            if pins:
                return sorted(pins)[:max_count]
    except Exception:
        pass

    # 4) Give up with empty (caller will decide whether to error)
    return []


# ------------------------
# Command
# ------------------------
class Command(BaseCommand):
    help = "Seed full Karnataka hierarchy: Company -> TRCM -> TRSC -> TRST -> TRDC -> TRDT -> TRPC -> TRPN -> (4x TRSF) -> (5x TREMP per TRSF) -> (10x TRC per TREMP) across 4 districts with 4 pincodes each. Usernames are sequential per prefix."

    def add_arguments(self, parser):
        parser.add_argument("--password", type=str, default="Test@123", help="Password to set for all created users")
        parser.add_argument("--company_root_username", type=str, default="company_root", help="If this user exists, use as root; else a sequential 'TR##########' company will be created")
        parser.add_argument("--state_name", type=str, default="Karnataka", help="State name")
        parser.add_argument("--districts", type=str, default="Kalaburagi,Mysore,Belagavi,Bangalore", help="CSV districts")
        parser.add_argument("--dry_run", action="store_true", help="Show plan without writing any data")
        parser.add_argument("--preview_numbers", action="store_true", help="In --dry_run, show next sequential usernames without consuming counters")
        parser.add_argument("--print_limit", type=int, default=0, help="Limit rows printed in the plan (0 = no limit)")
        parser.add_argument("--summary_only", action="store_true", help="Print only counts summary without listing all rows")
        parser.add_argument("--apply", action="store_true", help="Actually create users; default is dry-run")
        parser.add_argument("--no_side_effects", action="store_true", help="Disable post_save side effects (wallet/referral/franchise) during seeding")
        parser.add_argument("--employees_total", type=int, default=0, help="Cap total number of employees to create (0 = default layout)")
        parser.add_argument("--consumers_total", type=int, default=0, help="Cap total number of consumers to create (0 = default layout)")

    @transaction.atomic
    def handle(self, *args, **options):
        password = options.get("password") or "Test@123"
        state_name = options.get("state_name") or "Karnataka"
        districts_csv = options.get("districts") or "Kalaburagi,Mysore,Belagavi,Bangalore"
        apply = bool(options.get("apply"))
        no_side_effects = bool(options.get("no_side_effects"))
        dry_run = bool(options.get("dry_run")) or (not apply)
        preview_numbers = bool(options.get("preview_numbers"))
        print_limit = int(options.get("print_limit") or 0)
        summary_only = bool(options.get("summary_only"))
        employees_total = int(options.get("employees_total") or 0)
        consumers_total = int(options.get("consumers_total") or 0)
        if preview_numbers and not dry_run:
            self.stdout.write(self.style.WARNING("--preview_numbers implies --dry_run; proceeding in dry-run mode"))
            dry_run = True
        # Initialize preview sequencing state
        global PREVIEW_ENABLED, PREVIEW_NEXT
        PREVIEW_ENABLED = preview_numbers
        if PREVIEW_ENABLED:
            PREVIEW_NEXT = {}
        existing_root_username = options.get("company_root_username") or "company_root"

        # Resolve geo
        india = _ensure_country_india()
        state = _ensure_state(india, state_name)

        # District list
        districts: List[str] = [x.strip() for x in districts_csv.split(",") if x.strip()]
        if not districts:
            raise CommandError("At least one district required.")
        # Use the first district to derive a default city when needed
        primary_city = _ensure_city(state, districts[0])

        self.stdout.write(self.style.NOTICE(
            f"Seeding for State='{state.name}', Districts={districts}, dry_run={dry_run}"
        ))

        disconnected = False
        if (not dry_run) and no_side_effects:
            try:
                post_save.disconnect(create_wallet_for_new_user, sender=CustomUser)
                post_save.disconnect(handle_new_user_post_save, sender=CustomUser)
                disconnected = True
                self.stdout.write(self.style.WARNING("Disabled post_save side effects for faster seeding"))
            except Exception:
                pass

        # Prepare plan summary
        created_rows: List[Dict[str, str]] = []
        created_emp = 0
        created_con = 0

        # 0) Root Company (reuse if provided exists; else allocate sequential)
        company_root = CustomUser.objects.filter(username=existing_root_username).first()
        if company_root:
            company_root_username = company_root.username
        elif dry_run:
            company_root_username = _preview_for("company", preview_numbers)
        else:
            uname, pid, prefix = _alloc_username_and_prefixed("company")
            company_root = _ensure_user(
                username=uname,
                category="company",
                role="agency",
                password=password,
                sponsor_user=None,
                email=f"{uname}@example.com",
                full_name="Company Root",
                phone="9000000000",
                country=india,
                state=state,
                city=primary_city,
                pincode="560001",
                is_staff=True,
                is_superuser=True,
                prefixed_id_value=pid,
                prefix_code_value=prefix,
            )
            company_root_username = company_root.username
        created_rows.append({"username": company_root_username, "category": "company", "sponsor": "(none)"})

        # 1) Company Manager (TRCM) under company root
        if dry_run:
            cm_display = _preview_for("company_manager", preview_numbers)
        else:
            sponsor = company_root or CustomUser.objects.filter(username=company_root_username).first()
            uname, pid, prefix = _alloc_username_and_prefixed("company_manager")
            cm_user = _ensure_user(
                username=uname,
                category="company_manager",
                role="agency",
                password=password,
                sponsor_user=sponsor,
                email=f"{uname}@example.com",
                full_name="Company Manager KA",
                phone="9000000001",
                country=india,
                state=state,
                city=primary_city,
                pincode="560001",
                prefixed_id_value=pid,
                prefix_code_value=prefix,
            )
            cm_display = cm_user.username
        created_rows.append({"username": cm_display, "category": "company_manager", "sponsor": company_root_username})

        # 2) State Coordinator (TRSC) under TRCM
        if dry_run:
            sc_display = _preview_for("agency_state_coordinator", preview_numbers)
        else:
            cm = CustomUser.objects.filter(username=cm_display).first()
            uname, pid, prefix = _alloc_username_and_prefixed("agency_state_coordinator")
            sc_user = _ensure_user(
                username=uname,
                category="agency_state_coordinator",
                role="agency",
                password=password,
                sponsor_user=cm,
                email=f"{uname}@example.com",
                full_name=f"State Coordinator {state.name}",
                phone="9000000002",
                country=india,
                state=state,
                city=primary_city,
                pincode="560001",
                prefixed_id_value=pid,
                prefix_code_value=prefix,
            )
            _assign_state(sc_user, state)
            sc_display = sc_user.username
        created_rows.append({"username": sc_display, "category": "agency_state_coordinator", "sponsor": cm_display})

        # 3) State (TRST) under TRSC
        if dry_run:
            st_display = _preview_for("agency_state", preview_numbers)
        else:
            sc = CustomUser.objects.filter(username=sc_display).first()
            uname, pid, prefix = _alloc_username_and_prefixed("agency_state")
            st_user = _ensure_user(
                username=uname,
                category="agency_state",
                role="agency",
                password=password,
                sponsor_user=sc,
                email=f"{uname}@example.com",
                full_name=f"Agency State {state.name}",
                phone="9000000003",
                country=india,
                state=state,
                city=primary_city,
                pincode="560001",
                prefixed_id_value=pid,
                prefix_code_value=prefix,
            )
            _assign_state(st_user, state)
            st_display = st_user.username
        created_rows.append({"username": st_display, "category": "agency_state", "sponsor": sc_display})

        # 4) For each district: TRDC -> TRDT -> TRPC -> TRPNs (4 pins) -> TRSFx4 -> TREMPx5 -> TRC x10
        for di, dname in enumerate(districts, start=1):
            # District Coordinator
            if dry_run:
                dc_display = _preview_for("agency_district_coordinator", preview_numbers)
            else:
                st_u = CustomUser.objects.filter(username=st_display).first()
                uname, pid, prefix = _alloc_username_and_prefixed("agency_district_coordinator")
                dc_user = _ensure_user(
                    username=uname,
                    category="agency_district_coordinator",
                    role="agency",
                    password=password,
                    sponsor_user=st_u,
                    email=f"{uname}@example.com",
                    full_name=f"District Coordinator {dname}",
                    phone=f"9000001{di:03d}",
                    country=india,
                    state=state,
                    city=_ensure_city(state, dname),
                    pincode="560001",
                    prefixed_id_value=pid,
                    prefix_code_value=prefix,
                )
                _assign_district(dc_user, state, dname)
                dc_display = dc_user.username
            created_rows.append({"username": dc_display, "category": "agency_district_coordinator", "sponsor": st_display})

            # District
            if dry_run:
                dt_display = _preview_for("agency_district", preview_numbers)
            else:
                dc_u = CustomUser.objects.filter(username=dc_display).first()
                uname, pid, prefix = _alloc_username_and_prefixed("agency_district")
                dt_user = _ensure_user(
                    username=uname,
                    category="agency_district",
                    role="agency",
                    password=password,
                    sponsor_user=dc_u,
                    email=f"{uname}@example.com",
                    full_name=f"Agency District {dname}",
                    phone=f"9000002{di:03d}",
                    country=india,
                    state=state,
                    city=_ensure_city(state, dname),
                    pincode="560001",
                    prefixed_id_value=pid,
                    prefix_code_value=prefix,
                )
                _assign_district(dt_user, state, dname)
                dt_display = dt_user.username
            created_rows.append({"username": dt_display, "category": "agency_district", "sponsor": dc_display})

            # Pick 4 pincodes for this district
            pins = _pick_pincodes_for_district(dname, state.name, max_count=4)
            if not pins:
                raise CommandError(f"No pincodes found for district '{dname}' in state '{state.name}'. Check offline index.")

            # Pincode Coordinator (one per district) who manages the 4 pins
            if dry_run:
                pc_display = _preview_for("agency_pincode_coordinator", preview_numbers)
            else:
                dt_u = CustomUser.objects.filter(username=dt_display).first()
                uname, pid, prefix = _alloc_username_and_prefixed("agency_pincode_coordinator")
                pc_user = _ensure_user(
                    username=uname,
                    category="agency_pincode_coordinator",
                    role="agency",
                    password=password,
                    sponsor_user=dt_u,
                    email=f"{uname}@example.com",
                    full_name=f"Pincode Coordinator {dname}",
                    phone=f"9000003{di:03d}",
                    country=india,
                    state=state,
                    city=_ensure_city(state, dname),
                    pincode=pins[0],
                    prefixed_id_value=pid,
                    prefix_code_value=prefix,
                )
                # Assign all 4 pins to PC
                for p in pins:
                    _assign_pincode(pc_user, state, p)
                pc_display = pc_user.username
            created_rows.append({"username": pc_display, "category": "agency_pincode_coordinator", "sponsor": dt_display})

            # For each pin: TRPN under TRPC
            for pj, pin in enumerate(pins, start=1):
                if dry_run:
                    pn_display = _preview_for("agency_pincode", preview_numbers)
                else:
                    pc_u = CustomUser.objects.filter(username=pc_display).first()
                    uname, pid, prefix = _alloc_username_and_prefixed("agency_pincode")
                    pn_user = _ensure_user(
                        username=uname,
                        category="agency_pincode",
                        role="agency",
                        password=password,
                        sponsor_user=pc_u,
                        email=f"{uname}@example.com",
                        full_name=f"Agency Pincode {pin}",
                        phone=f"9000004{di:02d}{pj:02d}",
                        country=india,
                        state=state,
                        city=_ensure_city(state, dname),
                        pincode=pin,
                        prefixed_id_value=pid,
                        prefix_code_value=prefix,
                    )
                    _assign_pincode(pn_user, state, pin)
                    pn_display = pn_user.username
                created_rows.append({"username": pn_display, "category": "agency_pincode", "sponsor": pc_display})

                # 4 x Sub-Franchise under TRPN
                for si in range(1, 4 + 1):
                    if dry_run:
                        sf_display = _preview_for("agency_sub_franchise", preview_numbers)
                    else:
                        pn_u = CustomUser.objects.filter(username=pn_display).first()
                        uname, pid, prefix = _alloc_username_and_prefixed("agency_sub_franchise")
                        sf_user = _ensure_user(
                            username=uname,
                            category="agency_sub_franchise",
                            role="agency",
                            password=password,
                            sponsor_user=pn_u,
                            email=f"{uname}@example.com",
                            full_name=f"Sub-Franchise {pin}-{si:02d}",
                            phone=f"9{pin}{si:02d}",
                            country=india,
                            state=state,
                            city=_ensure_city(state, dname),
                            pincode=pin,
                            prefixed_id_value=pid,
                            prefix_code_value=prefix,
                        )
                        _assign_pincode(sf_user, state, pin)
                        sf_display = sf_user.username
                    created_rows.append({"username": sf_display, "category": "agency_sub_franchise", "sponsor": pn_display})

                    # 5 x Employee (TREMP) under each TRSF (bounded by --employees_total if provided)
                    for ei in range(1, 5 + 1):
                        if employees_total and created_emp >= employees_total:
                            break
                        if dry_run:
                            emp_display = _preview_for("employee", preview_numbers)
                        else:
                            sf_u = CustomUser.objects.filter(username=sf_display).first()
                            uname, pid, prefix = _alloc_username_and_prefixed("employee")
                            emp_user = _ensure_user(
                                username=uname,
                                category="employee",
                                role="employee",
                                password=password,
                                sponsor_user=sf_u,
                                email=f"{uname}@example.com",
                                full_name=f"Employee {pin}-{si:02d}-{ei:02d}",
                                phone=f"98{pin[-4:]}{ei:02d}",
                                country=india,
                                state=state,
                                city=_ensure_city(state, dname),
                                pincode=pin,
                                prefixed_id_value=pid,
                                prefix_code_value=prefix,
                            )
                            emp_display = emp_user.username
                        created_rows.append({"username": emp_display, "category": "employee", "sponsor": sf_display})
                        created_emp += 1

                        # 10 x Consumer (TRC) under each Employee (bounded by --consumers_total if provided)
                        for ci in range(1, 10 + 1):
                            if consumers_total and created_con >= consumers_total:
                                break
                            if dry_run:
                                con_display = _preview_for("consumer", preview_numbers)
                            else:
                                emp_u = CustomUser.objects.filter(username=emp_display).first()
                                uname, pid, prefix = _alloc_username_and_prefixed("consumer")
                                con_user = _ensure_user(
                                    username=uname,
                                    category="consumer",
                                    role="user",
                                    password=password,
                                    sponsor_user=emp_u,
                                    email=f"{uname}@example.com",
                                    full_name=f"Consumer {pin}-{si:02d}-{ei:02d}-{ci:02d}",
                                    phone=f"97{pin[-4:]}{ci:02d}",
                                    country=india,
                                    state=state,
                                    city=_ensure_city(state, dname),
                                    pincode=pin,
                                    prefixed_id_value=pid,
                                    prefix_code_value=prefix,
                                )
                                con_display = con_user.username
                            created_rows.append({"username": con_display, "category": "consumer", "sponsor": emp_display})
                            created_con += 1

        # Output summary
        self.stdout.write(self.style.SUCCESS("Seed plan/result:"))
        total = len(created_rows)
        # Build counts summary
        counts: Dict[str, int] = {}
        for row in created_rows:
            cat = row.get("category") or ""
            counts[cat] = counts.get(cat, 0) + 1

        if summary_only:
            self.stdout.write(f"Total rows: {total}")
            for cat in sorted(counts.keys()):
                self.stdout.write(f"  {cat}: {counts[cat]}")
        else:
            if print_limit and total > print_limit:
                self.stdout.write(f"(showing first {print_limit} of {total} rows; use --print_limit to change or --summary_only)")
                to_show = created_rows[:print_limit]
            else:
                to_show = created_rows
            for row in to_show:
                self.stdout.write(
                    f" - {row['username']:<24} | {row['category']:<28} | sponsor={row['sponsor']}"
                )
            # Always print counts summary after list
            self.stdout.write("Counts:")
            for cat in sorted(counts.keys()):
                self.stdout.write(f"  {cat}: {counts[cat]}")

        if not dry_run and 'disconnected' in locals() and disconnected:
            try:
                post_save.connect(create_wallet_for_new_user, sender=CustomUser)
                post_save.connect(handle_new_user_post_save, sender=CustomUser)
            except Exception:
                pass

        if dry_run:
            if 'disconnected' in locals() and disconnected:
                try:
                    post_save.connect(create_wallet_for_new_user, sender=CustomUser)
                    post_save.connect(handle_new_user_post_save, sender=CustomUser)
                except Exception:
                    pass
            raise CommandError("Dry-run complete (no data written).")
