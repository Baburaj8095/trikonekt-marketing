from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from typing import Optional, Tuple

from accounts.models import CustomUser
from locations.models import Country, State, City


AGENCY_CATEGORIES = {
    "agency_state_coordinator",
    "agency_state",
    "agency_district_coordinator",
    "agency_district",
    "agency_pincode_coordinator",
    "agency_pincode",
    "agency_sub_franchise",
}


def normalize_pin(pin: str) -> str:
    s = "".join(ch for ch in str(pin or "") if ch.isdigit())
    return s[:6] if len(s) >= 6 else s


def resolve_by_pincode(pin: str, allow_online: bool = False) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Resolve (country_name, state_name, district_name) for a given 6-digit pincode.
    Strictly uses the user's existing pincode only. No sponsor/assignment logic.
    1) Tries offline cache from locations.views.PINCODES_OFFLINE if available.
    2) Optionally (allow_online=True) falls back to India Post public API.
    """
    pin = normalize_pin(pin)
    if not pin or len(pin) != 6:
        return None, None, None

    # Try offline cache
    meta = None
    try:
        from locations.views import PINCODES_OFFLINE  # type: ignore
        meta = (PINCODES_OFFLINE or {}).get(pin)
    except Exception:
        meta = None

    c_name = (meta or {}).get("country") if isinstance(meta, dict) else None
    s_name = (meta or {}).get("state") if isinstance(meta, dict) else None
    d_name = (meta or {}).get("district") if isinstance(meta, dict) else None
    c_name = (c_name or "").strip() or None
    s_name = (s_name or "").strip() or None
    d_name = (d_name or "").strip() or None

    if c_name and s_name and d_name:
        return c_name, s_name, d_name

    if allow_online:
        try:
            import requests  # lazy import
            r = requests.get(f"https://api.postalpincode.in/pincode/{pin}", timeout=10)
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
    """
    Backfill/repair State and District (City) based ONLY on the user's existing 6-digit pincode.
    - Never modifies pincode
    - No sponsor/upline/assignment fallbacks
    - If --overwrite is set, fix mismatches for state and city to match the pincode mapping
    - If --overwrite is NOT set, only fills missing state/city
    - Country is never modified by this command
    """

    help = "Update State and District (City) from existing pincode. Optional overwrite for mismatches; country is never modified."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Do not write changes; only show what would be updated.",
        )
        parser.add_argument(
            "--online",
            action="store_true",
            default=False,
            help="Allow online lookup (India Post API) for pincodes when offline cache has no data.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Limit number of users processed (0 means no limit).",
        )
        parser.add_argument(
            "--categories",
            type=str,
            default=",".join(sorted(AGENCY_CATEGORIES)),
            help="Comma separated CustomUser.category values to scope. Defaults to agency categories.",
        )
        parser.add_argument(
            "--overwrite",
            action="store_true",
            default=False,
            help="Overwrite mismatched state & district (city) to match mapping from pincode. Country is never modified.",
        )

    def handle(self, *args, **opts):
        dry_run = bool(opts.get("dry_run"))
        allow_online = bool(opts.get("online"))
        limit = int(opts.get("limit") or 0)
        overwrite = bool(opts.get("overwrite"))
        cats_arg = (opts.get("categories") or "").strip()
        cats = {c.strip() for c in cats_arg.split(",") if c.strip()}

        mode = "OVERWRITE mismatches" if overwrite else "FILL missing only"
        self.stdout.write(self.style.NOTICE(f"Backfilling geo via EXISTING pincode only (dry_run={dry_run}, online={allow_online}) [{mode}]"))
        self.stdout.write(self.style.NOTICE(f"Categories: {sorted(cats)}"))

        # Users with a non-empty pincode
        base_q = CustomUser.objects.filter(
            category__in=list(cats),
        ).exclude(Q(pincode__isnull=True) | Q(pincode__exact=""))

        # If not overwriting, process only those who are missing any of country/state/city
        if not overwrite:
            base_q = base_q.filter(Q(state__isnull=True) | Q(city__isnull=True))

        if limit > 0:
            users = list(base_q.order_by("id")[:limit])
        else:
            users = list(base_q.order_by("id"))

        total = len(users)
        updated = 0
        skipped = 0
        self.stdout.write(self.style.NOTICE(f"Found {total} users to process"))

        for i, u in enumerate(users, start=1):
            changed_fields = []
            before = {
                "country_id": getattr(u, "country_id", None),
                "state_id": getattr(u, "state_id", None),
                "city_id": getattr(u, "city_id", None),
                "pincode": (u.pincode or ""),
            }

            # Skip invalid pincodes
            pin = normalize_pin(u.pincode or "")
            if len(pin) != 6:
                skipped += 1
                self.stdout.write(f"[{i}/{total}] {u.id} {u.username}: skipped (invalid pincode='{u.pincode}')")
                continue

            # Resolve mapping from pincode
            c_name, s_name, d_name = resolve_by_pincode(pin, allow_online=allow_online)



            # Determine desired state (do not change country if already set)
            desired_state_id: Optional[int] = None
            if s_name:
                state_qs = State.objects.all()
                # Prefer user's current country if set
                if getattr(u, "country_id", None):
                    state_qs = state_qs.filter(country_id=u.country_id)
                # Else try by resolved country name
                elif c_name:
                    c = Country.objects.filter(name__iexact=c_name).first()
                    if c:
                        state_qs = state_qs.filter(country_id=c.id)
                # Try exact then icontains
                s = state_qs.filter(name__iexact=s_name).first()
                if not s:
                    s = state_qs.filter(name__icontains=s_name).first()
                # As a last resort, if no state was found but user has a country_id, optionally create
                if not s and getattr(u, "country_id", None):
                    try:
                        s = State.objects.create(country_id=u.country_id, name=s_name)
                    except Exception:
                        s = state_qs.filter(name__iexact=s_name).first()
                if s:
                    desired_state_id = s.id

            # Determine desired city (needs desired or current state)
            desired_city_id: Optional[int] = None
            if d_name and (desired_state_id or getattr(u, "state_id", None)):
                state_id_for_city = desired_state_id or u.state_id
                ci = City.objects.filter(state_id=state_id_for_city, name__iexact=d_name).first()
                if not ci:
                    ci = City.objects.filter(state_id=state_id_for_city, name__icontains=d_name).first()
                if not ci and desired_state_id:
                    # Optionally create city only when we have a concrete desired state
                    try:
                        ci = City.objects.create(state_id=desired_state_id, name=d_name)
                    except Exception:
                        ci = City.objects.filter(state_id=state_id_for_city, name__iexact=d_name).first()
                if ci:
                    desired_city_id = ci.id

            # Apply changes according to overwrite mode (never change pincode)
            # State
            if desired_state_id:
                if overwrite:
                    if getattr(u, "state_id", None) != desired_state_id:
                        u.state_id = desired_state_id
                        changed_fields.append("state_id")
                else:
                    if not getattr(u, "state_id", None):
                        u.state_id = desired_state_id
                        changed_fields.append("state_id")


            # City
            if desired_city_id:
                if overwrite:
                    if getattr(u, "city_id", None) != desired_city_id:
                        u.city_id = desired_city_id
                        changed_fields.append("city_id")
                else:
                    if not getattr(u, "city_id", None):
                        u.city_id = desired_city_id
                        changed_fields.append("city_id")

            changed_fields = sorted(set(changed_fields))

            if not changed_fields:
                skipped += 1
                self.stdout.write(f"[{i}/{total}] {u.id} {u.username}: no change")
                continue

            after = {
                "country_id": getattr(u, "country_id", None),
                "state_id": getattr(u, "state_id", None),
                "city_id": getattr(u, "city_id", None),
                "pincode": (u.pincode or ""),
            }

            self.stdout.write(
                self.style.SUCCESS(
                    f"[{i}/{total}] {u.id} {u.username}: update {changed_fields} "
                    f"{before} -> {after}"
                )
            )

            if not dry_run:
                try:
                    with transaction.atomic():
                        update_fields = []
                        for f in changed_fields:
                            if f == "state_id":
                                update_fields.append("state")
                            elif f == "city_id":
                                update_fields.append("city")
                        if update_fields:
                            u.save(update_fields=sorted(set(update_fields)))
                        else:
                            u.save()
                    updated += 1
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Failed to save {u.id} {u.username}: {e}"))
            else:
                updated += 1  # would update

        self.stdout.write("")
        self.stdout.write(self.style.NOTICE(f"Done. scanned={total}, changed={updated}, unchanged={skipped}"))
        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run mode: no changes were written."))
