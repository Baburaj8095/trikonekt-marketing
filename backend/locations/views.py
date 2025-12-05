from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
import requests
from urllib.parse import quote
from .models import Country, State, City
from .serializers import CountrySerializer, StateSerializer, CitySerializer
import json
import os
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Shared HTTP session with retries for external APIs
EXTERNAL_UA = "TrikonektApp/1.0 (contact: admin@trikonekt.local)"
POSTAL_HEADERS = {"User-Agent": EXTERNAL_UA}

session = requests.Session()
retries = Retry(
    total=3,
    backoff_factor=0.5,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"],
)
adapter = HTTPAdapter(max_retries=retries)
session.mount("https://", adapter)
session.mount("http://", adapter)

# Offline pincode fallback cache
OFFLINE_PINCODES_PATH = os.path.join(settings.BASE_DIR, 'locations', 'data', 'pincodes_offline.json')
try:
    with open(OFFLINE_PINCODES_PATH, 'r', encoding='utf-8') as f:
        PINCODES_OFFLINE = json.load(f)
except Exception:
    PINCODES_OFFLINE = {}

def _unwrap_records(raw):
    try:
        obj = raw
        # Repeatedly unwrap common container keys until we reach a list of rows or a dict keyed by pincode
        keys = ("records", "data", "rows", "items", "result", "list", "entries")
        for _ in range(4):
            if isinstance(obj, dict):
                found = False
                for k in keys:
                    v = obj.get(k)
                    if isinstance(v, list) or isinstance(v, dict):
                        obj = v
                        found = True
                        break
                if not found:
                    break
            else:
                break
        return obj
    except Exception:
        return raw

# Normalization helpers for India Post searches (legacy vs current names)
def india_place_variants(name: str):
    if not name:
        return []
    base = str(name).strip()
    variants = {base, base.title(), base.upper()}
    # Known India synonym mappings (modern <-> legacy)
    synonyms = {
        "Kalaburagi": ["Gulbarga"],
        "Kalaburgi": ["Kalaburagi", "Gulbarga"],
        "Belagavi": ["Belgaum"],
        "Vijayapura": ["Bijapur"],
        "Ballari": ["Bellary"],
        "Shivamogga": ["Shimoga"],
        "Tumakuru": ["Tumkur"],
        "Chikkamagaluru": ["Chikmagalur"],
        "Mysuru": ["Mysore"],
        "Bengaluru": ["Bangalore"],
        "Bengaluru Urban": ["Bangalore Urban"],
        "Bengaluru Rural": ["Bangalore Rural"],
        "Kalyana Karnataka": ["Hyderabad Karnataka"],
    }
    for modern, olds in synonyms.items():
        if base.lower() == modern.lower():
            for o in olds:
                variants.update({o, o.title(), o.upper()})
        for o in olds:
            if base.lower() == o.lower():
                variants.update({modern, modern.title(), modern.upper()})
    return list(variants)


class CountryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Country.objects.all().order_by('name')
    serializer_class = CountrySerializer


class StateViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StateSerializer

    def get_queryset(self):
        # Optimize nested serializer (State -> Country) to avoid N+1
        queryset = State.objects.select_related('country').all().order_by('name')
        country_param = (
            self.request.query_params.get('country')
            or self.request.query_params.get('country_id')
            or self.request.query_params.get('countryId')
        )
        if country_param:
            try:
                queryset = queryset.filter(country_id=int(str(country_param).strip()))
            except Exception:
                # Invalid id -> empty set to avoid full table scan / DB errors
                queryset = queryset.none()

        # Optional lightweight limiting for large states lists
        limit = self.request.query_params.get('limit')
        if limit and str(limit).isdigit():
            queryset = queryset[:int(limit)]
        return queryset


class CityViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CitySerializer

    def get_queryset(self):
        # Optimize nested serializer (City -> State -> Country) to avoid N+1s
        queryset = City.objects.select_related('state', 'state__country').all().order_by('name')

        # Optional name filter for client-side typeahead
        q = (self.request.query_params.get('q') or '').strip()

        # Accept multiple param shapes: state, state_id, stateId, or state_name
        state_param = (
            self.request.query_params.get('state')
            or self.request.query_params.get('state_id')
            or self.request.query_params.get('stateId')
            or self.request.query_params.get('state_name')
        )
        s = str(state_param).strip() if state_param is not None else ''

        # Require either a state filter or a search query to avoid full-table scans
        if s:
            if s.isdigit():
                try:
                    queryset = queryset.filter(state_id=int(s))
                except Exception:
                    queryset = queryset.none()
            else:
                # Fallback by state name (case-insensitive)
                queryset = queryset.filter(state__name__iexact=s)
        elif not q:
            return City.objects.none()

        if q:
            queryset = queryset.filter(name__icontains=q)

        # Limit results by default to keep responses fast; override with ?all=1 or set ?limit=...
        limit = (self.request.query_params.get('limit') or '').strip()
        all_flag = (self.request.query_params.get('all') or '').strip().lower() in ('1', 'true', 'yes')
        if limit.isdigit():
            queryset = queryset[:int(limit)]
        elif not all_flag:
            queryset = queryset[:500]

        return queryset


