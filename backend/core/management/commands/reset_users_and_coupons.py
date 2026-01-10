from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.db import transaction, connection
from django.core.management.color import no_style

# Coupon models
from coupons.models import (
    AuditTrail,
    Commission,
    ECouponOrder,
    ECouponProduct,
    ECouponPaymentConfig,
    CouponSubmission,
    CouponAssignment,
    LuckyDrawEligibility,
    CouponCode,
    CouponBatch,
    Coupon,
)


class Command(BaseCommand):
    help = "Dangerous: Delete ALL coupon data and ALL users, then create a fresh superuser."

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            dest="username",
            help="Superuser username to create after reset (default: admin)",
            default="admin",
        )
        parser.add_argument(
            "--email",
            dest="email",
            help="Superuser email (default: admin@example.com)",
            default="admin@example.com",
        )
        parser.add_argument(
            "--password",
            dest="password",
            help="Superuser password (REQUIRED unless --noinput provided, but strongly recommended to pass explicitly)",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            dest="force",
            help="Skip interactive confirmation.",
        )

    def _reset_sequences(self, models):
        """
        Reset sequences for the given models (PostgreSQL supported via Django ops).
        """
        try:
            sql_list = connection.ops.sequence_reset_sql(no_style(), models)
            if sql_list:
                with connection.cursor() as cursor:
                    for sql in sql_list:
                        cursor.execute(sql)
        except Exception as e:
            # Non-fatal: continue even if we cannot reset sequences
            self.stderr.write(self.style.WARNING(f"Sequence reset skipped/failed: {e}"))

    def handle(self, *args, **options):
        username = (options.get("username") or "admin").strip()
        email = (options.get("email") or "admin@example.com").strip()
        password = options.get("password")
        force = bool(options.get("force"))

        User = get_user_model()

        if not force:
            self.stdout.write(self.style.WARNING("This will PERMANENTLY delete:"))
            self.stdout.write("- ALL coupon-related data (codes, submissions, products, audits, etc.)")
            self.stdout.write("- ALL users (CustomUser) and all rows cascading from user deletions")
            self.stdout.write("")
            self.stdout.write(f"Then it will create one superuser: username='{username}', email='{email}'")
            confirm = input("Type YES to proceed: ").strip()
            if confirm != "YES":
                raise CommandError("Aborted by user.")

        if not password:
            raise CommandError("You must provide --password for the new superuser (for safety).")

        # Count before
        counts_before = {}
        def _count(label, qs):
            try:
                counts_before[label] = qs.count()
            except Exception:
                counts_before[label] = "N/A"

        _count("AuditTrail", AuditTrail.objects.all())
        _count("Commission", Commission.objects.all())
        _count("ECouponOrder", ECouponOrder.objects.all())
        _count("CouponSubmission", CouponSubmission.objects.all())
        _count("LuckyDrawEligibility", LuckyDrawEligibility.objects.all())
        _count("CouponAssignment", CouponAssignment.objects.all())
        _count("CouponCode", CouponCode.objects.all())
        _count("ECouponProduct", ECouponProduct.objects.all())
        _count("ECouponPaymentConfig", ECouponPaymentConfig.objects.all())
        _count("CouponBatch", CouponBatch.objects.all())
        _count("Coupon", Coupon.objects.all())
        _count("Users", User.objects.all())

        self.stdout.write(self.style.NOTICE("Counts before deletion:"))
        for k, v in counts_before.items():
            self.stdout.write(f"- {k}: {v}")

        # Deletion sequence: remove coupon-related rows first to avoid PROTECT on user deletions
        with transaction.atomic():
            # Best-effort, order chosen to satisfy on_delete=PROTECT chains to User/Coupon
            # 1) Audit/logs (not strictly required)
            AuditTrail.objects.all().delete()

            # 2) Orders referencing buyer (User PROTECT)
            ECouponOrder.objects.all().delete()

            # 3) Submissions referencing consumer/employee/agency (User PROTECT), cascades Commission via submission
            CouponSubmission.objects.all().delete()

            # 4) Any residual commission (should be cleared by 3, but just in case)
            Commission.objects.all().delete()

            # 5) Lucky draw eligibility (User/Coupon PROTECT)
            LuckyDrawEligibility.objects.all().delete()

            # 6) Assignments referencing employee/assigned_by (User PROTECT)
            CouponAssignment.objects.all().delete()

            # 7) Codes referencing issued_by (User PROTECT)
            CouponCode.objects.all().delete()

            # 8) Product/payment configs/batches that PROTECT Coupon
            ECouponProduct.objects.all().delete()
            ECouponPaymentConfig.objects.all().delete()
            CouponBatch.objects.all().delete()

            # 9) Finally, coupons
            Coupon.objects.all().delete()

            # 10) Delete all users
            User.objects.all().delete()

        # Reset sequences for primary models we cleared
        self._reset_sequences([
            User,
            Coupon,
            CouponCode,
            CouponSubmission,
            CouponAssignment,
            ECouponProduct,
            ECouponPaymentConfig,
            ECouponOrder,
            Commission,
            AuditTrail,
            LuckyDrawEligibility,
            CouponBatch,
        ])

        # Create the new superuser
        su = User.objects.create_superuser(username=username, email=email, password=password)
        self.stdout.write(self.style.SUCCESS(f"Created superuser: {su.username} (id={su.id})"))

        # Summarize after
        counts_after = {}
        def _count_after(label, qs):
            try:
                counts_after[label] = qs.count()
            except Exception:
                counts_after[label] = "N/A"

        _count_after("AuditTrail", AuditTrail.objects.all())
        _count_after("Commission", Commission.objects.all())
        _count_after("ECouponOrder", ECouponOrder.objects.all())
        _count_after("CouponSubmission", CouponSubmission.objects.all())
        _count_after("LuckyDrawEligibility", LuckyDrawEligibility.objects.all())
        _count_after("CouponAssignment", CouponAssignment.objects.all())
        _count_after("CouponCode", CouponCode.objects.all())
        _count_after("ECouponProduct", ECouponProduct.objects.all())
        _count_after("ECouponPaymentConfig", ECouponPaymentConfig.objects.all())
        _count_after("CouponBatch", CouponBatch.objects.all())
        _count_after("Coupon", Coupon.objects.all())
        _count_after("Users", User.objects.all())

        self.stdout.write(self.style.SUCCESS("Reset completed. Counts after deletion:"))
        for k, v in counts_after.items():
            self.stdout.write(f"- {k}: {v}")
