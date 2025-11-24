from datetime import date
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import CustomUser, Wallet, WalletTransaction, UserKYC, WithdrawalRequest, SupportTicket, SupportTicketMessage
from coupons.models import Coupon, CouponCode, CouponSubmission, CouponBatch
from uploads.models import FileUpload, DashboardCard, HomeCard, LuckyDrawSubmission
from market.models import Product, PurchaseRequest, Banner, BannerItem, BannerPurchaseRequest
from business.models import UserMatrixProgress, AutoPoolAccount, DailyReport, CommissionConfig
from .permissions import IsAdminOrStaff
from .serializers import AdminUserNodeSerializer, AdminKYCSerializer, AdminWithdrawalSerializer, AdminMatrixProgressSerializer, AdminSupportTicketSerializer, AdminSupportTicketMessageSerializer, AdminUserEditSerializer, AdminAutopoolTxnSerializer, AdminAutopoolConfigSerializer
from .dynamic import field_meta_from_serializer


class AdminMetricsView(APIView):
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        today = timezone.now().date()

        # Return cached metrics unless explicitly bypassed with ?refresh=1
        try:
            refresh = str(request.query_params.get("refresh") or "").lower()
        except Exception:
            refresh = ""
        if refresh not in ("1", "true", "yes"):
            cached = cache.get("admin_metrics_v1")
            if cached is not None:
                return Response(cached, status=status.HTTP_200_OK)

        # Ensure CommissionConfig exists (seed if missing)
        try:
            CommissionConfig.get_solo()
        except Exception:
            pass

        # Users (condensed into a single aggregate where possible)
        users_agg = CustomUser.objects.aggregate(
            total=Count("id"),
            active=Count("id", filter=Q(first_purchase_activated_at__isnull=False)),
            todayNew=Count("id", filter=Q(date_joined__date=today)),
            consumers_without_kyc=Count("id", filter=Q(category="consumer") & Q(kyc__isnull=True)),
        )

        # KYC pending: users with KYC not verified + users without KYC (consumers)
        kyc_unverified = UserKYC.objects.filter(verified=False).count()
        kyc_pending = (kyc_unverified or 0) + (users_agg.get("consumers_without_kyc") or 0)

        users_block = {
            "total": users_agg.get("total") or 0,
            "active": users_agg.get("active") or 0,
            "inactive": (users_agg.get("total") or 0) - (users_agg.get("active") or 0),
            "todayNew": users_agg.get("todayNew") or 0,
            "kycPending": int(kyc_pending),
        }

        # Wallets (aggregate total balance and count together)
        wagg = Wallet.objects.aggregate(s=Sum("balance"), c=Count("id"))
        total_balance = wagg.get("s") or Decimal("0.00")
        wallets_block = {
            "totalBalance": float(total_balance),
            "transactionsToday": WalletTransaction.objects.filter(created_at__date=today).count(),
            "count": wagg.get("c") or 0,
        }

        # Withdrawals (single aggregate for count and amount)
        wagg2 = WithdrawalRequest.objects.filter(status="pending").aggregate(c=Count("id"), s=Sum("amount"))
        withdrawals_block = {
            "pendingCount": wagg2.get("c") or 0,
            "pendingAmount": float(wagg2.get("s") or Decimal("0.00")),
        }

        # Coupons (single aggregate for multiple counts)
        cagg = CouponCode.objects.aggregate(
            total=Count("id"),
            assigned=Count("id", filter=Q(status__in=["ASSIGNED_AGENCY", "ASSIGNED_EMPLOYEE"])),
            redeemed=Count("id", filter=Q(status="REDEEMED")),
        )
        # Pending submissions considered as waiting for approvals (SUBMITTED or EMPLOYEE_APPROVED)
        pending_submissions = CouponSubmission.objects.filter(status__in=["SUBMITTED", "EMPLOYEE_APPROVED"]).count()
        coupons_block = {
            "total": cagg.get("total") or 0,
            "assigned": cagg.get("assigned") or 0,
            "redeemed": cagg.get("redeemed") or 0,
            "pendingSubmissions": pending_submissions,
        }

        # Uploads (single aggregate for total and today's new)
        uagg = FileUpload.objects.aggregate(
            total=Count("id"),
            todayNew=Count("id", filter=Q(created_at__date=today)),
        )
        uploads_block = {
            "total": uagg.get("total") or 0,
            "todayNew": uagg.get("todayNew") or 0,
            "failed": 0,
        }

        # Uploads models
        uploads_models_block = {
            "dashboardCards": DashboardCard.objects.count(),
            "homeCards": HomeCard.objects.count(),
            "luckyDrawSubmissions": LuckyDrawSubmission.objects.count(),
            "luckyDrawPendingTRE": LuckyDrawSubmission.objects.filter(status="SUBMITTED").count(),
            "luckyDrawPendingAgency": LuckyDrawSubmission.objects.filter(status="TRE_APPROVED").count(),
        }

        # Market
        market_block = {
            "products": Product.objects.count(),
            "purchaseRequests": PurchaseRequest.objects.count(),
            "purchaseRequestsPending": PurchaseRequest.objects.filter(status=PurchaseRequest.STATUS_PENDING).count(),
            "banners": Banner.objects.count(),
            "bannerItems": BannerItem.objects.count(),
            "bannerPurchaseRequests": BannerPurchaseRequest.objects.count(),
            "bannerPurchaseRequestsPending": BannerPurchaseRequest.objects.filter(status=BannerPurchaseRequest.STATUS_PENDING).count(),
        }

        # Reports aggregate (today and total in one query)
        ragg = DailyReport.objects.aggregate(
            today=Count("id", filter=Q(date=today)),
            total=Count("id"),
        )

        # Autopool aggregates (single DB hit)
        acc_by_status = list(
            AutoPoolAccount.objects.values("status")
            .annotate(c=Count("id"))
            .order_by()
        )

        payload = {
            "users": users_block,
            "wallets": wallets_block,
            "withdrawals": withdrawals_block,
            "coupons": coupons_block,
            "uploads": uploads_block,
            "uploadsModels": uploads_models_block,
            "market": market_block,
            "autopool": {
                "total": sum(row["c"] for row in acc_by_status),
                "byStatus": {row["status"]: row["c"] for row in acc_by_status},
            },
            "reports": {
                "dailyReportsToday": ragg.get("today") or 0,
                "dailyReportsTotal": ragg.get("total") or 0,
            },
            "commission": {
                "configs": CommissionConfig.objects.count(),
            },
        }
        # Cache for a short duration to avoid heavy repeated aggregation under load
        try:
            cache.set("admin_metrics_v1", payload, timeout=20)  # seconds
        except Exception:
            pass
        return Response(payload, status=status.HTTP_200_OK)


