from rest_framework import generics, permissions, status
from rest_framework.permissions import IsAdminUser
from adminapi.permissions import IsAdminOrStaff, HasAdminModuleAccess
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from django.http import HttpResponse
from django.db.models import Q, Sum, Count
from django.conf import settings
from io import BytesIO
import time
import logging
import os
from jobs.models import BackgroundTask
from django.utils.dateparse import parse_datetime
from .models import (
    BusinessRegistration,
    MerchantCategory,
    MerchantSubCategory,
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
    TriAppProduct,
    AgencyPackagePaymentRequest,
    FranchiseAchiever,
    WishingBanner,
    TeamConsumerWishingBanner,
    TeamConsumerTopAchiever,
    TeamConsumerEducationalVideo,
    TeamConsumerDocument,
)
from .serializers import (
    BusinessRegistrationSerializer,
    DailyReportSerializer,
    AgencyPackageAssignmentSerializer,
    AgencyPackagePaymentSerializer,
    AgencyPackagePaymentRequestSerializer,
    FranchiseAchieverSerializer,
    WishingBannerSerializer,
    TeamConsumerWishingBannerSerializer,
    TeamConsumerTopAchieverSerializer,
    TeamConsumerEducationalVideoSerializer,
    TeamConsumerDocumentSerializer,
)


# ==========================
# Hubble (Gift Cards) SDK
# ==========================
from core.hubble import generate_hubble_sso_jwt, build_hubble_web_sdk_url, verify_hubble_webhook
from .hubble_models import HubbleWebhookEvent
from .throttles import HubbleWebhookAnonThrottle


def _digits_only(v: str) -> str:
    try:
        return "".join(ch for ch in str(v or "") if ch.isdigit())
    except Exception:
        return ""


def _resolve_user_from_hubble_subject(subject: str):
    """Hubble webhook `userId` maps to customer_id provided at init.

    We use JWT SSO `sub` as that identifier. We default to using our CustomUser.pk as string.
    """
    from accounts.models import CustomUser

    s = str(subject or "").strip()
    if not s:
        return None
    # 1) numeric -> PK
    if s.isdigit():
        return CustomUser.objects.filter(pk=int(s)).first()
    # 2) try username
    return CustomUser.objects.filter(username=s).first()


class HubbleIframeUrlView(APIView):
    """Return a short-lived iframe URL for Hubble Web SDK.

    GET /api/business/hubble/iframe-url/
    Response: { "iframeUrl": "https://sdk...", "token": "...", "expiresIn": 60 }
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        u = request.user
        try:
            token = generate_hubble_sso_jwt(
                subject=str(getattr(u, "id", "")),
                name=str(getattr(u, "full_name", "") or getattr(u, "username", "") or ""),
                email=str(getattr(u, "email", "") or ""),
                phone_number=_digits_only(getattr(u, "phone", "") or ""),
                cohorts=[str(getattr(u, "category", "") or "consumer")],
            )
            iframe_url = build_hubble_web_sdk_url(token=token)
        except Exception as e:
            # Return actionable config error instead of generic 500
            return Response(
                {
                    "detail": "Hubble is not configured on server.",
                    "error": f"{type(e).__name__}: {e}",
                    "required_env": [
                        "HUBBLE_SDK_BASE_URL",
                        "HUBBLE_CLIENT_ID",
                        "HUBBLE_JWT_PRIVATE_KEY_PEM (or HUBBLE_JWT_PRIVATE_KEY_PATH)",
                    ],
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # SECURITY: Do not return the raw SSO token in production responses.
        # Backward-compatible behavior:
        # - Existing clients that ignore `token` keep working.
        # - If some internal debug tooling depends on it, allow it only when DEBUG and debug=1.
        include_token = False
        try:
            include_token = bool(settings.DEBUG) and str(request.query_params.get("debug") or "").lower() in ("1", "true", "yes")
        except Exception:
            include_token = False

        data = {"iframeUrl": iframe_url, "expiresIn": 60}
        if include_token:
            data["token"] = token
        return Response(data)


class HubbleTransactionsMeView(APIView):
    """List the authenticated user's Hubble transactions.

    GET /api/business/hubble/transactions/me/
    Query params:
      - status: filter by status
      - limit: default 50 (max 200)
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .hubble_models import HubbleTransaction

        status_filter = str(request.query_params.get("status") or "").strip().upper()
        try:
            limit = int(request.query_params.get("limit") or 50)
        except Exception:
            limit = 50
        limit = max(1, min(200, limit))

        qs = HubbleTransaction.objects.filter(user=request.user).order_by("-updated_at", "-id")
        if status_filter:
            qs = qs.filter(status=status_filter)

        out = []
        for t in qs[:limit]:
            out.append(
                {
                    "transactionReferenceId": t.transaction_reference_id,
                    "status": t.status,
                    "amount": str(t.amount) if t.amount is not None else None,
                    "discountAmount": str(t.discount_amount) if t.discount_amount is not None else None,
                    "currency": t.currency,
                    "updatedAt": t.updated_at.isoformat() if t.updated_at else None,
                    "createdAt": t.created_at.isoformat() if t.created_at else None,
                }
            )

        return Response({"results": out})


