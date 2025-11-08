from datetime import date
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework import status

from accounts.models import CustomUser, Wallet, WalletTransaction, UserKYC, WithdrawalRequest
from coupons.models import Coupon, CouponCode, CouponSubmission, CouponBatch
from uploads.models import FileUpload
from business.models import UserMatrixProgress, AutoPoolAccount
from .permissions import IsAdminOrStaff
from .serializers import AdminUserNodeSerializer, AdminKYCSerializer, AdminWithdrawalSerializer, AdminMatrixProgressSerializer


class AdminMetricsView(APIView):
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        today = timezone.now().date()

        # Users
        users_total = CustomUser.objects.all().count()
        users_active = CustomUser.objects.filter(is_active=True).count()
        users_today = CustomUser.objects.filter(date_joined__date=today).count()

        # KYC pending: users with KYC not verified + users without KYC (consumers)
        kyc_unverified = UserKYC.objects.filter(verified=False).count()
        consumers_without_kyc = CustomUser.objects.filter(category="consumer").filter(~Q(kyc__isnull=False)).count()
        kyc_pending = kyc_unverified + consumers_without_kyc

        # Users by role/category (quick cards)
        by_role = (
            CustomUser.objects.values("role")
            .annotate(c=Count("id"))
            .order_by()
        )
        by_category = (
            CustomUser.objects.values("category")
            .annotate(c=Count("id"))
            .order_by()
        )
        users_block = {
            "total": users_total,
            "active": users_active,
            "todayNew": users_today,
            "kycPending": kyc_pending,
            "byRole": {r["role"]: r["c"] for r in by_role if r["role"]},
            "byCategory": {r["category"]: r["c"] for r in by_category if r["category"]},
        }

        # Wallets
        total_balance = Wallet.objects.aggregate(s=Sum("balance"))["s"] or Decimal("0.00")
        tx_today = WalletTransaction.objects.filter(created_at__date=today).count()
        wallets_block = {
            "totalBalance": float(total_balance),
            "transactionsToday": tx_today,
        }

        # Withdrawals
        wdr_pending_qs = WithdrawalRequest.objects.filter(status="pending")
        withdrawals_block = {
            "pendingCount": wdr_pending_qs.count(),
            "pendingAmount": float(wdr_pending_qs.aggregate(s=Sum("amount"))["s"] or Decimal("0.00")),
        }

        # Coupons
        cc_total = CouponCode.objects.all().count()
        cc_assigned = CouponCode.objects.filter(status__in=["ASSIGNED_AGENCY", "ASSIGNED_EMPLOYEE"]).count()
        cc_redeemed = CouponCode.objects.filter(status="REDEEMED").count()
        # Pending submissions considered as waiting for approvals (SUBMITTED or EMPLOYEE_APPROVED)
        pending_submissions = CouponSubmission.objects.filter(status__in=["SUBMITTED", "EMPLOYEE_APPROVED"]).count()
        coupons_block = {
            "total": cc_total,
            "assigned": cc_assigned,
            "redeemed": cc_redeemed,
            "pendingSubmissions": pending_submissions,
        }

        # Uploads
        uploads_total = FileUpload.objects.all().count()
        uploads_today = FileUpload.objects.filter(created_at__date=today).count()
        uploads_block = {
            "total": uploads_total,
            "todayNew": uploads_today,
            "failed": 0,
        }

        return Response(
            {
                "users": users_block,
                "wallets": wallets_block,
                "withdrawals": withdrawals_block,
                "coupons": coupons_block,
                "uploads": uploads_block,
            },
            status=status.HTTP_200_OK,
        )


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

        # Try by id (numeric)
        if digits and digits == identifier and digits.isdigit():
            user = CustomUser.objects.filter(id=int(digits)).first()

        # Try by username/email/unique_id/sponsor_id and phone digits
        if not user:
            q = (
                Q(username__iexact=identifier)
                | Q(email__iexact=identifier)
                | Q(unique_id__iexact=identifier)
                | Q(sponsor_id__iexact=identifier)
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
        qs = CustomUser.objects.all().annotate(
            direct_count=Count("registrations", distinct=True)
        )
        role = (self.request.query_params.get("role") or "").strip()
        phone = (self.request.query_params.get("phone") or "").strip()
        category = (self.request.query_params.get("category") or "").strip()
        pincode = (self.request.query_params.get("pincode") or "").strip()
        state_id = (self.request.query_params.get("state") or "").strip()
        kyc = (self.request.query_params.get("kyc") or "").strip()
        search = (self.request.query_params.get("search") or "").strip()

        if role:
            qs = qs.filter(role=role)
        if category:
            qs = qs.filter(category=category)
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
        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(full_name__icontains=search)
                | Q(email__icontains=search)
                | Q(unique_id__icontains=search)
            )

        return qs.order_by("-date_joined")


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
        def build_node(user, level):
            node = {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "level": level,
                "children": [],
            }
            if level >= max_depth:
                return node
            children = list(
                CustomUser.objects.filter(registered_by_id=user.id)
                .only("id", "username", "full_name")
                .order_by("id")
            )
            for c in children:
                node["children"].append(build_node(c, level + 1))
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
            # Try exact id if numeric-only
            if digits and digits == identifier and digits.isdigit():
                user = CustomUser.objects.filter(id=int(digits)).first()
            if not user:
                q = (
                    Q(username__iexact=identifier)
                    | Q(email__iexact=identifier)
                    | Q(unique_id__iexact=identifier)
                    | Q(sponsor_id__iexact=identifier)
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

        def build_sponsor(u, level: int):
            node = {
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name,
                "level": level,
                "children": [],
            }
            if level >= max_depth:
                return node
            children = list(
                CustomUser.objects.filter(
                    Q(registered_by_id=u.id)
                    | Q(sponsor_id__iexact=u.username)
                    | Q(sponsor_id__iexact=u.sponsor_id)
                )
                .only("id", "username", "full_name")
                .order_by("id")
                .distinct()
            )
            for c in children:
                node["children"].append(build_sponsor(c, level + 1))
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