class AdminUserTreeRoot(APIView):
    """
    Resolve a root user for the hierarchy tree.
    identifier can be: id (int), username, email, or unique_id.
    """
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        identifier = (request.query_params.get("identifier") or "").strip()
        if not identifier:
            return Response({"detail": "identifier is required"}, status=400)

        user = None
        # Normalize digits for id/phone queries
        digits = "".join([c for c in identifier if c.isdigit()])

        # Prefer exact prefixed_id (sponsor code)
        user = CustomUser.objects.filter(prefixed_id__iexact=identifier).first() or user

        # Try by id (numeric)
        if not user and digits and digits == identifier and digits.isdigit():
            user = CustomUser.objects.filter(id=int(digits)).first()

        # Try by username/email/unique_id and phone digits (avoid matching children by sponsor_id here)
        if not user:
            q = (
                Q(username__iexact=identifier)
                | Q(email__iexact=identifier)
                | Q(unique_id__iexact=identifier)
            )
            if digits:
                q = q | Q(phone__iexact=digits) | Q(username__iexact=digits)
            user = CustomUser.objects.filter(q).first()

        if not user:
            return Response({"detail": "User not found"}, status=404)

        # Annotate direct_count and has_children
        node = (
            CustomUser.objects.filter(id=user.id)
            .annotate(
                direct_count=Count("registrations", distinct=True),
            )
            .first()
        )
        has_children = (getattr(node, "direct_count", 0) or 0) > 0

        data = AdminUserNodeSerializer({
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "category": user.category,
            "phone": user.phone,
            "state": user.state,
            "pincode": user.pincode,
            "direct_count": getattr(node, "direct_count", 0) or 0,
            "has_children": has_children,
        }).data
        return Response(data, status=200)


class AdminUserTreeDefaultRoot(APIView):
    """
    Return default root user for hierarchy tree (first superuser by id; fallback to first staff; else earliest user).
    """
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        user = (
            CustomUser.objects.filter(is_superuser=True).order_by("id").first()
            or CustomUser.objects.filter(is_staff=True).order_by("id").first()
            or CustomUser.objects.order_by("id").first()
        )
        if not user:
            return Response({"detail": "No users found"}, status=404)

        node = (
            CustomUser.objects.filter(id=user.id)
            .annotate(direct_count=Count("registrations", distinct=True))
            .first()
        )
        has_children = (getattr(node, "direct_count", 0) or 0) > 0

        data = AdminUserNodeSerializer({
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "category": user.category,
            "phone": user.phone,
            "state": user.state,
            "pincode": user.pincode,
            "direct_count": getattr(node, "direct_count", 0) or 0,
            "has_children": has_children,
        }).data
        return Response(data, status=200)


class AdminUserTreeChildren(APIView):
    """
    Return direct children for given userId (registered_by relationship).
    Supports pagination with page and page_size.
    """
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        try:
            user_id = int(request.query_params.get("userId") or "0")
        except ValueError:
            return Response({"detail": "Invalid or missing userId"}, status=400)

        page = max(int(request.query_params.get("page") or 1), 1)
        page_size = min(max(int(request.query_params.get("page_size") or 20), 1), 100)

        qs = (
            CustomUser.objects.filter(registered_by_id=user_id)
            .annotate(direct_count=Count("registrations", distinct=True))
            .order_by("-date_joined")
        )

        total = qs.count()
        start = (page - 1) * page_size
        end = start + page_size
        items = []
        for u in qs[start:end]:
            items.append({
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name,
                "role": u.role,
                "category": u.category,
                "phone": u.phone,
                "state": u.state,
                "pincode": u.pincode,
                "direct_count": getattr(u, "direct_count", 0) or 0,
                "has_children": (getattr(u, "direct_count", 0) or 0) > 0,
            })

        data = {
            "count": total,
            "page": page,
            "page_size": page_size,
            "results": AdminUserNodeSerializer(items, many=True).data,
        }
        return Response(data, status=200)


class AdminUsersList(ListAPIView):
    """
    Admin users list with powerful filters: role, phone, category, pincode, state, kyc.
    """
    permission_classes = [IsAdminOrStaff]
    serializer_class = AdminUserNodeSerializer

    def get_queryset(self):
        qs = (
            CustomUser.objects
            .select_related("country", "state", "city", "wallet", "kyc")
            .prefetch_related("matrix_progress")
            .annotate(direct_count=Count("registrations", distinct=True))
        )
        role = (self.request.query_params.get("role") or "").strip()
        phone = (self.request.query_params.get("phone") or "").strip()
        category = (self.request.query_params.get("category") or "").strip()
        pincode = (self.request.query_params.get("pincode") or "").strip()
        state_id = (self.request.query_params.get("state") or "").strip()
        kyc = (self.request.query_params.get("kyc") or "").strip()
        search = (self.request.query_params.get("search") or "").strip()
        activated = (self.request.query_params.get("activated") or "").strip().lower()

        # Normalize role/category to be case-insensitive and accept human labels/tokens
        if role:
            r = str(role).strip()
            r_key = r.lower()
            try:
                role_keys = {str(k).lower(): k for k, _ in getattr(CustomUser, "ROLE_CHOICES", [])}
                role_labels = {str(v).lower().replace(" ", "_").replace("-", "_"): k for k, v in getattr(CustomUser, "ROLE_CHOICES", [])}
                r_norm = role_keys.get(r_key) or role_labels.get(r_key.replace(" ", "_").replace("-", "_")) or r
            except Exception:
                r_norm = r
            qs = qs.filter(role__iexact=r_norm)
        if category:
            c = str(category).strip()
            c_key = c.lower().replace(" ", "_").replace("-", "_")
            try:
                cat_values = {str(k).lower(): k for k, _ in getattr(CustomUser, "CATEGORY_CHOICES", [])}
                cat_labels = {str(v).lower().replace(" ", "_").replace("-", "_"): k for k, v in getattr(CustomUser, "CATEGORY_CHOICES", [])}
                c_norm = cat_values.get(c_key) or cat_labels.get(c_key) or c
            except Exception:
                c_norm = c
            qs = qs.filter(category__iexact=c_norm)
        if phone:
            qs = qs.filter(phone__icontains=phone)
        if pincode:
            qs = qs.filter(pincode__icontains=pincode)
        if state_id and state_id.isdigit():
            qs = qs.filter(state_id=int(state_id))
        if kyc:
            if kyc == "pending":
                qs = qs.filter(Q(kyc__verified=False) | Q(kyc__isnull=True))
            elif kyc == "verified":
                qs = qs.filter(kyc__verified=True)
        if activated in ("1", "true", "yes", "activated"):
            qs = qs.filter(first_purchase_activated_at__isnull=False)
        elif activated in ("0", "false", "no", "inactive", "not_activated", "unactivated", "notactivated"):
            qs = qs.filter(first_purchase_activated_at__isnull=True)
        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(full_name__icontains=search)
                | Q(email__icontains=search)
                | Q(unique_id__icontains=search)
            )

        ordering = (self.request.query_params.get("ordering") or "-date_joined").strip()
        if ordering:
            qs = qs.order_by(ordering)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        # Allow decrypted last password to be included for admins in list view as well
        ctx["purpose"] = "detail"
        return ctx

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        try:
            page = int(request.query_params.get("page") or 1)
        except Exception:
            page = 1
        try:
            page_size = int(request.query_params.get("page_size") or 25)
        except Exception:
            page_size = 25
        page = max(1, page)
        page_size = max(1, min(page_size, 200))

        total = qs.count()
        start = (page - 1) * page_size
        end = start + page_size
        serializer = self.get_serializer(qs[start:end], many=True)
        return Response({"count": total, "results": serializer.data}, status=200)


