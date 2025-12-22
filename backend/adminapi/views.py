from datetime import date
from decimal import Decimal

from django.db.models import Count, Q, Sum, Prefetch
from django.utils import timezone
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.http import HttpResponse

from accounts.models import CustomUser, Wallet, WalletTransaction, UserKYC, WithdrawalRequest, SupportTicket, SupportTicketMessage, AgencyRegionAssignment
from coupons.models import Coupon, CouponCode, CouponSubmission, CouponBatch
from uploads.models import FileUpload, DashboardCard, HomeCard, LuckyDrawSubmission
from market.models import Product, PurchaseRequest, Banner, BannerItem, BannerPurchaseRequest
from business.models import UserMatrixProgress, AutoPoolAccount, DailyReport, CommissionConfig, PromoPurchase
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
            active=Count("id", filter=Q(account_active=True)),
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
            .select_related("country", "state", "city", "wallet", "kyc", "registered_by")
            .prefetch_related(
                "matrix_progress",
                Prefetch(
                    "promo_purchases",
                    queryset=PromoPurchase.objects.select_related("package")
                    .filter(status="APPROVED")
                    .order_by("-approved_at", "-id"),
                    to_attr="approved_promo_purchases",
                ),
                Prefetch(
                    "region_assignments",
                    queryset=AgencyRegionAssignment.objects.select_related("state", "state__country").order_by("id"),
                    to_attr="prefetched_agency_assignments",
                ),
            )
            .annotate(
                direct_count=Count("registrations", distinct=True),
                activated_ecoupon_count=Count(
                    "coupon_submissions",
                    filter=Q(coupon_submissions__status="AGENCY_APPROVED"),
                    distinct=True,
                ),
            )
            .only(
                # Base fields used by AdminUserNodeSerializer and filters
                "id", "username", "full_name", "email", "role", "category",
                "phone", "pincode", "date_joined", "is_active", "account_active",
                "prefixed_id", "sponsor_id", "unique_id", "first_purchase_activated_at",
                "avatar",
                # Geo relations displayed in serializer
                "country__id", "country__name",
                "state__id", "state__name",
                "city__id", "city__name",
                # Registered by (for sponsor display)
                "registered_by__username", "registered_by__prefixed_id",
                # Wallet summary used in list grid
                "wallet__main_balance", "wallet__balance",
                # KYC status in list grid
                "kyc__verified", "kyc__verified_at",
                # Password metadata (status/algo only)
                "password", "last_password_encrypted",
            )
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

        # New: filter by explicit account_active (admin "Account status")
        account_active = (self.request.query_params.get("account_active") or "").strip().lower()
        if account_active in ("1", "true", "yes", "active"):
            qs = qs.filter(account_active=True)
        elif account_active in ("0", "false", "no", "inactive"):
            qs = qs.filter(account_active=False)

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
        # List view context: keep response lightweight and avoid decryption and heavy work
        ctx["purpose"] = "list"
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
        total_pages = (total + page_size - 1) // page_size
        return Response(
            {
                "count": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "has_next": end < total,
                "has_prev": start > 0,
                "results": serializer.data,
            },
            status=200,
        )


