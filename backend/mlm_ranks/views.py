from __future__ import annotations

from decimal import Decimal
from typing import Optional

from django.db import transaction
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Max, Prefetch

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from .models import Rank, UserRank, RankUpgrade, UpgradeCommission, CommissionHold, RankUpgradePayment
from .serializers import (
    RankSerializer,
    EligibilitySerializer,
    RankUpgradeSerializer,
    UpgradeCommissionSerializer,
    CommissionHoldSerializer,
    RankUpgradePaymentSerializer,
)
from .services.eligibility import RankEligibilityService
from .services.commission import CommissionDistributor, count_directs_upgraded_to_rank1
from .services.config import q2, GST_RATE, HOLD_REQUIRE_DIRECTS_GTE
from .services.five_matrix import FiveMatrixService


class RanksListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        ranks = Rank.objects.order_by("level_number")
        data = RankSerializer(ranks, many=True).data
        # Attach simple eligibility rule hints (static text)
        for item in data:
            item["eligibility"] = {
                "requires_min_prime750_directs": 5,
                "team_size_required": item.get("team_size_required") or 0,
                "notes": "Team size counts only Prime-750 active users in your referral tree (up to 10 levels).",
            }
        return Response(data)


class UserUpgradeEligibilityView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _achieved_level(self, user) -> int:
        try:
            hi = (
                RankUpgrade.objects
                .filter(user=user, payment_status=RankUpgrade.STATUS_SUCCESS)
                .aggregate(m=Max("to_rank__level_number"))
                .get("m") or 0
            )
            return int(hi or 0)
        except Exception:
            return 0

    def get(self, request):
        if str(request.query_params.get("summary") or "").lower() in ("1", "true", "achieved"):
            ur, cur = RankEligibilityService.get_or_bootstrap_user_rank(request.user)
            return Response(
                {
                    "current_rank": getattr(cur, "rank_name", None),
                    "current_level": getattr(cur, "level_number", None),
                    "achieved_level": self._achieved_level(request.user),
                }
            )

        res = RankEligibilityService.evaluate(request.user)
        payload = EligibilitySerializer.from_result(res).data
        ur, cur = RankEligibilityService.get_or_bootstrap_user_rank(request.user)
        current_rank_name = getattr(cur, "rank_name", None)
        current_level = getattr(cur, "level_number", None)
        # Highest approved rank level (based solely on admin-approved upgrades)
        achieved_level = self._achieved_level(request.user)
        # For frontend quick use:
        return Response(
            {
                "eligible": payload["eligible"],
                "next_rank": payload["next_rank"],
                "next_rank_id": res.next_rank_id,
                "upgrade_amount": payload["upgrade_amount"],
                "level_number": payload["level_number"],
                "team_size_required": payload["team_size_required"],
                "current_team_size": payload["current_team_size"],
                "direct_count": payload["direct_count"],
                "current_rank": current_rank_name,
                "current_level": current_level,
                "achieved_level": achieved_level,
                "reason": payload["reason"],
            }
        )


