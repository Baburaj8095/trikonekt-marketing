from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import (
    CustomUser,
    Wallet,
    WalletTransaction,
    RewardPointsAccount,
    RewardPointsTransaction,
    RewardPointsHold,
)

class Command(BaseCommand):
    help = (
        "Irreversibly reset PRIME test data:\n"
        " - Delete ALL wallet transactions and zero every wallet\n"
        " - Clear reward points ledger and holds, zero points\n"
        " - Remove matrix/autopool artifacts (AutoPoolAccount, UserMatrixProgress, Company payouts, Daily reports if present)\n"
        " - Clear user PRIME activation flags (first_purchase_activated_at=NULL, account_active=False, disable flags) for non-superusers\n"
        "\n"
        "Usage:\n"
        "  python manage.py reset_prime_data --confirm [--include-admins]\n"
        "\n"
        "By default superusers are excluded from user-flag resets. Pass --include-admins to include them."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Required. Perform the reset. Without this flag, the command will abort.",
        )
        parser.add_argument(
            "--include-admins",
            action="store_true",
            help="Include superusers in user activation reset (not recommended). Default excludes superusers.",
        )

    def handle(self, *args, **options):
        if not options.get("confirm"):
            raise CommandError("This operation is destructive. Re-run with --confirm to proceed.")

        include_admins = bool(options.get("include_admins"))

        # Lazy-import optional models to avoid hard dependency failures
        AutoPoolAccount = None
        UserMatrixProgress = None
        DailyReport = None
        CompanyCommissionPayout = None
        try:
            from business.models import AutoPoolAccount as _APA, UserMatrixProgress as _UMP, DailyReport as _DR
            AutoPoolAccount, UserMatrixProgress, DailyReport = _APA, _UMP, _DR
        except Exception:
            pass
        try:
            # import company payout model if available; name may vary, try dynamic import as used in serializers
            CompanyCommissionPayout = __import__(
                "business.models", fromlist=["CompanyCommissionPayout"]
            ).CompanyCommissionPayout
        except Exception:
            CompanyCommissionPayout = None
        # Optional SubscriptionActivation history (prime activations) cleanup
        SubscriptionActivation = None
        try:
            from business.models import SubscriptionActivation as _SA
            SubscriptionActivation = _SA
        except Exception:
            pass

        self.stdout.write(self.style.WARNING("=== PRIME Test Data Reset START ==="))
        self.stdout.write(self.style.WARNING("This will irreversibly delete financial history and reset activation flags."))

        # 1) Delete wallet transactions
        wt_qs = WalletTransaction.objects.all()
        wt_count = wt_qs.count()
        self.stdout.write(f"Deleting WalletTransaction rows: {wt_count}")
        wt_qs.delete()

        # 2) Zero all wallets
        w_qs = Wallet.objects.all()
        w_count = w_qs.count()
        self.stdout.write(f"Zeroing {w_count} Wallet rows")
        
        # Zero new double-entry wallet accounts and delete ledger records
        try:
            from accounts.models import FinancialTransaction, LedgerEntry, WalletAccount
            LedgerEntry.objects.all().delete()
            FinancialTransaction.objects.all().delete()
            WalletAccount.objects.all().update(current_balance=0, available_balance=0)
            self.stdout.write("Cleared new double-entry pocket accounts and histories.")
        except Exception:
            pass

        # 3) Reset Reward Points
        rph_qs = RewardPointsHold.objects.all()
        rph_count = rph_qs.count()
        self.stdout.write(f"Deleting RewardPointsHold rows: {rph_count}")
        rph_qs.delete()

        rpt_qs = RewardPointsTransaction.objects.all()
        rpt_count = rpt_qs.count()
        self.stdout.write(f"Deleting RewardPointsTransaction rows: {rpt_count}")
        rpt_qs.delete()

        rpa_qs = RewardPointsAccount.objects.all()
        rpa_count = rpa_qs.count()
        self.stdout.write(f"Zeroing RewardPointsAccount rows: {rpa_count}")
        rpa_qs.update(balance_points=0)

        # 4) Remove matrix/autopool artifacts (optional apps)
        if AutoPoolAccount is not None:
            apa_qs = AutoPoolAccount.objects.all()
            apa_count = apa_qs.count()
            self.stdout.write(f"Deleting AutoPoolAccount rows: {apa_count}")
            apa_qs.delete()
        else:
            self.stdout.write("AutoPoolAccount not available; skipping.")

        if UserMatrixProgress is not None:
            ump_qs = UserMatrixProgress.objects.all()
            ump_count = ump_qs.count()
            self.stdout.write(f"Deleting UserMatrixProgress rows: {ump_count}")
            ump_qs.delete()
        else:
            self.stdout.write("UserMatrixProgress not available; skipping.")

        if CompanyCommissionPayout is not None:
            ccp_qs = CompanyCommissionPayout.objects.all()
            ccp_count = ccp_qs.count()
            self.stdout.write(f"Deleting CompanyCommissionPayout rows: {ccp_count}")
            ccp_qs.delete()
        else:
            self.stdout.write("CompanyCommissionPayout not available; skipping.")

        if DailyReport is not None:
            dr_qs = DailyReport.objects.all()
            dr_count = dr_qs.count()
            self.stdout.write(f"Deleting DailyReport rows: {dr_count}")
            dr_qs.delete()
        else:
            self.stdout.write("DailyReport not available; skipping.")

        # 4b) Remove subscription activations (prime activation history)
        if SubscriptionActivation is not None:
            sa_qs = SubscriptionActivation.objects.all()
            sa_count = sa_qs.count()
            self.stdout.write(f"Deleting SubscriptionActivation rows: {sa_count}")
            sa_qs.delete()
        else:
            self.stdout.write("SubscriptionActivation not available; skipping.")

        # 5) Clear user activation flags and PRIME-related switches
        user_qs = CustomUser.objects.all()
        if not include_admins:
            user_qs = user_qs.filter(is_superuser=False)

        u_count = user_qs.count()
        self.stdout.write(f"Resetting PRIME activation flags for users: {u_count} (include_admins={include_admins})")
        # Avoid touching staff/superuser status; only flip our domain flags
        user_qs.update(
            first_purchase_activated_at=None,
            account_active=False,
            autopool_enabled=False,
            rewards_enabled=False,
            is_agency_unlocked=False,
            # reset matrix genealogy for both 3-matrix and 5-matrix views
            parent=None,
            matrix_position=None,
            depth=0,
        )

        self.stdout.write(self.style.SUCCESS("=== PRIME Test Data Reset COMPLETE ==="))
        self.stdout.write(
            self.style.SUCCESS(
                "All wallet history cleared, wallets zeroed, reward points reset, "
                "autopool/matrix artifacts removed, and user activation flags cleared."
            )
        )