class AdminUsersExportXLSX(APIView):
    """
    Export Admin Users grid to XLSX with full details.
    - Applies the same filters as AdminUsersList (via query params).
    - Excludes usernames in the "9000000" series by default.
      Pass include_9000000=1 to include them.
    """
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        # Lazy import so server still boots if openpyxl is missing
        try:
            import openpyxl
            from openpyxl.utils import get_column_letter
        except Exception:
            return Response({"detail": "openpyxl is not installed on the server"}, status=400)

        # Reuse list view queryset with current filters
        view = AdminUsersList()
        view.request = request
        qs = view.get_queryset()

        # Exclude usernames that are in 9000000 series by default
        # (covers usernames that start with or contain 9000000, e.g. test seeds)
        include_9m = str(request.query_params.get("include_9000000") or "").lower() in ("1", "true", "yes")
        if not include_9m:
            qs = qs.exclude(Q(username__startswith="9000000") | Q(username__icontains="9000000"))

        # Serialize with 'detail' purpose to compute richer fields (e.g., kyc, wallet summary)
        ser = AdminUserNodeSerializer(qs, many=True, context={"request": request, "purpose": "detail"})
        items = ser.data

        # Column order mirrors Admin Users grid (plus a few essentials)
        headers = [
            "id", "username", "full_name", "email", "role", "category", "phone",
            "sponsor_id", "pincode", "district_name", "state_name", "country_name",
            "kyc_status", "kyc_verified", "kyc_verified_at",
            "commission_level", "activated_ecoupon_count", "last_promo_package",
            "wallet_balance", "wallet_status", "direct_count", "has_children",
            "account_active", "is_active", "date_joined",
        ]

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Users"
        ws.append(headers)

        for obj in items:
            ws.append([
                obj.get("id"),
                obj.get("username") or "",
                obj.get("full_name") or "",
                obj.get("email") or "",
                obj.get("role") or "",
                obj.get("category") or "",
                obj.get("phone") or "",
                obj.get("sponsor_id") or "",
                obj.get("pincode") or "",
                obj.get("district_name") or "",
                obj.get("state_name") or "",
                obj.get("country_name") or "",
                obj.get("kyc_status") or "",
                bool(obj.get("kyc_verified")) if obj.get("kyc_verified") is not None else "",
                obj.get("kyc_verified_at") or "",
                obj.get("commission_level") or 0,
                obj.get("activated_ecoupon_count") or 0,
                obj.get("last_promo_package") or "",
                obj.get("wallet_balance") if obj.get("wallet_balance") not in (None, "") else "",
                obj.get("wallet_status") or "",
                obj.get("direct_count") or 0,
                bool(obj.get("has_children")) if obj.get("has_children") is not None else "",
                bool(obj.get("account_active")) if obj.get("account_active") is not None else "",
                bool(obj.get("is_active")) if obj.get("is_active") is not None else "",
                obj.get("date_joined") or "",
            ])

        # Auto-size columns
        for col_idx, header in enumerate(headers, start=1):
            max_len = len(str(header))
            for row in ws.iter_rows(min_row=2, min_col=col_idx, max_col=col_idx):
                val = "" if row[0].value is None else str(row[0].value)
                if len(val) > max_len:
                    max_len = len(val)
            ws.column_dimensions[get_column_letter(col_idx)].width = min(max_len + 2, 60)

        from io import BytesIO
        bio = BytesIO()
        wb.save(bio)
        bio.seek(0)

        filename = f"admin_users_{timezone.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        resp = HttpResponse(
            bio.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp

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

    def delete(self, request, pk: int):
        """
        Permanently delete a user. Guards:
          - Cannot delete self
          - Cannot delete superuser
        Returns 204 No Content on success.
        """
        user = CustomUser.objects.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found"}, status=404)
        # Prevent accidental self-delete
        if getattr(request.user, "id", None) == user.id:
            return Response({"detail": "You cannot delete your own admin account."}, status=400)
        # Prevent deleting superusers
        if getattr(user, "is_superuser", False):
            return Response({"detail": "Cannot delete a superuser."}, status=400)
        try:
            user.delete()
            return Response(status=204)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)


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