class AdminUserEditMetaView(APIView):
    """
    Return dynamic field metadata for Admin user edit dialog based on AdminUserEditSerializer.
    """
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        from .serializers import AdminUserEditSerializer
        try:
            meta = field_meta_from_serializer(AdminUserEditSerializer) or []

            # Normalize and enhance meta for UI
            # - Ensure password is shown as PasswordField and not required
            for f in meta:
                name = f.get("name")
                if name == "password":
                    f["type"] = "PasswordField"
                    f["required"] = False
                    f["label"] = f.get("label") or "Set New Password"
                if name == "sponsor_id" and not getattr(request.user, "is_superuser", False):
                    f["read_only"] = True
                    hint = "Only superuser can modify Sponsor ID"
                    if f.get("help_text"):
                        f["help_text"] = f"{f['help_text']} | {hint}"
                    else:
                        f["help_text"] = hint
        except Exception:
            # Fallback minimal meta
            meta = [
                {"name": "email", "type": "EmailField", "required": False, "label": "Email"},
                {"name": "full_name", "type": "CharField", "required": False, "label": "Full Name"},
                {"name": "phone", "type": "CharField", "required": False, "label": "Mobile"},
                {"name": "pincode", "type": "CharField", "required": False, "label": "Pincode"},
                {"name": "country", "type": "IntegerField", "required": False, "label": "Country (ID)"},
                {"name": "state", "type": "IntegerField", "required": False, "label": "State (ID)"},
                {"name": "city", "type": "IntegerField", "required": False, "label": "District/City (ID)"},
                {"name": "role", "type": "CharField", "required": False, "label": "Role"},
                {"name": "category", "type": "CharField", "required": False, "label": "Category"},
                {"name": "is_active", "type": "BooleanField", "required": False, "label": "Active"},
                {"name": "password", "type": "PasswordField", "required": False, "label": "Set New Password"},
                {"name": "sponsor_id", "type": "CharField", "required": False, "label": "Sponsor ID", "read_only": not getattr(request.user, "is_superuser", False)},
            ]
        return Response({"fields": meta}, status=200)


class AdminUserDetail(APIView):
    """
    Retrieve/Update admin-editable fields for a specific user.
    """
    permission_classes = [IsAdminOrStaff]

    def get(self, request, pk: int):
        user = CustomUser.objects.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found"}, status=404)
        data = AdminUserEditSerializer(user).data
        return Response(data, status=200)

    def patch(self, request, pk: int):
        user = CustomUser.objects.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found"}, status=404)
        serializer = AdminUserEditSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            obj = serializer.save()
            return Response(AdminUserEditSerializer(obj).data, status=200)
        return Response(serializer.errors, status=400)


class AdminUserImpersonateView(APIView):
    """
    Admin-only: mint JWT tokens for a specific user to allow 'view as' login.
    """
    permission_classes = [IsAdminOrStaff]

    def post(self, request, pk: int):
        user = CustomUser.objects.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found"}, status=404)
        try:
            refresh = RefreshToken.for_user(user)
            data = {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "role": getattr(user, "role", "user") or "user",
                "username": getattr(user, "username", None),
                "id": getattr(user, "id", None),
            }
            return Response(data, status=200)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)


class AdminUserSetTempPasswordView(APIView):
    """
    Admin-only: generate a secure temporary password for a user, set it,
    and store an encrypted copy for display in Admin Users grid.
    Response: { "temp_password": "..." }
    """
    permission_classes = [IsAdminOrStaff]

    def post(self, request, pk: int):
        user = CustomUser.objects.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found"}, status=404)

        # Generate a strong temporary password: 8 alnum + 1 special + 1 digit
        try:
            import secrets, string
            base = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
            special = secrets.choice('!@#$%^&*')
            digit = str(secrets.randbelow(10))
            pwd = f"{base}{special}{digit}"
        except Exception:
            # Extremely rare, fallback
            pwd = "Tr!k0-" + str(int(timezone.now().timestamp()))[-6:]

        try:
            user.set_password(pwd)
            # Store encrypted plaintext for admin visibility
            try:
                from core.crypto import encrypt_string
                enc = encrypt_string(pwd)
            except Exception:
                enc = None

            if enc:
                user.last_password_encrypted = enc
                user.save(update_fields=["password", "last_password_encrypted"])
            else:
                user.save(update_fields=["password"])
        except Exception as e:
            return Response({"detail": str(e)}, status=400)

        return Response({"temp_password": pwd}, status=200)


class AdminECouponBulkCreateView(APIView):
    """
    Bulk-generate E-Coupons with prefix (default 'ELC') and sequential serials.
    Creates CouponBatch for traceability and CouponCode rows with issued_channel='e_coupon'.
    """
    permission_classes = [IsAdminOrStaff]

    def post(self, request):
        from django.db import transaction

        data = request.data or {}
        prefix = (data.get("prefix") or "ELC").strip().upper()
        try:
            quantity = int(data.get("quantity") or 0)
        except Exception:
            quantity = 0
        if quantity <= 0:
            return Response({"detail": "quantity must be a positive integer"}, status=400)

        serial_start_in = data.get("serialStart")
        try:
            serial_start_in = int(serial_start_in) if serial_start_in is not None else None
        except Exception:
            serial_start_in = None

        # Optional unit value per coupon (defaults to 150)
        try:
            unit_value = Decimal(str(data.get("value") or "150"))
        except Exception:
            unit_value = Decimal("150.00")

        # Ensure there is a parent Coupon record for E-Coupons under the given prefix
        coupon, _ = Coupon.objects.get_or_create(
            code=prefix,
            defaults={
                "title": f"{prefix} E-Coupon",
                "description": "Electronic coupon",
                "campaign": prefix,
                "issuer_id": getattr(request.user, "id", None) or 1,
            },
        )

        # Determine starting serial (continue from latest if not provided)
        last = (
            CouponCode.objects.filter(coupon=coupon, issued_channel="e_coupon", code__startswith=prefix)
            .order_by("-serial")
            .first()
        )
        next_serial = (getattr(last, "serial", None) or 0) + 1
        serial_start = serial_start_in or max(1, next_serial)
        serial_end = serial_start + quantity - 1
        serial_width = 7  # ELC + 7 digits -> ELC0000001

        with transaction.atomic():
            batch = CouponBatch.objects.create(
                coupon=coupon,
                prefix=prefix,
                serial_start=serial_start,
                serial_end=serial_end,
                serial_width=serial_width,
                created_by=getattr(request.user, "id", None) and request.user or None,
            )

            objs = []
            for serial in range(serial_start, serial_end + 1):
                code_str = f"{prefix}{str(serial).zfill(serial_width)}"
                objs.append(
                    CouponCode(
                        code=code_str,
                        coupon=coupon,
                        issued_channel="e_coupon",
                        assigned_employee=None,
                        assigned_agency=None,
                        batch=batch,
                        serial=serial,
                        value=unit_value,
                        issued_by=request.user,
                        status="AVAILABLE",
                    )
                )
            # Ignore duplicates silently (idempotence across partial retries)
            CouponCode.objects.bulk_create(objs, ignore_conflicts=True)

        return Response(
            {
                "batchId": batch.id,
                "prefix": prefix,
                "serialStart": serial_start,
                "serialEnd": serial_end,
                "quantity": quantity,
                "codePreviewFirst": f"{prefix}{str(serial_start).zfill(serial_width)}",
                "codePreviewLast": f"{prefix}{str(serial_end).zfill(serial_width)}",
            },
            status=201,
        )