class HubbleWebhookReceiverView(APIView):
    """Receive Hubble webhooks.

    POST /api/business/hubble/webhook/
    - Verifies X-Verify signature.
    - Stores raw event (idempotent) in business.HubbleWebhookEvent.
    - Enqueues background processing task.
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [HubbleWebhookAnonThrottle]

    def _get_client_ip(self, request) -> str:
        """Best-effort client IP extraction.

        NOTE: If you're behind a proxy/load balancer, ensure Django is configured to trust
        X-Forwarded-For correctly. For Render, you typically want to rely on X-Forwarded-For.
        """
        try:
            xff = request.META.get("HTTP_X_FORWARDED_FOR")
            if xff:
                # first IP is original client
                return str(xff.split(",")[0]).strip()
        except Exception:
            pass
        try:
            return str(request.META.get("REMOTE_ADDR") or "").strip()
        except Exception:
            return ""

    def _is_ip_allowed(self, ip: str) -> bool:
        allowlist_raw = str(getattr(settings, "HUBBLE_WEBHOOK_IP_ALLOWLIST", "") or "").strip()
        if not allowlist_raw:
            return True  # disabled (backward compatible)
        allowed = {a.strip() for a in allowlist_raw.split(",") if a.strip()}
        return ip in allowed

    def post(self, request):
        # Optional ingress control: allowlist webhook source IPs.
        # Disabled by default; enable by setting HUBBLE_WEBHOOK_IP_ALLOWLIST.
        ip = self._get_client_ip(request)
        if not self._is_ip_allowed(ip):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        raw_body: bytes = request.body or b""
        x_verify = request.headers.get("X-Verify") or request.META.get("HTTP_X_VERIFY") or ""

        if not verify_hubble_webhook(raw_body=raw_body, x_verify=str(x_verify or "")):
            return Response({"detail": "Invalid signature"}, status=status.HTTP_401_UNAUTHORIZED)

        # Parse JSON (best-effort)
        try:
            import json

            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except Exception:
            payload = None

        event_type = ""
        tx_ref = ""
        order_status = ""

        try:
            if isinstance(payload, dict) and payload.get("event"):
                event_type = str(payload.get("event") or "")
            elif isinstance(payload, dict) and payload.get("orderStatus"):
                event_type = "TRANSACTION"
        except Exception:
            event_type = ""

        try:
            if isinstance(payload, dict):
                tx_ref = str(payload.get("transactionReferenceId") or "")
                order_status = str(payload.get("orderStatus") or "")
        except Exception:
            tx_ref = ""
            order_status = ""

        # Idempotency key:
        # - Transaction: txRef:status
        # - Brand events: event + details.id
        idem = ""
        if tx_ref:
            idem = f"hubble:tx:{tx_ref}:{order_status or 'NA'}"
        else:
            try:
                details = payload.get("details") if isinstance(payload, dict) else None
                did = details.get("id") if isinstance(details, dict) else ""
                idem = f"hubble:event:{event_type}:{did or 'NA'}"
            except Exception:
                idem = f"hubble:event:{event_type}:NA"

        # Store event (idempotent)
        try:
            evt, created = HubbleWebhookEvent.objects.get_or_create(
                idempotency_key=idem,
                defaults={
                    "event_type": event_type,
                    "transaction_reference_id": tx_ref,
                    "status": order_status,
                    "x_verify": str(x_verify or "")[:256],
                    "raw_body": (raw_body.decode("utf-8", errors="replace") or "")[:2000000],
                    "payload": payload,
                },
            )
        except Exception as e:
            return Response({"detail": f"Failed to store event: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        # Enqueue processing (idempotent by event id)
        try:
            BackgroundTask.enqueue(
                task_type="hubble_webhook_process",
                payload={"event_id": int(evt.id)},
                idempotency_key=f"hubble_webhook_process:{evt.id}",
            )
        except Exception:
            # Do not fail webhook
            pass

        return Response({"ok": True, "id": evt.id, "created": bool(created)})


class _IsAgencyUser(permissions.BasePermission):
    """Allow only authenticated agency actors (role=agency or category startswith agency_)."""

    def has_permission(self, request, view):
        try:
            u = getattr(request, "user", None)
            if not u or not u.is_authenticated:
                return False
            role = str(getattr(u, "role", "") or "").lower()
            cat = str(getattr(u, "category", "") or "").lower()
            return role == "agency" or cat.startswith("agency_")
        except Exception:
            return False


FRANCHISE_DASHBOARD_CATEGORIES = {
    "agency_state_coordinator",
    "agency_state",
    "agency_district_coordinator",
    "agency_district",
    "agency_pincode_coordinator",
    "agency_pincode",
}


def _clean_pin(value):
    pin = _digits_only(value)[:6]
    return pin if len(pin) == 6 else ""


def _scope_label_for_category(category):
    return {
        "agency_state_coordinator": "State Coordinator",
        "agency_state": "State",
        "agency_district_coordinator": "District Coordinator",
        "agency_district": "District",
        "agency_pincode_coordinator": "Pincode Coordinator",
        "agency_pincode": "Pincode",
    }.get(category, "Franchise")


def _pins_for_state_name(state_name):
    try:
        from locations.views import _build_district_index

        skey = str(state_name or "").strip().lower()
        if not skey:
            return set()
        idx = _build_district_index() or {}
        pins = set()
        for key, values in idx.items():
            state_key, district_key = key
            if state_key == skey and district_key:
                pins.update(values or set())
        return {_clean_pin(p) for p in pins if _clean_pin(p)}
    except Exception:
        return set()


def _pins_for_district_name(district_name, state_name=""):
    try:
        from locations.views import _build_district_index, _scan_raw_for_pincodes, india_place_variants

        dname = str(district_name or "").strip()
        if not dname:
            return set()
        skey = str(state_name or "").strip().lower()
        idx = _build_district_index() or {}
        pins = set()
        for variant in (india_place_variants(dname) or [dname]):
            dkey = str(variant or "").strip().lower()
            if not dkey:
                continue
            if skey:
                pins.update(idx.get((skey, dkey), set()))
            pins.update(idx.get(("", dkey), set()))
        if not pins:
            pins.update(_scan_raw_for_pincodes(dname, state_name) or set())
        return {_clean_pin(p) for p in pins if _clean_pin(p)}
    except Exception:
        return set()


def _resolve_franchise_dashboard_scope(user):
    """
    Resolve the logged-in agency account into the pincodes it is allowed to see.

    The admin/registration flow stores multi-region ownership in AgencyRegionAssignment:
    state coordinators can own multiple states, district coordinators multiple districts,
    and pincode coordinators multiple pincodes. Single state/district/pincode agency users
    use the same assignment table with profile-field fallbacks for older records.
    """
    from accounts.models import AgencyRegionAssignment

    category = str(getattr(user, "category", "") or "").lower()
    if category not in FRANCHISE_DASHBOARD_CATEGORIES:
        return None, f"{_scope_label_for_category(category)} accounts cannot access this dashboard."

    assignments = list(
        AgencyRegionAssignment.objects.filter(user=user)
        .select_related("state")
        .order_by("level", "state__name", "district", "pincode")
    )

    states = []
    districts = []
    pincodes = []
    pins = set()

    def add_state(state_obj):
        if not state_obj:
            return
        state_id = getattr(state_obj, "id", None)
        state_name = str(getattr(state_obj, "name", "") or "").strip()
        if not state_name:
            return
        if not any(s.get("id") == state_id and s.get("name") == state_name for s in states):
            states.append({"id": state_id, "name": state_name})
        pins.update(_pins_for_state_name(state_name))

    def add_district(district_name, state_obj=None):
        district = str(district_name or "").strip()
        if not district:
            return
        state_id = getattr(state_obj, "id", None) if state_obj else None
        state_name = str(getattr(state_obj, "name", "") or "").strip() if state_obj else ""
        row = {"district": district, "state_id": state_id, "state": state_name}
        if not any(
            d.get("district", "").lower() == district.lower() and d.get("state_id") == state_id
            for d in districts
        ):
            districts.append(row)
        pins.update(_pins_for_district_name(district, state_name))

    def add_pincode(pin_value):
        pin = _clean_pin(pin_value)
        if not pin:
            return
        if pin not in pincodes:
            pincodes.append(pin)
        pins.add(pin)

    if category in {"agency_state_coordinator", "agency_state"}:
        for a in assignments:
            if a.level == "state":
                add_state(a.state)
        if not states:
            add_state(getattr(user, "state", None))
    elif category in {"agency_district_coordinator", "agency_district"}:
        for a in assignments:
            if a.level == "district":
                add_district(a.district, a.state)
        if not districts:
            city = getattr(user, "city", None)
            add_district(getattr(city, "name", "") or "", getattr(user, "state", None))
    elif category in {"agency_pincode_coordinator", "agency_pincode"}:
        for a in assignments:
            if a.level == "pincode":
                add_pincode(a.pincode)
        if not pincodes:
            add_pincode(getattr(user, "pincode", ""))

    sorted_pins = sorted(pins)
    scope_level = (
        "state"
        if category in {"agency_state_coordinator", "agency_state"}
        else "district"
        if category in {"agency_district_coordinator", "agency_district"}
        else "pincode"
    )
    return {
        "category": category,
        "label": _scope_label_for_category(category),
        "level": scope_level,
        "states": states,
        "districts": districts,
        "pincodes": sorted_pins,
        "assigned_pincodes": pincodes,
        "pincode_count": len(sorted_pins),
    }, None


class FranchiseDashboardMetricsView(APIView):
    """
    GET /api/business/franchise/dashboard-metrics/

    Returns:
      - assigned scope + resolved pincodes
      - overall counts + per-pincode counts for:
          consumers (category=consumer)
          captain_office (sub-franchise registrations under pincode) (category=agency_sub_franchise)
          sarathi (employees) (category=employee)
          merchants (merchant/business)
      - consumer active/inactive overall + current month
      - consumer total earning overall + current month (best-effort from WalletTransaction)
      - self rebirth id counts (hardcoded 0 for now)
    """

    permission_classes = [permissions.IsAuthenticated, _IsAgencyUser]

    def _month_range(self):
        now = timezone.now()
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # next month start
        if start.month == 12:
            end = start.replace(year=start.year + 1, month=1)
        else:
            end = start.replace(month=start.month + 1)
        return start, end

    def get(self, request):
        from accounts.models import CustomUser, WalletTransaction

        user = request.user
        scope, scope_error = _resolve_franchise_dashboard_scope(user)
        if scope_error:
            return Response({"detail": scope_error}, status=status.HTTP_403_FORBIDDEN)

        pins = scope.get("pincodes") or []

        # Base query for users within pincodes
        base_users = CustomUser.objects.filter(pincode__in=pins).only("id", "category", "account_active", "date_joined", "pincode")

        # Consumer counts
        consumers_qs = base_users.filter(category="consumer")
        employees_qs = base_users.filter(category="employee")
        subfr_qs = base_users.filter(category="agency_sub_franchise")
        merchants_qs = base_users.filter(category__in=["merchant", "business"])

        # Overall counts
        overall = {
            "pincodes": pins,
            "counts": {
                "consumers": int(consumers_qs.count()),
                "captain_office": int(subfr_qs.count()),
                "sarathi": int(employees_qs.count()),
                "merchants": int(merchants_qs.count()),
                "self_rebirth_ids": 0,
            },
        }

        # Per-pincode grouped counts
        def _group_count(qs):
            rows = qs.values("pincode").annotate(c=Count("id")).order_by("pincode")
            mp = {r["pincode"]: int(r["c"]) for r in rows}
            return [{"pincode": p, "count": int(mp.get(p, 0))} for p in pins]

        per_pincode = {
            "consumers": _group_count(consumers_qs),
            "captain_office": _group_count(subfr_qs),
            "sarathi": _group_count(employees_qs),
            "merchants": _group_count(merchants_qs),
            "self_rebirth_ids": [{"pincode": p, "count": 0} for p in pins],
        }

        # Consumer active/inactive overall + monthly
        m_start, m_end = self._month_range()
        active_overall = consumers_qs.filter(account_active=True).count()
        inactive_overall = consumers_qs.filter(account_active=False).count()
        active_month = consumers_qs.filter(date_joined__gte=m_start, date_joined__lt=m_end, account_active=True).count()
        inactive_month = consumers_qs.filter(date_joined__gte=m_start, date_joined__lt=m_end, account_active=False).count()

        # Consumer earnings (best-effort)
        consumer_ids = list(consumers_qs.values_list("id", flat=True))
        earnings_overall = 0
        earnings_month = 0
        if consumer_ids:
            try:
                earn_types = ["COMMISSION_CREDIT", "DIRECT_REF_BONUS", "LEVEL_BONUS", "AUTOPOOL_BONUS_FIVE", "AUTOPOOL_BONUS_THREE", "FRANCHISE_INCOME"]
                earnings_overall = (
                    WalletTransaction.objects.filter(user_id__in=consumer_ids, amount__gt=0, type__in=earn_types)
                    .aggregate(s=Sum("amount"))
                    .get("s")
                    or 0
                )
                earnings_month = (
                    WalletTransaction.objects.filter(user_id__in=consumer_ids, amount__gt=0, type__in=earn_types, created_at__gte=m_start, created_at__lt=m_end)
                    .aggregate(s=Sum("amount"))
                    .get("s")
                    or 0
                )
            except Exception:
                earnings_overall = 0
                earnings_month = 0

        consumer_stats = {
            "active": {"overall": int(active_overall), "month": int(active_month)},
            "inactive": {"overall": int(inactive_overall), "month": int(inactive_month)},
            "self_rebirth_id": {"overall": 0, "month": 0},
            "total_earning": {"overall": float(earnings_overall), "month": float(earnings_month)},
        }

        return Response(
            {
                "scope": scope,
                "overall": overall,
                "per_pincode": per_pincode,
                "consumer_stats": consumer_stats,
            },
            status=status.HTTP_200_OK,
        )


class FranchiseWishingBannersPublicView(APIView):
    """Agency-facing endpoint to fetch active wishing banners."""

    permission_classes = [permissions.IsAuthenticated, _IsAgencyUser]

    def get(self, request):
        qs = WishingBanner.objects.filter(is_active=True).order_by("-created_at", "-id")
        ser = WishingBannerSerializer(qs, many=True, context={"request": request})
        return Response({"results": ser.data}, status=status.HTTP_200_OK)


class FranchiseAchieversPublicView(APIView):
    """Agency-facing endpoint: achievers filtered by the logged-in agency scope."""

    permission_classes = [permissions.IsAuthenticated, _IsAgencyUser]

    def get(self, request):
        pin = (request.query_params.get("pincode") or "").strip()
        pins = [p.strip() for p in (request.query_params.get("pincodes") or "").split(",") if p.strip()]
        if pin:
            pins = [pin]
        # If no explicit pins are given, use the same dynamic state/district/pincode
        # scope as the franchise dashboard metrics endpoint.
        if not pins:
            scope, scope_error = _resolve_franchise_dashboard_scope(request.user)
            if scope_error:
                return Response({"detail": scope_error}, status=status.HTTP_403_FORBIDDEN)
            pins = list((scope or {}).get("pincodes") or [])
        qs = FranchiseAchiever.objects.filter(is_active=True)
        if not pins:
            return Response({"results": []}, status=status.HTTP_200_OK)
        qs = qs.filter(pincode__in=pins)
        qs = qs.order_by("sort_order", "-created_at", "id")
        ser = FranchiseAchieverSerializer(qs, many=True, context={"request": request})
        return Response({"results": ser.data}, status=status.HTTP_200_OK)


class AdminFranchiseAchieverListCreateView(generics.ListCreateAPIView):
    # Admin UI route: /admin/franchise/* is gated under the "promo" module in frontend.
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]
    serializer_class = FranchiseAchieverSerializer
    queryset = FranchiseAchiever.objects.all().order_by("sort_order", "-created_at", "id")


class AdminFranchiseAchieverDetailView(generics.RetrieveUpdateDestroyAPIView):
    # Admin UI route: /admin/franchise/* is gated under the "promo" module in frontend.
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]
    serializer_class = FranchiseAchieverSerializer
    queryset = FranchiseAchiever.objects.all()


class AdminWishingBannerListCreateView(generics.ListCreateAPIView):
    # Admin UI route: /admin/franchise/* is gated under the "promo" module in frontend.
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]
    serializer_class = WishingBannerSerializer
    queryset = WishingBanner.objects.all().order_by("-created_at", "-id")


class AdminWishingBannerDetailView(generics.RetrieveUpdateDestroyAPIView):
    # Admin UI route: /admin/franchise/* is gated under the "promo" module in frontend.
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]
    serializer_class = WishingBannerSerializer
    queryset = WishingBanner.objects.all()


# ==========================================
# Team/Consumer dashboard: public + admin CRUD
# ==========================================
class TeamConsumerWishingBannersPublicView(APIView):
    """Consumer-facing endpoint to fetch active wishing banners for team dashboard."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = TeamConsumerWishingBanner.objects.filter(is_active=True).order_by("-created_at", "-id")
        ser = TeamConsumerWishingBannerSerializer(qs, many=True, context={"request": request})
        return Response({"results": ser.data}, status=status.HTTP_200_OK)