class AdminUserWalletAdjustView(APIView):
    """
    Admin-only: adjust a user's wallet by credit or debit.
    Body: { "action": "credit" | "debit", "amount": number, "note": "optional", "type": "optional override type" }
    - Credits go to main balance with no withholding.
    - Debits reduce balances using Wallet.debit rules.
    Response: { balance, main_balance, withdrawable_balance }
    """
    permission_classes = [IsAdminOrStaff]

    def post(self, request, pk: int):
        user = CustomUser.objects.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found"}, status=404)

        data = request.data or {}
        action = str(data.get("action") or "").strip().lower()
        note = str(data.get("note") or "").strip()
        tx_type_in = str(data.get("type") or "").strip()

        # Coerce amount
        from decimal import Decimal as D
        try:
            amount = D(str(data.get("amount")))
        except Exception:
            return Response({"detail": "amount must be a number"}, status=400)
        if amount <= 0:
            return Response({"detail": "amount must be > 0"}, status=400)

        if action not in ("credit", "debit"):
            return Response({"detail": "action must be 'credit' or 'debit'"}, status=400)

        w = Wallet.get_or_create_for_user(user)
        meta = {"note": note, "by_admin": getattr(request.user, "username", None) or ""}

        try:
            if action == "credit":
                tx_type = tx_type_in or "ADJUSTMENT_CREDIT"
                # No withholding on manual admin credit
                w.credit(amount, tx_type=tx_type, meta={**meta, "no_withhold": True}, source_type="ADMIN", source_id=str(getattr(request.user, "id", "")))
            else:
                tx_type = tx_type_in or "ADJUSTMENT_DEBIT"
                w.debit(amount, tx_type=tx_type, meta=meta, source_type="ADMIN", source_id=str(getattr(request.user, "id", "")))
        except Exception as e:
            return Response({"detail": str(e)}, status=400)

        # Fresh balances
        try:
            w_refreshed = Wallet.objects.get(pk=w.pk)
        except Exception:
            w_refreshed = w
        return Response(
            {
                "balance": float(w_refreshed.balance or 0),
                "main_balance": float(w_refreshed.main_balance or 0),
                "withdrawable_balance": float(w_refreshed.withdrawable_balance or 0),
            },
            status=200,
        )


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


class AdminMatrixAccountsList(APIView):
    """
    Admin: List AutoPoolAccount entries (matrix accounts) with filters.
    Query params:
      - pool: FIVE_150 | THREE_150 | THREE_50
      - user: id or username/full_name/phone contains
      - source_type: string (e.g., ECOUPON)
      - source_id: string (e.g., coupon id)
      - date_from, date_to: created_at (date)
      - ordering: -created_at (default) | created_at | level | -level | position | -position
      - page (default 1), page_size (default 25, max 200)
    """
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
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

        pool = (request.query_params.get("pool") or "").strip().upper()
        user_q = (request.query_params.get("user") or "").strip()
        source_type = (request.query_params.get("source_type") or "").strip()
        source_id = (request.query_params.get("source_id") or "").strip()
        date_from = (request.query_params.get("date_from") or "").strip()
        date_to = (request.query_params.get("date_to") or "").strip()
        ordering = (request.query_params.get("ordering") or "-created_at").strip()

        qs = (AutoPoolAccount.objects
              .select_related("owner", "parent_account", "parent_account__owner")
              .all())

        if pool in ("FIVE_150", "THREE_150", "THREE_50"):
            qs = qs.filter(pool_type=pool)

        if user_q:
            if user_q.isdigit():
                qs = qs.filter(Q(owner_id=int(user_q)) | Q(owner__username__icontains=user_q))
            else:
                qs = qs.filter(
                    Q(owner__username__icontains=user_q)
                    | Q(owner__full_name__icontains=user_q)
                    | Q(owner__phone__icontains=user_q)
                )

        if source_type:
            qs = qs.filter(source_type=source_type)
        if source_id:
            qs = qs.filter(source_id=source_id)

        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        allowed_order = {"created_at", "-created_at", "level", "-level", "position", "-position", "id", "-id"}
        if ordering not in allowed_order:
            ordering = "-created_at"
        qs = qs.order_by(ordering)

        total = qs.count()
        start = (page - 1) * page_size
        end = start + page_size
        items = qs[start:end]

        results = []
        for a in items:
            parent_owner = None
            try:
                po = getattr(a.parent_account, "owner", None)
                parent_owner = {
                    "id": getattr(po, "id", None),
                    "username": getattr(po, "username", None),
                } if po else None
            except Exception:
                parent_owner = None

            results.append({
                "id": a.id,
                "pool_type": a.pool_type,
                "owner_id": a.owner_id,
                "username": getattr(a.owner, "username", None),
                "parent_account_id": a.parent_account_id,
                "parent_owner": parent_owner,
                "level": a.level,
                "position": a.position,
                "source_type": a.source_type or "",
                "source_id": a.source_id or "",
                "created_at": a.created_at,
            })

        return Response({"count": total, "page": page, "page_size": page_size, "results": results}, status=200)


