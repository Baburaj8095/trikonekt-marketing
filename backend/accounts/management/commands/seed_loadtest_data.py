from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
import os

from accounts.models import CustomUser
from coupons.models import Coupon, CouponBatch, CouponCode
from django.conf import settings


SUB_FRANCHISE_CODES = [
    "TRSF8095918105",
    "TRSF1010000001",
    "TRSF1010000002",
    "TRSF1010000003",
    "TRSF1010000004",
    "TRSF1010000005",
    "TRSF1010000006",
    "TRSF1010000007",
    "TRSF1010000008",
    "TRSF1010000009",
]


class Command(BaseCommand):
    help = "Seed load test data: 10 sub-franchises, each with 15 consumers and 5 employees; create e-coupons (150/750/759) 200 each and distribute equally to sub-franchises. Also writes loadtest/consumers.csv for Locust."

    def add_arguments(self, parser):
        parser.add_argument("--consumers_per_sf", type=int, default=15)
        parser.add_argument("--employees_per_sf", type=int, default=5)
        parser.add_argument("--per_denom_count", type=int, default=200)
        parser.add_argument("--password", type=str, default="pass1234")
        parser.add_argument("--coupon_code", type=str, default="LOADTEST")
        parser.add_argument("--coupon_title", type=str, default="Load Test Season")
        parser.add_argument("--coupon_prefix_150", type=str, default="LT150")
        parser.add_argument("--coupon_prefix_750", type=str, default="LT750")
        parser.add_argument("--coupon_prefix_759", type=str, default="LT759")

    def _get_or_create_issuer(self):
        # Prefer an existing superuser/staff as issuer; else create a 'company' category user.
        issuer = CustomUser.objects.filter(is_superuser=True).first()
        if issuer:
            return issuer
        issuer = CustomUser.objects.filter(is_staff=True).first()
        if issuer:
            return issuer
        issuer, _ = CustomUser.objects.get_or_create(
            username="company_seed",
            defaults={
                "email": "company_seed@example.com",
                "role": "user",
                "category": "company",
                "full_name": "Company Seed",
            },
        )
        return issuer

    def _ensure_sf_user(self, code: str, default_password: str) -> CustomUser:
        # Try to match by prefixed_id/username; else create.
        u = CustomUser.objects.filter(prefixed_id=code).first()
        if u:
            return u
        u = CustomUser.objects.filter(username__iexact=code).first()
        if u:
            # Ensure correct role/category
            changed = False
            if u.role != "agency":
                u.role = "agency"; changed = True
            if u.category != "agency_sub_franchise":
                u.category = "agency_sub_franchise"; changed = True
            if not getattr(u, "account_active", False):
                u.account_active = True; changed = True
            if not getattr(u, "prefixed_id", None):
                u.prefixed_id = code; changed = True
            if not getattr(u, "prefix_code", None):
                u.prefix_code = "TRSF"; changed = True
            if changed:
                u.save()
            return u

        # Create new sub-franchise user
        u = CustomUser(
            username=code,
            email=f"{code.lower()}@example.com",
            role="agency",
            category="agency_sub_franchise",
            full_name=f"Sub-Franchise {code}",
            prefixed_id=code,
            prefix_code="TRSF",
            account_active=True,
        )
        u.set_password(default_password)
        u.save()
        return u

    def _ensure_employee(self, sf: CustomUser, idx: int, default_password: str) -> CustomUser:
        uname = f"{sf.username}-EMP{idx:02d}"
        u, created = CustomUser.objects.get_or_create(
            username=uname,
            defaults={
                "email": f"{uname.lower()}@example.com",
                "role": "employee",
                "category": "employee",
                "full_name": f"Employee {idx} of {sf.username}",
                "registered_by": sf,
                "account_active": True,
            },
        )
        if created:
            u.set_password(default_password)
            u.save()
        else:
            changed = False
            if u.role != "employee":
                u.role = "employee"; changed = True
            if u.category != "employee":
                u.category = "employee"; changed = True
            if u.registered_by_id != sf.id:
                u.registered_by = sf; changed = True
            if not getattr(u, "account_active", False):
                u.account_active = True; changed = True
            if changed:
                u.save()
        return u

    def _ensure_consumer(self, sf: CustomUser, idx: int, default_password: str) -> CustomUser:
        uname = f"{sf.username}-C{idx:03d}"
        u, created = CustomUser.objects.get_or_create(
            username=uname,
            defaults={
                "email": f"{uname.lower()}@example.com",
                "role": "user",
                "category": "consumer",
                "full_name": f"Consumer {idx} of {sf.username}",
                "registered_by": sf,
                "account_active": True,
            },
        )
        if created:
            u.set_password(default_password)
            u.save()
        else:
            changed = False
            if u.role != "user":
                u.role = "user"; changed = True
            if u.category != "consumer":
                u.category = "consumer"; changed = True
            if u.registered_by_id != sf.id:
                u.registered_by = sf; changed = True
            if not getattr(u, "account_active", False):
                u.account_active = True; changed = True
            if changed:
                u.save()
        return u

    def _ensure_coupon_master(self, code: str, title: str, issuer: CustomUser) -> Coupon:
        c, created = Coupon.objects.get_or_create(
            code=code,
            defaults={
                "title": title,
                "campaign": "loadtest",
                "issuer": issuer,
                "is_active": True,
                "valid_from": timezone.now(),
                "valid_to": None,
            },
        )
        # If it exists but was inactive, activate it
        if not c.is_active:
            c.is_active = True
            c.save(update_fields=["is_active"])
        return c

    def _ensure_ecoupon_batch(self, coupon: Coupon, prefix: str, count: int, denomination: Decimal, issuer: CustomUser) -> CouponBatch:
        # Idempotent by (coupon, prefix, serial_start/end == count span, value on codes)
        batch = CouponBatch.objects.filter(coupon=coupon, prefix=prefix).order_by("-created_at").first()
        if batch:
            # Ensure codes exist up to required count; create missing
            have = CouponCode.objects.filter(batch=batch).count()
            need = max(0, int(count) - int(have))
            if need > 0:
                start_serial = int(have) + 1
                to_create = []
                for s in range(start_serial, int(count) + 1):
                    code_str = f"{prefix}{str(s).zfill(4)}"
                    to_create.append(CouponCode(
                        code=code_str,
                        coupon=coupon,
                        issued_channel="e_coupon",
                        assigned_employee=None,
                        assigned_agency=None,
                        batch=batch,
                        serial=s,
                        value=denomination,
                        issued_by=issuer,
                        status="AVAILABLE",
                    ))
                if to_create:
                    CouponCode.objects.bulk_create(to_create, batch_size=1000)
            return batch

        with transaction.atomic():
            batch = CouponBatch.objects.create(
                coupon=coupon,
                prefix=prefix,
                serial_start=1,
                serial_end=count,
                serial_width=4,
                created_by=issuer,
            )
            to_create = []
            existing_codes = set(CouponCode.objects.filter(code__startswith=prefix).values_list("code", flat=True))
            for s in range(1, int(count) + 1):
                code_str = f"{prefix}{str(s).zfill(4)}"
                if code_str in existing_codes:
                    continue
                to_create.append(CouponCode(
                    code=code_str,
                    coupon=coupon,
                    issued_channel="e_coupon",
                    assigned_employee=None,
                    assigned_agency=None,
                    batch=batch,
                    serial=s,
                    value=denomination,
                    issued_by=issuer,
                    status="AVAILABLE",
                ))
            if to_create:
                CouponCode.objects.bulk_create(to_create, batch_size=1000)
        return batch

    def _distribute_equally_to_agencies(self, batch: CouponBatch, per_agency: int):
        if per_agency <= 0:
            return
        agencies = list(CustomUser.objects.filter(
            role="agency"
        ).filter(
            category__startswith="agency_"
        ).filter(
            username__in=SUB_FRANCHISE_CODES
        ).only("id", "username").order_by("id"))
        if not agencies:
            return
        # For each agency, take next 'per_agency' AVAILABLE codes in this batch
        for ag in agencies:
            ids = list(
                CouponCode.objects.filter(
                    batch=batch,
                    status="AVAILABLE",
                    assigned_agency__isnull=True,
                    assigned_employee__isnull=True,
                    assigned_consumer__isnull=True,
                ).order_by("serial", "id").values_list("id", flat=True)[:per_agency]
            )
            if not ids:
                break
            CouponCode.objects.filter(id__in=ids).update(assigned_agency=ag, status="ASSIGNED_AGENCY")

    def handle(self, *args, **opts):
        consumers_per_sf = int(opts["consumers_per_sf"])
        employees_per_sf = int(opts["employees_per_sf"])
        per_denom_count = int(opts["per_denom_count"])
        default_password = str(opts["password"])
        coupon_code = str(opts["coupon_code"]).strip().upper() or "LOADTEST"
        coupon_title = str(opts["coupon_title"]) or "Load Test Season"
        prefix_150 = (str(opts["coupon_prefix_150"]) or "LT150").strip().upper()
        prefix_750 = (str(opts["coupon_prefix_750"]) or "LT750").strip().upper()
        prefix_759 = (str(opts["coupon_prefix_759"]) or "LT759").strip().upper()

        issuer = self._get_or_create_issuer()

        self.stdout.write(self.style.NOTICE("Ensuring Sub-Franchise agencies..."))
        sfs = []
        for code in SUB_FRANCHISE_CODES:
            sf = self._ensure_sf_user(code, default_password)
            sfs.append(sf)
        self.stdout.write(self.style.SUCCESS(f"Agencies ready: {len(sfs)}"))

        self.stdout.write(self.style.NOTICE("Ensuring employees/consumers under each Sub-Franchise..."))
        consumers_for_csv = []
        for sf in sfs:
            # employees
            for i in range(1, employees_per_sf + 1):
                self._ensure_employee(sf, i, default_password)
            # consumers
            for j in range(1, consumers_per_sf + 1):
                c = self._ensure_consumer(sf, j, default_password)
                consumers_for_csv.append((c.username, default_password))
        self.stdout.write(self.style.SUCCESS(f"Employees created per SF: {employees_per_sf}, consumers per SF: {consumers_per_sf}"))

        self.stdout.write(self.style.NOTICE("Ensuring e-coupon masters/batches..."))
        coupon = self._ensure_coupon_master(coupon_code, coupon_title, issuer)

        # Create batches: 150, 750, 759 with given counts
        b150 = self._ensure_ecoupon_batch(coupon, prefix_150, per_denom_count, Decimal("150.00"), issuer)
        b750 = self._ensure_ecoupon_batch(coupon, prefix_750, per_denom_count, Decimal("750.00"), issuer)
        b759 = self._ensure_ecoupon_batch(coupon, prefix_759, per_denom_count, Decimal("759.00"), issuer)
        self.stdout.write(self.style.SUCCESS("Batches ready."))

        # Distribute equally across 10 SFs: per_agency = per_denom_count // len(SUB_FRANCHISE_CODES)
        try:
            n_agencies = len(SUB_FRANCHISE_CODES)
            per_agency = int(per_denom_count // n_agencies) if n_agencies else 0
        except Exception:
            per_agency = 0

        self.stdout.write(self.style.NOTICE(f"Distributing {per_agency} codes per agency per denomination..."))
        self._distribute_equally_to_agencies(b150, per_agency)
        self._distribute_equally_to_agencies(b750, per_agency)
        self._distribute_equally_to_agencies(b759, per_agency)
        self.stdout.write(self.style.SUCCESS("Distribution complete."))

        # Write consumers.csv for Locust
        out_dir = os.path.join(settings.BASE_DIR, "..", "loadtest")
        try:
            os.makedirs(out_dir, exist_ok=True)
        except Exception:
            out_dir = os.path.abspath(os.path.join(os.getcwd(), "loadtest"))
            os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, "consumers.csv")
        try:
            with open(out_path, "w", encoding="utf-8") as f:
                f.write("username,password\n")
                for uname, pwd in consumers_for_csv:
                    f.write(f"{uname},{pwd}\n")
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"Failed to write consumers.csv: {e}"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Wrote consumer credentials to {out_path}"))

        self.stdout.write(self.style.SUCCESS("Seed complete."))
