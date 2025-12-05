from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from typing import Optional, Tuple

from accounts.models import CustomUser
from locations.models import Country, State, City


def _norm_pin(pin: str) -> str:
    s = "".join(ch for ch in str(pin or "") if ch.isdigit())
    return s[:6] if len(s) >= 6 else s


def resolve_from_pin(pin: str, allow_online: bool = False) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Return (country_name, state_name, district_name) for a PIN using:
      1) Offline cache from locations.views.PINCODES_OFFLINE
      2) India Post API (when allow_online=True)
    """
    pin = _norm_pin(pin)
    if not pin or len(pin) != 6:
        return None, None, None

    c_name = s_name = d_name = None
    try:
        # Lazy import to load offline cache initialized in views
        from locations.views import PINCODES_OFFLINE, POSTAL_HEADERS, session  # type: ignore
        meta = (PINCODES_OFFLINE or {}).get(pin) or {}
        if isinstance(meta, dict):
            c_name = (meta.get("country") or "").strip() or None
            s_name = (meta.get("state") or "").strip() or None
            d_name = (meta.get("district") or meta.get("city") or "").strip() or None
    except Exception:
        pass

    if s_name and d_name:
        return c_name, s_name, d_name

    if allow_online:
        try:
            import requests  # noqa: F401  (requests used by session in views)
            from locations.views import POSTAL_HEADERS, session  # type: ignore
            r = session.get(f"https://api.postalpincode.in/pincode/{pin}", headers=POSTAL_HEADERS, timeout=12)
            if r.status_code == 200:
                arr = r.json() or []
                if isinstance(arr, list) and arr:
                    entry = arr[0] or {}
                    if entry.get("Status") == "Success":
                        offices = entry.get("PostOffice") or []
                        if offices:
                            first = offices[0] or {}
                            c_name = c_name or (first.get("Country") or "").strip() or None
                            s_name = s_name or (first.get("State") or "").strip() or None
                            d_name = d_name or (first.get("District") or "").strip() or None
                            return c_name, s_name, d_name
        except Exception:
            pass

    return c_name, s_name, d_name


class Command(BaseCommand):
    help = "Force-fix agency_sub_franchise users' State and District strictly from their own pincode. Does NOT modify pincode or country."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Preview changes without saving to DB.",
        )
        parser.add_argument(
            "--online",
            action="store_true",
            default=False,
            help="Allow India Post API fallback when offline cache lacks data.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Limit number of users to process.",
        )
        parser.add_argument(
            "--category",
            type=str,
            default="agency_sub_franchise",
            help="Target category (default: agency_sub_franchise).",
        )
        parser.add_argument(
            "--ids",
            type=str,
            default="",
            help="Optional comma-separated user IDs to restrict updates (within the chosen category).",
        )

    def handle(self, *args, **opts):
        dry_run = bool(opts.get("dry_run"))
        allow_online = bool(opts.get("online"))
        limit = int(opts.get("limit") or 0)
        category = (opts.get("category") or "agency_sub_franchise").strip()
        ids_arg = (opts.get("ids") or "").strip()

        id_filter = []
        if ids_arg:
            for tok in ids_arg.split(","):
                tok = tok.strip()
                if tok.isdigit():
                    id_filter.append(int(tok))

        base_q = CustomUser.objects.filter(category=category).exclude(Q(pincode__isnull=True) | Q(pincode__exact=""))
        if id_filter:
            base_q = base_q.filter(id__in=id_filter)

        users = list(base_q.order_by("id")[:limit] if limit > 0 else base_q.order_by("id"))

        self.stdout.write(self.style.NOTICE(f"Fixing geo for category='{category}' via PIN only (dry_run={dry_run}, online={allow_online})"))
        self.stdout.write(self.style.NOTICE(f"Candidates: {len(users)}"))

        changed = 0
        skipped = 0
        failed = 0

        # Reuse or ensure an 'India' country for new state creations if needed (we do NOT assign to user.country)
        india_country: Optional[Country] = Country.objects.filter(name__iexact="India").first()

        for i, u in enumerate(users, start=1):
            pin = _norm_pin(u.pincode or "")
            if len(pin) != 6:
                skipped += 1
                self.stdout.write(f"[{i}/{len(users)}] {u.id} {u.username}: skip (invalid pin='{u.pincode}')")
                continue

            c_name, s_name, d_name = resolve_from_pin(pin, allow_online=allow_online)
            if not s_name or not d_name:
                skipped += 1
                self.stdout.write(f"[{i}/{len(users)}] {u.id} {u.username}: skip (no mapping for pin={pin})")
                continue

            # Resolve target state (prefer matching within user's current country if set; else anywhere; else create under India)
            target_state: Optional[State] = None
            st_qs = State.objects.all()
            if getattr(u, "country_id", None):
                st_qs = st_qs.filter(country_id=u.country_id)
            st = st_qs.filter(name__iexact=s_name).first() or st_qs.filter(name__icontains=s_name).first()
            if not st:
                # Try global lookup ignoring country boundary
                st = State.objects.filter(name__iexact=s_name).first() or State.objects.filter(name__icontains=s_name).first()
            if not st and india_country:
                try:
                    st = State.objects.create(country_id=india_country.id, name=s_name)
                except Exception:
                    st = State.objects.filter(name__iexact=s_name).first()
            target_state = st

            # Resolve target city (district) under the target state if possible; else under existing user.state
            target_city: Optional[City] = None
            state_id_for_city = target_state.id if target_state else getattr(u, "state_id", None)
            if state_id_for_city:
                ci = City.objects.filter(state_id=state_id_for_city, name__iexact=d_name).first()
                if not ci:
                    ci = City.objects.filter(state_id=state_id_for_city, name__icontains=d_name).first()
                if not ci and target_state:
                    try:
                        ci = City.objects.create(state_id=target_state.id, name=d_name)
                    except Exception:
                        ci = City.objects.filter(state_id=state_id_for_city, name__iexact=d_name).first()
                target_city = ci

            if not target_state and not target_city:
                skipped += 1
                self.stdout.write(f"[{i}/{len(users)}] {u.id} {u.username}: skip (could not resolve state/city)")
                continue

            before = {
                "state_id": getattr(u, "state_id", None),
                "city_id": getattr(u, "city_id", None),
                "pin": u.pincode,
            }
            updates = {}
            if target_state and getattr(u, "state_id", None) != target_state.id:
                updates["state_id"] = target_state.id
            if target_city and getattr(u, "city_id", None) != target_city.id:
                updates["city_id"] = target_city.id

            if not updates:
                skipped += 1
                self.stdout.write(f"[{i}/{len(users)}] {u.id} {u.username}: no change")
                continue

            after = {
                "state_id": updates.get("state_id", getattr(u, "state_id", None)),
                "city_id": updates.get("city_id", getattr(u, "city_id", None)),
                "pin": u.pincode,
            }

            self.stdout.write(self.style.SUCCESS(f"[{i}/{len(users)}] {u.id} {u.username}: {before} -> {after}"))

            if dry_run:
                changed += 1
                continue

            try:
                with transaction.atomic():
                    if "state_id" in updates:
                        u.state_id = updates["state_id"]
                    if "city_id" in updates:
                        u.city_id = updates["city_id"]
                    update_fields = []
                    if "state_id" in updates:
                        update_fields.append("state")
                    if "city_id" in updates:
                        update_fields.append("city")
                    u.save(update_fields=update_fields or None)
                changed += 1
            except Exception as e:
                failed += 1
                self.stdout.write(self.style.ERROR(f"[{i}/{len(users)}] {u.id} {u.username}: save failed -> {e}"))

        self.stdout.write("")
        self.stdout.write(self.style.NOTICE(f"Done. changed={changed}, skipped={skipped}, failed={failed}, total={len(users)}"))
