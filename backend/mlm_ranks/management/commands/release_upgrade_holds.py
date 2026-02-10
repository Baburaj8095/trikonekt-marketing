from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from mlm_ranks.models import CommissionHold, UpgradeCommission
from mlm_ranks.services.config import (
    HOLD_REQUIRE_DIRECTS_GTE,
    HOLD_EARLY_RELEASE,
    COMPANY_ROOT_USER_ID,
    q2,
    Prime750StatusAdapter,
)
from mlm_ranks.services.commission import count_direct_rank_upgrades
from mlm_ranks.services.wallet import WalletPoster


class Command(BaseCommand):
    help = "Process held upgrade commissions: early release when eligible, or release/forfeit on/after release_date."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Do not write any changes; only print actions.")
        parser.add_argument(
            "--limit",
            type=int,
            default=500,
            help="Max number of holds to process in this run (default 500).",
        )

    def handle(self, *args, **options):
        dry = bool(options.get("dry_run"))
        limit = int(options.get("limit") or 500)
        today = date.today()

        qs = (
            CommissionHold.objects
            .select_related("commission", "commission__to_user", "commission__from_user", "commission__upgrade")
            .filter(status=CommissionHold.STATUS_PENDING)
            .order_by("release_date", "id")[:limit]
        )

        count_total = 0
        count_released = 0
        count_forfeited = 0
        msgs = []

        for hold in qs:
            count_total += 1
            c: UpgradeCommission = hold.commission
            if not c:
                continue
            to_user = getattr(c, "to_user", None)
            from_user = getattr(c, "from_user", None)
            upgrade = getattr(c, "upgrade", None)
            amt = q2(getattr(hold, "hold_amount", Decimal("0.00")) or Decimal("0.00"))
            if amt <= 0 or not to_user or not getattr(to_user, "id", None):
                continue

            # Determine eligibility based on 'Direct Completion' same-rank threshold:
            # For LEVEL holds -> need >=5 directs who have upgraded to THIS rank level (commission.level)
            # For DIRECT holds (legacy data, if any) -> no hold under new rule, treat as eligible.
            if c.commission_type == UpgradeCommission.TYPE_LEVEL:
                rank_level = int(getattr(c, "level", 0) or 0)
                directs = count_direct_rank_upgrades(to_user, rank_level)
            else:
                directs = 999  # direct sponsor payouts are not gated by this rule
            eligible_now = directs >= int(HOLD_REQUIRE_DIRECTS_GTE or 0)

            # Decide action:
            # - Early release path: before release_date and HOLD_EARLY_RELEASE enabled and eligible_now
            # - On/after release_date:
            #       if eligible -> release
            #       else -> forfeit to company root user (if present) or skip credit and just mark forfeited
            should_early_release = HOLD_EARLY_RELEASE and (today < hold.release_date) and eligible_now
            on_or_after = today >= hold.release_date

            if should_early_release or (on_or_after and eligible_now):
                # Release to recipient wallet
                action = "EARLY_RELEASE" if should_early_release else "RELEASE"
                msgs.append(f"{action}: Hold#{hold.id} -> user {to_user.id} ₹{amt} (directs={directs})")
                if not dry:
                    with transaction.atomic():
                        # Credit wallet using proper tx type
                        if c.commission_type == UpgradeCommission.TYPE_DIRECT:
                            WalletPoster.credit_direct(to_user, amt, from_user_id=getattr(from_user, "id", None) or 0, upgrade_id=getattr(upgrade, "id", None) or 0)
                        else:
                            WalletPoster.credit_level(to_user, amt, from_user_id=getattr(from_user, "id", None) or 0, upgrade_id=getattr(upgrade, "id", None) or 0, level=int(getattr(c, "level", 0) or 0))
                        # Mark rows
                        c.status = UpgradeCommission.STATUS_CREDITED
                        c.save(update_fields=["status"])
                        hold.status = CommissionHold.STATUS_RELEASED
                        hold.save(update_fields=["status"])
                count_released += 1
                continue

            if on_or_after and not eligible_now:
                # Forfeit to company root user
                msgs.append(f"FORFEIT: Hold#{hold.id} to company root ₹{amt} (directs={directs})")
                if not dry:
                    with transaction.atomic():
                        try:
                            from accounts.models import CustomUser
                            company = CustomUser.objects.filter(id=int(COMPANY_ROOT_USER_ID)).first()
                        except Exception:
                            company = None
                        if company and amt > 0:
                            # Credit to company ledger (use LEVEL tx for generic income marker)
                            WalletPoster.credit_level(company, amt, from_user_id=getattr(from_user, "id", None) or 0, upgrade_id=getattr(upgrade, "id", None) or 0, level=int(getattr(c, "level", 0) or 0))
                        c.status = UpgradeCommission.STATUS_FORFEITED
                        c.save(update_fields=["status"])
                        hold.status = CommissionHold.STATUS_FORFEITED
                        hold.save(update_fields=["status"])
                count_forfeited += 1
                continue

            # No action this cycle
            continue

        # Summary
        self.stdout.write(self.style.SUCCESS(f"Processed holds: {count_total}, released: {count_released}, forfeited: {count_forfeited}"))
        for m in msgs:
            self.stdout.write(m)