class AdminECouponAssignView(APIView):
    """
    Assign E-Coupons either by a serial range or by quantity (earliest available) to
    an Agency/Subfranchise/Employee.

    Body:
    {
      "method": "range" | "quantity",
      "prefix": "ELC",
      // when method=range
      "startSerial": 1,
      "endSerial": 100,
      // when method=quantity
      "quantity": 50,
      "entityType": "agency" | "subfranchise" | "employee",
      "entityId": 123
    }
    """
    permission_classes = [IsAdminOrStaff]

    def post(self, request):
        from django.db import transaction

        data = request.data or {}
        method = (data.get("method") or "").strip().lower()
        prefix = (data.get("prefix") or "ELC").strip().upper()
        entity_type = (data.get("entityType") or "").strip().lower()
        try:
            entity_id = int(data.get("entityId") or 0)
        except Exception:
            entity_id = 0

        if method not in ("range", "quantity"):
            return Response({"detail": "method must be 'range' or 'quantity'"}, status=400)
        if entity_type not in ("agency", "subfranchise", "employee"):
            return Response({"detail": "entityType must be one of: agency, subfranchise, employee"}, status=400)
        if entity_id <= 0:
            return Response({"detail": "entityId is required"}, status=400)

        target = CustomUser.objects.filter(id=entity_id).first()
        if not target:
            return Response({"detail": "Target entity not found"}, status=404)

        coupon = Coupon.objects.filter(code=prefix).first()
        if not coupon:
            return Response({"detail": f"No coupon definition found for prefix {prefix}. Create a batch first."}, status=400)

        base_qs = CouponCode.objects.filter(
            coupon=coupon, issued_channel="e_coupon", status="AVAILABLE", code__startswith=prefix
        ).order_by("serial")

        assigned = 0
        assigned_range = None

        with transaction.atomic():
            if method == "range":
                try:
                    start_serial = int(data.get("startSerial"))
                    end_serial = int(data.get("endSerial"))
                except Exception:
                    return Response({"detail": "startSerial and endSerial must be integers"}, status=400)
                if start_serial > end_serial:
                    return Response({"detail": "startSerial must be <= endSerial"}, status=400)

                qs = base_qs.filter(serial__gte=start_serial, serial__lte=end_serial)
                codes = list(qs)
                if not codes:
                    return Response({"detail": "No AVAILABLE codes in the requested range"}, status=400)

                if entity_type == "employee":
                    for c in codes:
                        c.assigned_employee = target
                        c.status = "ASSIGNED_EMPLOYEE"
                        c.assigned_agency = None
                else:
                    # agency or subfranchise -> use assigned_agency slot (model supports agency/employee)
                    for c in codes:
                        c.assigned_agency = target
                        c.status = "ASSIGNED_AGENCY"
                        c.assigned_employee = None
                CouponCode.objects.bulk_update(codes, ["assigned_employee", "assigned_agency", "status"])
                assigned = len(codes)
                assigned_range = {"startSerial": start_serial, "endSerial": end_serial}

            else:  # quantity
                try:
                    qty = int(data.get("quantity") or 0)
                except Exception:
                    qty = 0
                if qty <= 0:
                    return Response({"detail": "quantity must be a positive integer"}, status=400)

                codes = list(base_qs[:qty])
                if not codes:
                    return Response({"detail": "No AVAILABLE codes to assign"}, status=400)

                if entity_type == "employee":
                    for c in codes:
                        c.assigned_employee = target
                        c.status = "ASSIGNED_EMPLOYEE"
                        c.assigned_agency = None
                else:
                    for c in codes:
                        c.assigned_agency = target
                        c.status = "ASSIGNED_AGENCY"
                        c.assigned_employee = None
                CouponCode.objects.bulk_update(codes, ["assigned_employee", "assigned_agency", "status"])
                assigned = len(codes)
                if assigned:
                    assigned_range = {"startSerial": codes[0].serial, "endSerial": codes[-1].serial}

        return Response(
            {
                "assigned": assigned,
                "entityId": entity_id,
                "entityType": entity_type,
                "prefix": prefix,
                "range": assigned_range,
            },
            status=200,
        )


