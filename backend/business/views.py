from rest_framework import generics, permissions, status
from rest_framework.permissions import IsAdminUser
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from django.http import HttpResponse
from django.db.models import Q, Sum
from django.conf import settings
import time
import logging
import os
from .models import (
    BusinessRegistration,
    RewardProgress,
    RewardRedemption,
    DailyReport,
    AutoPoolAccount,
    SubscriptionActivation,
    Package,
    AgencyPackageAssignment,
    AgencyPackagePayment,
    CommissionConfig,
    TriApp,
    AgencyPackagePaymentRequest,
)
from .serializers import (
    BusinessRegistrationSerializer,
    DailyReportSerializer,
    AgencyPackageAssignmentSerializer,
    AgencyPackagePaymentSerializer,
    AgencyPackagePaymentRequestSerializer,
)

logger = logging.getLogger(__name__)


class BusinessRegistrationCreateView(generics.CreateAPIView):
    """
    Public endpoint to submit a Business Registration request.
    """
    permission_classes = [permissions.AllowAny]
    queryset = BusinessRegistration.objects.all()
    serializer_class = BusinessRegistrationSerializer


class BusinessRegistrationListAdminView(generics.ListAPIView):
    """
    Optional: Admin-only listing endpoint (admin can use Django Admin UI instead).
    """
    permission_classes = [IsAdminUser]
    queryset = BusinessRegistration.objects.select_related('country', 'state', 'city', 'registered_by', 'forwarded_to')
    serializer_class = BusinessRegistrationSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_val = self.request.query_params.get('status')
        if status_val:
            qs = qs.filter(review_status=status_val)
        return qs