class AdminMatrixAccountStats(APIView):
    """
    Admin: Level-wise and total commission stats for a matrix account (by account_id)
           or by (pool + source_type + source_id) tuple.
    Query params:
      - account_id: int
        OR
      - pool: FIVE_150 | THREE_150 | THREE_50
      - source_type: string
      - source_id: string
    Response:
      {
        "pool": "...",
        "source_type": "...",
        "source_id": "...",
        "tx_count": 10,
        "total_amount": "123.45",
        "per_level": {
          "1": { "count": 5, "amount": "50.00" },
          ...
        },
        "account": { ... }  // when account_id provided
      }
    """
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        account_id = (request.query_params.get("account_id") or "").strip()
        pool = (request.query_params.get("pool") or "").strip().upper()
        src_type = (request.query_params.get("source_type") or "").strip()
        src_id = (request.query_params.get("source_id") or "").strip()

        account_info = None
        if account_id:
            try:
                acc = AutoPoolAccount.objects.select_related("owner", "parent_account", "parent_account__owner").get(pk=int(account_id))
            except Exception:
                return Response({"detail": "account not found"}, status=404)
            pool = acc.pool_type
            src_type = acc.source_type or ""
            src_id = acc.source_id or ""
            account_info = {
                "id": acc.id,
                "pool_type": acc.pool_type,
                "owner_id": acc.owner_id,
                "username": getattr(acc.owner, "username", None),
                "parent_account_id": acc.parent_account_id,
                "level": acc.level,
                "position": acc.position,
                "source_type": src_type,
                "source_id": src_id,
                "created_at": acc.created_at,
            }

        if not (pool and src_type and src_id):
            return Response({"detail": "Provide account_id or (pool + source_type + source_id)."}, status=400)

        if pool == "FIVE_150":
            tx_types = ("AUTOPOOL_BONUS_FIVE",)
        elif pool in ("THREE_150", "THREE_50"):
            tx_types = ("AUTOPOOL_BONUS_THREE",)
        else:
            return Response({"detail": "Invalid pool"}, status=400)

        qs = (WalletTransaction.objects
              .select_related("user")
              .filter(type__in=tx_types, source_type=src_type, source_id=str(src_id))
              .order_by("id"))

        from decimal import Decimal as D
        total_amount = D("0.00")
        per_level = {}
        tx_count = 0

        for t in qs:
            tx_count += 1
            amt = D(str(getattr(t, "amount", "0") or "0"))
            total_amount += amt
            meta = getattr(t, "meta", {}) or {}
            try:
                lvl = int(meta.get("level_index") or 0)
            except Exception:
                lvl = 0
            key = str(lvl)
            row = per_level.get(key) or {"count": 0, "amount": D("0.00")}
            row["count"] += 1
            row["amount"] = row["amount"] + amt
            per_level[key] = row

        # Format amounts to strings
        per_level_out = {}
        for k, v in per_level.items():
            per_level_out[k] = {"count": v["count"], "amount": f'{D(v["amount"]):.2f}'}

        payload = {
            "pool": pool,
            "source_type": src_type,
            "source_id": str(src_id),
            "tx_count": tx_count,
            "total_amount": f'{D(total_amount):.2f}',
            "per_level": dict(sorted(per_level_out.items(), key=lambda x: int(x[0]) if str(x[0]).isdigit() else 9999)),
        }
        if account_info:
            payload["account"] = account_info
        return Response(payload, status=200)


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