class TeamConsumerTopAchieversPublicView(APIView):
    """Consumer-facing endpoint to fetch active top achievers for team dashboard."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = TeamConsumerTopAchiever.objects.filter(is_active=True).order_by("sort_order", "-created_at", "id")
        ser = TeamConsumerTopAchieverSerializer(qs, many=True, context={"request": request})
        return Response({"results": ser.data}, status=status.HTTP_200_OK)


class TeamConsumerEducationalVideosPublicView(APIView):
    """Consumer-facing endpoint to fetch active educational videos."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = TeamConsumerEducationalVideo.objects.filter(is_active=True).select_related("required_rank").order_by("sort_order", "-created_at", "id")
        ser = TeamConsumerEducationalVideoSerializer(qs, many=True, context={"request": request})
        return Response({"results": ser.data}, status=status.HTTP_200_OK)


class TeamConsumerDocumentLatestPublicView(APIView):
    """Consumer-facing endpoint to fetch the latest active Team PDF / certificate PDF."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, kind):
        k = str(kind or "").strip().upper()
        allowed = {
            TeamConsumerDocument.KIND_PDF,
            TeamConsumerDocument.KIND_BUSINESS_PDF,
            TeamConsumerDocument.KIND_CERTIFICATE,
        }
        if k not in allowed:
            return Response({"detail": "Invalid document kind."}, status=status.HTTP_400_BAD_REQUEST)
        obj = (
            TeamConsumerDocument.objects.filter(kind=k, is_active=True)
            .exclude(file="")
            .order_by("sort_order", "-created_at", "id")
            .first()
        )
        if not obj:
            return Response({"detail": "No document uploaded."}, status=status.HTTP_404_NOT_FOUND)
        ser = TeamConsumerDocumentSerializer(obj, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)


class AdminTeamConsumerWishingBannerListCreateView(generics.ListCreateAPIView):
    # Admin UI route: /admin/team-consumer/* is gated under the "promo" module in frontend.
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]
    serializer_class = TeamConsumerWishingBannerSerializer
    queryset = TeamConsumerWishingBanner.objects.all().order_by("-created_at", "-id")


class AdminTeamConsumerWishingBannerDetailView(generics.RetrieveUpdateDestroyAPIView):
    # Admin UI route: /admin/team-consumer/* is gated under the "promo" module in frontend.
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]
    serializer_class = TeamConsumerWishingBannerSerializer
    queryset = TeamConsumerWishingBanner.objects.all()


class AdminTeamConsumerTopAchieverListCreateView(generics.ListCreateAPIView):
    # Admin UI route: /admin/team-consumer/* is gated under the "promo" module in frontend.
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]
    serializer_class = TeamConsumerTopAchieverSerializer
    queryset = TeamConsumerTopAchiever.objects.all().order_by("sort_order", "-created_at", "id")


class AdminTeamConsumerTopAchieverDetailView(generics.RetrieveUpdateDestroyAPIView):
    # Admin UI route: /admin/team-consumer/* is gated under the "promo" module in frontend.
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]
    serializer_class = TeamConsumerTopAchieverSerializer
    queryset = TeamConsumerTopAchiever.objects.all()


class AdminTeamConsumerEducationalVideoListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]
    serializer_class = TeamConsumerEducationalVideoSerializer
    queryset = TeamConsumerEducationalVideo.objects.select_related("required_rank").all().order_by("sort_order", "-created_at", "id")


class AdminTeamConsumerEducationalVideoDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]
    serializer_class = TeamConsumerEducationalVideoSerializer
    queryset = TeamConsumerEducationalVideo.objects.select_related("required_rank").all()


class AdminTeamConsumerDocumentListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]
    serializer_class = TeamConsumerDocumentSerializer

    def get_queryset(self):
        qs = TeamConsumerDocument.objects.all().order_by("kind", "sort_order", "-created_at", "id")
        kind = str(self.request.query_params.get("kind") or "").strip().upper()
        if kind:
            qs = qs.filter(kind=kind)
        return qs


class AdminTeamConsumerDocumentDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]
    serializer_class = TeamConsumerDocumentSerializer
    queryset = TeamConsumerDocument.objects.all()

logger = logging.getLogger(__name__)

def _bounded_limit_offset(request, default=25, max_limit=25):
    try:
        limit = int(request.query_params.get("limit", default))
    except Exception:
        limit = default
    try:
        offset = int(request.query_params.get("offset", 0))
    except Exception:
        offset = 0
    if limit <= 0:
        limit = default
    if limit > max_limit:
        limit = max_limit
    if offset < 0:
        offset = 0
    return limit, offset


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
    PromoProductOrderSerializer,
)
from .models import PromoPackage, PromoPurchase, EBookAccess, TriApp, PromoProductOrder
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
        limit, offset = _bounded_limit_offset(request, default=25, max_limit=25)
        qs_page = qs[offset:offset + limit]
        ser = PromoPurchaseSerializer(qs_page, many=True, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)

    def post(self, request):
        ser = PromoPurchaseSerializer(data=request.data, context={"request": request})
        if ser.is_valid():
            obj = ser.save()
            return Response(PromoPurchaseSerializer(obj, context={"request": request}).data, status=status.HTTP_201_CREATED)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)


class PromoPurchasePayFromWalletView(APIView):
    """Wallet-paid promo purchase.

    POST /api/business/promo/purchases/pay-from-wallet/
    JSON body:
      {
        package_id: <int>,
        quantity?: <int>,
        prime150_choice?: "EBOOK"|"REDEEM",
        prime750_choice?: "PRODUCT"|"REDEEM",
        selected_promo_product_id?: <int>,
        shipping_address?: <string>,
        package_number?: <int>,
        boxes?: [int, ...],
        tri_app_slug?: <string>,
        product_id?: <int>
      }

    Server will:
      - Validate payload using PromoPurchaseSerializer rules
      - Compute authoritative amount_paid
      - Debit INTERNAL wallet, PACKAGE_COUPON wallet, or ADD MONEY upload pocket immediately
      - Create PromoPurchase PENDING with payment_mode=WALLET and link wallet tx
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from decimal import Decimal as D
        from accounts.models import Wallet, WalletTransaction

        # Validate payload with the existing serializer (but without requiring payment_proof)
        ser = PromoPurchaseSerializer(data=request.data, context={"request": request})
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        # Compute would-be total from validated data (serializer create() does this too, but we need it pre-debit)
        try:
            pkg = ser.validated_data.get("package")
        except Exception:
            pkg = None
        if not pkg:
            return Response({"detail": "Invalid package_id."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            qty = int(ser.validated_data.get("quantity") or 1)
        except Exception:
            qty = 1
        qty = max(1, qty)

        try:
            # MONTHLY/SPP price is admin-configured on the promo package.
            if str(getattr(pkg, "type", "")) == "MONTHLY":
                unit = D(str(getattr(pkg, "price", "0") or "0"))
            elif ser.validated_data.get("tri_app_slug") and ser.validated_data.get("tri_product_id"):
                try:
                    trip = TriAppProduct.objects.filter(
                        pk=ser.validated_data.get("tri_product_id"),
                        is_active=True,
                    ).only("price").first()
                    unit = D(str(getattr(trip, "price", "0") or "0"))
                except Exception:
                    unit = D("0")
            else:
                unit = D(str(getattr(pkg, "price", "0") or "0"))
        except Exception:
            unit = D("0")
        total = (unit * D(str(qty))).quantize(D("0.01"))
        if total <= 0:
            return Response({"detail": "Invalid payable amount."}, status=status.HTTP_400_BAD_REQUEST)

        wallet_source = str(request.data.get("wallet_source") or request.data.get("walletSource") or "internal").strip().lower()
        if wallet_source not in {"internal", "package_coupon", "package_upload", "add_money"}:
            return Response({"detail": "Invalid wallet_source."}, status=status.HTTP_400_BAD_REQUEST)
        if wallet_source == "add_money":
            wallet_source = "package_upload"

        with transaction.atomic():
            w = Wallet.get_or_create_for_user(request.user)
            w = Wallet.objects.select_for_update().get(pk=w.pk)
            if wallet_source == "package_coupon":
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
                if available < total:
                    return Response({"detail": "Insufficient Package Purchase Coupon Wallet balance."}, status=status.HTTP_400_BAD_REQUEST)
                w.balance = max(D("0"), (w.balance or D("0")) - total)
                if w.balance < D("0"):
                    return Response({"detail": "Insufficient wallet balance."}, status=status.HTTP_400_BAD_REQUEST)
                w.save(update_fields=["balance", "updated_at"])
                WalletTransaction.objects.create(
                    user=request.user,
                    amount=total * D("-1"),
                    balance_after=w.balance,
                    type="PACKAGE_COUPON_WALLET_DEBIT",
                    meta={"reason": "PROMO_PURCHASE", "package_id": getattr(pkg, "id", None), "wallet_source": "package_coupon"},
                    source_type="PROMO_PURCHASE",
                    source_id="",
                )
            elif wallet_source == "package_upload":
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
                if available < total:
                    return Response({"detail": "Insufficient Add Money Pocket balance."}, status=status.HTTP_400_BAD_REQUEST)
                w.balance = max(D("0"), (w.balance or D("0")) - total)
                if w.balance < D("0"):
                    return Response({"detail": "Insufficient wallet balance."}, status=status.HTTP_400_BAD_REQUEST)
                w.save(update_fields=["balance", "updated_at"])
                WalletTransaction.objects.create(
                    user=request.user,
                    amount=total * D("-1"),
                    balance_after=w.balance,
                    type="INTERNAL_WALLET_DEBIT",
                    meta={"reason": "PROMO_PURCHASE", "package_id": getattr(pkg, "id", None), "wallet_source": "package_upload"},
                    source_type="WALLET_UPLOAD",
                    source_id="",
                )
            else:
                try:
                    w.debit(
                        total,
                        tx_type="INTERNAL_WALLET_DEBIT",
                        meta={"reason": "PROMO_PURCHASE", "package_id": getattr(pkg, "id", None), "wallet_source": "internal"},
                        source_type="PROMO_PURCHASE",
                        source_id="",  # filled after promo purchase is created
                    )
                except Exception:
                    return Response({"detail": "Insufficient wallet balance."}, status=status.HTTP_400_BAD_REQUEST)

            # Create the purchase record
            try:
                data = dict(ser.validated_data)
            except Exception:
                data = ser.validated_data
            # Ensure clean fields (serializer uses write-only helpers)
            data.pop("boxes", None)
            pp = PromoPurchase.objects.create(
                user=request.user,
                amount_paid=total,
                payment_mode="WALLET",
                **data,
            )

            # Link the debit tx we just created (find by source_type + user + amount)
            debit_type = "PACKAGE_COUPON_WALLET_DEBIT" if wallet_source == "package_coupon" else "INTERNAL_WALLET_DEBIT"
            tx_source_type = "WALLET_UPLOAD" if wallet_source == "package_upload" else "PROMO_PURCHASE"
            tx = (
                WalletTransaction.objects
                .filter(
                    user=request.user,
                    type=debit_type,
                    source_type=tx_source_type,
                    amount=D(str(total)) * D("-1"),
                )
                .order_by("-id")
                .first()
            )
            if tx:
                # Fill source_id and backlink
                try:
                    tx.source_id = str(pp.id)
                    tx.meta = dict(tx.meta or {})
                    tx.meta.update({"purchase_id": pp.id})
                    tx.save(update_fields=["source_id", "meta"])
                except Exception:
                    pass
                pp.wallet_debit_tx = tx
                pp.save(update_fields=["wallet_debit_tx"])

                if wallet_source == "package_coupon":
                    try:
                        from accounts.finance_constants import WalletTypes, FinanceCategories, LedgerDirections
                        from accounts.wallet_engine import WalletEngine, LedgerPosting
                        
                        system_user = WalletEngine.get_system_user()
                        WalletEngine.post_transaction(
                            category=FinanceCategories.PACKAGE_PURCHASE,
                            user=request.user,
                            source_module="PROMO_PURCHASE",
                            source_id=str(pp.id),
                            destination_module=WalletTypes.SYSTEM,
                            gross_amount=total,
                            net_amount=total,
                            idempotency_key=f"promo_purchase_debit:{pp.id}",
                            legacy_wallet_transaction=tx,
                            created_by=request.user,
                            approved_by=request.user,
                            remarks="Promo purchase debit from package coupon wallet",
                            metadata={"purchase_id": pp.id, "package_id": getattr(pkg, "id", None)},
                            postings=[
                                LedgerPosting(request.user, WalletTypes.PACKAGE_PURCHASE_COUPON, LedgerDirections.DEBIT, total, metadata={"purchase_id": pp.id}),
                                LedgerPosting(system_user, WalletTypes.SYSTEM, LedgerDirections.CREDIT, total, metadata={"counterparty_user_id": request.user.id}),
                            ],
                        )
                    except Exception:
                        pass
                elif wallet_source == "package_upload":
                    try:
                        from accounts.finance_constants import WalletTypes, FinanceCategories, LedgerDirections
                        from accounts.wallet_engine import WalletEngine, LedgerPosting
                        
                        system_user = WalletEngine.get_system_user()
                        WalletEngine.post_transaction(
                            category=FinanceCategories.PACKAGE_PURCHASE,
                            user=request.user,
                            source_module="PROMO_PURCHASE",
                            source_id=str(pp.id),
                            destination_module=WalletTypes.SYSTEM,
                            gross_amount=total,
                            net_amount=total,
                            idempotency_key=f"promo_purchase_upload_debit:{pp.id}",
                            legacy_wallet_transaction=tx,
                            created_by=request.user,
                            approved_by=request.user,
                            remarks="Promo purchase debit from add money pocket",
                            metadata={"purchase_id": pp.id, "package_id": getattr(pkg, "id", None)},
                            postings=[
                                LedgerPosting(request.user, WalletTypes.ADD_MONEY_POCKET, LedgerDirections.DEBIT, total, metadata={"purchase_id": pp.id}),
                                LedgerPosting(system_user, WalletTypes.SYSTEM, LedgerDirections.CREDIT, total, metadata={"counterparty_user_id": request.user.id}),
                            ],
                        )
                    except Exception:
                        pass
                elif wallet_source == "internal":
                    try:
                        from accounts.finance_constants import WalletTypes, FinanceCategories, LedgerDirections
                        from accounts.wallet_engine import WalletEngine, LedgerPosting
                        
                        system_user = WalletEngine.get_system_user()
                        WalletEngine.post_transaction(
                            category=FinanceCategories.PACKAGE_PURCHASE,
                            user=request.user,
                            source_module="PROMO_PURCHASE",
                            source_id=str(pp.id),
                            destination_module=WalletTypes.SYSTEM,
                            gross_amount=total,
                            net_amount=total,
                            idempotency_key=f"promo_purchase_internal_debit:{pp.id}",
                            legacy_wallet_transaction=tx,
                            created_by=request.user,
                            approved_by=request.user,
                            remarks="Promo purchase debit from self package pocket",
                            metadata={"purchase_id": pp.id, "package_id": getattr(pkg, "id", None)},
                            postings=[
                                LedgerPosting(request.user, WalletTypes.SELF_PACKAGE_POCKET, LedgerDirections.DEBIT, total, metadata={"purchase_id": pp.id}),
                                LedgerPosting(system_user, WalletTypes.SYSTEM, LedgerDirections.CREDIT, total, metadata={"counterparty_user_id": request.user.id}),
                            ],
                        )
                    except Exception:
                        pass

            # Wallet-funded purchases use already approved wallet money, so approve immediately.
            # Reuse the admin approval implementation so commissions, matrix jobs,
            # activations, invoices, and idempotency stay identical to the manual review flow.
            approval_resp = AdminPromoPurchaseApproveView().post(request, pk=pp.id)
            if getattr(approval_resp, "status_code", 500) >= 400:
                transaction.set_rollback(True)
                return approval_resp

        pp = PromoPurchase.objects.select_related("package", "user").filter(pk=pp.id).first() or pp
        return Response(PromoPurchaseSerializer(pp, context={"request": request}).data, status=status.HTTP_201_CREATED)


def _promo_package_identity(pkg):
    try:
        if str(getattr(pkg, "type", "") or "").upper() != "PRIME":
            return ""
        code = str(getattr(pkg, "code", "") or "").upper()
        name = str(getattr(pkg, "name", "") or "").upper()
        from decimal import Decimal as D
        price = D(str(getattr(pkg, "price", "0") or "0"))
        if code == "PRIME750" or "PRIME750" in code or "PRIME 750" in name or abs(price - D("750")) <= D("0.5"):
            return "750"
        if code == "PRIME150" or "PRIME150" in code or "PRIME 150" in name or abs(price - D("150")) <= D("0.5"):
            return "150"
        if abs(price - D("759")) <= D("0.75"):
            return "759"
    except Exception:
        return ""
    return ""


def _is_prime_750_package(pkg):
    return _promo_package_identity(pkg) == "750"


def _is_prime_150_package(pkg):
    return _promo_package_identity(pkg) == "150"


class AdminPromoPurchaseListView(APIView):
    """
    GET /api/business/admin/promo/purchases/
    Filters:
      - status=PENDING|APPROVED|REJECTED|CANCELLED (defaults to PENDING)
      - user_id=<int>
      - kind=150|750|759|monthly
        * 150/750: PRIME with price≈150/750
        * 759/monthly: MONTHLY packages
      - date_from=YYYY-MM-DD (requested_at)
      - date_to=YYYY-MM-DD (requested_at)
    """
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]

    def get(self, request):
        from decimal import Decimal as D

        status_in = (request.query_params.get("status") or "PENDING").strip().upper()
        valid = {"PENDING", "APPROVED", "REJECTED", "CANCELLED"}
        qs = PromoPurchase.objects.select_related("user", "user__registered_by", "user__state", "user__city", "package").order_by("-requested_at", "-id")
        if status_in in valid:
            qs = qs.filter(status=status_in)

        # user filter
        uid = (request.query_params.get("user_id") or "").strip()
        if uid.isdigit():
            qs = qs.filter(user_id=int(uid))

        # kind filter
        kind_raw = (request.query_params.get("kind") or "").strip().lower()
        if kind_raw:
            if kind_raw in ("150",):
                qs = qs.filter(package__type="PRIME").filter(
                    Q(package__code__iexact="PRIME150")
                    | Q(package__code__icontains="PRIME150")
                    | Q(package__name__icontains="Prime 150")
                    | Q(package__price__gte=D("149.5"), package__price__lte=D("150.5"))
                )
            elif kind_raw in ("750",):
                qs = qs.filter(package__type="PRIME").filter(
                    Q(package__code__iexact="PRIME750")
                    | Q(package__code__icontains="PRIME750")
                    | Q(package__name__icontains="Prime 750")
                    | Q(package__price__gte=D("749.5"), package__price__lte=D("750.5"))
                )
            elif kind_raw in ("759", "monthly"):
                qs = qs.filter(package__type="MONTHLY")
            # else: ignore unknown kind

        # TRI apps filter (Tri Tour)
        tri_app_slug = (request.query_params.get("tri_app_slug") or "").strip()
        if tri_app_slug:
            qs = qs.filter(tri_app_slug=tri_app_slug)

        # date range on requested_at
        d_from = (request.query_params.get("date_from") or "").strip()
        d_to = (request.query_params.get("date_to") or "").strip()
        if d_from:
            try:
                qs = qs.filter(requested_at__date__gte=d_from)
            except Exception:
                pass
        if d_to:
            try:
                qs = qs.filter(requested_at__date__lte=d_to)
            except Exception:
                pass

        limit, offset = _bounded_limit_offset(request, default=25, max_limit=25)
        qs_page = qs[offset:offset + limit]
        ser = PromoPurchaseSerializer(qs_page, many=True, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)


class AdminPromoPurchaseApproveView(APIView):
    """
    POST /api/business/admin/promo/purchases/<pk>/approve/
    Approve a pending promo purchase. Sets active period:
      - MONTHLY: calendar month (year/month on record) or per-box access (no active window)
      - PRIME: active_from = today; active_to = null
    """
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]

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
        is_prime_150 = _is_prime_150_package(obj.package)
        prime150_choice = str(getattr(obj, "prime150_choice", "") or "").strip().upper()
        ebook_choice = prime150_choice == "EBOOK"
        redeem150_choice = prime150_choice == "REDEEM"

        is_prime_750 = _is_prime_750_package(obj.package)
        prime750_choice = str(getattr(obj, "prime750_choice", "") or "").strip().upper()
        redeem750_choice = prime750_choice == "REDEEM"
        is_prime_759 = str(getattr(obj.package, "type", "")) == "PRIME" and abs(price - D("759")) <= D("0.75")
        # Backend enforcement: PRIME 750 allows only PRODUCT or REDEEM (reject COUPON)
        if is_prime_750 and prime750_choice == "COUPON":
            return Response({"detail": "Invalid choice for PRIME 750. Allowed choices: PRODUCT or REDEEM."}, status=status.HTTP_400_BAD_REQUEST)

        # Allocation rules (updated):
        # - PRIME150 (non‑EBOOK): allocate 150 e‑coupon(s)
        # - PRIME750: allocate 5×150 per unit (based on price/₹150), irrespective of choice
        # - PRIME759 and MONTHLY: do not allocate 150 codes here (handled separately)
        # OVERRIDE: Do not allocate any 150-coupons for PRIME approvals (150/750/759).
        skip_allocation = True
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
            if False and is_prime_759:
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
                # For PRIME 750, rely on policy-driven points in distribute_prime_750_payouts; no extra credit here for PRODUCT.
                # 150 REDEEM: use existing redeem flow (credits configured 150 by default into points)
                if is_prime_150 and redeem150_choice:
                    from business.services.activation import redeem_150 as _redeem_150
                    _redeem_150(obj.user, {"type": "PROMO_150_REDEEM", "id": obj.id})
                    credited_150_redeem = True
                # PRIME 750 REDEEM: credit 750 reward points
                if is_prime_750 and redeem750_choice and not credited_750:
                    from accounts.models import RewardPointsAccount
                    from decimal import Decimal as Dp7
                    RewardPointsAccount.credit_points(
                        obj.user,
                        Dp7("750.00"),
                        reason="PRIME_750",
                        meta={
                            "purchase_id": obj.id,
                            "package": getattr(obj.package, "code", None),
                            "choice": prime750_choice,
                        },
                    )
                    credited_750 = True
            except Exception:
                pass
            # Ensure PRIME 150 adds reward points on approval (e‑book removed)
            try:
                if False and is_prime_150 and not credited_150_redeem:
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
            # Preserve chronology: use original requested_at when available, else now
            approved_ts = getattr(obj, "requested_at", None) or timezone.now()
            obj.approved_by = request.user
            obj.approved_at = approved_ts

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
                        # "First month" = box 1 is being purchased for the first time this season.
                        # We check whether box 1 was already paid BEFORE this transaction.
                        box1_already_paid = PromoMonthlyBox.objects.filter(
                            user=obj.user, package=obj.package, package_number=number, box_number=1
                        ).exclude(purchase=obj).exists()
                        box_tasks = []
                        for idx, b in enumerate(boxes):
                            try:
                                bn = int(b)
                            except Exception:
                                bn = None
                            # is_first = True only when box 1 is included and not previously paid
                            is_first = bool(bn == 1 and not box1_already_paid)
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
                try:
                    obj.active_from = approved_ts.date()
                except Exception:
                    obj.active_from = timezone.localdate()
                obj.active_to = None

            fields_to_update = ["status", "approved_by", "approved_at", "active_from", "active_to"]
            # For PRIME 750 promo with a selected product, set delivery_by = approved_date + 30 days
            try:
                is_prime_750 = _is_prime_750_package(obj.package)
            except Exception:
                is_prime_750 = False
            if is_prime_750:
                from datetime import timedelta
                obj.delivery_by = timezone.localdate() + timedelta(days=30)
                fields_to_update.append("delivery_by")

            obj.save(update_fields=fields_to_update)


            # PRIME promo payouts at approval time (moved to background)
            try:
                from coupons.models import AuditTrail
                distributed = AuditTrail.objects.filter(
                    action="promo_purchase_distributed",
                    metadata__purchase_id=obj.id
                ).exists()
            except Exception:
                distributed = False

            # Ensure PromoProductOrder exists for PRIME 750 PRODUCT choice (synchronous, as before)
            if is_prime_750 and prime750_choice == "PRODUCT":
                try:
                    from .models import PromoProductOrder
                    PromoProductOrder.objects.get_or_create(
                        promo_purchase=obj,
                        defaults={
                            "user": obj.user,
                            "product": getattr(obj, "selected_promo_product", None),
                            "shipping_address": getattr(obj, "shipping_address", ""),
                        },
                    )
                except Exception:
                    pass

            # Offload PRIME 150/750/759 payouts/matrix to background worker
            if not distributed and (is_prime_150 or is_prime_750 or is_prime_759):
                try:
                    transaction.on_commit(lambda: BackgroundTask.enqueue(
                        "promo_approve_payouts",
                        payload={"purchase_id": obj.id, "reviewer_id": getattr(request.user, "id", None)},
                        idempotency_key=f"promo_approve:{obj.id}",
                    ))
                except Exception:
                    pass

            # Activate account on any promo package approval (e.g., 150, 750, 759)
            try:
                from .services.activation import activate_150_active, ensure_first_purchase_activation
                from jobs.models import enqueue_prime_150_units
                src = {"type": "promo_purchase", "id": obj.id}
                activated150_active = False
                activated50 = False
                prime_units_enqueued = False


                # Decide 150 activations by package type
                is_prime_pkg = str(getattr(obj.package, "type", "") or "") == "PRIME"
                is_monthly_pkg = str(getattr(obj.package, "type", "") or "") == "MONTHLY"
                is_prime_150_now = _is_prime_150_package(obj.package)
                is_prime_750_now = _is_prime_750_package(obj.package)

                if is_prime_150_now:
                    # Do not auto-activate 150 on promo approval.
                    # Allocation: 1x ₹150 e‑coupon is provided and commissions will run on coupon activation.
                    activated150_active = False
                elif is_prime_750_now:
                    # PRIME 750: do not auto-activate 150 here; payouts handled by promo approval engine
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

            try:
                from .invoices import ensure_invoice_for_purchase
                transaction.on_commit(lambda: ensure_invoice_for_purchase(obj))
            except Exception:
                pass

        return Response(PromoPurchaseSerializer(obj, context={"request": request}).data, status=status.HTTP_200_OK)


