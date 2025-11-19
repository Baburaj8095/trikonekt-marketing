from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable

from django.core.management.base import BaseCommand
from django.db.models import Sum, Q

from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import CommissionConfig


D = Decimal
Q2 = lambda x: D(str(x or 0)).quantize(D("0.01"), rounding=ROUND_HALF_UP)


# Keep this in sync with accounts.models.Wallet.credit COMMISSION_WITHHOLD_TYPES
COMMISSION_TYPES: set[str] = {
    "COMMISSION_CREDIT",
    "DIRECT_REF_BONUS",
    "LEVEL_BONUS",
    "AUTOPOOL_BONUS_FIVE",
    "AUTOPOOL_BONUS_THREE",
    "FRANCHISE_INCOME",
    "GLOBAL_ROYALTY",
}

# Non-ledger or synthetic entries that should not be counted as "main credits"
EXCLUDE_CREDIT_TYPES: set[str] = {
    "WITHDRAWABLE_CREDIT",
    "TAX_POOL_CREDIT",
}


def _sum_amount(qs) -> Decimal:
    return Q2(qs.aggregate(total=Sum("amount"))["total"] or 0)


class Command(BaseCommand):
    help = "Recompute dual wallet balances (main, withdrawable) for all users based on historical transactions and current tax percent."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply the computed balances to Wallet rows. If omitted, runs in dry-run mode.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Optional limit of users to process.",
        )
        parser.add_argument(
            "--user-id",
            type=int,
            default=None,
            help="Process a single user id (for debugging).",
        )

    def handle(self, *args, **options):
        apply_changes: bool = bool(options.get("apply"))
        limit: int | None = options.get("limit")
        one_user_id: int | None = options.get("user_id")

        cfg = CommissionConfig.get_solo()
        tax_percent = D(getattr(cfg, "tax_percent", D("10.00")) or D("10.00"))

        qs_users = CustomUser.objects.all().order_by("id")
        if one_user_id:
            qs_users = qs_users.filter(id=one_user_id)
        if limit:
            qs_users = qs_users[: int(limit)]

        total = qs_users.count()
        self.stdout.write(self.style.NOTICE(f"Backfill dual balances: users={total}, tax_percent={tax_percent}%, apply={apply_changes}"))

        processed = 0
        changed = 0

        for u in qs_users.iterator():
            processed += 1
            w = Wallet.get_or_create_for_user(u)

            tx = WalletTransaction.objects.filter(user=u)

            # 1) Commission gross and net
            gross_comm = _sum_amount(tx.filter(type__in=COMMISSION_TYPES, amount__gt=0))
            tax_total = Q2(gross_comm * tax_percent / D("100"))
            net_comm = Q2(gross_comm - tax_total)
            if net_comm < 0:
                net_comm = D("0.00")

            # 2) Withdrawals (only approved WITHDRAWAL_DEBIT touches withdrawable in our model)
            withdrawals_total_neg = _sum_amount(tx.filter(type="WITHDRAWAL_DEBIT"))  # negative by model
            withdrawals_total = Q2(-withdrawals_total_neg) if withdrawals_total_neg < 0 else D("0.00")

            # 3) Compute withdrawable balance
            withdrawable_calc = Q2(net_comm - withdrawals_total)
            if withdrawable_calc < 0:
                withdrawable_calc = D("0.00")

            # 4) Main balance:
            #    Sum of all positive credits excluding synthetic WITHDRAWABLE_CREDIT & TAX_POOL_CREDIT
            credits_main = _sum_amount(tx.filter(amount__gt=0).exclude(type__in=EXCLUDE_CREDIT_TYPES))
            #    Debits that reduce main (i.e., NOT WITHDRAWAL_DEBIT). Amounts are negative; take abs sum.
            debits_non_withdrawal = _sum_amount(tx.filter(amount__lt=0).exclude(type="WITHDRAWAL_DEBIT"))
            debits_non_withdrawal_abs = Q2(-debits_non_withdrawal) if debits_non_withdrawal < 0 else D("0.00")
            main_calc = Q2(credits_main - debits_non_withdrawal_abs)
            if main_calc < 0:
                main_calc = D("0.00")

            # 5) Total balance sanity (optional): leave as-is; it is managed by live runtime.
            #    If needed, this is the recomputed total across all tx:
            total_balance_calc = _sum_amount(tx)  # includes negatives

            # Round last-cent correction
            # Ensure main + withdrawable is not less than total (best-effort, do not strictly enforce)
            # Not adjusting here to avoid surprises.

            # Check changes
            old_main = Q2(getattr(w, "main_balance", 0) or 0)
            old_with = Q2(getattr(w, "withdrawable_balance", 0) or 0)
            will_change = (old_main != main_calc) or (old_with != withdrawable_calc)

            self.stdout.write(
                f"[{processed}/{total}] user={u.id} {u.username} "
                f"gross_comm={gross_comm} tax={tax_total} net_comm={net_comm} "
                f"withdrawals={withdrawals_total} -> withdrawable={withdrawable_calc} "
                f"| main_old={old_main} main_new={main_calc} | wd_old={old_with} wd_new={withdrawable_calc}"
            )

            if apply_changes and will_change:
                try:
                    w.main_balance = main_calc
                    w.withdrawable_balance = withdrawable_calc
                    # Keep legacy balance as-is; it will be consistent for new transactions forward.
                    w.save(update_fields=["main_balance", "withdrawable_balance", "updated_at"])
                    changed += 1
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"Failed to update wallet for user {u.id}: {e}"))

        self.stdout.write(self.style.SUCCESS(f"Done. processed={processed}, changed={changed}, apply={apply_changes}"))