class AdminWithdrawalDistributionPreviewView(APIView):
    """
    Preview Direct Refer Withdraw Commission distribution for a given user and amount.
    Query params:
      - user_id: int (preferred)
      - user or username: str (optional alternative)
      - amount: number (required)
    Response: same schema as business.services.withdrawals.compute_withdraw_distribution(...)
    """
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        user_id = (request.query_params.get("user_id") or "").strip()
        user_q = (request.query_params.get("user") or request.query_params.get("username") or "").strip()
        amount = request.query_params.get("amount")
        if amount is None or str(amount).strip() == "":
            return Response({"detail": "amount is required"}, status=400)

        user = None
        if user_id and str(user_id).isdigit():
            user = CustomUser.objects.filter(id=int(user_id)).first()

        if not user and user_q:
            # Try by username, then prefixed sponsor id, then phone digits
            u = CustomUser.objects.filter(username__iexact=user_q).first()
            if not u:
                u = CustomUser.objects.filter(prefixed_id__iexact=user_q).first()
            if not u:
                digits = "".join(ch for ch in str(user_q) if ch.isdigit())
                if digits:
                    u = CustomUser.objects.filter(phone__iexact=digits).first()
            user = u

        if not user:
            return Response({"detail": "user not found"}, status=404)

        try:
            from business.services.withdrawals import compute_withdraw_distribution
            data = compute_withdraw_distribution(user, amount)
            return Response(data, status=200)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)

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


