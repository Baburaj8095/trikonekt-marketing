from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import CustomUser, Wallet
from business.models import WithholdingReserve


D = Decimal
def Q2(x) -> Decimal:
    return D(str(x or 0)).quantize(D("0.01"), rounding=ROUND_HALF_UP)


class Command(BaseCommand):
    help = (
        "One-time legacy split: move legacy Wallet.balance into dual balances and park 10% (or --percent) "
        "into WithholdingReserve for later distribution. "
        "This does not mutate Wallet.balance (legacy), only main_balance and withdrawable_balance."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply changes to the database. If omitted, runs in dry-run mode.",
        )
        parser.add_argument(
            "--percent",
            type=float,
            default=10.0,
            help="Percent to withhold into reserve (default: 10.0).",
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
        parser.add_argument(
            "--batch-id",
            type=str,
            default="LEGACY_INITIAL",
            help="Batch id recorded in WithholdingReserve.source_id (default: LEGACY_INITIAL).",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force re-split even if main/withdrawable already > 0 or a reserve exists for this batch.",
        )
        parser.add_argument(
            "--exclude-staff-company",
            action="store_true",
            help="Exclude superusers/staff and users with category=company.",
        )

    def handle(self, *args, **options):
        apply_changes: bool = bool(options.get("apply"))
        percent: float = float(options.get("percent") or 10.0)
        limit: Optional[int] = options.get("limit")
        one_user_id: Optional[int] = options.get("user_id")
        batch_id: str = str(options.get("batch_id") or "LEGACY_INITIAL")
        force: bool = bool(options.get("force"))
        exclude_sc: bool = bool(options.get("exclude_staff_company"))

        if percent < 0 or percent > 100:
            self.stderr.write(self.style.ERROR("percent must be between 0 and 100"))
            return

        withhold_pct = Q2(percent)

        qs = CustomUser.objects.all().order_by("id")
        if one_user_id:
            qs = qs.filter(id=one_user_id)
        if exclude_sc:
            qs = qs.exclude(category="company").exclude(is_superuser=True).exclude(is_staff=True)
        if limit:
            qs = qs[: int(limit)]

        total = qs.count()
        self.stdout.write(
            self.style.NOTICE(
                f"Legacy split: users={total}, percent={withhold_pct}%, batch_id={batch_id}, apply={apply_changes}, force={force}"
            )
        )

        processed = 0
        changed = 0
        skipped = 0

        sum_gross = D("0.00")
        sum_net = D("0.00")
        sum_withheld = D("0.00")

        for u in qs.iterator():
            processed += 1
            w = Wallet.get_or_create_for_user(u)
            # Use current legacy balance (gross), clamp at >= 0
            gross = Q2((w.balance or D("0.00")))
            if gross <= 0:
                skipped += 1
                self.stdout.write(f"[{processed}/{total}] user={u.id} {u.username} gross=0 -> SKIP")
                continue

            # Idempotency guards unless --force
            already_split = (Q2(getattr(w, "main_balance", 0) or 0) > 0) or (Q2(getattr(w, "withdrawable_balance", 0) or 0) > 0)
            existing_reserve = WithholdingReserve.objects.filter(user=u, source_type="LEGACY_SPLIT", source_id=batch_id).exists()
            if not force and (already_split or existing_reserve):
                skipped += 1
                self.stdout.write(
                    f"[{processed}/{total}] user={u.id} {u.username} already_split={already_split} existing_reserve={existing_reserve} -> SKIP"
                )
                continue

            withheld = Q2(gross * withhold_pct / D("100"))
            net = Q2(gross - withheld)
            # Double-check rounding invariant
            if net < 0:
                net = D("0.00")
            if withheld < 0:
                withheld = D("0.00")

            self.stdout.write(
                f"[{processed}/{total}] user={u.id} {u.username} gross={gross} -> main+=gross, withdrawable+=net={net}, reserve(withheld)={withheld}"
            )

            sum_gross += gross
            sum_net += net
            sum_withheld += withheld

            if apply_changes:
                try:
                    with transaction.atomic():
                        # Lock wallet row
                        w_lock = Wallet.objects.select_for_update().get(pk=w.pk)
                        # Recompute from locked row
                        gross_locked = Q2((w_lock.balance or D("0.00")))
                        if gross_locked <= 0 and not force:
                            # If balance changed to <=0 since we read it, skip quietly
                            skipped += 1
                            continue

                        w_lock.main_balance = Q2((w_lock.main_balance or D("0.00")) + gross)
                        w_lock.withdrawable_balance = Q2((w_lock.withdrawable_balance or D("0.00")) + net)
                        # Do NOT change w_lock.balance (legacy)
                        w_lock.save(update_fields=["main_balance", "withdrawable_balance", "updated_at"])

                        # Insert reserve row (idempotency at DB layer for this user+batch)
                        if not WithholdingReserve.objects.filter(user=u, source_type="LEGACY_SPLIT", source_id=batch_id).exists():
                            WithholdingReserve.objects.create(
                                user=u,
                                source_type="LEGACY_SPLIT",
                                source_id=batch_id,
                                percent=withhold_pct,
                                gross_amount=gross,
                                withheld_amount=withheld,
                                status="reserved",
                                breakdown=None,
                                notes="Initial legacy split",
                            )
                        changed += 1
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"Failed to split user {u.id} {u.username}: {e}"))

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. processed={processed}, changed={changed}, skipped={skipped}, apply={apply_changes} | "
                f"Σgross={Q2(sum_gross)} Σnet={Q2(sum_net)} Σwithheld={Q2(sum_withheld)}"
            )
        )
