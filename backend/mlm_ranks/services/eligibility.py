from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Optional, Tuple, List, Set

from django.db.models import Q

from ..models import Rank, UserRank
from .config import Prime750StatusAdapter, REQUIRE_PRIME750_FOR_DOWNLINE_COUNT, REQUIRE_MIN_5_PRIME750_DIRECTS_FOR_ALL_RANKS


@dataclass
class EligibilityResult:
    eligible: bool
    next_rank_id: Optional[int]
    next_rank_name: Optional[str]
    level_number: Optional[int]
    team_size_required: int
    current_team_size: int
    direct_count: int
    upgrade_amount: Optional[Decimal]
    reason: Optional[str] = None


class RankEligibilityService:
    """
    Computes:
      - current rank for user
      - direct_count (Prime 750 gated)
      - current team size (Prime 750 gated)
      - next rank eligibility (>=5 prime directs AND team size meets requirement)
    Notes:
      - Team size is measured over the sponsor (registered_by) referral tree, not matrix accounts.
      - Counting is limited to 10 levels depth which matches L1..L10 thresholds.
    """

    MAX_LEVELS = 10  # depth for subtree count

    @classmethod
    def get_or_bootstrap_user_rank(cls, user) -> Tuple[UserRank, Rank]:
        # Default rank is L1 Prime Starter if exists; else the lowest level rank.
        cur_rank = Rank.objects.order_by("level_number").first()
        ur, _ = UserRank.objects.get_or_create(
            user_id=getattr(user, "id", None),
            defaults={"current_rank": cur_rank} if cur_rank else {},
        )
        if not getattr(ur, "current_rank_id", None):
            if cur_rank:
                ur.current_rank = cur_rank
                ur.save(update_fields=["current_rank"])
        return ur, ur.current_rank

    @classmethod
    def _children_of(cls, parent_ids: List[int]) -> List[int]:
        """
        Returns user ids that have registered_by_id in parent_ids.
        """
        if not parent_ids:
            return []
        try:
            from accounts.models import CustomUser
            qs = CustomUser.objects.filter(registered_by_id__in=parent_ids).values_list("id", flat=True)
            return list(qs)
        except Exception:
            return []

    @classmethod
    def _count_prime750_subtree(cls, root_user_id: int, max_levels: int = MAX_LEVELS) -> int:
        """
        BFS over registered_by tree limited to `max_levels` under the root (excluding root),
        counting only users that are PRIME 750 active.
        """
        if not root_user_id:
            return 0
        total = 0
        frontier: List[int] = [root_user_id]
        visited: Set[int] = set([root_user_id])
        level = 0
        while frontier and level < max_levels:
            # expand one level
            children = cls._children_of(frontier)
            frontier = []
            for uid in children:
                if uid in visited:
                    continue
                visited.add(uid)
                # include in team size if Prime 750 active
                try:
                    from accounts.models import CustomUser
                    u = CustomUser.objects.only("id").get(id=uid)
                except Exception:
                    u = None
                if u and Prime750StatusAdapter.is_user_prime750_active(u):
                    total += 1
                frontier.append(uid)
            level += 1
        return int(total)

    @classmethod
    def compute_directs_prime750(cls, user) -> int:
        return Prime750StatusAdapter.count_prime750_directs(user)

    @classmethod
    def compute_team_size_prime750(cls, user) -> int:
        """
        Counts only Prime 750 active downlines in referral subtree (up to MAX_LEVELS).
        """
        if not user or not getattr(user, "id", None):
            return 0
        return cls._count_prime750_subtree(int(getattr(user, "id", 0) or 0), max_levels=cls.MAX_LEVELS)

    @classmethod
    def get_next_rank(cls, current: Rank) -> Optional[Rank]:
        if not current:
            return Rank.objects.order_by("level_number").first()
        return Rank.objects.filter(level_number__gt=current.level_number).order_by("level_number").first()

    @classmethod
    def evaluate(cls, user) -> EligibilityResult:
        ur, cur_rank = cls.get_or_bootstrap_user_rank(user)
        # Compute gated directs and team size
        direct_count = cls.compute_directs_prime750(user)
        team_size = cls.compute_team_size_prime750(user) if REQUIRE_PRIME750_FOR_DOWNLINE_COUNT else 0

        # Update cached counters (best-effort; no writes to existing files)
        try:
            if (ur.direct_count != direct_count) or (ur.total_team_size != team_size):
                ur.direct_count = direct_count
                ur.total_team_size = team_size
                ur.save(update_fields=["direct_count", "total_team_size"])
        except Exception:
            pass

        next_rank = cls.get_next_rank(cur_rank)
        if not next_rank:
            return EligibilityResult(
                eligible=False,
                next_rank_id=None,
                next_rank_name=None,
                level_number=getattr(cur_rank, "level_number", None),
                team_size_required=0,
                current_team_size=team_size,
                direct_count=direct_count,
                upgrade_amount=None,
                reason="Already at top rank" if cur_rank else "No ranks configured",
            )

        # Baseline rule: at least 5 Prime 750 directs for all ranks
        if REQUIRE_MIN_5_PRIME750_DIRECTS_FOR_ALL_RANKS and direct_count < 5:
            return EligibilityResult(
                eligible=False,
                next_rank_id=next_rank.id,
                next_rank_name=next_rank.rank_name,
                level_number=next_rank.level_number,
                team_size_required=next_rank.team_size_required,
                current_team_size=team_size,
                direct_count=direct_count,
                upgrade_amount=next_rank.upgrade_amount,
                reason="Requires minimum 5 Prime-750 active directs",
            )

        # Team size rule: only prime-750 downlines count
        if team_size < int(next_rank.team_size_required or 0):
            return EligibilityResult(
                eligible=False,
                next_rank_id=next_rank.id,
                next_rank_name=next_rank.rank_name,
                level_number=next_rank.level_number,
                team_size_required=next_rank.team_size_required,
                current_team_size=team_size,
                direct_count=direct_count,
                upgrade_amount=next_rank.upgrade_amount,
                reason="Team size not met",
            )

        return EligibilityResult(
            eligible=True,
            next_rank_id=next_rank.id,
            next_rank_name=next_rank.rank_name,
            level_number=next_rank.level_number,
            team_size_required=next_rank.team_size_required,
            current_team_size=team_size,
            direct_count=direct_count,
            upgrade_amount=next_rank.upgrade_amount,
            reason=None,
        )