# =======================
# MLM: Self ₹50 Activation
# =======================
class SelfActivation50View(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            from business.services.activation import activate_50
            activated = activate_50(request.user, {"type": "self_50", "id": request.user.id}, package_code="SELF_50")
            return Response(
                {"activated": bool(activated), "detail": "Self ₹50 activation processed."},
                status=status.HTTP_200_OK,
            )
        except Exception:
            return Response({"detail": "Failed to process self activation."}, status=status.HTTP_400_BAD_REQUEST)


class ActivationStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        # Active pool account counts
        five_qs = AutoPoolAccount.objects.filter(owner=user, pool_type="FIVE_150", status="ACTIVE")
        three_qs = AutoPoolAccount.objects.filter(owner=user, status="ACTIVE", pool_type__in=["THREE_150", "THREE_50"])

        five_count = five_qs.count()
        three_count = three_qs.count()

        # Derive counts from actually activated ₹150 e‑coupons OWNED by this user (strict)
        activated_150 = 0
        try:
            from coupons.models import AuditTrail
            activated_150 = (
                AuditTrail.objects
                .filter(
                    action="coupon_activated",
                    actor=user,
                    coupon_code__value=150,
                    coupon_code__assigned_consumer=user,
                    coupon_code__issued_channel="e_coupon",
                )
                .values("coupon_code_id")
                .distinct()
                .count()
            )
        except Exception:
            activated_150 = 0

        # Active counts by pool, separated for 3-matrix types
        try:
            three_150_count = AutoPoolAccount.objects.filter(owner=user, status="ACTIVE", pool_type="THREE_150").count()
        except Exception:
            three_150_count = 0
        try:
            three_50_count = AutoPoolAccount.objects.filter(owner=user, status="ACTIVE", pool_type="THREE_50").count()
        except Exception:
            three_50_count = 0

        # Response counts: strictly cap by actually activated ₹150 coupons (distinct)
        try:
            five_resp = min(int(five_count or 0), int(activated_150 or 0))
        except Exception:
            five_resp = int(activated_150 or 0)
        try:
            three150_resp = min(int(three_150_count or 0), int(activated_150 or 0))
        except Exception:
            three150_resp = int(activated_150 or 0)

        five_active = (five_resp > 0)
        three_active = (three150_resp > 0)
        active = five_active and three_active

        # Activation counts by denomination via SubscriptionActivation
        count_150 = SubscriptionActivation.objects.filter(user=user, package="PRIME_150_ACTIVE").count()
        count_50 = SubscriptionActivation.objects.filter(
            user=user, package__in=["GLOBAL_50", "SELF_50", "PRODUCT_GLOBAL_50"]
        ).count()


        # Activation timestamps (best-effort)
        from django.db.models import Min, Max
        agg_all = AutoPoolAccount.objects.filter(owner=user, status="ACTIVE").aggregate(
            first=Min("created_at"), last=Max("created_at")
        )
        activated_at = agg_all.get("first")
        last_activated_at = agg_all.get("last")

        return Response(
            {
                "active": bool(active),
                "five_matrix_active": bool(five_active),
                "three_matrix_active": bool(three_active),
                "five_matrix_count": int(five_resp),
                "three_matrix_count": int(three150_resp),
                "three_matrix_50_count": int(three_50_count),
                "count_150": int(count_150),
                "count_50": int(count_50),
                "activated_at": activated_at,
                "last_activated_at": last_activated_at,
            },
            status=status.HTTP_200_OK,
        )


# =======================
# Rewards: Progress + Redeem
# =======================
class RewardProgressMeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Inactive accounts: rewards progress should be zero
        try:
            if not bool(getattr(request.user, "account_active", False)):
                thresholds = {
                    "resort_trip": 600,
                    "mobile_fund": 600,
                    "bike_fund": 1500,
                    "thailand_trip": 2800,
                }
                elig = {k: {"eligible": False, "threshold": v, "next_needed": v} for k, v in thresholds.items()}
                return Response(
                    {
                        "coupon_count": 0,
                        "eligibility": elig,
                    },
                    status=status.HTTP_200_OK,
                )
        except Exception:
            # best-effort guard; fall through to normal computation if any error
            pass
        rp, _ = RewardProgress.objects.get_or_create(user=request.user)
        thresholds = {
            "resort_trip": 600,
            "mobile_fund": 600,
            "bike_fund": 1500,
            "thailand_trip": 2800,
        }
        elig = {}
        for key, th in thresholds.items():
            elig[key] = {
                "eligible": int(rp.coupon_count) >= int(th),
                "threshold": th,
                "next_needed": max(0, int(th) - int(rp.coupon_count or 0)),
            }
        return Response(
            {
                "coupon_count": int(rp.coupon_count or 0),
                "eligibility": elig,
            },
            status=status.HTTP_200_OK,
        )


class RewardRedeemView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        key = str(request.data.get("reward_key") or "").strip()
        note = str(request.data.get("note") or "").strip()
        thresholds = {
            "resort_trip": 600,
            "mobile_fund": 600,
            "bike_fund": 1500,
            "thailand_trip": 2800,
        }
        if key not in thresholds:
            return Response({"detail": "Invalid reward_key."}, status=status.HTTP_400_BAD_REQUEST)

        threshold = thresholds[key]
        with transaction.atomic():
            rp, _ = RewardProgress.objects.select_for_update().get_or_create(user=request.user)
            current = int(rp.coupon_count or 0)
            if current < threshold:
                return Response(
                    {"detail": f"Insufficient coupons. Need {threshold}, have {current}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Consume coupons and create redemption request
            rp.coupon_count = current - threshold
            rp.save(update_fields=["coupon_count", "updated_at"])
            rr = RewardRedemption.objects.create(
                user=request.user,
                reward_key=key,
                coupons_spent=threshold,
                note=note,
                status="requested",
            )
        return Response(
            {
                "id": rr.id,
                "reward_key": rr.reward_key,
                "coupons_spent": rr.coupons_spent,
                "status": rr.status,
                "requested_at": rr.requested_at,
            },
            status=status.HTTP_201_CREATED,
        )


# =======================
# Daily Report Endpoints
# =======================
def _user_to_report_role(user):
    cat = str(getattr(user, "category", "") or "").lower()
    role = str(getattr(user, "role", "") or "").lower()
    # Employee check
    if role == "employee" or cat == "employee":
        return "EMPLOYEE"
    # Sub-Franchise: strict category match preferred
    if cat == "agency_sub_franchise" or role == "agency":
        return "SUBFRANCHISE"
    return None


class DailyReportSubmitView(APIView):
    """
    POST /api/v1/reports/submit/
    Body:
      {
        "tr_registered": 0,
        "wg_registered": 0,
        "asia_pay_registered": 0,
        "dm_account_registered": 0,
        "e_coupon_issued": 0,
        "physical_coupon_issued": 0,
        "product_sold": 0,
        "total_amount": 0
      }
    Upsert today's report for the current user (one per day).
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        role = _user_to_report_role(request.user)
        if role not in ("EMPLOYEE", "SUBFRANCHISE"):
            return Response({"detail": "Only Employee or Sub-Franchise can submit daily reports."}, status=status.HTTP_403_FORBIDDEN)

        today = timezone.localdate()
        payload = {
            "tr_registered": int(request.data.get("tr_registered") or 0),
            "wg_registered": int(request.data.get("wg_registered") or 0),
            "asia_pay_registered": int(request.data.get("asia_pay_registered") or 0),
            "dm_account_registered": int(request.data.get("dm_account_registered") or 0),
            "e_coupon_issued": int(request.data.get("e_coupon_issued") or 0),
            "physical_coupon_issued": int(request.data.get("physical_coupon_issued") or 0),
            "product_sold": int(request.data.get("product_sold") or 0),
            "total_amount": request.data.get("total_amount") or 0,
        }

        with transaction.atomic():
            # Enforce one per day: update if exists, else create
            rep = DailyReport.objects.filter(reporter=request.user, date=today).first()
            if rep:
                for k, v in payload.items():
                    setattr(rep, k, v)
                rep.save(update_fields=list(payload.keys()))
                ser = DailyReportSerializer(rep)
                return Response(ser.data, status=status.HTTP_200_OK)
            rep = DailyReport.objects.create(
                reporter=request.user,
                role=role,
                # date auto set
                **payload
            )
            ser = DailyReportSerializer(rep)
            return Response(ser.data, status=status.HTTP_201_CREATED)


class DailyReportMyView(APIView):
    """
    GET /api/v1/reports/my-reports/?from=YYYY-MM-DD&to=YYYY-MM-DD
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = DailyReport.objects.filter(reporter=request.user).order_by("-date", "-id")
        d_from = request.query_params.get("from")
        d_to = request.query_params.get("to")
        if d_from:
            try:
                qs = qs.filter(date__gte=d_from)
            except Exception:
                pass
        if d_to:
            try:
                qs = qs.filter(date__lte=d_to)
            except Exception:
                pass
        ser = DailyReportSerializer(qs, many=True)
        return Response(ser.data, status=status.HTTP_200_OK)


# ==============================
# Consumer Promo Packages (Prime/Monthly)
# ==============================
from rest_framework.parsers import MultiPartParser, FormParser
from .serializers import (
    PromoPackageSerializer,
    PromoPurchaseSerializer,
    PromoEBookSerializer,
    EBookAccessSerializer,
    TriAppSerializer,
)
from .models import PromoPackage, PromoPurchase, EBookAccess, TriApp
from .services.withdrawals import compute_withdraw_distribution, apply_withdraw_distribution


class PromoPackageListView(APIView):
    """
    GET /api/business/promo/packages/
    List active Promo Packages with QR/UPI details for the user to pay.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = PromoPackage.objects.filter(is_active=True).order_by("type", "price", "code")
        ser = PromoPackageSerializer(qs, many=True, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)


class PromoPurchaseMeListCreateView(APIView):
    """
    GET /api/business/promo/purchases/ -> list my promo purchases
    POST /api/business/promo/purchases/ -> create a new promo purchase (multipart form with payment_proof)
      Body (multipart/form-data):
        - package_id (required)
        - For MONTHLY: year, month (required; only current month allowed)
        - payment_proof (file; image/pdf)
        - remarks (optional)
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request):
        qs = PromoPurchase.objects.filter(user=request.user).select_related("package").order_by("-requested_at", "-id")
        ser = PromoPurchaseSerializer(qs, many=True, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)

    def post(self, request):
        ser = PromoPurchaseSerializer(data=request.data, context={"request": request})
        if ser.is_valid():
            obj = ser.save()
            return Response(PromoPurchaseSerializer(obj, context={"request": request}).data, status=status.HTTP_201_CREATED)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminPromoPurchaseListView(APIView):
    """
    GET /api/business/admin/promo/purchases/?status=PENDING|APPROVED|REJECTED|CANCELLED
    Admin-only list of promo purchases (defaults to PENDING).
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        status_in = (request.query_params.get("status") or "PENDING").strip().upper()
        valid = {"PENDING", "APPROVED", "REJECTED", "CANCELLED"}
        qs = PromoPurchase.objects.select_related("user", "package").order_by("-requested_at", "-id")
        if status_in in valid:
            qs = qs.filter(status=status_in)
        ser = PromoPurchaseSerializer(qs, many=True, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)


class AdminPromoPurchaseApproveView(APIView):
    """
    POST /api/business/admin/promo/purchases/<pk>/approve/
    Approve a pending promo purchase. Sets active period:
      - MONTHLY: calendar month (year/month on record) or per-box access (no active window)
      - PRIME: active_from = today; active_to = null
    """
    permission_classes = [IsAdminUser]

    def post(self, request, pk: int):
        """
        Approve a pending promo purchase, set active period, and allocate benefits:
          - Default: allocate e‑coupon codes based on price/₹150 denomination
          - PRIME 150: grant e‑book access (visible to all ₹150 buyers)
          - MONTHLY: persist paid boxes
        Allocation is best-effort and does not block approval.
        """
        obj = PromoPurchase.objects.select_related("package", "user").filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if obj.status != "PENDING":
            return Response({"detail": "Only PENDING purchases can be approved."}, status=status.HTTP_400_BAD_REQUEST)

        from decimal import Decimal as D
        t0 = time.perf_counter()

        # Infer denomination for allocation (default ₹150)
        try:
            denom = D("150.00")
        except Exception:
            denom = None

        # Compute required code count using package price:
        # units_per_pkg = floor(package.price / denom) (min 1)
        # total required codes = quantity * units_per_pkg
        units_per_pkg = 1
        try:
            if denom is not None and getattr(obj.package, "price", None) is not None:
                units_per_pkg = int(D(str(obj.package.price)) // denom)
                if units_per_pkg <= 0:
                    units_per_pkg = 1
        except Exception:
            units_per_pkg = 1

        try:
            qty_in = max(1, int(getattr(obj, "quantity", 1) or 1))
        except Exception:
            qty_in = 1
        need = int(qty_in) * int(units_per_pkg)

        # Determine PRIME choices
        try:
            price = D(str(getattr(obj.package, "price", "0") or "0"))
        except Exception:
            price = D("0")
        is_prime_150 = str(getattr(obj.package, "type", "")) == "PRIME" and abs(price - D("150")) <= D("0.5")
        prime150_choice = str(getattr(obj, "prime150_choice", "") or "").strip().upper()
        ebook_choice = prime150_choice == "EBOOK"
        redeem150_choice = prime150_choice == "REDEEM"

        is_prime_750 = str(getattr(obj.package, "type", "")) == "PRIME" and abs(price - D("750")) <= D("0.5")
        prime750_choice = str(getattr(obj, "prime750_choice", "") or "").strip().upper()
        redeem750_choice = prime750_choice == "REDEEM"
        is_prime_759 = str(getattr(obj.package, "type", "")) == "PRIME" and abs(price - D("759")) <= D("0.75")

        # Allocation rules (updated):
        # - PRIME150 (non‑EBOOK): allocate 150 e‑coupon(s)
        # - PRIME750: allocate 5×150 per unit (based on price/₹150), irrespective of choice
        # - PRIME759 and MONTHLY: do not allocate 150 codes here (handled separately)
        skip_allocation = not ((is_prime_150 and not ebook_choice) or is_prime_750)
        # If skipping generic 150 allocation, set required 150-codes to 0 so audit reflects truth.
        if skip_allocation:
            need = 0

        # Debug start: capture computed state
        try:
            logger.info(
                "Approve#%s: type=%s price=%s prime150=%s choice150=%s prime750=%s choice750=%s qty=%s need=%s skip_alloc=%s",
                obj.id, getattr(obj.package, "type", None), str(price),
                bool(is_prime_150), prime150_choice, bool(is_prime_750), prime750_choice,
                int(qty_in), int(need), bool(skip_allocation)
            )
        except Exception:
            pass
        try:
            from coupons.models import AuditTrail
            AuditTrail.objects.create(
                action="promo_purchase_approve_debug_start",
                actor=request.user,
                notes=f"start approve #{obj.id}",
                metadata={
                    "purchase_id": obj.id,
                    "ptype": getattr(obj.package, "type", None),
                    "price": str(price),
                    "prime150_choice": prime150_choice,
                    "prime750_choice": prime750_choice,
                    "is_prime_150": bool(is_prime_150),
                    "is_prime_750": bool(is_prime_750),
                    "qty_in": int(qty_in),
                    "units_per_pkg": int(units_per_pkg),
                    "need": int(need),
                    "skip_allocation": bool(skip_allocation),
                },
            )
        except Exception:
            pass

        # Try allocation (or e‑book grant) before setting approval
        allocated_ids = []
        sample_codes = []
        ebooks_granted = 0
        allocated_759_count = 0

        per_coupon_activation_done = False
        with transaction.atomic():
            # Allocate e‑coupon codes unless PRIME150(EBOOK) or PRIME750(PRODUCT/COUPON)
            if denom is not None and not skip_allocation:
                try:
                    from coupons.models import CouponCode
                except Exception:
                    CouponCode = None

                if CouponCode is not None:
                    base_qs = CouponCode.objects.filter(
                        issued_channel="e_coupon",
                        value=denom,
                        status="AVAILABLE",
                        assigned_agency__isnull=True,
                        assigned_employee__isnull=True,
                        assigned_consumer__isnull=True,
                    )
                    try:
                        locking_qs = base_qs.select_for_update(skip_locked=True)
                    except Exception:
                        locking_qs = base_qs

                    pick_ids = list(locking_qs.order_by("serial", "id").values_list("id", flat=True)[:need])

                    write_qs = CouponCode.objects.filter(id__in=pick_ids).filter(
                        issued_channel="e_coupon",
                        status="AVAILABLE",
                        assigned_agency__isnull=True,
                        assigned_employee__isnull=True,
                        assigned_consumer__isnull=True,
                    )
                    affected = write_qs.update(assigned_consumer_id=obj.user_id, status="SOLD")
                    allocated_ids = pick_ids[:affected] if affected else []
                    try:
                        sample_codes = list(
                            CouponCode.objects.filter(id__in=allocated_ids).values_list("code", flat=True)[:5]
                        )
                    except Exception:
                        sample_codes = []

                    # Debug allocation (150)
                    try:
                        logger.info(
                            "Approve#%s: alloc150 ids=%s sample=%s",
                            obj.id, len(allocated_ids), sample_codes
                        )
                        from coupons.models import AuditTrail
                        AuditTrail.objects.create(
                            action="promo_purchase_approve_debug_alloc150",
                            actor=request.user,
                            notes=f"alloc150 #{obj.id}",
                            metadata={
                                "purchase_id": obj.id,
                                "allocated": int(len(allocated_ids)),
                                "sample": sample_codes,
                            },
                        )
                    except Exception:
                        pass

            # Allocate ₹759 e‑coupon(s) for PRIME 759 (one per quantity)
            if is_prime_759:
                try:
                    from coupons.models import CouponCode
                    denom_759 = D("759.00")
                    base_qs_759 = CouponCode.objects.filter(
                        issued_channel="e_coupon",
                        value=denom_759,
                        status="AVAILABLE",
                        assigned_agency__isnull=True,
                        assigned_employee__isnull=True,
                        assigned_consumer__isnull=True,
                    )
                    try:
                        locking_qs_759 = base_qs_759.select_for_update(skip_locked=True)
                    except Exception:
                        locking_qs_759 = base_qs_759
                    pick_ids_759 = list(
                        locking_qs_759.order_by("serial", "id").values_list("id", flat=True)[:qty_in]
                    )
                    write_qs_759 = CouponCode.objects.filter(id__in=pick_ids_759).filter(
                        issued_channel="e_coupon",
                        status="AVAILABLE",
                        assigned_agency__isnull=True,
                        assigned_employee__isnull=True,
                        assigned_consumer__isnull=True,
                    )
                    affected_759 = write_qs_759.update(assigned_consumer_id=obj.user_id, status="SOLD")
                    if affected_759:
                        allocated_759_count = int(affected_759 or 0)
                        allocated_ids.extend(pick_ids_759[:allocated_759_count])
                        try:
                            sample_codes.extend(
                                list(
                                    CouponCode.objects.filter(id__in=pick_ids_759[:allocated_759_count]).values_list(
                                        "code", flat=True
                                    )[:5]
                                )
                            )
                        except Exception:
                            pass
                    # Debug allocation (759)
                    try:
                        logger.info("Approve#%s: alloc759 count=%s", obj.id, allocated_759_count)
                        from coupons.models import AuditTrail
                        AuditTrail.objects.create(
                            action="promo_purchase_approve_debug_alloc759",
                            actor=request.user,
                            notes=f"alloc759 #{obj.id}",
                            metadata={"purchase_id": obj.id, "allocated_759": int(allocated_759_count)},
                        )
                    except Exception:
                        pass
                except Exception:
                    # allocation best‑effort
                    pass

            # PRIME150: grant e‑book access mapped to the package (visible to all ₹150 buyers)
            # If no explicit mapping exists, fall back to granting the most recent active e‑book.
            if False and is_prime_150:
                try:
                    from .models import PromoPackageEBook, EBookAccess, PromoEBook
                    maps = list(
                        PromoPackageEBook.objects.filter(package=obj.package, is_active=True)
                        .select_related("ebook")
                    )
                    # Fallback: if admin hasn't configured mappings, grant the latest active e‑book
                    if not maps:
                        fallback = list(PromoEBook.objects.filter(is_active=True).order_by("-created_at")[:1])
                        for eb in fallback:
                            try:
                                EBookAccess.objects.get_or_create(user=obj.user, ebook=eb)
                                ebooks_granted += 1
                            except Exception:
                                continue
                    else:
                        for m in maps:
                            try:
                                EBookAccess.objects.get_or_create(user=obj.user, ebook=m.ebook)
                                ebooks_granted += 1
                            except Exception:
                                continue
                except Exception:
                    ebooks_granted = 0

            # Per-coupon distribution should occur on coupon ACTIVATION, not on approval.
            # We only allocate codes here; distribution is handled by /v1/coupon/activate.
            try:
                if not skip_allocation and allocated_ids and denom == D("150.00"):
                    pass
            except Exception:
                pass

            # Promo REDEEM credits (best-effort, non-blocking)
            credited_750 = False
            credited_150_redeem = False
            try:
                # 750 REDEEM: credit full 750 as Reward Points (not money wallet)
                if is_prime_750 and redeem750_choice:
                    from accounts.models import RewardPointsAccount
                    from decimal import Decimal as Dp
                    try:
                        RewardPointsAccount.credit_points(
                            obj.user,
                            Dp("750.00"),
                            reason="REDEEM_750",
                            meta={"purchase_id": obj.id, "package": getattr(obj.package, "code", None)},
                        )
                        credited_750 = True
                    except Exception:
                        pass
                # 150 REDEEM: use existing redeem flow (credits configured 150 by default into points)
                if is_prime_150 and redeem150_choice:
                    from business.services.activation import redeem_150 as _redeem_150
                    _redeem_150(obj.user, {"type": "PROMO_150_REDEEM", "id": obj.id})
                    credited_150_redeem = True
            except Exception:
                pass
            # Ensure PRIME 150 adds reward points on approval (e‑book removed)
            try:
                if is_prime_150 and not credited_150_redeem:
                    from accounts.models import RewardPointsAccount
                    from decimal import Decimal as Dp5
                    RewardPointsAccount.credit_points(
                        obj.user,
                        Dp5("150.00"),
                        reason="PRIME_150",
                        meta={"purchase_id": obj.id, "package": getattr(obj.package, "code", None)},
                    )
            except Exception:
                pass

            # Debug redeem credits (points)
            try:
                logger.info(
                    "Approve#%s: redeem credits -> 750_pts=%s, 150_pts=%s",
                    obj.id, bool(credited_750), bool(credited_150_redeem)
                )
                from coupons.models import AuditTrail
                AuditTrail.objects.create(
                    action="promo_purchase_approve_debug_redeem",
                    actor=request.user,
                    notes=f"redeem step #{obj.id}",
                    metadata={
                        "purchase_id": obj.id,
                        "credited_750_points": bool(credited_750),
                        "credited_150_points": bool(credited_150_redeem),
                    },
                )
            except Exception:
                pass

            # Ensure denomination reward points for PRIME 750 in non-REDEEM choices (PRODUCT/COUPON)
            # Requirement: buying any PRIME denomination should add that amount to Reward Points.
            # We already credit points for REDEEM above; add here for PRODUCT/COUPON cases as well.
            try:
                if False and is_prime_750 and not redeem750_choice and not credited_750:
                    from accounts.models import RewardPointsAccount
                    from decimal import Decimal as Dp3
                    RewardPointsAccount.credit_points(
                        obj.user,
                        Dp3("750.00"),
                        reason="PRIME_750",
                        meta={
                            "purchase_id": obj.id,
                            "package": getattr(obj.package, "code", None),
                            "choice": prime750_choice,
                        },
                    )
                    credited_750 = True
                    try:
                        from coupons.models import AuditTrail
                        AuditTrail.objects.create(
                            action="promo_purchase_approve_prime750_points",
                            actor=request.user,
                            notes=f"prime750 non-redeem points credited #{obj.id}",
                            metadata={"purchase_id": obj.id, "choice": prime750_choice, "points": "750"},
                        )
                    except Exception:
                        pass
            except Exception:
                # best-effort; do not block approval on points credit failure
                pass


            # Mark approved and set active window
            obj.status = "APPROVED"
            obj.approved_by = request.user
            obj.approved_at = timezone.now()

            today = timezone.localdate()
            if obj.package.type == "MONTHLY":
                # Create permanent paid box records for selected boxes
                try:
                    from .models import PromoMonthlyBox
                    # Count existing paid boxes BEFORE creating new ones to detect first month
                    prev_count = PromoMonthlyBox.objects.filter(user=obj.user, package=obj.package).count()
                    boxes = list(getattr(obj, "boxes_json", []) or [])
                    number = int(getattr(obj, "package_number", 1) or 1)
                    for b in boxes:
                        try:
                            bn = int(b)
                            PromoMonthlyBox.objects.get_or_create(
                                user=obj.user,
                                package=obj.package,
                                package_number=number,
                                box_number=bn,
                                defaults={"purchase": obj},
                            )
                        except Exception:
                            continue
                    # Allocate E‑coupon(s) of ₹759 for each selected monthly box (best‑effort)
                    try:
                        if boxes:
                            from coupons.models import CouponCode
                            denom_759 = D("759.00")
                            base_qs2 = CouponCode.objects.filter(
                                issued_channel="e_coupon",
                                value=denom_759,
                                status="AVAILABLE",
                                assigned_agency__isnull=True,
                                assigned_employee__isnull=True,
                                assigned_consumer__isnull=True,
                            )
                            try:
                                locking2 = base_qs2.select_for_update(skip_locked=True)
                            except Exception:
                                locking2 = base_qs2
                            pick_759 = list(locking2.order_by("serial", "id").values_list("id", flat=True)[: len(boxes)])
                            affected_759 = CouponCode.objects.filter(id__in=pick_759).filter(
                                issued_channel="e_coupon",
                                status="AVAILABLE",
                                assigned_agency__isnull=True,
                                assigned_employee__isnull=True,
                                assigned_consumer__isnull=True,
                            ).update(assigned_consumer_id=obj.user_id, status="SOLD")
                            allocated_759_count = int(affected_759 or 0)
                            if allocated_759_count > 0:
                                allocated_ids.extend(pick_759[:allocated_759_count])
                    except Exception:
                        # allocation best‑effort
                        pass

                    # Monthly 759 payouts (enqueue as background jobs). First purchased box gets the first-month direct bonus.
                    try:
                        from jobs.models import enqueue_monthly_759
                        box_tasks = []
                        for idx, b in enumerate(boxes):
                            try:
                                bn = int(b)
                            except Exception:
                                bn = None
                            is_first = bool(prev_count == 0 and idx == 0)
                            box_tasks.append({"package_number": number, "box_number": bn, "is_first": is_first})
                        if box_tasks:
                            batch_size = int(os.environ.get("MONTHLY_759_BATCH", "50"))
                            if batch_size <= 0:
                                batch_size = 50
                            for i in range(0, len(box_tasks), batch_size):
                                chunk = box_tasks[i:i + batch_size]
                                try:
                                    enqueue_monthly_759(obj.user_id, obj.id, chunk, batch_index=int(i // batch_size))
                                except Exception:
                                    continue
                    except Exception:
                        pass
                except Exception:
                    pass
                # No calendar active window for MONTHLY per-box flow
                obj.active_from = None
                obj.active_to = None
            else:
                obj.active_from = today
                obj.active_to = None

            fields_to_update = ["status", "approved_by", "approved_at", "active_from", "active_to"]
            # For PRIME 750 promo with a selected product, set delivery_by = approved_date + 30 days
            try:
                from decimal import Decimal as D2
                price2 = D2(str(getattr(obj.package, "price", "0")))
                is_prime_750 = str(getattr(obj.package, "type", "")) == "PRIME" and abs(price2 - D2("750")) <= D2("0.5")
            except Exception:
                is_prime_750 = False
            if is_prime_750:
                from datetime import timedelta
                obj.delivery_by = timezone.localdate() + timedelta(days=30)
                fields_to_update.append("delivery_by")

            obj.save(update_fields=fields_to_update)

            # Activate account on any promo package approval (e.g., 150, 750, 759)
            try:
                from decimal import Decimal as D3
                from .services.activation import activate_150_active, activate_50, ensure_first_purchase_activation
                from jobs.models import enqueue_prime_150_units
                pkg_price = D3(str(getattr(obj.package, "price", "0") or "0"))
                src = {"type": "promo_purchase", "id": obj.id}
                activated150_active = False
                activated50 = False
                prime_units_enqueued = False

                # Always open ₹50 path when price >= 50 (idempotent)
                if pkg_price >= D3("50"):
                    try:
                        activate_50(obj.user, src, package_code="GLOBAL_50")
                        activated50 = True
                    except Exception:
                        pass

                # Decide 150 activations by package type
                is_prime_pkg = str(getattr(obj.package, "type", "") or "") == "PRIME"
                is_monthly_pkg = str(getattr(obj.package, "type", "") or "") == "MONTHLY"
                is_prime_150_now = is_prime_pkg and (abs(pkg_price - D3("150")) <= D3("0.5"))
                is_prime_750_now = is_prime_pkg and (abs(pkg_price - D3("750")) <= D3("0.5"))

                if is_prime_150_now:
                    # Do not auto-activate 150 on promo approval.
                    # Allocation: 1x ₹150 e‑coupon is provided and commissions will run on coupon activation.
                    activated150_active = False
                elif is_prime_750_now:
                    # PRODUCT flow: open 5/3 matrix directly, no e‑coupon allocation, no reward points
                    if str(prime750_choice).upper() != "REDEEM":
                        try:
                            from .services.activation import activate_150_active
                            src2 = {"type": "PRIME_750_PRODUCT", "id": obj.id, "suppress_reward_points": True}
                            activate_150_active(obj.user, src2)
                        except Exception:
                            pass
                elif is_monthly_pkg:
                    # Open 150 Active only on the very first 759 approval for this user/package
                    try:
                        from .models import PromoMonthlyBox
                        prev_count_before = PromoMonthlyBox.objects.filter(
                            user=obj.user, package=obj.package, created_at__lt=obj.approved_at
                        ).count()
                    except Exception:
                        prev_count_before = 0
                    if prev_count_before == 0:
                        try:
                            activate_150_active(obj.user, src)
                            activated150_active = True
                        except Exception:
                            pass

                # Ensure account_active and first purchase flags are stamped (idempotent)
                try:
                    ensure_first_purchase_activation(obj.user, src)
                except Exception:
                    pass
                # Hard-stamp account_active to guarantee visibility in admin lists (best-effort)
                try:
                    if not bool(getattr(obj.user, "account_active", False)):
                        obj.user.account_active = True
                        obj.user.save(update_fields=["account_active"])
                except Exception:
                    pass
            except Exception:
                # best-effort: do not block approval if activation fails
                pass

            # Lucky Draw eligibility for PRIME 750 COUPON choice (one token per unit)
            try:
                if is_prime_750 and str(prime750_choice).upper() == "COUPON":
                    from uploads.models import LuckyDrawEligibility
                    tokens = 1
                    try:
                        tokens = max(1, int(qty_in))
                    except Exception:
                        tokens = 1
                    LuckyDrawEligibility.objects.create(user=obj.user, purchase=obj, tokens=tokens)
            except Exception:
                # best-effort: do not block approval if eligibility creation fails
                pass

            # Audit (best effort)
            try:
                from coupons.models import AuditTrail
                try:
                    prime_units_flag = bool(prime_units_enqueued)
                except Exception:
                    prime_units_flag = False
                AuditTrail.objects.create(
                    action="promo_purchase_approved_allocated",
                    actor=request.user,
                    notes=f"Approved promo purchase #{obj.id}, allocated={len(allocated_ids)}",
                    metadata={
                        "purchase_id": obj.id,
                        "user_id": obj.user_id,
                        "denomination": str(denom) if denom is not None else None,
                        "quantity": int(need),
                        "quantity_units": int(qty_in),
                        "units_per_package": int(units_per_pkg),
                        "required_codes": int(need),
                        "allocated": int(len(allocated_ids)),
                        "sample_codes": sample_codes,
                        "prime150_choice": getattr(obj, "prime150_choice", None),
                        "prime750_choice": getattr(obj, "prime750_choice", None),
                        "ebooks_granted": int(ebooks_granted),
                        "allocated_759": int(allocated_759_count),
                        "heavy_skipped": bool(getattr(settings, "SKIP_HEAVY_ON_APPROVE", False)),
                        "credited_750": bool(credited_750),
                        "credited_150_redeem": bool(credited_150_redeem),
                        "skip_allocation": bool(skip_allocation),
                        "is_prime_150": bool(is_prime_150),
                        "is_prime_750": bool(is_prime_750),
                        "is_prime_759": bool(is_prime_759),
                        "activated150_active": bool(activated150_active),
                        "activated50": bool(activated50),
                        "prime_150_units_enqueued": bool(prime_units_flag),
                        "duration_ms": int((time.perf_counter() - t0) * 1000),
                    },
                )
            except Exception:
                pass

        return Response(PromoPurchaseSerializer(obj, context={"request": request}).data, status=status.HTTP_200_OK)


class AdminPromoPurchaseRejectView(APIView):
    """
    POST /api/business/admin/promo/purchases/<pk>/reject/
    Body: { "reason": "optional" }
    """
    permission_classes = [IsAdminUser]

    def post(self, request, pk: int):
        obj = PromoPurchase.objects.select_related("package", "user").filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if obj.status != "PENDING":
            return Response({"detail": "Only PENDING purchases can be rejected."}, status=status.HTTP_400_BAD_REQUEST)

        reason = str((request.data or {}).get("reason") or "").strip()
        obj.status = "REJECTED"
        if reason:
            obj.remarks = ((obj.remarks or "") + (("\n" if obj.remarks else "") + f"Rejected: {reason}"))[:2000]
        obj.approved_by = request.user
        obj.approved_at = timezone.now()
        obj.save(update_fields=["status", "remarks", "approved_by", "approved_at"])
        return Response(PromoPurchaseSerializer(obj, context={"request": request}).data, status=status.HTTP_200_OK)


class Prime750PreviewView(APIView):
    """
    GET /api/business/promo/prime750/preview/?choice=REDEEM|PRODUCT|COUPON[&quantity=1]
    Returns what will happen for a PRIME 750 purchase based on the user's choice.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        choice = str(request.query_params.get("choice") or "").strip().upper()
        qty_raw = request.query_params.get("quantity")
        try:
            quantity = max(1, int(qty_raw)) if qty_raw is not None else 1
        except Exception:
            quantity = 1

        try:
            cfg = CommissionConfig.get_solo()
            mode = str(getattr(cfg, "prime_750_redeem_mode", "units_and_wallet") or "units_and_wallet").lower()
            units = int(getattr(cfg, "prime_750_units", 5) or 5)
        except Exception:
            mode = "units_and_wallet"
            units = 5

        reward_points_credit = 0
        prime_150_units = 0
        delivery_by_days: int | None = None
        lucky_draw_tokens = 0
        alloc_150_coupons = False  # design: PRIME 750 never allocates 150 e-coupons directly

        if choice == "REDEEM":
            reward_points_credit = 750
            prime_150_units = units if mode == "units_and_wallet" else 0
        elif choice == "PRODUCT":
            reward_points_credit = 0
            prime_150_units = units
            delivery_by_days = 30
        elif choice == "COUPON":
            reward_points_credit = 0
            prime_150_units = units
            lucky_draw_tokens = int(quantity)
        else:
            return Response({"detail": "Invalid or missing choice. Use REDEEM, PRODUCT or COUPON."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "choice": choice,
                "config": {
                    "prime_750_units": int(units),
                    "prime_750_redeem_mode": mode,
                },
                "effects": {
                    "reward_points_credit": int(reward_points_credit),
                    "prime_150_units": int(prime_150_units),
                    "delivery_by_days": delivery_by_days,
                    "lucky_draw_tokens": int(lucky_draw_tokens),
                    "alloc_150_coupons": bool(alloc_150_coupons),
                },
            },
            status=status.HTTP_200_OK,
        )

class EBookMyListView(APIView):
    """
    GET /api/business/ebooks/mine/
    List of e‑books granted to the current user via PRIME 150 (E‑BOOK) approvals.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = EBookAccess.objects.select_related("ebook").filter(user=request.user).order_by("-granted_at", "-id")
        ser = EBookAccessSerializer(qs, many=True, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)


# ==============================
# Rewards Points Card (based on activated coupons)
# ==============================
class RewardPointsSummaryView(APIView):
    """
    GET /api/business/rewards/points/
    Returns current_points computed from activated coupon count using
    admin-defined Reward Points Configuration (tiers + after.base/per_coupon).
    Also returns next milestone target and progress percentage towards it.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Inactive accounts: reward points should be zero
        try:
            if not bool(getattr(request.user, "account_active", False)):
                return Response(
                    {
                        "activated_coupon_count": 0,
                        "progress_coupon_count": 0,
                        "current_points": 0,
                        "next_target_count": 1,
                        "points_at_next_target": 0,
                        "progress_percentage": 0,
                        "available": 0,
                    },
                    status=status.HTTP_200_OK,
                )
        except Exception:
            pass
        rp, _ = RewardProgress.objects.get_or_create(user=request.user)
        # E‑coupon activations (distinct codes activated by me)
        try:
            from coupons.models import AuditTrail
            activated_ecoupons = (
                AuditTrail.objects
                .filter(action="coupon_activated", actor=request.user)
                .values("coupon_code_id")
                .distinct()
                .count()
            )
        except Exception:
            activated_ecoupons = 0

        # Use actual activated count for reward points progression
        try:
            stored = int(rp.coupon_count or 0)
        except Exception:
            stored = 0
        progress_count = max(stored, int(activated_ecoupons or 0))
        # Best-effort: persist back if we advanced
        if progress_count != stored:
            try:
                rp.coupon_count = progress_count
                rp.save(update_fields=["coupon_count", "updated_at"])
            except Exception:
                pass
        count = progress_count

        # Load admin-configured rewards schedule from CommissionConfig
        try:
            cfg = CommissionConfig.get_solo()
            conf_in = dict(getattr(cfg, "reward_points_config_json", {}) or {})
        except Exception:
            conf_in = {}

        def _default_conf():
            return {
                "tiers": [
                    {"count": 1, "points": 1000},
                    {"count": 2, "points": 10000},
                    {"count": 3, "points": 30000},
                    {"count": 4, "points": 60000},
                    {"count": 5, "points": 110000},
                ],
                "after": {"base_count": 5, "per_coupon": 20000},
            }

        def _normalize(conf):
            try:
                tiers = conf.get("tiers") or []
                after = conf.get("after") or {}
                norm = []
                seen = set()
                for t in tiers:
                    c = int(t.get("count"))
                    p = int(t.get("points"))
                    if c < 1 or p < 0:
                        raise ValueError("invalid tier")
                    if c in seen:
                        continue
                    seen.add(c)
                    norm.append({"count": c, "points": p})
                if not norm:
                    raise ValueError("empty tiers")
                norm.sort(key=lambda x: x["count"])
                max_tier = norm[-1]["count"]
                base_count = int(after.get("base_count", max_tier))
                per_coupon = int(after.get("per_coupon", 0))
                if base_count < max_tier or per_coupon < 0:
                    raise ValueError("invalid after")
                return {"tiers": norm, "after": {"base_count": base_count, "per_coupon": per_coupon}}
            except Exception:
                return _default_conf()

        conf = _normalize(conf_in)
        tiers = conf["tiers"]
        base_count = int(conf["after"]["base_count"])
        per_coupon = int(conf["after"]["per_coupon"])

        def _points_at(c: int) -> int:
            if c <= 0:
                return 0
            # Points up to base_count come from the last tier not exceeding c
            last_points = 0
            for t in tiers:
                if t["count"] <= c:
                    last_points = t["points"]
                else:
                    break
            if c <= base_count:
                return int(last_points)
            # Beyond base_count: linear add per_coupon for each coupon after base_count
            # Base is points at base_count (use last tier <= base_count)
            base_points = 0
            for t in tiers:
                if t["count"] <= base_count:
                    base_points = t["points"]
                else:
                    break
            extra = (c - base_count) * per_coupon
            return int(base_points + extra)

        points = _points_at(count)

        # Determine next target
        if count < base_count:
            # next tier count strictly greater than current; fallback to base_count
            next_target = None
            for t in tiers:
                if t["count"] > count:
                    next_target = t["count"]
                    break
            if next_target is None:
                next_target = base_count
        else:
            next_target = count + 1

        next_points = _points_at(next_target)

        # Progress between milestones
        if count < base_count:
            prev_target = 0
            for t in tiers:
                if t["count"] <= count:
                    prev_target = t["count"]
                else:
                    break
            span = max(1, next_target - prev_target)
            progress_in_span = max(0, count - prev_target)
        else:
            prev_target = count
            span = 1
            progress_in_span = 0
        progress_pct = int(min(100, round(100 * progress_in_span / span)))
        # Available reward points value in ₹ (after holds)
        try:
            from accounts.models import RewardPointsAccount
            avail = float(RewardPointsAccount.get_available_value_in_inr(request.user))
        except Exception:
            avail = 0.0

        return Response(
            {
                "activated_coupon_count": int(activated_ecoupons),
                "progress_coupon_count": int(count),
                "current_points": int(points),
                "next_target_count": int(next_target),
                "points_at_next_target": int(next_points),
                "progress_percentage": int(progress_pct),
                "available": float(avail),
            },
            status=status.HTTP_200_OK,
        )


# =======================
# Packages: Agency + Admin
# =======================

class AgencyPackageCatalogView(APIView):
    """
    GET /api/business/agency-packages/catalog/
    Returns active packages allowed for the current agency category with an `assigned` flag.
    Category -> code prefix mapping:
      - agency_sub_franchise -> AG_SF*
      - agency_pincode       -> AG_PIN*  (future-safe)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        # Must be an agency account
        try:
            role = str(getattr(user, "role", "") or "").lower()
            cat = str(getattr(user, "category", "") or "").lower()
            is_agency = (role == "agency") or cat.startswith("agency")
        except Exception:
            is_agency = False
        if not is_agency:
            return Response([], status=status.HTTP_200_OK)

        # Determine allowed prefix by category
        prefix = None
        try:
            if cat == "agency_sub_franchise":
                prefix = "AG_SF"
            elif cat == "agency_pincode":
                prefix = "AG_PIN"
        except Exception:
            prefix = None

        if not prefix:
            # No catalog for other categories
            return Response([], status=status.HTTP_200_OK)

        # Query allowed active packages and compute assigned flag
        pkgs_qs = Package.objects.filter(is_active=True, code__istartswith=prefix).order_by("amount", "code")
        pkg_ids = list(pkgs_qs.values_list("id", flat=True))
        assigned_ids = set(
            AgencyPackageAssignment.objects.filter(agency=user, package_id__in=pkg_ids).values_list("package_id", flat=True)
        )

        out = []
        for p in pkgs_qs:
            try:
                amt = f"{p.amount}"
            except Exception:
                amt = None
            out.append(
                {
                    "id": p.id,
                    "code": p.code,
                    "name": p.name,
                    "description": p.description or "",
                    "amount": amt,
                    "is_active": bool(p.is_active),
                    "assigned": bool(p.id in assigned_ids),
                }
            )
        return Response(out, status=status.HTTP_200_OK)

class AgencyPackagesMeView(APIView):
    """
    GET /api/business/agency-packages/
    Returns packages assigned to the current user (agency) with computed totals.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        target_user = user

        # Admin override: allow admin to view cards for any agency via ?agency_id=PK
        agency_id = request.query_params.get("agency_id")
        if agency_id and (getattr(user, "is_staff", False) or getattr(user, "is_superuser", False)):
            try:
                from accounts.models import CustomUser
                target_user = CustomUser.objects.get(pk=int(agency_id))
            except Exception:
                return Response({"detail": "Agency not found."}, status=status.HTTP_404_NOT_FOUND)

        # Enforce: packages apply only to Agency role/categories
        is_agency = False
        try:
            role = str(getattr(target_user, "role", "") or "").lower()
            cat = str(getattr(target_user, "category", "") or "").lower()
            is_agency = (role == "agency") or cat.startswith("agency")
        except Exception:
            is_agency = False

        if not is_agency:
            # Return empty list for non-agency users; no auto-assignment
            return Response([], status=status.HTTP_200_OK)

        # Auto-assign default packages to the target agency if missing
        try:
            defaults_qs = Package.objects.filter(is_active=True, is_default=True)
            existing_pkg_ids = set(
                AgencyPackageAssignment.objects.filter(agency=target_user, package__in=defaults_qs).values_list("package_id", flat=True)
            )
            to_create = [AgencyPackageAssignment(agency=target_user, package=p) for p in defaults_qs if p.id not in existing_pkg_ids]
            if to_create:
                # Avoid bulk_create pitfalls; save one-by-one to trigger validations
                for obj in to_create:
                    try:
                        obj.save()
                    except Exception:
                        continue
        except Exception:
            # best-effort; do not block response on auto-assign failure
            pass

        qs = AgencyPackageAssignment.objects.filter(agency=target_user).select_related("package").prefetch_related("payments")
        ser = AgencyPackageAssignmentSerializer(qs, many=True)
        return Response(ser.data, status=status.HTTP_200_OK)


class AgencyAssignPackageView(APIView):
    """
    POST /api/business/agency-packages/assign/
    Body:
      {
        "package_id": 1,                  # or provide "package_code": "BASIC"
        "package_code": "BASIC",          # case-insensitive; ignored if package_id is provided
        "amount": 1000.00,                # optional partial amount; if > 0, a payment row is created
        "reference": "UPI-REF-123",       # optional
        "notes": "First partial payment"  # optional
      }
    Ensures an AgencyPackageAssignment exists for the current user (must be an Agency*)
    and optionally records a partial payment.
    Returns the assignment with computed totals and status.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from decimal import Decimal
        user = request.user

        # Enforce: only agency role/categories can use this endpoint
        try:
            role = str(getattr(user, "role", "") or "").lower()
            cat = str(getattr(user, "category", "") or "").lower()
            is_agency = (role == "agency") or cat.startswith("agency")
        except Exception:
            is_agency = False
        if not is_agency:
            return Response({"detail": "Only agency accounts can buy agency packages."}, status=status.HTTP_403_FORBIDDEN)

        pkg = None
        pkg_id = request.data.get("package_id")
        pkg_code = request.data.get("package_code")
        if pkg_id is not None:
            try:
                pkg = Package.objects.get(pk=int(pkg_id), is_active=True)
            except Exception:
                return Response({"package_id": ["Invalid package_id."]}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if not pkg_code:
                return Response({"package_code": ["Provide package_id or package_code."]}, status=status.HTTP_400_BAD_REQUEST)
            try:
                pkg = Package.objects.get(code__iexact=str(pkg_code).strip(), is_active=True)
            except Package.DoesNotExist:
                return Response({"package_code": ["Package not found or inactive."]}, status=status.HTTP_404_NOT_FOUND)

        # Category/prefix guard: restrict package purchase by agency category
        try:
            cat = str(getattr(user, "category", "") or "").lower()

            def _allowed_prefix(c):
                if c == "agency_sub_franchise":
                    return "AG_SF"
                if c == "agency_pincode":
                    return "AG_PIN"
                return None

            pref = _allowed_prefix(cat)
            if pref:
                code_val = str(getattr(pkg, "code", "") or "")
                if not code_val.upper().startswith(pref.upper()):
                    return Response({"detail": "Package not allowed for your category."}, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            # best-effort guard; do not block the flow on failure
            pass

        # Ensure assignment
        try:
            assignment, created = AgencyPackageAssignment.objects.get_or_create(agency=user, package=pkg)
        except Exception:
            return Response({"detail": "Failed to ensure assignment."}, status=status.HTTP_400_BAD_REQUEST)

        # Optional partial payment
        pay_obj = None
        amt_raw = request.data.get("amount", None)
        if amt_raw is not None:
            return Response({"detail": "Direct payments are disabled. Submit a payment request for admin approval."}, status=status.HTTP_400_BAD_REQUEST)
        if amt_raw is not None:
            try:
                amount = Decimal(str(amt_raw))
            except Exception:
                return Response({"amount": ["Invalid amount."]}, status=status.HTTP_400_BAD_REQUEST)
            if amount <= 0:
                return Response({"amount": ["Amount must be greater than 0."]}, status=status.HTTP_400_BAD_REQUEST)

            # Clamp to remaining (prevent overpayment). If fully paid, block further payments.
            try:
                pkg_total = Decimal(str(getattr(assignment.package, "amount", "0") or "0"))
            except Exception:
                pkg_total = Decimal("0")
            try:
                paid_sum = assignment.payments.aggregate(s=Sum("amount")).get("s") or Decimal("0")
            except Exception:
                paid_sum = Decimal("0")
            remaining = pkg_total - paid_sum
            if remaining <= 0:
                return Response({"detail": "Package already fully paid."}, status=status.HTTP_400_BAD_REQUEST)
            if amount > remaining:
                amount = remaining

            reference = str(request.data.get("reference") or "").strip()
            notes = str(request.data.get("notes") or "").strip()
            try:
                pay_obj = AgencyPackagePayment.objects.create(
                    assignment=assignment,
                    amount=amount,
                    reference=reference,
                    notes=notes,
                )
            except Exception:
                return Response({"detail": "Failed to record payment."}, status=status.HTTP_400_BAD_REQUEST)

        data = AgencyPackageAssignmentSerializer(assignment).data
        if pay_obj:
            data["latest_payment"] = {
                "id": pay_obj.id,
                "amount": f"{pay_obj.amount}",
                "paid_at": pay_obj.paid_at,
                "reference": pay_obj.reference,
                "notes": pay_obj.notes,
            }
        return Response(data, status=status.HTTP_201_CREATED if (pay_obj or created) else status.HTTP_200_OK)

class AdminCreateAgencyPackagePaymentView(APIView):
    """
    POST /api/business/agency-packages/{pk}/payments/
    Body: { "amount": <number>, "reference": "optional", "notes": "optional" }
    Admin-only: records a payment against an agency's package assignment.
    """
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        from decimal import Decimal
        try:
            assignment = AgencyPackageAssignment.objects.select_related("package", "agency").get(pk=pk)
        except AgencyPackageAssignment.DoesNotExist:
            return Response({"detail": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)

        amt_raw = request.data.get("amount")
        try:
            amount = Decimal(str(amt_raw))
        except Exception:
            return Response({"amount": ["Invalid amount."]}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({"amount": ["Amount must be greater than 0."]}, status=status.HTTP_400_BAD_REQUEST)

        # Clamp to remaining (prevent overpayment). If fully paid, block further payments.
        try:
            pkg_total = Decimal(str(getattr(assignment.package, "amount", "0") or "0"))
        except Exception:
            pkg_total = Decimal("0")
        try:
            paid_sum = assignment.payments.aggregate(s=Sum("amount")).get("s") or Decimal("0")
        except Exception:
            paid_sum = Decimal("0")
        remaining = pkg_total - paid_sum
        if remaining <= 0:
            return Response({"detail": "Package already fully paid."}, status=status.HTTP_400_BAD_REQUEST)
        if amount > remaining:
            amount = remaining

        reference = str(request.data.get("reference") or "").strip()
        notes = str(request.data.get("notes") or "").strip()

        pay = AgencyPackagePayment.objects.create(
            assignment=assignment,
            amount=amount,
            reference=reference,
            notes=notes,
        )
        # Minimal response (intentionally not using serializer to avoid N+1 on admin bulk ops)
        return Response(
            {
                "id": pay.id,
                "assignment": assignment.id,
                "amount": f"{pay.amount}",
                "paid_at": pay.paid_at,
                "reference": pay.reference,
                "notes": pay.notes,
            },
            status=status.HTTP_201_CREATED,
        )


class AgencyCreateMyAgencyPackagePaymentView(APIView):
    """
    POST /api/business/agency-packages/<pk>/my-payments/
    Body: { "amount": <number>, "reference": "optional", "notes": "optional" }
    Authenticated agency user: records a partial payment against OWN package assignment.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        return Response({"detail": "Direct payments are disabled. Submit a payment request for admin approval."}, status=status.HTTP_403_FORBIDDEN)
        from decimal import Decimal
        try:
            assignment = AgencyPackageAssignment.objects.select_related("package", "agency").get(pk=pk, agency=request.user)
        except AgencyPackageAssignment.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        amt_raw = request.data.get("amount")
        try:
            amount = Decimal(str(amt_raw))
        except Exception:
            return Response({"amount": ["Invalid amount."]}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0:
            return Response({"amount": ["Amount must be greater than 0."]}, status=status.HTTP_400_BAD_REQUEST)

        # Clamp to remaining (prevent overpayment). If fully paid, block further payments.
        try:
            pkg_total = Decimal(str(getattr(assignment.package, "amount", "0") or "0"))
        except Exception:
            pkg_total = Decimal("0")
        try:
            paid_sum = assignment.payments.aggregate(s=Sum("amount")).get("s") or Decimal("0")
        except Exception:
            paid_sum = Decimal("0")
        remaining = pkg_total - paid_sum
        if remaining <= 0:
            return Response({"detail": "Package already fully paid."}, status=status.HTTP_400_BAD_REQUEST)
        if amount > remaining:
            amount = remaining

        reference = str(request.data.get("reference") or "").strip()
        notes = str(request.data.get("notes") or "").strip()

        pay = AgencyPackagePayment.objects.create(
            assignment=assignment,
            amount=amount,
            reference=reference,
            notes=notes,
        )
        return Response(
            {
                "id": pay.id,
                "assignment": assignment.id,
                "amount": f"{pay.amount}",
                "paid_at": pay.paid_at,
                "reference": pay.reference,
                "notes": pay.notes,
            },
            status=status.HTTP_201_CREATED,
        )

# =======================
# Agency Package: Agency-submitted Payment Requests
# =======================
from rest_framework.parsers import MultiPartParser, FormParser


class AgencyCreatePaymentRequestView(APIView):
    """
    POST /api/business/agency-packages/<pk>/payment-requests/
    Form-data:
      - amount (required, >0)
      - method (default "UPI")
      - utr (optional)            # UPI reference/UTR or any text reference
      - notes (optional)
      - payment_proof (file, optional)
    Creates a PENDING payment request for OWN assignment. One pending at a time per assignment.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, pk: int):
        from decimal import Decimal
        try:
            assignment = AgencyPackageAssignment.objects.select_related("package", "agency").get(
                pk=pk, agency=request.user
            )
        except AgencyPackageAssignment.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        # Block duplicate pending request for same assignment
        exists = AgencyPackagePaymentRequest.objects.filter(assignment=assignment, status="PENDING").exists()
        if exists:
            return Response({"detail": "A payment request is already pending for this package."}, status=status.HTTP_400_BAD_REQUEST)

        amt_raw = request.data.get("amount")
        try:
            amount = Decimal(str(amt_raw))
        except Exception:
            return Response({"amount": ["Invalid amount."]}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0:
            return Response({"amount": ["Amount must be greater than 0."]}, status=status.HTTP_400_BAD_REQUEST)

        method = str(request.data.get("method") or "UPI").strip().upper()[:16]
        utr = str(request.data.get("utr") or "").strip()[:100]
        notes = str(request.data.get("notes") or "").strip()
        proof = request.FILES.get("payment_proof") or request.FILES.get("file")

        obj = AgencyPackagePaymentRequest.objects.create(
            assignment=assignment,
            agency=request.user,
            package=assignment.package,
            amount=amount,
            method=method or "UPI",
            utr=utr or "",
            payment_proof=proof,
            notes=notes or "",
            status="PENDING",
        )
        ser = AgencyPackagePaymentRequestSerializer(obj, context={"request": request})
        return Response(ser.data, status=status.HTTP_201_CREATED)


class AdminAgencyPaymentRequestListView(APIView):
    """
    GET /api/business/admin/agency-packages/payment-requests/?status=PENDING|APPROVED|REJECTED
    Admin-only list of agency payment requests. Defaults to PENDING.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        status_in = (request.query_params.get("status") or "PENDING").strip().upper()
        valid = {"PENDING", "APPROVED", "REJECTED"}
        qs = (
            AgencyPackagePaymentRequest.objects
            .select_related("assignment", "package", "agency", "approved_by")
            .order_by("-created_at", "-id")
        )
        if status_in in valid:
            qs = qs.filter(status=status_in)
        ser = AgencyPackagePaymentRequestSerializer(qs, many=True, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)


class AdminApproveAgencyPaymentRequestView(APIView):
    """
    POST /api/business/admin/agency-packages/payment-requests/<pk>/approve/
    Body: { "admin_notes": "optional" }
    Marks the request APPROVED and stamps approver. Payment row creation is handled by model signal.
    """
    permission_classes = [IsAdminUser]

    def post(self, request, pk: int):
        obj = AgencyPackagePaymentRequest.objects.select_related("assignment", "package", "agency").filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if obj.status != "PENDING":
            return Response({"detail": "Only PENDING requests can be approved."}, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction as _tx

        with _tx.atomic():
            obj.status = "APPROVED"
            obj.approved_by = request.user
            obj.approved_at = timezone.now()
            admin_notes = str((request.data or {}).get("admin_notes") or "").strip()
            if admin_notes:
                obj.admin_notes = admin_notes
            obj.save(update_fields=["status", "approved_by", "approved_at", "admin_notes"])

            # Create a concrete payment row against the assignment (idempotent on reference)
            try:
                ref = f"REQ-{obj.id}-{(obj.utr or obj.method or '').strip()}"
                # Avoid duplicates on re-approval attempts
                if not AgencyPackagePayment.objects.filter(assignment=obj.assignment, reference=ref[:100]).exists():
                    # Clamp approval amount to remaining to prevent overpayment
                    from decimal import Decimal as D
                    try:
                        pkg_total = D(str(getattr(obj.assignment.package, "amount", "0") or "0"))
                    except Exception:
                        pkg_total = D("0")
                    try:
                        paid_sum = obj.assignment.payments.aggregate(s=Sum("amount")).get("s") or D("0")
                    except Exception:
                        paid_sum = D("0")
                    remaining = pkg_total - paid_sum
                    if remaining > 0:
                        try:
                            pay_amount = D(str(obj.amount))
                        except Exception:
                            pay_amount = remaining
                        if pay_amount > remaining:
                            pay_amount = remaining
                        AgencyPackagePayment.objects.create(
                            assignment=obj.assignment,
                            amount=pay_amount,
                            reference=ref[:100],
                            notes=(obj.notes or "")[:1000],
                        )
            except Exception:
                # best-effort; do not block approval if payment row creation fails
                pass

        ser = AgencyPackagePaymentRequestSerializer(obj, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)


class AdminRejectAgencyPaymentRequestView(APIView):
    """
    POST /api/business/admin/agency-packages/payment-requests/<pk>/reject/
    Body: { "admin_notes": "optional" }
    """
    permission_classes = [IsAdminUser]

    def post(self, request, pk: int):
        obj = AgencyPackagePaymentRequest.objects.select_related("assignment", "package", "agency").filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if obj.status != "PENDING":
            return Response({"detail": "Only PENDING requests can be rejected."}, status=status.HTTP_400_BAD_REQUEST)

        obj.status = "REJECTED"
        obj.approved_by = request.user
        obj.approved_at = timezone.now()
        admin_notes = str((request.data or {}).get("admin_notes") or "").strip()
        if admin_notes:
            obj.admin_notes = admin_notes
        obj.save(update_fields=["status", "approved_by", "approved_at", "admin_notes"])
        ser = AgencyPackagePaymentRequestSerializer(obj, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)


class DailyReportAllView(APIView):
    """
    GET /api/v1/reports/all/?from=YYYY-MM-DD&to=YYYY-MM-DD&role=EMPLOYEE|SUBFRANCHISE&reporter=<id>&format=csv
    Permissions:
      - Admin: all
      - Agency: team scope (basic rule: reporters where registered_by = request.user) plus self
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = DailyReport.objects.select_related("reporter").all()
        if not (getattr(user, "is_staff", False) or getattr(user, "is_superuser", False)):
            # Agency scope
            is_agency = str(getattr(user, "role", "") or "") == "agency" or str(getattr(user, "category", "") or "").startswith("agency")
            if not is_agency:
                return Response({"detail": "Only admin or agency can view all reports."}, status=status.HTTP_403_FORBIDDEN)
            qs = qs.filter(Q(reporter__registered_by=user) | Q(reporter=user))

        # Filters
        d_from = request.query_params.get("from")
        d_to = request.query_params.get("to")
        role = request.query_params.get("role")
        reporter_id = request.query_params.get("reporter")
        if d_from:
            try:
                qs = qs.filter(date__gte=d_from)
            except Exception:
                pass
        if d_to:
            try:
                qs = qs.filter(date__lte=d_to)
            except Exception:
                pass
        if role in ("EMPLOYEE", "SUBFRANCHISE"):
            qs = qs.filter(role=role)
        if reporter_id:
            try:
                qs = qs.filter(reporter_id=int(reporter_id))
            except Exception:
                pass

        qs = qs.order_by("-date", "-id")

        # CSV export
        if (request.query_params.get("format") or "").lower() == "csv":
            resp = HttpResponse(content_type="text/csv")
            fname = f"daily_reports_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
            resp["Content-Disposition"] = f'attachment; filename="{fname}"'
            import csv
            writer = csv.writer(resp)
            writer.writerow([
                "date", "reporter", "role",
                "tr_registered", "wg_registered", "asia_pay_registered", "dm_account_registered",
                "e_coupon_issued", "physical_coupon_issued", "product_sold", "total_amount",
            ])
            for r in qs:
                writer.writerow([
                    r.date, getattr(r.reporter, "username", ""), r.role,
                    r.tr_registered, r.wg_registered, r.asia_pay_registered, r.dm_account_registered,
                    r.e_coupon_issued, r.physical_coupon_issued, r.product_sold, r.total_amount,
                ])
            return resp

        ser = DailyReportSerializer(qs, many=True)
        return Response(ser.data, status=status.HTTP_200_OK)


# ==============================
# TRI Apps (Holidays, EV, etc.) — Endpoints
# ==============================
class TriAppListView(APIView):
    """
    GET /api/business/tri/apps/
    List active TRI apps with capability flags and banner URL.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = TriApp.objects.filter(is_active=True).order_by("slug")
        ser = TriAppSerializer(qs, many=True, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)


class TriAppDetailView(APIView):
    """
    GET /api/business/tri/apps/<slug>/
    Retrieve a TRI app with active products (image URLs) and admin-controlled flags:
      - allow_price, allow_add_to_cart, allow_payment
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug):
        obj = TriApp.objects.filter(slug=slug, is_active=True).first()
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = TriAppSerializer(obj, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)


# ==============================
# Withdrawals: Direct Refer Commission Breakdown + Apply (Admin)
# ==============================
class WithdrawCommissionBreakdownView(APIView):
    """
    GET /api/business/withdrawals/breakdown/?amount=123.45[&user_id=PK]
    - Authenticated users can see their own breakdown by omitting user_id.
    - Admins can pass user_id to view breakdown for any user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        amt_raw = request.query_params.get("amount")
        if amt_raw is None:
            return Response({"detail": "amount is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Target user selection
        target_user = request.user
        user_id = request.query_params.get("user_id")
        if user_id:
            if not (getattr(request.user, "is_staff", False) or getattr(request.user, "is_superuser", False)):
                return Response({"detail": "Only admin can view another user's breakdown."}, status=status.HTTP_403_FORBIDDEN)
            try:
                from accounts.models import CustomUser
                target_user = CustomUser.objects.get(pk=int(user_id))
            except Exception:
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        from decimal import Decimal
        try:
            amount = Decimal(str(amt_raw))
        except Exception:
            return Response({"detail": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0:
            return Response({"detail": "Amount must be greater than 0."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            breakdown = compute_withdraw_distribution(target_user, amount)
        except Exception:
            return Response({"detail": "Failed to compute breakdown."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(breakdown, status=status.HTTP_200_OK)


class AdminApplyWithdrawCommissionView(APIView):
    """
    POST /api/business/admin/withdrawals/apply/
    Body: { "user_id": PK, "amount": 123.45, "source_type": "WITHDRAWAL", "source_id": "ref-123" }
    Admin-only: applies the distribution by crediting sponsor/company wallets.
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        uid = request.data.get("user_id")
        amt_raw = request.data.get("amount")
        source_type = str(request.data.get("source_type") or "WITHDRAWAL")
        source_id = str(request.data.get("source_id") or "")

        if uid is None or amt_raw is None:
            return Response({"detail": "user_id and amount are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from accounts.models import CustomUser
            target_user = CustomUser.objects.get(pk=int(uid))
        except Exception:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        from decimal import Decimal
        try:
            amount = Decimal(str(amt_raw))
        except Exception:
            return Response({"detail": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0:
            return Response({"detail": "Amount must be greater than 0."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            breakdown = apply_withdraw_distribution(target_user, amount, source_type=source_type, source_id=source_id)
        except Exception:
            return Response({"detail": "Failed to apply distribution."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(breakdown, status=status.HTTP_200_OK)