class UpgradeInitiateView(APIView):
    """
    Input: { to_rank_id }
    Allows initiating ANY higher rank (no intermediate lock).
    Computes payable as cumulative sum of upgrade_amounts from (current_level+1 .. to_level).
    Creates RankUpgrade with GST and net calculated; payment_status=INITIATED.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        to_rank_id = request.data.get("to_rank_id")
        if not to_rank_id:
            return Response({"detail": "to_rank_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Allow ANY higher rank; compute cumulative payable from current+1..target
        ur, cur_rank = RankEligibilityService.get_or_bootstrap_user_rank(user)
        to_rank = get_object_or_404(Rank, id=int(to_rank_id))

        # Effective baseline = highest admin-approved rank (achieved_level).
        # This allows a user with default L1 (but no approved upgrade) to BUY L1.
        try:
            hi = (
                RankUpgrade.objects
                .filter(user=user, payment_status=RankUpgrade.STATUS_SUCCESS)
                .aggregate(m=Max("to_rank__level_number"))
                .get("m") or 0
            )
        except Exception:
            hi = 0
        eff_level = int(hi or 0)

        target_level = int(getattr(to_rank, "level_number", 0) or 0)
        if target_level <= eff_level:
            return Response({"detail": "Target rank must be higher than your approved level."}, status=status.HTTP_400_BAD_REQUEST)

        # Sum upgrade_amounts for levels (eff_level+1 .. target_level)
        ranks = Rank.objects.filter(level_number__gt=eff_level, level_number__lte=target_level).order_by("level_number")
        total_upgrade = q2(sum([q2(r.upgrade_amount) for r in ranks]) if ranks else Decimal("0.00"))
        if total_upgrade <= 0:
            return Response({"detail": "Invalid computed upgrade amount for target rank"}, status=status.HTTP_400_BAD_REQUEST)

        # Calculate taxes
        upgrade_amount = total_upgrade
        gst_amount = q2(upgrade_amount * GST_RATE)
        net_amount = q2(upgrade_amount - gst_amount)

        upg = RankUpgrade.objects.create(
            user=user,
            from_rank=cur_rank,
            to_rank=to_rank,
            upgrade_amount=upgrade_amount,
            gst_amount=gst_amount,
            net_amount=net_amount,
            payment_status=RankUpgrade.STATUS_INITIATED,
        )
        return Response(RankUpgradeSerializer(upg).data, status=status.HTTP_201_CREATED)


class UpgradeSuccessView(APIView):
    """
    Trigger after payment success.

    Input:
      - upgrade_id (preferred), or
      - to_rank_id (fallback: will pick latest INITIATED upgrade for this to_rank)
    Flow:
      1) Mark upgrade SUCCESS + upgraded_at=now
      2) Update UserRank.current_rank
      3) Distribute commissions (50% direct / 50% levels 1..10 with pass-up; 25% hold rule)
    """
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        user = request.user
        upgrade_id = request.data.get("upgrade_id")
        to_rank_id = request.data.get("to_rank_id")

        upg: Optional[RankUpgrade] = None
        if upgrade_id:
            upg = RankUpgrade.objects.select_for_update().filter(
                id=int(upgrade_id),
                user_id=user.id,
            ).first()
        elif to_rank_id:
            upg = (
                RankUpgrade.objects.select_for_update()
                .filter(user_id=user.id, to_rank_id=int(to_rank_id), payment_status=RankUpgrade.STATUS_INITIATED)
                .order_by("-created_at", "-id")
                .first()
            )
        if not upg:
            return Response({"detail": "No matching initiated upgrade found for this user."}, status=status.HTTP_400_BAD_REQUEST)

        if upg.payment_status == RankUpgrade.STATUS_SUCCESS:
            # idempotent: return existing
            return Response(RankUpgradeSerializer(upg).data, status=status.HTTP_200_OK)

        # Mark success
        now = timezone.now()
        upg.payment_status = RankUpgrade.STATUS_SUCCESS
        upg.upgraded_at = now
        upg.save(update_fields=["payment_status", "upgraded_at"])

        # Update user's current rank
        ur, _cur = RankEligibilityService.get_or_bootstrap_user_rank(user)
        ur.current_rank = upg.to_rank
        ur.achieved_at = now
        ur.save(update_fields=["current_rank", "achieved_at"])

        # NOTE: Commission distribution is handled by Admin approval endpoint to ensure
        # payouts only happen after back-office verification. Do NOT distribute here.
        # AdminApproveRankUpgradeView will distribute idempotently.
        # (Kept intentionally blank)
        ...

        return Response(RankUpgradeSerializer(upg).data, status=status.HTTP_200_OK)


class MyCommissionHoldsView(APIView):
    """
    List current user's rank upgrade commission holds (pending/released/forfeited).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = (
            CommissionHold.objects
            .select_related("commission", "commission__to_user", "commission__from_user", "commission__upgrade")
            .filter(commission__to_user_id=request.user.id)
            .order_by("release_date", "id")
        )
        status_f = request.query_params.get("status")
        if status_f:
            qs = qs.filter(status=str(status_f).upper())
        data = CommissionHoldSerializer(qs, many=True).data
        return Response(data)