@api_view(["POST", "GET"])
@permission_classes([AllowAny])
def reverse_geocode(request):
    """
    Resolve lat/lon to address fields using free services:
    - OpenStreetMap Nominatim (reverse geocode)
    - India Post (api.postalpincode.in) to enrich pincode metadata (best-effort)
    Returns: pincode, village, gram_panchayat (best-effort via Block), city, state, country
    """
    try:
        if request.method == "POST":
            lat = float(request.data.get("lat"))
            lon = float(request.data.get("lon"))
        else:
            lat = float(request.query_params.get("lat"))
            lon = float(request.query_params.get("lon"))
    except (TypeError, ValueError):
        return Response({"detail": "lat and lon are required as numbers"}, status=status.HTTP_400_BAD_REQUEST)

    # Call Nominatim
    nominatim_url = "https://nominatim.openstreetmap.org/reverse"
    headers = {
        # Per Nominatim usage policy, include a valid identifying UA with contact
        "User-Agent": "TrikonektApp/1.0 (contact: admin@trikonekt.local)",
        "Accept-Language": "en-IN"
    }
    params = {
        "format": "jsonv2",
        "lat": lat,
        "lon": lon,
        "addressdetails": 1,
        "zoom": 18,
    }

    nominatim_ok = False
    postal_ok = False
    address = {}
    pincode = None
    village = None
    city = None
    district = None
    state = None
    country = None
    gram_panchayat = None
    postal_raw = None
    nominatim_raw = None

    try:
        r = session.get(nominatim_url, params=params, headers=headers, timeout=8)
        if r.status_code == 200:
            data = r.json()
            nominatim_raw = data
            address = data.get("address", {}) or {}

            # Extract fields with sensible fallbacks
            pincode = address.get("postcode")
            village = (
                address.get("village")
                or address.get("hamlet")
                or address.get("suburb")
                or address.get("locality")
            )
            city = (
                address.get("city")
                or address.get("town")
                or address.get("municipality")
                or address.get("district")
                or address.get("state_district")
                or address.get("county")
            )
            district = (
                address.get("district")
                or address.get("state_district")
                or address.get("county")
            )
            state = address.get("state")
            country = address.get("country")
            nominatim_ok = True
    except Exception:
        nominatim_ok = False

    # If we have a pincode, enrich via India Post
    if pincode:
        try:
            pr = session.get(f"https://api.postalpincode.in/pincode/{pincode}", headers=POSTAL_HEADERS, timeout=8)
            if pr.status_code == 200:
                arr = pr.json()
                if isinstance(arr, list) and arr:
                    entry = arr[0] or {}
                    postal_raw = entry
                    if entry.get("Status") == "Success":
                        offices = entry.get("PostOffice") or []
                        if isinstance(offices, list) and offices:
                            po = offices[0]  # Best-effort pick first
                            # Gram Panchayat is not explicitly provided; use Block when available (common mapping)
                            gram_panchayat = po.get("Block") or po.get("Taluk") or gram_panchayat
                            # Fill missing city/state from India Post if Nominatim lacked them
                            if not city:
                                city = po.get("District") or city
                            if not state:
                                state = po.get("State") or state
                            if not country:
                                country = po.get("Country") or country
                            district = district or po.get("District")
                            postal_ok = True
        except Exception:
            postal_ok = False

    result = {
        "lat": lat,
        "lon": lon,
        "pincode": pincode,
        "village": village,
        "gram_panchayat": gram_panchayat,
        "city": city,
        "district": district,
        "state": state,
        "country": country,
        "source": {
            "nominatim_ok": nominatim_ok,
            "postal_ok": postal_ok,
        },
    }

    # Include raw sources only in DEBUG-like scenarios? Keep minimal to reduce payload
    return Response(result, status=status.HTTP_200_OK)

