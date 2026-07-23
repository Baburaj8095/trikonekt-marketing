from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import Optional, List

from django.utils import timezone

from ..models import RankUpgrade, UpgradeCommission, CommissionHold
from .config import (
    q2,
    GST_RATE,
    LEVELS,
    LevelDistribution,
    COMPANY_ROOT_USER_ID,
    HOLD_DAYS,
    HOLD_REQUIRE_DIRECTS_GTE,
    HOLD_EARLY_RELEASE,
    Prime750StatusAdapter,
    REQUIRE_PRIME750_FOR_RECIPIENT,
)
from .upline import UplineService
from .eligibility import RankEligibilityService
from .wallet import WalletPoster


@dataclass
class ShareResult:
    created: int
    released_amount: Decimal
    held_amount: Decimal


def count_directs_upgraded_to_rank1(user) -> int:
    """
    Count how many direct referrals of `user` have successfully completed the Rank 1 upgrade.
    This is the prerequisite for Level Income release: require >= HOLD_REQUIRE_DIRECTS_GTE directs at Rank 1.
    """
    try:
        from accounts.models import CustomUser
        directs = CustomUser.objects.filter(registered_by_id=getattr(user, "id", None)).values_list("id", flat=True)
        if not directs:
            return 0
        return int(
            RankUpgrade.objects.filter(
                user_id__in=list(directs),
                payment_status=RankUpgrade.STATUS_SUCCESS,
                to_rank__level_number=1,
            )
            .values("user_id")
            .distinct()
            .count()
        )
    except Exception:
        return 0


