from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import Dict, List, Optional

from django.db import IntegrityError, transaction
from django.utils import timezone
from django.db.models import Sum, Max

from ..models import (
    Rank,
    RankUpgrade,
    UpgradeCommission,
    CommissionHold,
)
# Five-matrix specific models (RankMatrixRoot, RankMatrixNode) are imported lazily below
# to avoid circular import issues during app initialization.
from .upline import UplineService
from .wallet import WalletPoster
from .config import q2


try:
    from mlm_ranks.models import RankMatrixRoot, RankMatrixNode  # type: ignore
except Exception:  # pragma: no cover
    RankMatrixRoot = None  # type: ignore
    RankMatrixNode = None  # type: ignore


@dataclass
class MatrixTreeSlot:
    position: int
    placed_user_id: Optional[int]
    approved_at: Optional[str]  # ISO string in API response


class FiveMatrixService:
    """
    Event-driven 5-matrix logic bound to Rank-1 upgrades:
      - Root is a user who has been approved for Rank 1.
      - Only direct downlines (registered_by == root) with approved Rank-1 are placed as nodes.
      - Placement ordering is sequential and by approved_at ASC.
      - Commissions:
          50% sponsor (instant)
          50% level -> 25% released instantly + 25% held
        Held amounts are released only if 5 directs (Rank-1) are approved within 7 days
        starting from the first approved direct. Otherwise they expire (no cron).
    """

    @staticmethod
    def _get_rank1() -> Optional[Rank]:
        try:
            return Rank.objects.filter(level_number=1).order_by("id").first()
        except Exception:
            return None

    @classmethod
    def ensure_root_for_rank1(cls, user) -> Optional[RankMatrixRoot]:
        if RankMatrixRoot is None:
            return None
        rank1 = cls._get_rank1()
        if not user or not getattr(user, "id", None) or not rank1:
            return None
        # Idempotent ensure
        root = (
            RankMatrixRoot.objects
            .filter(root_user_id=user.id, rank_id=getattr(rank1, "id", None))
            .first()
        )
        if root:
            return root
        with transaction.atomic():
            # Lock on user/root row-range by selecting for update on potential duplicates
            root2 = (
                RankMatrixRoot.objects
                .select_for_update()
                .filter(root_user_id=user.id, rank_id=getattr(rank1, "id", None))
                .first()
            )
            if root2:
                return root2
            return RankMatrixRoot.objects.create(
                root_user=user,
                rank=rank1,
                first_upgrade_at=None,
                expiry_at=None,
            )

    @classmethod
    def _place_node_for_root(cls, root: RankMatrixRoot, child_user, approved_at) -> Optional[RankMatrixNode]:
        """
        BFS placement under a root:
          - First 5 approvals go under root (parent_user=root, level_depth=1, position 1..5)
          - Afterwards, place under the earliest parent (by level_depth ASC then approval order) that has a free child slot
          - parent_user is the placement parent; used for level bonus routing
        Idempotent: returns existing node if already placed.
        """
        if RankMatrixNode is None or root is None or not getattr(root, "root_user_id", None):
            return None
        if not child_user or not getattr(child_user, "id", None):
            return None

        # Prevent duplicate placements
        existing = RankMatrixNode.objects.filter(root_user_id=root.root_user_id, placed_user_id=child_user.id).first()
        if existing:
            return existing

        with transaction.atomic():
            # Lock root row range
            root_l = (
                RankMatrixRoot.objects
                .select_for_update()
                .filter(id=getattr(root, "id", None))
                .first()
            ) or root

            # Re-check duplicate after lock (idempotent)
            existing2 = RankMatrixNode.objects.filter(root_user_id=root_l.root_user_id, placed_user_id=child_user.id).first()
            if existing2:
                return existing2

            rid = int(root_l.root_user_id)

            # Helper: count children for a parent in this root
            def sibling_count(parent_uid: int) -> int:
                return int(RankMatrixNode.objects.filter(root_user_id=rid, parent_user_id=int(parent_uid)).count())

            # Case 1: first row under root (fill 1..5)
            total_so_far = int(RankMatrixNode.objects.filter(root_user_id=rid).count())
            if total_so_far < 5:
                pos = sibling_count(rid) + 1
                try:
                    node = RankMatrixNode.objects.create(
                        root_user_id=rid,
                        placed_user_id=child_user.id,
                        parent_user_id=rid,
                        level_depth=1,
                        position=pos,
                        approved_at=approved_at,
                    )
                except IntegrityError:
                    # recompute once
                    pos = sibling_count(rid) + 1
                    node = RankMatrixNode.objects.create(
                        root_user_id=rid,
                        placed_user_id=child_user.id,
                        parent_user_id=rid,
                        level_depth=1,
                        position=pos,
                        approved_at=approved_at,
                    )
            else:
                # BFS search for first parent with a free slot (1..5)
                # Determine current max depth
                try:
                    max_depth = int(
                        RankMatrixNode.objects.filter(root_user_id=rid).aggregate(m=Max("level_depth")).get("m") or 1
                    )
                except Exception:
                    # Fallback to scan
                    try:
                        max_depth = int(
                            RankMatrixNode.objects.filter(root_user_id=rid).order_by("-level_depth").values_list("level_depth", flat=True).first() or 1
                        )
                    except Exception:
                        max_depth = 1
                if max_depth < 1:
                    max_depth = 1

                placed = None
                # Level 1..N parents (root is implicit level 0 already full at this point)
                for lvl in range(1, max_depth + 5):  # small buffer to allow growing depth
                    # Parent candidates are nodes at this level (their placed_user acts as a parent for next level)
                    parents_qs = (
                        RankMatrixNode.objects
                        .filter(root_user_id=rid, level_depth=lvl)
                        .order_by("approved_at", "position", "id")
                        .values_list("placed_user_id", flat=True)
                    )
                    parent_ids = [int(x) for x in parents_qs]
                    if not parent_ids:
                        # No parents at this level yet; continue
                        continue
                    found_parent = None
                    for pid in parent_ids:
                        used = sibling_count(pid)
                        if used < 5:
                            found_parent = (pid, used + 1, lvl + 1)
                            break
                    if found_parent:
                        p_uid, pos, child_level = found_parent
                        try:
                            node = RankMatrixNode.objects.create(
                                root_user_id=rid,
                                placed_user_id=child_user.id,
                                parent_user_id=int(p_uid),
                                level_depth=int(child_level),
                                position=int(pos),
                                approved_at=approved_at,
                            )
                        except IntegrityError:
                            # Rare sibling-position clash; recompute once
                            new_used = sibling_count(int(p_uid))
                            node = RankMatrixNode.objects.create(
                                root_user_id=rid,
                                placed_user_id=child_user.id,
                                parent_user_id=int(p_uid),
                                level_depth=int(child_level),
                                position=int(new_used + 1),
                                approved_at=approved_at,
                            )
                        placed = node
                        break

                if not placed:
                    # As a safety net, place under root in next available slot (shouldn't happen in normal BFS growth)
                    pos = sibling_count(rid) + 1
                    node = RankMatrixNode.objects.create(
                        root_user_id=rid,
                        placed_user_id=child_user.id,
                        parent_user_id=rid,
                        level_depth=1,
                        position=pos,
                        approved_at=approved_at,
                    )

            # Initialize 7-day window at first approved direct under this root if not set
            if not getattr(root_l, "first_upgrade_at", None):
                now = approved_at or timezone.now()
                root_l.first_upgrade_at = now
                root_l.expiry_at = now + timedelta(days=7)
                root_l.save(update_fields=["first_upgrade_at", "expiry_at"])

            return node

    @classmethod
    def on_rank1_approval(cls, upgrade: RankUpgrade):
        """
        Hook called from Admin approval endpoint.
        Ensures:
          - Approved user becomes a Rank-1 root (if not already)
          - If direct sponsor has a Rank-1 root, place this approved user as a node
          - Reevaluate hold release/expiry for sponsor's root
        """
        try:
            if not upgrade or not getattr(upgrade, "id", None):
                return
            to_rank = getattr(upgrade, "to_rank", None)
            if not to_rank or int(getattr(to_rank, "level_number", 0) or 0) != 1:
                return  # Trigger only on Rank‑1 purchase
            approved_user = getattr(upgrade, "user", None)
            if not approved_user or not getattr(approved_user, "id", None):
                return
            # Ensure approved user has a Rank-1 root
            cls.ensure_root_for_rank1(approved_user)

            # If sponsor exists and is a Rank-1 root, place node under sponsor
            sponsor = UplineService.get_direct_sponsor(approved_user)
            if sponsor:
                sponsor_root = (
                    RankMatrixRoot.objects.filter(root_user_id=getattr(sponsor, "id", None), rank__level_number=1).first()
                    if RankMatrixRoot is not None
                    else None
                )
                # Ensure sponsor root lazily so historical approvals also get placed
                if not sponsor_root and RankMatrixRoot is not None:
                    try:
                        sponsor_root = cls.ensure_root_for_rank1(sponsor)
                    except Exception:
                        sponsor_root = None
                if sponsor_root:
                    approved_at = getattr(upgrade, "upgraded_at", None) or timezone.now()
                    cls._place_node_for_root(sponsor_root, approved_user, approved_at)
                    # After placement, reevaluate holds for sponsor
                    cls.reevaluate_hold_state(sponsor_root.root_user_id)
        except Exception:
            # Avoid breaking admin approval flow
            return

    @classmethod
    @transaction.atomic
    def distribute_rank1_commissions(cls, upgrade: RankUpgrade):
        """
        Rank‑1 payout per spec (event-driven, idempotent):
          - Ensure placement first (under sponsor's root using BFS)
          - 50% sponsor (DIRECT, instant)
          - 50% LEVEL to placement parent at level 1 for directs, or spillover parent for others:
              * 25% released immediately
              * 25% held (7 days window; early release on qualification; else expire)
        """
        if not upgrade or not getattr(upgrade, "id", None):
            return
        # Idempotency: skip if any commission exists for this upgrade
        if UpgradeCommission.objects.filter(upgrade_id=upgrade.id).exists():
            return

        payer = getattr(upgrade, "user", None)
        if not payer or not getattr(payer, "id", None):
            return
        sponsor = UplineService.get_direct_sponsor(payer)
        if not sponsor or not getattr(sponsor, "id", None):
            return

        net = q2(getattr(upgrade, "net_amount", Decimal("0.00")) or Decimal("0.00"))
        if net <= 0:
            return

        # Ensure both: payer has a root (as approved rank1) and sponsor has root to accept placement
        sponsor_root = None
        try:
            sponsor_root = (
                RankMatrixRoot.objects.filter(root_user_id=getattr(sponsor, "id", None), rank__level_number=1).first()
                if RankMatrixRoot is not None else None
            )
            if not sponsor_root and RankMatrixRoot is not None:
                # create sponsor root lazily
                sponsor_root = cls.ensure_root_for_rank1(sponsor)
        except Exception:
            sponsor_root = None

        parent_for_level = sponsor  # default fallback to sponsor if placement record can't be created

        # Ensure placement exists to discover placement parent
        try:
            if sponsor_root:
                approved_at = getattr(upgrade, "upgraded_at", None) or timezone.now()
                node = cls._place_node_for_root(sponsor_root, payer, approved_at)
                if node:
                    # placement parent (root for first five; spillover parent otherwise)
                    try:
                        parent_for_level = getattr(node, "parent_user", None) or sponsor
                    except Exception:
                        parent_for_level = sponsor
        except Exception:
            pass

        direct_amt = q2(net * Decimal("0.50"))
        level_pool = q2(net * Decimal("0.50"))

        # 1) DIRECT 50% -> sponsor (released)
        if direct_amt > 0:
            WalletPoster.credit_direct(sponsor, direct_amt, from_user_id=getattr(payer, "id", None) or 0, upgrade_id=upgrade.id)
            UpgradeCommission.objects.create(
                upgrade=upgrade,
                from_user=payer,
                to_user=sponsor,
                level=0,
                commission_amount=direct_amt,
                commission_type=UpgradeCommission.TYPE_DIRECT,
                status=UpgradeCommission.STATUS_CREDITED,
            )

        # 2) LEVEL 50% -> placement parent (100% released immediately, no holds per user request)
        if level_pool > 0 and parent_for_level and getattr(parent_for_level, "id", None):
            release_amt = level_pool
            hold_amt = Decimal("0.00")

            # Released portion
            if release_amt > 0:
                WalletPoster.credit_level(parent_for_level, release_amt, from_user_id=getattr(payer, "id", None) or 0, upgrade_id=upgrade.id, level=1)
                UpgradeCommission.objects.create(
                    upgrade=upgrade,
                    from_user=payer,
                    to_user=parent_for_level,
                    level=1,
                    commission_amount=release_amt,
                    commission_type=UpgradeCommission.TYPE_LEVEL,
                    status=UpgradeCommission.STATUS_CREDITED,
                )

            # After creating holds, reevaluate this recipient's holds (early release or expiry)
            try:
                cls.reevaluate_user_holds(getattr(parent_for_level, "id", None))
            except Exception:
                pass

    @classmethod
    def _counts_for_root(cls, root_user_id: int) -> Dict[str, int]:
        total = 0
        if RankMatrixNode is not None:
            total = int(RankMatrixNode.objects.filter(root_user_id=root_user_id, level_depth=1).count())
        return {"approved_count": total}

    @classmethod
    def reevaluate_hold_state(cls, root_user_id: int):
        """
        Event-driven hold release/expiry:
          - Start timer on first approved direct (first_upgrade_at, expiry_at)
          - If approved_count >= 5 AND now <= expiry_at: release all pending level holds to root
          - Else if now > expiry_at: mark remaining holds as forfeited (expired) without any payout
        Applies only for level=1 holds (Rank-1) where recipient is root_user.
        """
        if not root_user_id:
            return
        if RankMatrixRoot is None:
            return

        now = timezone.now()
        with transaction.atomic():
            root = (
                RankMatrixRoot.objects
                .select_for_update()
                .filter(root_user_id=int(root_user_id), rank__level_number=1)
                .first()
            )
            if not root:
                return

            # Ensure timer created when first direct is approved
            cnt = int(RankMatrixNode.objects.filter(root_user_id=root_user_id, level_depth=1).count()) if RankMatrixNode is not None else 0
            if cnt >= 1 and not getattr(root, "first_upgrade_at", None):
                root.first_upgrade_at = now
                root.expiry_at = now + timedelta(days=7)
                root.save(update_fields=["first_upgrade_at", "expiry_at"])

            expiry_at = getattr(root, "expiry_at", None)
            # Pending holds for this root's level-1 commissions
            pending_holds = (
                CommissionHold.objects
                .select_related("commission", "commission__to_user", "commission__from_user", "commission__upgrade")
                .filter(
                    status=CommissionHold.STATUS_PENDING,
                    commission__commission_type=UpgradeCommission.TYPE_LEVEL,
                    commission__level=1,  # target level of Rank-1
                    commission__to_user_id=int(root_user_id),
                )
            )

            if cnt >= 5 and expiry_at and now <= expiry_at:
                # Release all pending level holds
                for hold in pending_holds:
                    c: UpgradeCommission = hold.commission
                    to_user = getattr(c, "to_user", None)
                    from_user = getattr(c, "from_user", None)
                    upgrade = getattr(c, "upgrade", None)
                    amt = q2(getattr(hold, "hold_amount", Decimal("0.00")) or Decimal("0.00"))
                    if not to_user or amt <= 0:
                        continue
                    # Credit wallet and mark rows
                    WalletPoster.credit_level(
                        to_user,
                        amt,
                        from_user_id=getattr(from_user, "id", None) or 0,
                        upgrade_id=getattr(upgrade, "id", None) or 0,
                        level=int(getattr(c, "level", 0) or 1),
                    )
                    c.status = UpgradeCommission.STATUS_CREDITED
                    c.save(update_fields=["status"])
                    hold.status = CommissionHold.STATUS_RELEASED
                    hold.save(update_fields=["status"])
                return

            if expiry_at and now > expiry_at:
                # Expire all remaining holds (no payout, no company credit)
                for hold in pending_holds:
                    c: UpgradeCommission = hold.commission
                    c.status = UpgradeCommission.STATUS_FORFEITED
                    c.save(update_fields=["status"])
                    hold.status = CommissionHold.STATUS_FORFEITED
                    hold.save(update_fields=["status"])

    @classmethod
    def reevaluate_user_holds(cls, user_id: Optional[int]):
        """
        Generalized event-driven hold reevaluation for a recipient:
          - For all pending holds where commission.to_user_id = user_id:
              * If user has >=5 directs upgraded to Rank-1 and today <= hold.release_date: release now
              * If today > hold.release_date and user <5 directs: forfeit
          - No cron; should be invoked on approval, on tree reads, and on wallet fetches.
        """
        if not user_id:
            return
        try:
            pending = (
                CommissionHold.objects
                .select_related("commission", "commission__to_user", "commission__from_user", "commission__upgrade")
                .filter(status=CommissionHold.STATUS_PENDING, commission__to_user_id=int(user_id))
            )
            from .commission import count_directs_upgraded_to_rank1  # local import to avoid cycle
            directs = int(count_directs_upgraded_to_rank1(type("U", (), {"id": int(user_id)})()))  # lightweight proxy for id only
            today = timezone.now().date()
            qualifies = directs >= 5
            for hold in pending:
                c: UpgradeCommission = hold.commission
                to_user = getattr(c, "to_user", None)
                from_user = getattr(c, "from_user", None)
                upgrade = getattr(c, "upgrade", None)
                amt = q2(getattr(hold, "hold_amount", Decimal("0.00")) or Decimal("0.00"))
                if qualifies and today <= getattr(hold, "release_date", today):
                    # Early/full release
                    if amt > 0 and to_user:
                        if c.commission_type == UpgradeCommission.TYPE_LEVEL:
                            WalletPoster.credit_level(
                                to_user,
                                amt,
                                from_user_id=getattr(from_user, "id", None) or 0,
                                upgrade_id=getattr(upgrade, "id", None) or 0,
                                level=int(getattr(c, "level", 1) or 1),
                            )
                        else:
                            WalletPoster.credit_direct(
                                to_user,
                                amt,
                                from_user_id=getattr(from_user, "id", None) or 0,
                                upgrade_id=getattr(upgrade, "id", None) or 0,
                            )
                    c.status = UpgradeCommission.STATUS_CREDITED
                    c.save(update_fields=["status"])
                    hold.status = CommissionHold.STATUS_RELEASED
                    hold.save(update_fields=["status"])
                elif today > getattr(hold, "release_date", today):
                    # Expire
                    c.status = UpgradeCommission.STATUS_FORFEITED
                    c.save(update_fields=["status"])
                    hold.status = CommissionHold.STATUS_FORFEITED
                    hold.save(update_fields=["status"])
        except Exception:
            return

    @classmethod
    def lazy_backfill_for_root(cls, root_user_id: int, max_scan: int = 200):
        """
        Best-effort backfill: if root has no first-row placements yet, scan recent approved
        Rank‑1 upgrades and materialize placement/commissions for directs sponsored by root.
        Safe and idempotent; skips when placements already exist.
        """
        if not root_user_id:
            return
        if RankMatrixNode is None:
            return
        try:
            has_any = RankMatrixNode.objects.filter(root_user_id=int(root_user_id), level_depth=1).exists()
        except Exception:
            has_any = False
        if has_any:
            return
        try:
            qs = (
                RankUpgrade.objects
                .select_related("to_rank", "user")
                .filter(payment_status=RankUpgrade.STATUS_SUCCESS, to_rank__level_number=1)
                .order_by("upgraded_at", "id")[:int(max_scan)]
            )
            for upg in qs:
                payer = getattr(upg, "user", None)
                if not payer or not getattr(payer, "id", None):
                    continue
                sponsor = UplineService.get_direct_sponsor(payer)
                try:
                    sid = int(getattr(sponsor, "id", 0) or 0)
                except Exception:
                    sid = 0
                if sid and sid == int(root_user_id):
                    try:
                        # Ensure root + place node; then distribute if this upgrade has no rows yet
                        cls.on_rank1_approval(upg)
                        if not UpgradeCommission.objects.filter(upgrade_id=upg.id).exists():
                            cls.distribute_rank1_commissions(upg)
                    except Exception:
                        pass
        except Exception:
            pass

        # Second pass (commission-driven): if still no level-1 placements for this root,
        # infer children from DIRECT (level=0) commissions paid to this root for Rank‑1 upgrades.
        try:
            has_any2 = False
            if RankMatrixNode is not None:
                has_any2 = RankMatrixNode.objects.filter(root_user_id=int(root_user_id), level_depth=1).exists()
            if not has_any2:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                sponsor_user = User.objects.filter(id=int(root_user_id)).only("id").first()
                sponsor_root = None
                if sponsor_user:
                    sponsor_root = cls.ensure_root_for_rank1(sponsor_user)
                if sponsor_root:
                    cs = (
                        UpgradeCommission.objects
                        .select_related("upgrade", "from_user")
                        .filter(
                            to_user_id=int(root_user_id),
                            commission_type=UpgradeCommission.TYPE_DIRECT,
                            level=0,
                            upgrade__to_rank__level_number=1,
                        )
                        .order_by("upgrade__upgraded_at", "id")[:int(max_scan)]
                    )
                    for c in cs:
                        payer = getattr(c, "from_user", None)
                        if not payer or not getattr(payer, "id", None):
                            continue
                        approved_at = (
                            getattr(getattr(c, "upgrade", None), "upgraded_at", None)
                            or getattr(c, "created_at", None)
                            or timezone.now()
                        )
                        try:
                            cls._place_node_for_root(sponsor_root, payer, approved_at)
                        except Exception:
                            pass
        except Exception:
            pass

        # Third pass (directs-driven): derive directs by sponsor relationship, then pick their first
        # SUCCESS upgrade from L1 (L1→L2) to materialize placements in approval order.
        try:
            has_any3 = False
            if RankMatrixNode is not None:
                has_any3 = RankMatrixNode.objects.filter(root_user_id=int(root_user_id), level_depth=1).exists()
            if not has_any3:
                from django.contrib.auth import get_user_model
                from django.db.models import Q
                User = get_user_model()
                sponsor_user = (
                    User.objects
                    .filter(id=int(root_user_id))
                    .only("id", "username", "prefixed_id", "unique_id", "phone")
                    .first()
                )
                sponsor_root = None
                if sponsor_user:
                    sponsor_root = cls.ensure_root_for_rank1(sponsor_user)
                if sponsor_root and sponsor_user:
                    # Build identifiers like accounts.views_tree (username, prefixed_id, unique_id, phone, digits + TR- dashed)
                    try:
                        vals = [
                            (getattr(sponsor_user, "prefixed_id", "") or "").strip(),
                            (getattr(sponsor_user, "username", "") or "").strip(),
                            (getattr(sponsor_user, "unique_id", "") or "").strip(),
                            (getattr(sponsor_user, "phone", "") or "").strip(),
                        ]
                    except Exception:
                        vals = []
                    try:
                        digs_user = "".join(ch for ch in ((getattr(sponsor_user, "username", "") or "")) if ch.isdigit())
                        digs_phone = "".join(ch for ch in ((getattr(sponsor_user, "phone", "") or "")) if ch.isdigit())
                        if digs_user:
                            vals.append(digs_user)
                        if digs_phone:
                            vals.append(digs_phone)
                    except Exception:
                        pass
                    try:
                        tr = (getattr(sponsor_user, "prefixed_id", "") or "").strip()
                        if tr and "-" not in tr and len(tr) > 2 and tr[:2].isalpha():
                            vals.append(f"{tr[:2]}-{tr[2:]}")
                    except Exception:
                        pass
                    idents = [v for v in vals if v]

                    # Directs: registered_by=root OR legacy sponsor_id points to root's identifiers
                    directs_q = Q(registered_by_id=int(root_user_id)) | (Q(registered_by__isnull=True) & Q(sponsor_id__in=idents))
                    direct_ids = list(
                        User.objects
                        .filter(directs_q)
                        .order_by("id")
                        .values_list("id", flat=True)[:int(max_scan)]
                    )

                    for cid in direct_ids:
                        try:
                            up = (
                                RankUpgrade.objects
                                .select_related("to_rank", "user")
                                .filter(
                                    user_id=int(cid),
                                    payment_status=RankUpgrade.STATUS_SUCCESS,
                                    to_rank__level_number=1,  # Rank‑1 purchase
                                )
                                .order_by("upgraded_at", "id")
                                .first()
                            )
                            if not up:
                                continue
                            payer = getattr(up, "user", None)
                            if not payer:
                                payer = User.objects.filter(id=int(cid)).only("id").first()
                            approved_at = (
                                getattr(up, "upgraded_at", None)
                                or getattr(up, "created_at", None)
                                or timezone.now()
                            )
                            # Place and distribute if needed (idempotent)
                            cls._place_node_for_root(sponsor_root, payer, approved_at)
                            if not UpgradeCommission.objects.filter(upgrade_id=up.id).exists():
                                cls.distribute_rank1_commissions(up)
                        except Exception:
                            pass
        except Exception:
            pass

    @classmethod
    def get_tree_payload(cls, *, root_user_id: Optional[int], requester=None) -> Dict:
        """
        Build API payload for GET /rank-matrix/tree.
        Also reevaluates hold release/expiry lazily before returning.
        """
        from django.contrib.auth import get_user_model

        if not root_user_id and requester is not None:
            try:
                root_user_id = int(getattr(requester, "id", None) or 0)
            except Exception:
                root_user_id = None
        root_user_id = int(root_user_id or 0)
        if root_user_id <= 0:
            return {"detail": "Invalid root_user_id"}

        # Lazy reevaluation
        try:
            cls.reevaluate_hold_state(root_user_id)
        except Exception:
            pass

        # Root/meta
        root_row = None
        if RankMatrixRoot is not None:
            root_row = (
                RankMatrixRoot.objects
                .filter(root_user_id=root_user_id, rank__level_number=1)
                .select_related("rank", "root_user")
                .first()
            )

        first_upgrade_at = getattr(root_row, "first_upgrade_at", None)
        expiry_at = getattr(root_row, "expiry_at", None)
        now = timezone.now()

        # Try to backfill placements for this root if empty (idempotent)
        try:
            cls.lazy_backfill_for_root(root_user_id)
        except Exception:
            pass

        # Placements ordered by approved_at ASC
        placements: List[Dict] = []
        approved_count = 0
        if RankMatrixNode is not None:
            nodes = (
                RankMatrixNode.objects
                .filter(root_user_id=root_user_id, level_depth=1)
                .select_related("placed_user")
                .order_by("approved_at", "position", "id")
            )
            for n in nodes:
                placements.append({
                    "position": int(getattr(n, "position", 0) or 0),
                    "placed_user_id": int(getattr(n, "placed_user_id", 0) or 0),
                    "placed_username": getattr(getattr(n, "placed_user", None), "username", None),
                    "approved_at": getattr(n, "approved_at", None),
                })
            approved_count = len(placements)

        # Up to 5 visible slots (placeholders)
        visible_slots: List[Dict] = []
        for pos in range(1, 6):
            found = next((p for p in placements if int(p.get("position") or 0) == pos), None)
            if found:
                visible_slots.append(found)
            else:
                visible_slots.append({
                    "position": pos,
                    "placed_user_id": None,
                    "placed_username": None,
                    "approved_at": None,
                })

        # Income summaries derived from authoritative UpgradeCommission + CommissionHold
        sponsor_released = q2(
            UpgradeCommission.objects.filter(
                to_user_id=root_user_id,
                commission_type=UpgradeCommission.TYPE_DIRECT,
                status=UpgradeCommission.STATUS_CREDITED,
            ).aggregate(s=Sum("commission_amount")).get("s") or 0
        )
        level_released = q2(
            UpgradeCommission.objects.filter(
                to_user_id=root_user_id,
                commission_type=UpgradeCommission.TYPE_LEVEL,
                level=1,
                status=UpgradeCommission.STATUS_CREDITED,
            ).aggregate(s=Sum("commission_amount")).get("s") or 0
        )
        level_hold = q2(
            CommissionHold.objects.filter(
                commission__to_user_id=root_user_id,
                commission__commission_type=UpgradeCommission.TYPE_LEVEL,
                commission__level=1,
                status=CommissionHold.STATUS_PENDING,
            ).aggregate(s=Sum("hold_amount")).get("s") or 0
        )

        # Progress and timing
        days_left = None
        can_still_qualify = True
        if first_upgrade_at and expiry_at:
            try:
                delta = expiry_at - now
                days_left = max(0, int(delta.total_seconds() // 86400))
                can_still_qualify = now <= expiry_at
            except Exception:
                days_left = None
                can_still_qualify = True

        payload = {
            "root": {
                "root_user_id": root_user_id,
                "rank_id": getattr(getattr(root_row, "rank", None), "id", None) if root_row else None,
                "first_upgrade_at": first_upgrade_at,
                "expiry_at": expiry_at,
            },
            "placements": visible_slots,
            "approved_count": approved_count,
            "target": 5,
            "days_left": days_left,
            "can_still_qualify": can_still_qualify,
            "totals": {
                "sponsor_released": sponsor_released,
                "level_released": level_released,
                "level_hold": level_hold,
            },
        }
        return payload