@api_view(["GET"])
@permission_classes([AllowAny])
def debug_counts(request):
    """
    Local-only: show counts of Country/State/City to verify data loaded.
    """
    if not getattr(settings, "DEBUG", False):
        return Response({"detail": "Not available in production."}, status=status.HTTP_403_FORBIDDEN)
    return Response({
        "countries": Country.objects.count(),
        "states": State.objects.count(),
        "cities": City.objects.count(),
    }, status=status.HTTP_200_OK)

# District -> pincodes lookup using offline cache with in-memory index
DISTRICT_INDEX = None

def _build_district_index():
    global DISTRICT_INDEX
    if DISTRICT_INDEX is not None:
        return DISTRICT_INDEX
    idx = {}
    try:
        raw = _unwrap_records(PINCODES_OFFLINE or {})

        def add_record(pin_val, state_val, district_val):
            try:
                pin_s = str(pin_val or "").strip()
                # keep only digits; ensure 6-digit pincode
                pin_s = "".join(c for c in pin_s if c.isdigit())
                if len(pin_s) != 6:
                    return
                d = (district_val or "").strip()
                s = (state_val or "").strip()
                if not d:
                    return
                # normalize common suffix
                if d.lower().endswith(" district"):
                    d = d[:-8].strip()
                dkey = d.lower()
                skey = s.lower()
                key = (skey, dkey)
                sset = idx.get(key)
                if sset is None:
                    sset = set()
                    idx[key] = sset
                sset.add(pin_s)
                # also index without state to allow district-only lookups
                key2 = ("", dkey)
                sset2 = idx.get(key2)
                if sset2 is None:
                    sset2 = set()
                    idx[key2] = sset2
                sset2.add(pin_s)
            except Exception:
                pass

        if isinstance(raw, dict):
            # Assume dict keyed by pincode -> meta
            for k, meta in raw.items():
                try:
                    if not isinstance(meta, dict):
                        continue
                    state = (
                        meta.get("statename") or meta.get("stateName") or meta.get("STATE_NAME")
                        or meta.get("state") or meta.get("State") or meta.get("STATE") or ""
                    ).strip()
                    district = (
                        meta.get("district") or meta.get("District") or meta.get("DISTRICT")
                        or meta.get("city") or meta.get("City") or ""
                    )
                    add_record(k, state, district)
                    # some datasets also include pincode inside the meta object
                    alt_pin = meta.get("pincode") or meta.get("Pincode") or meta.get("PIN") or meta.get("Pin")
                    if alt_pin and str(alt_pin) != str(k):
                        add_record(alt_pin, state, district)
                except Exception:
                    continue
        elif isinstance(raw, list):
            for row in raw:
                try:
                    if not isinstance(row, dict):
                        continue
                    pin = row.get("pincode") or row.get("Pincode") or row.get("PIN") or row.get("Pin")
                    state = (
                        row.get("statename") or row.get("stateName") or row.get("STATE_NAME")
                        or row.get("state") or row.get("State") or row.get("STATE")
                    )
                    district = (
                        row.get("district") or row.get("District") or row.get("DISTRICT")
                        or row.get("city") or row.get("City")
                    )
                    add_record(pin, state, district)
                except Exception:
                    continue
        else:
            # Unknown format; leave index empty
            pass
    except Exception:
        idx = {}
    DISTRICT_INDEX = idx
    return DISTRICT_INDEX

