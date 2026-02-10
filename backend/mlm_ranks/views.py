from __future__ import annotations

from decimal import Decimal
from typing import Optional

from django.db import transaction
from django.utils import timezone
from django.shortcuts import get_object_or_404

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
from .services.commission import CommissionDistributor
from .services.config import q2, GST_RATE


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

    def get(self, request):
        res = RankEligibilityService.evaluate(request.user)
        payload = EligibilitySerializer.from_result(res).data
        ur, cur = RankEligibilityService.get_or_bootstrap_user_rank(request.user)
        current_rank_name = getattr(cur, "rank_name", None)
        current_level = getattr(cur, "level_number", None)
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

        cur_level = int(getattr(cur_rank, "level_number", 0) or 0)
        target_level = int(getattr(to_rank, "level_number", 0) or 0)
        if target_level <= cur_level:
            return Response({"detail": "Target rank must be higher than current rank"}, status=status.HTTP_400_BAD_REQUEST)

        # Sum upgrade_amounts for levels (cur_level+1 .. target_level)
        ranks = Rank.objects.filter(level_number__gt=cur_level, level_number__lte=target_level).order_by("level_number")
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


# ----------------------- Admin APIs -----------------------

class AdminRankUpgradesView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        qs = RankUpgrade.objects.select_related("user", "from_rank", "to_rank").all().order_by("-created_at", "-id")
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
            # If already SUCCESS but commissions not distributed yet, distribute now (idempotent)
            try:
                if not UpgradeCommission.objects.filter(upgrade_id=upg.id).exists():
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
