import json
import os
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction, IntegrityError
from django.utils.text import slugify

from accounts.models import CustomUser, AgencyRegionAssignment, UserKYC
from accounts.models import Wallet, WithdrawalRequest  # ensure wallet pre-creation for all users and withdrawals
from business.models import CommissionConfig
from coupons.models import Coupon, CouponBatch, CouponCode, CouponSubmission
from locations.models import Country, State, City

# Activation services
from business.services.activation import (
    activate_150_active,
    activate_50,
    redeem_150,
    ensure_first_purchase_activation,
    product_purchase_activations,
)

# Utilities


def _project_backend_dir() -> Path:
    # backend/accounts/management/commands/seed_full_demo.py -> backend/
    return Path(__file__).resolve().parents[3]


def _load_pincode_file() -> list:
    """
    Load pincodes_offline.json and normalize it to a flat list[dict] of records.
    Handles common CKAN/data-portal shapes like {"result":{"records":[...]}},
    {"records":[...]}, {"data":[...]}, and picks the first list-of-dicts if present.
    """
    p = _project_backend_dir() / "locations" / "data" / "pincodes_offline.json"
    if not p.exists():
        raise CommandError(f"pincodes_offline.json not found at: {p}")
    with p.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    # Already a list of records
    if isinstance(raw, list):
        return raw

    # Dict-based containers
    if isinstance(raw, dict):
        # Direct common keys
        for key in ("records", "data", "rows", "items"):
            val = raw.get(key)
            if isinstance(val, list) and val and isinstance(val[0], dict):
                return val
        # CKAN-like: {"result":{"records":[...]}} or similar
        result = raw.get("result")
        if isinstance(result, dict):
            for key in ("records", "data", "rows", "items"):
                val = result.get(key)
                if isinstance(val, list) and val and isinstance(val[0], dict):
                    return val
        # Fallback: first list-of-dicts in any value
        for _, v in raw.items():
            if isinstance(v, list) and v and isinstance(v[0], dict):
                return v
        # Nothing matched — return a single-record list so caller can still iterate
        return [raw]

    # Unknown shape
    return []


def _get(entry: dict, keys: Iterable[str], default: str = "") -> str:
    """
    Try to fetch a value by any of the provided keys from a record dict.
    - Direct key match (case-sensitive)
    - Case/space/underscore-insensitive match e.g. 'State Name' == 'state_name'
    """
    if not isinstance(entry, dict):
        return default

    # 1) Direct key match
    for k in keys:
        if k in entry and entry[k] is not None:
            return str(entry[k]).strip()

    # 2) Case/space/underscore-insensitive key match
    norm = {}
    for k, v in entry.items():
        if v is None:
            continue
        nk = str(k).strip().lower().replace(" ", "").replace("_", "")
        norm[nk] = v

    for k in keys:
        nk = str(k).strip().lower().replace(" ", "").replace("_", "")
        if nk in norm:
            return str(norm[nk]).strip()

    return default


def _get_state(entry: dict) -> str:
    return _get(
        entry,
        [
            "StateName",
            "state",
            "State",
            "state_name",
            "statename",
            "State Name",
            "stateName",
            "STATE",
            "STATE_NAME",
        ],
    )


def _get_district(entry: dict) -> str:
    return _get(
        entry,
        [
            "DistrictName",
            "district",
            "District",
            "district_name",
            "districtname",
            "District Name",
            "districtName",
            "DISTRICT",
            "DISTRICT_NAME",
        ],
    )


def _get_pincode(entry: dict) -> str:
    return _get(entry, ["Pincode", "pincode", "PinCode", "PINCODE", "pin", "PIN"])


def _fold_ascii(s: str) -> str:
    """
    Fold unicode accents/diacritics and lowercase the string for robust comparisons.
    """
    import unicodedata
    if not s:
        return ""
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(ch for ch in nfkd if not unicodedata.combining(ch)).lower()


def _normalize_state_name(name: str) -> str:
    # Handle common variations + diacritics
    raw = (name or "").strip()
    s = _fold_ascii(raw)
    mapping = {
        "karnataka": "Karnataka",
        "ka": "Karnataka",
        "maharashtra": "Maharashtra",
        "mh": "Maharashtra",
    }
    if s in mapping:
        return mapping[s]
    # Fuzzy fallback
    if s.startswith("karna"):
        return "Karnataka"
    if s.startswith("maha"):
        return "Maharashtra"
    return raw.strip().title()


def _normalize_district_name(name: str) -> str:
    """
    Normalize district names to handle legacy/alias spellings so matching works.
    Examples:
      - Belgaum -> Belagavi
      - Bijapur -> Vijayapura
      - Gulbarga -> Kalaburagi
      - Bangalore/Bangaluru -> Bengaluru (and specific Urban/Rural forms)
    Returns lowercase canonical form.
    """
    s = _fold_ascii(name or "").strip().lower()
    mapping = {
        "belgaum": "belagavi",
        "bijapur": "vijayapura",
        "gulbarga": "kalaburagi",
        "bangalore": "bengaluru",
        "bengaluru": "bengaluru",
        "bengaluru urban": "bengaluru urban",
        "bangalore urban": "bengaluru urban",
        "bengaluru rural": "bengaluru rural",
        "bangalore rural": "bengaluru rural",
    }
    # Basic mapping
    if s in mapping:
        return mapping[s]
    # If it contains bengaluru/bangalore plus qualifier, normalize
    if "bengaluru" in s or "bangalore" in s:
        if "urban" in s:
            return "bengaluru urban"
        if "rural" in s:
            return "bengaluru rural"
        return "bengaluru"
    return s


