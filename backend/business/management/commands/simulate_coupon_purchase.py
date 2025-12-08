from __future__ import annotations

from decimal import Decimal
from typing import List, Dict, Any, Optional

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Max, Q
from django.utils import timezone

from accounts.models import CustomUser, WalletTransaction
from coupons.models import Coupon, CouponBatch, CouponCode, AuditTrail
from business.models import AutoPoolAccount, CommissionConfig
from business.services.activation import open_matrix_accounts_for_coupon


class Command(BaseCommand):
    help = (
        "Simulate a consumer purchasing N e-coupons and auto-creating per-coupon matrix accounts "
        "(FIVE_150 + THREE_150) with spillover and commission distribution.\n\n"
        "Usage examples:\n"
        "  python manage.py simulate_coupon_purchase --user 123 --count 5 --denomination 150 --prefix SIM\n"
        "  python manage.py simulate_coupon_purchase --user alice --count 3 --denomination 50 --prefix DEMO --no-distribute\n"
    )

    def add_arguments(self, parser):
        parser.add_argument("--user", required=True, help="User id (int) or username of the consumer buyer")
        parser.add_argument("--count", type=int, default=1, help="Number of coupons to simulate purchase for")
        parser.add_argument("--denomination", type=str, default="150", help="Coupon denomination (e.g. 150 or 50)")
        parser.add_argument("--prefix", type=str, default="SIM", help="Code prefix for generated e-coupons")
        parser.add_argument("--coupon-title", type=str, default=None, help="Optional Coupon.title (defaults to '<PREFIX> E-Coupon')")
        parser.add_argument("--no-distribute", action="store_true", help="If set, creates accounts but skips commission distribution")
        parser.add_argument("--dry-run", action="store_true", help="If set, prints what would happen without DB writes")

    def _resolve_user(self, ident: str) -> CustomUser:
        u: Optional[CustomUser] = None
        if ident.isdigit():
            u = CustomUser.objects.filter(id=int(ident)).first()
        if not u:
            u = CustomUser.objects.filter(username__iexact=ident).first()
        if not u:
            raise CommandError(f"User '{ident}' not found")
        return u

    def handle(self, *args, **options):
        user_ident: str = options["user"]
        count: int = max(1, int(options["count"] or 1))
        denom_in: str = str(options["denomination"] or "150").strip()
        prefix: str = str(options["prefix"] or "SIM").strip().upper() or "SIM"
        title_override: Optional[str] = options.get("coupon_title")
        no_distribute: bool = bool(options.get("no_distribute", False))
        dry_run: bool = bool(options.get("dry_run", False))

        try:
            denomination = Decimal(denom_in)
        except Exception:
            raise CommandError(f"Invalid denomination '{denom_in}'. Provide a positive number like 150 or 50.")

        if denomination <= 0:
            raise CommandError("Denomination must be > 0")

        user = self._resolve_user(user_ident)
        self.stdout.write(self.style.MIGRATE_HEADING(f"Simulating e-coupon purchase for user #{user.id} ({user.username})"))
        self.stdout.write(f"- Count: {count}")
        self.stdout.write(f"- Denomination: {denomination}")
        self.stdout.write(f"- Prefix: {prefix}")
        self.stdout.write(f"- Distribute commissions: {not no_distribute}")
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN: No changes will be written."))

        # Ensure CommissionConfig exists
        try:
            CommissionConfig.get_solo()
        except Exception:
            pass

        # Resolve issuer for Coupon and CouponCode.issued_by
        issuer = user or CustomUser.objects.filter(is_superuser=True).order_by("id").first() \
            or CustomUser.objects.filter(is_staff=True).order_by("id").first()
        if not issuer:
            issuer = user

        # Resolve or create parent Coupon
        coupon, _ = Coupon.objects.get_or_create(
            code=prefix,
            defaults={
                "title": title_override or f"{prefix} E-Coupon",
                "description": "Simulation E-Coupon",
                "campaign": prefix,
                "issuer": issuer,
            },
        )

        # Determine next serial for this prefix (sequential codes: PREFIX + zero-padded serial)
        # We only consider codes with the same prefix and issued_channel='e_coupon'
        last_serial = (
            CouponCode.objects.filter(code__startswith=prefix, issued_channel="e_coupon", serial__isnull=False)
            .aggregate(m=Max("serial"))
            .get("m") or 0
        )
        serial_start = int(last_serial) + 1
        serial_end = serial_start + count - 1
        serial_width = 7  # PREFIX + 7 digits

        code_objs: List[CouponCode] = []
        with transaction.atomic():
            # Create a grouping batch
            if not dry_run:
                batch = CouponBatch.objects.create(
                    coupon=coupon,
                    prefix=prefix,
                    serial_start=serial_start,
                    serial_end=serial_end,
                    serial_width=serial_width,
                    created_by=issuer,
                )
            else:
                batch = None  # placeholder

            # Generate codes
            for serial in range(serial_start, serial_end + 1):
                code_str = f"{prefix}{str(serial).zfill(serial_width)}"
                code_objs.append(
                    CouponCode(
                        code=code_str,
                        coupon=coupon,
                        issued_channel="e_coupon",
                        assigned_employee=None,
                        assigned_agency=None,
                        assigned_consumer=user if not dry_run else None,  # pre-assign for simulation
                        batch=batch,
                        serial=serial,
                        value=denomination,
                        issued_by=issuer,
                        status="SOLD" if not dry_run else "AVAILABLE",
                    )
                )

            if not dry_run:
                # Avoid collisions (idempotent-ish if re-run with same range)
                existing = set(
                    CouponCode.objects.filter(code__in=[c.code for c in code_objs]).values_list("code", flat=True)
                )
                to_create = [c for c in code_objs if c.code not in existing]
                if to_create:
                    CouponCode.objects.bulk_create(to_create, batch_size=1000)

                # Ensure status/owner are correct (in case some existed)
                CouponCode.objects.filter(
                    code__in=[c.code for c in code_objs]
                ).update(assigned_consumer=user, issued_by=issuer, status="SOLD")

        # Fetch the actually assigned codes to the user for this serial range
        assigned_codes = list(
            CouponCode.objects.filter(
                code__startswith=prefix,
                serial__gte=serial_start,
                serial__lte=serial_end,
                issued_channel="e_coupon",
                assigned_consumer=user,
            ).only("id", "code", "serial", "value").order_by("serial")
        )

        if not assigned_codes:
            self.stdout.write(self.style.WARNING("No codes assigned to user (possibly dry run or collision)."))
            return

        # Create per-coupon matrix accounts and distribute commissions (idempotent)
        created_ids = []
        if not dry_run:
            for c in assigned_codes:
                try:
                    open_matrix_accounts_for_coupon(
                        user,
                        c.id,
                        amount_150=denomination,
                        distribute=(not no_distribute),
                        trigger="simulate_coupon_purchase",
                    )
                    created_ids.append(str(c.id))
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"open_matrix_accounts_for_coupon failed for code #{c.id}: {e}"))
        else:
            created_ids = [str(c.id) for c in assigned_codes]

        # Summaries
        accounts_5 = AutoPoolAccount.objects.filter(
            owner=user, pool_type="FIVE_150", source_type="ECOUPON", source_id__in=created_ids
        ).count()
        accounts_3 = AutoPoolAccount.objects.filter(
            owner=user, pool_type="THREE_150", source_type="ECOUPON", source_id__in=created_ids
        ).count()

        # Commission summary from WalletTransaction meta.level_index
        tx_qs = WalletTransaction.objects.filter(
            type__in=("AUTOPOOL_BONUS_FIVE", "AUTOPOOL_BONUS_THREE"),
            source_type="ECOUPON",
            source_id__in=created_ids,
        ).order_by("id")

        totals: Dict[str, Decimal] = {"AUTOPOOL_BONUS_FIVE": Decimal("0.00"), "AUTOPOOL_BONUS_THREE": Decimal("0.00")}
        per_level: Dict[str, Dict[int, Decimal]] = {
            "AUTOPOOL_BONUS_FIVE": {},
            "AUTOPOOL_BONUS_THREE": {},
        }
        count_by_type: Dict[str, int] = {"AUTOPOOL_BONUS_FIVE": 0, "AUTOPOOL_BONUS_THREE": 0}

        for t in tx_qs:
            ttype = getattr(t, "type", "")
            amt = Decimal(str(getattr(t, "amount", "0") or "0"))
            totals[ttype] = totals.get(ttype, Decimal("0.00")) + amt
            count_by_type[ttype] = int(count_by_type.get(ttype, 0) or 0) + 1
            meta = getattr(t, "meta", {}) or {}
            try:
                lvl = int(meta.get("level_index") or 0)
            except Exception:
                lvl = 0
            if lvl > 0:
                cur = per_level[ttype].get(lvl, Decimal("0.00"))
                per_level[ttype][lvl] = cur + amt

        # Output
        self.stdout.write(self.style.SUCCESS("\nSimulation complete"))
        self.stdout.write(f"- Codes generated: {len(assigned_codes)}  (range: {serial_start}..{serial_end})")
        self.stdout.write(f"- FIVE_150 accounts created for user: {accounts_5}")
        self.stdout.write(f"- THREE_150 accounts created for user: {accounts_3}")

        def _fmt_levels(d: Dict[int, Decimal]) -> str:
            if not d:
                return "{}"
            parts = [f"L{lvl}: {amt:.2f}" for lvl, amt in sorted(d.items(), key=lambda x: x[0])]
            return "{ " + ", ".join(parts) + " }"

        self.stdout.write("\nCommission summary (WalletTransaction):")
        self.stdout.write(f"  - AUTOPOOL_BONUS_FIVE: count={count_by_type['AUTOPOOL_BONUS_FIVE']}, total=₹{totals['AUTOPOOL_BONUS_FIVE']:.2f}")
        self.stdout.write(f"    per-level: {_fmt_levels(per_level['AUTOPOOL_BONUS_FIVE'])}")
        self.stdout.write(f"  - AUTOPOOL_BONUS_THREE: count={count_by_type['AUTOPOOL_BONUS_THREE']}, total=₹{totals['AUTOPOOL_BONUS_THREE']:.2f}")
        self.stdout.write(f"    per-level: {_fmt_levels(per_level['AUTOPOOL_BONUS_THREE'])}")

        # Best-effort audit trail
        if not dry_run:
            try:
                AuditTrail.objects.create(
                    action="simulation_coupon_purchase",
                    actor=user,
                    notes=f"Simulated {len(assigned_codes)} e-coupons ({prefix} {serial_start}-{serial_end})",
                    metadata={
                        "prefix": prefix,
                        "serial_start": serial_start,
                        "serial_end": serial_end,
                        "count": len(assigned_codes),
                        "denomination": str(denomination),
                        "distribute": not no_distribute,
                    },
                )
            except Exception:
                pass

        self.stdout.write(self.style.HTTP_INFO("\nDone."))