class AdminMasterCommissionConfig(APIView):
    """
    GET: Current Master Commission configuration used across flows (withdrawals sponsor %, tax %, company user).
         {
           "tax": { "percent": 10.0 },
           "withdrawal": { "sponsor_percent": 3.0 },
           "company_user": { "id": 1, "username": "company" } | null,
           "upline": { "l1": 2, "l2": 1, "l3": 1, "l4": 0.5, "l5": 0.5 },         // optional convenience
           "geo": { "sub_franchise": 15, "pincode": 4, ... },                      // optional convenience
           "updated_at": "..."
         }
    PATCH: Update any subset:
         {
           "tax": { "percent": 10 },
           "tax_company_user_id": 1,
           "withdrawal": { "sponsor_percent": 3 },
           "upline": { "l1": 2, "l2": 1, "l3": 1, "l4": 0.5, "l5": 0.5 },
           "geo": { "sub_franchise": 15, "pincode": 4, ... }
         }
    """
    permission_classes = [IsAdminOrStaff]

    def _float(self, v):
        from decimal import Decimal as D
        try:
            return float(D(str(v)))
        except Exception:
            try:
                return float(v)
            except Exception:
                return 0.0

    def get(self, request):
        cfg = CommissionConfig.get_solo()
        cu = cfg.get_company_user()
        upline_list = cfg.get_level_percents()
        try:
            upline = {
                "l1": self._float(upline_list[0]) if len(upline_list) > 0 else 0.0,
                "l2": self._float(upline_list[1]) if len(upline_list) > 1 else 0.0,
                "l3": self._float(upline_list[2]) if len(upline_list) > 2 else 0.0,
                "l4": self._float(upline_list[3]) if len(upline_list) > 3 else 0.0,
                "l5": self._float(upline_list[4]) if len(upline_list) > 4 else 0.0,
            }
        except Exception:
            upline = {"l1": 0, "l2": 0, "l3": 0, "l4": 0, "l5": 0}
        geo_raw = cfg.get_geo_percents()
        geo = {k: self._float(v) for k, v in (geo_raw.items() if isinstance(geo_raw, dict) else [])}
        payload = {
            "tax": {"percent": self._float(cfg.get_tax_percent())},
            "withdrawal": {"sponsor_percent": self._float(cfg.get_withdrawal_sponsor_percent())},
            "company_user": ({"id": getattr(cu, "id", None), "username": getattr(cu, "username", None)} if cu else None),
            "upline": upline,
            "geo": geo,
            "updated_at": getattr(cfg, "updated_at", None),
        }
        return Response(payload, status=200)

    def patch(self, request):
        from decimal import Decimal as D
        data = request.data or {}
        cfg = CommissionConfig.get_solo()
        # Start from existing master json
        master = dict(getattr(cfg, "master_commission_json", {}) or {})

        # tax.percent
        tax = data.get("tax")
        if isinstance(tax, dict) and "percent" in tax:
            try:
                p = D(str(tax.get("percent")))
                if p < 0:
                    return Response({"detail": "tax.percent must be >= 0"}, status=400)
                t = dict(master.get("tax") or {})
                t["percent"] = float(p)
                master["tax"] = t
            except Exception:
                return Response({"detail": "tax.percent must be a number"}, status=400)

        # tax_company_user_id (relation field on model)
        if "tax_company_user_id" in data:
            try:
                tid = int(data.get("tax_company_user_id") or 0)
            except Exception:
                return Response({"detail": "tax_company_user_id must be integer id"}, status=400)
            if tid > 0:
                from accounts.models import CustomUser
                user = CustomUser.objects.filter(id=tid).first()
                if not user:
                    return Response({"detail": "tax_company_user_id not found"}, status=400)
                cfg.tax_company_user = user
            else:
                cfg.tax_company_user = None  # allow clearing

        # withdrawal.sponsor_percent
        wd = data.get("withdrawal")
        if isinstance(wd, dict) and "sponsor_percent" in wd:
            try:
                sp = D(str(wd.get("sponsor_percent")))
                if sp < 0:
                    return Response({"detail": "withdrawal.sponsor_percent must be >= 0"}, status=400)
                w = dict(master.get("withdrawal") or {})
                w["sponsor_percent"] = float(sp)
                master["withdrawal"] = w
            except Exception:
                return Response({"detail": "withdrawal.sponsor_percent must be a number"}, status=400)

        # upline l1..l5 (optional convenience; stored under master.upline)
        up = data.get("upline")
        if isinstance(up, dict):
            u = dict(master.get("upline") or {})
            for k in ("l1", "l2", "l3", "l4", "l5"):
                if k in up:
                    try:
                        val = D(str(up.get(k)))
                        if val < 0:
                            return Response({"detail": f"upline.{k} must be >= 0"}, status=400)
                        u[k] = float(val)
                    except Exception:
                        return Response({"detail": f"upline.{k} must be a number"}, status=400)
            master["upline"] = u

        # geo percents (optional convenience)
        geo = data.get("geo")
        if isinstance(geo, dict):
            g_cur = dict(master.get("geo") or {})
            allowed = {"sub_franchise", "pincode", "pincode_coord", "district", "district_coord", "state", "state_coord", "employee", "royalty"}
            for k, v in geo.items():
                if k not in allowed:
                    continue
                try:
                    vv = D(str(v))
                    if vv < 0:
                        return Response({"detail": f"geo.{k} must be >= 0"}, status=400)
                    g_cur[k] = float(vv)
                except Exception:
                    return Response({"detail": f"geo.{k} must be a number"}, status=400)
            master["geo"] = g_cur

        # Persist
        cfg.master_commission_json = master
        try:
            if "tax_company_user_id" in data:
                cfg.save(update_fields=["master_commission_json", "tax_company_user", "updated_at"])
            else:
                cfg.save(update_fields=["master_commission_json", "updated_at"])
        except Exception:
            cfg.save()

        # Return fresh GET payload
        return self.get(request)

