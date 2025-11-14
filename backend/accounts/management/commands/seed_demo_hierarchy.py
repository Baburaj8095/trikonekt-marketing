from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import (
    CustomUser,
    AgencyRegionAssignment,
)
from locations.models import State


def random_full_name(idx: int) -> str:
    # Deterministic but varied Indian names using index
    first_names = [
        "Aarav", "Vivaan", "Aditya", "Vihaan", "Krishna", "Ishaan", "Shaurya", "Atharv", "Ayaan", "Arnav",
        "Priya", "Ananya", "Diya", "Ishika", "Myra", "Aarohi", "Kiara", "Saanvi", "Aadhya", "Eva",
        "Rohan", "Rahul", "Karthik", "Siddharth", "Harsh", "Nikhil", "Manish", "Varun", "Yash", "Rajat",
    ]
    last_names = [
        "Sharma", "Verma", "Gupta", "Iyer", "Reddy", "Nair", "Patel", "Kumar", "Singh", "Das",
        "Bose", "Chatterjee", "Menon", "Naidu", "Shetty", "Gowda", "Pillai", "Ahmed", "Khan", "Hussain",
        "Rastogi", "Jain", "Bansal", "Agarwal", "Chauhan", "Bhatt", "Mehta", "Joshi", "Kulkarni", "Desai",
    ]
    fn = first_names[idx % len(first_names)]
    ln = last_names[(idx // 3) % len(last_names)]
    return f"{fn} {ln}"


def make_email(username: str) -> str:
    return f"{username.lower()}@example.com"


def make_phone_fallback(base: int) -> str:
    # Fallback to 10-digit number with base offset, deterministic (not used when we supply phone_override)
    s = str(9000000000 + (base % 999999999))
    return s[-10:]


def ensure_user(
    *,
    username: str,
    role: str,
    category: str,
    sponsor_username: str,
    password: str,
    full_name: str,
    state_obj: State | None = None,
    district_name: str = "",
    pincode: str = "",
    phone_override: str | None = None,
    reset_passwords: bool = True,
    skip_password_usernames: set[str] | None = None,
) -> CustomUser:
    """
    Idempotently create/update a user with the exact username.
    Enforce that sponsor_id == sponsor_username (hard rule).
    If phone_override is provided, use it as the user's 10-digit phone number.
    """
    skip_password_usernames = skip_password_usernames or set()
    u = CustomUser.objects.filter(username__iexact=username).first()
    if u:
        updates = {}
        if u.role != role:
            u.role = role
            updates["role"] = role
        if u.category != category:
            u.category = category
            updates["category"] = category
        if (u.sponsor_id or "") != sponsor_username:
            u.sponsor_id = sponsor_username
            updates["sponsor_id"] = sponsor_username
        if full_name and (u.full_name or "") != full_name:
            u.full_name = full_name
            updates["full_name"] = full_name
        if phone_override and (u.phone or "") != phone_override:
            u.phone = phone_override
            updates["phone"] = phone_override
        if state_obj and u.state_id != getattr(state_obj, "id", None):
            u.state = state_obj
            updates["state"] = state_obj
        if district_name and (u.address or "").find(district_name) == -1:
            u.address = (u.address or "").strip()
            if u.address:
                u.address += f" | District: {district_name}"
            else:
                u.address = f"District: {district_name}"
            updates["address"] = u.address
        if pincode and (u.pincode or "") != pincode:
            u.pincode = pincode
            updates["pincode"] = pincode

        if reset_passwords and (u.username not in skip_password_usernames):
            u.set_password(password)
            updates["_password"] = "reset"

        if updates:
            u.save()
        return u

    # Create fresh
    sponsor = CustomUser.objects.filter(username__iexact=sponsor_username).first()
    # Allow self-sponsorship without requiring an existing sponsor record
    if sponsor_username and sponsor_username.lower() != username.lower() and not sponsor:
        raise ValueError(f"Sponsor username not found: {sponsor_username} (required for {username})")

    u = CustomUser.objects.create_user(
        username=username,
        email=make_email(username),
        password=password,
        role=role,
    )
    # Profile + classification
    u.full_name = full_name
    u.phone = phone_override or make_phone_fallback(abs(hash(username)))
    u.category = category
    # Strict sponsor rule
    u.sponsor_id = sponsor_username

    # Location fields
    if state_obj:
        u.state = state_obj
    if pincode:
        u.pincode = pincode
    if district_name:
        u.address = f"District: {district_name}"

    if sponsor:
        u.registered_by = sponsor

    u.is_active = True
    u.save()
    return u


class Command(BaseCommand):
    help = (
        "Seeds a demo hierarchy: States -> Districts -> Pincodes -> Sub-Franchise -> Employees, plus 20 consumers. "
        "Usernames use role prefixes with a 10-digit Indian number (e.g., TR9000000001) and sponsor_id is always the sponsor's username."
    )

    def add_arguments(self, parser):
        parser.add_argument("--consumers", type=int, default=20, help="Number of consumers to create (default 20)")
        parser.add_argument("--password", type=str, default="Test@123", help="Password for all created/updated users")
        parser.add_argument("--skip-reset-root", action="store_true", help="Do not reset password for TRROOT if present (default True)")
        parser.add_argument("--no-reset-passwords", action="store_true", help="Do not reset passwords for existing users")
        parser.add_argument("--dry-run", action="store_true", help="Plan only; print what would be created without writing to DB")

    @transaction.atomic
    def handle(self, *args, **opts):
        consumers_target = int(opts.get("consumers") or 20)
        password = opts.get("password") or "Test@123"
        reset_passwords = not bool(opts.get("no_reset_passwords"))
        skip_reset_root = bool(opts.get("skip_reset_root", True))
        dry_run = bool(opts.get("dry_run"))

        self.stdout.write(self.style.HTTP_INFO(f"{'DRY-RUN: ' if dry_run else ''}Seeding demo hierarchy with consumers={consumers_target}, password=****"))

        # Simple per-prefix sequential 10-digit generator starting from 9000000001
        def _seq_maker(start: int = 9000000001):
            counters: dict[str, int] = {}
            def next_for(prefix: str) -> int:
                n = counters.get(prefix, start - 1) + 1
                counters[prefix] = n
                return n
            return next_for

        next_for = _seq_maker()

        def mk(prefix: str) -> tuple[str, str]:
            n = next_for(prefix)
            digits = f"{n:010d}"
            return f"{prefix}{digits}", digits  # (username, phone_digits)

        # Discover TRROOT (if exists)
        trroot = CustomUser.objects.filter(username__iexact="TRROOT").first()
        if trroot:
            self.stdout.write(self.style.SUCCESS(f"Found TRROOT: {trroot.username}"))
        else:
            self.stdout.write(self.style.WARNING("TRROOT not found. States will be rooted to themselves."))

        # Ensure / probe base States (locations)
        if dry_run:
            st1 = State.objects.filter(name="Karnataka").first()
            st2 = State.objects.filter(name="Maharashtra").first()
        else:
            st1, _ = State.objects.get_or_create(name="Karnataka", defaults={"code": "KA"})
            st2, _ = State.objects.get_or_create(name="Maharashtra", defaults={"code": "MH"})

        skip_password_usernames = {"TRROOT"} if skip_reset_root else set()

        created = {
            "state": [],
            "district": [],
            "pincode": [],
            "subf": [],
            "employee": [],
            "consumer": [],
        }

        sponsor_map: dict[str, str] = {}

        # 1) States (2): TRST + 10-digit
        state_users: list[dict] = []
        state_specs = [
            {"state": st1},
            {"state": st2},
        ]
        for i, spec in enumerate(state_specs, start=1):
            username, phone_digits = mk("TRST")
            sponsor_un = trroot.username if trroot else username  # strict rule fallback to self
            if dry_run:
                state_users.append({"username": username})
                created["state"].append(username)
                sponsor_map[username] = sponsor_un
            else:
                u = ensure_user(
                    username=username,
                    role="agency",
                    category="agency_state",
                    sponsor_username=sponsor_un,
                    password=password,
                    full_name=random_full_name(i),
                    state_obj=spec["state"],
                    phone_override=phone_digits,
                    reset_passwords=reset_passwords,
                    skip_password_usernames=skip_password_usernames,
                )
                state_users.append({"username": u.username})
                created["state"].append(u.username)
                AgencyRegionAssignment.objects.get_or_create(
                    user=u, level="state", state=spec["state"]
                )

        # 2) Districts (2 per state): TRDT + 10-digit under each state
        district_names_map = {
            state_users[0]["username"] if state_users else "TRSTXXXX": ["Bengaluru Urban", "Mysuru"],
            state_users[1]["username"] if len(state_users) > 1 else "TRSTYYYY": ["Mumbai", "Pune"],
        }
        district_users: list[dict] = []
        for si, s_user in enumerate(state_users, start=1):
            s_un = s_user["username"]
            dnames = district_names_map.get(s_un, [f"District{si}A", f"District{si}B"])
            for dj in range(1, 2 + 1):
                d_username, d_phone = mk("TRDT")
                d_full = random_full_name(si * 10 + dj)
                if dry_run:
                    district_users.append({"username": d_username})
                    created["district"].append(d_username)
                    sponsor_map[d_username] = s_un
                else:
                    s_obj = State.objects.filter(name="Karnataka").first() if si == 1 else State.objects.filter(name="Maharashtra").first()
                    u = ensure_user(
                        username=d_username,
                        role="agency",
                        category="agency_district",
                        sponsor_username=s_un,
                        password=password,
                        full_name=d_full,
                        state_obj=s_obj,
                        district_name=dnames[dj - 1] if dj - 1 < len(dnames) else "",
                        phone_override=d_phone,
                        reset_passwords=reset_passwords,
                        skip_password_usernames=skip_password_usernames,
                    )
                    district_users.append({"username": u.username})
                    created["district"].append(u.username)
                    AgencyRegionAssignment.objects.get_or_create(
                        user=u, level="district", state=s_obj, district=dnames[dj - 1] if dj - 1 < len(dnames) else ""
                    )

        # 3) Pincode users (4 per district) => 16 total, TRPN + 10-digit; assign 16 demo pincodes
        kka_pins = [f"{560000 + i:06d}" for i in range(1, 9)]  # 560001..560008
        mh_pins = [f"{400000 + i:06d}" for i in range(1, 9)]   # 400001..400008
        all_pins = kka_pins + mh_pins  # 16
        pincode_users: list[dict] = []
        pin_index = 0
        for d_idx, d_user in enumerate(district_users):
            d_un = d_user["username"]
            for _ in range(4):  # 4 per district
                p_username, p_phone = mk("TRPN")
                pincode_val = all_pins[pin_index % len(all_pins)]
                if dry_run:
                    pincode_users.append({"username": p_username, "pincode": pincode_val})
                    created["pincode"].append(p_username)
                    sponsor_map[p_username] = d_un
                else:
                    s_obj = State.objects.filter(name="Karnataka").first() if d_idx < 2 else State.objects.filter(name="Maharashtra").first()
                    u = ensure_user(
                        username=p_username,
                        role="agency",
                        category="agency_pincode",
                        sponsor_username=d_un,
                        password=password,
                        full_name=random_full_name(100 + pin_index),
                        state_obj=s_obj,
                        district_name="",
                        pincode=pincode_val,
                        phone_override=p_phone,
                        reset_passwords=reset_passwords,
                        skip_password_usernames=skip_password_usernames,
                    )
                    pincode_users.append({"username": u.username, "pincode": pincode_val})
                    created["pincode"].append(u.username)
                    AgencyRegionAssignment.objects.get_or_create(
                        user=u, level="pincode", pincode=pincode_val
                    )
                pin_index += 1

        # 4) Sub-Franchise (1 per pincode) => 16 total, TRSF + 10-digit
        subf_users: list[dict] = []
        for i, p_user in enumerate(pincode_users, start=1):
            username, phone_digits = mk("TRSF")
            p_un = p_user["username"]
            if dry_run:
                subf_users.append({"username": username})
                created["subf"].append(username)
                sponsor_map[username] = p_un
            else:
                u = ensure_user(
                    username=username,
                    role="agency",
                    category="agency_sub_franchise",
                    sponsor_username=p_un,
                    password=password,
                    full_name=random_full_name(200 + i),
                    state_obj=None,
                    district_name="",
                    pincode=p_user.get("pincode") or "",
                    phone_override=phone_digits,
                    reset_passwords=reset_passwords,
                    skip_password_usernames=skip_password_usernames,
                )
                subf_users.append({"username": u.username})
                created["subf"].append(u.username)

        # 5) Employees (2 per sub-franchise) => 32 total, TREP + 10-digit
        employee_users: list[dict] = []
        for sf in subf_users:
            for _ in range(2):
                username, phone_digits = mk("TREP")
                sf_un = sf["username"]
                if dry_run:
                    employee_users.append({"username": username})
                    created["employee"].append(username)
                    sponsor_map[username] = sf_un
                else:
                    u = ensure_user(
                        username=username,
                        role="employee",
                        category="employee",
                        sponsor_username=sf_un,
                        password=password,
                        full_name=random_full_name(300 + len(employee_users) + 1),
                        state_obj=None,
                        district_name="",
                        pincode="",
                        phone_override=phone_digits,
                        reset_passwords=reset_passwords,
                        skip_password_usernames=skip_password_usernames,
                    )
                    employee_users.append({"username": u.username})
                    created["employee"].append(u.username)

        # 6) Consumers (TR + 10-digit) — distribute 4 each across five sponsor buckets (states/districts/pincodes/subf/employees)
        consumer_users: list[dict] = []
        consumers_total = max(0, consumers_target)
        if consumers_total > 0:
            sponsor_buckets = [
                [x["username"] for x in state_users],
                [x["username"] for x in (district_users[:4] if len(district_users) >= 4 else district_users)],
                [x["username"] for x in (pincode_users[:4] if len(pincode_users) >= 4 else pincode_users)],
                [x["username"] for x in (subf_users[:4] if len(subf_users) >= 4 else subf_users)],
                [x["username"] for x in (employee_users[:4] if len(employee_users) >= 4 else employee_users)],
            ]
            per_bucket = 4
            made = 0
            # Even 4 per bucket
            for bucket in sponsor_buckets:
                if made >= consumers_total:
                    break
                sponsors = bucket if bucket else []
                count_here = min(per_bucket, consumers_total - made)
                for t in range(count_here):
                    sponsor_un = sponsors[t % len(sponsors)] if sponsors else (state_users[0]["username"] if state_users else "TRROOT")
                    username, phone_digits = mk("TR")
                    if dry_run:
                        consumer_users.append({"username": username})
                        created["consumer"].append(username)
                        sponsor_map[username] = sponsor_un
                    else:
                        u = ensure_user(
                            username=username,
                            role="user",
                            category="consumer",
                            sponsor_username=sponsor_un,
                            password=password,
                            full_name=random_full_name(400 + len(consumer_users) + 1),
                            state_obj=None,
                            district_name="",
                            pincode="",
                            phone_override=phone_digits,
                            reset_passwords=reset_passwords,
                            skip_password_usernames=skip_password_usernames,
                        )
                        consumer_users.append({"username": u.username})
                        created["consumer"].append(u.username)
                    made += 1
                    if made >= consumers_total:
                        break
            # If still short, fill using state sponsors
            while made < consumers_total:
                sponsor_un = (state_users[made % len(state_users)]["username"]) if state_users else "TRROOT"
                username, phone_digits = mk("TR")
                if dry_run:
                    consumer_users.append({"username": username})
                    created["consumer"].append(username)
                    sponsor_map[username] = sponsor_un
                else:
                    u = ensure_user(
                        username=username,
                        role="user",
                        category="consumer",
                        sponsor_username=sponsor_un,
                        password=password,
                        full_name=random_full_name(500 + made + 1),
                        state_obj=None,
                        pincode="",
                        phone_override=phone_digits,
                        reset_passwords=reset_passwords,
                        skip_password_usernames=skip_password_usernames,
                    )
                    consumer_users.append({"username": u.username})
                    created["consumer"].append(u.username)
                made += 1

        # Summary
        self.stdout.write(self.style.SUCCESS("Seeding completed. Summary:"))
        self.stdout.write(f"  States:        {len(created['state'])} -> {', '.join(created['state'])}")
        self.stdout.write(f"  Districts:     {len(created['district'])} -> {', '.join(created['district'][:8])}{' ...' if len(created['district']) > 8 else ''}")
        self.stdout.write(f"  Pincodes:      {len(created['pincode'])} -> {', '.join(created['pincode'][:8])}{' ...' if len(created['pincode']) > 8 else ''}")
        self.stdout.write(f"  Sub-Franchise: {len(created['subf'])} -> {', '.join(created['subf'][:8])}{' ...' if len(created['subf']) > 8 else ''}")
        self.stdout.write(f"  Employees:     {len(created['employee'])} -> {', '.join(created['employee'][:8])}{' ...' if len(created['employee']) > 8 else ''}")
        self.stdout.write(f"  Consumers:     {len(created['consumer'])} -> {', '.join(created['consumer'][:8])}{' ...' if len(created['consumer']) > 8 else ''}")

        # Sample chains
        def first_or_none(arr):
            return arr[0] if arr else None

        if dry_run:
            sample_usernames = [
                first_or_none([x["username"] for x in consumer_users]),
                first_or_none([x["username"] for x in employee_users]),
                first_or_none([x["username"] for x in subf_users]),
            ]
            for uname in sample_usernames:
                if not uname:
                    continue
                chain = [uname]
                seen = set()
                cur = uname
                for _ in range(6):
                    sid = (sponsor_map.get(cur) or "").strip()
                    if not sid or sid in seen:
                        break
                    seen.add(sid)
                    chain.append(sid)
                    cur = sid
                self.stdout.write(f"  Chain: {' -> '.join(chain)}")
        else:
            sample_objects = []
            if consumer_users:
                sample_objects.append(CustomUser.objects.filter(username__iexact=consumer_users[0]['username']).first())
            if employee_users:
                sample_objects.append(CustomUser.objects.filter(username__iexact=employee_users[0]['username']).first())
            if subf_users:
                sample_objects.append(CustomUser.objects.filter(username__iexact=subf_users[0]['username']).first())
            for obj in sample_objects:
                if not obj:
                    continue
                chain = [obj.username]
                seen = set()
                cur = obj
                for _ in range(6):
                    sid = (cur.sponsor_id or "").strip()
                    if not sid or sid in seen:
                        break
                    seen.add(sid)
                    chain.append(sid)
                    nxt = CustomUser.objects.filter(username__iexact=sid).first()
                    if not nxt:
                        break
                    cur = nxt
                self.stdout.write(f"  Chain: {' -> '.join(chain)}")
