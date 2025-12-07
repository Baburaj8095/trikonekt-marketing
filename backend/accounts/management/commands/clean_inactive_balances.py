from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from decimal import Decimal

from accounts.models import CustomUser, Wallet
from business.models import RewardProgress


class Command(BaseCommand):
    help = "Zero wallet balances and reward progress for INACTIVE users. Optionally target a single user."

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            type=str,
            help="Target a specific user by username/prefixed_id/phone-digits",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Do not write changes; only print what would be changed",
        )
        parser.add_argument(
            "--include-active",
            action="store_true",
            help="Also clean balances for active users (NOT recommended). Default only inactive users are processed.",
        )

    def _resolve_user(self, token: str):
        """
        Resolve a user by:
          - exact username (case-insensitive)
          - prefixed_id (case-insensitive)
          - phone digits (strip non-digits)
        """
        if not token:
            return None
        t = (token or "").strip()
        digits = "".join(ch for ch in t if ch.isdigit())

        qs = CustomUser.objects.all()
        user = (
            qs.filter(username__iexact=t).first()
            or qs.filter(prefixed_id__iexact=t).first()
        )
        if not user and digits:
            user = qs.filter(phone__iexact=digits).first()
        return user

    def handle(self, *args, **options):
        username = options.get("username")
        dry_run = options.get("dry_run", False)
        include_active = options.get("include_active", False)

        if username:
            user = self._resolve_user(username)
            if not user:
                raise CommandError(f"User not found for token: {username}")
            users_qs = CustomUser.objects.filter(id=user.id)
        else:
            users_qs = CustomUser.objects.all()
            if not include_active:
                users_qs = users_qs.filter(account_active=False)

        total_users = users_qs.count()
        self.stdout.write(self.style.MIGRATE_HEADING(f"Cleaning balances for {total_users} user(s)..."))
        changed = 0
        errors = 0

        for u in users_qs.iterator():
            try:
                # RewardProgress: reset coupon_count to 0
                rp, _ = RewardProgress.objects.get_or_create(user=u)
                prev_cc = int(getattr(rp, "coupon_count", 0) or 0)

                # Wallet cleanup
                w = Wallet.get_or_create_for_user(u)
                bal = Decimal(getattr(w, "balance", 0) or 0)
                main = Decimal(getattr(w, "main_balance", 0) or 0)
                wd = Decimal(getattr(w, "withdrawable_balance", 0) or 0)

                will_change = (prev_cc != 0) or (bal != 0) or (main != 0) or (wd != 0)
                if not will_change:
                    continue

                self.stdout.write(f"- {u.username} (active={getattr(u, 'account_active', None)}): wallet={bal} (main={main}, wd={wd}), reward_coupons={prev_cc}")

                if dry_run:
                    changed += 1
                    continue

                with transaction.atomic():
                    # Reset rewards progress
                    if prev_cc != 0:
                        rp.coupon_count = 0
                        rp.save(update_fields=["coupon_count", "updated_at"])

                    # Wallet adjust to zero
                    # Prefer using debit() to keep ledger consistent; fallback to direct zero on any error.
                    if bal != 0:
                        try:
                            amt = abs(bal)
                            if bal > 0:
                                # Bring balance to zero via ADJUSTMENT_DEBIT
                                w.debit(amt, tx_type="ADJUSTMENT_DEBIT", meta={"reason": "inactive_cleanup"})
                            else:
                                # Negative balance: bring back to zero using ADJUSTMENT_CREDIT
                                # Note: credit() is guarded for inactive but allows ADJUSTMENT_* types
                                w.credit(amt, tx_type="ADJUSTMENT_CREDIT", meta={"reason": "inactive_cleanup"})
                        except Exception:
                            # Hard reset as last resort
                            w.balance = Decimal("0.00")
                            w.main_balance = Decimal("0.00")
                            w.withdrawable_balance = Decimal("0.00")
                            w.save(update_fields=["balance", "main_balance", "withdrawable_balance", "updated_at"])

                    # Safety: if any tiny rounding residuals remain, hard set to 0
                    try:
                        w.refresh_from_db()
                        dirty = False
                        if w.balance != 0:
                            w.balance = Decimal("0.00"); dirty = True
                        if w.main_balance != 0:
                            w.main_balance = Decimal("0.00"); dirty = True
                        if w.withdrawable_balance != 0:
                            w.withdrawable_balance = Decimal("0.00"); dirty = True
                        if dirty:
                            w.save(update_fields=["balance", "main_balance", "withdrawable_balance", "updated_at"])
                    except Exception:
                        pass

                changed += 1
            except Exception as e:
                errors += 1
                self.stderr.write(self.style.ERROR(f"  ! Failed for {getattr(u, 'username', u.id)}: {e}"))

        self.stdout.write(self.style.SUCCESS(f"Done. Changed={changed}, Errors={errors}, TotalConsidered={total_users}"))
        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run mode: No database changes were made."))
