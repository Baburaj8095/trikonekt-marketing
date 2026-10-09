# Asiyapp Commission Ranks Module - Backend Views & Workflows
from __future__ import annotations

from decimal import Decimal
from typing import Optional

from django.db import transaction
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Max, Prefetch, Count

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

        # Count placed nodes by level_depth in the user's Rank-1 5-Matrix
        from django.db.models import Count
        from .models import RankMatrixNode
        try:
            level_counts = dict(
                RankMatrixNode.objects.filter(root_user=request.user)
                .values_list("level_depth")
                .annotate(c=Count("id"))
            )
            level_team_counts = {lvl: level_counts.get(lvl, 0) for lvl in range(1, 11)}
        except Exception:
            level_team_counts = {lvl: 0 for lvl in range(1, 11)}

        # Dynamic Royalty & Qualification Evaluation
        from accounts.models import WalletTransaction
        from business.models import CommissionConfig
        from django.db.models import Q
        try:
            cfg = CommissionConfig.get_solo()
            master = dict(getattr(cfg, "master_commission_json", {}) or {})
            royalty_cfg = dict(master.get("royalty_config", {}) or {})

            t1_pct = float(royalty_cfg.get("tier1_percent", 4.0))
            t1_cap = float(royalty_cfg.get("tier1_cap", 10000.0))
            t1_days = int(royalty_cfg.get("tier1_days", 40))
            t1_levels = str(royalty_cfg.get("tier1_levels", "Layer 1 to Layer 7"))

            t2_pct = float(royalty_cfg.get("tier2_percent", 6.0))
            t2_cap = float(royalty_cfg.get("tier2_cap", 40000.0))
            t2_days = int(royalty_cfg.get("tier2_days", 7))
            t2_levels = str(royalty_cfg.get("tier2_levels", "Layer 8 to Layer 10"))

            t3_pct = float(royalty_cfg.get("tier3_percent", 4.0))
            t3_cap = float(royalty_cfg.get("tier3_cap", 10000.0))
            t3_days = int(royalty_cfg.get("tier3_days", 30))
            t3_levels = str(royalty_cfg.get("tier3_levels", "Layer 1 to Layer 10"))

            # Royalty earnings query (75% net income only, excluding 25% Self Account)
            q_royalty = Q(type="GLOBAL_ROYALTY") | Q(source_id__startswith="ROYALTY_") | Q(meta__orig_type="GLOBAL_ROYALTY")
            user_royalty_txs = WalletTransaction.objects.filter(user=request.user).filter(q_royalty).exclude(
                Q(type="SELF_ACCOUNT_CREDIT") | Q(meta__ledger="SELF_ACCOUNT")
            )
            total_royalty_earned = float(user_royalty_txs.aggregate(t=Sum("amount"))["t"] or Decimal("0.00"))
            t1_earned = float(user_royalty_txs.filter(Q(source_id__startswith="ROYALTY_T1_") | Q(meta__tier=1)).aggregate(t=Sum("amount"))["t"] or Decimal("0.00"))
            t2_earned = float(user_royalty_txs.filter(Q(source_id__startswith="ROYALTY_T2_") | Q(meta__tier=2)).aggregate(t=Sum("amount"))["t"] or Decimal("0.00"))
            t3_earned = float(user_royalty_txs.filter(Q(source_id__startswith="ROYALTY_T3_") | Q(meta__tier=3)).aggregate(t=Sum("amount"))["t"] or Decimal("0.00"))

            # Upgrade timeline & active onboarding baseline date
            upgrades = list(RankUpgrade.objects.filter(
                user=request.user,
                payment_status=RankUpgrade.STATUS_SUCCESS
            ).select_related("to_rank").order_by("to_rank__level_number"))

            from business.models import PromoPurchase
            promo_dt = PromoPurchase.objects.filter(
                user=request.user, status="APPROVED"
            ).order_by("approved_at").values_list("approved_at", flat=True).first()
            r1_dt = next((ru.upgraded_at for ru in upgrades if ru.to_rank and ru.to_rank.level_number == 1), None)
            cands = [dt.date() for dt in (promo_dt, r1_dt) if dt is not None]
            activation_date = min(cands) if cands else (request.user.date_joined.date() if request.user.date_joined else timezone.now().date())

            today_date = timezone.now().date()
            days_since_active = (today_date - activation_date).days

            r7_up = next((ru for ru in upgrades if ru.to_rank and ru.to_rank.level_number >= 7), None)
            r7_date = r7_up.upgraded_at.date() if r7_up and r7_up.upgraded_at else None

            r10_up = next((ru for ru in upgrades if ru.to_rank and ru.to_rank.level_number >= 10), None)
            r10_date = r10_up.upgraded_at.date() if r10_up and r10_up.upgraded_at else None

            # 1. Tier 1 Evaluation
            t1_qualified = False
            t1_days_taken = None
            if r7_date:
                t1_days_taken = max(0, (r7_date - activation_date).days)
                if t1_days_taken <= t1_days or t1_earned > 0:
                    t1_qualified = True
                    t1_status = "COMPLETED"
                else:
                    t1_status = "MISSED"
            else:
                if t1_earned > 0:
                    t1_qualified = True
                    t1_status = "COMPLETED"
                elif days_since_active <= t1_days:
                    t1_status = "IN_PROGRESS"
                else:
                    t1_status = "MISSED"

            # 2. Tier 2 Evaluation
            t2_qualified = False
            t2_days_taken = None
            if t1_qualified and r7_date:
                if r10_date:
                    t2_days_taken = max(0, (r10_date - r7_date).days)
                    if t2_days_taken <= t2_days or t2_earned > 0:
                        t2_qualified = True
                        t2_status = "COMPLETED"
                    else:
                        t2_status = "MISSED"
                else:
                    days_since_r7 = (today_date - r7_date).days
                    if days_since_r7 <= t2_days:
                        t2_status = "IN_PROGRESS"
                    else:
                        t2_status = "MISSED"
            else:
                if t2_earned > 0:
                    t2_qualified = True
                    t2_status = "COMPLETED"
                elif r10_date:
                    t2_status = "MISSED"
                else:
                    t2_status = "LOCKED"

            # 3. Tier 3 Evaluation (Recovery: L1-L10 within t3_days from activation)
            t3_qualified = False
            t3_days_taken = None
            if t1_qualified and t2_qualified:
                t3_status = "NOT_APPLICABLE"
            elif r10_date:
                t3_days_taken = max(0, (r10_date - activation_date).days)
                if t3_days_taken <= t3_days or t3_earned > 0:
                    t3_qualified = True
                    t3_status = "COMPLETED"
                else:
                    t3_status = "MISSED"
            else:
                if days_since_active <= t3_days:
                    t3_status = "IN_PROGRESS"
                else:
                    t3_status = "MISSED"

            # Effective eligible cap
            if t1_qualified and t2_qualified:
                total_cap = t1_cap + t2_cap
            elif t1_qualified and not t2_qualified:
                total_cap = t1_cap
            elif t3_qualified:
                total_cap = t3_cap
            else:
                if t1_status == "IN_PROGRESS" or t2_status == "IN_PROGRESS":
                    total_cap = t1_cap + t2_cap
                elif t3_status == "IN_PROGRESS":
                    total_cap = t3_cap
                else:
                    total_cap = 0.0

            royalty_info = {
                "config": {
                    "tier1_percent": t1_pct,
                    "tier1_cap": t1_cap,
                    "tier1_days": t1_days,
                    "tier1_levels": t1_levels,
                    "tier2_percent": t2_pct,
                    "tier2_cap": t2_cap,
                    "tier2_days": t2_days,
                    "tier2_levels": t2_levels,
                    "tier3_percent": t3_pct,
                    "tier3_cap": t3_cap,
                    "tier3_days": t3_days,
                    "tier3_levels": t3_levels,
                },
                "total_earned": round(total_royalty_earned, 2),
                "tier1_earned": round(t1_earned, 2),
                "tier2_earned": round(t2_earned, 2),
                "tier3_earned": round(t3_earned, 2),
                "total_cap": round(total_cap, 2),
                "max_possible_cap": round(t1_cap + t2_cap, 2),
                "tier1": {
                    "qualified": t1_qualified,
                    "status": t1_status,
                    "cap": t1_cap,
                    "percent": t1_pct,
                    "days_allowed": t1_days,
                    "days_taken": t1_days_taken,
                    "days_remaining": max(0, t1_days - days_since_active) if t1_status == "IN_PROGRESS" else 0,
                },
                "tier2": {
                    "qualified": t2_qualified,
                    "status": t2_status,
                    "cap": t2_cap,
                    "percent": t2_pct,
                    "days_allowed": t2_days,
                    "days_taken": t2_days_taken,
                    "days_remaining": max(0, t2_days - ((today_date - r7_date).days if r7_date else 0)) if t2_status == "IN_PROGRESS" else 0,
                },
                "tier3": {
                    "qualified": t3_qualified,
                    "status": t3_status,
                    "cap": t3_cap,
                    "percent": t3_pct,
                    "days_allowed": t3_days,
                    "days_taken": t3_days_taken,
                    "days_remaining": max(0, t3_days - days_since_active) if t3_status == "IN_PROGRESS" else 0,
                },
            }
        except Exception:
            royalty_info = {
                "config": {
                    "tier1_percent": 4.0, "tier1_cap": 10000.0, "tier1_days": 40, "tier1_levels": "Layer 1 to Layer 7",
                    "tier2_percent": 6.0, "tier2_cap": 40000.0, "tier2_days": 7, "tier2_levels": "Layer 8 to Layer 10",
                    "tier3_percent": 4.0, "tier3_cap": 10000.0, "tier3_days": 30, "tier3_levels": "Layer 1 to Layer 10",
                },
                "total_earned": 0.0,
                "tier1_earned": 0.0,
                "tier2_earned": 0.0,
                "tier3_earned": 0.0,
                "total_cap": 50000.0,
                "max_possible_cap": 50000.0,
                "tier1": {"qualified": False, "status": "IN_PROGRESS", "cap": 10000.0, "percent": 4.0, "days_allowed": 40, "days_remaining": 40},
                "tier2": {"qualified": False, "status": "LOCKED", "cap": 40000.0, "percent": 6.0, "days_allowed": 7, "days_remaining": 0},
                "tier3": {"qualified": False, "status": "IN_PROGRESS", "cap": 10000.0, "percent": 4.0, "days_allowed": 30, "days_remaining": 30},
            }

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
                "level_team_counts": level_team_counts,
                "team_counts_by_level": level_team_counts,
                "reason": payload["reason"],
                "royalty_info": royalty_info,
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

        # Calculate taxes dynamically from CommissionConfig (custom_module_tax['tax_rank']) or tax_percent fallback
        upgrade_amount = total_upgrade
        try:
            from business.models import CommissionConfig
            cfg = CommissionConfig.get_solo()
            master_json = getattr(cfg, "master_commission_json", {}) or {}
            custom_tax = master_json.get("custom_module_tax", {}) or {}
            tax_rate_val = custom_tax.get("tax_rank")
            if tax_rate_val is None:
                tax_rate_val = cfg.get_tax_percent() or "18.00"
            tax_pct = Decimal(str(tax_rate_val)) / Decimal("100.00")
        except Exception:
            tax_pct = GST_RATE
        gst_amount = q2(upgrade_amount * tax_pct)
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
    Pay an initiated rank upgrade from a package wallet pocket.
    Supported wallet_source values:
      - internal: Self Package Pocket
      - package_coupon: Package Purchase Coupon Wallet
      - package_upload/add_money: Add Money Pocket
    """
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        from decimal import Decimal as D
        from accounts.models import Wallet, WalletTransaction
        from accounts.finance_constants import WalletTypes
        from accounts.wallet_engine import WalletEngine

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

        w = Wallet.get_or_create_for_user(request.user)

        wallet_source = str(request.data.get("wallet_source") or request.data.get("walletSource") or "main").strip().lower()
        if wallet_source not in {"main", "main_wallet", "internal", "package_coupon", "package_upload", "add_money"}:
            return Response({"detail": "Invalid wallet_source."}, status=status.HTTP_400_BAD_REQUEST)
        if wallet_source == "add_money":
            wallet_source = "package_upload"

        if wallet_source in {"main", "main_wallet"}:
            if w.balance < amount:
                return Response({"detail": f"Insufficient Main Wallet balance (₹{w.balance}). Required: ₹{amount}"}, status=status.HTTP_400_BAD_REQUEST)
            try:
                w.debit(
                    amount,
                    tx_type="RANK_UPGRADE_DEBIT",
                    meta={"reason": "RANK_UPGRADE", "upgrade_id": upg.id, "wallet_source": "main"},
                    source_type="RANK_UPGRADE",
                    source_id=str(upg.id),
                )
                tx = WalletTransaction.objects.filter(
                    user=request.user,
                    source_type="RANK_UPGRADE",
                    source_id=str(upg.id)
                ).order_by("-id").first()
                if tx:
                    try:
                        from accounts.finance_constants import WalletTypes, FinanceCategories, LedgerDirections
                        from accounts.wallet_engine import WalletEngine, LedgerPosting
                        
                        system_user = WalletEngine.get_system_user()
                        WalletEngine.post_transaction(
                            category=FinanceCategories.PACKAGE_PURCHASE,
                            user=request.user,
                            source_module="RANK_UPGRADE",
                            source_id=str(upg.id),
                            destination_module=WalletTypes.SYSTEM,
                            gross_amount=amount,
                            net_amount=amount,
                            idempotency_key=f"rank_upgrade_main_debit:{upg.id}",
                            legacy_wallet_transaction=tx,
                            created_by=request.user,
                            approved_by=request.user,
                            remarks="Rank upgrade debit from main wallet",
                            metadata={"upgrade_id": upg.id, "wallet_source": "main"},
                            postings=[
                                LedgerPosting(request.user, WalletTypes.MAIN, LedgerDirections.DEBIT, amount, metadata={"upgrade_id": upg.id}),
                                LedgerPosting(system_user, WalletTypes.SYSTEM, LedgerDirections.CREDIT, amount, metadata={"counterparty_user_id": request.user.id}),
                            ],
                        )
                    except Exception:
                        pass
            except Exception as e:
                return Response({"detail": str(e) or "Failed to debit Main Wallet."}, status=status.HTTP_400_BAD_REQUEST)
        elif wallet_source == "package_coupon":
            credit = WalletTransaction.objects.filter(
                user=request.user,
                type__in=["PACKAGE_COUPON_WALLET_CREDIT", "VOUCHER_REDEEM_CREDIT"],
                amount__gt=0,
            ).aggregate(total=Sum("amount"))["total"] or D("0.00")
            debit = WalletTransaction.objects.filter(
                user=request.user,
                type="PACKAGE_COUPON_WALLET_DEBIT",
                amount__lt=0,
            ).aggregate(total=Sum("amount"))["total"] or D("0.00")
            available = D(str(credit)) + D(str(debit))
            if available < amount:
                return Response({"detail": "Insufficient Package Purchase Coupon Wallet balance."}, status=status.HTTP_400_BAD_REQUEST)



            tx = WalletTransaction.objects.create(
                user=request.user,
                amount=amount * D("-1"),
                balance_after=w.balance,
                type="PACKAGE_COUPON_WALLET_DEBIT",
                source_type="RANK_UPGRADE",
                source_id=str(upg.id),
                meta={"reason": "RANK_UPGRADE", "upgrade_id": upg.id, "wallet_source": "package_coupon"},
            )
            try:
                from accounts.finance_constants import WalletTypes, FinanceCategories, LedgerDirections
                from accounts.wallet_engine import WalletEngine, LedgerPosting
                
                system_user = WalletEngine.get_system_user()
                WalletEngine.post_transaction(
                    category=FinanceCategories.PACKAGE_PURCHASE,
                    user=request.user,
                    source_module="RANK_UPGRADE",
                    source_id=str(upg.id),
                    destination_module=WalletTypes.SYSTEM,
                    gross_amount=amount,
                    net_amount=amount,
                    idempotency_key=f"rank_upgrade_coupon_debit:{upg.id}",
                    legacy_wallet_transaction=tx,
                    created_by=request.user,
                    approved_by=request.user,
                    remarks="Rank upgrade debit from package purchase coupon wallet",
                    metadata={"upgrade_id": upg.id, "wallet_source": "package_coupon"},
                    postings=[
                        LedgerPosting(request.user, WalletTypes.PACKAGE_PURCHASE_COUPON, LedgerDirections.DEBIT, amount, metadata={"upgrade_id": upg.id}),
                        LedgerPosting(system_user, WalletTypes.SYSTEM, LedgerDirections.CREDIT, amount, metadata={"counterparty_user_id": request.user.id}),
                    ],
                )
            except Exception:
                pass
        elif wallet_source == "package_upload":
            add_money_acc = WalletEngine.get_account(request.user, WalletTypes.ADD_MONEY_POCKET, lock=True)
            available = D(str(add_money_acc.available_balance or 0)).quantize(D("0.01"))
            if available < amount:
                return Response({"detail": "Insufficient Add Money Pocket balance."}, status=status.HTTP_400_BAD_REQUEST)

            w = Wallet.objects.get(pk=w.pk)

            tx = WalletTransaction.objects.create(
                user=request.user,
                amount=amount * D("-1"),
                balance_after=w.balance,
                type="INTERNAL_WALLET_DEBIT",
                source_type="WALLET_UPLOAD",
                source_id=str(upg.id),
                meta={"reason": "RANK_UPGRADE", "upgrade_id": upg.id, "wallet_source": "package_upload"},
            )
            try:
                from accounts.finance_constants import WalletTypes, FinanceCategories, LedgerDirections
                from accounts.wallet_engine import WalletEngine, LedgerPosting
                
                system_user = WalletEngine.get_system_user()
                WalletEngine.post_transaction(
                    category=FinanceCategories.PACKAGE_PURCHASE,
                    user=request.user,
                    source_module="RANK_UPGRADE",
                    source_id=str(upg.id),
                    destination_module=WalletTypes.SYSTEM,
                    gross_amount=amount,
                    net_amount=amount,
                    idempotency_key=f"rank_upgrade_upload_debit:{upg.id}",
                    legacy_wallet_transaction=tx,
                    created_by=request.user,
                    approved_by=request.user,
                    remarks="Rank upgrade debit from add money pocket",
                    metadata={"upgrade_id": upg.id, "wallet_source": "package_upload"},
                    postings=[
                        LedgerPosting(request.user, WalletTypes.ADD_MONEY_POCKET, LedgerDirections.DEBIT, amount, metadata={"upgrade_id": upg.id}),
                        LedgerPosting(system_user, WalletTypes.SYSTEM, LedgerDirections.CREDIT, amount, metadata={"counterparty_user_id": request.user.id}),
                    ],
                )
            except Exception:
                pass
        else:
            try:
                w.debit(
                    amount,
                    tx_type="INTERNAL_WALLET_DEBIT",
                    meta={"reason": "RANK_UPGRADE", "upgrade_id": upg.id, "wallet_source": "internal"},
                    source_type="RANK_UPGRADE",
                    source_id=str(upg.id),
                )
                tx = WalletTransaction.objects.filter(
                    user=request.user,
                    type="INTERNAL_WALLET_DEBIT",
                    source_type="RANK_UPGRADE",
                    source_id=str(upg.id)
                ).order_by("-id").first()
                if tx:
                    try:
                        from accounts.finance_constants import WalletTypes, FinanceCategories, LedgerDirections
                        from accounts.wallet_engine import WalletEngine, LedgerPosting
                        
                        system_user = WalletEngine.get_system_user()
                        WalletEngine.post_transaction(
                            category=FinanceCategories.PACKAGE_PURCHASE,
                            user=request.user,
                            source_module="RANK_UPGRADE",
                            source_id=str(upg.id),
                            destination_module=WalletTypes.SYSTEM,
                            gross_amount=amount,
                            net_amount=amount,
                            idempotency_key=f"rank_upgrade_internal_debit:{upg.id}",
                            legacy_wallet_transaction=tx,
                            created_by=request.user,
                            approved_by=request.user,
                            remarks="Rank upgrade debit from self package pocket",
                            metadata={"upgrade_id": upg.id, "wallet_source": "internal"},
                            postings=[
                                LedgerPosting(request.user, WalletTypes.SELF_PACKAGE_POCKET, LedgerDirections.DEBIT, amount, metadata={"upgrade_id": upg.id}),
                                LedgerPosting(system_user, WalletTypes.SYSTEM, LedgerDirections.CREDIT, amount, metadata={"counterparty_user_id": request.user.id}),
                            ],
                        )
                    except Exception:
                        pass
            except Exception:
                return Response({"detail": "Insufficient Self Package Wallet balance."}, status=status.HTTP_400_BAD_REQUEST)

        rup = RankUpgradePayment.objects.create(
            upgrade=upg,
            utr="",
            remarks=f"Paid from {wallet_source.replace('_', ' ').title()}",
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
                .exclude(placed_user_id=root_user_id)
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
                # Fallback to RankUpgrade if UserRank is not yet populated
                missing_cids = [cid for cid in child_ids if cid not in ranks_by_user]
                if missing_cids:
                    max_upgs = dict(
                        RankUpgrade.objects.filter(user_id__in=missing_cids, payment_status=RankUpgrade.STATUS_SUCCESS)
                        .values_list("user_id")
                        .annotate(m=Max("to_rank__level_number"))
                    )
                    for cid, lvl in max_upgs.items():
                        ranks_by_user[cid] = {
                            "level": int(lvl or 0),
                            "name": f"Layer {lvl}" if lvl else None,
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
                "current_rank": 0,
                "rank_level":   0,
                "rank_name":    "None",
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
                    .exclude(placed_user_id=root_user_id)
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

            # Lookup highest approved rank for all users in BFS tree
            user_ids = [u for u in nodes_by_uid.keys() if u]
            max_ranks = dict(
                RankUpgrade.objects.filter(user_id__in=user_ids, payment_status=RankUpgrade.STATUS_SUCCESS)
                .values_list("user_id")
                .annotate(max_lvl=Max("to_rank__level_number"))
            )
            ur_map = dict(
                UserRank.objects.filter(user_id__in=user_ids)
                .values_list("user_id", "current_rank__level_number")
            )

            # Direct sponsored count from CustomUser (users who have this user as direct sponsor)
            from accounts.models import CustomUser
            direct_sponsor_map = dict(
                CustomUser.objects.filter(registered_by_id__in=user_ids)
                .values("registered_by_id")
                .annotate(cnt=Count("id"))
                .values_list("registered_by_id", "cnt")
            )

            for uid, node in nodes_by_uid.items():
                real_direct = direct_sponsor_map.get(uid, 0)
                node["direct_count"] = real_direct
                node["direct_sponsor_count"] = real_direct
                node["matrix_children_count"] = len(parent_to_children.get(uid, []))
                node["team_count"] = _count_all(uid)
                lvl = int(max_ranks.get(uid) or ur_map.get(uid) or 0)
                node["current_rank"] = lvl
                node["rank_level"] = lvl
                node["rank_name"] = f"Layer {lvl}" if lvl > 0 else "None"
                node["account_active"] = lvl > 0
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

        def _do_distribute():
            try:
                to_lvl = int(getattr(getattr(upg, "to_rank", None), "level_number", 0) or 0)
                is_rank1_purchase = to_lvl == 1
                if is_rank1_purchase:
                    FiveMatrixService.distribute_rank1_commissions(upg)
                    FiveMatrixService.on_rank1_approval(upg)
                else:
                    CommissionDistributor.distribute(upg)
                FiveMatrixService.reevaluate_user_holds(upg.user.id)
            except Exception:
                pass

        transaction.on_commit(_do_distribute)
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

# End of file - wallet balance fix update