def _scan_raw_for_pincodes(district_name: str, state_name: str):
    """
    Fallback scan over raw PINCODES_OFFLINE for datasets that are wrapped or not captured by the index.
    Matches district by synonyms and case-insensitive equals; filters by state when provided.
    """
    try:
        raw = _unwrap_records(PINCODES_OFFLINE or {})

        # normalize inputs
        st_filter = (state_name or "").strip().lower()
        # create variant set for district, remove optional " district" suffix
        def _norm_d(s: str):
            s = (s or "").strip()
            if s.lower().endswith(" district"):
                s = s[:-8].strip()
            return s.lower()

        variants = set(_norm_d(x) for x in (india_place_variants(district_name) or [district_name]))
        if not variants:
            return set()

        pins = set()

        def consider(pin_val, state_val, district_val):
            # state filter
            sv = (state_val or "").strip().lower()
            if st_filter and sv and st_filter != sv:
                return
            dv = _norm_d(district_val)
            if not dv:
                return
            if dv in variants:
                pin_s = "".join(c for c in str(pin_val or "").strip() if c.isdigit())
                if len(pin_s) == 6:
                    pins.add(pin_s)

        if isinstance(raw, dict):
            # dict keyed by pincode -> meta
            for k, meta in raw.items():
                if not isinstance(meta, dict):
                    continue
                pin = k
                state = (
                    meta.get("statename") or meta.get("stateName") or meta.get("STATE_NAME")
                    or meta.get("state") or meta.get("State") or meta.get("STATE")
                )
                district = (
                    meta.get("district") or meta.get("District") or meta.get("DISTRICT")
                    or meta.get("city") or meta.get("City")
                )
                consider(pin, state, district)
                alt_pin = meta.get("pincode") or meta.get("Pincode") or meta.get("PIN") or meta.get("Pin")
                if alt_pin and str(alt_pin) != str(pin):
                    consider(alt_pin, state, district)
        elif isinstance(raw, list):
            for row in raw:
                if not isinstance(row, dict):
                    continue
                pin = row.get("pincode") or row.get("Pincode") or row.get("PIN") or row.get("Pin")
                state = (
                    row.get("statename") or row.get("stateName") or row.get("STATE_NAME")
                    or row.get("state") or row.get("State") or row.get("STATE")
                )
                district = (
                    row.get("district") or row.get("District") or row.get("DISTRICT")
                    or row.get("city") or row.get("City")
                )
                consider(pin, state, district)
        else:
            # unknown format
            return set()

        # If still empty, attempt fuzzy on district field values present
        if not pins:
            try:
                import difflib
                # collect all distinct district values under (optional) state
                dvals = set()
                # re-iterate minimally to collect district names
                if isinstance(raw, dict):
                    for _, meta in raw.items():
                        if not isinstance(meta, dict):
                            continue
                        sv = (meta.get("statename") or meta.get("stateName") or meta.get("STATE_NAME")
                              or meta.get("state") or meta.get("State") or meta.get("STATE") or "")
                        if st_filter and sv.strip().lower() != st_filter:
                            continue
                        dv = _norm_d(meta.get("district") or meta.get("District") or meta.get("DISTRICT")
                                     or meta.get("city") or meta.get("City") or "")
                        if dv:
                            dvals.add(dv)
                elif isinstance(raw, list):
                    for row in raw:
                        if not isinstance(row, dict):
                            continue
                        sv = (row.get("statename") or row.get("stateName") or row.get("STATE_NAME")
                              or row.get("state") or row.get("State") or row.get("STATE") or "")
                        if st_filter and sv.strip().lower() != st_filter:
                            continue
                        dv = _norm_d(row.get("district") or row.get("District") or row.get("DISTRICT")
                                     or row.get("city") or row.get("City") or "")
                        if dv:
                            dvals.add(dv)
                # try close matches against any variant
                for v in variants:
                    for ck in difflib.get_close_matches(v, list(dvals), n=5, cutoff=0.75):
                        # scan again but only collect rows with dv == ck
                        if isinstance(raw, dict):
                            for k, meta in raw.items():
                                if not isinstance(meta, dict):
                                    continue
                                sv = (meta.get("statename") or meta.get("stateName") or meta.get("STATE_NAME")
                                      or meta.get("state") or meta.get("State") or meta.get("STATE") or "")
                                if st_filter and sv.strip().lower() != st_filter:
                                    continue
                                dv = _norm_d(meta.get("district") or meta.get("District") or meta.get("DISTRICT")
                                             or meta.get("city") or meta.get("City") or "")
                                if dv != ck:
                                    continue
                                p = meta.get("pincode") or meta.get("Pincode") or meta.get("PIN") or meta.get("Pin") or k
                                consider(p, sv, dv)
                        else:
                            for row in raw:
                                if not isinstance(row, dict):
                                    continue
                                sv = (row.get("statename") or row.get("stateName") or row.get("STATE_NAME")
                                      or row.get("state") or row.get("State") or row.get("STATE") or "")
                                if st_filter and sv.strip().lower() != st_filter:
                                    continue
                                dv = _norm_d(row.get("district") or row.get("District") or row.get("DISTRICT")
                                             or row.get("city") or row.get("City") or "")
                                if dv != ck:
                                    continue
                                p = row.get("pincode") or row.get("Pincode") or row.get("PIN") or row.get("Pin")
                                consider(p, sv, dv)
            except Exception:
                pass

        return pins
    except Exception:
        return set()