class AdminRewardPointsConfig(APIView):
    """
    GET: Return admin-configurable Reward Points schedule used by /business/rewards/points/
         {
           "tiers": [ { "count": 1, "points": 1000 }, ..., { "count": 5, "points": 110000 } ],
           "after": { "base_count": 5, "per_coupon": 20000 },
           "updated_at": "..."
         }
    PATCH: Update any subset of the above keys with validation.
           - tiers: array of {count:int>=1, points:int>=0}, sorted and unique by count
           - after.base_count: int >= max(tiers.count)
           - after.per_coupon: int >= 0
    """
    permission_classes = [IsAdminOrStaff]

    def _default_config(self):
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

    def _serialize(self, cfg):
        conf = dict(getattr(cfg, "reward_points_config_json", {}) or {})
        # Fill defaults if missing/invalid
        try:
            tiers = conf.get("tiers") or []
            after = conf.get("after") or {}
            if not isinstance(tiers, list) or not tiers:
                raise ValueError("tiers missing")
            norm_tiers = []
            seen = set()
            for t in tiers:
                c = int(t.get("count"))
                p = int(t.get("points"))
                if c < 1 or p < 0:
                    raise ValueError("invalid tier")
                if c in seen:
                    continue
                seen.add(c)
                norm_tiers.append({"count": c, "points": p})
            norm_tiers.sort(key=lambda x: x["count"])
            base_count = int(after.get("base_count", norm_tiers[-1]["count"]))
            per_coupon = int(after.get("per_coupon", 0))
            if base_count < norm_tiers[-1]["count"] or per_coupon < 0:
                raise ValueError("invalid after")
            conf = {"tiers": norm_tiers, "after": {"base_count": base_count, "per_coupon": per_coupon}}
        except Exception:
            conf = self._default_config()
        conf["updated_at"] = getattr(cfg, "updated_at", None)
        return conf

    def get(self, request):
        cfg = CommissionConfig.get_solo()
        return Response(self._serialize(cfg), status=200)

    def patch(self, request):
        cfg = CommissionConfig.get_solo()
        existing = self._serialize(cfg)
        data = request.data or {}

        # Start from existing; override selectively
        tiers_in = data.get("tiers", None)
        after_in = data.get("after", None)

        new_conf = {
            "tiers": existing.get("tiers") or self._default_config()["tiers"],
            "after": existing.get("after") or self._default_config()["after"],
        }

        # Validate tiers if provided
        if tiers_in is not None:
            if not isinstance(tiers_in, list) or not tiers_in:
                return Response({"detail": "tiers must be a non-empty array"}, status=400)
            try:
                norm = []
                seen = set()
                for t in tiers_in:
                    c = int(t.get("count"))
                    p = int(t.get("points"))
                    if c < 1 or p < 0:
                        return Response({"detail": "each tier must have count>=1 and points>=0"}, status=400)
                    if c in seen:
                        return Response({"detail": f"duplicate count in tiers: {c}"}, status=400)
                    seen.add(c)
                    norm.append({"count": c, "points": p})
                norm.sort(key=lambda x: x["count"])
                new_conf["tiers"] = norm
            except Exception:
                return Response({"detail": "invalid tiers payload"}, status=400)

        # Validate after if provided
        if after_in is not None:
            try:
                base_count = int(after_in.get("base_count", new_conf["after"]["base_count"]))
                per_coupon = int(after_in.get("per_coupon", new_conf["after"]["per_coupon"]))
                max_tier = max(t["count"] for t in (new_conf["tiers"] or [{"count": 1}]))
                if base_count < max_tier:
                    return Response({"detail": f"after.base_count must be >= max tier count ({max_tier})"}, status=400)
                if per_coupon < 0:
                    return Response({"detail": "after.per_coupon must be >= 0"}, status=400)
                new_conf["after"] = {"base_count": base_count, "per_coupon": per_coupon}
            except Exception:
                return Response({"detail": "invalid after payload"}, status=400)

        cfg.reward_points_config_json = new_conf
        try:
            cfg.save(update_fields=["reward_points_config_json", "updated_at"])
        except Exception:
            cfg.save()
        return Response(self._serialize(cfg), status=200)
