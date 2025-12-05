from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from django.db.models import Q

from accounts.models import CustomUser
from business.models import PromoPackage, PromoPurchase
from coupons.models import CouponSubmission


class Command(BaseCommand):
    help = (
        "Backfill PromoPurchase(PRIME150) for existing users who have activated a 150rs first coupon.\n"
        "- Detects users with at least one AGENCY_APPROVED CouponSubmission of value 150.\n"
        "- Creates or upgrades one PRIME150 PromoPurchase per user to APPROVED.\n"
        "- Idempotent and safe to re-run."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only print what would happen, do not write any changes.",
        )

    def handle(self, *args, **options):
        dry_run = bool(options.get("dry_run"))

        # Resolve/create the 150rs package seeded by seed_promo_packages
        pkg = PromoPackage.objects.filter(code="PRIME150").first()
        if not pkg:
            self.stdout.write(self.style.WARNING("PromoPackage PRIME150 not found. Creating it on the fly."))
            pkg = PromoPackage.objects.create(
                code="PRIME150",
                name="Prime Promo 150",
                description="Prime Promo Package ₹150 (auto-created by migration)",
                type="PRIME",
                price=150,
                is_active=True,
            )

        # Users who have at least one agency-approved submission of 150rs
        # Prefer code_ref.value=150 when code_ref exists; fallback to all approved (most coupons are 150 by default)
        subs = CouponSubmission.objects.filter(status="AGENCY_APPROVED")
        subs = subs.filter(Q(code_ref__value=150) | Q(code_ref__isnull=True))

        user_ids = (
            subs.values_list("consumer_id", flat=True)
            .distinct()
        )
        users = CustomUser.objects.filter(id__in=user_ids).only("id", "username", "first_purchase_activated_at")

        total = 0
        created = 0
        upgraded = 0

        now = timezone.now()

        for u in users:
            total += 1
            # Enforce one PRIME150 per user (year/month None for PRIME)
            pp = PromoPurchase.objects.filter(user=u, package=pkg, year__isnull=True, month__isnull=True).first()

            if not pp:
                if dry_run:
                    self.stdout.write(f"[DRY] CREATE APPROVED PromoPurchase PRIME150 for user {u.id} ({u.username})")
                    continue

                with transaction.atomic():
                    PromoPurchase.objects.create(
                        user=u,
                        package=pkg,
                        status="APPROVED",
                        quantity=1,
                        amount_paid=pkg.price or 150,
                        approved_at=now,
                        approved_by=None,  # can be set manually later if required
                        year=None,
                        month=None,
                        active_from=None,
                        active_to=None,
                        remarks="Auto-migrated from 150rs first coupon activation",
                    )
                created += 1
            else:
                # If exists but not approved, upgrade to APPROVED
                if pp.status != "APPROVED":
                    if dry_run:
                        self.stdout.write(f"[DRY] UPDATE status->APPROVED for existing PRIME150 purchase of user {u.id} ({u.username})")
                        continue
                    pp.status = "APPROVED"
                    if not pp.approved_at:
                        pp.approved_at = now
                    pp.remarks = (pp.remarks or "")
                    if "Auto-migrated" not in pp.remarks:
                        pp.remarks = (pp.remarks + "\n" if pp.remarks else "") + "Auto-migrated from 150rs first coupon activation"
                    pp.save(update_fields=["status", "approved_at", "remarks"])
                    upgraded += 1

        self.stdout.write(self.style.SUCCESS(
            f"Done. Users scanned={total}, created PRIME150={created}, upgraded to APPROVED={upgraded}. DryRun={dry_run}"
        ))
