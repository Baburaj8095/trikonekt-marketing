from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import List, Optional


# -------- Global constants (override via env if wired later) --------
GST_RATE = Decimal("0.15")
LEVELS = 10
LEVEL_SPLIT_EQUAL = True  # If True, level pool is split equally across 10 levels
COMPANY_ROOT_USER_ID = 32  # Provided by client; can be overridden by env later
HOLD_DAYS = 7
HOLD_REQUIRE_DIRECTS_GTE = 5
HOLD_EARLY_RELEASE = True

# Eligibility gates
REQUIRE_PRIME750_FOR_DOWNLINE_COUNT = True
REQUIRE_PRIME750_FOR_RECIPIENT = True
REQUIRE_MIN_5_PRIME750_DIRECTS_FOR_ALL_RANKS = True


def q2(x) -> Decimal:
    from decimal import Decimal as D
    try:
        return D(str(x or "0")).quantize(D("0.01"))
    except Exception:
        return D("0.00")


def approx(a, b, eps=Decimal("0.75")) -> bool:
    try:
        from decimal import Decimal as D
        return abs(D(str(a)) - D(str(b))) < D(str(eps))
    except Exception:
        return abs(float(a) - float(b)) < float(eps)


# -------- Prime750 adapter (read-only; no edits to existing apps) --------
class Prime750StatusAdapter:
    """
    Detect whether a user is PRIME 750 active using existing PromoPurchase data.
    Policy:
      - Exists an APPROVED PromoPurchase for this user whose package ~ 750 (by price) OR code contains '750'.
      - TYPE should be 'PRIME' (defensive).
    """

    @classmethod
    def is_user_prime750_active(cls, user) -> bool:
        try:
            from business.models import PromoPurchase, PromoPackage
            from django.db.models import Q
            if not user or not getattr(user, "id", None):
                return False
            qs = (
                PromoPurchase.objects
                .filter(user_id=getattr(user, "id", None), status="APPROVED")
                .select_related("package")
            )
            # Heuristics: price ~ 750 or code contains 750; type PRIME preferred
            qs = qs.filter(
                Q(package__type="PRIME")
                & (
                    Q(package__price__gte=Decimal("749.00"), package__price__lte=Decimal("751.00"))
                    | Q(package__code__icontains="750")
                    | Q(package__name__icontains="750")
                )
            )
            return qs.exists()
        except Exception:
            return False

    @classmethod
    def count_prime750_directs(cls, user) -> int:
        """
        Count directs (registered_by=user) who are PRIME 750 active.
        """
        try:
            from accounts.models import CustomUser
            directs = CustomUser.objects.filter(registered_by_id=getattr(user, "id", None)).only("id")
        except Exception:
            return 0
        count = 0
        for d in directs:
            try:
                if cls.is_user_prime750_active(d):
                    count += 1
            except Exception:
                continue
        return int(count)


@dataclass
class LevelDistribution:
    """
    Level distribution percentages or equal split.
    When equal split is enabled, percents list is ignored and equal parts are used.
    """
    levels: int = LEVELS
    percents: Optional[List[Decimal]] = None

    def share_for_level(self, total: Decimal, idx1_based: int) -> Decimal:
        if LEVEL_SPLIT_EQUAL or not self.percents:
            part = (total / Decimal(self.levels)) if self.levels > 0 else Decimal("0.00")
            return q2(part)
        # If custom percents provided, use them normalized over 100
        try:
            pct = self.percents[idx1_based - 1]
        except Exception:
            pct = Decimal("0")
        return q2((total * Decimal(str(pct or 0))) / Decimal("100"))