class AdminKYCList(ListAPIView):
    """
    List KYC records with filters and search.
    Filters:
      - status=pending|verified
      - user (id or username contains)
      - state (id)
      - pincode (contains)
      - date_from, date_to on updated_at
    """
    permission_classes = [IsAdminOrStaff]
    serializer_class = AdminKYCSerializer

    def get_queryset(self):
        qs = UserKYC.objects.select_related("user").all()

        status_in = (self.request.query_params.get("status") or "").strip().lower()
        user_q = (self.request.query_params.get("user") or "").strip()
        state_id = (self.request.query_params.get("state") or "").strip()
        pincode = (self.request.query_params.get("pincode") or "").strip()
        date_from = (self.request.query_params.get("date_from") or "").strip()
        date_to = (self.request.query_params.get("date_to") or "").strip()
        ordering = (self.request.query_params.get("ordering") or "-updated_at").strip()

        if status_in == "pending":
            qs = qs.filter(verified=False)
        elif status_in == "verified":
            qs = qs.filter(verified=True)

        if user_q:
            if user_q.isdigit():
                qs = qs.filter(user_id=int(user_q))
            else:
                qs = qs.filter(
                    Q(user__username__icontains=user_q)
                    | Q(user__full_name__icontains=user_q)
                    | Q(user__phone__icontains=user_q)
                )

        if state_id and state_id.isdigit():
            qs = qs.filter(user__state_id=int(state_id))

        if pincode:
            qs = qs.filter(user__pincode__icontains=pincode)

        # date range on updated_at
        if date_from:
            qs = qs.filter(updated_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(updated_at__date__lte=date_to)

        if ordering:
            qs = qs.order_by(ordering)

        return qs


class AdminKYCVerifyView(APIView):
    """
    Verify a user's KYC (sets verified=True, stamps verified_by/verified_at).
    """
    permission_classes = [IsAdminOrStaff]

    def patch(self, request, user_id: int):
        kyc = UserKYC.objects.select_related("user").filter(user_id=user_id).first()
        if not kyc:
            return Response({"detail": "KYC not found for user"}, status=404)
        if not kyc.verified:
            kyc.verified = True
            kyc.verified_by = request.user
            kyc.verified_at = timezone.now()
            kyc.save(update_fields=["verified", "verified_by", "verified_at", "updated_at"])
        data = AdminKYCSerializer(kyc).data
        return Response(data, status=200)


class AdminKYCRejectView(APIView):
    """
    Reject KYC (currently sets verified=False). For explicit rejection tracking,
    extend the model with a 'status' field in a future migration.
    """
    permission_classes = [IsAdminOrStaff]

    def patch(self, request, user_id: int):
        kyc = UserKYC.objects.select_related("user").filter(user_id=user_id).first()
        if not kyc:
            return Response({"detail": "KYC not found for user"}, status=404)
        # Set to not verified; keep verified_at as-is to denote no verification timestamp
        if kyc.verified:
            kyc.verified = False
            kyc.verified_by = request.user  # audit who decided
            kyc.save(update_fields=["verified", "verified_by", "updated_at"])
        data = AdminKYCSerializer(kyc).data
        return Response(data, status=200)


class AdminWithdrawalList(ListAPIView):
    """
    List Withdrawal Requests with filters.
    Filters:
      - status=pending|approved|rejected
      - user (id or username contains)
      - date_from, date_to (requested_at)
      - min_amount, max_amount
      - method=upi|bank
      - ordering (default -requested_at)
    """
    permission_classes = [IsAdminOrStaff]
    serializer_class = AdminWithdrawalSerializer

    def get_queryset(self):
        qs = WithdrawalRequest.objects.select_related("user").all()

        status_in = (self.request.query_params.get("status") or "").strip().lower()
        user_q = (self.request.query_params.get("user") or "").strip()
        date_from = (self.request.query_params.get("date_from") or "").strip()
        date_to = (self.request.query_params.get("date_to") or "").strip()
        min_amount = (self.request.query_params.get("min_amount") or "").strip()
        max_amount = (self.request.query_params.get("max_amount") or "").strip()
        method = (self.request.query_params.get("method") or "").strip().lower()
        ordering = (self.request.query_params.get("ordering") or "-requested_at").strip()

        if status_in in ("pending", "approved", "rejected"):
            qs = qs.filter(status=status_in)

        if user_q:
            if user_q.isdigit():
                qs = qs.filter(Q(user_id=int(user_q)) | Q(user__username__icontains=user_q))
            else:
                qs = qs.filter(
                    Q(user__username__icontains=user_q)
                    | Q(user__full_name__icontains=user_q)
                    | Q(user__phone__icontains=user_q)
                )

        if date_from:
            qs = qs.filter(requested_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(requested_at__date__lte=date_to)

        try:
            if min_amount:
                from decimal import Decimal as D
                qs = qs.filter(amount__gte=D(min_amount))
            if max_amount:
                from decimal import Decimal as D
                qs = qs.filter(amount__lte=D(max_amount))
        except Exception:
            pass

        if method in ("upi", "bank"):
            qs = qs.filter(method=method)

        if ordering:
            qs = qs.order_by(ordering)

        return qs


class AdminWithdrawalApproveView(APIView):
    """
    Approve a pending withdrawal and debit user's wallet atomically.
    Body: { "payout_ref": "optional reference", "note": "optional" }
    """
    permission_classes = [IsAdminOrStaff]

    def patch(self, request, pk: int):
        obj = WithdrawalRequest.objects.select_related("user").filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Withdrawal not found"}, status=404)
        payout_ref = (request.data or {}).get("payout_ref") or ""
        note = (request.data or {}).get("note") or ""
        try:
            # Attach extra note if provided
            if note:
                obj.note = (obj.note or "") + f"\nApproved Note: {note}"
                obj.save(update_fields=["note"])
            obj.approve(actor=request.user, payout_ref=payout_ref)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(AdminWithdrawalSerializer(obj).data, status=200)

# Admin health ping for auth/namespace diagnostics
class AdminPingView(APIView):
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        user = request.user
        return Response(
            {
                "ok": True,
                "user": getattr(user, "username", None),
                "id": getattr(user, "id", None),
                "is_staff": bool(getattr(user, "is_staff", False)),
                "is_superuser": bool(getattr(user, "is_superuser", False)),
            },
            status=200,
        )


# ====================
# Admin Support Portal
# ====================

class AdminSupportTicketList(ListAPIView):
    """
    List support tickets with powerful filters:
      - status: open|in_progress|resolved|rejected|closed
      - type: KYC_REVERIFY|GENERAL
      - user: id or username/full_name/phone contains
      - search: subject/message contains
      - ordering: default -updated_at
    """
    permission_classes = [IsAdminOrStaff]
    serializer_class = AdminSupportTicketSerializer

    def get_queryset(self):
        qs = SupportTicket.objects.select_related("user", "admin_assignee").all()
        status_in = (self.request.query_params.get("status") or "").strip().lower()
        type_in = (self.request.query_params.get("type") or "").strip().upper()
        user_q = (self.request.query_params.get("user") or "").strip()
        search = (self.request.query_params.get("search") or "").strip()
        ordering = (self.request.query_params.get("ordering") or "-updated_at").strip()

        if status_in in ("open", "in_progress", "resolved", "rejected", "closed"):
            qs = qs.filter(status=status_in)
        if type_in in ("KYC_REVERIFY", "GENERAL"):
            qs = qs.filter(type=type_in)
        if user_q:
            if user_q.isdigit():
                qs = qs.filter(Q(user_id=int(user_q)) | Q(user__username__icontains=user_q))
            else:
                qs = qs.filter(
                    Q(user__username__icontains=user_q)
                    | Q(user__full_name__icontains=user_q)
                    | Q(user__phone__icontains=user_q)
                )
        if search:
            qs = qs.filter(Q(subject__icontains=search) | Q(message__icontains=search))
        if ordering:
            qs = qs.order_by(ordering)
        return qs


class AdminSupportTicketUpdate(APIView):
    """
    Update ticket fields: status, admin_assignee, resolution_note.
    Body:
      {
        "status": "open|in_progress|resolved|rejected|closed",
        "admin_assignee": 123,   // user id of staff/admin
        "resolution_note": "text to append/replace"
      }
    """
    permission_classes = [IsAdminOrStaff]

    def patch(self, request, pk: int):
        ticket = SupportTicket.objects.select_related("user").filter(pk=pk).first()
        if not ticket:
            return Response({"detail": "Ticket not found"}, status=404)

        data = request.data or {}
        status_in = (data.get("status") or "").strip().lower()
        admin_assignee_id = data.get("admin_assignee")
        resolution_note = (data.get("resolution_note") or "").strip()

        if admin_assignee_id is not None:
            try:
                aid = int(admin_assignee_id)
                assignee = CustomUser.objects.filter(id=aid, is_staff=True).first() or CustomUser.objects.filter(id=aid, is_superuser=True).first()
                if not assignee:
                    return Response({"detail": "admin_assignee must be an admin/staff user id"}, status=400)
                ticket.admin_assignee = assignee
            except Exception:
                return Response({"detail": "admin_assignee must be integer id"}, status=400)

        if status_in in ("open", "in_progress", "resolved", "rejected", "closed"):
            ticket.status = status_in

        if resolution_note:
            # append note
            ticket.resolution_note = (ticket.resolution_note or "") + (("\n" if ticket.resolution_note else "") + resolution_note)

        ticket.save(update_fields=["admin_assignee", "status", "resolution_note", "updated_at"])
        return Response(AdminSupportTicketSerializer(ticket).data, status=200)


class AdminSupportTicketMessageCreate(APIView):
    """
    Post an admin message to a ticket thread. Also moves status to in_progress when currently open.
    Body: { "message": "..." }
    """
    permission_classes = [IsAdminOrStaff]

    def post(self, request, pk: int):
        ticket = SupportTicket.objects.select_related("user").filter(pk=pk).first()
        if not ticket:
            return Response({"detail": "Ticket not found"}, status=404)
        msg = (request.data or {}).get("message")
        if not msg or not str(msg).strip():
            return Response({"detail": "message is required"}, status=400)
        m = SupportTicketMessage.objects.create(ticket=ticket, author=request.user, message=str(msg).strip())
        if ticket.status == "open":
            ticket.status = "in_progress"
            ticket.save(update_fields=["status", "updated_at"])
        return Response(AdminSupportTicketMessageSerializer(m).data, status=201)


class AdminSupportTicketApproveKYC(APIView):
    """
    Approve KYC re-verification request:
      - Sets user's kyc.kyc_reopen_allowed = True
      - Moves ticket to resolved (unless explicitly set otherwise)
      - Appends resolution note if provided
    Body: { "note": "optional" }
    """
    permission_classes = [IsAdminOrStaff]

    def post(self, request, pk: int):
        ticket = SupportTicket.objects.select_related("user").filter(pk=pk).first()
        if not ticket:
            return Response({"detail": "Ticket not found"}, status=404)
        if ticket.type != "KYC_REVERIFY":
            return Response({"detail": "Not a KYC re-verification ticket"}, status=400)

        # Ensure KYC exists and enable reopen flag
        kyc, _ = UserKYC.objects.get_or_create(user=ticket.user)
        if not kyc.kyc_reopen_allowed:
            kyc.kyc_reopen_allowed = True
            kyc.save(update_fields=["kyc_reopen_allowed", "updated_at"])

        note = (request.data or {}).get("note") or ""
        if note:
            ticket.resolution_note = (ticket.resolution_note or "") + (("\n" if ticket.resolution_note else "") + str(note))

        # Auto-assign current admin if not set
        if not ticket.admin_assignee_id:
            ticket.admin_assignee = request.user

        ticket.status = "resolved"
        ticket.save(update_fields=["status", "resolution_note", "admin_assignee", "updated_at"])
        return Response(AdminSupportTicketSerializer(ticket).data, status=200)


class AdminMatrixProgressList(ListAPIView):
    """
    List matrix progress per user and pool.
    Filters:
      - pool=FIVE_150|THREE_150|THREE_50
      - user (id or username/full_name/phone contains)
      - state (id), pincode (contains)
      - ordering (default -updated_at)
    """
    permission_classes = [IsAdminOrStaff]
    serializer_class = AdminMatrixProgressSerializer

    def get_queryset(self):
        qs = UserMatrixProgress.objects.select_related("user").all()

        pool = (self.request.query_params.get("pool") or "").strip().upper()
        user_q = (self.request.query_params.get("user") or "").strip()
        state_id = (self.request.query_params.get("state") or "").strip()
        pincode = (self.request.query_params.get("pincode") or "").strip()
        ordering = (self.request.query_params.get("ordering") or "-updated_at").strip()

        if pool in ("FIVE_150", "THREE_150", "THREE_50"):
            qs = qs.filter(pool_type=pool)

        if user_q:
            if user_q.isdigit():
                qs = qs.filter(Q(user_id=int(user_q)) | Q(user__username__icontains=user_q))
            else:
                qs = qs.filter(
                    Q(user__username__icontains=user_q)
                    | Q(user__full_name__icontains=user_q)
                    | Q(user__phone__icontains=user_q)
                )

        if state_id and state_id.isdigit():
            qs = qs.filter(user__state_id=int(state_id))
        if pincode:
            qs = qs.filter(user__pincode__icontains=pincode)

        if ordering:
            qs = qs.order_by(ordering)
        return qs


class AdminMatrixTree(APIView):
    """
    Returns sponsor-based downline tree for a root user, limited by max_depth.
    Query:
      - pool=FIVE_150|THREE_150|THREE_50 (affects default max_depth only)
      - root_user_id (int, required)
      - max_depth (optional override; default 6 for FIVE, 15 for THREE)
    Response:
      { id, username, full_name, level, children:[...] }
    """
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        try:
            root_id = int(request.query_params.get("root_user_id") or "0")
        except Exception:
            return Response({"detail": "root_user_id must be integer"}, status=400)
        if root_id <= 0:
            return Response({"detail": "root_user_id is required"}, status=400)

        pool = (request.query_params.get("pool") or "").strip().upper()
        default_depth = 6 if pool == "FIVE_150" else 15
        try:
            max_depth = int(request.query_params.get("max_depth") or default_depth)
        except Exception:
            max_depth = default_depth
        max_depth = max(1, min(max_depth, 20))  # hard safety cap

        # Prefetch children by registered_by in batches to reduce queries
        def build_node(user, level, visited=None):
            if visited is None:
                visited = set()
            if getattr(user, "id", None) in visited:
                return None
            visited.add(user.id)
            node = {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "level": level,
                "children": [],
            }
            if level >= max_depth:
                return node
            # Build robust sponsor tokens including dashless variant of prefixed_id
            tokens = set()
            try:
                pid = (getattr(user, "prefixed_id", "") or "").strip()
                if pid:
                    tokens.add(pid)
                    tokens.add(pid.replace("-", ""))
                uname = (getattr(user, "username", "") or "").strip()
                if uname:
                    tokens.add(uname)
                uid = (getattr(user, "unique_id", "") or "").strip()
                if uid:
                    tokens.add(uid)
                phone_digits = "".join(ch for ch in str(getattr(user, "phone", "") or "") if ch.isdigit())
                if phone_digits:
                    tokens.add(phone_digits)
            except Exception:
                pass

            # Initial candidate query by registered_by or sponsor token match
            children_q = Q(registered_by_id=user.id)
            for t in tokens:
                children_q = children_q | Q(sponsor_id__iexact=t)

            candidates = list(
                CustomUser.objects.filter(children_q)
                .exclude(id=user.id)
                .only("id", "username", "full_name", "registered_by_id", "sponsor_id")
                .order_by("id")
                .distinct()
            )

            # Verify each sponsor_id token resolves back to the current user before accepting
            def _owner_id_by_token(token: str):
                if not token:
                    return None
                q = Q(prefixed_id__iexact=token) | Q(username__iexact=token) | Q(unique_id__iexact=token)
                t_no_dash = "".join(ch for ch in str(token) if ch.isalnum())
                if t_no_dash and t_no_dash != token:
                    q = q | Q(prefixed_id__iexact=t_no_dash)
                digits = "".join(ch for ch in str(token) if ch.isdigit())
                if digits:
                    q = q | Q(phone__iexact=digits) | Q(username__iexact=digits)
                u2 = CustomUser.objects.filter(q).only("id").first()
                return getattr(u2, "id", None)

            children = []
            for c in candidates:
                if getattr(c, "registered_by_id", None) == user.id:
                    children.append(c)
                else:
                    sid = (getattr(c, "sponsor_id", "") or "").strip()
                    if _owner_id_by_token(sid) == user.id:
                        children.append(c)

            for c in children:
                cn = build_node(c, level + 1, visited)
                if cn:
                    node["children"].append(cn)
            return node

        root = CustomUser.objects.filter(id=root_id).first()
        if not root:
            return Response({"detail": "root user not found"}, status=404)
        tree = build_node(root, 1)
        return Response(tree, status=200)


class AdminMatrix5Tree(APIView):
    """
    Returns 5-matrix genealogy tree (spillover parent/children) for a root user.
    Query:
      - identifier: sponsor_id | username | phone (digits) | email | unique_id | id
      - root_user_id: integer (alternative to identifier)
      - max_depth: default 6 (hard cap 20)
      - source: matrix | sponsor | auto (default: auto). When auto and matrix has no children, falls back to sponsor-based tree.
    Response:
      { id, username, full_name, level, matrix_position?, depth?, children:[...] }
    """
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        # sanitize identifier (strip any bracketed suffixes like " [sub franchise]" and trailing tokens)
        identifier = (request.query_params.get("identifier") or "").strip()
        if "[" in identifier:
            identifier = identifier.split("[", 1)[0].strip()
        if " " in identifier:
            identifier = identifier.split()[0].strip()

        try:
            root_id = int(request.query_params.get("root_user_id") or "0")
        except Exception:
            root_id = 0

        source = (request.query_params.get("source") or "auto").strip().lower()
        try:
            max_depth = int(request.query_params.get("max_depth") or 6)
        except Exception:
            max_depth = 6
        max_depth = max(1, min(max_depth, 20))

        # Resolve root user
        user = None
        if root_id > 0:
            user = CustomUser.objects.filter(id=root_id).first()

        if not user and identifier:
            digits = "".join([c for c in identifier if c.isdigit()])
            # Prefer exact prefixed_id (sponsor code like TR9000000016)
            user = CustomUser.objects.filter(prefixed_id__iexact=identifier).first() or user
            # Try exact id if numeric-only
            if not user and digits and digits == identifier and digits.isdigit():
                user = CustomUser.objects.filter(id=int(digits)).first()
            # Generic username/email/unique_id/phone (do not pick a child by sponsor_id here)
            if not user:
                q = (
                    Q(username__iexact=identifier)
                    | Q(email__iexact=identifier)
                    | Q(unique_id__iexact=identifier)
                )
                if digits:
                    q = q | Q(phone__iexact=digits) | Q(username__iexact=digits)
                user = CustomUser.objects.filter(q).first()

        if not user:
            return Response({"detail": "Root user not found"}, status=404)

        # Builders
        def build_matrix(u, level: int):
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
                node["children"].append(build_matrix(ch, level + 1))
            return node

        def build_sponsor(u, level: int, visited=None):
            if visited is None:
                visited = set()
            if getattr(u, "id", None) in visited:
                return None
            visited.add(u.id)
            node = {
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name,
                "level": level,
                "children": [],
            }
            if level >= max_depth:
                return node
            # Build robust sponsor tokens including dashless variant of prefixed_id
            tokens = set()
            try:
                pid = (getattr(u, "prefixed_id", "") or "").strip()
                if pid:
                    tokens.add(pid)
                    tokens.add(pid.replace("-", ""))
                uname = (getattr(u, "username", "") or "").strip()
                if uname:
                    tokens.add(uname)
                uid = (getattr(u, "unique_id", "") or "").strip()
                if uid:
                    tokens.add(uid)
                phone_digits = "".join(ch for ch in str(getattr(u, "phone", "") or "") if ch.isdigit())
                if phone_digits:
                    tokens.add(phone_digits)
            except Exception:
                pass

            children_q = Q(registered_by_id=u.id)
            for t in tokens:
                children_q = children_q | Q(sponsor_id__iexact=t)

            candidates = list(
                CustomUser.objects.filter(children_q)
                .exclude(id=u.id)
                .only("id", "username", "full_name", "registered_by_id", "sponsor_id")
                .order_by("id")
                .distinct()
            )

            def _owner_id_by_token(token: str):
                if not token:
                    return None
                q = Q(prefixed_id__iexact=token) | Q(username__iexact=token) | Q(unique_id__iexact=token)
                t_no_dash = "".join(ch for ch in str(token) if ch.isalnum())
                if t_no_dash and t_no_dash != token:
                    q = q | Q(prefixed_id__iexact=t_no_dash)
                digits = "".join(ch for ch in str(token) if ch.isdigit())
                if digits:
                    q = q | Q(phone__iexact=digits) | Q(username__iexact=digits)
                u2 = CustomUser.objects.filter(q).only("id").first()
                return getattr(u2, "id", None)

            children = []
            for c in candidates:
                if getattr(c, "registered_by_id", None) == u.id:
                    children.append(c)
                else:
                    sid = (getattr(c, "sponsor_id", "") or "").strip()
                    if _owner_id_by_token(sid) == u.id:
                        children.append(c)

            for c in children:
                cn = build_sponsor(c, level + 1, visited)
                if cn:
                    node["children"].append(cn)
            return node

        # Decide source
        if source == "matrix":
            tree = build_matrix(user, 1)
            return Response(tree, status=200)
        if source == "sponsor":
            tree = build_sponsor(user, 1)
            return Response(tree, status=200)

        # auto: try matrix; if empty children at root, fall back to sponsor
        mx_tree = build_matrix(user, 1)
        if not mx_tree or not isinstance(mx_tree.get("children", []), list) or len(mx_tree["children"]) == 0:
            sp_tree = build_sponsor(user, 1)
            return Response(sp_tree, status=200)
        return Response(mx_tree, status=200)


class AdminAutopoolSummary(APIView):
    """
    Summary for Auto Commission Pool and Matrix progress.
    """
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        # Progress aggregates
        agg = (
            UserMatrixProgress.objects.values("pool_type")
            .annotate(
                users=Count("id"),
                total_earned=Sum("total_earned"),
            )
            .order_by()
        )
        progress = {row["pool_type"]: {
            "users": row["users"],
            "total_earned": float(row["total_earned"] or 0),
        } for row in agg}

        # Active accounts by pool (best-effort)
        accounts = (
            AutoPoolAccount.objects.values("pool_type", "status")
            .annotate(c=Count("id"))
            .order_by()
        )
        acc_map = {}
        for row in accounts:
            pool = row["pool_type"]
            acc_map.setdefault(pool, {"ACTIVE": 0, "PENDING": 0, "CLOSED": 0})
            acc_map[pool][row["status"]] = row["c"]

        # Compose
        data = {
            "progress": progress,
            "accounts": acc_map,
        }
        return Response(data, status=200)


class AdminAutopoolTransactionList(ListAPIView):
    """
    List recent Auto Pool and related commission transactions in a table-friendly format.
    Columns: TR (prefixed_id), Username, Sponsor ID, Amount (gross), Type, Main Wallet, Withdrawable (net), Date.
    Filters:
      - types: comma-separated WalletTransaction.type values (optional, defaults to commission/autopool related)
      - user: user id or username/full_name/phone contains
      - date_from, date_to: created_at (date)
      - ordering: default -created_at
      - page, page_size: pagination
    """
    permission_classes = [IsAdminOrStaff]
    serializer_class = AdminAutopoolTxnSerializer

    def get_queryset(self):
        qs = WalletTransaction.objects.select_related("user").all()

        # Default transaction types focused on commissions/autopool flows
        default_types = (
            "COMMISSION_CREDIT",
            "DIRECT_REF_BONUS",
            "LEVEL_BONUS",
            "AUTOPOOL_BONUS_FIVE",
            "AUTOPOOL_BONUS_THREE",
            "FRANCHISE_INCOME",
            "GLOBAL_ROYALTY",
            # Include coupon redeem credit since it may be a source for pool entries
            "REDEEM_ECOUPON_CREDIT",
        )
        types_param = (self.request.query_params.get("types") or "").strip()
        if types_param:
            types_list = [t.strip() for t in types_param.split(",") if t.strip()]
            if types_list:
                qs = qs.filter(type__in=types_list)
        else:
            qs = qs.filter(type__in=default_types)

        user_q = (self.request.query_params.get("user") or "").strip()
        if user_q:
            if user_q.isdigit():
                qs = qs.filter(Q(user_id=int(user_q)) | Q(user__username__icontains=user_q))
            else:
                qs = qs.filter(
                    Q(user__username__icontains=user_q)
                    | Q(user__full_name__icontains=user_q)
                    | Q(user__phone__icontains=user_q)
                )

        date_from = (self.request.query_params.get("date_from") or "").strip()
        date_to = (self.request.query_params.get("date_to") or "").strip()
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        ordering = (self.request.query_params.get("ordering") or "-created_at").strip()
        if ordering:
            qs = qs.order_by(ordering)
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        try:
            page = int(request.query_params.get("page") or 1)
        except Exception:
            page = 1
        try:
            page_size = int(request.query_params.get("page_size") or 50)
        except Exception:
            page_size = 50
        page = max(1, page)
        page_size = max(1, min(page_size, 200))

        total = qs.count()
        start = (page - 1) * page_size
        end = start + page_size
        serializer = self.get_serializer(qs[start:end], many=True, context=self.get_serializer_context())
        return Response({"count": total, "results": serializer.data}, status=200)


class AdminWithdrawalRejectView(APIView):
    """
    Reject a pending withdrawal without wallet mutation.
    Body: { "reason": "required/optional" }
    """
    permission_classes = [IsAdminOrStaff]

    def patch(self, request, pk: int):
        obj = WithdrawalRequest.objects.select_related("user").filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Withdrawal not found"}, status=404)
        reason = (request.data or {}).get("reason") or ""
        try:
            obj.reject(actor=request.user, reason=reason)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(AdminWithdrawalSerializer(obj).data, status=200)


# ================================
# Master Level Commission (L0..L5)
# ================================
class AdminLevelCommissionView(APIView):
    """
    GET: Return current Direct and L1..L5 fixed level commissions (rupees) from CommissionConfig.referral_join_fixed_json
         { direct, l1, l2, l3, l4, l5, updated_at }
    PATCH: Update any subset of the above keys with numeric values
         Body e.g. { "direct": 15, "l1": 2, "l2": 1, "l3": 1, "l4": 0.5, "l5": 0.5 }
    """
    permission_classes = [IsAdminOrStaff]

    def _serialize(self, cfg):
        fixed = dict(getattr(cfg, "referral_join_fixed_json", {}) or {})
        def _f(k, d):
            from decimal import Decimal as D
            try:
                return float(D(str(fixed.get(k, d))))
            except Exception:
                return float(d)
        payload = {
            "direct": _f("direct", 15),
            "l1": _f("l1", 2),
            "l2": _f("l2", 1),
            "l3": _f("l3", 1),
            "l4": _f("l4", 0.5),
            "l5": _f("l5", 0.5),
            "updated_at": getattr(cfg, "updated_at", None),
        }
        return payload

    def get(self, request):
        cfg = CommissionConfig.get_solo()
        return Response(self._serialize(cfg), status=200)

    def patch(self, request):
        from decimal import Decimal as D
        cfg = CommissionConfig.get_solo()
        fixed = dict(getattr(cfg, "referral_join_fixed_json", {}) or {})
        data = request.data or {}
        # Accept only known keys
        for k in ("direct", "l1", "l2", "l3", "l4", "l5"):
            if k in data:
                try:
                    v = D(str(data.get(k)))
                    if v < 0:
                        return Response({"detail": f"{k} must be >= 0"}, status=400)
                    # Quantize to 2 decimals string to avoid float drift in JSON
                    fixed[k] = float(v.quantize(D("0.01")))
                except Exception:
                    return Response({"detail": f"{k} must be a number"}, status=400)
        cfg.referral_join_fixed_json = fixed
        try:
            cfg.save(update_fields=["referral_join_fixed_json", "updated_at"])
        except Exception:
            cfg.save()
        return Response(self._serialize(cfg), status=200)


class AdminLevelCommissionSeedView(APIView):
    """
    POST: Reset Direct and L1..L5 to defaults {15, 2, 1, 1, 0.5, 0.5}
    """
    permission_classes = [IsAdminOrStaff]

    def post(self, request):
        cfg = CommissionConfig.get_solo()
        cfg.referral_join_fixed_json = {
            "direct": 15,
            "l1": 2,
            "l2": 1,
            "l3": 1,
            "l4": 0.5,
            "l5": 0.5,
        }
        try:
            cfg.save(update_fields=["referral_join_fixed_json", "updated_at"])
        except Exception:
            cfg.save()
        return Response({"ok": True, "defaults": cfg.referral_join_fixed_json}, status=200)


class AdminMatrixCommissionConfig(APIView):
    """
    GET: Return current 5‑matrix and 3‑matrix commission configuration (levels + amounts/percents)
         {
           five_matrix_levels, five_matrix_amounts_json, five_matrix_percents_json,
           three_matrix_levels, three_matrix_amounts_json, three_matrix_percents_json,
           updated_at
         }
    PATCH: Update any subset of those keys with numeric arrays (coerced to length by levels)
           Body e.g. { "five_matrix_amounts_json": [15, 2, 2.5, 0.5, 0.05, 0.1] }
    """
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        cfg = CommissionConfig.get_solo()
        ser = AdminAutopoolConfigSerializer(cfg)
        return Response(ser.data, status=200)

    def patch(self, request):
        cfg = CommissionConfig.get_solo()
        ser = AdminAutopoolConfigSerializer(cfg, data=request.data, partial=True)
        if ser.is_valid():
            obj = ser.save()
            return Response(AdminAutopoolConfigSerializer(obj).data, status=200)
        return Response(ser.errors, status=400)
