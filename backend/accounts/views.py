from rest_framework import generics
from rest_framework.pagination import PageNumberPagination, CursorPagination
from .models import (
    CustomUser,
    AgencyRegionAssignment,
    Wallet,
    WalletTransaction,
    ConsumerVoucher,
    SupportTicket,
    SupportTicketMessage,
    UserNominee,
    WalletUploadRequest,
)
from .serializers import (
    RegisterSerializer,
    PublicUserSerializer,
    UserKYCSerializer,
    WithdrawalRequestSerializer,
    ProfileMeSerializer,
    SupportTicketSerializer,
    SupportTicketMessageSerializer,
    UserNomineeSerializer,
    WalletUploadRequestSerializer,
    WalletUploadRequestCreateSerializer,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from adminapi.permissions import IsAdminOrStaff, HasAdminModuleAccess
from rest_framework_simplejwt.views import TokenObtainPairView
from .token_serializers import CustomTokenObtainPairSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers, parsers
from rest_framework.exceptions import NotFound
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db.models import Q, Sum, Count
from django.db import transaction
from locations.views import _build_district_index, india_place_variants
from locations.models import State
from django.http import HttpResponse
from django.conf import settings
from django.utils import timezone
from django.core.cache import cache
from django.core.mail import send_mail
from django.contrib.staticfiles import finders
from io import BytesIO
from datetime import timedelta
import random
import os
try:
    from xhtml2pdf import pisa
except Exception:
    pisa = None  # type: ignore


# ==================================
# Wallet Upload Requests (User + Admin)
# ==================================


class WalletUploadRequestCreateView(APIView):
    """User submits a wallet upload request for admin approval.

    POST /api/accounts/wallet/upload-requests/
    body: multipart/form-data { amount, utr, proof(file), remarks? }

    Credits are NOT applied immediately.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def post(self, request):
        ser = WalletUploadRequestCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        obj = WalletUploadRequest.objects.create(
            user=request.user,
            amount=ser.validated_data.get("amount"),
            utr=ser.validated_data.get("utr"),
            proof=ser.validated_data.get("proof"),
            remarks=ser.validated_data.get("remarks", ""),
            status="PENDING",
        )
        return Response(
            WalletUploadRequestSerializer(obj, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class AdminWalletUploadRequestListView(APIView):
    """Admin list of wallet upload requests.

    GET /api/accounts/admin/wallet/upload-requests/?status=PENDING
    """

    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("reports_finance")]

    def get(self, request):
        qs = WalletUploadRequest.objects.select_related("user", "decided_by").order_by("-requested_at", "-id")
        st = (request.query_params.get("status") or "").strip().upper()
        if st in ("PENDING", "APPROVED", "REJECTED"):
            qs = qs.filter(status=st)
        data = WalletUploadRequestSerializer(qs[:500], many=True, context={"request": request}).data
        return Response(data, status=status.HTTP_200_OK)


class AdminWalletUploadRequestApproveView(APIView):
    """Approve a request and credit INTERNAL wallet pocket.

    POST /api/accounts/admin/wallet/upload-requests/<id>/approve/
    """

    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("reports_finance")]

    def post(self, request, pk: int):
        from decimal import Decimal
        from django.utils import timezone as _tz
        from django.db import transaction as _tx

        with _tx.atomic():
            obj = WalletUploadRequest.objects.select_for_update().select_related("user").filter(pk=pk).first()
            if not obj:
                return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
            if obj.status == "APPROVED":
                return Response(WalletUploadRequestSerializer(obj, context={"request": request}).data)
            if obj.status != "PENDING":
                return Response({"detail": "Only PENDING requests can be approved."}, status=status.HTTP_400_BAD_REQUEST)

            w = Wallet.get_or_create_for_user(obj.user)
            w = Wallet.objects.select_for_update().get(pk=w.pk)

            amt = Decimal(str(obj.amount or 0))
            if amt <= 0:
                return Response({"detail": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)

            w.balance = (w.balance or Decimal("0")) + amt
            w.save(update_fields=["balance", "updated_at"])

            tx = WalletTransaction.objects.create(
                user=obj.user,
                amount=amt,
                balance_after=w.balance,
                type="INTERNAL_WALLET_CREDIT",
                source_type="WALLET_UPLOAD",
                source_id=str(obj.id),
                meta={"wallet_upload_request_id": obj.id, "utr": obj.utr},
            )

            obj.status = "APPROVED"
            obj.decided_by = request.user
            obj.decided_at = _tz.now()
            obj.wallet_transaction = tx
            obj.reject_reason = ""
            obj.save(update_fields=["status", "decided_by", "decided_at", "wallet_transaction", "reject_reason"])

        return Response(WalletUploadRequestSerializer(obj, context={"request": request}).data, status=status.HTTP_200_OK)


class AdminWalletUploadRequestRejectView(APIView):
    """Reject a wallet upload request.

    POST /api/accounts/admin/wallet/upload-requests/<id>/reject/ { reason?: string }
    """

    permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("reports_finance")]

    def post(self, request, pk: int):
        from django.utils import timezone as _tz
        from django.db import transaction as _tx

        reason = str((request.data or {}).get("reason") or "").strip()
        with _tx.atomic():
            obj = WalletUploadRequest.objects.select_for_update().filter(pk=pk).first()
            if not obj:
                return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
            if obj.status == "REJECTED":
                return Response(WalletUploadRequestSerializer(obj, context={"request": request}).data)
            if obj.status != "PENDING":
                return Response({"detail": "Only PENDING requests can be rejected."}, status=status.HTTP_400_BAD_REQUEST)
            obj.status = "REJECTED"
            obj.decided_by = request.user
            obj.decided_at = _tz.now()
            obj.reject_reason = reason
            obj.save(update_fields=["status", "decided_by", "decided_at", "reject_reason"])
        return Response(WalletUploadRequestSerializer(obj, context={"request": request}).data, status=status.HTTP_200_OK)


class RegisterView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def perform_create(self, serializer):
        """
        Create the user and send a welcome email containing the username
        to the registered email address. Make email non-blocking and
        skip when mailing is not enabled, to avoid worker timeouts.
        """
        user = serializer.save()

        # Defer referral/franchise payouts until first activation; no payouts on registration
        # Intentionally removed calls to referral.on_user_join and franchise.distribute_franchise_benefit here.

        # Defer and guard email to avoid blocking the request thread
        try:
            from django.conf import settings
            from django.core.mail import send_mail
            from threading import Thread
            from django.db import transaction
            import logging
            logger = logging.getLogger(__name__)

            recipient = getattr(user, "email", None)
            if not recipient or not getattr(settings, "MAIL_ENABLED", False):
                return

            full_name = getattr(user, "full_name", "") or ""
            raw_password = str(getattr(self.request, "data", {}).get("password") or "")
            subject = "Welcome to Trikonekt - Your account details"
            message = (
                f"Hello {full_name or 'there'},\n\n"
                "Welcome to Trikonekt!\n\n"
                f"Username: {user.username}\n"
                f"Password: {raw_password}\n\n"
                "You can now log in and start using the app.\n\n"
                "Regards,\nTrikonekt Team"
            )

            def _send():
                try:
                    # Explicit from_email and fail_silently=False to surface SMTP issues
                    send_mail(
                        subject,
                        message,
                        getattr(settings, "DEFAULT_FROM_EMAIL", None) or getattr(settings, "EMAIL_HOST_USER", None),
                        [recipient],
                        fail_silently=False,
                    )
                except Exception as e:
                    try:
                        logger.warning("Welcome email send failed: %s", e)
                    except Exception:
                        pass

            # Execute after DB commit if inside a transaction; else start immediately
            try:
                transaction.on_commit(lambda: Thread(target=_send, daemon=True).start())
            except Exception:
                Thread(target=_send, daemon=True).start()
        except Exception:
            # Silently ignore any email errors to avoid breaking registration
            pass


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        initial_username = request.data.get('username')
        phone = request.data.get('phone')
        new_password = request.data.get('new_password')

        if not (initial_username or phone) or not new_password:
            return Response({'detail': 'username or phone, and new_password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize to digits if phone provided or username is digits-only
        def only_digits(s: str) -> str:
            return ''.join(c for c in (s or '') if c.isdigit())

        phone_digits = only_digits(phone or initial_username)

        User = get_user_model()
        user = None
        try:
            # Resolve by phone digits or exact legacy username
            if phone_digits:
                user = User.objects.filter(Q(phone__iexact=phone_digits) | Q(username__iexact=phone_digits)).first()
            if user is None and initial_username:
                user = User.objects.filter(username__iexact=initial_username).first()
        except Exception:
            user = None

        if not user:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            validate_password(new_password, user=user)
        except ValidationError as ve:
            return Response({'detail': ve.messages}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        email_queued = False
        email_to = getattr(user, "email", "") or ""
        if email_to and getattr(settings, "MAIL_ENABLED", False):
            try:
                from threading import Thread

                subject = "Trikonekt - Your password has been reset"
                message = (
                    f"Hello {getattr(user, 'full_name', '') or user.username},\n\n"
                    "Your Trikonekt account password has been reset.\n\n"
                    f"Username: {user.username}\n"
                    f"Password: {new_password}\n\n"
                    "If you did not request this change, please contact support immediately.\n\n"
                    "Regards,\nTrikonekt Team"
                )

                def _send_reset_mail():
                    try:
                        send_mail(
                            subject,
                            message,
                            getattr(settings, "DEFAULT_FROM_EMAIL", None) or getattr(settings, "EMAIL_HOST_USER", None),
                            [email_to],
                            fail_silently=False,
                        )
                    except Exception:
                        pass

                try:
                    transaction.on_commit(lambda: Thread(target=_send_reset_mail, daemon=True).start())
                except Exception:
                    Thread(target=_send_reset_mail, daemon=True).start()
                email_queued = True
            except Exception:
                email_queued = False

        return Response(
            {
                'detail': 'Password reset successful.',
                'email_queued': email_queued,
                'email': email_to,
                'username': user.username,
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetOTPRequestView(APIView):
    permission_classes = [AllowAny]
    identity_type = CustomUser.IDENTITY_END_USER

    def post(self, request):
        from .security import GENERIC_OTP_MESSAGE, PasswordResetRequestSerializer, request_password_reset_otp
        ser = PasswordResetRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        request_password_reset_otp(request, self.identity_type, ser.get_identifier())
        return Response({"message": GENERIC_OTP_MESSAGE}, status=status.HTTP_200_OK)


class PasswordResetOTPVerifyView(APIView):
    permission_classes = [AllowAny]
    identity_type = CustomUser.IDENTITY_END_USER

    def post(self, request):
        from .security import PasswordResetVerifySerializer, verify_password_reset_otp
        ser = PasswordResetVerifySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ok = verify_password_reset_otp(request, self.identity_type, ser.get_identifier(), ser.validated_data.get("otp"))
        return Response({"verified": bool(ok)}, status=status.HTTP_200_OK if ok else status.HTTP_400_BAD_REQUEST)


class PasswordResetOTPConfirmView(APIView):
    permission_classes = [AllowAny]
    identity_type = CustomUser.IDENTITY_END_USER

    def post(self, request):
        from django.core.exceptions import ValidationError as DjangoValidationError
        from .security import PasswordResetConfirmSerializer, reset_password_with_otp
        ser = PasswordResetConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            ok = reset_password_with_otp(
                request,
                self.identity_type,
                ser.get_identifier(),
                ser.validated_data.get("otp"),
                ser.validated_data.get("new_password"),
            )
        except DjangoValidationError as exc:
            return Response({"detail": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        if not ok:
            return Response({"detail": "Invalid or expired OTP."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"message": "Password reset successful."}, status=status.HTTP_200_OK)


class ConsumerPasswordResetOTPRequestView(PasswordResetOTPRequestView):
    identity_type = CustomUser.IDENTITY_END_USER


class ConsumerPasswordResetOTPVerifyView(PasswordResetOTPVerifyView):
    identity_type = CustomUser.IDENTITY_END_USER


class ConsumerPasswordResetOTPConfirmView(PasswordResetOTPConfirmView):
    identity_type = CustomUser.IDENTITY_END_USER


class FranchisePasswordResetOTPRequestView(PasswordResetOTPRequestView):
    identity_type = CustomUser.IDENTITY_END_USER


class FranchisePasswordResetOTPVerifyView(PasswordResetOTPVerifyView):
    identity_type = CustomUser.IDENTITY_END_USER


class FranchisePasswordResetOTPConfirmView(PasswordResetOTPConfirmView):
    identity_type = CustomUser.IDENTITY_END_USER


class MeView(generics.RetrieveAPIView):
    serializer_class = PublicUserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class ProfileMeView(generics.RetrieveUpdateAPIView):
    """
    Get/Update my profile (email, phone, age, pincode, address, avatar, geo fields).
    Supports multipart for avatar upload.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ProfileMeSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_object(self):
        return self.request.user


class UsersCursorPagination(CursorPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100
    ordering = ("-date_joined", "-id")


class UsersListView(generics.ListAPIView):
    """
    List users with filters by pincode/state/country/category/role.
    - pincode: exact match (digits normalized); supports pincode=me
    - state_id: numeric State PK
    - country_id: numeric Country PK
    - category: one of CustomUser.CATEGORY_CHOICES codes
    - role: user/agency/employee (employee/agency support legacy data variants)
    - registered_by: 'me' or user id

    Performance:
    - Uses CursorPagination to avoid COUNT(*) and OFFSET
    - Eliminates expensive OR with UNION-style id subqueries where needed
    - Applies .only() to avoid fetching unused columns
    - Keeps select_related only for relations used by the serializer
    - Orders by ('-date_joined', '-id') for stability
    """
    serializer_class = PublicUserSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = UsersCursorPagination

    def _normalize_pin(self, val: str | None) -> str | None:
        s = (val or "").strip()
        if not s:
            return None
        digits = "".join(c for c in s if c.isdigit())
        return digits or s

    def get_queryset(self):
        req = self.request
        qp = req.query_params

        pincode = qp.get('pincode')
        state_id = qp.get('state_id')
        country_id = qp.get('country_id')
        category = qp.get('category')
        role = qp.get('role')
        registered_by = qp.get('registered_by')

        # Base queryset: narrow columns and join only relations used in serializer
        base_fields = [
            'id', 'username', 'unique_id', 'prefixed_id', 'prefix_code', 'email', 'full_name', 'phone',
            'pincode', 'address', 'sponsor_id', 'category', 'role', 'registered_by_id',
            'date_joined', 'account_active', 'is_active', 'avatar',
            'country__name', 'state__name', 'city__name', 'registered_by__username',
        ]
        qs = (
            CustomUser.objects
            .select_related('country', 'state', 'city', 'registered_by')
            .only(*base_fields)
        )

        # Agency "assignable" optimization: replace OR with union of id subqueries
        try:
            user = req.user
            role_param = (role or "").strip().lower()
            is_agency_actor = (str(getattr(user, "role", "")).lower() == "agency") or str(getattr(user, "category", "")).startswith("agency_")
            me_pin_norm = self._normalize_pin(getattr(user, "pincode", "") or "")
            assignable = qp.get('assignable')
            if is_agency_actor and role_param == "employee":
                if assignable:
                    if me_pin_norm:
                        ids_a = CustomUser.objects.filter(registered_by=user).values_list('id', flat=True)
                        # Prefer exact match on digits for index usage; fall back to iexact if non-digit input
                        if me_pin_norm.isdigit():
                            ids_b = CustomUser.objects.filter(pincode=me_pin_norm).values_list('id', flat=True)
                        else:
                            ids_b = CustomUser.objects.filter(pincode__iexact=me_pin_norm).values_list('id', flat=True)
                        ids_union = ids_a.union(ids_b)
                        qs = qs.filter(id__in=ids_union)
                    else:
                        qs = qs.filter(registered_by=user)
                elif not pincode and not registered_by and me_pin_norm:
                    if me_pin_norm.isdigit():
                        qs = qs.filter(pincode=me_pin_norm)
                    else:
                        qs = qs.filter(pincode__iexact=me_pin_norm)
        except Exception:
            pass

        # Support pincode=me
        if pincode == 'me':
            me_pin = self._normalize_pin(getattr(req.user, 'pincode', '') or '')
            pincode = me_pin if me_pin else None

        # Apply simple filters (prefer sargable forms)
        if pincode:
            pin_norm = self._normalize_pin(pincode)
            if pin_norm and pin_norm.isdigit():
                qs = qs.filter(pincode=pin_norm)
            elif pin_norm:
                qs = qs.filter(pincode__iexact=pin_norm)

        if state_id:
            qs = qs.filter(state_id=state_id)
        if country_id:
            qs = qs.filter(country_id=country_id)
        if category:
            qs = qs.filter(category=category)

        # Role filters: eliminate OR via id-union where legacy data requires it
        if role:
            r = role.strip().lower()
            if r == 'employee':
                ids_r = CustomUser.objects.filter(role='employee').values_list('id', flat=True)
                ids_c = CustomUser.objects.filter(category='employee').values_list('id', flat=True)
                ids_union = ids_r.union(ids_c)
                qs = qs.filter(id__in=ids_union)
            elif r == 'agency':
                ids_r = CustomUser.objects.filter(role='agency').values_list('id', flat=True)
                ids_c = CustomUser.objects.filter(category__startswith='agency_').values_list('id', flat=True)
                ids_union = ids_r.union(ids_c)
                qs = qs.filter(id__in=ids_union)
            else:
                qs = qs.filter(role=role)

        if registered_by == 'me':
            qs = qs.filter(registered_by=req.user)
        elif registered_by:
            qs = qs.filter(registered_by_id=registered_by)

        # Stable compound ordering compatible with cursor pagination
        return qs.order_by('-date_joined', '-id')

    def list(self, request, *args, **kwargs):
        # Lightweight instrumentation similar to debug toolbar (timing only)
        import time, logging
        t0 = time.perf_counter()
        queryset = self.get_queryset()
        t1 = time.perf_counter()
        page = self.paginate_queryset(queryset)
        t2 = time.perf_counter()
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            data = serializer.data
            t3 = time.perf_counter()
            sql_count = None
            sql_time = None
            try:
                from django.db import connection
                sql_count = len(connection.queries)
                sql_time = sum(float(q.get("time", 0) or 0) for q in connection.queries)
            except Exception:
                pass
            try:
                logger = logging.getLogger("perf.accounts.users_list")
                logger.info(
                    "users_list timings db_prep_ms=%.1f paginate_ms=%.1f serialize_ms=%.1f total_ms=%.1f sql_count=%s sql_ms=%s",
                    (t1 - t0) * 1000.0, (t2 - t1) * 1000.0, (t3 - t2) * 1000.0, (t3 - t0) * 1000.0,
                    sql_count, sql_time
                )
            except Exception:
                pass
            return self.get_paginated_response(data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class MyEmployeesListView(generics.ListAPIView):
    serializer_class = PublicUserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            CustomUser.objects
            .filter(registered_by=self.request.user)
            .filter(Q(category='employee') | Q(role='employee'))
            .select_related('country', 'state', 'city', 'registered_by')
            .order_by('-date_joined')
        )


class AgencyEmployeeActivationView(APIView):
    """
    Agency can activate/deactivate their own employee accounts.
    PATCH body: { "account_active": true|false } (if omitted, toggles current state)
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk: int):
        actor = request.user
        # Actor must be an agency account (role=agency or category startswith 'agency')
        is_agency_actor = (str(getattr(actor, "role", "")).lower() == "agency") or str(getattr(actor, "category", "")).startswith("agency")
        if not is_agency_actor:
            return Response({"detail": "Only agency users can activate/deactivate their employees."}, status=status.HTTP_403_FORBIDDEN)

        target = CustomUser.objects.filter(pk=pk).first()
        if not target:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        # Target must be an employee under this agency
        is_employee = (str(getattr(target, "role", "")).lower() == "employee") or (str(getattr(target, "category", "")).lower() == "employee")
        if not is_employee:
            return Response({"detail": "Target is not an employee account."}, status=status.HTTP_400_BAD_REQUEST)
        if getattr(target, "registered_by_id", None) != getattr(actor, "id", None):
            return Response({"detail": "You can only manage employees registered by you."}, status=status.HTTP_403_FORBIDDEN)

        val = (request.data or {}).get("account_active", None)
        if val is None:
            new_active = not bool(getattr(target, "account_active", False))
        else:
            sval = str(val).strip().lower()
            new_active = sval in ("1", "true", "yes", "on")

        if bool(getattr(target, "account_active", False)) != new_active:
            target.account_active = new_active
            target.save(update_fields=["account_active"])

        return Response(PublicUserSerializer(target).data, status=status.HTTP_200_OK)


class MyBusinessesListView(generics.ListAPIView):
    serializer_class = PublicUserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            CustomUser.objects
            .filter(registered_by=self.request.user, category='business')
            .select_related('country', 'state', 'city', 'registered_by')
            .order_by('-date_joined')
        )


# Regions available under a sponsor to drive dynamic registration UI
# AllowAny so registration form can use this before login
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

def _collect_pincodes_from_user_assignments(user):
    """
    Collect pincodes covered by a user's region assignments.
    - Direct pincode assignments are used as-is.
    - District assignments expand to pincodes via offline index (with synonyms).
    - State assignments expand to all pincodes under that state via offline index.
    - If no pins on the user, walk up registered_by chain (max depth 5) to derive from parent.
    """
    pins = set()
    try:
        try:
            idx = _build_district_index()
        except Exception:
            idx = {}

        assigns = AgencyRegionAssignment.objects.filter(user=user).select_related('state')
        for a in assigns:
            if a.level == 'pincode':
                p = (a.pincode or '').strip()
                if p and p.isdigit() and len(p) == 6:
                    pins.add(p)
            elif a.level == 'district':
                state_name = (getattr(a.state, 'name', '') or '').strip()
                skey = state_name.lower()
                dvars = india_place_variants(a.district) or [a.district]
                for dv in dvars:
                    dkey = (dv or '').strip().lower()
                    pins.update(idx.get((skey, dkey), set()))
                    pins.update(idx.get(("", dkey), set()))
            elif a.level == 'state':
                state_name = (getattr(a.state, 'name', '') or '').strip().lower()
                if state_name:
                    for (s, _d), sset in (idx.items() if hasattr(idx, 'items') else []):
                        if s == state_name:
                            pins.update(sset)
    except Exception:
        pass

    # Ancestor fallback: look at parents if no pins on current user
    if not pins:
        try:
            cur = user
            for _ in range(5):
                parent = getattr(cur, 'registered_by', None)
                if not parent or getattr(parent, 'id', None) in (None, cur.id):
                    break
                parent_pins = _collect_pincodes_from_user_assignments(parent)
                if parent_pins:
                    pins.update(parent_pins)
                    break
                cur = parent
        except Exception:
            pass

    # Fallbacks from user's own profile when no explicit assignments found
    if not pins:
        try:
            # Sponsor's own pincode field
            upin = (getattr(user, 'pincode', '') or '').strip()
            if upin.isdigit() and len(upin) == 6:
                pins.add(upin)

            # Derive from user's City/District and State via offline index
            if not pins:
                idx2 = _build_district_index()
                state_name = (getattr(getattr(user, 'state', None), 'name', '') or '').strip().lower()
                city_name = (getattr(getattr(user, 'city', None), 'name', '') or '').strip()
                dvars = india_place_variants(city_name) or [city_name]
                for dv in dvars:
                    dkey = (dv or '').strip().lower()
                    if state_name:
                        pins.update(idx2.get((state_name, dkey), set()))
                    pins.update(idx2.get(('', dkey), set()))
        except Exception:
            pass

    return pins

@api_view(["GET"])
@permission_classes([AllowAny])
def regions_by_sponsor(request):
    # Normalize sponsor param in case a full URL or querystring was pasted
    def _norm_sponsor(val: str) -> str:
        try:
            s = (val or "").strip()
            if not s:
                return ""
            if "://" in s or "?" in s or "=" in s or "/" in s:
                try:
                    from urllib.parse import urlparse, parse_qs
                    u = urlparse(s)
                    q = parse_qs(u.query or "")
                    inner = (q.get("sponsor") or [None])[0]
                    if inner:
                        return _norm_sponsor(inner)
                    # If only a raw querystring was passed
                    if "sponsor=" in s:
                        qs = s.split("?", 1)[1] if "?" in s else s
                        q2 = parse_qs(qs)
                        inner2 = (q2.get("sponsor") or [None])[0]
                        if inner2:
                            return _norm_sponsor(inner2)
                except Exception:
                    pass
            import re
            token = "".join(re.findall(r"[A-Za-z0-9_-]+", s)) or ""
            return token
        except Exception:
            return ""

    sponsor = _norm_sponsor(request.query_params.get('sponsor'))
    level = (request.query_params.get('level') or '').strip().lower()
    registration_type = (request.query_params.get('registration_type') or request.query_params.get('category') or '').strip().lower()
    if not sponsor or level not in ('state', 'district', 'pincode'):
        return Response({'detail': 'sponsor and valid level (state|district|pincode) are required.'}, status=status.HTTP_400_BAD_REQUEST)

    def _resolve_sponsor_user(sval: str):
        s = (sval or "").strip()
        if not s:
            return None
        digits = "".join(ch for ch in s if ch.isdigit())
        # 1) Exact code/username match (do NOT match sponsor_id to avoid picking the sponsor's sponsor)
        u = CustomUser.objects.filter(Q(prefixed_id__iexact=s) | Q(username__iexact=s)).first()
        if u:
            return u
        # 2) Try adding/removing dash after prefix for TR-like codes
        try:
            if len(s) > 2 and s[:2].isalpha() and "-" not in s:
                u = CustomUser.objects.filter(
                    Q(prefixed_id__iexact=f"{s[:2]}-{s[2:]}") | Q(username__iexact=f"{s[:2]}-{s[2:]}")
                ).first()
                if u:
                    return u
        except Exception:
            pass
        # 3) Digits-only: prefer TR+digits (code) before falling back to phone
        if digits and digits == s:
            pref = "TR"
            u = CustomUser.objects.filter(
                Q(prefixed_id__iexact=f"{pref}{digits}")
                | Q(prefixed_id__iexact=f"{pref}-{digits}")
                | Q(username__iexact=f"{pref}{digits}")
                | Q(username__iexact=f"{pref}-{digits}")
            ).first()
            if u:
                return u
            u = CustomUser.objects.filter(unique_id__iexact=digits).first()
            if u:
                return u
            u = CustomUser.objects.filter(phone__iexact=digits).first()
            if u:
                return u
        # 4) Fallback (legacy): avoid sponsor_id to prevent mis-resolution to an account that used this as their sponsor reference
        q = Q(username__iexact=s)
        if digits:
            q = q | Q(phone__iexact=digits)
        return CustomUser.objects.filter(q).first()

    sponsor_user = _resolve_sponsor_user(sponsor)
    if not sponsor_user:
        return Response({'detail': 'Sponsor not found.'}, status=status.HTTP_404_NOT_FOUND)

    qs = AgencyRegionAssignment.objects.filter(user=sponsor_user, level=level)

    # Optional filters to narrow down
    state_id = request.query_params.get('state_id')
    if state_id:
        try:
            sid = int(state_id)
            qs = qs.filter(state_id=sid)
        except (TypeError, ValueError):
            pass

    district = (request.query_params.get('district') or '').strip()
    if district:
        qs = qs.filter(district__iexact=district)

    if level == 'state':
        # Return distinct states. If sponsor has only district/pincode assignments,
        # derive the covered states from those assignments as fallback.
        out_states = []
        seen = set()

        state_rows = list(qs.select_related('state'))
        if not state_rows:
            state_rows = list(
                AgencyRegionAssignment.objects
                .filter(user=sponsor_user, level__in=('district', 'pincode'))
                .select_related('state')
            )

        for a in state_rows:
            if a.state_id and a.state_id not in seen:
                seen.add(a.state_id)
                out_states.append({'id': a.state_id, 'name': a.state.name if a.state else None})

        # Final fallback: if still empty and sponsor has a state set, include it
        try:
            if not out_states and getattr(sponsor_user, 'state_id', None):
                s = sponsor_user.state
                out_states.append({'id': sponsor_user.state_id, 'name': s.name if s else None})
        except Exception:
            pass

        # Ancestor fallback: walk up registered_by chain to derive states from parent's assignments
        if not out_states:
            try:
                cur = sponsor_user
                for _ in range(5):
                    parent = getattr(cur, 'registered_by', None)
                    if not parent or getattr(parent, 'id', None) in (None, cur.id):
                        break
                    p_rows = list(
                        AgencyRegionAssignment.objects
                        .filter(user=parent, level='state')
                        .select_related('state')
                    )
                    if not p_rows:
                        p_rows = list(
                            AgencyRegionAssignment.objects
                            .filter(user=parent, level__in=('district', 'pincode'))
                            .select_related('state')
                        )
                    for a in p_rows:
                        if a.state_id and a.state_id not in seen:
                            seen.add(a.state_id)
                            out_states.append({'id': a.state_id, 'name': a.state.name if a.state else None})
                    if out_states:
                        break
                    cur = parent
            except Exception:
                pass

        try:
            pins_set = _collect_pincodes_from_user_assignments(sponsor_user)
            out_pincodes = sorted(pins_set)
        except Exception:
            out_pincodes = []

        # Group pincodes by state to allow frontend to auto-select state without pincode lookup
        pins_by_state = []
        try:
            idx = _build_district_index() or {}
            grouped = {}
            assigns_all = AgencyRegionAssignment.objects.filter(user=sponsor_user).select_related('state')
            for a in assigns_all:
                if a.level == 'state' and a.state_id and a.state:
                    sname = (a.state.name or '').strip().lower()
                    # union all pins under this state from the offline index
                    sset_total = set()
                    for (skey, _d), pset in (idx.items() if hasattr(idx, 'items') else []):
                        if skey == sname:
                            sset_total.update(pset)
                    if sset_total:
                        grouped.setdefault(a.state_id, set()).update(sset_total)
                elif a.level == 'district' and a.state_id and a.state:
                    sname = (a.state.name or '').strip().lower()
                    dvars = india_place_variants(a.district) or [a.district]
                    for dv in dvars:
                        dkey = (dv or '').strip().lower()
                        pins = idx.get((sname, dkey), set())
                        if pins:
                            grouped.setdefault(a.state_id, set()).update(pins)
                elif a.level == 'pincode':
                    p = (a.pincode or '').strip()
                    if p and p.isdigit() and len(p) == 6:
                        # try to map this pincode to a state via reverse lookup in the index
                        found_state_name = None
                        for (skey, _d), pset in (idx.items() if hasattr(idx, 'items') else []):
                            if p in pset:
                                found_state_name = skey
                                break
                        if found_state_name:
                            st = State.objects.filter(name__iexact=found_state_name).first()
                            if st:
                                grouped.setdefault(st.id, set()).add(p)

            # Fallback: if still no grouping and sponsor has a profile state, include all pins under that state
            if not grouped and getattr(sponsor_user, 'state_id', None) and getattr(sponsor_user, 'state', None):
                sname = (getattr(sponsor_user.state, 'name', '') or '').strip().lower()
                sset_total = set()
                for (skey, _d), pset in (idx.items() if hasattr(idx, 'items') else []):
                    if skey == sname:
                        sset_total.update(pset)
                if sset_total:
                    grouped[sponsor_user.state_id] = sset_total

            # Serialize pins_by_state aligned with out_states for names
            for sid, pins in grouped.items():
                st = None
                try:
                    st = next((s for s in out_states if s['id'] == sid), None)
                except Exception:
                    st = None
                pins_by_state.append({
                    'state_id': sid,
                    'state': (st['name'] if isinstance(st, dict) and 'name' in st else None),
                    'pincodes': sorted(pins),
                })
        except Exception:
            pins_by_state = []

        full_name = getattr(sponsor_user, 'full_name', '') or sponsor_user.username
        try:
            derived_pin = out_pincodes[0] if out_pincodes else None
        except Exception:
            derived_pin = None
        pincode = (getattr(sponsor_user, 'pincode', '') or '') or (derived_pin or '')
        sponsor_payload = {
            'username': sponsor_user.username,
            'full_name': full_name,
            'pincode': pincode,
            'role': getattr(sponsor_user, 'role', None),
            'category': getattr(sponsor_user, 'category', None),
            'state': getattr(getattr(sponsor_user, 'state', None), 'name', None),
            'district': getattr(getattr(sponsor_user, 'city', None), 'name', None),
        }
        return Response({'states': out_states, 'pincodes': out_pincodes, 'pins_by_state': pins_by_state, 'sponsor': sponsor_payload}, status=status.HTTP_200_OK)

    if level == 'district':
        # Return distinct districts (optionally filtered by state)
        out_districts = []
        seen = set()
        for a in qs.select_related('state'):
            if a.district:
                key = (a.state_id, a.district.lower())
                if key not in seen:
                    seen.add(key)
                    out_districts.append({
                        'state_id': a.state_id,
                        'state': a.state.name if a.state else None,
                        'district': a.district
                    })

        # Enhancement for Sub-Franchise registration:
        # If registration_type indicates sub-franchise AND a specific district filter is provided,
        # include all pincodes for that district irrespective of sponsor assignments.
        resp = {'districts': out_districts}
        if registration_type in ('agency_sub_franchise', 'sub_franchise', 'sub-franchise', 'sf'):
            try:
                idx = _build_district_index() or {}
                pins = set()

                # Resolve state name if provided
                sname = ''
                try:
                    if state_id:
                        sid = int(state_id)
                        st = State.objects.filter(pk=sid).first()
                        if st and getattr(st, 'name', None):
                            sname = (st.name or '').strip().lower()
                except Exception:
                    sname = ''

                district_norm = (district or '').strip()
                if district_norm:
                    dvars = india_place_variants(district_norm) or [district_norm]
                    for dv in dvars:
                        dkey = (dv or '').strip().lower()
                        if sname:
                            pins.update(idx.get((sname, dkey), set()))
                        pins.update(idx.get(('', dkey), set()))
                if pins:
                    resp['pincodes'] = sorted(pins)
            except Exception:
                # Fail silently and just return districts if anything goes wrong
                pass

        full_name = getattr(sponsor_user, 'full_name', '') or sponsor_user.username
        pins = resp.get('pincodes') or []
        if not pins:
            try:
                pins = sorted(_collect_pincodes_from_user_assignments(sponsor_user))
            except Exception:
                pins = []
        pincode = (getattr(sponsor_user, 'pincode', '') or '') or (pins[0] if pins else '')
        sponsor_payload = {
            'username': sponsor_user.username,
            'full_name': full_name,
            'pincode': pincode,
            'role': getattr(sponsor_user, 'role', None),
            'category': getattr(sponsor_user, 'category', None),
            'state': getattr(getattr(sponsor_user, 'state', None), 'name', None),
            'district': getattr(getattr(sponsor_user, 'city', None), 'name', None),
        }
        resp['sponsor'] = sponsor_payload
        return Response(resp, status=status.HTTP_200_OK)

    # level == 'pincode'
    # Special case: For sub-franchise registration, enable ALL relevant pincodes:
    # - If district provided: all pincodes for that district (existing behavior)
    # - Else if state_id provided: all pincodes within that state
    # - Else: all pincodes across the entire index (All-India)
    if registration_type in ('agency_sub_franchise', 'sub_franchise', 'sub-franchise', 'sf'):
        try:
            idx = _build_district_index() or {}
            pins = set()

            # Resolve state name if provided
            sname = ''
            try:
                if state_id:
                    sid = int(state_id)
                    st = State.objects.filter(pk=sid).first()
                    if st and getattr(st, 'name', None):
                        sname = (st.name or '').strip().lower()
            except Exception:
                sname = ''

            district_norm = (district or '').strip()
            if district_norm:
                # Return all pins within the given district
                dvars = india_place_variants(district_norm) or [district_norm]
                for dv in dvars:
                    dkey = (dv or '').strip().lower()
                    if sname:
                        pins.update(idx.get((sname, dkey), set()))
                    pins.update(idx.get(('', dkey), set()))
            elif sname:
                # Return all pins within the given state
                for (skey, _d), pset in (idx.items() if hasattr(idx, 'items') else []):
                    if skey == sname:
                        pins.update(pset)
            else:
                # Return all pins across the entire index (All-India)
                for _key, pset in (idx.items() if hasattr(idx, 'items') else []):
                    pins.update(pset)

            pins_sorted = sorted(pins)
            full_name = getattr(sponsor_user, 'full_name', '') or sponsor_user.username
            pincode = (getattr(sponsor_user, 'pincode', '') or '') or (pins_sorted[0] if pins_sorted else '')
            sponsor_payload = {
                'username': sponsor_user.username,
                'full_name': full_name,
                'pincode': pincode,
                'role': getattr(sponsor_user, 'role', None),
                'category': getattr(sponsor_user, 'category', None),
                'state': getattr(getattr(sponsor_user, 'state', None), 'name', None),
                'district': getattr(getattr(sponsor_user, 'city', None), 'name', None),
            }
            return Response({'pincodes': pins_sorted, 'sponsor': sponsor_payload}, status=status.HTTP_200_OK)
        except Exception:
            # fall back to sponsor-derived behavior below if any error
            pass
    out_pins = []
    seenp = set()
    for a in qs.only('pincode'):
        if a.pincode and a.pincode not in seenp:
            seenp.add(a.pincode)
            out_pins.append(a.pincode)

    # Fallback: derive pincodes from district/state assignments or parent's assignments
    if not out_pins:
        try:
            derived = sorted(_collect_pincodes_from_user_assignments(sponsor_user))
        except Exception:
            derived = []
        out_pins = derived

    full_name = getattr(sponsor_user, 'full_name', '') or sponsor_user.username
    pincode = (getattr(sponsor_user, 'pincode', '') or '') or (out_pins[0] if out_pins else '')
    sponsor_payload = {
        'username': sponsor_user.username,
        'full_name': full_name,
        'pincode': pincode,
        'role': getattr(sponsor_user, 'role', None),
        'category': getattr(sponsor_user, 'category', None),
        'state': getattr(getattr(sponsor_user, 'state', None), 'name', None),
        'district': getattr(getattr(sponsor_user, 'city', None), 'name', None),
    }
    return Response({'pincodes': out_pins, 'sponsor': sponsor_payload}, status=status.HTTP_200_OK)


# Simple hierarchy endpoint for audits and dashboards
from rest_framework.permissions import IsAuthenticated
from adminapi.permissions import IsAdminOrStaff, HasAdminModuleAccess

@api_view(["GET"])
@permission_classes([AllowAny])
def hierarchy(request):
    username = (request.query_params.get('username') or '').strip()
    if username:
        u = CustomUser.objects.filter(username__iexact=username).first()
        if not u:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
    else:
        if not request.user or not request.user.is_authenticated:
            return Response({'detail': 'Authentication credentials were not provided.'}, status=status.HTTP_401_UNAUTHORIZED)
        u = request.user

    if not request.user or not request.user.is_authenticated:
        return Response({
            'user': {'id': u.id, 'username': u.username, 'category': u.category, 'role': u.role},
            'chain_up': [],
            'children': [],
        }, status=status.HTTP_200_OK)

    # Build chain upwards (limit depth to avoid cycles)
    chain_up = []
    visited = set()
    cur = u
    for _ in range(10):
        parent = getattr(cur, 'registered_by', None)
        if not parent or parent.id in visited:
            break
        chain_up.append({
            'id': parent.id,
            'username': parent.username,
            'category': parent.category,
            'role': parent.role,
        })
        visited.add(parent.id)
        cur = parent

    # Immediate children
    children_qs = CustomUser.objects.filter(registered_by=u).only('id', 'username', 'category', 'role').order_by('-date_joined')[:200]
    children = [{'id': c.id, 'username': c.username, 'category': c.category, 'role': c.role} for c in children_qs]

    return Response({
        'user': {'id': u.id, 'username': u.username, 'category': u.category, 'role': u.role},
        'chain_up': chain_up,
        'children': children,
    }, status=status.HTTP_200_OK)


class MyMatrixTree(APIView):
    """
    Returns the authenticated user's 5-matrix genealogy tree (spillover-based).
    Query params:
      - max_depth: optional (default 6, capped at 20)
    Response:
      { id, username, full_name, level, matrix_position, depth, children:[...] }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            max_depth = int(request.query_params.get("max_depth") or 6)
        except Exception:
            max_depth = 6
        max_depth = max(1, min(max_depth, 20))

        def build_node(u, level: int):
            node = {
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name,
                "level": level,
                "matrix_position": getattr(u, "matrix_position", None),
                "depth": getattr(u, "depth", 0),
                "children": [],
            }
            if level >= max_depth:
                return node
            children = list(
                CustomUser.objects.filter(parent_id=u.id)
                .only("id", "username", "full_name", "matrix_position", "depth")
                .order_by("matrix_position", "id")
            )
            for ch in children:
                node["children"].append(build_node(ch, level + 1))
            return node

        tree = build_node(user, 1)
        return Response(tree, status=status.HTTP_200_OK)


class MyMatrixTreeByRoot(APIView):
    """
    Returns a user's 5-matrix subtree by an arbitrary root_user_id, but only if that
    root lies within the authenticated user's downline (spillover tree).
    Query params:
      - root_user_id: required
      - max_depth: optional (default 6, capped at 20)
    Response is identical to MyMatrixTree.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            root_id = int(request.query_params.get("root_user_id") or "0")
        except Exception:
            return Response({"detail": "root_user_id must be integer"}, status=status.HTTP_400_BAD_REQUEST)
        if root_id <= 0:
            return Response({"detail": "root_user_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Security: ensure requested root is in caller's downline (walk up parent_id)
        me_id = getattr(request.user, "id", None)
        if not me_id:
            return Response({"detail": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        target = CustomUser.objects.filter(id=root_id).only("id", "parent_id").first()
        if not target:
            return Response({"detail": "root user not found"}, status=status.HTTP_404_NOT_FOUND)

        cur = target
        in_downline = False
        # allow same user (self)
        for _ in range(7):  # depth up to 6 + self check
            if not cur:
                break
            if cur.id == me_id:
                in_downline = True
                break
            pid = getattr(cur, "parent_id", None)
            if not pid:
                break
            cur = CustomUser.objects.filter(id=pid).only("id", "parent_id").first()

        if not in_downline:
            return Response({"detail": "Requested root is not inside your downline"}, status=status.HTTP_403_FORBIDDEN)

        # Depth
        try:
            max_depth = int(request.query_params.get("max_depth") or 6)
        except Exception:
            max_depth = 6
        max_depth = max(1, min(max_depth, 20))

        # Build subtree
        def build_node(u, level: int):
            node = {
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name,
                "level": level,
                "matrix_position": getattr(u, "matrix_position", None),
                "depth": getattr(u, "depth", 0),
                "children": [],
            }
            if level >= max_depth:
                return node
            children = list(
                CustomUser.objects.filter(parent_id=u.id)
                .only("id", "username", "full_name", "matrix_position", "depth")
                .order_by("matrix_position", "id")
            )
            for ch in children:
                node["children"].append(build_node(ch, level + 1))
            return node

        root = CustomUser.objects.filter(id=root_id).first()
        tree = build_node(root, 1)
        return Response(tree, status=status.HTTP_200_OK)


class MySponsorTree(APIView):
    """
    Returns the authenticated user's sponsor-based genealogy tree (registered_by/sponsor_id).
    Query params:
      - max_depth: optional (default 6, capped at 20)
    Response:
      { id, username, full_name, children:[...] }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            max_depth = int(request.query_params.get("max_depth") or 6)
        except Exception:
            max_depth = 6
        max_depth = max(1, min(max_depth, 20))

        def build_node(u, level: int, visited=None):
            if visited is None:
                visited = set()
            if getattr(u, "id", None) in visited:
                return None
            visited.add(u.id)
            node = {
                "id": u.id,
                "username": u.username,
                "full_name": getattr(u, "full_name", ""),
                "children": [],
            }
            if level >= max_depth:
                return node
            # Build a robust identifier set for legacy sponsor_id matches
            _sid_vals = []
            try:
                _tr = (getattr(u, "prefixed_id", "") or "").strip()
                if _tr:
                    _sid_vals.append(_tr)
                    # include dashed/undashed TR variants
                    if "-" in _tr:
                        _sid_vals.append(_tr.replace("-", "", 1))
                    else:
                        if len(_tr) > 2 and _tr[:2].isalpha():
                            _sid_vals.append(f"{_tr[:2]}-{_tr[2:]}")
                _uid = (getattr(u, "unique_id", "") or "").strip()
                if _uid:
                    _sid_vals.append(_uid)
                _uname = (getattr(u, "username", "") or "").strip()
                if _uname:
                    _sid_vals.append(_uname)
                _digits = "".join(ch for ch in ((getattr(u, "phone", "") or "")) if ch.isdigit())
                if _digits:
                    _sid_vals.append(_digits)
                _idents = [s for s in {v for v in _sid_vals if v}]
            except Exception:
                _idents = []

            children = list(
                CustomUser.objects.filter(
                    Q(registered_by_id=u.id)
                    | (Q(registered_by__isnull=True) & Q(sponsor_id__in=_idents))
                )
                .exclude(id=u.id)
                .only("id", "username", "full_name")
                .order_by("-id")
                .distinct()
            )
            for ch in children:
                cn = build_node(ch, level + 1, visited)
                if cn:
                    node["children"].append(cn)
            return node

        tree = build_node(request.user, 1)
        return Response(tree, status=status.HTTP_200_OK)


class MySponsorTreeByRoot(APIView):
    """
    Returns sponsor-based downline tree for a root user within caller's sponsor downline.
    Query params:
      - root_user_id: required
      - max_depth: optional (default 6, capped at 20)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            root_id = int(request.query_params.get("root_user_id") or "0")
        except Exception:
            return Response({"detail": "root_user_id must be integer"}, status=status.HTTP_400_BAD_REQUEST)
        if root_id <= 0:
            return Response({"detail": "root_user_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        root = CustomUser.objects.filter(id=root_id).first()
        if not root:
            return Response({"detail": "root user not found"}, status=status.HTTP_404_NOT_FOUND)

        # Security: ensure requested root is inside caller’s sponsor-based downline (or self)
        me = request.user
        cur = root
        allowed = False

        def _resolve_sponsor_parent(user):
            try:
                sid = (getattr(user, "sponsor_id", "") or "").strip()
            except Exception:
                sid = ""
            if not sid:
                return None
            q = Q(username__iexact=sid) | Q(prefixed_id__iexact=sid) | Q(unique_id__iexact=sid)
            digits = "".join(ch for ch in sid if ch.isdigit())
            if digits:
                q = q | Q(phone__iexact=digits) | Q(username__iexact=digits)
            return CustomUser.objects.filter(q).only("id").first()

        for _ in range(50):
            if not cur:
                break
            if cur.id == me.id:
                allowed = True
                break
            parent = getattr(cur, "registered_by", None)
            if not parent:
                parent = _resolve_sponsor_parent(cur)
            if not parent or getattr(parent, "id", None) == getattr(cur, "id", None):
                break
            cur = parent

        if not allowed:
            return Response({"detail": "Requested root is not inside your sponsor downline"}, status=status.HTTP_403_FORBIDDEN)

        try:
            max_depth = int(request.query_params.get("max_depth") or 6)
        except Exception:
            max_depth = 6
        max_depth = max(1, min(max_depth, 20))

        def build_node(u, level: int, visited=None):
            if visited is None:
                visited = set()
            if getattr(u, "id", None) in visited:
                return None
            visited.add(u.id)
            node = {
                "id": u.id,
                "username": u.username,
                "full_name": getattr(u, "full_name", ""),
                "children": [],
            }
            if level >= max_depth:
                return node
            # Build a robust identifier set for legacy sponsor_id matches
            _sid_vals = []
            try:
                _tr = (getattr(u, "prefixed_id", "") or "").strip()
                if _tr:
                    _sid_vals.append(_tr)
                    # include dashed/undashed TR variants
                    if "-" in _tr:
                        _sid_vals.append(_tr.replace("-", "", 1))
                    else:
                        if len(_tr) > 2 and _tr[:2].isalpha():
                            _sid_vals.append(f"{_tr[:2]}-{_tr[2:]}")
                _uid = (getattr(u, "unique_id", "") or "").strip()
                if _uid:
                    _sid_vals.append(_uid)
                _uname = (getattr(u, "username", "") or "").strip()
                if _uname:
                    _sid_vals.append(_uname)
                _digits = "".join(ch for ch in ((getattr(u, "phone", "") or "")) if ch.isdigit())
                if _digits:
                    _sid_vals.append(_digits)
                _idents = [s for s in {v for v in _sid_vals if v}]
            except Exception:
                _idents = []

            children = list(
                CustomUser.objects.filter(
                    Q(registered_by_id=u.id)
                    | (Q(registered_by__isnull=True) & Q(sponsor_id__in=_idents))
                )
                .exclude(id=u.id)
                .only("id", "username", "full_name")
                .order_by("-id")
                .distinct()
            )
            for ch in children:
                cn = build_node(ch, level + 1, visited)
                if cn:
                    node["children"].append(cn)
            return node

        tree = build_node(root, 1)
        return Response(tree, status=status.HTTP_200_OK)


# ====================
# Team / Earnings APIs
# ====================
class TeamSummaryView(APIView):
    """
    Returns a consolidated "My Team" snapshot for the logged-in user:
    - Downline counts (Direct + L1..L5)
    - Earnings totals by category: direct referral, generation levels, autopool, franchise
    - Matrix progress (UserMatrixProgress) for THREE_50 / THREE_150 / FIVE_150
    - Recent team members and recent reward transactions (limited)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Downline counts up to 5 levels (by registered_by chain)
        def downline_counts(u, max_depth=5):
            counts = []
            current_ids = [u.id]
            for d in range(max_depth):
                lvl_ids = list(
                    CustomUser.objects.filter(registered_by_id__in=current_ids).values_list("id", flat=True)
                )
                counts.append(len(lvl_ids))
                if not lvl_ids:
                    counts.extend([0] * (max_depth - d - 1))
                    break
                current_ids = lvl_ids
            return counts

        levels_1_5 = downline_counts(user, 5)
        direct_count = levels_1_5[0] if levels_1_5 else 0

        # Earnings totals (wallet transactions)
        tx = WalletTransaction.objects.filter(user=user)
        def _sum(qs):
            val = qs.aggregate(total=Sum("amount"))["total"] or 0
            return str(val)

        totals = {
            "direct_referral": _sum(tx.filter(type="DIRECT_REF_BONUS")),
            "generation_levels": _sum(tx.filter(type="LEVEL_BONUS")),
            "autopool_three": _sum(tx.filter(type="AUTOPOOL_BONUS_THREE")),
            "autopool_five": _sum(tx.filter(type="AUTOPOOL_BONUS_FIVE")),
            "franchise_income": _sum(tx.filter(type="FRANCHISE_INCOME")),
            "commissions": _sum(tx.filter(type="COMMISSION_CREDIT")),
            "rewards": _sum(tx.filter(type="REWARD_CREDIT")),
        }

        # Generation earnings breakdown by level (L1..L5)
        gen_breakdown = {"1": "0", "2": "0", "3": "0", "4": "0", "5": "0"}
        try:
            from decimal import Decimal as D
            accum = {1: D("0"), 2: D("0"), 3: D("0"), 4: D("0"), 5: D("0")}
            for r in tx.filter(type="LEVEL_BONUS").values("amount", "meta"):
                meta = r.get("meta") or {}
                try:
                    lvl = int(meta.get("level") or meta.get("level_index") or 0)
                except Exception:
                    lvl = 0
                if 1 <= lvl <= 5:
                    try:
                        amt = D(str(r.get("amount") or "0"))
                        accum[lvl] = accum[lvl] + amt
                    except Exception:
                        pass
            gen_breakdown = {str(k): str(v) for k, v in accum.items()}
        except Exception:
            # best-effort
            pass

        # Commission split by role for COMMISSION_CREDIT
        comm_split = {"employee": "0", "agency": "0"}
        try:
            from decimal import Decimal as D
            emp = D("0"); ag = D("0")
            for r in tx.filter(type="COMMISSION_CREDIT").values("amount", "meta"):
                meta = r.get("meta") or {}
                role = (meta.get("role") or "").strip().lower()
                try:
                    amt = D(str(r.get("amount") or "0"))
                except Exception:
                    amt = D("0")
                if role == "employee":
                    emp += amt
                elif role == "agency":
                    ag += amt
            comm_split = {"employee": str(emp), "agency": str(ag)}
        except Exception:
            # best-effort
            pass

        # Matrix progress (per pool_type)
        try:
            from business.models import UserMatrixProgress
            mp_qs = UserMatrixProgress.objects.filter(user=user).order_by("-updated_at")
            matrix = [
                {
                    "pool_type": m.pool_type,
                    "total_earned": str(m.total_earned),
                    "level_reached": int(m.level_reached or 0),
                    "per_level_counts": m.per_level_counts or {},
                    "per_level_earned": m.per_level_earned or {},
                    "updated_at": m.updated_at,
                }
                for m in mp_qs
            ]
        except Exception:
            matrix = []

        # My matrix positions (ACTIVE only) for FIVE_150 and THREE_150
        try:
            from business.models import AutoPoolAccount
            pos_qs = (
                AutoPoolAccount.objects
                .filter(owner=user, status="ACTIVE", pool_type__in=["FIVE_150", "THREE_150"])
                .only("id", "username_key", "pool_type", "status", "level", "user_entry_index", "source_type", "source_id", "created_at")
                .order_by("pool_type", "user_entry_index", "id")
            )
            my_positions = [
                {
                    "id": int(getattr(p, "id", 0) or 0),
                    "username_key": getattr(p, "username_key", "") or "",
                    "pool_type": getattr(p, "pool_type", "") or "",
                    "status": getattr(p, "status", "") or "",
                    "level": int(getattr(p, "level", 0) or 0),
                    "user_entry_index": int(getattr(p, "user_entry_index", 0) or 0),
                    "source_type": getattr(p, "source_type", "") or "",
                    "source_id": getattr(p, "source_id", "") or "",
                    "created_at": getattr(p, "created_at", None),
                }
                for p in pos_qs
            ]
        except Exception:
            my_positions = []

        # Infer category for RECOVERY/RESTORATION/SENTINEL positions using purchase history
        try:
            from business.models import PromoPurchase as _PP
            from collections import Counter as _Counter

            # Ambiguous sources should be bucketed by purchase-history sequence rather than by raw tag.
            # This prevents legacy BACKFILL rows from inflating counts beyond actual approved purchases.
            _AMBIG = {"RECOVERY", "RESTORATION", "SENTINEL", "RECONCILIATION", "", "BACKFILL_750", "BACKFILL_150"}

            def _classify_src_py(src):
                """Python-side mirror of the JS classifySource() function."""
                s = (src or "").upper()
                if any(x in s for x in ("PROMO_PURCHASE", "PRIME_750", "SUBSCRIPTION_750")):
                    return "SUBSCRIPTION_750"
                if any(x in s for x in ("MONTHLY_759", "MONTHLY_1000", "SMART_SSP", "MONTHLY_FIRST_SEASON")):
                    return "SMART_SSP"
                if any(x in s for x in ("ECOUPON", "COUPON_150", "SELF_250", "SELF_ACCOUNT", "SELF_REBIRTH", "PRIME_150", "PRIME150")):
                    return "SELF_REBIRTH"
                return None

            # Build expected category sequences from chronological purchase history
            _purchases = list(
                _PP.objects.filter(user=user, status="APPROVED")
                .select_related("package")
                .order_by("approved_at", "id")
            )
            _five_seq = []
            _three_seq = []
            _seen_seasons = set()
            for _p in _purchases:
                _pkg = getattr(_p, "package", None)
                if not _pkg:
                    continue
                _ptype = str(getattr(_pkg, "type", "") or "")
                _pcode = str(getattr(_pkg, "code", "") or "").upper()
                if _ptype == "PRIME":
                    if "750" in _pcode:
                        _five_seq.append("SUBSCRIPTION_750")
                        _three_seq.append("SUBSCRIPTION_750")
                    elif "150" in _pcode:
                        # Self Rebirth should create seats in BOTH matrices.
                        _five_seq.append("SELF_REBIRTH")
                        _three_seq.append("SELF_REBIRTH")
                elif _ptype == "MONTHLY":
                    # Only the first approved purchase per (package, package_number/season) opens matrix
                    _sk = (getattr(_pkg, "id", None), getattr(_p, "package_number", None))
                    if _sk not in _seen_seasons:
                        _seen_seasons.add(_sk)
                        _five_seq.append("SMART_SSP")
                        _three_seq.append("SMART_SSP")

            # Count categories already covered by non-ambiguous (explicitly tagged) positions
            _five_counts = _Counter()
            _three_counts = _Counter()
            for _pos in my_positions:
                _src = (_pos.get("source_type") or "").upper()
                _pool = _pos.get("pool_type", "")
                if _src in _AMBIG:
                    continue
                _cat = _classify_src_py(_pos.get("source_type", ""))
                if _cat:
                    if _pool == "FIVE_150":
                        _five_counts[_cat] += 1
                    elif _pool == "THREE_150":
                        _three_counts[_cat] += 1

            # Build the remaining expected sequence (remove already-covered items from the front)
            def _remaining_iter(seq, counts):
                left = dict(counts)
                rem = []
                for c in seq:
                    if left.get(c, 0) > 0:
                        left[c] -= 1
                    else:
                        rem.append(c)
                return iter(rem)

            _five_iter = _remaining_iter(_five_seq, _five_counts)
            _three_iter = _remaining_iter(_three_seq, _three_counts)

            # Assign inferred_category to each position
            for _pos in my_positions:
                _src = (_pos.get("source_type") or "").upper()
                _pool = _pos.get("pool_type", "")
                if _src not in _AMBIG or _src == "SENTINEL":
                    # Already has a meaningful source_type; JS classifySource will handle it
                    _pos["inferred_category"] = ""
                    continue
                if _pool == "FIVE_150":
                    # If we have more ambiguous seats than known purchase history can explain,
                    # bucket the remainder into SELF_REBIRTH so they remain visible in UI.
                    _pos["inferred_category"] = next(_five_iter, "SELF_REBIRTH")
                elif _pool == "THREE_150":
                    _pos["inferred_category"] = next(_three_iter, "SELF_REBIRTH")
                else:
                    _pos["inferred_category"] = ""
        except Exception:
            pass

        # Recent team members (latest 10)
        recent_team = list(
            CustomUser.objects.filter(registered_by=user)
            .order_by("-date_joined")
            .values("id", "username", "category", "role", "date_joined", "account_active")[:10]
        )

        # Recent reward-related wallet transactions (latest 20 across relevant types)
        relevant_types = [
            "DIRECT_REF_BONUS", "LEVEL_BONUS",
            "AUTOPOOL_BONUS_THREE", "AUTOPOOL_BONUS_FIVE",
            "COMMISSION_CREDIT", "FRANCHISE_INCOME", "REWARD_CREDIT"
        ]
        recent_tx = list(
            tx.filter(type__in=relevant_types)
            .order_by("-created_at")
            .values("id", "amount", "type", "source_type", "source_id", "meta", "created_at")[:20]
        )
        # Cast Decimal amounts to strings
        for r in recent_tx:
            try:
                r["amount"] = str(r["amount"])
            except Exception:
                pass

        # Direct team (effective sponsor-based directs) with phone, pincode, and their direct referral counts
        # Rule:
        # - If a child's sponsor_id resolves to a valid user, that resolved sponsor is authoritative.
        # - Else fallback to registered_by.
        # This ensures admin sponsor_id changes reflect in Direct Summary immediately.
        try:
            # Build robust identifiers for current user to discover sponsor_id token matches.
            vals = []
            tr = (getattr(user, "prefixed_id", "") or "").strip()
            if tr:
                vals.append(tr)
                if "-" in tr:
                    vals.append(tr.replace("-", "", 1))
                elif len(tr) > 2 and tr[:2].isalpha():
                    vals.append(f"{tr[:2]}-{tr[2:]}")
            uid = (getattr(user, "unique_id", "") or "").strip()
            if uid:
                vals.append(uid)
            uname = (getattr(user, "username", "") or "").strip()
            if uname:
                vals.append(uname)
            digits = "".join(ch for ch in ((getattr(user, "phone", "") or "")) if ch.isdigit())
            if digits:
                vals.append(digits)
            idents = [s for s in {v for v in vals if v}]

            def _owner_id_by_token(token: str):
                try:
                    s = (token or "").strip()
                except Exception:
                    s = ""
                if not s:
                    return None
                q = Q(prefixed_id__iexact=s) | Q(username__iexact=s) | Q(unique_id__iexact=s)
                digs = "".join(ch for ch in s if ch.isdigit())
                if digs:
                    q = q | Q(phone__iexact=digs) | Q(username__iexact=digs)
                obj = CustomUser.objects.filter(q).only("id").first()
                return getattr(obj, "id", None)

            # Candidate pool: old FK links and current sponsor token matches
            candidates = list(
                CustomUser.objects
                .filter(Q(registered_by_id=user.id) | Q(sponsor_id__in=idents))
                .exclude(id=user.id)
                .only(
                    "id", "username", "full_name", "category", "role", "date_joined",
                    "account_active", "phone", "pincode", "registered_by_id", "sponsor_id"
                )
                .order_by("-date_joined")[:1500]
            )

            # Accept only effective directs for current user
            allowed_ids = []
            for c in candidates:
                try:
                    sid = (getattr(c, "sponsor_id", "") or "").strip()
                    if sid:
                        owner = _owner_id_by_token(sid)
                        if owner is not None:
                            if owner == user.id:
                                allowed_ids.append(c.id)
                            # sponsor_id resolved to some other user -> do not fallback to registered_by
                            continue
                    # fallback path only when sponsor_id is blank/unresolvable
                    if getattr(c, "registered_by_id", None) == user.id:
                        allowed_ids.append(c.id)
                except Exception:
                    continue

            base_qs = (
                CustomUser.objects
                .filter(id__in=[i for i in allowed_ids if i])
                .exclude(id=user.id)
                .annotate(direct_referrals=Count("registrations", distinct=True))
                .order_by("-date_joined")
            )

            direct_active = base_qs.filter(account_active=True).count()
            direct_inactive = base_qs.filter(account_active=False).count()

            # Limit to reasonable number for UI; frontend can page later if needed
            direct_team = list(
                base_qs.values(
                    "id", "username", "full_name", "category", "role", "date_joined",
                    "account_active", "phone", "pincode", "direct_referrals"
                )[:200]
            )
            direct_counts = {"active": int(direct_active), "inactive": int(direct_inactive)}
        except Exception:
            direct_team = []
            direct_counts = {"active": 0, "inactive": 0}

        return Response(
            {
                "downline": {
                    # Keep direct count aligned with effective direct_team list to avoid UI fallback
                    # paths reintroducing stale registered_by-only rows.
                    "direct": int(len(direct_team or [])),
                    "levels": {
                        "l1": levels_1_5[0] if len(levels_1_5) > 0 else 0,
                        "l2": levels_1_5[1] if len(levels_1_5) > 1 else 0,
                        "l3": levels_1_5[2] if len(levels_1_5) > 2 else 0,
                        "l4": levels_1_5[3] if len(levels_1_5) > 3 else 0,
                        "l5": levels_1_5[4] if len(levels_1_5) > 4 else 0,
                    },
                },
                "totals": totals,
                "generation_levels_breakdown": gen_breakdown,
                "commissions_split": comm_split,
                "matrix_progress": matrix,
                "my_positions": my_positions,
                "direct_team": direct_team,
                "direct_team_counts": direct_counts,
                "recent_team": recent_team,
                "recent_transactions": recent_tx,
            },
            status=status.HTTP_200_OK,
        )


# ====================
# Wallet API Endpoints
# ====================

class WalletMe(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Event-driven reevaluation of rank upgrade holds on wallet fetch
        try:
            from mlm_ranks.services.five_matrix import FiveMatrixService
            FiveMatrixService.reevaluate_user_holds(getattr(request.user, "id", None))
        except Exception:
            pass
        # If account is inactive, always show zero balances
        inactive = False
        try:
            inactive = not bool(getattr(request.user, "account_active", False))
        except Exception:
            inactive = False

        # Lazy import to avoid circulars and to read current tax config
        try:
            from business.models import CommissionConfig
            cfg = CommissionConfig.get_solo()
            tax_percent = str(getattr(cfg, "tax_percent", 10))
        except Exception:
            tax_percent = "10"

        if inactive:
            return Response({
                "balance": "0",
                "main_balance": "0",
                "withdrawable_balance": "0",
                "tax_percent": tax_percent,
                "updated_at": None,
                "auto_block": {
                    "block_size": "1000.00",
                    "total_blocks": 0,
                    "applied_blocks": 0,
                    "pending_blocks": 0,
                    "last_applied": None
                },
                "breakdown_per_block": {
                    "coupon_cost": "150.00",
                    "tds": "50.00",
                    "direct_ref_bonus": "50.00"
                },
                "redeem_points": {
                    "self": 0,
                    "refer": 0
                },
                "next_block": {
                    "completed_in_current_block": "0.00",
                    "remaining_to_next_block": "1000.00",
                    "progress_percent": 0
                }
            }, status=status.HTTP_200_OK)

        w = Wallet.get_or_create_for_user(request.user)
        # Auto-apply any pending ₹1000 blocks on wallet fetch (idempotent via AuditTrail)

        # Enhanced wallet meta for UI (best-effort; all exceptions guarded)
        try:
            from decimal import Decimal as D
            block_size = D("1000.00")
            main = D(str(getattr(w, "main_balance", 0) or 0))
            total_blocks = int(main // block_size)
            try:
                from coupons.models import AuditTrail
                applied_blocks = int(
                    AuditTrail.objects.filter(action="auto_1k_block_applied", actor=request.user).count()
                )
                last_obj = (
                    AuditTrail.objects
                    .filter(action="auto_1k_block_applied", actor=request.user)
                    .only("id", "created_at", "metadata")
                    .order_by("-id")
                    .first()
                )
                last_applied = {
                    "id": getattr(last_obj, "id", None),
                    "created_at": getattr(last_obj, "created_at", None),
                    "metadata": getattr(last_obj, "metadata", None),
                } if last_obj else None
            except Exception:
                applied_blocks = 0
                last_applied = None
            pending_blocks = max(0, total_blocks - applied_blocks)
            rem = main - (block_size * D(str(total_blocks)))
            if rem < D("0"):
                rem = D("0")
            try:
                progress_percent = int((rem / block_size) * D("100"))
            except Exception:
                progress_percent = 0
            remaining_to_next = (block_size - rem) if block_size > rem else D("0")
        except Exception:
            block_size = "1000.00"
            total_blocks = 0
            applied_blocks = 0
            pending_blocks = 0
            rem = 0
            progress_percent = 0
            remaining_to_next = "1000.00"
            last_applied = None

        # Redeem point counters (self vs direct referrals), best-effort
        try:
            from coupons.models import AuditTrail
            self_redeems = int(AuditTrail.objects.filter(action="coupon_activated", actor=request.user).count())
            direct_ids = list(CustomUser.objects.filter(registered_by=request.user).values_list("id", flat=True))
            refer_redeems = int(AuditTrail.objects.filter(action="coupon_activated", actor_id__in=direct_ids).count()) if direct_ids else 0
        except Exception:
            self_redeems = 0
            refer_redeems = 0

        # ===== Wallet summary extras for Consumer Wallet UI (best-effort; guarded) =====
        try:
            from django.utils import timezone as _tz
            today = _tz.localdate()
            tx_all = WalletTransaction.objects.filter(user=request.user)

            def _sum_t(qs):
                val = qs.aggregate(total=Sum("amount"))["total"] or 0
                return str(val)

            direct_ref_total = _sum_t(tx_all.filter(type="DIRECT_REF_BONUS"))
            matrix_five_total = _sum_t(tx_all.filter(type="AUTOPOOL_BONUS_FIVE"))
            matrix_three_total = _sum_t(tx_all.filter(type="AUTOPOOL_BONUS_THREE"))
            matrix_total = _sum_t(tx_all.filter(type__in=["LEVEL_BONUS", "AUTOPOOL_BONUS_THREE", "AUTOPOOL_BONUS_FIVE"]))
            global_tri_total = _sum_t(tx_all.filter(type="GLOBAL_ROYALTY"))
            global_turnover_total = _sum_t(tx_all.filter(type="GLOBAL_ACTIVATION_CREDIT"))
            from decimal import Decimal as D
            withdrawal_benefit_total = _sum_t(tx_all.filter(type="LIFETIME_WITHDRAWAL_BONUS"))
            commission_total = _sum_t(tx_all.filter(type="COMMISSION_CREDIT"))
            franchise_total = _sum_t(tx_all.filter(type="FRANCHISE_INCOME"))
            direct_ref_withdraw_commission_total = _sum_t(
                tx_all.filter(type="DIRECT_REF_BONUS").filter(Q(meta__auto_rule="AUTO_1K_BLOCK") | Q(source_type="AUTO_1K_BLOCK"))
            )
            # Level-only bonus = matrix_total - (five + three)
            try:
                level_bonus_total = str(
                    (D(str(matrix_total)) - D(str(matrix_five_total)) - D(str(matrix_three_total))).quantize(D("0.01"))
                )
            except Exception:
                level_bonus_total = "0"
            # Today earning: sum of positive credits across ALL income sources (exclude debits/withholding)
            today_earning = _sum_t(
                tx_all.filter(
                    created_at__date=today,
                    amount__gt=0,
                    type__in=[
                        "DIRECT_REF_BONUS",
                        "LEVEL_BONUS",
                        "AUTOPOOL_BONUS_FIVE",
                        "AUTOPOOL_BONUS_THREE",
                        "GLOBAL_ROYALTY",
                        "GLOBAL_ACTIVATION_CREDIT",
                        "COMMISSION_CREDIT",
                        "FRANCHISE_INCOME",
                        "LIFETIME_WITHDRAWAL_BONUS",
                    ],
                )
            )
            # All earnings (gross without TDS): sum of positive credits across all earning types
            earn_types = [
                "DIRECT_REF_BONUS",
                "LEVEL_BONUS",
                "AUTOPOOL_BONUS_FIVE",
                "AUTOPOOL_BONUS_THREE",
                "GLOBAL_ROYALTY",
                "GLOBAL_ACTIVATION_CREDIT",
                "COMMISSION_CREDIT",
                "FRANCHISE_INCOME",
                "LIFETIME_WITHDRAWAL_BONUS",
                "REWARD_CREDIT",
                "REDEEM_ECOUPON_CREDIT",
                "SELF_BONUS_ACTIVE",
            ]
            all_earnings_total = _sum_t(tx_all.filter(amount__gt=0, type__in=earn_types))
        except Exception:
            direct_ref_total = "0"
            matrix_five_total = "0"
            matrix_three_total = "0"
            matrix_total = "0"
            global_tri_total = "0"
            global_turnover_total = "0"
            withdrawal_benefit_total = "0"
            commission_total = "0"
            franchise_total = "0"
            level_bonus_total = "0"
            today_earning = "0"
            direct_ref_withdraw_commission_total = "0"
            all_earnings_total = "0"

        # Prime and Monthly activity snapshot
        try:
            from business.models import PromoPurchase, PromoMonthlyBox
            prime_active_count = PromoPurchase.objects.filter(user=request.user, package__type="PRIME", status="APPROVED").count()
            last_prime = PromoPurchase.objects.filter(user=request.user, package__type="PRIME", status="APPROVED").order_by("-approved_at").first()
            last_prime_date = getattr(last_prime, "approved_at", None)
            monthly_active_count = PromoMonthlyBox.objects.filter(user=request.user).count()
            monthly_pending_count = PromoPurchase.objects.filter(user=request.user, package__type="MONTHLY", status="PENDING").count()
            approved_season_numbers = list(
                PromoMonthlyBox.objects.filter(user=request.user)
                .values_list("package_number", flat=True)
                .distinct()
            )
        except Exception:
            prime_active_count = 0
            last_prime_date = None
            monthly_active_count = 0
            monthly_pending_count = 0
            approved_season_numbers = []

        # Spin & Win eligibility
        try:
            from uploads.models import LuckySpinDraw, LuckySpinAttempt
            now = timezone.now()
            draw = LuckySpinDraw.objects.filter(locked=True, start_at__lte=now, end_at__gte=now).order_by("start_at").first()
            spin_eligible = False
            if draw:
                att = LuckySpinAttempt.objects.filter(draw=draw, user=request.user).first()
                spin_eligible = False if att else True
        except Exception:
            spin_eligible = False

        # Coupon activity summary
        try:
            from django.utils import timezone as _tz2
            from coupons.models import AuditTrail as _AT
            self_activated = int(_AT.objects.filter(action="coupon_activated", actor=request.user).count())
            month_start = _tz2.now().replace(day=1).date()
            monthly_self_benefit = int(WalletTransaction.objects.filter(user=request.user, type="SELF_BONUS_ACTIVE", created_at__date__gte=month_start).count())
        except Exception:
            self_activated = 0
            monthly_self_benefit = 0

        # Derived transfer wallet balances from ledger-only buckets
        try:
            from decimal import Decimal as D

            def _wallet_sum(credit_types, debit_types=None):
                credit = tx_all.filter(type__in=list(credit_types or []), amount__gt=0).aggregate(total=Sum("amount"))["total"] or D("0.00")
                debit = tx_all.filter(type__in=list(debit_types or []), amount__lt=0).aggregate(total=Sum("amount"))["total"] or D("0.00")
                return str((D(str(credit)) + D(str(debit))).quantize(D("0.01")))

            shopping_wallet_balance = _wallet_sum(["SHOPPING_WALLET_CREDIT"], ["SHOPPING_WALLET_DEBIT"])
            coupon_wallet_balance = _wallet_sum(
                ["COUPON_WALLET_CREDIT", "COUPON_WALLET_REFUND"],
                ["COUPON_WALLET_DEBIT", "VOUCHER_CREATE_DEBIT"],
            )
            internal_wallet_balance = _wallet_sum(["INTERNAL_WALLET_CREDIT"], ["INTERNAL_WALLET_DEBIT"])
            package_coupon_wallet_balance = _wallet_sum(["PACKAGE_COUPON_WALLET_CREDIT", "VOUCHER_REDEEM_CREDIT"], ["PACKAGE_COUPON_WALLET_DEBIT"])
            wallet_transfer_total = _wallet_sum(["WALLET_TO_WALLET_IN"], ["WALLET_TO_WALLET_OUT"])
            withdrawal_wallet_balance = str((D(str(getattr(w, "withdrawable_balance", 0) or 0))).quantize(D("0.01")))
            package_upload_balance = _wallet_sum(
                [
                    "WALLET_UPLOAD_CREDIT",
                    "PACKAGE_UPLOAD_CREDIT",
                    "PACKAGE_BUY_UPLOAD_CREDIT",
                    "UPLOAD_TO_WALLET_CREDIT",
                ],
                [
                    "PACKAGE_UPLOAD_DEBIT",
                    "PACKAGE_BUY_UPLOAD_DEBIT",
                    "UPLOAD_TO_WALLET_DEBIT",
                ],
            )
            try:
                upload_sources = ["WALLET_UPLOAD", "UPLOAD_TO_WALLET", "PACKAGE_UPLOAD", "PACKAGE_BUY_UPLOAD"]
                source_credit = tx_all.filter(source_type__in=upload_sources, amount__gt=0).aggregate(total=Sum("amount"))["total"] or D("0.00")
                source_debit = tx_all.filter(source_type__in=upload_sources, amount__lt=0).aggregate(total=Sum("amount"))["total"] or D("0.00")
                typed_total = D(str(package_upload_balance or "0"))
                source_total = D(str(source_credit)) + D(str(source_debit))
                if source_total > typed_total:
                    package_upload_balance = str(source_total.quantize(D("0.01")))
            except Exception:
                pass
        except Exception:
            shopping_wallet_balance = "0.00"
            coupon_wallet_balance = "0.00"
            internal_wallet_balance = "0.00"
            package_coupon_wallet_balance = "0.00"
            wallet_transfer_total = "0.00"
            withdrawal_wallet_balance = str(getattr(w, "withdrawable_balance", 0) or 0)
            package_upload_balance = "0.00"

        return Response({
            "balance": str(w.balance),                       # total (legacy)
            "main_balance": str(getattr(w, "main_balance", 0) or 0),
            "withdrawable_balance": str(getattr(w, "withdrawable_balance", 0) or 0),
            "tax_percent": tax_percent,
            "updated_at": w.updated_at,
            "auto_block": {
                "block_size": str(block_size),
                "total_blocks": int(total_blocks),
                "applied_blocks": int(applied_blocks),
                "pending_blocks": int(pending_blocks),
                "last_applied": last_applied
            },
            "breakdown_per_block": {
                "coupon_cost": "150.00",
                "tds": "50.00",
                "direct_ref_bonus": "50.00"
            },
            "redeem_points": {
                "self": int(self_redeems),
                "refer": int(refer_redeems)
            },
            "next_block": {
                "completed_in_current_block": str(rem),
                "remaining_to_next_block": str(remaining_to_next),
                "progress_percent": int(progress_percent)
            },
            # Sketch-driven wallet summary extensions
            "prime": {
                "activeCount": int(prime_active_count),
                "monthlyActiveCount": int(monthly_active_count),
                "monthlyPendingCount": int(monthly_pending_count),
                "seasonNumbers": [int(x) for x in approved_season_numbers if x is not None],
                "lastActiveDate": last_prime_date,
            },
            "today": {
                "earning": str(today_earning),
                "spinEligible": bool(spin_eligible),
            },
            "income": {
                "directReferral": str(direct_ref_total),
                "matrixFive": str(matrix_five_total),
                "matrixThree": str(matrix_three_total),
                "levelBonus": str(level_bonus_total),
                "commission": str(commission_total),
                "franchise": str(franchise_total),
                "directRefWithdrawCommission": str(direct_ref_withdraw_commission_total),
                "withdrawalBenefit": str(withdrawal_benefit_total),
                "matrixLevel": str(matrix_total),
                "globalTri": str(global_tri_total),
                "globalTurnover": str(global_turnover_total),
            },
            "coupons": {
                "selfActivated": int(self_activated),
                "monthlySelfBenefitActivated": int(monthly_self_benefit),
                "monthlyActivated": int(monthly_active_count),
            },
            "totals": {
                "allEarnings": str(all_earnings_total)
            },
            "limits": {
                "minWithdraw": 500
            },
            "transfer_wallets": {
                "shopping": str(shopping_wallet_balance),
                "coupon": str(coupon_wallet_balance),
                "internal": str(internal_wallet_balance),
                "packagePurchaseCoupon": str(package_coupon_wallet_balance),
                "walletToWallet": str(wallet_transfer_total),
                "withdrawal": str(withdrawal_wallet_balance),
                "packageUpload": str(package_upload_balance),
            },
            "smart_purchase": {
                "seasonPurchasedCount": int(monthly_active_count),
                "seasonPendingCount": int(monthly_pending_count),
                "seasonNumbers": [int(x) for x in approved_season_numbers if x is not None],
            }
        }, status=status.HTTP_200_OK)


def _resolve_consumer_user(identifier):
    s = str(identifier or "").strip()
    if not s:
        return None
    digits = "".join(ch for ch in s if ch.isdigit())
    q = Q(username__iexact=s) | Q(prefixed_id__iexact=s) | Q(unique_id__iexact=s)
    if digits:
        q = q | Q(phone__iexact=digits)
    user = CustomUser.objects.filter(q, category="consumer").first()
    return user


def _otp_cache_key(user_id, purpose):
    return f"wallet_transfer_otp:{user_id}:{purpose}"


def _send_wallet_otp(user, purpose, otp):
    recipient = getattr(user, "email", None)
    if not recipient:
        raise serializers.ValidationError({"detail": "Email is required to send OTP."})
    subject = "Trikonekt Wallet Transfer OTP"
    message = (
        f"Hello {getattr(user, 'full_name', '') or getattr(user, 'username', 'User')},\n\n"
        f"Your OTP for {purpose.replace('_', ' ')} is: {otp}\n"
        "This OTP is valid for 10 minutes.\n\n"
        "If you did not request this, please ignore this email.\n\n"
        "Regards,\nTrikonekt Team"
    )
    send_mail(
        subject,
        message,
        getattr(settings, "DEFAULT_FROM_EMAIL", None) or getattr(settings, "EMAIL_HOST_USER", None),
        [recipient],
        fail_silently=False,
    )


def _move_main_to_derived_wallet(user, amount, target_type, extra_meta=None):
    from decimal import Decimal as D

    amount = D(str(amount or "0"))
    if amount <= D("0"):
        raise serializers.ValidationError({"amount": "Amount must be greater than 0."})

    charge_percent_map = {
        "coupon": D("7.00"),
        "internal": D("7.00"),
        "withdrawal": D("10.00"),
    }
    charge_percent = charge_percent_map.get(target_type, D("0.00"))
    charge_amount = ((amount * charge_percent) / D("100")).quantize(D("0.01"))
    net_amount = (amount - charge_amount).quantize(D("0.01"))
    if net_amount <= D("0"):
        raise serializers.ValidationError({"detail": "Transfer amount is too small after admin service charge."})

    def _get_admin_wallet_user():
        try:
            from business.models import CommissionConfig, RootConsumerConfig
            cfg = CommissionConfig.get_solo()
            root_user = RootConsumerConfig.get_solo().get_root_user()
            return root_user or getattr(cfg, "tax_company_user", None)
        except Exception:
            pass
        try:
            return CustomUser.objects.filter(category="company").first() or CustomUser.objects.filter(is_superuser=True).first()
        except Exception:
            return None

    wallet = Wallet.get_or_create_for_user(user)
    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)
        if D(str(getattr(wallet, "main_balance", 0) or 0)) < amount:
            raise serializers.ValidationError({"detail": "Insufficient main wallet balance."})

        meta = {
            "target_wallet": target_type,
            "gross_amount": str(amount),
            "net_amount": str(net_amount),
            "admin_service_charge_percent": str(charge_percent),
            "admin_service_charge_amount": str(charge_amount),
            **(extra_meta or {}),
        }

        if target_type == "withdrawal":
            wallet.main_balance = (wallet.main_balance or D("0")) - amount
            wallet.withdrawable_balance = (wallet.withdrawable_balance or D("0")) + net_amount
            if charge_amount > D("0"):
                wallet.balance = (wallet.balance or D("0")) - charge_amount
                if wallet.balance < D("0"):
                    wallet.balance = D("0")
            wallet.save(update_fields=["balance", "main_balance", "withdrawable_balance", "updated_at"])
            WalletTransaction.objects.create(
                user=user,
                amount=amount * D("-1"),
                balance_after=wallet.balance,
                type="WITHDRAWAL_WALLET_TRANSFER_OUT",
                source_type="MAIN_TO_WITHDRAWAL",
                source_id="",
                meta=meta,
            )
            WalletTransaction.objects.create(
                user=user,
                amount=net_amount,
                balance_after=wallet.balance,
                type="WITHDRAWAL_WALLET_CREDIT",
                source_type="MAIN_TO_WITHDRAWAL",
                source_id="",
                meta=meta,
            )
            if charge_amount > D("0"):
                WalletTransaction.objects.create(
                    user=user,
                    amount=charge_amount * D("-1"),
                    balance_after=wallet.balance,
                    type="ADJUSTMENT_DEBIT",
                    source_type="ADMIN_SERVICE_CHARGE",
                    source_id="MAIN_TO_WITHDRAWAL",
                    meta=meta,
                )
                admin_user = _get_admin_wallet_user()
                if admin_user:
                    admin_wallet = Wallet.get_or_create_for_user(admin_user)
                    admin_wallet.credit(
                        charge_amount,
                        tx_type="TAX_POOL_CREDIT",
                        meta={**meta, "from_user_id": user.id, "from_user": user.username, "no_withhold": True},
                        source_type="ADMIN_SERVICE_CHARGE",
                        source_id=str(user.id),
                    )
            return {"status": "ok", "wallet": "withdrawal", "amount": str(amount), "net_amount": str(net_amount), "admin_service_charge": str(charge_amount)}

        credit_type_map = {
            "shopping": "SHOPPING_WALLET_CREDIT",
            "coupon": "COUPON_WALLET_CREDIT",
            "internal": "INTERNAL_WALLET_CREDIT",
        }
        debit_type_map = {
            "shopping": "SHOPPING_WALLET_TRANSFER_OUT",
            "coupon": "COUPON_WALLET_TRANSFER_OUT",
            "internal": "INTERNAL_WALLET_TRANSFER_OUT",
        }
        if target_type not in credit_type_map:
            raise serializers.ValidationError({"detail": "Unsupported wallet transfer type."})

        wallet.main_balance = (wallet.main_balance or D("0")) - amount
        if charge_amount > D("0"):
            wallet.balance = (wallet.balance or D("0")) - charge_amount
            if wallet.balance < D("0"):
                wallet.balance = D("0")
        wallet.save(update_fields=["balance", "main_balance", "updated_at"])
        WalletTransaction.objects.create(
            user=user,
            amount=amount * D("-1"),
            balance_after=wallet.balance,
            type=debit_type_map[target_type],
            source_type=f"MAIN_TO_{target_type.upper()}",
            source_id="",
            meta=meta,
        )
        WalletTransaction.objects.create(
            user=user,
            amount=net_amount,
            balance_after=wallet.balance,
            type=credit_type_map[target_type],
            source_type=f"MAIN_TO_{target_type.upper()}",
            source_id="",
            meta=meta,
        )
        if charge_amount > D("0"):
            WalletTransaction.objects.create(
                user=user,
                amount=charge_amount * D("-1"),
                balance_after=wallet.balance,
                type="ADJUSTMENT_DEBIT",
                source_type="ADMIN_SERVICE_CHARGE",
                source_id=f"MAIN_TO_{target_type.upper()}",
                meta=meta,
            )
            admin_user = _get_admin_wallet_user()
            if admin_user:
                admin_wallet = Wallet.get_or_create_for_user(admin_user)
                admin_wallet.credit(
                    charge_amount,
                    tx_type="TAX_POOL_CREDIT",
                    meta={**meta, "from_user_id": user.id, "from_user": user.username, "no_withhold": True},
                    source_type="ADMIN_SERVICE_CHARGE",
                    source_id=str(user.id),
                )
    return {"status": "ok", "wallet": target_type, "amount": str(amount), "net_amount": str(net_amount), "admin_service_charge": str(charge_amount)}


class WalletTransferConsumerLookup(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        identifier = request.query_params.get("consumer_id") or request.query_params.get("identifier")
        user = _resolve_consumer_user(identifier)
        if not user:
            return Response({"detail": "Consumer not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            "id": user.id,
            "username": user.username,
            "prefixed_id": getattr(user, "prefixed_id", "") or "",
            "full_name": getattr(user, "full_name", "") or "",
            "pincode": getattr(user, "pincode", "") or "",
        })


class WalletTransferOtpRequest(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        transfer_type = str(request.data.get("transfer_type") or "").strip().lower()
        amount = request.data.get("amount")
        target_consumer_id = request.data.get("target_consumer_id") or request.data.get("consumer_id")

        allowed = {"shopping", "coupon", "internal", "wallet_to_wallet", "withdrawal"}
        if transfer_type not in allowed:
            return Response({"detail": "Invalid transfer_type."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from decimal import Decimal as D
            amount_d = D(str(amount or "0"))
        except Exception:
            return Response({"detail": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)

        if amount_d <= 0:
            return Response({"detail": "Amount must be greater than 0."}, status=status.HTTP_400_BAD_REQUEST)

        recipient = None
        if transfer_type == "wallet_to_wallet":
            recipient = _resolve_consumer_user(target_consumer_id)
            if not recipient:
                return Response({"detail": "Recipient consumer not found."}, status=status.HTTP_404_NOT_FOUND)
            if recipient.id == request.user.id:
                return Response({"detail": "You cannot transfer to yourself."}, status=status.HTTP_400_BAD_REQUEST)

        otp = f"{random.randint(100000, 999999)}"
        key = _otp_cache_key(request.user.id, transfer_type)
        cache.set(
            key,
            {
                "otp": otp,
                "amount": str(amount_d),
                "transfer_type": transfer_type,
                "target_consumer_id": getattr(recipient, "id", None),
            },
            timeout=600,
        )
        _send_wallet_otp(request.user, transfer_type, otp)
        return Response({"detail": "OTP sent to your registered email.", "expires_in": 600})


class WalletTransferConfirm(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from decimal import Decimal as D

        transfer_type = str(request.data.get("transfer_type") or "").strip().lower()
        otp = str(request.data.get("otp") or "").strip()
        key = _otp_cache_key(request.user.id, transfer_type)
        payload = cache.get(key)
        if not payload or str(payload.get("otp")) != otp:
            return Response({"detail": "Invalid or expired OTP."}, status=status.HTTP_400_BAD_REQUEST)

        amount = D(str(payload.get("amount") or "0"))
        target_consumer_id = payload.get("target_consumer_id")

        if transfer_type in {"shopping", "coupon", "internal", "withdrawal"}:
            result = _move_main_to_derived_wallet(request.user, amount, transfer_type)
            cache.delete(key)
            return Response(result, status=status.HTTP_200_OK)

        if transfer_type == "wallet_to_wallet":
            recipient = CustomUser.objects.filter(id=target_consumer_id, category="consumer").first()
            if not recipient:
                return Response({"detail": "Recipient consumer not found."}, status=status.HTTP_404_NOT_FOUND)

            sender_wallet = Wallet.get_or_create_for_user(request.user)
            with transaction.atomic():
                sender_wallet = Wallet.objects.select_for_update().get(pk=sender_wallet.pk)
                if D(str(getattr(sender_wallet, "main_balance", 0) or 0)) < amount:
                    return Response({"detail": "Insufficient main wallet balance."}, status=status.HTTP_400_BAD_REQUEST)
                sender_wallet.main_balance = (sender_wallet.main_balance or D("0")) - amount
                sender_wallet.save(update_fields=["main_balance", "updated_at"])
                WalletTransaction.objects.create(
                    user=request.user,
                    amount=amount * D("-1"),
                    balance_after=sender_wallet.balance,
                    type="WALLET_TO_WALLET_OUT",
                    source_type="WALLET_TO_WALLET",
                    source_id=str(recipient.id),
                    meta={"to_user_id": recipient.id, "to_user": recipient.username},
                )

                receiver_wallet = Wallet.get_or_create_for_user(recipient)
                receiver_wallet.credit(
                    amount,
                    tx_type="WALLET_TO_WALLET_IN",
                    meta={"from_user_id": request.user.id, "from_user": request.user.username, "no_withhold": True},
                    source_type="WALLET_TO_WALLET",
                    source_id=str(request.user.id),
                )

            cache.delete(key)
            return Response({
                "status": "ok",
                "wallet": "wallet_to_wallet",
                "amount": str(amount),
                "recipient": {
                    "id": recipient.id,
                    "username": recipient.username,
                    "full_name": getattr(recipient, "full_name", "") or "",
                },
            })

        return Response({"detail": "Invalid transfer_type."}, status=status.HTTP_400_BAD_REQUEST)


def _coupon_wallet_balance(user):
    from decimal import Decimal as D

    tx = WalletTransaction.objects.filter(user=user)
    credit = tx.filter(type__in=["COUPON_WALLET_CREDIT", "COUPON_WALLET_REFUND"], amount__gt=0).aggregate(total=Sum("amount"))["total"] or D("0.00")
    debit = tx.filter(type__in=["COUPON_WALLET_DEBIT", "VOUCHER_CREATE_DEBIT"], amount__lt=0).aggregate(total=Sum("amount"))["total"] or D("0.00")
    return (D(str(credit)) + D(str(debit))).quantize(D("0.01"))


def _package_coupon_wallet_balance(user):
    from decimal import Decimal as D

    tx = WalletTransaction.objects.filter(user=user)
    credit = tx.filter(type__in=["PACKAGE_COUPON_WALLET_CREDIT", "VOUCHER_REDEEM_CREDIT"], amount__gt=0).aggregate(total=Sum("amount"))["total"] or D("0.00")
    debit = tx.filter(type="PACKAGE_COUPON_WALLET_DEBIT", amount__lt=0).aggregate(total=Sum("amount"))["total"] or D("0.00")
    return (D(str(credit)) + D(str(debit))).quantize(D("0.01"))


def _voucher_validity_days(voucher_type):
    if voucher_type == ConsumerVoucher.TYPE_PACKAGE_PURCHASE:
        return 7
    return 30


def _generate_voucher_code():
    for _ in range(20):
        code = f"TKV{random.randint(10000000, 99999999)}"
        if not ConsumerVoucher.objects.filter(code=code).exists():
            return code
    return f"TKV{timezone.now().strftime('%y%m%d%H%M%S%f')[-14:]}"


def _expire_active_vouchers_for_user(user):
    from decimal import Decimal as D

    now = timezone.now()
    qs = ConsumerVoucher.objects.select_for_update().filter(
        creator=user,
        status=ConsumerVoucher.STATUS_ACTIVE,
        expires_at__lte=now,
        refund_transaction__isnull=True,
    )
    for voucher in qs:
        wallet = Wallet.get_or_create_for_user(voucher.creator)
        wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)
        amount = D(str(voucher.amount or "0"))
        wallet.balance = (wallet.balance or D("0")) + amount
        wallet.save(update_fields=["balance", "updated_at"])
        refund_tx = WalletTransaction.objects.create(
            user=voucher.creator,
            amount=amount,
            balance_after=wallet.balance,
            type="COUPON_WALLET_REFUND",
            source_type="VOUCHER_EXPIRED",
            source_id=str(voucher.id),
            meta={"voucher_code": voucher.code, "voucher_type": voucher.voucher_type},
        )
        voucher.status = ConsumerVoucher.STATUS_EXPIRED
        voucher.expired_at = now
        voucher.refund_transaction = refund_tx
        voucher.save(update_fields=["status", "expired_at", "refund_transaction"])


class ConsumerVoucherSerializer(serializers.ModelSerializer):
    creator_username = serializers.CharField(source="creator.username", read_only=True)
    assigned_to_username = serializers.CharField(source="assigned_to.username", read_only=True)
    redeemed_by_username = serializers.CharField(source="redeemed_by.username", read_only=True)
    voucher_type_label = serializers.SerializerMethodField()

    class Meta:
        model = ConsumerVoucher
        fields = [
            "id",
            "code",
            "voucher_type",
            "voucher_type_label",
            "amount",
            "status",
            "note",
            "created_at",
            "expires_at",
            "redeemed_at",
            "expired_at",
            "creator_username",
            "assigned_to_username",
            "redeemed_by_username",
        ]

    def get_voucher_type_label(self, obj):
        return dict(ConsumerVoucher.TYPE_CHOICES).get(obj.voucher_type, obj.voucher_type)


class ConsumerVoucherListCreate(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        with transaction.atomic():
            _expire_active_vouchers_for_user(request.user)
        qs = ConsumerVoucher.objects.filter(
            Q(creator=request.user) | Q(assigned_to=request.user) | Q(redeemed_by=request.user)
        ).select_related("creator", "assigned_to", "redeemed_by").order_by("-created_at", "-id")
        status_filter = str(request.query_params.get("status") or "").strip().upper()
        if status_filter:
            qs = qs.filter(status=status_filter)
        data = ConsumerVoucherSerializer(qs[:200], many=True).data
        return Response({
            "coupon_wallet_balance": str(_coupon_wallet_balance(request.user)),
            "package_coupon_wallet_balance": str(_package_coupon_wallet_balance(request.user)),
            "results": data,
        })

    def post(self, request):
        from decimal import Decimal as D

        voucher_type = str(request.data.get("voucher_type") or "").strip().upper()
        if voucher_type not in {choice[0] for choice in ConsumerVoucher.TYPE_CHOICES}:
            return Response({"detail": "Invalid voucher_type."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            amount = D(str(request.data.get("amount") or "0")).quantize(D("0.01"))
        except Exception:
            return Response({"detail": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= D("0"):
            return Response({"detail": "Amount must be greater than 0."}, status=status.HTTP_400_BAD_REQUEST)

        assigned_to = None
        assigned_identifier = request.data.get("assigned_to") or request.data.get("consumer_id") or request.data.get("username")
        if voucher_type == ConsumerVoucher.TYPE_PACKAGE_PURCHASE:
            assigned_to = _resolve_consumer_user(assigned_identifier)
            if not assigned_to:
                return Response({"detail": "Package purchase coupon requires a valid consumer username/ID."}, status=status.HTTP_400_BAD_REQUEST)
            if assigned_to.id == request.user.id:
                return Response({"detail": "Package purchase coupon must be assigned to another consumer."}, status=status.HTTP_400_BAD_REQUEST)

        note = str(request.data.get("note") or "").strip()
        with transaction.atomic():
            _expire_active_vouchers_for_user(request.user)
            available = _coupon_wallet_balance(request.user)
            if available < amount:
                return Response({"detail": "Insufficient Coupon Pocket balance."}, status=status.HTTP_400_BAD_REQUEST)

            wallet = Wallet.get_or_create_for_user(request.user)
            wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)
            wallet.balance = (wallet.balance or D("0")) - amount
            if wallet.balance < D("0"):
                return Response({"detail": "Insufficient wallet balance."}, status=status.HTTP_400_BAD_REQUEST)
            wallet.save(update_fields=["balance", "updated_at"])

            voucher = ConsumerVoucher.objects.create(
                creator=request.user,
                assigned_to=assigned_to,
                voucher_type=voucher_type,
                code=_generate_voucher_code(),
                amount=amount,
                expires_at=timezone.now() + timedelta(days=_voucher_validity_days(voucher_type)),
                note=note,
            )
            debit_tx = WalletTransaction.objects.create(
                user=request.user,
                amount=amount * D("-1"),
                balance_after=wallet.balance,
                type="VOUCHER_CREATE_DEBIT",
                source_type="CONSUMER_VOUCHER",
                source_id=str(voucher.id),
                meta={
                    "voucher_code": voucher.code,
                    "voucher_type": voucher.voucher_type,
                    "assigned_to_user_id": getattr(assigned_to, "id", None),
                },
            )
            voucher.debit_transaction = debit_tx
            voucher.save(update_fields=["debit_transaction"])

        return Response(ConsumerVoucherSerializer(voucher).data, status=status.HTTP_201_CREATED)


class ConsumerVoucherRedeem(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from decimal import Decimal as D

        code = str(request.data.get("code") or "").strip().upper()
        if not code:
            return Response({"detail": "Voucher code is required."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            voucher = ConsumerVoucher.objects.select_for_update().filter(code__iexact=code).select_related("creator", "assigned_to").first()
            if not voucher:
                return Response({"detail": "Voucher not found."}, status=status.HTTP_404_NOT_FOUND)
            _expire_active_vouchers_for_user(voucher.creator)
            voucher = ConsumerVoucher.objects.select_for_update().get(pk=voucher.pk)
            if voucher.status != ConsumerVoucher.STATUS_ACTIVE:
                return Response({"detail": f"Voucher is {voucher.status.lower()}."}, status=status.HTTP_400_BAD_REQUEST)
            if voucher.voucher_type != ConsumerVoucher.TYPE_PACKAGE_PURCHASE:
                return Response({"detail": "Only package purchase coupons can be redeemed from this wallet screen."}, status=status.HTTP_400_BAD_REQUEST)
            if voucher.expires_at <= timezone.now():
                _expire_active_vouchers_for_user(voucher.creator)
                return Response({"detail": "Voucher has expired."}, status=status.HTTP_400_BAD_REQUEST)
            if voucher.creator_id == request.user.id:
                return Response({"detail": "You cannot redeem your own voucher."}, status=status.HTTP_400_BAD_REQUEST)
            if voucher.assigned_to_id and voucher.assigned_to_id != request.user.id:
                return Response({"detail": "This voucher is assigned to another consumer."}, status=status.HTTP_403_FORBIDDEN)

            amount = D(str(voucher.amount or "0"))
            receiver_wallet = Wallet.get_or_create_for_user(request.user)
            receiver_wallet = Wallet.objects.select_for_update().get(pk=receiver_wallet.pk)
            receiver_wallet.balance = (receiver_wallet.balance or D("0")) + amount
            receiver_wallet.save(update_fields=["balance", "updated_at"])
            tx = WalletTransaction.objects.create(
                user=request.user,
                amount=amount,
                balance_after=receiver_wallet.balance,
                type="VOUCHER_REDEEM_CREDIT",
                source_type="CONSUMER_VOUCHER",
                source_id=str(voucher.id),
                meta={
                    "voucher_code": voucher.code,
                    "voucher_type": voucher.voucher_type,
                    "creator_user_id": voucher.creator_id,
                    "destination_wallet": "PACKAGE_PURCHASE_COUPON" if voucher.voucher_type == ConsumerVoucher.TYPE_PACKAGE_PURCHASE else "COUPON_REDEEMED",
                },
            )
            voucher.status = ConsumerVoucher.STATUS_REDEEMED
            voucher.redeemed_by = request.user
            voucher.redeemed_at = timezone.now()
            voucher.redeem_transaction = tx
            voucher.save(update_fields=["status", "redeemed_by", "redeemed_at", "redeem_transaction"])

        return Response(ConsumerVoucherSerializer(voucher).data, status=status.HTTP_200_OK)


class WalletTransactionSerializer(serializers.ModelSerializer):
    tr_username = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    pincode = serializers.SerializerMethodField()
    commission = serializers.SerializerMethodField()

    class Meta:
        model = WalletTransaction
        fields = [
            "id",
            "amount",
            "commission",
            "balance_after",
            "type",
            "source_type",
            "source_id",
            "meta",
            "created_at",
            "tr_username",
            "full_name",
            "pincode",
        ]

    def get_commission(self, obj):
        try:
            return str(obj.amount)
        except Exception:
            return None

    def _resolve_counterparty(self, obj):
        try:
            meta = obj.meta or {}
        except Exception:
            meta = {}
        uid = meta.get("from_user_id") or meta.get("user_id")
        uname = meta.get("from_user") or meta.get("username")
        u = None
        try:
            if uid:
                u = CustomUser.objects.filter(id=uid).only("id", "username", "full_name", "pincode").first()
            if not u and uname:
                u = CustomUser.objects.filter(username__iexact=str(uname)).only("id", "username", "full_name", "pincode").first()
        except Exception:
            u = None
        return u or getattr(obj, "user", None)

    def get_tr_username(self, obj):
        u = self._resolve_counterparty(obj)
        return getattr(u, "username", None)

    def get_full_name(self, obj):
        u = self._resolve_counterparty(obj)
        return getattr(u, "full_name", None)

    def get_pincode(self, obj):
        u = self._resolve_counterparty(obj)
        return getattr(u, "pincode", None)


class LenientWalletTxnPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100

    def paginate_queryset(self, queryset, request, view=None):
        try:
            return super().paginate_queryset(queryset, request, view)
        except NotFound:
            # When requested page is out of range, return empty page instead of 404
            self.request = request
            try:
                self.count = queryset.count()
            except Exception:
                self.count = 0
            self.page = None
            return []

    def get_paginated_response(self, data):
        if getattr(self, "page", None) is None:
            return Response({
                "count": int(getattr(self, "count", 0) or 0),
                "next": None,
                "previous": None,
                "results": data,
            })
        return super().get_paginated_response(data)


class WalletTransactionsList(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = WalletTransactionSerializer
    pagination_class = LenientWalletTxnPagination

    def get_queryset(self):
        qs = WalletTransaction.objects.filter(user=self.request.user).order_by("-created_at")
        t = (self.request.query_params.get("type") or "").strip()
        if t:
            qs = qs.filter(type=t)

        # Optional date range filtering on created_at (date). Apply only if provided.
        date_from = (self.request.query_params.get("date_from") or "").strip()
        date_to = (self.request.query_params.get("date_to") or "").strip()
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        return qs


# ====================
# KYC + Withdrawals API
# ====================

class UserKYCMeView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserKYCSerializer

    def get_object(self):
        # Ensure the user's KYC row exists
        from .models import UserKYC
        obj, _ = UserKYC.objects.get_or_create(user=self.request.user)
        return obj


class WithdrawalCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = WithdrawalRequestSerializer
    queryset = WalletTransaction.objects.none()  # unused, but DRF requires queryset on generic views

    def perform_create(self, serializer):
        serializer.save()


class MyWithdrawalsListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = WithdrawalRequestSerializer

    def get_queryset(self):
        from .models import WithdrawalRequest
        return WithdrawalRequest.objects.filter(user=self.request.user).order_by("-requested_at")


# ====================
# Wallet History + Banks + Spend APIs
# ====================

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from decimal import Decimal as D

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def wallet_me_history(request):
    """
    Grouped wallet history and top balances for the authenticated user.
    """
    user = request.user
    w = Wallet.get_or_create_for_user(user)
    # Ensure any pending ₹1k blocks are applied before reading history (idempotent via AuditTrail)
    try:
        from .models import RewardPointsAccount, RewardPointsTransaction
        rpa = RewardPointsAccount.get_or_create_for_user(user)
        rp_balance = str(rpa.balance_points or D("0.00"))
    except Exception:
        rp_balance = "0.00"

    def txmap(tx):
        try:
            amt = str(tx.amount)
        except Exception:
            amt = "0.00"
        return {
            "id": tx.id,
            "type": tx.type,
            "amount": amt,
            "created_at": tx.created_at.isoformat() if getattr(tx, "created_at", None) else None,
            "status": "success",
            "meta": tx.meta or {},
            "source_type": tx.source_type or "",
            "source_id": tx.source_id or "",
        }

    # Top summary
    top = {
        "main_income_balance": str(getattr(w, "main_balance", 0) or 0),
        "self_account_balance": str(getattr(w, "self_account_balance", 0) or 0),
        "withdrawable_balance": str(getattr(w, "withdrawable_balance", 0) or 0),
        "shopping_rewards_points": rp_balance,
        "redeem_points": rp_balance,
    }

    # Buckets
    incoming_types = [
        "INCOME_CREDIT_75",
        "COMMISSION_CREDIT",
        "DIRECT_REF_BONUS",
        "LEVEL_BONUS",
        "AUTOPOOL_BONUS_THREE",
        "AUTOPOOL_BONUS_FIVE",
        "FRANCHISE_INCOME",
        "GLOBAL_ROYALTY",
        "GLOBAL_ACTIVATION_CREDIT",
        "PRIME_ACTIVATION_CREDIT",
        "MONTHLY_759_DIRECT",
        "MONTHLY_759_SELF",
    ]
    incoming_qs = WalletTransaction.objects.filter(user=user, type__in=incoming_types, amount__gt=0).order_by("-created_at")[:500]
    self_qs = WalletTransaction.objects.filter(user=user, type__in=["SELF_ACCOUNT_CREDIT", "SELF_ACCOUNT_DEBIT"]).order_by("-created_at")[:500]
    redeem_types = [
        "AUTO_ECOUPON_ISSUED",
        "AUTO_PURCHASE_DEBIT",
        "ECOUPON_WALLET_DEBIT",
        "COUPON_PURCHASE_CREDIT",
        "REDEEM_ECOUPON_CREDIT",
        "PRODUCT_WALLET_CREDIT",
        "PRODUCT_PURCHASE_DEBIT",
        "ADJUSTMENT_DEBIT",
    ]
    redeem_qs = WalletTransaction.objects.filter(user=user, type__in=redeem_types).order_by("-created_at")[:500]

    # Reward points
    cashback = []
    redeem_points = []
    try:
        from .models import RewardPointsTransaction
        rtx = RewardPointsTransaction.objects.filter(user=user).order_by("-created_at")[:500]
        for x in rtx:
            xtype = (x.type or "").upper()
            row = {
                "id": x.id,
                "type": f"RP_{xtype}",
                "amount": str(x.points),  # 1 point = ₹1
                "created_at": x.created_at.isoformat() if getattr(x, "created_at", None) else None,
                "status": "success",
                "meta": x.meta or {},
            }
            if xtype == "EARN":
                cashback.append(row)
            elif xtype == "REDEEM":
                redeem_points.append(row)
    except Exception:
        cashback = []
        redeem_points = []

    # Build lists + fallback classification if empty (for legacy data)
    incoming_list = [txmap(x) for x in incoming_qs]
    self_list = [txmap(x) for x in self_qs]
    redeem_list = redeem_points

    if not incoming_list and not self_list and not redeem_list:
        fallback_qs = list(WalletTransaction.objects.filter(user=user).order_by("-created_at")[:200])
        self_types = {"SELF_ACCOUNT_CREDIT", "SELF_ACCOUNT_DEBIT"}
        redeem_extra_types = {
            "AUTO_PURCHASE_DEBIT",
            "ECOUPON_WALLET_DEBIT",
            "PRODUCT_PURCHASE_DEBIT",
            "WITHDRAWAL_DEBIT",
            "ADJUSTMENT_DEBIT",
        }
        for tx in fallback_qs:
            try:
                amt = tx.amount
            except Exception:
                amt = 0
            if tx.type in self_types:
                self_list.append(txmap(tx))
            elif tx.type in redeem_extra_types or (amt is not None and amt < 0):
                redeem_list.append(txmap(tx))
            else:
                # Any positive or neutral credits go to Incoming
                incoming_list.append(txmap(tx))

    data = {
        "top": top,
        "incoming": incoming_list,
        "self_account": self_list,
        "cashback": cashback,
        "redeem": redeem_list,
        "recent": [txmap(x) for x in WalletTransaction.objects.filter(user=user).order_by("-created_at")[:50]],
    }
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def wallet_me_banks(request):
    """
    Return bank options for withdrawal. Currently backed by KYC as a single bank option.
    """
    u = request.user
    try:
        from .models import UserKYC
        kyc = UserKYC.objects.filter(user=u).first()
    except Exception:
        kyc = None

    def mask_ac(n: str) -> str:
        s = (n or "").strip()
        if len(s) <= 4:
            return s
        return "X" * (len(s) - 4) + s[-4:]

    banks = []
    if kyc and (kyc.bank_name or kyc.bank_account_number or kyc.ifsc_code):
        banks.append({
            "id": "kyc",
            "label": f"KYC • {kyc.bank_name or 'Bank'}",
            "bank_name": kyc.bank_name or "",
            # Full account number (unmasked) for UIs that want to display the complete value
            "account_number": (kyc.bank_account_number or "").strip(),
            "account_number_full": (kyc.bank_account_number or "").strip(),
            # Convenience fields for masked/last4 display (if a UI prefers masking)
            "account_number_last4": ((kyc.bank_account_number or "").strip()[-4:] if (kyc.bank_account_number or "").strip() else ""),
            "account_number_masked": mask_ac(kyc.bank_account_number or ""),
            "ifsc": kyc.ifsc_code or "",
            "is_default": True,
        })

    return Response({
        "banks": banks,
        "default_bank_id": "kyc" if banks else None,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def wallet_purchase_ecoupon(request):
    """
    Spend main wallet to buy e-coupons (₹150 default).
    Body: { "value": 150, "qty": 1 }
    """
    u = request.user
    try:
        value = D(str(request.data.get("value", "150")))
    except Exception:
        value = D("150.00")
    try:
        qty = int(request.data.get("qty", 1))
    except Exception:
        qty = 1
    if qty <= 0 or value <= 0:
        return Response({"detail": "Invalid value/qty."}, status=status.HTTP_400_BAD_REQUEST)

    total = (value * D(str(qty))).quantize(D("0.01"))
    w = Wallet.get_or_create_for_user(u)

    # Pre-check sufficient main balance
    if D(str(getattr(w, "main_balance", 0) or 0)) < total:
        return Response({"detail": "Insufficient main wallet balance."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        from coupons.models import CouponCode
    except Exception:
        return Response({"detail": "Coupons module unavailable."}, status=status.HTTP_400_BAD_REQUEST)

    # Check stock availability quickly
    base_qs = CouponCode.objects.filter(
        issued_channel="e_coupon",
        value=value,
        status="AVAILABLE",
        assigned_agency__isnull=True,
        assigned_employee__isnull=True,
        assigned_consumer__isnull=True,
    )
    available = base_qs.count()
    if available < qty:
        return Response({"detail": f"Insufficient coupon stock. Available: {available}"}, status=status.HTTP_400_BAD_REQUEST)

    codes = []
    with transaction.atomic():
        # Lock wallet
        w = Wallet.objects.select_for_update().get(pk=w.pk)
        if (w.main_balance or D("0")) < total:
            return Response({"detail": "Insufficient main wallet balance."}, status=status.HTTP_400_BAD_REQUEST)

        # Debit once for all coupons
        w.debit(total, tx_type="ECOUPON_WALLET_DEBIT", meta={"purchase_qty": qty, "unit_value": str(value)}, source_type="ECOUPON_PURCHASE", source_id="")

        # Allocate coupons one-by-one under lock
        for _ in range(qty):
            try:
                try:
                    locking_qs = base_qs.select_for_update(skip_locked=True)
                except Exception:
                    locking_qs = base_qs
                pick_ids = list(locking_qs.order_by("serial", "id").values_list("id", flat=True)[:1])
                if not pick_ids:
                    raise serializers.ValidationError("Ran out of stock while allocating.")
                affected = (
                    CouponCode.objects.filter(id__in=pick_ids)
                    .filter(
                        issued_channel="e_coupon",
                        status="AVAILABLE",
                        assigned_agency__isnull=True,
                        assigned_employee__isnull=True,
                        assigned_consumer__isnull=True,
                    )
                    .update(assigned_consumer_id=u.id, status="SOLD")
                )
                if not affected:
                    raise serializers.ValidationError("Coupon allocation race; please retry.")
                cobj = CouponCode.objects.filter(id=pick_ids[0]).only("code").first()
                codes.append(getattr(cobj, "code", None))
            except Exception as e:
                raise

    return Response({"codes": codes, "debited": str(total)}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def wallet_purchase_product(request):
    """
    Spend main wallet to pay for a product/order.
    Body: { "order_id": "<id>", "amount": "<number>" }
    """
    u = request.user
    try:
        amount = D(str(request.data.get("amount", "0")))
    except Exception:
        amount = D("0")
    if amount <= 0:
        return Response({"detail": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)
    order_id = str(request.data.get("order_id") or "")

    w = Wallet.get_or_create_for_user(u)
    # Enforce main-balance-only spend policy
    if D(str(getattr(w, "main_balance", 0) or 0)) < amount:
        return Response({"detail": "Insufficient main wallet balance."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        w = Wallet.objects.select_for_update().get(pk=w.pk)
        if (w.main_balance or D("0")) < amount:
            return Response({"detail": "Insufficient main wallet balance."}, status=status.HTTP_400_BAD_REQUEST)
        w.debit(amount, tx_type="PRODUCT_PURCHASE_DEBIT", meta={"order_id": order_id}, source_type="PRODUCT_PURCHASE", source_id=str(order_id or ""))

    return Response({"status": "ok", "debited": str(amount)}, status=status.HTTP_200_OK)


# ====================
# Support Portal (User)
# ====================

class SupportTicketListCreate(generics.ListCreateAPIView):
    """
    List my support tickets and create a new ticket.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SupportTicketSerializer

    def get_queryset(self):
        return SupportTicket.objects.filter(user=self.request.user).order_by("-updated_at", "-id")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SupportTicketDetail(generics.RetrieveAPIView):
    """
    Retrieve a specific ticket (restricted to the owner).
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SupportTicketSerializer

    def get_queryset(self):
        return SupportTicket.objects.filter(user=self.request.user)


class SupportTicketMessageCreate(generics.CreateAPIView):
    """
    Post a message on my ticket (simple 1:1 conversation thread with admin).
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SupportTicketMessageSerializer

    def perform_create(self, serializer):
        try:
            pk = int(self.kwargs.get("pk") or 0)
        except Exception:
            pk = 0
        ticket = SupportTicket.objects.filter(pk=pk, user=self.request.user).first()
        if not ticket:
            raise serializers.ValidationError({"detail": "Ticket not found."})
        serializer.save(ticket=ticket, author=self.request.user)

# ====================
# Nominees (User)
# ====================

class NomineeListCreateView(generics.ListCreateAPIView):
    """
    List my nominees and create a new nominee.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = UserNomineeSerializer

    def get_queryset(self):
        return UserNominee.objects.filter(user=self.request.user).order_by("-updated_at", "-id")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class NomineeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve/Update/Delete a nominee that belongs to me.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = UserNomineeSerializer

    def get_queryset(self):
        return UserNominee.objects.filter(user=self.request.user)

# ====================
# Employee Offer Letter (PDF)
# ====================
def _xhtml2pdf_link_callback(uri, rel):
    """
    Convert STATIC/MEDIA URIs to absolute system paths for xhtml2pdf.
    Falls back to returning the original URI if the file is not resolvable.
    """
    try:
        sUrl = (getattr(settings, "STATIC_URL", None) or "/static/").rstrip("/") + "/"
        sRoot = getattr(settings, "STATIC_ROOT", "") or ""
        mUrl = (getattr(settings, "MEDIA_URL", None) or "/media/").rstrip("/") + "/"
        mRoot = getattr(settings, "MEDIA_ROOT", "") or ""

        if uri.startswith(mUrl) and mRoot:
            path = os.path.join(mRoot, uri[len(mUrl):])
        elif uri.startswith(sUrl):
            # Prefer staticfiles finders during development
            rel_path = uri[len(sUrl):]
            path = finders.find(rel_path)
            if not path and sRoot:
                path = os.path.join(sRoot, rel_path)
        else:
            return uri

        if path and os.path.isfile(path):
            return path
    except Exception:
        pass
    return uri


# ====================
# Direct Sponsor Member Detail API
# ====================

class DirectMemberDetailView(APIView):
    """
    GET /api/accounts/direct/member-detail/?user_id=<id>
    Returns detailed info for a direct sponsor member of the logged-in user:
    - Basic info (consumer_id, name, registration_date, package_activation_date)
    - Entry package status (Join Subscription / 750)
    - Smart seasons: each season (Coupon) with list of months (1–12) where user made a purchase
    - Prime ranks: all rank levels with Active/Inactive status for the user
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        raw_id = request.query_params.get("user_id", "").strip()
        if not raw_id:
            return Response({"detail": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            target_id = int(raw_id)
        except (ValueError, TypeError):
            return Response({"detail": "user_id must be a valid integer."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target = CustomUser.objects.get(id=target_id)
        except CustomUser.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # ── Basic info ──
        result = {
            "consumer_id": target.username or "",
            "full_name": target.full_name or "",
            "phone": target.phone or "",
            "registration_date": target.date_joined,
            "package_activation_date": target.first_purchase_activated_at,
            "account_active": bool(target.account_active),
        }

        # ── Entry Package (Join Subscription – 750 denomination) ──
        try:
            from coupons.models import CouponCode, ECouponOrder
            has_coupon_750 = CouponCode.objects.filter(
                assigned_consumer=target,
                value__gte=700,
                value__lte=800,
            ).exists()
            has_ecoupon_750 = ECouponOrder.objects.filter(
                buyer=target,
                denomination_snapshot__gte=700,
                denomination_snapshot__lte=800,
                status="APPROVED",
            ).exists()
            has_entry = has_coupon_750 or has_ecoupon_750 or bool(target.account_active)
        except Exception:
            has_entry = bool(target.account_active)
        result["entry_package"] = {
            "name": "Join Subscription",
            "amount": 750,
            "status": "Active" if has_entry else "Inactive",
        }

        # ── Smart Seasons (monthly 150/759 ecoupon purchases per season) ──
        try:
            from coupons.models import Coupon, CouponCode as CC
            from django.db.models import Q as DQ
            season_q = DQ(code__istartswith="season") | DQ(title__istartswith="season") | DQ(campaign__istartswith="season")
            seasons = list(Coupon.objects.filter(season_q).order_by("created_at").values(
                "id", "title", "code", "is_active", "valid_from", "valid_to", "created_at"
            ))
            now_dt = timezone.now()
            smart_seasons = []
            for s in seasons:
                start_dt = s["valid_from"] or s["created_at"]
                is_active = bool(s["is_active"])
                if s["valid_from"] and s["valid_to"]:
                    is_active = is_active and (s["valid_from"] <= now_dt <= s["valid_to"])
                # Purchases: ecoupons assigned to user in this season (denominations 150 or 759)
                codes = list(CC.objects.filter(
                    assigned_consumer=target,
                    coupon_id=s["id"],
                    value__in=[150, 759],
                ).order_by("created_at").values_list("created_at", flat=True))
                months_purchased = set()
                for dt in codes:
                    month_diff = (dt.year - start_dt.year) * 12 + (dt.month - start_dt.month) + 1
                    if 1 <= month_diff <= 12:
                        months_purchased.add(month_diff)
                smart_seasons.append({
                    "id": s["id"],
                    "name": s["title"] or s["code"],
                    "is_active": is_active,
                    "months_purchased": sorted(months_purchased),
                })
            result["smart_seasons"] = smart_seasons
        except Exception:
            result["smart_seasons"] = []

        # ── Prime Ranks ──
        try:
            from mlm_ranks.models import Rank, RankUpgrade, UserRank
            all_ranks = list(Rank.objects.order_by("level_number").values(
                "id", "rank_name", "level_number", "upgrade_amount"
            ))
            successful_to = set(
                RankUpgrade.objects.filter(
                    user=target, payment_status="SUCCESS"
                ).values_list("to_rank_id", flat=True)
            )
            try:
                ur = UserRank.objects.select_related("current_rank").get(user=target)
                current_level = getattr(ur.current_rank, "level_number", 0)
            except Exception:
                current_level = 0
            prime_ranks = []
            for rank in all_ranks:
                achieved = rank["id"] in successful_to or rank["level_number"] <= current_level
                prime_ranks.append({
                    "id": rank["id"],
                    "name": rank["rank_name"],
                    "level": rank["level_number"],
                    "amount": float(rank["upgrade_amount"] or 0),
                    "status": "Active" if achieved else "Inactive",
                })
            result["prime_ranks"] = prime_ranks
        except Exception:
            result["prime_ranks"] = []

        return Response(result, status=status.HTTP_200_OK)


class OfferLetterPDFView(APIView):
    """
    Generate a dynamic Employment Offer Letter (PDF) for the logged-in employee.
    Includes Trikonekt company branding and user details.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Restrict to employees only (either role or category marked as employee)
        if str(getattr(user, "role", "")).lower() != "employee" and str(getattr(user, "category", "")).lower() != "employee":
            return Response({"detail": "Offer letter is available for employees only."}, status=status.HTTP_403_FORBIDDEN)

        if pisa is None:
            return Response({"detail": "PDF generation is not available on this server."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        today = timezone.now().strftime("%d %B %Y")
        company = "Trikonekt"

        full_name = getattr(user, "full_name", "") or getattr(user, "username", "")
        username = getattr(user, "username", "") or ""
        unique_id = getattr(user, "unique_id", "") or ""
        prefixed_id = getattr(user, "prefixed_id", "") or ""
        address = getattr(user, "address", "") or ""
        pincode = getattr(user, "pincode", "") or ""
        city = getattr(getattr(user, "city", None), "name", "") or ""
        state_name = getattr(getattr(user, "state", None), "name", "") or ""

        # Static logo path under /static/branding/TRIKONEKT.jpeg (optional).
        # If not present, PDF will render without image.
        base_static_url = (getattr(settings, "STATIC_URL", None) or "/static/").rstrip("/") + "/"
        logo_uri = f"{base_static_url}branding/TRIKONEKT.jpeg"

        html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page {{
    size: A4;
    margin: 28mm 20mm 20mm 20mm;
  }}
  body {{ font-family: DejaVu Sans, Arial, Helvetica, sans-serif; color: #111827; font-size: 12pt; }}
  .header {{ text-align: center; margin-bottom: 16px; }}
  .logo {{ height: 56px; }}
  .company {{ font-weight: 700; font-size: 20pt; color: #0C2D48; margin-top: 8px; }}
  .title {{ text-align: center; font-weight: 700; font-size: 16pt; margin: 18px 0; text-transform: uppercase; }}
  .meta {{ margin: 10px 0 18px 0; line-height: 1.5; }}
  .para {{ margin: 12px 0; text-align: justify; line-height: 1.65; }}
  .sig {{ margin-top: 32px; }}
  .row {{ display: block; margin: 2px 0; }}
  .label {{ width: 150px; display: inline-block; color: #374151; }}
  .value {{ font-weight: 600; }}
  .footer {{ position: fixed; bottom: 10mm; left: 0; right: 0; text-align: center; color: #6b7280; font-size: 9pt; }}
</style>
</head>
<body>
  <div class="header">
    <img src="{logo_uri}" class="logo" />
    <div class="company">{company}</div>
  </div>

  <div class="title">Employment Offer Letter</div>

  <div class="meta">
    <div class="row"><span class="label">Date:</span> <span class="value">{today}</span></div>
    <div class="row"><span class="label">Employee Name:</span> <span class="value">{full_name}</span></div>
    <div class="row"><span class="label">Username:</span> <span class="value">{username}</span></div>
    <div class="row"><span class="label">Employee ID:</span> <span class="value">{prefixed_id or unique_id}</span></div>
    <div class="row"><span class="label">Designation:</span> <span class="value">Employee</span></div>
    <div class="row"><span class="label">Location:</span> <span class="value">{(city + ', ' if city else '') + (state_name or '')} {pincode}</span></div>
  </div>

  <div class="para">
    We are pleased to offer you the position of <b>Employee</b> with <b>{company}</b>. Your skills and experience will be a valuable
    addition to our team. The terms and conditions of your employment, including compensation, responsibilities, and policies,
    will be communicated separately and may be updated from time to time as per company norms.
  </div>

  <div class="para">
    Your joining is effective upon acceptance of this offer and completion of requisite onboarding formalities.
    Please keep this letter for your records. This letter is system generated and does not require a physical signature.
  </div>

  <div class="sig">
    <div class="row"><span class="label">For:</span> <span class="value">{company}</span></div>
    <div class="row" style="margin-top: 22px;"><span class="label">Authorized Signatory:</span> <span class="value">HR Department</span></div>
  </div>

  <div class="footer">
    {company} • www.trikonekt.com
  </div>
</body>
</html>
"""

        # Render PDF
        pdf_io = BytesIO()
        result = pisa.CreatePDF(src=html, dest=pdf_io, link_callback=_xhtml2pdf_link_callback)
        if getattr(result, "err", False):
            return Response({"detail": "Failed to generate PDF."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        filename = f'Trikonekt_Offer_Letter_{username}.pdf'
        resp = HttpResponse(pdf_io.getvalue(), content_type='application/pdf')
        resp['Content-Disposition'] = f'attachment; filename="{filename}"'
        return resp