class MyLevelBonusProgressView(APIView):
    """
    Show Level Bonus eligibility progress for current user:
      - completed rank-1 directs count
      - threshold (HOLD_REQUIRE_DIRECTS_GTE)
      - summary of holds (pending/released/forfeited) and earliest pending release info
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        completed = int(count_directs_upgraded_to_rank1(user) or 0)
        threshold = int(HOLD_REQUIRE_DIRECTS_GTE or 5)

        # Holds belonging to this user (as recipient)
        my_holds = CommissionHold.objects.filter(commission__to_user_id=user.id)
        pending = my_holds.filter(status=CommissionHold.STATUS_PENDING)
        released = my_holds.filter(status=CommissionHold.STATUS_RELEASED)
        forfeited = my_holds.filter(status=CommissionHold.STATUS_FORFEITED)

        # Aggregates
        from django.db.models import Sum, Min
        pending_count = pending.count()
        released_count = released.count()
        forfeited_count = forfeited.count()
        pending_total_amount = pending.aggregate(s=Sum("hold_amount")).get("s") or 0
        earliest_release = pending.aggregate(m=Min("release_date")).get("m")

        today = timezone.now().date()
        days_left = None
        if earliest_release:
            try:
                delta = (earliest_release - today).days
                days_left = int(delta)
            except Exception:
                days_left = None

        payload = {
            "completed_rank1_directs": completed,
            "threshold": threshold,
            "eligible_now": completed >= threshold,
            "holds_summary": {
                "pending_count": pending_count,
                "released_count": released_count,
                "forfeited_count": forfeited_count,
                "pending_total_amount": pending_total_amount,
                "earliest_pending_release_date": earliest_release,
                "days_left_for_earliest": days_left,
            },
        }
        return Response(payload)


class UpgradePaymentRequestView(APIView):
    """
    User uploads UPI payment proof for an initiated rank upgrade.
    Payload (multipart): { upgrade_id, utr, remarks?, payment_proof? }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        upgrade_id = request.data.get("upgrade_id")
        if not upgrade_id:
            return Response({"detail": "upgrade_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        upg = (
            RankUpgrade.objects
            .filter(id=int(upgrade_id), user_id=user.id)
            .first()
        )
        if not upg:
            return Response({"detail": "Upgrade not found"}, status=status.HTTP_404_NOT_FOUND)

        if upg.payment_status != RankUpgrade.STATUS_INITIATED:
            return Response({"detail": f"Cannot attach payment for status '{upg.payment_status}'"}, status=status.HTTP_400_BAD_REQUEST)

        utr = (request.data.get("utr") or "").strip()
        remarks = (request.data.get("remarks") or "").strip()
        proof = request.FILES.get("payment_proof")

        rup = RankUpgradePayment.objects.create(
            upgrade=upg,
            utr=utr,
            remarks=remarks,
            payment_proof=proof,
        )
        return Response(RankUpgradePaymentSerializer(rup).data, status=status.HTTP_201_CREATED)


class UpgradePayFromWalletView(APIView):
    """
    Pay an initiated rank upgrade from the Add Money Pocket.
    The uploaded-money pocket is tracked by wallet transactions with source_type=WALLET_UPLOAD.
    Admin still approves the rank upgrade through the existing review flow.
    """
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        from decimal import Decimal as D
        from accounts.models import Wallet, WalletTransaction

        upgrade_id = request.data.get("upgrade_id")
        if not upgrade_id:
            return Response({"detail": "upgrade_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        upg = (
            RankUpgrade.objects
            .select_for_update()
            .filter(id=int(upgrade_id), user_id=request.user.id)
            .first()
        )
        if not upg:
            return Response({"detail": "Upgrade not found"}, status=status.HTTP_404_NOT_FOUND)
        if upg.payment_status != RankUpgrade.STATUS_INITIATED:
            return Response({"detail": f"Cannot pay for status '{upg.payment_status}'"}, status=status.HTTP_400_BAD_REQUEST)

        amount = D(str(getattr(upg, "upgrade_amount", 0) or 0)).quantize(D("0.01"))
        if amount <= 0:
            return Response({"detail": "Invalid payable amount."}, status=status.HTTP_400_BAD_REQUEST)

        upload_sources = ["WALLET_UPLOAD", "UPLOAD_TO_WALLET", "PACKAGE_UPLOAD", "PACKAGE_BUY_UPLOAD"]
        credit = WalletTransaction.objects.filter(
            user=request.user,
            source_type__in=upload_sources,
            amount__gt=0,
        ).aggregate(total=Sum("amount"))["total"] or D("0.00")
        debit = WalletTransaction.objects.filter(
            user=request.user,
            source_type__in=upload_sources,
            amount__lt=0,
        ).aggregate(total=Sum("amount"))["total"] or D("0.00")
        available = D(str(credit)) + D(str(debit))
        if available < amount:
            return Response({"detail": "Insufficient Add Money Pocket balance."}, status=status.HTTP_400_BAD_REQUEST)

        w = Wallet.get_or_create_for_user(request.user)
        w = Wallet.objects.select_for_update().get(pk=w.pk)
        w.balance = (w.balance or D("0")) - amount
        if w.balance < D("0"):
            return Response({"detail": "Insufficient wallet balance."}, status=status.HTTP_400_BAD_REQUEST)
        w.save(update_fields=["balance", "updated_at"])

        WalletTransaction.objects.create(
            user=request.user,
            amount=amount * D("-1"),
            balance_after=w.balance,
            type="INTERNAL_WALLET_DEBIT",
            source_type="WALLET_UPLOAD",
            source_id=str(upg.id),
            meta={"reason": "RANK_UPGRADE", "upgrade_id": upg.id, "wallet_source": "package_upload"},
        )
        rup = RankUpgradePayment.objects.create(
            upgrade=upg,
            utr="",
            remarks="Paid from Add Money Pocket",
        )
        # Wallet-funded upgrades use already approved wallet money, so approve immediately.
        # Reuse the admin approval implementation so rank updates, commissions, and
        # Rank-1 matrix placement remain identical to the manual review flow.
        approval_resp = AdminApproveRankUpgradeView().post(request, upgrade_id=upg.id)
        if getattr(approval_resp, "status_code", 500) >= 400:
            transaction.set_rollback(True)
            return approval_resp
        return Response(approval_resp.data, status=status.HTTP_201_CREATED)


class MyRankUpgradesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = (
            RankUpgrade.objects
            .filter(user=request.user)
            .select_related("from_rank", "to_rank", "user")
            .prefetch_related("payments")
            .order_by("-created_at", "-id")
        )
        return Response(RankUpgradeSerializer(qs, many=True).data, status=status.HTTP_200_OK)


# ----------------------- Admin APIs -----------------------

class RankMatrixTreeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rid = request.query_params.get("root_user_id")
        try:
            rid_int = int(rid) if rid is not None and str(rid).strip() != "" else int(getattr(request.user, "id", 0) or 0)
        except Exception:
            rid_int = int(getattr(request.user, "id", 0) or 0)

        # Authorization: consumer can view own tree; admin/staff can view any
        if rid_int != getattr(request.user, "id", None) and not getattr(request.user, "is_staff", False):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # Ensure root exists (unconditional, UX-friendly, idempotent)
        try:
            user_obj = request.user
            if getattr(user_obj, "id", None) != rid_int:
                from accounts.models import CustomUser
                user_obj = CustomUser.objects.filter(id=rid_int).first()
            if user_obj:
                FiveMatrixService.ensure_root_for_rank1(user_obj)
        except Exception:
            pass

        payload = FiveMatrixService.get_tree_payload(root_user_id=rid_int, requester=request.user)
        return Response(payload)


class RankMatrixSubtreeView(APIView):
    """
    GET /rank-matrix/subtree?user_id={id}&root_user_id?={rid}
    Returns immediate children (up to 5) of the given user inside the specified (or inferred) Rank-1 matrix root.
    Each child contains:
      - user_id, username
      - placement_level (level_depth)
      - position (1..5)
      - approved_at
      - current_rank (name/level)
      - bonus_released (to parent_user from this child; LEVEL only)
      - bonus_hold (pending holds to parent_user from this child; LEVEL only)
      - has_children (whether this child has further placements under this root)
    Authorization:
      - Consumers may view only their own tree (root_user_id == request.user.id)
      - Admin/staff may view any root
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Resolve root context
        try:
            rid = request.query_params.get("root_user_id")
            if rid is not None and str(rid).strip() != "":
                root_user_id = int(rid)
            else:
                root_user_id = int(getattr(request.user, "id", 0) or 0)
        except Exception:
            root_user_id = int(getattr(request.user, "id", 0) or 0)

        # AuthZ
        if root_user_id != getattr(request.user, "id", None) and not getattr(request.user, "is_staff", False):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # Parent user whose subtree we want
        try:
            uid_raw = request.query_params.get("user_id")
            parent_user_id = int(uid_raw)
        except Exception:
            return Response({"detail": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure a rank-1 root exists (lazy create; idempotent). Do not early-return if absent.
        try:
            from .models import RankMatrixRoot
            try:
                user_obj = request.user
                if getattr(user_obj, "id", None) != root_user_id:
                    from accounts.models import CustomUser
                    user_obj = CustomUser.objects.filter(id=root_user_id).first()
                if user_obj:
                    FiveMatrixService.ensure_root_for_rank1(user_obj)
            except Exception:
                pass
        except Exception:
            pass

        # Best-effort: ensure historical placements are materialized for this root (idempotent)
        try:
            FiveMatrixService.lazy_backfill_for_root(root_user_id)
        except Exception:
            pass

        # Fetch immediate children under this parent within the root's matrix
        from .models import RankMatrixNode, UserRank
        try:
            rows = list(
                RankMatrixNode.objects
                .select_related("placed_user")
                .filter(root_user_id=root_user_id, parent_user_id=parent_user_id)
                .order_by("position", "id")
            )
        except Exception:
            rows = []

        # Preload user ranks for displayed children
        child_ids = [int(getattr(r, "placed_user_id", 0) or 0) for r in rows]
        ranks_by_user = {}
        if child_ids:
            try:
                urs = (
                    UserRank.objects
                    .select_related("current_rank")
                    .filter(user_id__in=child_ids)
                )
                for ur in urs:
                    ranks_by_user[int(getattr(ur, "user_id", 0) or 0)] = {
                        "level": int(getattr(getattr(ur, "current_rank", None), "level_number", 0) or 0),
                        "name": getattr(getattr(ur, "current_rank", None), "rank_name", None),
                    }
            except Exception:
                ranks_by_user = {}

        # Bonus aggregates per child -> parent (LEVEL only)
        from .models import UpgradeCommission, CommissionHold
        data = []
        for n in rows:
            pu = getattr(n, "placed_user", None)
            cid = int(getattr(n, "placed_user_id", 0) or 0)
            # Released level income to this parent from this child (all ranks that credited to parent over level idx used then)
            released = q2(
                UpgradeCommission.objects.filter(
                    to_user_id=parent_user_id,
                    from_user_id=cid,
                    commission_type=UpgradeCommission.TYPE_LEVEL,
                    status=UpgradeCommission.STATUS_CREDITED,
                ).aggregate(s=Sum("commission_amount")).get("s") or 0
            )
            # Pending holds to this parent from this child
            pending_hold = q2(
                CommissionHold.objects.filter(
                    commission__to_user_id=parent_user_id,
                    commission__from_user_id=cid,
                    commission__commission_type=UpgradeCommission.TYPE_LEVEL,
                    status=CommissionHold.STATUS_PENDING,
                ).aggregate(s=Sum("hold_amount")).get("s") or 0
            )
            # Has further children?
            try:
                has_kids = RankMatrixNode.objects.filter(root_user_id=root_user_id, parent_user_id=cid).exists()
            except Exception:
                has_kids = False

            data.append({
                "user_id": cid,
                "username": getattr(pu, "username", None),
                "placement_level": int(getattr(n, "level_depth", 0) or 0),
                "position": int(getattr(n, "position", 0) or 0),
                "approved_at": getattr(n, "approved_at", None),
                "current_rank": ranks_by_user.get(cid, {"level": 0, "name": None}),
                "bonus_released": released,
                "bonus_hold": pending_hold,
                "has_children": bool(has_kids),
            })

        payload = {
            "root_user_id": root_user_id,
            "parent_user_id": parent_user_id,
            "count": len(data),
            "children": data,
        }
        return Response(payload, status=status.HTTP_200_OK)


class RankMatrixBFSView(APIView):
    """
    GET /rank-matrix/tree-bfs/
    Returns a BFS tree of Rank-1 matrix nodes in the same shape as the FIVE_150
    entries endpoint, so InteractiveTree.jsx can render it identically.

    Params:
      - start_user_id  : user_id to root the BFS from (defaults to caller / root_user_id)
      - root_user_id   : which Rank-1 matrix root to query (defaults to caller)
      - max_depth      : depth to fetch inline (default 2, capped at 5)

    Response shape matches /accounts/my/matrix/tree5/entries/:
      {
        "user_id": 395, "username": "...", "full_name": "...", "root_user_id": 395,
        "level": 1, "position": 0, "status": "ACTIVE",
        "team_count": N, "direct_count": M,
        "children": [ { same shape ... }, ... ]
      }
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # ── Resolve root_user_id ──
        rid = request.query_params.get("root_user_id")
        try:
            root_user_id = int(rid) if rid and str(rid).strip() != "" else int(getattr(request.user, "id", 0) or 0)
        except Exception:
            root_user_id = int(getattr(request.user, "id", 0) or 0)

        if root_user_id != getattr(request.user, "id", None) and not getattr(request.user, "is_staff", False):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # ── Resolve start_user_id ──
        suid_raw = request.query_params.get("start_user_id")
        try:
            start_user_id = int(suid_raw) if suid_raw and str(suid_raw).strip() != "" else root_user_id
        except Exception:
            start_user_id = root_user_id

        # ── max_depth ──
        try:
            max_depth = max(1, min(5, int(request.query_params.get("max_depth", 2))))
        except Exception:
            max_depth = 2

        from .models import RankMatrixNode
        from accounts.models import CustomUser

        # ── Lazy-create root + backfill ──
        try:
            user_obj = request.user if getattr(request.user, "id", None) == root_user_id else CustomUser.objects.filter(id=root_user_id).first()
            if user_obj:
                FiveMatrixService.ensure_root_for_rank1(user_obj)
                FiveMatrixService.lazy_backfill_for_root(root_user_id)
        except Exception:
            pass

        # ── Fetch start_user info ──
        try:
            start_user_obj = CustomUser.objects.filter(id=start_user_id).first()
        except Exception:
            start_user_obj = None

        # ── Fetch RankMatrixNode for start_user (gives position/level) ──
        start_rnode = None
        if start_user_id != root_user_id:
            try:
                start_rnode = RankMatrixNode.objects.filter(
                    root_user_id=root_user_id, placed_user_id=start_user_id
                ).first()
            except Exception:
                pass

        def make_node(user, rnode=None):
            uid = int(getattr(user, "id", 0) or 0) if user else 0
            fn = (getattr(user, "first_name", "") or "").strip()
            ln = (getattr(user, "last_name", "") or "").strip()
            return {
                "user_id":      uid,
                "username":     getattr(user, "username", None),
                "full_name":    f"{fn} {ln}".strip(),
                "root_user_id": root_user_id,
                "level":        int(getattr(rnode, "level_depth", 1) or 1) if rnode else 1,
                "position":     int(getattr(rnode, "position", 0) or 0) if rnode else 0,
                "approved_at":  getattr(rnode, "approved_at", None) if rnode else None,
                "status":       "ACTIVE",
                "team_count":   0,
                "direct_count": 0,
                "children":     [],
            }

        root_node = make_node(start_user_obj, start_rnode)

        # ── BFS ──
        nodes_by_uid = {start_user_id: root_node}
        frontier = [start_user_id]
        levels_done = 1

        while frontier and levels_done < max_depth:
            try:
                rows = list(
                    RankMatrixNode.objects.select_related("placed_user")
                    .filter(root_user_id=root_user_id, parent_user_id__in=frontier)
                    .order_by("parent_user_id", "position", "id")
                )
            except Exception:
                rows = []
            if not rows:
                break

            counts = {}
            next_frontier = []
            for row in rows:
                pid = int(getattr(row, "parent_user_id", 0) or 0)
                pu = getattr(row, "placed_user", None)
                if not pu or pid not in nodes_by_uid:
                    continue
                cid = int(getattr(row, "placed_user_id", 0) or 0)
                if counts.get(pid, 0) >= 5:
                    continue
                child_node = make_node(pu, row)
                nodes_by_uid[pid]["children"].append(child_node)
                nodes_by_uid[cid] = child_node
                counts[pid] = counts.get(pid, 0) + 1
                next_frontier.append(cid)

            if not next_frontier:
                break
            frontier = next_frontier
            levels_done += 1

        # ── Accurate team_count + direct_count via full-depth BFS ──
        try:
            parent_to_children: dict = {}
            all_ids = list(nodes_by_uid.keys())
            visited: set = set(all_ids)

            while all_ids:
                child_rows = list(
                    RankMatrixNode.objects.filter(
                        root_user_id=root_user_id,
                        parent_user_id__in=all_ids,
                    ).values("placed_user_id", "parent_user_id")
                )
                next_ids = []
                for row in child_rows:
                    pid = int(row["parent_user_id"] or 0)
                    cid = int(row["placed_user_id"] or 0)
                    parent_to_children.setdefault(pid, []).append(cid)
                    if cid not in visited:
                        visited.add(cid)
                        next_ids.append(cid)
                all_ids = next_ids

            count_memo: dict = {}

            def _count_all(nid):
                if nid in count_memo:
                    return count_memo[nid]
                kids = parent_to_children.get(nid, [])
                total = len(kids)
                for kid in kids:
                    total += _count_all(kid)
                count_memo[nid] = total
                return total

            for uid, node in nodes_by_uid.items():
                node["direct_count"] = len(parent_to_children.get(uid, []))
                node["team_count"] = _count_all(uid)
        except Exception:
            pass

        return Response(root_node, status=status.HTTP_200_OK)


class AdminRankUpgradesView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        qs = (
            RankUpgrade.objects
            .select_related("user", "from_rank", "to_rank")
            .prefetch_related(
                "payments",
                Prefetch(
                    "commissions",
                    queryset=UpgradeCommission.objects.select_related("to_user")
                ),
            )
            .all()
            .order_by("-created_at", "-id")
        )
        # Filters
        user_id = request.query_params.get("user_id")
        to_rank = request.query_params.get("to_rank")
        from_rank = request.query_params.get("from_rank")
        status_f = request.query_params.get("status")
        if user_id:
            qs = qs.filter(user_id=int(user_id))
        if to_rank:
            qs = qs.filter(to_rank_id=int(to_rank))
        if from_rank:
            qs = qs.filter(from_rank_id=int(from_rank))
        if status_f:
            qs = qs.filter(payment_status=str(status_f).upper())

        data = RankUpgradeSerializer(qs, many=True).data
        return Response(data)


class AdminUpgradeCommissionsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, upgrade_id: int):
        qs = (
            UpgradeCommission.objects
            .select_related("upgrade", "to_user")
            .filter(upgrade_id=int(upgrade_id))
            .order_by("level", "id")
        )
        return Response(UpgradeCommissionSerializer(qs, many=True).data)


class AdminCommissionHoldsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        qs = (
            CommissionHold.objects
            .select_related("commission", "commission__to_user")
            .all()
            .order_by("release_date", "id")
        )
        upgrade_id = request.query_params.get("upgrade_id")
        if upgrade_id:
            qs = qs.filter(commission__upgrade_id=int(upgrade_id))
        status_f = request.query_params.get("status")
        if status_f:
            qs = qs.filter(status=str(status_f).upper())
        return Response(CommissionHoldSerializer(qs, many=True).data)


class AdminApproveRankUpgradeView(APIView):
    """
    Admin approval for a pending (INITIATED) rank upgrade.
    On approval:
      - Mark SUCCESS + upgraded_at
      - Update user's current rank
      - Distribute commissions (50/50 + holds)
    Idempotent if already SUCCESS.
    """
    permission_classes = [permissions.IsAdminUser]

    @transaction.atomic
    def post(self, request, upgrade_id: int):
        upg = (
            RankUpgrade.objects
            .select_for_update()
            .select_related("user", "to_rank")
            .filter(id=int(upgrade_id))
            .first()
        )
        if not upg:
            return Response({"detail": "Upgrade not found."}, status=status.HTTP_404_NOT_FOUND)

        if upg.payment_status == RankUpgrade.STATUS_SUCCESS:
            # If already SUCCESS, ensure placement is materialized for Rank‑1 purchase (to_rank=L1),
            # and distribute only if commissions for this upgrade are missing. Idempotent.
            try:
                to_lvl = int(getattr(getattr(upg, "to_rank", None), "level_number", 0) or 0)
                is_rank1_purchase = to_lvl == 1
                if is_rank1_purchase:
                    # Always ensure root + placement under sponsor on read/approval re-entry
                    FiveMatrixService.on_rank1_approval(upg)
                if not UpgradeCommission.objects.filter(upgrade_id=upg.id).exists():
                    if is_rank1_purchase:
                        FiveMatrixService.distribute_rank1_commissions(upg)
                    else:
                        CommissionDistributor.distribute(upg)
            except Exception:
                pass
            return Response(RankUpgradeSerializer(upg).data, status=status.HTTP_200_OK)

        if upg.payment_status != RankUpgrade.STATUS_INITIATED:
            return Response(
                {"detail": f"Cannot approve upgrade in status '{upg.payment_status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        upg.payment_status = RankUpgrade.STATUS_SUCCESS
        upg.upgraded_at = now
        upg.save(update_fields=["payment_status", "upgraded_at"])

        ur, _cur = RankEligibilityService.get_or_bootstrap_user_rank(upg.user)
        ur.current_rank = upg.to_rank
        ur.achieved_at = now
        ur.save(update_fields=["current_rank", "achieved_at"])

        try:
            to_lvl = int(getattr(getattr(upg, "to_rank", None), "level_number", 0) or 0)
            is_rank1_purchase = to_lvl == 1
            if is_rank1_purchase:
                FiveMatrixService.distribute_rank1_commissions(upg)
                FiveMatrixService.on_rank1_approval(upg)
            else:
                CommissionDistributor.distribute(upg)
        except Exception:
            # Keep upgrade SUCCESS; ops can re-run distribution via management command if needed
            pass

        return Response(RankUpgradeSerializer(upg).data, status=status.HTTP_200_OK)


class AdminRejectRankUpgradeView(APIView):
    """
    Admin rejection for a pending (INITIATED) rank upgrade.
    Marks CANCELLED; does not change user rank or distribute commissions.
    """
    permission_classes = [permissions.IsAdminUser]

    @transaction.atomic
    def post(self, request, upgrade_id: int):
        upg = (
            RankUpgrade.objects
            .select_for_update()
            .filter(id=int(upgrade_id))
            .first()
        )
        if not upg:
            return Response({"detail": "Upgrade not found."}, status=status.HTTP_404_NOT_FOUND)

        if upg.payment_status == RankUpgrade.STATUS_SUCCESS:
            return Response({"detail": "Already successful; cannot reject."}, status=status.HTTP_400_BAD_REQUEST)

        if upg.payment_status != RankUpgrade.STATUS_INITIATED:
            return Response(
                {"detail": f"Cannot reject upgrade in status '{upg.payment_status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Optional: accept 'reason' but we don't persist it without a model field
        _reason = request.data.get("reason") or request.data.get("review_note") or ""

        upg.payment_status = RankUpgrade.STATUS_CANCELLED
        upg.save(update_fields=["payment_status"])

        return Response(RankUpgradeSerializer(upg).data, status=status.HTTP_200_OK)