class PrimePackageInvoiceListView(APIView):
    """List invoices for the logged-in consumer's approved Prime package purchases."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .invoices import ensure_invoice_for_purchase, invoice_payload
        from .models import PackageInvoice, PromoPurchase

        purchases = PromoPurchase.objects.select_related("user", "user__city", "user__state", "package").filter(
            user=request.user,
            status="APPROVED",
            package__type="PRIME",
        ).order_by("-approved_at", "-id")[:200]

        for purchase in purchases:
            try:
                ensure_invoice_for_purchase(purchase)
            except Exception:
                pass

        invoices = PackageInvoice.objects.filter(promo_purchase__user=request.user).select_related(
            "promo_purchase", "promo_purchase__package"
        ).order_by("-invoice_date", "-id")[:200]
        return Response([invoice_payload(inv) for inv in invoices], status=status.HTTP_200_OK)


class PrimePackageInvoicePdfView(APIView):
    """Download one logged-in consumer Prime package invoice as PDF."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk: int):
        from .invoices import invoice_html
        from .models import PackageInvoice

        inv = PackageInvoice.objects.filter(pk=pk, promo_purchase__user=request.user).select_related("promo_purchase").first()
        if not inv:
            return Response({"detail": "Invoice not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            from xhtml2pdf import pisa
            from accounts.views import _xhtml2pdf_link_callback
        except Exception:
            return Response({"detail": "PDF engine is not available."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        pdf_io = BytesIO()
        try:
            result = pisa.CreatePDF(src=invoice_html(inv), dest=pdf_io, link_callback=_xhtml2pdf_link_callback)
        except Exception:
            result = None
        if not result or getattr(result, "err", False):
            # Retry without logo/image references; broken static/media paths should not block invoice download.
            pdf_io = BytesIO()
            try:
                result = pisa.CreatePDF(src=invoice_html(inv, include_logo=False), dest=pdf_io, link_callback=_xhtml2pdf_link_callback)
            except Exception:
                result = None
        if not result or getattr(result, "err", False):
            return Response({"detail": "Failed to generate invoice PDF. Please check invoice logo/static file configuration."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        filename = f"Trikonekt_Invoice_{inv.invoice_number.replace('/', '_')}.pdf"
        resp = HttpResponse(pdf_io.getvalue(), content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp


class AdminPromoPurchaseRejectView(APIView):
    """
    POST /api/business/admin/promo/purchases/<pk>/reject/
    Body: { "reason": "optional" }
    """
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]

    def post(self, request, pk: int):
        obj = PromoPurchase.objects.select_related("package", "user").filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if obj.status != "PENDING":
            return Response({"detail": "Only PENDING purchases can be rejected."}, status=status.HTTP_400_BAD_REQUEST)

        # If paid from internal wallet, refund immediately on rejection (best-effort, idempotent).
        try:
            if getattr(obj, "payment_mode", "MANUAL") == "WALLET" and not getattr(obj, "wallet_refund_tx_id", None):
                from accounts.models import Wallet, WalletTransaction
                from decimal import Decimal as D
                w = Wallet.get_or_create_for_user(obj.user)
                amt = D(str(getattr(obj, "amount_paid", "0") or "0"))
                if amt > 0:
                    # Credit internal wallet back. Keep source_type/source_id for audit.
                    w.credit(
                        amt,
                        tx_type="INTERNAL_WALLET_CREDIT",
                        meta={"reason": "PROMO_PURCHASE_REJECT_REFUND", "purchase_id": obj.id},
                        source_type="PROMO_PURCHASE_REFUND",
                        source_id=str(obj.id),
                    )
                    tx = WalletTransaction.objects.filter(
                        user=obj.user,
                        type="INTERNAL_WALLET_CREDIT",
                        source_type="PROMO_PURCHASE_REFUND",
                        source_id=str(obj.id),
                    ).order_by("-id").first()
                    if tx:
                        obj.wallet_refund_tx = tx
                        obj.save(update_fields=["wallet_refund_tx"])
        except Exception:
            pass

        reason = str((request.data or {}).get("reason") or "").strip()
        obj.status = "REJECTED"
        if reason:
            obj.remarks = ((obj.remarks or "") + (("\n" if obj.remarks else "") + f"Rejected: {reason}"))[:2000]
        obj.approved_by = request.user
        obj.approved_at = timezone.now()
        obj.save(update_fields=["status", "remarks", "approved_by", "approved_at"])
        return Response(PromoPurchaseSerializer(obj, context={"request": request}).data, status=status.HTTP_200_OK)


class AdminProductOrdersListView(APIView):
    """
    GET /api/business/admin/promo/product-orders/?status=PENDING|DISPATCHED|CANCELLED&from=YYYY-MM-DD&to=YYYY-MM-DD&user_id=PK
    Admin-only listing for Promo 750 PRODUCT orders (Inventory/Dispatch queue).
    """
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]

    def get(self, request):
        status_in = (request.query_params.get("status") or "").strip().upper()
        valid = {"PENDING", "DISPATCHED", "CANCELLED"}
        qs = (
            PromoProductOrder.objects
            .select_related("promo_purchase", "user", "product", "promo_purchase__package")
            .order_by("-created_at", "-id")
        )
        if status_in in valid:
            qs = qs.filter(status=status_in)
        uid = request.query_params.get("user_id")
        if uid:
            try:
                qs = qs.filter(user_id=int(uid))
            except Exception:
                pass
        d_from = request.query_params.get("from")
        d_to = request.query_params.get("to")
        if d_from:
            try:
                qs = qs.filter(created_at__date__gte=d_from)
            except Exception:
                pass
        if d_to:
            try:
                qs = qs.filter(created_at__date__lte=d_to)
            except Exception:
                pass
        limit, offset = _bounded_limit_offset(request, default=25, max_limit=25)
        qs_page = qs[offset:offset + limit]
        ser = PromoProductOrderSerializer(qs_page, many=True, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)


class Prime750PreviewView(APIView):
    """
    GET /api/business/promo/prime750/preview/?choice=REDEEM|PRODUCT[&quantity=1]
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
        else:
            return Response({"detail": "Invalid or missing choice. Use REDEEM or PRODUCT."}, status=status.HTTP_400_BAD_REQUEST)

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
# Root Consumer Admin (set/get)
# =======================
class AdminRootConsumerView(APIView):
    """
    GET /api/business/admin/root-consumer/ -> {user: {id, username, prefixed_id}} or {user: null}
    POST /api/business/admin/root-consumer/ { "user_id": PK }
      - Sets the singleton RootConsumerConfig.root_user to the given consumer user.
      - Validations:
          * Must be category='consumer'
          * Must NOT be staff or superuser
    """
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        try:
            from .models import RootConsumerConfig
            cfg = RootConsumerConfig.get_solo()
            u = cfg.get_root_user()
            if not u:
                return Response({"user": None}, status=status.HTTP_200_OK)
            return Response({"user": {"id": u.id, "username": u.username, "prefixed_id": getattr(u, "prefixed_id", None)}}, status=status.HTTP_200_OK)
        except Exception:
            return Response({"user": None}, status=status.HTTP_200_OK)

    def post(self, request):
        uid = request.data.get("user_id")
        if uid is None:
            return Response({"detail": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from accounts.models import CustomUser
            user = CustomUser.objects.get(pk=int(uid))
        except Exception:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Validate consumer + non-staff/non-superuser
        cat = (getattr(user, "category", "") or "").lower()
        if cat != "consumer" or getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            return Response({"detail": "Root Consumer must be a non-staff, non-superuser consumer."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from .models import RootConsumerConfig
            cfg = RootConsumerConfig.get_solo()
            cfg.root_user = user
            cfg.save(update_fields=["root_user", "updated_at"])
        except Exception:
            return Response({"detail": "Failed to set Root Consumer."}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"user": {"id": user.id, "username": user.username, "prefixed_id": getattr(user, "prefixed_id", None)}}, status=status.HTTP_200_OK)


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
        # Admin override: allow listing catalog for a specific agency via ?agency_id=PK
        target_user = request.user
        agency_id = request.query_params.get("agency_id")
        if agency_id and (getattr(request.user, "is_staff", False) or getattr(request.user, "is_superuser", False)):
            try:
                from accounts.models import CustomUser
                target_user = CustomUser.objects.get(pk=int(agency_id))
            except Exception:
                return Response([], status=status.HTTP_200_OK)

        # Must be an agency account (target)
        try:
            role = str(getattr(target_user, "role", "") or "").lower()
            cat = str(getattr(target_user, "category", "") or "").lower()
            is_agency = (role == "agency") or cat.startswith("agency")
        except Exception:
            is_agency = False
        if not is_agency:
            # No catalog for other categories
            return Response([], status=status.HTTP_200_OK)

        # Determine allowed prefix by category
        prefix = None
        try:
            mapping = {
                "agency_sub_franchise": "AG_SF",
                "agency_pincode": "AG_PIN",
                "agency_pincode_coordinator": "AG_PIN_CRD",
                "agency_state_coordinator": "AG_ST_CRD",
                "agency_state": "AG_ST",
                "agency_district_coordinator": "AG_DST_CRD",
                "agency_district": "AG_DST",
            }
            prefix = mapping.get(cat)
        except Exception:
            prefix = None

        if not prefix:
            # No catalog for other categories
            return Response([], status=status.HTTP_200_OK)

        # Query allowed active packages and compute assigned flag
        base_qs = Package.objects.filter(is_active=True)
        if prefix in {"AG_PIN", "AG_DST", "AG_ST"}:
            # Exclude coordinator variants for base roles, e.g., AG_PIN should not see AG_PIN_CRD*
            pkgs_qs = (
                base_qs.filter(code__istartswith=prefix)
                .exclude(code__istartswith=f"{prefix}_CRD")
                .order_by("amount", "code")
            )
        elif prefix in {"AG_PIN_CRD", "AG_DST_CRD", "AG_ST_CRD"}:
            # Coordinators see only their CRD-prefixed packages
            pkgs_qs = base_qs.filter(code__istartswith=prefix).order_by("amount", "code")
        else:
            # Other categories (e.g., AG_SF) retain simple prefix filter
            pkgs_qs = base_qs.filter(code__istartswith=prefix).order_by("amount", "code")
        pkg_ids = list(pkgs_qs.values_list("id", flat=True))
        assigned_ids = set(
            AgencyPackageAssignment.objects.filter(agency=target_user, package_id__in=pkg_ids).values_list("package_id", flat=True)
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

        # Auto-assign default packages to the target agency if missing (category-scoped)
        # Requirement: packages should be visible by default right after registering.
        # Strategy:
        #   1) Prefer is_default=True packages matching the category prefix.
        #   2) If none configured, fall back to a single best candidate for that prefix:
        #      - Prefer code containing "PRIME" (case-insensitive), lowest amount first
        #      - Else pick the lowest-amount package for that prefix
        try:
            # Determine category->prefix mapping similar to AgencyPackageCatalogView
            cat = str(getattr(target_user, "category", "") or "").lower()
            mapping = {
                "agency_sub_franchise": "AG_SF",
                "agency_pincode": "AG_PIN",
                "agency_pincode_coordinator": "AG_PIN_CRD",
                "agency_state_coordinator": "AG_ST_CRD",
                "agency_state": "AG_ST",
                "agency_district_coordinator": "AG_DST_CRD",
                "agency_district": "AG_DST",
            }
            pref = mapping.get(cat)

            base_defaults = Package.objects.filter(is_active=True, is_default=True)
            if pref in {"AG_PIN", "AG_DST", "AG_ST"}:
                # Base roles should not get coordinator default packages
                defaults_qs = (
                    base_defaults.filter(code__istartswith=pref)
                    .exclude(code__istartswith=f"{pref}_CRD")
                )
            elif pref in {"AG_PIN_CRD", "AG_DST_CRD", "AG_ST_CRD"}:
                # Coordinators get only their CRD-prefixed defaults
                defaults_qs = base_defaults.filter(code__istartswith=pref)
            elif pref in {"AG_SF"}:
                defaults_qs = base_defaults.filter(code__istartswith=pref)
            else:
                # Fallback to previous behavior (assign all defaults) to avoid breaking existing flows
                defaults_qs = base_defaults

            default_packages = list(defaults_qs)

            # If no explicit defaults exist for this category, pick a best-effort fallback
            if not default_packages and pref:
                base_qs = Package.objects.filter(is_active=True, code__istartswith=pref)
                if pref in {"AG_PIN", "AG_DST", "AG_ST"}:
                    base_qs = base_qs.exclude(code__istartswith=f"{pref}_CRD")
                # Prefer variant codes (exclude bare prefix) where possible
                variants_qs = base_qs.exclude(code__iexact=pref)
                # Prefer "PRIME" in code or name among variants
                prime_variants = variants_qs.filter(Q(code__icontains="PRIME") | Q(name__icontains="PRIME"))
                candidate = prime_variants.order_by("amount", "code").first() or variants_qs.order_by("amount", "code").first()
                if not candidate:
                    # fallback to any base_qs with PRIME in code/name, else any by lowest amount
                    prime_any = base_qs.filter(Q(code__icontains="PRIME") | Q(name__icontains="PRIME")).order_by("amount", "code").first()
                    candidate = prime_any or base_qs.order_by("amount", "code").first()
                if candidate:
                    default_packages = [candidate]

            if default_packages:
                pkg_ids = [p.id for p in default_packages]
                existing_pkg_ids = set(
                    AgencyPackageAssignment.objects.filter(agency=target_user, package_id__in=pkg_ids).values_list("package_id", flat=True)
                )
                to_create = [AgencyPackageAssignment(agency=target_user, package=p) for p in default_packages if p.id not in existing_pkg_ids]
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

        include_inactive = str(request.query_params.get("include_inactive") or "").lower() in {"1", "true", "yes"}
        qs = (
            AgencyPackageAssignment.objects
            .filter(agency=target_user)
            .select_related("package")
            .prefetch_related("payments")
        )
        # Hide inactive packages by default for all users (including staff) unless explicitly requested
        if not include_inactive:
            qs = qs.filter(package__is_active=True)
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
            mapping = {
                "agency_sub_franchise": "AG_SF",
                "agency_pincode": "AG_PIN",
                "agency_pincode_coordinator": "AG_PIN_CRD",
                "agency_district": "AG_DST",
                "agency_district_coordinator": "AG_DST_CRD",
                "agency_state": "AG_ST",
                "agency_state_coordinator": "AG_ST_CRD",
            }
            pref = mapping.get(cat)
            code_val = str(getattr(pkg, "code", "") or "").upper()
            if pref:
                if pref in {"AG_PIN", "AG_DST", "AG_ST"}:
                    # Base roles cannot select coordinator variants
                    if (not code_val.startswith(pref)) or code_val.startswith(f"{pref}_CRD"):
                        return Response({"detail": "Package not allowed for your category."}, status=status.HTTP_403_FORBIDDEN)
                else:
                    # Coordinators and AG_SF must match exact category prefix
                    if not code_val.startswith(pref):
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

class AdminAssignAgencyPackageView(APIView):
    """
    POST /api/business/admin/agency-packages/assign/
    Body: { "agency_id": PK, "package_id": PK }
    Admin-only: ensure an assignment exists for the target agency and package.
    """
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]

    def post(self, request):
        agency_id = request.data.get("agency_id")
        package_id = request.data.get("package_id")
        if agency_id is None or package_id is None:
            return Response({"detail": "agency_id and package_id are required."}, status=status.HTTP_400_BAD_REQUEST)
        # Load target agency
        try:
            from accounts.models import CustomUser
            target_user = CustomUser.objects.get(pk=int(agency_id))
        except Exception:
            return Response({"detail": "Agency not found."}, status=status.HTTP_404_NOT_FOUND)

        # Validate agency role/category
        try:
            role = str(getattr(target_user, "role", "") or "").lower()
            cat = str(getattr(target_user, "category", "") or "").lower()
            is_agency = (role == "agency") or cat.startswith("agency")
        except Exception:
            is_agency = False
        if not is_agency:
            return Response({"detail": "Target user is not an agency account."}, status=status.HTTP_400_BAD_REQUEST)

        # Load package
        try:
            pkg = Package.objects.get(pk=int(package_id), is_active=True)
        except Exception:
            return Response({"detail": "Package not found or inactive."}, status=status.HTTP_404_NOT_FOUND)

        # Enforce category/prefix compatibility
        try:
            mapping = {
                "agency_sub_franchise": "AG_SF",
                "agency_pincode": "AG_PIN",
                "agency_pincode_coordinator": "AG_PIN_CRD",
                "agency_state_coordinator": "AG_ST_CRD",
                "agency_state": "AG_ST",
                "agency_district_coordinator": "AG_DST_CRD",
                "agency_district": "AG_DST",
            }
            pref = mapping.get(cat)
            if pref:
                code_val = str(getattr(pkg, "code", "") or "")
                if not code_val.upper().startswith(pref.upper()):
                    return Response({"detail": "Package not allowed for this agency category."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            pass

        # Ensure assignment
        try:
            assignment, _ = AgencyPackageAssignment.objects.get_or_create(agency=target_user, package=pkg)
        except Exception:
            return Response({"detail": "Failed to assign package."}, status=status.HTTP_400_BAD_REQUEST)

        ser = AgencyPackageAssignmentSerializer(assignment)
        return Response(ser.data, status=status.HTTP_201_CREATED)

class AdminCreateAgencyPackagePaymentView(APIView):
    """
    POST /api/business/agency-packages/{pk}/payments/
    Body: { "amount": <number>, "reference": "optional", "notes": "optional" }
    Admin-only: records a payment against an agency's package assignment.
    """
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]

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
        # First-payment activation: if this is the first payment for this assignment, activate the account
        try:
            from decimal import Decimal as D
            if (paid_sum or D("0")) == D("0") and (amount or D("0")) > D("0"):
                # Mark user active (green in admin list)
                try:
                    if not bool(getattr(assignment.agency, "account_active", False)):
                        assignment.agency.account_active = True
                        assignment.agency.save(update_fields=["account_active"])
                except Exception:
                    pass
                # Stamp first purchase activation flags (idempotent)
                try:
                    from .services.activation import ensure_first_purchase_activation
                    ensure_first_purchase_activation(
                        assignment.agency,
                        {"type": "agency_prime_first_payment_admin", "assignment_id": assignment.id, "payment_id": pay.id},
                    )
                except Exception:
                    pass
        except Exception:
            # best-effort; do not block admin payment if activation hook fails
            pass
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
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]

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
        agency_id = request.query_params.get("agency_id")
        if agency_id:
            try:
                qs = qs.filter(agency_id=int(agency_id))
            except Exception:
                pass
        limit, offset = _bounded_limit_offset(request, default=25, max_limit=25)
        qs_page = qs[offset:offset + limit]
        ser = AgencyPackagePaymentRequestSerializer(qs_page, many=True, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)


class AdminApproveAgencyPaymentRequestView(APIView):
    """
    POST /api/business/admin/agency-packages/payment-requests/<pk>/approve/
    Body: { "admin_notes": "optional" }
    Marks the request APPROVED and stamps approver. Payment row creation is handled by model signal.
    """
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]

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
                        # First-payment activation: if this is the first approved payment for this assignment, activate account
                        try:
                            if (paid_sum or D("0")) == D("0") and (pay_amount or D("0")) > D("0"):
                                # Mark user active (green in admin list)
                                try:
                                    if not bool(getattr(obj.agency, "account_active", False)):
                                        obj.agency.account_active = True
                                        obj.agency.save(update_fields=["account_active"])
                                except Exception:
                                    pass
                                # Stamp first purchase activation flags (idempotent)
                                try:
                                    from .services.activation import ensure_first_purchase_activation
                                    ensure_first_purchase_activation(obj.agency, {"type": "agency_prime_first_payment", "id": obj.id})
                                except Exception:
                                    pass
                        except Exception:
                            # best-effort; do not block approval if activation hook fails
                            pass
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
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("promo")]

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
        limit, offset = _bounded_limit_offset(request, default=25, max_limit=25)
        qs_page = qs[offset:offset + limit]

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
            for r in qs_page:
                writer.writerow([
                    r.date, getattr(r.reporter, "username", ""), r.role,
                    r.tr_registered, r.wg_registered, r.asia_pay_registered, r.dm_account_registered,
                    r.e_coupon_issued, r.physical_coupon_issued, r.product_sold, r.total_amount,
                ])
            return resp

        ser = DailyReportSerializer(qs_page, many=True)
        return Response(ser.data, status=status.HTTP_200_OK)


# ==============================
# TRI Apps (Holidays, EV, etc.) — Endpoints
# ==============================
class TriAppListView(APIView):
    """
    GET /api/business/tri/apps/
    List active TRI apps with capability flags and banner URL.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = TriApp.objects.filter(is_active=True).order_by("sort_order", "slug")
        ser = TriAppSerializer(qs, many=True, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)


class TriAppDetailView(APIView):
    """
    GET /api/business/tri/apps/<slug>/
    Retrieve a TRI app with active products (image URLs) and admin-controlled flags:
      - allow_price, allow_add_to_cart, allow_payment
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        obj = TriApp.objects.filter(slug=slug, is_active=True).first()
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = TriAppSerializer(obj, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)


# ==============================
# Admin TRI Apps CRUD
# ==============================
from rest_framework.parsers import MultiPartParser, FormParser

class AdminTriAppListCreate(APIView):
    """
    Admin-only CRUD for TRI Apps (categories grid source).
    GET /api/business/admin/tri/apps/
    POST /api/business/admin/tri/apps/ (multipart: slug, name, description?, is_active?, allow_*?, banner_image?)
    """
    permission_classes = [IsAdminOrStaff]
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request):
        qs = TriApp.objects.all().order_by("sort_order", "slug")
        out = []
        for obj in qs:
            try:
                banner_url = None
                f = getattr(obj, "banner_image", None)
                if f:
                    url = f.url
                    banner_url = request.build_absolute_uri(url) if (request and not str(url).startswith("http")) else url
            except Exception:
                banner_url = None
            try:
                icon_url = None
                f2 = getattr(obj, "icon", None)
                if f2:
                    url2 = f2.url
                    icon_url = request.build_absolute_uri(url2) if (request and not str(url2).startswith("http")) else url2
            except Exception:
                icon_url = None
            out.append({
                "id": obj.id,
                "slug": obj.slug,
                "name": obj.name,
                "description": obj.description or "",
                "is_active": bool(obj.is_active),
                "allow_price": bool(obj.allow_price),
                "allow_add_to_cart": bool(obj.allow_add_to_cart),
                "allow_payment": bool(obj.allow_payment),
                "sort_order": int(getattr(obj, "sort_order", 0) or 0),
                "banner_url": banner_url,
                "icon_url": icon_url,
            })
        return Response(out, status=status.HTTP_200_OK)

    def post(self, request):
        slug = str(request.data.get("slug") or "").strip()
        name = str(request.data.get("name") or "").strip()
        description = str(request.data.get("description") or "").strip()
        is_active = str(request.data.get("is_active") or "true").strip().lower() in ("1", "true", "yes")
        allow_price = str(request.data.get("allow_price") or "false").strip().lower() in ("1", "true", "yes")
        allow_add_to_cart = str(request.data.get("allow_add_to_cart") or "false").strip().lower() in ("1", "true", "yes")
        allow_payment = str(request.data.get("allow_payment") or "false").strip().lower() in ("1", "true", "yes")
        banner = request.FILES.get("banner_image") or request.FILES.get("banner")
        # optional fields
        try:
            sort_order = int(str(request.data.get("sort_order") or 0) or 0)
        except Exception:
            sort_order = 0
        icon = request.FILES.get("icon")

        if not slug or not name:
            return Response({"slug": ["slug is required."], "name": ["name is required."]}, status=status.HTTP_400_BAD_REQUEST)

        if TriApp.objects.filter(slug__iexact=slug).exists():
            return Response({"slug": ["slug must be unique."]}, status=status.HTTP_400_BAD_REQUEST)

        obj = TriApp.objects.create(
            slug=slug,
            name=name,
            description=description,
            is_active=is_active,
            allow_price=allow_price,
            allow_add_to_cart=allow_add_to_cart,
            allow_payment=allow_payment,
            sort_order=sort_order,
            banner_image=banner,
            icon=icon,
        )
        return Response({"id": obj.id, "slug": obj.slug, "name": obj.name}, status=status.HTTP_201_CREATED)


class AdminTriAppDetail(APIView):
    """
    Admin-only: GET/PATCH/DELETE /api/business/admin/tri/apps/<int:pk>/
    """
    permission_classes = [IsAdminOrStaff]
    parser_classes = (MultiPartParser, FormParser)

    def get_object(self, pk: int):
        return TriApp.objects.filter(pk=pk).first()

    def get(self, request, pk: int):
        obj = self.get_object(pk)
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            f = getattr(obj, "banner_image", None)
            url = f.url if f else None
            banner_url = request.build_absolute_uri(url) if (request and url and not str(url).startswith("http")) else url
        except Exception:
            banner_url = None
        try:
            f2 = getattr(obj, "icon", None)
            url2 = f2.url if f2 else None
            icon_url = request.build_absolute_uri(url2) if (request and url2 and not str(url2).startswith("http")) else url2
        except Exception:
            icon_url = None
        return Response({
            "id": obj.id,
            "slug": obj.slug,
            "name": obj.name,
            "description": obj.description or "",
            "is_active": bool(obj.is_active),
            "allow_price": bool(obj.allow_price),
            "allow_add_to_cart": bool(obj.allow_add_to_cart),
            "allow_payment": bool(obj.allow_payment),
            "sort_order": int(getattr(obj, "sort_order", 0) or 0),
            "banner_url": banner_url,
            "icon_url": icon_url,
        }, status=status.HTTP_200_OK)

    def patch(self, request, pk: int):
        obj = self.get_object(pk)
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        fields = ("slug", "name", "description", "is_active", "allow_price", "allow_add_to_cart", "allow_payment")
        for f in fields:
            if f in request.data:
                val = request.data.get(f)
                if f in ("is_active", "allow_price", "allow_add_to_cart", "allow_payment"):
                    val = str(val).strip().lower() in ("1", "true", "yes")
                setattr(obj, f, val if f != "description" else (val or ""))
        if "sort_order" in request.data:
            try:
                obj.sort_order = int(str(request.data.get("sort_order") or 0))
            except Exception:
                pass
        banner = request.FILES.get("banner_image") or request.FILES.get("banner")
        if banner is not None:
            obj.banner_image = banner
        icon = request.FILES.get("icon")
        if icon is not None:
            obj.icon = icon
        obj.save()
        return Response({"id": obj.id, "slug": obj.slug, "name": obj.name}, status=status.HTTP_200_OK)

    def delete(self, request, pk: int):
        obj = self.get_object(pk)
        if not obj:
            return Response(status=status.HTTP_204_NO_CONTENT)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

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
    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("withdrawals")]

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


# ==============================
# Matrix Tree API (Entry-based, read-only)
# ==============================
class MatrixTreeView(APIView):
    """
    GET /api/business/matrix/tree/?pool_type=FIVE_150[&start_entry_id=ID][&display_user_id=ID][&max_nodes=1000][&max_depth=N]
    Rules:
      - Build tree strictly from AutoPoolAccount structure (id, parent_account, level, position, status, pool_type)
      - No writes/side-effects
      - If start_entry_id missing, resolve UI head:
          * display_user_id (if provided) -> earliest ACTIVE entry for that user
          * else default display_user_id=32 -> earliest ACTIVE entry for user 32
          * fallback to sentinel root if none
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from business.services.structure import build_tree, get_display_start_entry
        pool_type = (request.query_params.get("pool_type") or "FIVE_150").strip().upper()
        start_entry_id = request.query_params.get("start_entry_id")
        display_user_id = request.query_params.get("display_user_id")

        # Parse bounds
        try:
            max_nodes = int(request.query_params.get("max_nodes", 1000) or 1000)
            if max_nodes <= 0:
                max_nodes = 1000
            max_nodes = min(max_nodes, 5000)
        except Exception:
            max_nodes = 1000
        try:
            max_depth_param = request.query_params.get("max_depth")
            max_depth = int(max_depth_param) if max_depth_param is not None else None
        except Exception:
            max_depth = None

        # Start id resolution
        start_id = None
        if start_entry_id is not None:
            try:
                start_id = int(start_entry_id)
            except Exception:
                start_id = None
        if start_id is None:
            # Default UI head resolution: user 32 by default (override via display_user_id)
            try:
                disp_id = int(display_user_id) if display_user_id is not None else 32
            except Exception:
                disp_id = None
            start_id = get_display_start_entry(pool_type, disp_id)

        data = build_tree(pool_type, start_entry_id=start_id, max_nodes=max_nodes, max_depth=max_depth)
        return Response(data, status=status.HTTP_200_OK)


# ==============================
# Admin: Enforce Single Sentinel Root (per pool)
# ==============================
class AdminMatrixEnforceSentinelView(APIView):
    """
    POST /api/business/admin/matrix/enforce-sentinel/
    Body or query: { "pool_type": "FIVE_150" }
    Ensures exactly one sentinel structural root (reattaches extras). Read-only otherwise.
    """
    permission_classes = [IsAdminOrStaff]

    def post(self, request):
        from business.services.structure import enforce_single_sentinel
        pool_type = (request.data.get("pool_type") or request.query_params.get("pool_type") or "FIVE_150").strip().upper()
        sentinel = enforce_single_sentinel(pool_type)
        return Response({"sentinel_id": int(getattr(sentinel, "id", 0) or 0), "pool_type": pool_type}, status=status.HTTP_200_OK)
