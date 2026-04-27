from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from typing import DefaultDict, Dict, Iterable, List, Optional, Set, Tuple

from django.core.management.base import BaseCommand
from django.db.models import Q, Sum


@dataclass(frozen=True)
class RootEarningRow:
    pool: str
    root_id: int
    username_key: str
    user_entry_index: int
    team_size: int
    earned_gross: Decimal


def _q2(x: object) -> Decimal:
    try:
        return Decimal(str(x or "0")).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def _iter_descendant_sources(*, root_id: int, pool: str, depth: int) -> Tuple[Set[int], Dict[str, Set[str]]]:
    """Return (visited_ids, sources) for ACTIVE subtree up to depth.

    - visited_ids includes root_id and all descendant AutoPoolAccount ids reached.
    - sources maps lower(source_type) -> set(source_id) for descendants only (excluding root).
    """
    from business.models import AutoPoolAccount

    visited: Set[int] = {int(root_id)}
    frontier: List[int] = [int(root_id)]

    sources: Dict[str, Set[str]] = {}

    for _lvl in range(1, max(1, int(depth)) + 1):
        if not frontier:
            break
        rows = list(
            AutoPoolAccount.objects.filter(parent_account_id__in=frontier, pool_type=pool, status="ACTIVE")
            .values("id", "source_type", "source_id")
        )
        next_frontier: List[int] = []
        for r in rows:
            try:
                cid = int(r.get("id") or 0)
            except Exception:
                continue
            if cid in visited:
                continue
            visited.add(cid)
            next_frontier.append(cid)

            st = str(r.get("source_type") or "").strip()
            sid = str(r.get("source_id") or "").strip()
            if st and sid:
                key = st.lower()
                if key not in sources:
                    sources[key] = set()
                sources[key].add(sid)

        frontier = next_frontier

    return visited, sources


def _sum_gross_matrix_earnings_for_sources(*, user_id: int, tx_type: str, sources: Dict[str, Set[str]]) -> Decimal:
    """Gross earnings for a semantic matrix tx_type restricted to activation sources.

    Supports both:
    - legacy rows: type=tx_type
    - streaming rows: type in (INCOME_CREDIT_75, SELF_ACCOUNT_CREDIT) with meta.orig_type=tx_type
    """
    from accounts.models import WalletTransaction

    cond = Q()
    for st_lower, ids in (sources or {}).items():
        if ids:
            cond |= Q(source_type__iexact=st_lower, source_id__in=list(ids))
    if not cond:
        return Decimal("0.00")

    base = WalletTransaction.objects.filter(user_id=int(user_id), amount__gt=0).filter(cond)

    raw_total = base.filter(type=tx_type).aggregate(total=Sum("amount"))["total"] or 0
    split_total = (
        base.filter(
            type__in=("INCOME_CREDIT_75", "SELF_ACCOUNT_CREDIT"),
            meta__orig_type=tx_type,
        ).aggregate(total=Sum("amount"))["total"]
        or 0
    )

    return _q2(raw_total) + _q2(split_total)


class Command(BaseCommand):
    help = (
        "Report gross matrix earnings per root AutoPoolAccount ID for a user. "
        "Earnings are attributed to a root by summing payouts triggered by activations inside that root's subtree."
    )

    def add_arguments(self, parser):
        parser.add_argument("--user-id", type=int, default=0, help="User id (CustomUser.id)")
        parser.add_argument("--username", type=str, default="", help="User username")
        parser.add_argument(
            "--pool",
            type=str,
            default="FIVE_150",
            help="Pool type: FIVE_150 or THREE_150",
        )
        parser.add_argument(
            "--depth",
            type=int,
            default=0,
            help="Traversal depth (defaults: FIVE_150=10, THREE_150=15)",
        )
        parser.add_argument(
            "--exclude-ambiguous",
            action="store_true",
            help="Exclude RECOVERY/RESTORATION/BACKFILL/SENTINEL roots from the report.",
        )

    def handle(self, *args, **options):
        from django.contrib.auth import get_user_model
        from business.models import AutoPoolAccount

        user_id = int(options.get("user_id") or 0)
        username = str(options.get("username") or "").strip()
        pool = str(options.get("pool") or "FIVE_150").strip().upper()
        depth = int(options.get("depth") or 0)
        exclude_ambiguous = bool(options.get("exclude_ambiguous"))

        if pool not in ("FIVE_150", "THREE_150"):
            raise SystemExit("pool must be FIVE_150 or THREE_150")

        if depth <= 0:
            depth = 15 if pool == "THREE_150" else 10

        if user_id <= 0 and not username:
            raise SystemExit("Provide --user-id or --username")

        User = get_user_model()
        user = None
        if user_id > 0:
            user = User.objects.filter(id=user_id).first()
        elif username:
            user = User.objects.filter(username=username).first()
        if not user:
            raise SystemExit("User not found")

        roots_qs = AutoPoolAccount.objects.filter(owner=user, pool_type=pool, status="ACTIVE").order_by("user_entry_index", "id")
        if exclude_ambiguous:
            roots_qs = roots_qs.exclude(
                source_type__in=["RECOVERY", "RESTORATION", "BACKFILL_750", "BACKFILL_150", "RECONCILIATION", "SENTINEL", ""]
            )

        roots = list(roots_qs.values("id", "username_key", "user_entry_index", "source_type", "source_id"))
        if not roots:
            self.stdout.write("No active roots found for this user/pool (or all were excluded).")
            return

        tx_type = "AUTOPOOL_BONUS_THREE" if pool == "THREE_150" else "AUTOPOOL_BONUS_FIVE"

        rows: List[RootEarningRow] = []
        total = Decimal("0.00")
        for r in roots:
            rid = int(r.get("id") or 0)
            visited, sources = _iter_descendant_sources(root_id=rid, pool=pool, depth=depth)
            earned = _sum_gross_matrix_earnings_for_sources(user_id=int(user.id), tx_type=tx_type, sources=sources)
            total += earned
            rows.append(
                RootEarningRow(
                    pool=pool,
                    root_id=rid,
                    username_key=str(r.get("username_key") or ""),
                    user_entry_index=int(r.get("user_entry_index") or 0),
                    team_size=max(0, len(visited) - 1),
                    earned_gross=earned,
                )
            )

        self.stdout.write(f"User {user.id} {getattr(user, 'username', '')} | pool={pool} | depth={depth}")
        self.stdout.write("root_id\tentry\tusername_key\tsource_type\tteam\tearned_gross")
        for row in rows:
            st = ""
            try:
                st = next((x.get("source_type") for x in roots if int(x.get("id") or 0) == int(row.root_id)), "") or ""
            except Exception:
                st = ""
            self.stdout.write(
                f"{row.root_id}\t{row.user_entry_index}\t{row.username_key}\t{st}\t{row.team_size}\t{row.earned_gross}"
            )
        self.stdout.write(f"TOTAL\t\t\t\t{_q2(total)}")