@api_view(["GET"])
@permission_classes([AllowAny])
def pincodes_by_district(request):
    """
    Return unique list of pincodes for a given district (optionally narrowed by state).
    Query params:
      - district_name: required (string)
      - state_name: optional (string)
      - state_id: optional (numeric, will be resolved to state_name if provided)
    """
    district_name = (request.query_params.get("district_name") or "").strip()
    state_name = (request.query_params.get("state_name") or "").strip()
    state_id = (request.query_params.get("state_id") or "").strip()
    if not district_name:
        return Response({"detail": "district_name is required"}, status=status.HTTP_400_BAD_REQUEST)

    # Resolve state name from id when provided
    if state_id and not state_name:
        try:
            st = State.objects.filter(pk=state_id).first()
            if st:
                state_name = st.name or ""
        except Exception:
            pass

    idx = _build_district_index()
    variants = india_place_variants(district_name) or [district_name]
    pins = set()
    skey = (state_name or "").strip().lower()
    for d in variants:
        dkey = (d or "").strip().lower()
        if skey:
            pins.update(idx.get((skey, dkey), set()))
        # Also allow district-only matches (when state not provided or no hits with state)
        pins.update(idx.get(("", dkey), set()))

    # Fuzzy fallback for near-miss spellings (e.g., "Kalaburgi" vs "Kalaburagi")
    if not pins:
      try:
        import difflib
        # consider district keys available under given state or globally
        available_dkeys = set(d for s, d in idx.keys() if (not skey or s == skey or s == ""))
        # try fuzzy match against each variant
        for d in variants:
            dkey = (d or "").strip().lower()
            close = difflib.get_close_matches(dkey, list(available_dkeys), n=5, cutoff=0.75)
            for ck in close:
                if skey:
                    pins.update(idx.get((skey, ck), set()))
                pins.update(idx.get(("", ck), set()))
      except Exception:
        pass

    if not pins:
        # Deep scan fallback for datasets wrapped in containers or with fields not accounted in index
        pins = _scan_raw_for_pincodes(district_name, state_name)

    # Additional offline fallback: match PostOffice names (officename/Name) against the provided place
    # This helps when UI passes a Taluk/City name like "Chincholi" whereas the dataset's "district" is "Kalaburagi".
    if not pins:
        try:
            raw = _unwrap_records(PINCODES_OFFLINE or {})
            st_filter = (state_name or "").strip().lower()

            # Build ordered, de-duplicated variants of the provided place
            seen = set()
            ordered_variants = []
            for t in (india_place_variants(district_name) or [district_name]):
                key = (t or "").strip().lower()
                if key and key not in seen:
                    seen.add(key)
                    ordered_variants.append(key)

            def _state_ok(meta_state):
                sv = (str(meta_state or "")).strip().lower()
                return (not st_filter) or (not sv) or (sv == st_filter)

            def _match_office(val: str) -> bool:
                s = (str(val or "")).strip().lower()
                if not s:
                    return False
                for v in ordered_variants:
                    if s == v or v in s:
                        return True
                return False

            tmp = set()
            if isinstance(raw, dict):
                for k, meta in raw.items():
                    if not isinstance(meta, dict):
                        continue
                    if not _state_ok(meta.get("statename") or meta.get("stateName") or meta.get("STATE_NAME") or meta.get("state") or meta.get("State") or meta.get("STATE")):
                        continue
                    office = meta.get("officename") or meta.get("OfficeName") or meta.get("name") or meta.get("Name")
                    if _match_office(office):
                        p = meta.get("pincode") or meta.get("Pincode") or meta.get("PIN") or meta.get("Pin") or k
                        pstr = "".join(c for c in str(p or "").strip() if c.isdigit())
                        if len(pstr) == 6:
                            tmp.add(pstr)
            elif isinstance(raw, list):
                for row in raw:
                    if not isinstance(row, dict):
                        continue
                    if not _state_ok(row.get("statename") or row.get("stateName") or row.get("STATE_NAME") or row.get("state") or row.get("State") or row.get("STATE")):
                        continue
                    office = row.get("officename") or row.get("OfficeName") or row.get("name") or row.get("Name")
                    if _match_office(office):
                        p = row.get("pincode") or row.get("Pincode") or row.get("PIN") or row.get("Pin")
                        pstr = "".join(c for c in str(p or "").strip() if c.isdigit())
                        if len(pstr) == 6:
                            tmp.add(pstr)
            if tmp:
                pins = tmp
        except Exception:
            pass

    if not pins:
        # Network fallback: query India Post by district variants and collect pincodes
        try:
            # preserve order while deduplicating
            seen = set()
            ordered_variants = []
            for t in (variants or [district_name]):
                key = (t or "").strip().lower()
                if key and key not in seen:
                    seen.add(key)
                    ordered_variants.append(t)

            for place in ordered_variants:
                try:
                    r = session.get(f"https://api.postalpincode.in/postoffice/{quote(place)}", headers=POSTAL_HEADERS, timeout=10)
                    if r.status_code == 200:
                        arr = r.json()
                        if isinstance(arr, list) and arr:
                            entry = arr[0] or {}
                            if entry.get("Status") == "Success":
                                offices = entry.get("PostOffice") or []
                                for po in offices:
                                    st = (po.get("State") or "").strip().lower()
                                    if skey and st and st != skey:
                                        continue
                                    p = "".join(c for c in str(po.get("Pincode") or "").strip() if c.isdigit())
                                    if len(p) == 6:
                                        pins.add(p)
                    if pins:
                        break
                except Exception:
                    continue
        except Exception:
            pass

    out = sorted(pins)
    payload = {
        "district": district_name,
        "state": state_name,
        "pincodes": out
    }
    if request.query_params.get("debug"):
        payload["debug"] = {
            "variants": variants,
            "state_key": skey,
            "index_size": len(idx or {}),
            "index_hits": len(pins),
        }
    return Response(payload, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def postoffice_search(request):
    """
    Search India Post PostOffice directory by place name and optionally filter by pincode.
    Query params:
      - q: required, place text (village/town/district)
      - pin: optional, 6-digit pincode to filter results
    Returns offices list and suggestion arrays (villages, gram_panchayats).
    """
    q = (request.query_params.get("q") or "").strip()
    pin = (request.query_params.get("pin") or "").strip()

    if not q:
        return Response({"detail": "q is required"}, status=status.HTTP_400_BAD_REQUEST)

    offices_out = []
    villages = []
    gram_panchayats = []
    postal_ok = False
    message = None

    try:
        r = session.get(f"https://api.postalpincode.in/postoffice/{quote(q)}", headers=POSTAL_HEADERS, timeout=10)
        if r.status_code == 200:
            arr = r.json()
            if isinstance(arr, list) and arr:
                entry = arr[0] or {}
                if entry.get("Status") == "Success":
                    offices = entry.get("PostOffice") or []
                    # Optional pin filter
                    if pin and pin.isdigit() and len(pin) == 6:
                        offices = [po for po in offices if (po.get("Pincode") == pin)]
                    for po in offices:
                        offices_out.append({
                            "name": po.get("Name"),
                            "branch_type": po.get("BranchType"),
                            "delivery_status": po.get("DeliveryStatus"),
                            "block": po.get("Block"),
                            "taluk": po.get("Taluk"),
                            "district": po.get("District"),
                            "state": po.get("State"),
                            "country": po.get("Country"),
                            "pincode": po.get("Pincode"),
                            "division": po.get("Division"),
                            "region": po.get("Region"),
                            "circle": po.get("Circle"),
                        })
                    villages = sorted({po.get("Name") for po in offices if po.get("Name")})
                    gram_panchayats = sorted({(po.get("Block") or po.get("Taluk")) for po in offices if (po.get("Block") or po.get("Taluk"))})
                    postal_ok = True
                else:
                    message = entry.get("Message") or "No data"
    except Exception:
        message = "Lookup failed"

    return Response({
        "offices": offices_out,
        "villages": villages,
        "gram_panchayats": gram_panchayats,
        "message": message,
        "source": {"postal_ok": postal_ok}
    }, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def pincode_lookup(request, pin: str):
    """
    Resolve Indian PIN code using India Post API.
    Returns:
      - Aggregated city/district/state/country and best-effort gram_panchayat
      - Full list of post offices for selection
      - Suggestion arrays: villages, gram_panchayats
    Always returns 200 for valid 6-digit pincode, with source.postal_ok indicating success.
    """
    pin = (pin or "").strip()
    if not pin.isdigit() or len(pin) != 6:
        return Response({"detail": "Invalid pincode. Must be 6 digits."}, status=status.HTTP_400_BAD_REQUEST)

    postal_ok = False
    offline_ok = False
    pincode = pin
    offices_out = []
    villages = []
    gram_panchayats = []
    gram_panchayat = None
    city = None
    district = None
    state = None
    country = None
    message = None

    # Offline-first fast path to avoid slow external lookups and make the endpoint responsive
    offline = PINCODES_OFFLINE.get(pin)
    if offline:
        district = district or offline.get("district")
        state = state or offline.get("state")
        country = country or offline.get("country")
        offices_out = offline.get("post_offices") or offices_out
        villages = offline.get("villages") or villages
        gram_panchayats = offline.get("gram_panchayats") or gram_panchayats
        offline_ok = True
        if not message:
            message = "Filled from offline cache"

        result = {
            "lat": None,
            "lon": None,
            "pincode": pincode,
            "village": None,
            "gram_panchayat": gram_panchayat,
            "city": city,
            "district": district,
            "state": state,
            "country": country,
            "post_offices": offices_out,
            "villages": villages,
            "gram_panchayats": gram_panchayats,
            "message": message,
            "source": {
                "nominatim_ok": False,
                "postal_ok": False,
                "offline_ok": offline_ok
            },
        }
        return Response(result, status=status.HTTP_200_OK)

    try:
        pr = session.get(f"https://api.postalpincode.in/pincode/{pin}", headers=POSTAL_HEADERS, timeout=15)
        if pr.status_code == 200:
            arr = pr.json()
            if isinstance(arr, list) and arr:
                entry = arr[0] or {}
                if entry.get("Status") == "Success":
                    offices = entry.get("PostOffice") or []
                    if isinstance(offices, list):
                        for po in offices:
                            offices_out.append({
                                "name": po.get("Name"),
                                "branch_type": po.get("BranchType"),
                                "delivery_status": po.get("DeliveryStatus"),
                                "block": po.get("Block"),
                                "taluk": po.get("Taluk"),
                                "district": po.get("District"),
                                "state": po.get("State"),
                                "country": po.get("Country"),
                                "pincode": po.get("Pincode"),
                                "division": po.get("Division"),
                                "region": po.get("Region"),
                                "circle": po.get("Circle"),
                            })
                        # Unique suggestion lists
                        villages = sorted({po.get("Name") for po in offices if po.get("Name")})
                        gram_panchayats = sorted({(po.get("Block") or po.get("Taluk")) for po in offices if (po.get("Block") or po.get("Taluk"))})
                        # Defaults from first office if available
                        if offices:
                            first = offices[0]
                            gram_panchayat = first.get("Block") or first.get("Taluk") or None
                            district = first.get("District") or None
                            city = district or None
                            state = first.get("State") or None
                            country = first.get("Country") or None
                        postal_ok = True
                else:
                    message = entry.get("Message") or "No data for this pincode"
    except Exception as e:
        message = f"Lookup failed: {type(e).__name__}"

    # Fallback: try Nominatim search by postal code if India Post data missing
    if not postal_ok:
        try:
            nom_headers = {
                "User-Agent": "TrikonektApp/1.0 (contact: admin@trikonekt.local)",
                "Accept-Language": "en-IN",
            }
            nom_params = {
                "format": "jsonv2",
                "postalcode": pin,
                "countrycodes": "in",
                "addressdetails": 1,
                "limit": 50,
            }
            sr = session.get("https://nominatim.openstreetmap.org/search", params=nom_params, headers=nom_headers, timeout=15)
            if sr.status_code == 200:
                arr = sr.json() or []
                # Collect suggestions and best-guess region info
                vset = set()
                gpset = set()
                dist = None
                st = None
                ctry = None
                city_guess = None
                for item in arr:
                    addr = (item.get("address") or {})
                    v = addr.get("village") or addr.get("hamlet") or addr.get("suburb") or addr.get("locality") or item.get("name")
                    if v:
                        vset.add(v)
                    # Gram panchayat rarely present in OSM; attempt to use 'block' if available
                    gp = addr.get("block") or None
                    if gp:
                        gpset.add(gp)
                    if not dist:
                        dist = addr.get("district") or addr.get("state_district") or addr.get("county") or dist
                    if not st:
                        st = addr.get("state") or st
                    if not ctry:
                        ctry = addr.get("country") or ctry
                    if not city_guess:
                        city_guess = addr.get("city") or addr.get("town") or addr.get("municipality") or city_guess
                if vset or dist or st or ctry:
                    villages = sorted(vset)
                    gram_panchayats = sorted(gpset)
                    district = district or dist
                    state = state or st
                    country = country or ctry
                    city = city or city_guess or district
                    if not message:
                        message = "Filled from Nominatim"
        except Exception:
            pass

        # Additional OSM fallback using generic query when postalcode filter yields no results
        if not postal_ok and not villages:
            try:
                nom_headers = {
                    "User-Agent": "TrikonektApp/1.0 (contact: admin@trikonekt.local)",
                    "Accept-Language": "en-IN",
                }
                nom_params_q = {
                    "format": "jsonv2",
                    "q": pin,
                    "countrycodes": "in",
                    "addressdetails": 1,
                    "limit": 50,
                }
                sr2 = session.get("https://nominatim.openstreetmap.org/search", params=nom_params_q, headers=nom_headers, timeout=15)
                if sr2.status_code == 200:
                    arr2 = sr2.json() or []
                    vset2 = set()
                    gpset2 = set()
                    dist2 = None
                    st2 = None
                    ctry2 = None
                    city_guess2 = None
                    for item in arr2:
                        addr = (item.get("address") or {})
                        v = addr.get("village") or addr.get("hamlet") or addr.get("suburb") or addr.get("locality") or item.get("name")
                        if v:
                            vset2.add(v)
                        gp = addr.get("block") or None
                        if gp:
                            gpset2.add(gp)
                        if not dist2:
                            dist2 = addr.get("district") or addr.get("state_district") or addr.get("county") or dist2
                        if not st2:
                            st2 = addr.get("state") or st2
                        if not ctry2:
                            ctry2 = addr.get("country") or ctry2
                        if not city_guess2:
                            city_guess2 = addr.get("city") or addr.get("town") or addr.get("municipality") or city_guess2
                    if vset2 or dist2 or st2 or ctry2:
                        villages = villages or sorted(vset2)
                        gram_panchayats = gram_panchayats or sorted(gpset2)
                        district = district or dist2
                        state = state or st2
                        country = country or ctry2
                        city = city or city_guess2 or district
                        if not message:
                            message = "Filled from Nominatim (q)"
            except Exception:
                pass

        # Secondary fallback: search India Post by district/city with synonym variants, then filter by pincode
        if not postal_ok and (district or city):
            try:
                tries = []
                if district:
                    tries.extend(india_place_variants(district))
                if city:
                    tries.extend(india_place_variants(city))
                # De-dup while preserving order
                seen = set()
                ordered_tries = []
                for t in tries:
                    key = t.lower()
                    if key not in seen:
                        seen.add(key)
                        ordered_tries.append(t)

                for place in ordered_tries:
                    pr2 = session.get(f"https://api.postalpincode.in/postoffice/{quote(place)}", headers=POSTAL_HEADERS, timeout=10)
                    if pr2.status_code == 200:
                        arr2 = pr2.json()
                        if isinstance(arr2, list) and arr2:
                            entry2 = arr2[0] or {}
                            if entry2.get("Status") == "Success":
                                offices2 = entry2.get("PostOffice") or []
                                matched = [po for po in offices2 if (po.get("Pincode") == pincode or po.get("Pincode") == pin)]
                                if matched:
                                    offices_out = []
                                    for po in matched:
                                        offices_out.append({
                                            "name": po.get("Name"),
                                            "branch_type": po.get("BranchType"),
                                            "delivery_status": po.get("DeliveryStatus"),
                                            "block": po.get("Block"),
                                            "taluk": po.get("Taluk"),
                                            "district": po.get("District"),
                                            "state": po.get("State"),
                                            "country": po.get("Country"),
                                            "pincode": po.get("Pincode"),
                                            "division": po.get("Division"),
                                            "region": po.get("Region"),
                                            "circle": po.get("Circle"),
                                        })
                                    villages = sorted({po.get("Name") for po in matched if po.get("Name")})
                                    gram_panchayats = sorted({(po.get("Block") or po.get("Taluk")) for po in matched if (po.get("Block") or po.get("Taluk"))})
                                    # Set region info
                                    first = matched[0]
                                    gram_panchayat = gram_panchayat or first.get("Block") or first.get("Taluk") or None
                                    district = district or first.get("District") or None
                                    city = city or district
                                    state = state or first.get("State") or None
                                    country = country or first.get("Country") or None
                                    postal_ok = True
                                    if not message:
                                        message = f"Filled from India Post search for {place}"
                                    break
            except Exception:
                pass

    # Offline fallback when network lookups fail
    if not postal_ok:
        offline = PINCODES_OFFLINE.get(pin) or PINCODES_OFFLINE.get(pincode)
        if offline:
            district = district or offline.get("district")
            state = state or offline.get("state")
            country = country or offline.get("country")
            offices_out = offline.get("post_offices") or offices_out
            villages = offline.get("villages") or villages
            gram_panchayats = offline.get("gram_panchayats") or gram_panchayats
            offline_ok = True
            if not message:
                message = "Filled from offline cache"

    result = {
        "lat": None,
        "lon": None,
        "pincode": pincode,
        "village": None,
        "gram_panchayat": gram_panchayat,
        "city": city,
        "district": district,
        "state": state,
        "country": country,
        "post_offices": offices_out,
        "villages": villages,
        "gram_panchayats": gram_panchayats,
        "message": message,
        "source": {
            "nominatim_ok": False,
            "postal_ok": postal_ok,
            "offline_ok": offline_ok
        },
    }
    return Response(result, status=status.HTTP_200_OK)
