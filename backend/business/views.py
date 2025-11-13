from rest_framework import generics, permissions, status
from rest_framework.permissions import IsAdminUser
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from django.http import HttpResponse
from django.db.models import Q
from .models import BusinessRegistration, RewardProgress, RewardRedemption, DailyReport, AutoPoolAccount, SubscriptionActivation
from .serializers import BusinessRegistrationSerializer, DailyReportSerializer


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

        five_active = five_count > 0
        three_active = three_count > 0
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
                "five_matrix_count": int(five_count),
                "three_matrix_count": int(three_count),
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