def _is_district_selected(dist_raw: str, wanted: Set[str]) -> bool:
    """
    Return True if the given district should be included based on the wanted set.
    Robust to legacy names and generic 'Bangalore/Bengaluru' vs Urban/Rural specifics.
    """
    if not wanted:
        return True
    d = (dist_raw or "").strip().lower()
    dn = _normalize_district_name(d)
    if dn in wanted:
        return True
    # If generic Bengaluru/Bangalore, accept if either Urban or Rural was requested
    if dn in ("bengaluru", "bangalore"):
        if any(w.startswith("bengaluru") or w.startswith("bangalore") for w in wanted):
            return True
    # Legacy synonyms already normalized above
    return False


def _match_any(name: str, wanted: Set[str]) -> bool:
    n = (name or "").strip().lower()
    return n in wanted


DEFAULT_KA_DISTRICTS = [
    "Kalaburagi",
    "Vijayapura",
    "Bengaluru Urban",
    "Bengaluru Rural",
    "Belagavi",
    "Bagalkot",
    "Raichur",
]


class Command(BaseCommand):
    help = "Seed full demo data: locations, agency hierarchy, users, coupons, and sample activations."

    def add_arguments(self, parser):
        parser.add_argument(
            "--states",
            type=str,
            default="KA,MH",
            help="Comma-separated: KA,MH",
        )
        parser.add_argument(
            "--districts",
            type=str,
            default=",".join(DEFAULT_KA_DISTRICTS),
            help="Comma-separated list for Karnataka. Example: 'Kalaburagi,Vijayapura,Bengaluru Urban,Bengaluru Rural,Belagavi,Bagalkot,Raichur'",
        )
        parser.add_argument(
            "--per_pincode_agencies",
            type=int,
            default=1,
            help="Number of agency triplets per pincode (pincode, pincode_coord, sub_franchise) to create per pincode.",
        )
        parser.add_argument(
            "--employees_per_pincode",
            type=int,
            default=2,
            help="Number of employees per pincode.",
        )
        parser.add_argument(
            "--consumers_per_employee",
            type=int,
            default=5,
            help="Number of consumers registered under each employee.",
        )
        # Extended hierarchy controls
        parser.add_argument(
            "--subfranchises_per_pincode",
            type=int,
            default=0,
            help="If >0, create this many sub-franchises per pincode (overrides single subfranchise flow).",
        )
        parser.add_argument(
            "--employees_per_subfranchise",
            type=int,
            default=0,
            help="If >0, create this many employees under each sub-franchise.",
        )
        parser.add_argument(
            "--consumers_per_subfranchise",
            type=int,
            default=0,
            help="If >0, create this many consumers directly under each sub-franchise (agency).",
        )
        parser.add_argument(
            "--ecoupons_per_employee",
            type=int,
            default=5,
            help="Number of e-coupons (150 and 50 combined) per employee to generate and assign to the employee.",
        )
        parser.add_argument(
            "--activate_150",
            type=int,
            default=2,
            help="Number of consumers per district to 150-Activate.",
        )
        parser.add_argument(
            "--redeem_150",
            type=int,
            default=2,
            help="Number of consumers per district to 150-Redeem.",
        )
        parser.add_argument(
            "--activate_50",
            type=int,
            default=2,
            help="Number of consumers per district to 50-Activate.",
        )
        parser.add_argument(
            "--purchases",
            type=int,
            default=0,
            help="Number of product purchase activations (3-matrix) per district (simulated via service).",
        )
        parser.add_argument(
            "--mh_minimal",
            type=int,
            default=1,
            help="If set (1), create only Maharashtra state coordinator (no districts/pincodes).",
        )
        parser.add_argument(
            "--password",
            type=str,
            default="Test@123",
            help="Default password for all created users.",
        )
        parser.add_argument(
            "--max_pincodes_per_district",
            type=int,
            default=0,
            help="Safety cap. 0 = no cap. If >0, limits pincodes per district.",
        )
        parser.add_argument(
            "--district_coordinators_per_district",
            type=int,
            default=4,
            help="Number of District Coordinators to create per district (default 4).",
        )
        parser.add_argument(
            "--use_ec100_batch_flow",
            type=int,
            default=1,
            help="If 1, create EC100 codes via pincode agency and distribute to employees; employees assign to consumers.",
        )

    def handle(self, *args, **opts):
        states_arg = [s.strip().upper() for s in (opts["states"] or "").split(",") if s.strip()]
        want_KA = "KA" in states_arg
        want_MH = "MH" in states_arg

        ka_districts_input = [d.strip() for d in (opts["districts"] or "").split(",") if d.strip()]
        districts_wanted_set = set(_normalize_district_name(d).lower() for d in ka_districts_input)

        per_pincode_agencies = int(opts["per_pincode_agencies"])
        employees_per_pincode = int(opts["employees_per_pincode"])
        consumers_per_employee = int(opts["consumers_per_employee"])
        subfranchises_per_pincode = int(opts.get("subfranchises_per_pincode") or 0)
        employees_per_subfranchise = int(opts.get("employees_per_subfranchise") or 0)
        consumers_per_subfranchise = int(opts.get("consumers_per_subfranchise") or 0)
        ecoupons_per_employee = int(opts["ecoupons_per_employee"])
        do_act150 = int(opts["activate_150"])
        do_red150 = int(opts["redeem_150"])
        do_act50 = int(opts["activate_50"])
        do_purchases = int(opts["purchases"])
        mh_minimal = bool(int(opts["mh_minimal"]))
        default_password = str(opts["password"])
        max_pincodes_per_district = int(opts["max_pincodes_per_district"])
        district_coordinators_per_district = int(opts.get("district_coordinators_per_district") or 4)
        use_ec100_batch_flow = bool(int(opts.get("use_ec100_batch_flow") or 1))

        self.stdout.write(self.style.MIGRATE_HEADING("Seeding full demo data..."))

        # Ensure CommissionConfig with sane matrix percents so wallets show payouts
        self._ensure_commission_config()

        # Ensure country and states
        india = self._get_or_create_country("India", iso2="IN")
        st_KA = self._get_or_create_state(india, "Karnataka") if want_KA else None
        st_MH = self._get_or_create_state(india, "Maharashtra") if want_MH else None

        # Root company/superuser-like actor (admin)
        company = self._ensure_company_user(default_password)

        # State Coordinators
        ka_sc = self._ensure_state_coordinator(state=st_KA, username=self._new_phone(), sponsor=company, password=default_password) if st_KA else None
        mh_sc = self._ensure_state_coordinator(state=st_MH, username=self._new_phone(), sponsor=company, password=default_password) if st_MH else None

        # Also create state agency (non-coordinator) as parent for districts
        ka_state_agency = self._ensure_state_agency(state=st_KA, username=self._new_phone(), sponsor=ka_sc or company, password=default_password) if st_KA else None
        mh_state_agency = self._ensure_state_agency(state=st_MH, username=self._new_phone(), sponsor=mh_sc or company, password=default_password) if st_MH else None

        # Maharashtra minimal: stop at state coordinator if requested
        if want_MH and mh_minimal:
            self.stdout.write(self.style.HTTP_INFO("Created Maharashtra state coordinator (minimal mode)."))

        # Load pincodes JSON (heavy file)
        data = _load_pincode_file()

        # Coupons: 150 and 50
        coupon_150 = self._ensure_coupon(code="TR-150", title="TR Active 150", issuer=company)
        coupon_50 = self._ensure_coupon(code="TR-50", title="TR Global 50", issuer=company)
        coupon_100 = self._ensure_coupon(code="TR-100", title="TR Test 100", issuer=company)

        # Create batches (for traceability) - not strictly necessary for all codes
        # We'll still create codes directly assigned to employees as needed.
        # Output CSV of accounts
        accounts_csv: List[str] = []
        accounts_csv.append("username,role,category,state,district,pincode,registered_by,password")

        # Process Karnataka districts and pincodes
        if want_KA:
            self.stdout.write(self.style.HTTP_INFO("Processing Karnataka districts and pincodes..."))
            # Filter pincode entries for Karnataka and wanted districts (robust: accept by state OR by matching requested district)
            ka_entries: List[dict] = []
            for e in data:
                try:
                    st = _normalize_state_name(_get_state(e))
                except Exception:
                    st = ""
                dist_raw = _get_district(e)
                if st == "Karnataka" or _is_district_selected(dist_raw, districts_wanted_set):
                    ka_entries.append(e)

            # group by district -> set of pincodes
            district_to_pins: Dict[str, List[str]] = {}
            fallback_used = False
            for e in ka_entries:
                dist = _get_district(e)
                pin = _get_pincode(e)
                if not dist or not pin:
                    continue
                # match only requested districts (with legacy/synonym handling)
                if not _is_district_selected(dist, districts_wanted_set):
                    continue
                district_to_pins.setdefault(dist, [])
                if pin not in district_to_pins[dist]:
                    district_to_pins[dist].append(pin)

            # Enforce real pincodes only (no synthetic fallback)
            if not district_to_pins:
                raise CommandError("No matching Karnataka pincodes found for the requested districts in pincodes_offline.json. Please verify the dataset and district names.")

            # Write debug of district->pincodes selection
            try:
                dbg_dir = _project_backend_dir() / "fixtures" / "export"
                dbg_dir.mkdir(parents=True, exist_ok=True)
                dbg = {
                    "total_entries_KA": len(ka_entries),
                    "districts_selected": sorted(list(district_to_pins.keys())),
                    "pins_per_district": {k: len(v) for k, v in district_to_pins.items()},
                    "requested_districts": sorted(list(districts_wanted_set)),
                    "fallback_used": fallback_used,
                    "max_pincodes_per_district": max_pincodes_per_district,
                }
                with (dbg_dir / "seed_debug.json").open("w", encoding="utf-8") as f:
                    json.dump(dbg, f, ensure_ascii=False, indent=2)
            except Exception:
                pass
            # Traverse each district
            for dist_name, pins in district_to_pins.items():
                if max_pincodes_per_district > 0:
                    pins = pins[:max_pincodes_per_district]

                # City := District
                city = self._get_or_create_city(st_KA, dist_name)
                dist_slug = slugify(dist_name)
                # District coordinators (count from flag) and district agency
                dist_coords: List[CustomUser] = []
                for _dc_idx in range(int(district_coordinators_per_district or 1)):
                    _dc = self._ensure_user(
                        username=self._new_phone(),
                        role="agency",
                        category="agency_district_coordinator",
                        state=st_KA,
                        city=city,
                        pincode="",
                        registered_by=ka_state_agency or ka_sc or company,
                        password=default_password,
                    )
                    self._ensure_region_assignment(_dc, level="district", state=st_KA, district=dist_name, pincode="")
                    dist_coords.append(_dc)
                dist_coord = dist_coords[0] if dist_coords else self._ensure_user(
                    username=self._new_phone(),
                    role="agency",
                    category="agency_district_coordinator",
                    state=st_KA,
                    city=city,
                    pincode="",
                    registered_by=ka_state_agency or ka_sc or company,
                    password=default_password,
                )
                if not dist_coords:
                    self._ensure_region_assignment(dist_coord, level="district", state=st_KA, district=dist_name, pincode="")

                dist_agency = self._ensure_user(
                    username=self._new_phone(),
                    role="agency",
                    category="agency_district",
                    state=st_KA,
                    city=city,
                    pincode="",
                    registered_by=dist_coord,
                    password=default_password,
                )
                self._ensure_region_assignment(dist_agency, level="district", state=st_KA, district=dist_name, pincode="")

                # Walk through pincodes
                created_emp_for_district: List[CustomUser] = []
                created_cons_for_district: List[CustomUser] = []

                for pin in pins:
                    pin_slug = slugify(pin)
                    # Pincode coordinator and pincode agency
                    apc = self._ensure_user(
                        username=self._new_phone(),
                        role="agency",
                        category="agency_pincode_coordinator",
                        state=st_KA,
                        city=city,
                        pincode=pin,
                        registered_by=dist_agency,
                        password=default_password,
                    )
                    self._ensure_region_assignment(apc, level="pincode", state=st_KA, district=dist_name, pincode=pin)

                    ap = self._ensure_user(
                        username=self._new_phone(),
                        role="agency",
                        category="agency_pincode",
                        state=st_KA,
                        city=city,
                        pincode=pin,
                        registered_by=apc,
                        password=default_password,
                    )
                    self._ensure_region_assignment(ap, level="pincode", state=st_KA, district=dist_name, pincode=pin)

                    # Record accounts for pincode-level agencies
                    accounts_csv.append(f"{apc.username},agency,agency_pincode_coordinator,Karnataka,{dist_name},{pin},{getattr(apc.registered_by,'username','')},{default_password}")
                    accounts_csv.append(f"{ap.username},agency,agency_pincode,Karnataka,{dist_name},{pin},{getattr(ap.registered_by,'username','')},{default_password}")

                    # Sub-franchises and employees/consumers
                    if subfranchises_per_pincode > 0 and employees_per_subfranchise > 0:
                        for s_idx in range(1, subfranchises_per_pincode + 1):
                            sf = self._ensure_user(
                                username=self._new_phone(),
                                role="agency",
                                category="agency_sub_franchise",
                                state=st_KA,
                                city=city,
                                pincode=pin,
                                registered_by=ap,
                                password=default_password,
                            )
                            self._ensure_region_assignment(sf, level="pincode", state=st_KA, district=dist_name, pincode=pin)
                            accounts_csv.append(f"{sf.username},agency,agency_sub_franchise,Karnataka,{dist_name},{pin},{getattr(sf.registered_by,'username','')},{default_password}")
                            # Track employees under this sub-franchise for EC100 distribution
                            sf_employees: List[CustomUser] = []

                            # Employees under this sub-franchise
                            for e_idx in range(1, employees_per_subfranchise + 1):
                                emp = self._ensure_user(
                                username=self._new_phone(),
                                    role="employee",
                                    category="employee",
                                    state=st_KA,
                                    city=city,
                                    pincode=pin,
                                    registered_by=sf,
                                    password=default_password,
                                )
                                created_emp_for_district.append(emp)
                                sf_employees.append(emp)
                                # Add a couple to CSV to keep size sane
                                if e_idx <= 2:
                                    accounts_csv.append(f"{emp.username},employee,employee,Karnataka,{dist_name},{pin},{getattr(emp.registered_by,'username','')},{default_password}")

                                # Consumers under employee
                                for c_idx in range(1, consumers_per_employee + 1):
                                    cons = self._ensure_user(
                                        username=self._new_phone(),
                                        role="user",
                                        category="consumer",
                                        state=st_KA,
                                        city=city,
                                        pincode=pin,
                                        registered_by=emp,
                                        password=default_password,
                                    )
                                    created_cons_for_district.append(cons)

                            # Consumers directly under sub-franchise (agency)
                            for a_idx in range(1, (consumers_per_subfranchise or 0) + 1):
                                cons_ag = self._ensure_user(
                                username=self._new_phone(),
                                    role="user",
                                    category="consumer",
                                    state=st_KA,
                                    city=city,
                                    pincode=pin,
                                    registered_by=sf,
                                    password=default_password,
                                )
                                created_cons_for_district.append(cons_ag)
                            # Distribute EC100 codes from pincode agency to employees (agency -> employee), if enabled
                            if use_ec100_batch_flow and coupon_100:
                                try:
                                    self._ec100_batch_distribute(agency_user=ap, employees=sf_employees, coupon=coupon_100, count_per_employee=ecoupons_per_employee)
                                except Exception:
                                    pass
                    else:
                        # Legacy single sub-franchise + employees_per_pincode path
                        sf = self._ensure_user(
                        username=self._new_phone(),
                            role="agency",
                            category="agency_sub_franchise",
                            state=st_KA,
                            city=city,
                            pincode=pin,
                            registered_by=ap,
                            password=default_password,
                        )
                        self._ensure_region_assignment(sf, level="pincode", state=st_KA, district=dist_name, pincode=pin)
                        accounts_csv.append(f"{sf.username},agency,agency_sub_franchise,Karnataka,{dist_name},{pin},{getattr(sf.registered_by,'username','')},{default_password}")

                        employees: List[CustomUser] = []
                        for i in range(employees_per_pincode):
                            emp = self._ensure_user(
                                username=self._new_phone(),
                                role="employee",
                                category="employee",
                                state=st_KA,
                                city=city,
                                pincode=pin,
                                registered_by=sf,
                                password=default_password,
                            )
                            employees.append(emp)
                            created_emp_for_district.append(emp)

                        for emp in employees:
                            for j in range(consumers_per_employee):
                                cons = self._ensure_user(
                                username=self._new_phone(),
                                    role="user",
                                    category="consumer",
                                    state=st_KA,
                                    city=city,
                                    pincode=pin,
                                    registered_by=emp,
                                    password=default_password,
                                )
                                created_cons_for_district.append(cons)

                        for emp in employees[:2]:  # cap CSV volume
                            accounts_csv.append(f"{emp.username},employee,employee,Karnataka,{dist_name},{pin},{getattr(emp.registered_by,'username','')},{default_password}")

                # Assign e-coupons to employees and simulate flows
                if not use_ec100_batch_flow:
                    self._generate_ecoupons_for_employees(
                        employees=created_emp_for_district,
                        coupon150=coupon_150,
                        coupon50=coupon_50,
                        coupon100=coupon_100,
                        count_per_employee=ecoupons_per_employee,
                    )

                # Activation & Redeem samples (per district)
                self._simulate_activation_flows(
                    consumers=created_cons_for_district,
                    do_act150=do_act150,
                    do_red150=do_red150,
                    do_act50=do_act50,
                )
                if do_purchases > 0:
                    self._simulate_product_purchases(created_cons_for_district, do_purchases)

                # Create KYC for all consumers so withdrawals work
                self._ensure_kyc_for_subset(created_cons_for_district)

                # Sample E-coupon submission approvals path (employee -> agency)
                self._simulate_ecoupon_submission_flow(
                    employees=created_emp_for_district,
                    district_agency=dist_agency,
                    coupon=coupon_100,
                )

                # Simulate withdrawals for a few credited consumers per district
                try:
                    self._simulate_withdrawals(created_cons_for_district, approver=company, per_district=3)
                except Exception:
                    pass

                # Add district users to CSV
                try:
                    all_dcs = [dist_coord] + [d for d in dist_coords[1:]]
                except Exception:
                    all_dcs = [dist_coord]
                for _dc in all_dcs:
                    try:
                        accounts_csv.append(f"{_dc.username},agency,agency_district_coordinator,Karnataka,{dist_name},,{getattr(_dc.registered_by,'username','')},{default_password}")
                    except Exception:
                        pass
                accounts_csv.append(f"{dist_agency.username},agency,agency_district,Karnataka,{dist_name},,{getattr(dist_agency.registered_by,'username','')},{default_password}")

        # Maharashtra (minimal)
        if want_MH and mh_minimal and mh_sc and mh_state_agency:
            accounts_csv.append(f"{mh_sc.username},agency,agency_state_coordinator,Maharashtra,,,{'company'},{default_password}")
            accounts_csv.append(f"{mh_state_agency.username},agency,agency_state,Maharashtra,,,{mh_sc.username},{default_password}")

        # State level users to CSV
        if ka_sc:
            accounts_csv.append(f"{ka_sc.username},agency,agency_state_coordinator,Karnataka,,,{'company'},{default_password}")
        if ka_state_agency:
            accounts_csv.append(f"{ka_state_agency.username},agency,agency_state,Karnataka,,,{getattr(ka_state_agency.registered_by,'username','')},{default_password}")

        # Export accounts CSV
        export_dir = _project_backend_dir() / "fixtures" / "export"
        export_dir.mkdir(parents=True, exist_ok=True)
        csv_path = export_dir / "demo_accounts.csv"
        with csv_path.open("w", encoding="utf-8") as f:
            f.write("\n".join(accounts_csv))
        self.stdout.write(self.style.SUCCESS(f"Accounts CSV written: {csv_path}"))
        # Write summary/debug snapshot of DB after seeding
        try:
            from django.db.models import Count
            total_users = CustomUser.objects.count()
            by_category = {
                row["category"]: row["c"]
                for row in CustomUser.objects.values("category").annotate(c=Count("id")).order_by()
            }
            sample_usernames = list(CustomUser.objects.values_list("username", flat=True)[:20])
            summary = {
                "accounts_csv_len": len(accounts_csv),
                "total_users": total_users,
                "by_category": by_category,
                "sample_usernames": sample_usernames,
            }
            with (export_dir / "seed_summary.json").open("w", encoding="utf-8") as f:
                json.dump(summary, f, ensure_ascii=False, indent=2)
            self.stdout.write(self.style.SUCCESS(f"Summary written: {export_dir / 'seed_summary.json'}"))
        except Exception as e:
            try:
                with (export_dir / "seed_summary_error.txt").open("w", encoding="utf-8") as f:
                    f.write(str(e))
            except Exception:
                pass

        self.stdout.write(self.style.SUCCESS("Seeding complete."))

    # --------------- helpers ---------------

    def _new_phone(self) -> str:
        """
        Generate a unique 10-digit Indian mobile-like number starting with 6-9.
        Ensures uniqueness across existing usernames.
        """
        import random
        while True:
            first = random.choice(["6", "7", "8", "9"])
            rest = "".join(random.choice("0123456789") for _ in range(9))
            phone = first + rest
            if not CustomUser.objects.filter(username=phone).exists():
                return phone

    def _ensure_commission_config(self):
        cfg = CommissionConfig.get_solo()
        # Ensure percents are populated so wallets show payouts
        if not cfg.five_matrix_percents_json:
            cfg.five_matrix_percents_json = [2, 2, 1, 1, 0.5, 0.5]
        if not cfg.three_matrix_percents_json:
            # 15 levels — small amounts each
            cfg.three_matrix_percents_json = [1] * 15
        # For TR-100 test flow, ensure base and small direct/self bonuses
        try:
            cfg.prime_activation_amount = 100
        except Exception:
            pass
        try:
            if not getattr(cfg, "active_direct_bonus_amount", None) or float(cfg.active_direct_bonus_amount or 0) < 2:
                cfg.active_direct_bonus_amount = 2
        except Exception:
            pass
        try:
            if not getattr(cfg, "active_self_bonus_amount", None) or float(cfg.active_self_bonus_amount or 0) < 1:
                cfg.active_self_bonus_amount = 1
        except Exception:
            pass
        cfg.save()

    def _get_or_create_country(self, name: str, iso2: Optional[str] = None) -> Country:
        c, _ = Country.objects.get_or_create(name=name, defaults={"iso2": iso2 or ""})
        if iso2 and c.iso2 != iso2:
            c.iso2 = iso2
            c.save(update_fields=["iso2"])
        return c

    def _get_or_create_state(self, country: Country, name: str) -> State:
        s, _ = State.objects.get_or_create(country=country, name=name)
        return s

    def _get_or_create_city(self, state: State, name: str) -> City:
        c, _ = City.objects.get_or_create(state=state, name=name)
        return c

    def _ensure_company_user(self, password: str) -> CustomUser:
        u, created = CustomUser.objects.get_or_create(
            username="company",
            defaults={
                "role": "user",
                "category": "company",
                "full_name": "Company Root",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            u.set_password(password)
            u.save()
        return u

    def _ensure_state_coordinator(self, state: State, username: str, sponsor: CustomUser, password: str) -> CustomUser:
        u, created = CustomUser.objects.get_or_create(
            username=username,
            defaults={
                "role": "agency",
                "category": "agency_state_coordinator",
                "state": state,
                "registered_by": sponsor,
                "full_name": f"{state.name} State Coordinator",
            },
        )
        if created:
            u.set_password(password)
            u.save()
        # Ensure sponsor_id is the direct sponsor's code
        try:
            sponsor_code = getattr(sponsor, "username", "")
            if sponsor_code and u.sponsor_id != sponsor_code:
                u.sponsor_id = sponsor_code
                u.save(update_fields=["sponsor_id"])
        except Exception:
            pass
        self._ensure_region_assignment(u, level="state", state=state, district="", pincode="")
        return u

    def _ensure_state_agency(self, state: State, username: str, sponsor: CustomUser, password: str) -> CustomUser:
        u, created = CustomUser.objects.get_or_create(
            username=username,
            defaults={
                "role": "agency",
                "category": "agency_state",
                "state": state,
                "registered_by": sponsor,
                "full_name": f"{state.name} Agency",
            },
        )
        if created:
            u.set_password(password)
            u.save()
        # Ensure sponsor_id is the direct sponsor's code
        try:
            sponsor_code = getattr(sponsor, "username", "")
            if sponsor_code and u.sponsor_id != sponsor_code:
                u.sponsor_id = sponsor_code
                u.save(update_fields=["sponsor_id"])
        except Exception:
            pass
        self._ensure_region_assignment(u, level="state", state=state, district="", pincode="")
        return u

    def _ensure_user(
        self,
        username: str,
        role: str,
        category: str,
        state: Optional[State],
        city: Optional[City],
        pincode: str,
        registered_by: Optional[CustomUser],
        password: str,
    ) -> CustomUser:
        defaults = {
            "role": role,
            "category": category,
            "state": state,
            "city": city,
            "pincode": pincode or "",
            "registered_by": registered_by,
            "full_name": username.replace("_", " ").title(),
        }
        u, created = CustomUser.objects.get_or_create(username=username, defaults=defaults)
        dirty = False
        if created:
            u.set_password(password)
            dirty = True
        # ensure pointers (idempotent update)
        for k, v in defaults.items():
            if getattr(u, k) != v:
                setattr(u, k, v)
                dirty = True
        if dirty:
            u.save()
        # ensure wallet
        try:
            Wallet.get_or_create_for_user(u)
        except Exception:
            pass
        # Ensure sponsor_id equals the direct sponsor's code (registered_by)
        try:
            sponsor_code = (getattr(registered_by, "username", "") if registered_by else "")
            desired = sponsor_code or (u.sponsor_id or u.username)
            if desired and u.sponsor_id != desired:
                u.sponsor_id = desired
                u.save(update_fields=["sponsor_id"])
        except Exception:
            pass
        return u

    def _ensure_region_assignment(self, user: CustomUser, level: str, state: Optional[State], district: str, pincode: str):
        if level == "state":
            AgencyRegionAssignment.objects.get_or_create(user=user, level="state", state=state)
        elif level == "district":
            AgencyRegionAssignment.objects.get_or_create(user=user, level="district", state=state, district=district)
        elif level == "pincode":
            AgencyRegionAssignment.objects.get_or_create(user=user, level="pincode", pincode=pincode)
        else:
            return

    def _ensure_coupon(self, code: str, title: str, issuer: CustomUser) -> Coupon:
        c, created = Coupon.objects.get_or_create(
            code=code,
            defaults={
                "title": title,
                "description": title,
                "campaign": "DEMO",
                "issuer": issuer,
                "is_active": True,
            },
        )
        return c

    def _generate_ecoupons_for_employees(
        self,
        employees: List[CustomUser],
        coupon150: Coupon,
        coupon50: Coupon,
        coupon100: Coupon,
        count_per_employee: int,
    ):
        if not employees or count_per_employee <= 0:
            return
        # Create CouponCodes and assign to employee
        created_codes: List[CouponCode] = []
        for emp in employees:
            # split 150 and 50 roughly half
            half = max(1, count_per_employee // 2)
            for i in range(half):
                code = f"EC150-{emp.username}-{i+1}"
                cc, created = CouponCode.objects.get_or_create(
                    code=code,
                    defaults={
                        "coupon": coupon150,
                        "issued_channel": "e_coupon",
                        "assigned_employee": emp,
                        "assigned_agency": emp.registered_by.registered_by if emp.registered_by else None,  # try parent agency
                        "batch": None,
                        "serial": None,
                        "value": 150,
                        "issued_by": emp.registered_by or emp,  # whoever available
                        "status": "ASSIGNED_EMPLOYEE",
                    },
                )
                if created:
                    created_codes.append(cc)
            for i in range(count_per_employee - half):
                code = f"EC50-{emp.username}-{i+1}"
                cc, created = CouponCode.objects.get_or_create(
                    code=code,
                    defaults={
                        "coupon": coupon50,
                        "issued_channel": "e_coupon",
                        "assigned_employee": emp,
                        "assigned_agency": emp.registered_by.registered_by if emp.registered_by else None,
                        "batch": None,
                        "serial": None,
                        "value": 50,
                        "issued_by": emp.registered_by or emp,
                        "status": "ASSIGNED_EMPLOYEE",
                    },
                )
                if created:
                    created_codes.append(cc)
            # Additionally generate EC100 codes for each employee to drive activation workflow
            if coupon100:
                for i in range(count_per_employee):
                    code = f"EC100-{emp.username}-{i+1}"
                    cc, created = CouponCode.objects.get_or_create(
                        code=code,
                        defaults={
                            "coupon": coupon100,
                            "issued_channel": "e_coupon",
                            "assigned_employee": emp,
                            "assigned_agency": emp.registered_by.registered_by if emp.registered_by else None,
                            "batch": None,
                            "serial": None,
                            "value": 100,
                            "issued_by": emp.registered_by or emp,
                            "status": "ASSIGNED_EMPLOYEE",
                        },
                    )
                    if created:
                        created_codes.append(cc)

    def _ec100_batch_distribute(self, agency_user: CustomUser, employees: List[CustomUser], coupon: Coupon, count_per_employee: int = 5):
        """
        Create EC100 codes assigned to the pincode agency, then distribute them to employees.
        Status transitions:
          AVAILABLE/ASSIGNED_AGENCY -> ASSIGNED_EMPLOYEE
        """
        if not agency_user or not employees or count_per_employee <= 0:
            return
        for emp in employees:
            for i in range(count_per_employee):
                code = f"EC100AG-{getattr(agency_user,'username','AG')}-{getattr(emp,'username','EMP')}-{i+1}"
                cc, created = CouponCode.objects.get_or_create(
                    code=code,
                    defaults={
                        "coupon": coupon,
                        "issued_channel": "e_coupon",
                        "assigned_agency": agency_user,
                        "assigned_employee": None,
                        "batch": None,
                        "serial": None,
                        "value": 100,
                        "issued_by": agency_user,
                        "status": "ASSIGNED_AGENCY",
                    },
                )
                # Distribute to employee (ASSIGNED_EMPLOYEE)
                if cc.assigned_employee_id != emp.id or cc.status != "ASSIGNED_EMPLOYEE":
                    cc.assigned_employee = emp
                    cc.status = "ASSIGNED_EMPLOYEE"
                    cc.save(update_fields=["assigned_employee", "status"])
    def _simulate_activation_flows(
        self,
        consumers: List[CustomUser],
        do_act150: int,
        do_red150: int,
        do_act50: int,
    ):
        # Pick the first N for each operation
        idx = 0
        for u in consumers[:do_act150]:
            try:
                activate_150_active(u, {"type": "seed_activate_150", "id": f"act150_{u.username}"})
                ensure_first_purchase_activation(u, {"type": "seed_first_purchase", "id": f"fp_{u.username}"})
            except Exception:
                pass
            idx += 1

        for u in consumers[idx : idx + do_red150]:
            try:
                redeem_150(u, {"type": "seed_redeem_150", "id": f"red150_{u.username}"})
            except Exception:
                pass
        idx += do_red150

        for u in consumers[idx : idx + do_act50]:
            try:
                activate_50(u, {"type": "seed_activate_50", "id": f"act50_{u.username}"})
            except Exception:
                pass

    def _simulate_product_purchases(self, consumers: List[CustomUser], count: int):
        """
        Simulate product purchase approvals which trigger product_purchase_activations
        (opens THREE_50 and optionally 150 Active if config.product_opens_prime=True).
        """
        if not consumers or count <= 0:
            return
        for u in consumers[:count]:
            try:
                product_purchase_activations(u, {"type": "seed_product_purchase", "id": f"pp_{u.username}"})
            except Exception:
                continue

    def _ensure_kyc_for_subset(self, consumers: List[CustomUser]):
        for u in consumers:
            try:
                ky, created = UserKYC.objects.get_or_create(
                    user=u,
                    defaults={
                        "bank_name": "Demo Bank",
                        "bank_account_number": f"0000{u.id:06d}",
                        "ifsc_code": "DEMO0123456",
                        "verified": True,
                        "verified_by": u.registered_by if u.registered_by else None,
                    },
                )
                if not created:
                    # ensure verified (idempotent)
                    dirty = False
                    if not ky.verified:
                        ky.verified = True
                        dirty = True
                    if dirty:
                        ky.save(update_fields=["verified", "updated_at"])
            except Exception:
                continue

    def _simulate_ecoupon_submission_flow(
        self,
        employees: List[CustomUser],
        district_agency: CustomUser,
        coupon: Coupon,
    ):
        """
        For each of the first few employees:
          - Assign their first EC150 code to a consumer
          - Create CouponSubmission SUBMITTED
          - Employee approves -> Agency approves
          - Post-save signal handles wallet credit (₹140) and commission records
        """
        if not employees:
            return
        for emp in employees[:3]:
            # Find a consumer under this employee
            consumer = CustomUser.objects.filter(registered_by=emp, category="consumer").first()
            if not consumer:
                continue
            # Find a 150 coupon code assigned to this employee
            code_ref = CouponCode.objects.filter(assigned_employee=emp, coupon=coupon, status__in=["ASSIGNED_EMPLOYEE", "AVAILABLE"]).first()
            if not code_ref:
                continue

            try:
                with transaction.atomic():
                    # Create submission
                    sub = CouponSubmission.objects.create(
                        consumer=consumer,
                        coupon=code_ref.coupon,
                        coupon_code=code_ref.code,
                        code_ref=code_ref,
                        pincode=consumer.pincode or "",
                        notes=f"seed: employee={emp.username}",
                        status="SUBMITTED",
                    )
                    # Mark SOLD
                    code_ref.mark_sold()
                    code_ref.save(update_fields=["status"])

                    # Employee approves
                    sub.mark_employee_review(emp, approved=True, comment="seed approve")
                    sub.save(update_fields=["employee_reviewer", "employee_reviewed_at", "employee_comment", "status"])

                    # Agency approves
                    # ensure pincode coverage not strictly enforced here (our agency may not have same pincode),
                    # but model signal will process on status change regardless of view filtering
                    sub.agency_reviewer = district_agency
                    sub.agency_comment = "seed final approve"
                    from django.utils import timezone as _tz
                    sub.agency_reviewed_at = _tz.now()
                    sub.status = "AGENCY_APPROVED"
                    sub.save(update_fields=["agency_reviewer", "agency_reviewed_at", "agency_comment", "status"])
            except Exception:
                # continue best-effort
                continue

    def _simulate_withdrawals(self, users: List[CustomUser], approver: CustomUser, per_district: int = 3):
        """
        Create and approve a few withdrawals for users with sufficient wallet balance.
        """
        count = 0
        for u in users:
            if count >= per_district:
                break
            try:
                w = Wallet.get_or_create_for_user(u)
                if (w.balance or Decimal("0")) >= Decimal("50"):
                    wr = WithdrawalRequest.objects.create(
                        user=u,
                        amount=Decimal("50.00"),
                        method="bank",
                        bank_name=getattr(getattr(u, "kyc", None), "bank_name", "Demo Bank"),
                        bank_account_number=getattr(getattr(u, "kyc", None), "bank_account_number", "0000000000"),
                        ifsc_code=getattr(getattr(u, "kyc", None), "ifsc_code", "DEMO0123456"),
                        note="seed auto withdrawal",
                    )
                    wr.approve(approver, payout_ref=f"SEED-{u.username}")
                    count += 1
            except Exception:
                continue
