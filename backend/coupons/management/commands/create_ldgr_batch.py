from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from decimal import Decimal

from coupons.models import Coupon, CouponBatch, CouponCode

User = get_user_model()


class Command(BaseCommand):
    help = "Create an E-Coupon master and a sequential batch (default: LDGR000001..LDGR001000). Idempotent for codes."

    def add_arguments(self, parser):
        parser.add_argument("--prefix", type=str, default="LDGR", help="Code prefix, e.g. LDGR")
        parser.add_argument("--start", type=int, default=1, help="Serial start (inclusive)")
        parser.add_argument("--end", type=int, default=1000, help="Serial end (inclusive)")
        parser.add_argument("--width", type=int, default=6, help="Zero-pad width for serial numbers")
        parser.add_argument("--coupon-code", type=str, default="LDGR", help="Coupon (master) code")
        parser.add_argument("--title", type=str, default="Ledger E-Coupon", help="Coupon (master) title")
        parser.add_argument("--issuer-username", type=str, default=None, help="Issuer/admin username (optional)")
        parser.add_argument("--value", type=str, default="150.00", help="Coupon code face value")

    def handle(self, *args, **opts):
        prefix: str = (opts.get("prefix") or "LDGR").strip()
        serial_start: int = int(opts.get("start") or 1)
        serial_end: int = int(opts.get("end") or 1000)
        serial_width: int = int(opts.get("width") or 6)
        coupon_code: str = (opts.get("coupon_code") or "LDGR").strip()
        title: str = (opts.get("title") or "Ledger E-Coupon").strip()
        issuer_username = (opts.get("issuer_username") or None)
        value = Decimal(str(opts.get("value") or "150.00"))

        if serial_start <= 0 or serial_end < serial_start:
            self.stderr.write(self.style.ERROR("Invalid serial range."))
            return

        # Resolve issuer
        issuer = None
        if issuer_username:
            issuer = User.objects.filter(username__iexact=issuer_username).first()
            if not issuer:
                self.stderr.write(self.style.ERROR(f"Issuer username not found: {issuer_username}"))
                return
        if not issuer:
            issuer = User.objects.filter(is_superuser=True).first() or User.objects.filter(is_staff=True).first()
        if not issuer:
            issuer = User.objects.first()
        if not issuer:
            self.stderr.write(self.style.ERROR("No users exist to set as issuer. Create an admin user first."))
            return

        # Ensure Coupon (master) exists
        coupon, created_coupon = Coupon.objects.get_or_create(
            code=coupon_code,
            defaults={
                "title": title,
                "description": "Auto-created by management command create_ldgr_batch",
                "campaign": "E-LDGR",
                "issuer": issuer,
                "is_active": True,
            },
        )
        if not created_coupon:
            # Keep existing coupon active
            if not coupon.is_active:
                coupon.is_active = True
                coupon.save(update_fields=["is_active"])

        # Ensure a matching batch row exists (for visibility); do not rely on this for idempotency of codes
        batch, created_batch = CouponBatch.objects.get_or_create(
            coupon=coupon,
            prefix=prefix,
            serial_start=serial_start,
            serial_end=serial_end,
            serial_width=serial_width,
            defaults={"created_by": issuer},
        )

        # Generate codes idempotently
        to_create = []
        for s in range(serial_start, serial_end + 1):
            code_str = f"{prefix}{str(s).zfill(serial_width)}"
            to_create.append((s, code_str))

        existing_map = set(
            CouponCode.objects.filter(code__in=[code for (_, code) in to_create]).values_list("code", flat=True)
        )
        final_list = [
            CouponCode(
                code=code,
                coupon=coupon,
                issued_channel="e_coupon",
                assigned_employee=None,
                assigned_agency=None,
                batch=batch,
                serial=s,
                value=value,
                issued_by=issuer,
                status="AVAILABLE",
            )
            for (s, code) in to_create
            if code not in existing_map
        ]

        created_count = 0
        with transaction.atomic():
            if final_list:
                CouponCode.objects.bulk_create(final_list, batch_size=1000)
                created_count = len(final_list)

        self.stdout.write(self.style.SUCCESS(f"Coupon: {coupon.code} ({coupon.title})"))
        self.stdout.write(self.style.SUCCESS(
            f"Batch: {prefix}{str(serial_start).zfill(serial_width)}-{prefix}{str(serial_end).zfill(serial_width)} "
            f"({'created' if created_batch else 'existing'})"
        ))
        self.stdout.write(self.style.SUCCESS(
            f"Codes created now: {created_count}; total in range: {serial_end - serial_start + 1}; "
            f"skipped existing: {(serial_end - serial_start + 1) - created_count}"
        ))
