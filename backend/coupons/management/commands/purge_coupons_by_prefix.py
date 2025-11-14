from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

from coupons.models import Coupon, CouponCode, CouponBatch


class Command(BaseCommand):
    help = (
        "Purge coupon codes and batches by prefix quickly using DB-level deletes. "
        "By default only targets e-coupons (issued_channel='e_coupon'). "
        "Use --all-channels to include physical as well. "
        "Safely deletes Coupon when no dependent rows remain, otherwise deactivates it."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--prefix",
            required=True,
            help="Code prefix to match (e.g., LDGR)",
        )
        parser.add_argument(
            "--all-channels",
            action="store_true",
            help="Include all channels (physical and e_coupon). Default is e_coupon only.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show counts only and do not delete.",
        )
        parser.add_argument(
            "--deactivate-only",
            action="store_true",
            help="Never hard-delete Coupon; only set is_active=False.",
        )

    def handle(self, *args, **options):
        prefix = options["prefix"]
        all_channels = options["all_channels"]
        dry_run = options["dry_run"]
        deactivate_only = options["deactivate_only"]

        # Build querysets without loading rows into memory
        codes_qs = CouponCode.objects.filter(code__startswith=prefix)
        if not all_channels:
            codes_qs = codes_qs.filter(issued_channel="e_coupon")

        batches_qs = CouponBatch.objects.filter(prefix=prefix)
        coupons_qs = Coupon.objects.filter(
            Q(campaign__iexact=prefix) | Q(code__startswith=prefix)
        )

        summary_before = {
            "codes": codes_qs.count(),
            "batches": batches_qs.count(),
            "coupons": coupons_qs.count(),
        }
        self.stdout.write(self.style.NOTICE(f"Prefix={prefix} all_channels={all_channels} dry_run={dry_run}"))
        self.stdout.write(self.style.NOTICE(f"Before: {summary_before}"))

        if dry_run:
            self.stdout.write(self.style.SUCCESS("Dry run complete. No changes made."))
            return

        # Execute as DB-level operations for speed and low memory
        with transaction.atomic():
            deleted_codes = codes_qs.delete()[0]
            deleted_batches = batches_qs.delete()[0]

            deleted_coupons = 0
            deactivated_coupons = 0

            # Iterate over matching coupons to either delete (if safe) or deactivate
            for c in coupons_qs.only("id", "is_active"):
                # If any remaining related objects exist, keep coupon but deactivate it
                has_related = c.submissions.exists() or c.batches.exists() or c.codes.exists()
                if not has_related and not deactivate_only:
                    c.delete()
                    deleted_coupons += 1
                else:
                    if getattr(c, "is_active", True):
                        c.is_active = False
                        c.save(update_fields=["is_active"])
                        deactivated_coupons += 1

        self.stdout.write(self.style.SUCCESS(
            f"Deleted codes={deleted_codes}, batches={deleted_batches}, "
            f"deleted coupons={deleted_coupons}, deactivated coupons={deactivated_coupons}"
        ))