class CommissionDistributor:
    """
    Implements 50/50 split:
      - 50% direct to sponsor (or company root if no sponsor/recipient ineligible)
      - 50% level bonus to a SINGLE hierarchical level equal to the purchased rank's level_number (no multi-level split).
        For rank 1, level bonus also goes to L1 (direct sponsor). If the exact level recipient
        is missing or ineligible, credit the company root user.
    Eligibility for recipient:
      - Must be PRIME 750 active
      - Must have rank.level_number >= level index (for level income only)
    Hold rule:
      - Applies only to LEVEL income and is based on directs who completed Rank 1:
        if recipient has < HOLD_REQUIRE_DIRECTS_GTE directs upgraded to Rank 1, release 25% immediately
        and hold 25% for HOLD_DAYS days (early release when threshold met).
    """

    @classmethod
    def _is_recipient_eligible_for_level(cls, user, level_idx: int) -> bool:
        if REQUIRE_PRIME750_FOR_RECIPIENT and not Prime750StatusAdapter.is_user_prime750_active(user):
            return False
        # Rank threshold: current_rank.level_number >= level_idx
        _, urank = RankEligibilityService.get_or_bootstrap_user_rank(user)
        try:
            lvl = int(getattr(urank, "level_number", 0) or 0)
        except Exception:
            lvl = 0
        return lvl >= int(level_idx or 0)

    @classmethod
    def _is_recipient_eligible_for_direct(cls, user) -> bool:
        if REQUIRE_PRIME750_FOR_RECIPIENT and not Prime750StatusAdapter.is_user_prime750_active(user):
            return False
        return True

    @classmethod
    def _apply_hold_and_credit(
        cls,
        *,
        upgrade: RankUpgrade,
        from_user,
        to_user,
        base_amount: Decimal,
        level: int,
        tx_type: str,
        now,
    ) -> ShareResult:
        """
        Applies the hold rule and credits the released portion immediately.
        Creates UpgradeCommission row(s) and optional CommissionHold row.
        """
        amt = q2(base_amount)
        if amt <= 0:
            return ShareResult(created=0, released_amount=q2(0), held_amount=q2(0))

        # Hold applies ONLY to LEVEL income and is based on recipient's count of directs
        # who have completed the SAME rank upgrade (rank_level == `level` here).
        if tx_type == "LEVEL":
            # Hold rule disabled per user request
            needs_hold = False
            directs = None
        else:
            # Direct sponsor commission: no hold as per business rule
            needs_hold = False
            directs = None

        created = 0
        released_total = q2(0)
        held_total = q2(0)

        if needs_hold:
            # 25% release now, 25% hold
            release_amt = q2(amt * Decimal("0.25"))
            hold_amt = q2(amt * Decimal("0.25"))

            # Release portion
            if release_amt > 0:
                if tx_type == "DIRECT":
                    WalletPoster.credit_direct(to_user, release_amt, from_user_id=getattr(from_user, "id", None) or 0, upgrade_id=upgrade.id)
                else:
                    WalletPoster.credit_level(to_user, release_amt, from_user_id=getattr(from_user, "id", None) or 0, upgrade_id=upgrade.id, level=level)
                UpgradeCommission.objects.create(
                    upgrade=upgrade,
                    from_user=from_user,
                    to_user=to_user,
                    level=level,
                    commission_amount=release_amt,
                    commission_type=tx_type,
                    status=UpgradeCommission.STATUS_CREDITED,
                )
                created += 1
                released_total += release_amt

            # Held portion
            if hold_amt > 0:
                uc = UpgradeCommission.objects.create(
                    upgrade=upgrade,
                    from_user=from_user,
                    to_user=to_user,
                    level=level,
                    commission_amount=hold_amt,
                    commission_type=tx_type,
                    status=UpgradeCommission.STATUS_HELD,
                )
                rel_date = (upgrade.upgraded_at or now).date() + timedelta(days=int(HOLD_DAYS or 7))
                CommissionHold.objects.create(
                    commission=uc,
                    hold_amount=hold_amt,
                    release_date=rel_date,
                    status=CommissionHold.STATUS_PENDING,
                )
                created += 1
                held_total += hold_amt
        else:
            # Full release immediately
            if tx_type == "DIRECT":
                WalletPoster.credit_direct(to_user, amt, from_user_id=getattr(from_user, "id", None) or 0, upgrade_id=upgrade.id)
            else:
                WalletPoster.credit_level(to_user, amt, from_user_id=getattr(from_user, "id", None) or 0, upgrade_id=upgrade.id, level=level)
            UpgradeCommission.objects.create(
                upgrade=upgrade,
                from_user=from_user,
                to_user=to_user,
                level=level,
                commission_amount=amt,
                commission_type=tx_type,
                status=UpgradeCommission.STATUS_CREDITED,
            )
            created += 1
            released_total += amt

        return ShareResult(created=created, released_amount=released_total, held_amount=held_total)

    @classmethod
    def distribute(cls, upgrade: RankUpgrade):
        """
        Execute full 50/50 distribution for a successful upgrade.
        """
        if not upgrade or not getattr(upgrade, "id", None):
            return

        now = timezone.now()
        payer = getattr(upgrade, "user", None)

        net = q2(getattr(upgrade, "net_amount", Decimal("0.00")) or Decimal("0.00"))
        if net <= 0:
            return
        # Idempotency: avoid duplicate payouts if already distributed
        if UpgradeCommission.objects.filter(upgrade_id=upgrade.id).exists():
            return

        # 50/50 split
        direct_bonus = q2(net * Decimal("0.50"))
        level_pool = q2(net * Decimal("0.50"))

        # 1) Direct sponsor share (level=0)
        sponsor = UplineService.get_direct_sponsor(payer)
        recipient_direct = None
        if sponsor and cls._is_recipient_eligible_for_direct(sponsor):
            recipient_direct = sponsor
        else:
            # fallback to company root user (id=COMPANY_ROOT_USER_ID)
            try:
                from accounts.models import CustomUser
                recipient_direct = CustomUser.objects.filter(id=int(COMPANY_ROOT_USER_ID)).first()
            except Exception:
                recipient_direct = None

        if recipient_direct and direct_bonus > 0:
            cls._apply_hold_and_credit(
                upgrade=upgrade,
                from_user=payer,
                to_user=recipient_direct,
                base_amount=direct_bonus,
                level=0,
                tx_type="DIRECT",
                now=now,
            )

        # 2) Level bonus to the R-th ancestor in the Rank Matrix parent chain:
        target_level = int(getattr(getattr(upgrade, "to_rank", None), "level_number", 0) or 0)
        if target_level > 0 and level_pool > 0:
            ancestors = []
            curr = payer
            for _ in range(target_level):
                try:
                    from ..models import RankMatrixNode
                    node = RankMatrixNode.objects.filter(placed_user=curr).first()
                    if not node:
                        break
                    curr = node.parent_user
                    ancestors.append(curr)
                except Exception:
                    break

            recipient = None
            cand = ancestors[target_level - 1] if len(ancestors) >= target_level else None
            if cand and cls._is_recipient_eligible_for_level(cand, target_level):
                recipient = cand

            if not recipient:
                # Fallback to Company Root ID for this level share
                try:
                    from accounts.models import CustomUser
                    company = CustomUser.objects.filter(id=int(COMPANY_ROOT_USER_ID)).first()
                except Exception:
                    company = None
                if company:
                    # Credit immediately to company (no holds for company fallback)
                    WalletPoster.credit_level(
                        company,
                        level_pool,
                        from_user_id=getattr(payer, "id", None) or 0,
                        upgrade_id=upgrade.id,
                        level=target_level,
                    )
                    UpgradeCommission.objects.create(
                        upgrade=upgrade,
                        from_user=payer,
                        to_user=company,
                        level=target_level,
                        commission_amount=level_pool,
                        commission_type="LEVEL",
                        status=UpgradeCommission.STATUS_CREDITED,
                    )
            else:
                res = cls._apply_hold_and_credit(
                    upgrade=upgrade,
                    from_user=payer,
                    to_user=recipient,
                    base_amount=level_pool,
                    level=target_level,
                    tx_type="LEVEL",
                    now=now,
                )
                # Event-driven reevaluation for this recipient's holds (early release/expiry)
                try:
                    from .five_matrix import FiveMatrixService  # local import to avoid cycle
                    FiveMatrixService.reevaluate_user_holds(getattr(recipient, "id", None))
                except Exception:
                    pass
