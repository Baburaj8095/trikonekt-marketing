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
    def _place_node_for_root(cls, root: RankMatrixRoot, child_user, approved_at, sponsor=None) -> Optional[RankMatrixNode]:
        """
        BFS placement under a root (Option A: Global Single Spillover Tree).
        If sponsor is provided, BFS search starts from sponsor's downline in the global matrix.
        """
        if RankMatrixNode is None or root is None or not getattr(root, "root_user_id", None):
            return None
        if not child_user or not getattr(child_user, "id", None):
            return None

        if int(child_user.id) == int(root.root_user_id):
            return None

        existing = RankMatrixNode.objects.filter(root_user_id=root.root_user_id, placed_user_id=child_user.id).first()
        if existing:
            return existing

        with transaction.atomic():
            root_l = (
                RankMatrixRoot.objects
                .select_for_update()
                .filter(id=getattr(root, "id", None))
                .first()
            ) or root

            existing2 = RankMatrixNode.objects.filter(root_user_id=root_l.root_user_id, placed_user_id=child_user.id).first()
            if existing2:
                return existing2

            rid = int(root_l.root_user_id)

            def sibling_count(parent_uid: int) -> int:
                return int(RankMatrixNode.objects.filter(root_user_id=rid, parent_user_id=int(parent_uid)).count())

            def first_free_pos(parent_uid: int) -> int:
                used = set(RankMatrixNode.objects.filter(root_user_id=rid, parent_user_id=int(parent_uid)).values_list("position", flat=True))
                for p in range(1, 6):
                    if p not in used:
                        return p
                return len(used) + 1

            # Option A: If sponsor is given, search in sponsor's downline within this global tree
            sponsor_node = None
            if sponsor and getattr(sponsor, "id", None) and int(sponsor.id) != rid:
                sponsor_node = RankMatrixNode.objects.filter(root_user_id=rid, placed_user_id=int(sponsor.id)).first()

            if sponsor_node:
                frontier = [sponsor_node.placed_user_id]
                found_parent = None
                while frontier and not found_parent:
                    for pid in frontier:
                        if sibling_count(pid) < 5:
                            pnode = RankMatrixNode.objects.filter(root_user_id=rid, placed_user_id=pid).first()
                            lvl = pnode.level_depth if pnode else sponsor_node.level_depth
                            found_parent = (pid, first_free_pos(pid), lvl + 1)
                            break
                    if found_parent:
                        break
                    next_frontier = list(
                        RankMatrixNode.objects.filter(root_user_id=rid, parent_user_id__in=frontier)
                        .order_by("level_depth", "approved_at", "position", "id")
                        .values_list("placed_user_id", flat=True)
                    )
                    frontier = next_frontier

                if found_parent:
                    p_uid, pos, child_level = found_parent
                    node = RankMatrixNode.objects.create(
                        root_user_id=rid,
                        placed_user_id=child_user.id,
                        parent_user_id=int(p_uid),
                        level_depth=int(child_level),
                        position=int(pos),
                        approved_at=approved_at,
                    )
                    return node

            total_so_far = int(RankMatrixNode.objects.filter(root_user_id=rid).count())
            if total_so_far < 5:
                pos = first_free_pos(rid)
                node = RankMatrixNode.objects.create(
                    root_user_id=rid,
                    placed_user_id=child_user.id,
                    parent_user_id=rid,
                    level_depth=1,
                    position=pos,
                    approved_at=approved_at,
                )
                return node
            else:
                try:
                    max_depth = int(
                        RankMatrixNode.objects.filter(root_user_id=rid).aggregate(m=Max("level_depth")).get("m") or 1
                    )
                except Exception:
                    max_depth = 1

                placed = None
                for lvl in range(1, max_depth + 5):
                    parent_ids = list(
                        RankMatrixNode.objects
                        .filter(root_user_id=rid, level_depth=lvl)
                        .order_by("approved_at", "position", "id")
                        .values_list("placed_user_id", flat=True)
                    )
                    if not parent_ids:
                        continue
                    found_parent = None
                    for pid in parent_ids:
                        if sibling_count(pid) < 5:
                            found_parent = (pid, first_free_pos(pid), lvl + 1)
                            break
                    if found_parent:
                        p_uid, pos, child_level = found_parent
                        node = RankMatrixNode.objects.create(
                            root_user_id=rid,
                            placed_user_id=child_user.id,
                            parent_user_id=int(p_uid),
                            level_depth=int(child_level),
                            position=int(pos),
                            approved_at=approved_at,
                        )
                        placed = node
                        break

                if not placed:
                    pos = first_free_pos(rid)
                    node = RankMatrixNode.objects.create(
                        root_user_id=rid,
                        placed_user_id=child_user.id,
                        parent_user_id=rid,
                        level_depth=1,
                        position=pos,
                        approved_at=approved_at,
                    )
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

            sponsor = UplineService.get_direct_sponsor(approved_user)
            global_root = (
                RankMatrixRoot.objects.filter(root_user_id=1, rank__level_number=1).first()
                or RankMatrixRoot.objects.filter(rank__level_number=1).order_by("id").first()
            )
            approved_at = getattr(upgrade, "upgraded_at", None) or timezone.now()

            if global_root:
                cls._place_node_for_root(global_root, approved_user, approved_at, sponsor=sponsor)
            if sponsor:
                cls.reevaluate_hold_state(sponsor.id)
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

        # Resolve dynamic gross, tax rate, and net pool from CommissionConfig
        from business.models import CommissionConfig
        cfg = CommissionConfig.get_solo()
        master_json = getattr(cfg, "master_commission_json", {}) or {}
        custom_tax = master_json.get("custom_module_tax", {}) or {}
        tax_rate_val = custom_tax.get("tax_rank")
        if tax_rate_val is None:
            tax_rate_val = cfg.get_tax_percent() or "18.00"
        tax_pct = Decimal(str(tax_rate_val)) / Decimal("100.00")

        gross_amt = q2(getattr(upgrade, "upgrade_amount", Decimal("0.00")) or Decimal("0.00"))
        if gross_amt <= 0:
            gross_amt = q2(getattr(upgrade, "net_amount", Decimal("0.00")) or Decimal("250.00"))

        gst_amt = q2(getattr(upgrade, "gst_amount", Decimal("0.00")) or Decimal("0.00"))
        net = q2(getattr(upgrade, "net_amount", Decimal("0.00")) or Decimal("0.00"))

        # If gst_amount was not computed or net equaled un-taxed gross, recompute dynamically
        if gst_amt <= 0 or net >= gross_amt:
            gst_amt = q2(gross_amt * tax_pct)
            net = q2(gross_amt - gst_amt)
            try:
                upgrade.upgrade_amount = gross_amt
                upgrade.gst_amount = gst_amt
                upgrade.net_amount = net
                upgrade.save(update_fields=["upgrade_amount", "gst_amount", "net_amount"])
            except Exception:
                pass

        if net <= 0:
            return

        global_root = (
            RankMatrixRoot.objects.filter(root_user_id=1, rank__level_number=1).first()
            or RankMatrixRoot.objects.filter(rank__level_number=1).order_by("id").first()
        )

        parent_for_level = sponsor
        try:
            if global_root:
                approved_at = getattr(upgrade, "upgraded_at", None) or timezone.now()
                node = cls._place_node_for_root(global_root, payer, approved_at, sponsor=sponsor)
                if node:
                    try:
                        parent_for_level = getattr(node, "parent_user", None) or sponsor
                    except Exception:
                        parent_for_level = sponsor
        except Exception:
            pass

        direct_amt = q2(net * Decimal("0.50"))
        level_pool = q2(net * Decimal("0.50"))

        # Retained Platform Tax Credit to Company Root/Tax Account
        if gst_amt > 0:
            try:
                cu = cfg.get_company_user()
                if cu:
                    WalletPoster.credit_company_gst(cu, gst_amt, upgrade_id=upgrade.id)
            except Exception:
                pass

        WalletPoster.credit_direct_sponsor(
            sponsor=sponsor,
            from_user=payer,
            amount=direct_amt,
            upgrade_id=upgrade.id,
            description="Rank 1 Direct Sponsor Bonus",
            rank_level=1,
        )

        WalletPoster.credit_level_bonus(
            to_user=parent_for_level,
            from_user=payer,
            amount=level_pool,
            upgrade_id=upgrade.id,
            level=1,
            description=f"Rank 1 Level Placement Bonus (Level 1)",
            rank_level=1,
        )

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
                if sid and sid == int(root_user_id) and int(payer.id) != int(root_user_id):
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
                has_any2 = RankMatrixNode.objects.filter(root_user_id=int(root_user_id), level_depth=1).exclude(placed_user_id=int(root_user_id)).exists()
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
                        .exclude(from_user_id=int(root_user_id))
                        .order_by("upgrade__upgraded_at", "id")[:int(max_scan)]
                    )
                    for c in cs:
                        payer = getattr(c, "from_user", None)
                        if not payer or not getattr(payer, "id", None) or int(getattr(payer, "id", 0)) == int(root_user_id):
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
                has_any3 = RankMatrixNode.objects.filter(root_user_id=int(root_user_id), level_depth=1).exclude(placed_user_id=int(root_user_id)).exists()
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

                    # Directs: registered_by=root OR legacy sponsor_id points to root's identifiers (excluding self)
                    directs_q = (Q(registered_by_id=int(root_user_id)) | (Q(registered_by__isnull=True) & Q(sponsor_id__in=idents))) & ~Q(id=int(root_user_id))
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
            # Under single global tree (Option A), immediate children of root_user_id have parent_user_id = root_user_id
            nodes = (
                RankMatrixNode.objects
                .filter(parent_user_id=root_user_id)
                .exclude(placed_user_id=root_user_id)
                .select_related("placed_user")
                .order_by("position", "approved_at", "id")
            )
            if not nodes.exists():
                nodes = (
                    RankMatrixNode.objects
                    .filter(root_user_id=root_user_id, level_depth=1)
                    .exclude(placed_user_id=root_user_id)
                    .select_related("placed_user")
                    .order_by("position", "approved_at", "id")
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

    @classmethod
    @transaction.atomic
    def reparent_rank_matrix_node(cls, user, new_sponsor) -> bool:
        """
        Move a user's RankMatrixNode (and their entire subtree) under the new sponsor's Rank-1 matrix.
        We also update all descendants' root_user keys recursively.
        """
        from mlm_ranks.models import RankMatrixNode, RankMatrixRoot
        from django.db.models import Max

        # 1. Get the user's Node in the RankMatrix
        node = RankMatrixNode.objects.filter(placed_user=user).first()
        if not node:
            return False  # Nothing to reparent

        old_root_user_id = node.root_user_id

        # 2. Ensure new sponsor has a Rank-1 matrix root
        sponsor_root = cls.ensure_root_for_rank1(new_sponsor)
        if not sponsor_root:
            return False

        rid = int(sponsor_root.root_user_id)

        # Helper: count children for a parent in this root
        def sibling_count(parent_uid: int) -> int:
            return int(RankMatrixNode.objects.filter(root_user_id=rid, parent_user_id=int(parent_uid)).count())

        # 3. Find the next available slot in new sponsor's root tree (BFS)
        total_so_far = int(RankMatrixNode.objects.filter(root_user_id=rid).count())
        if total_so_far < 5:
            new_parent_id = rid
            new_level = 1
            new_pos = sibling_count(rid) + 1
        else:
            try:
                max_depth = int(
                    RankMatrixNode.objects.filter(root_user_id=rid).aggregate(m=Max("level_depth")).get("m") or 1
                )
            except Exception:
                max_depth = 1
            if max_depth < 1:
                max_depth = 1

            placed_parent_info = None
            for lvl in range(1, max_depth + 5):
                parents_qs = (
                    RankMatrixNode.objects
                    .filter(root_user_id=rid, level_depth=lvl)
                    .order_by("approved_at", "position", "id")
                    .values_list("placed_user_id", flat=True)
                )
                parent_ids = [int(x) for x in parents_qs]
                if not parent_ids:
                    continue
                found_parent = None
                for pid in parent_ids:
                    used = sibling_count(pid)
                    if used < 5:
                        found_parent = (pid, used + 1, lvl + 1)
                        break
                if found_parent:
                    placed_parent_info = found_parent
                    break

            if placed_parent_info:
                new_parent_id, new_pos, new_level = placed_parent_info
            else:
                new_parent_id = rid
                new_level = 1
                new_pos = sibling_count(rid) + 1

        # 4. Save User A's new node details
        node.root_user_id = rid
        node.parent_user_id = new_parent_id
        node.level_depth = new_level
        node.position = new_pos
        node.save(update_fields=["root_user", "parent_user", "level_depth", "position"])

        # 5. Recursively find and update descendants' root_user and level_depth
        # We shift descendants' depths based on User A's depth delta.
        from collections import deque
        q = deque([(user.id, new_level)])
        while q:
            curr_parent_id, curr_parent_level = q.popleft()
            children = RankMatrixNode.objects.filter(parent_user_id=curr_parent_id, root_user_id=old_root_user_id)
            for child in children:
                child.root_user_id = rid
                child.level_depth = curr_parent_level + 1
                child.save(update_fields=["root_user", "level_depth"])
                q.append((child.placed_user_id, child.level_depth))

        return True

