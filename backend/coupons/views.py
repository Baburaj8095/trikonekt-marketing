from django.utils import timezone
from django.db import transaction
from django.db.models import Q, Count
from rest_framework import status, viewsets, mixins
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from accounts.models import CustomUser
from .models import (
    Coupon,
    CouponAssignment,
    CouponSubmission,
    CouponCode,
    CouponBatch,
    Commission,
    AuditTrail,
    ECouponPaymentConfig,
    ECouponProduct,
    ECouponOrder,
)
from .serializers import (
    CouponSerializer,
    CouponAssignmentSerializer,
    CouponSubmissionSerializer,
    CouponCodeSerializer,
    CouponBatchSerializer,
    CommissionSerializer,
    AuditTrailSerializer,
    ECouponPaymentConfigSerializer,
    ECouponProductSerializer,
    ECouponOrderSerializer,
)

# Pagination (per-view) for coupon codes
class StandardResultsSetPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


def is_agency_user(user: CustomUser) -> bool:
    # v1 rule: either top-level role is 'agency' or category starts with 'agency'
    return (getattr(user, "role", None) == "agency") or str(getattr(user, "category", "")).startswith("agency")


def is_employee_user(user: CustomUser) -> bool:
    return (getattr(user, "role", None) == "employee") or (getattr(user, "category", None) == "employee")


def is_consumer_user(user: CustomUser) -> bool:
    return (getattr(user, "role", None) == "user") and (getattr(user, "category", None) == "consumer")


def is_admin_user(user: CustomUser) -> bool:
    # Treat Django superusers/staff as Admins for Physical Lucky Coupon Management
    return bool(getattr(user, "is_superuser", False) or getattr(user, "is_staff", False))


class CouponViewSet(viewsets.ModelViewSet):
    queryset = Coupon.objects.all().order_by("-created_at")
    serializer_class = CouponSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Non-agency users should only see active coupons
        if not is_agency_user(user):
            qs = qs.filter(is_active=True)
        return qs

    def create(self, request, *args, **kwargs):
        # Only admin can create coupons
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin users can create coupons."}, status=status.HTTP_403_FORBIDDEN)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(issuer=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        # Only admin (ideally coupon.issuer) can update coupon
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin users can update coupons."}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated], url_path="assign")
    def assign(self, request, pk=None):
        """
        Assign a coupon to an employee.
        Body: { "employee": <employee_id> }
        """
        if not is_agency_user(request.user):
            return Response({"detail": "Only agency users can assign coupons."}, status=status.HTTP_403_FORBIDDEN)

        try:
            coupon = self.get_object()
        except Exception:
            return Response({"detail": "Coupon not found."}, status=status.HTTP_404_NOT_FOUND)

        if hasattr(coupon, "assignment"):
            return Response({"detail": "This coupon is already assigned."}, status=status.HTTP_400_BAD_REQUEST)

        employee_id = request.data.get("employee")
        if not employee_id:
            return Response({"employee": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)

        try:
            employee = CustomUser.objects.get(id=employee_id)
        except CustomUser.DoesNotExist:
            return Response({"employee": ["Invalid employee id."]}, status=status.HTTP_400_BAD_REQUEST)

        if not is_employee_user(employee):
            return Response({"employee": ["Provided user is not an employee."]}, status=status.HTTP_400_BAD_REQUEST)

        assign = CouponAssignment.objects.create(
            coupon=coupon, employee=employee, assigned_by=request.user, status="ASSIGNED"
        )
        data = CouponAssignmentSerializer(assign).data
        return Response(data, status=status.HTTP_201_CREATED)


class CouponAssignmentViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = CouponAssignment.objects.select_related("coupon", "employee", "assigned_by").all()
    serializer_class = CouponAssignmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if is_employee_user(user):
            return qs.filter(employee=user)
        # Agency: return all by default; optionally filter by ?assigned_by_me=1
        if is_agency_user(user) and self.request.query_params.get("assigned_by_me"):
            return qs.filter(assigned_by=user)
        return qs

    @action(detail=False, methods=["get"], url_path="mine", permission_classes=[IsAuthenticated])
    def mine(self, request):
        if not is_employee_user(request.user):
            return Response({"detail": "Only employees can view their assignments."}, status=status.HTTP_403_FORBIDDEN)
        qs = self.get_queryset().filter(employee=request.user)
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)


class CouponCodeViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = CouponCode.objects.select_related("coupon", "assigned_employee", "assigned_agency", "issued_by", "batch").all()
    serializer_class = CouponCodeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        # Employee: see only codes assigned to me
        if is_employee_user(user):
            return qs.filter(assigned_employee=user)
        # Agency: see only codes assigned to my agency
        if is_agency_user(user):
            qs = qs.filter(assigned_agency=user)
        coupon_id = self.request.query_params.get("coupon")
        status_in = self.request.query_params.get("status")
        batch_id = self.request.query_params.get("batch")
        if coupon_id:
            qs = qs.filter(coupon_id=coupon_id)
        if batch_id:
            qs = qs.filter(batch_id=batch_id)
        if status_in:
            qs = qs.filter(status=status_in)
        # Optional channel filter so Agency can request only e-coupons
        channel = self.request.query_params.get("channel") or self.request.query_params.get("issued_channel")
        if channel:
            qs = qs.filter(issued_channel=channel)

        # Optional denomination/value filter for inventory checks
        value_param = self.request.query_params.get("value") or self.request.query_params.get("denomination")
        if value_param is not None:
            try:
                from decimal import Decimal
                qs = qs.filter(value=Decimal(str(value_param)))
            except Exception:
                # Fallback to best-effort string/number compare
                try:
                    qs = qs.filter(value=value_param)
                except Exception:
                    pass

        return qs

    @action(detail=False, methods=["get"], url_path="mine", permission_classes=[IsAuthenticated])
    def mine(self, request):
        if not is_employee_user(request.user):
            return Response({"detail": "Only employees can view their codes."}, status=status.HTTP_403_FORBIDDEN)
        qs = self.get_queryset().filter(assigned_employee=request.user)
        page = self.paginate_queryset(qs)
        ser = self.get_serializer(page if page is not None else qs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)

    @action(detail=False, methods=["get"], url_path="mine-consumer", permission_classes=[IsAuthenticated])
    def mine_consumer(self, request):
        """
        Consumer: list my e-coupon codes (ownership via assigned_consumer)
        """
        if not is_consumer_user(request.user):
            return Response({"detail": "Only consumers can view their codes."}, status=status.HTTP_403_FORBIDDEN)
        qs = CouponCode.objects.filter(assigned_consumer=request.user).order_by("-created_at")
        page = self.paginate_queryset(qs)
        ser = self.get_serializer(page if page is not None else qs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)

    @action(detail=False, methods=["get"], url_path="consumer-summary", permission_classes=[IsAuthenticated])
    def consumer_summary(self, request):
        """
        Consumer summary tailored for My E‑Coupons:
          - available: codes assigned to me and not yet activated (status SOLD minus my activation count)
          - redeemed: codes assigned to me with status REDEEMED
          - activated: number of activation audits by me
          - transferred: number of transfers initiated by me
        """
        if not is_consumer_user(request.user):
            return Response({"detail": "Only consumers can access."}, status=status.HTTP_403_FORBIDDEN)

        # Base counts by assignment to this consumer
        assigned_qs = CouponCode.objects.filter(assigned_consumer=request.user)
        try:
            available_assigned = assigned_qs.filter(status="SOLD").count()
        except Exception:
            available_assigned = 0
        try:
            redeemed_assigned = assigned_qs.filter(status="REDEEMED").count()
        except Exception:
            redeemed_assigned = 0

        # Audits for actions taken by this consumer
        try:
            activated_count = AuditTrail.objects.filter(action="coupon_activated", actor=request.user).count()
        except Exception:
            activated_count = 0
        try:
            transferred_count = AuditTrail.objects.filter(action="consumer_transfer", actor=request.user).count()
        except Exception:
            transferred_count = 0

        # Available excludes those already activated
        available_final = available_assigned - activated_count
        if available_final < 0:
            available_final = 0

        summary = {
            "available": available_final,
            "redeemed": redeemed_assigned,
            "activated": activated_count,
            "transferred": transferred_count,
        }
        return Response(summary, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="my-ranges", permission_classes=[IsAuthenticated])
    def my_ranges(self, request):
        """
        Returns compacted contiguous serial ranges of codes owned by the current user.
        - Agency: codes where assigned_agency = me
        - Employee: codes where assigned_employee = me
        Response:
        {
          "role": "agency" | "employee",
          "total": <int>,
          "groups": [
            {
              "batch_id": <id or null>,
              "prefix": "LDGR",
              "ranges": [
                {"start_serial": 1, "end_serial": 100, "start_code": "LDGR000001", "end_code": "LDGR000100", "count": 100},
                ...
              ]
            },
            ...
          ]
        }
        """
        user = request.user
        if is_employee_user(user):
            qs = CouponCode.objects.filter(assigned_employee=user).order_by("batch_id", "serial")
            role = "employee"
        elif is_agency_user(user):
            qs = CouponCode.objects.filter(assigned_agency=user).order_by("batch_id", "serial")
            role = "agency"
        else:
            return Response({"detail": "Only agency or employees can view ranges."}, status=status.HTTP_403_FORBIDDEN)

        groups = {}
        total = 0
        # Minimize columns for performance; rely on code/serial/batch
        for code in qs.only("code", "serial", "batch_id").select_related("batch"):
            # Prefer batch.prefix; fallback to stripping trailing digits from code
            prefix = getattr(code.batch, "prefix", None) if code.batch_id else None
            if not prefix:
                # crude fallback: strip trailing digits
                prefix = str(code.code).rstrip("0123456789") or ""
            key = (code.batch_id or 0, prefix)
            if key not in groups:
                groups[key] = {"batch_id": code.batch_id, "prefix": prefix, "ranges": []}
            grp = groups[key]

            serial = int(code.serial or 0)
            if not grp["ranges"]:
                grp["ranges"].append({
                    "start_serial": serial,
                    "end_serial": serial,
                    "start_code": code.code,
                    "end_code": code.code,
                    "count": 1,
                })
            else:
                last = grp["ranges"][-1]
                if serial == int(last["end_serial"]) + 1:
                    last["end_serial"] = serial
                    last["end_code"] = code.code
                    last["count"] = int(last["count"]) + 1
                else:
                    grp["ranges"].append({
                        "start_serial": serial,
                        "end_serial": serial,
                        "start_code": code.code,
                        "end_code": code.code,
                        "count": 1,
                    })
            total += 1

        out = {
            "role": role,
            "total": total,
            "groups": [
                {"batch_id": v["batch_id"], "prefix": v["prefix"], "ranges": v["ranges"]}
                for (_, _), v in groups.items()
            ],
        }
        return Response(out)

    @action(detail=True, methods=["post"], url_path="assign-consumer", permission_classes=[IsAuthenticated])
    def assign_consumer(self, request, pk=None):
        """
        Employee or Agency assigns an e-coupon code to a Consumer.
        This directly assigns ownership to the consumer and marks the code SOLD.
        No submissions or approvals are created for e-coupons.
        Body: { "consumer_username": "U123456", "notes": "optional" }
        """
        # Employees and Agencies can assign to consumers
        if not (is_employee_user(request.user) or is_agency_user(request.user)):
            return Response({"detail": "Only employees or agencies can assign to consumers."}, status=status.HTTP_403_FORBIDDEN)
        try:
            code = self.get_object()
        except Exception:
            return Response({"detail": "Code not found."}, status=status.HTTP_404_NOT_FOUND)

        actor_is_employee = is_employee_user(request.user)
        actor_is_agency = is_agency_user(request.user)

        # Ownership and status checks
        if actor_is_employee:
            if code.assigned_employee_id != request.user.id:
                return Response({"detail": "This code is not assigned to you."}, status=status.HTTP_403_FORBIDDEN)
            if code.status not in ("ASSIGNED_EMPLOYEE", "AVAILABLE"):
                return Response({"detail": f"Code not assignable in current status: {code.status}."}, status=status.HTTP_400_BAD_REQUEST)
        elif actor_is_agency:
            if code.assigned_agency_id != request.user.id:
                return Response({"detail": "This code is not assigned to your agency."}, status=status.HTTP_403_FORBIDDEN)
            if code.assigned_employee_id:
                return Response({"detail": "This code has already been assigned to an employee and cannot be sold directly by the agency."}, status=status.HTTP_400_BAD_REQUEST)
            if code.status not in ("ASSIGNED_AGENCY", "AVAILABLE"):
                return Response({"detail": f"Code not assignable in current status: {code.status}."}, status=status.HTTP_400_BAD_REQUEST)

        consumer_username = (request.data.get("consumer_username") or "").strip()
        notes = (request.data.get("notes") or "").strip()

        if not consumer_username:
            return Response({"consumer_username": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)

        consumer = CustomUser.objects.filter(username__iexact=consumer_username).first()
        if not consumer or not is_consumer_user(consumer):
            return Response({"consumer_username": ["Consumer not found or invalid."]}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Directly assign to consumer and mark SOLD
            code.assigned_consumer = consumer
            code.mark_sold()
            code.save(update_fields=["assigned_consumer", "status"])

            AuditTrail.objects.create(
                action="assigned_to_consumer",
                actor=request.user,
                coupon_code=code,
                notes=notes,
                metadata={"consumer_username": consumer.username},
            )

        data = CouponCodeSerializer(code).data
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="revoke", permission_classes=[IsAuthenticated])
    def revoke(self, request, pk=None):
        """
        Admin override to revoke a coupon code (e.g., dispute).
        Body: { "reason": "..." }
        Side-effects:
          - Set CouponCode.status=REVOKED
          - Reverse any commissions linked to a submission using this code
          - Audit log
        """
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin users can revoke codes."}, status=status.HTTP_403_FORBIDDEN)
        try:
            code = self.get_object()
        except Exception:
            return Response({"detail": "Code not found."}, status=status.HTTP_404_NOT_FOUND)

        reason = (request.data.get("reason") or "").strip()
        with transaction.atomic():
            code.status = "REVOKED"
            code.save(update_fields=["status"])

            # Reverse commissions for this code
            Commission.objects.filter(coupon_code=code, status__in=["earned", "paid"]).update(status="reversed", paid_at=None)

            AuditTrail.objects.create(
                action="code_revoked",
                actor=request.user,
                coupon_code=code,
                notes=reason,
                metadata={"code": code.code},
            )
        return Response({"detail": "Code revoked."}, status=status.HTTP_200_OK)


    @action(detail=False, methods=["get"], url_path="resolve-user", permission_classes=[IsAuthenticated])
    def resolve_user(self, request):
        username = str(request.query_params.get("username") or "").strip()
        if not username:
            return Response({"username": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        u = CustomUser.objects.filter(username__iexact=username).first()
        if not u:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        out = {
            "id": u.id,
            "username": u.username,
            "full_name": getattr(u, "full_name", "") or "",
            "pincode": getattr(u, "pincode", "") or "",
            "city": getattr(getattr(u, "city", None), "name", None),
            "state": getattr(getattr(u, "state", None), "name", None),
            "role": getattr(u, "role", None),
            "category": getattr(u, "category", None),
        }
        return Response(out, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="transfer", permission_classes=[IsAuthenticated])
    def transfer(self, request, pk=None):
        # Consumers can transfer their owned (SOLD) e-coupon to another consumer (no approvals)
        if not is_consumer_user(request.user):
            return Response({"detail": "Only consumers can transfer codes."}, status=status.HTTP_403_FORBIDDEN)
        try:
            code = self.get_object()
        except Exception:
            return Response({"detail": "Code not found."}, status=status.HTTP_404_NOT_FOUND)

        # Must be owner and not redeemed
        if code.assigned_consumer_id != request.user.id:
            return Response({"detail": "You do not own this code."}, status=status.HTTP_403_FORBIDDEN)
        if code.status == "REDEEMED":
            return Response({"detail": "Redeemed codes cannot be transferred."}, status=status.HTTP_400_BAD_REQUEST)

        to_username = str(request.data.get("to_username") or "").strip()
        if not to_username:
            return Response({"to_username": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        new_consumer = CustomUser.objects.filter(username__iexact=to_username).first()
        if not new_consumer or not is_consumer_user(new_consumer):
            return Response({"to_username": ["Target consumer not found or invalid."]}, status=status.HTTP_400_BAD_REQUEST)

        pincode = (request.data.get("pincode") or "").strip()
        notes = (request.data.get("notes") or "").strip()

        with transaction.atomic():
            prev_user = request.user
            code.assigned_consumer = new_consumer
            # Remain SOLD while transferring ownership
            code.save(update_fields=["assigned_consumer"])

            AuditTrail.objects.create(
                action="consumer_transfer",
                actor=prev_user,
                coupon_code=code,
                notes=notes,
                metadata={"from": prev_user.username, "to": new_consumer.username, "pincode": pincode},
            )

        return Response(CouponCodeSerializer(code).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="assign-consumer-count", permission_classes=[IsAuthenticated])
    def assign_consumer_count(self, request):
        """
        Bulk assign e-coupon codes by count to a consumer.
        - Employee: from their own ASSIGNED_EMPLOYEE pool.
        - Agency: from their own ASSIGNED_AGENCY pool (not delegated), optional employee attribution.
        Body:
          {
            "consumer_username": "C123",
            "count": 10,
            "batch": 1,                # optional
            "employee_id": 55,         # optional; allowed only for agency calls (attribution)
            "notes": "optional"
          }
        Returns counts to display remaining inventory without extra calls.
        """
        user = request.user
        if not (is_employee_user(user) or is_agency_user(user)):
            return Response({"detail": "Only employees or agencies can assign by count."}, status=status.HTTP_403_FORBIDDEN)

        consumer_username = (request.data.get("consumer_username") or "").strip()
        try:
            count = int(request.data.get("count"))
        except Exception:
            count = 0
        batch_id = request.data.get("batch")
        notes = (request.data.get("notes") or "").strip()

        if not consumer_username or count <= 0:
            return Response({"detail": "consumer_username and positive count are required."}, status=status.HTTP_400_BAD_REQUEST)

        consumer = CustomUser.objects.filter(username__iexact=consumer_username).first()
        if not consumer or not is_consumer_user(consumer):
            return Response({"consumer_username": ["Consumer not found or invalid."]}, status=status.HTTP_400_BAD_REQUEST)

        employee_to_attribute = None
        if is_agency_user(user):
            emp_id = request.data.get("employee_id")
            if emp_id is not None:
                try:
                    emp_obj = CustomUser.objects.get(id=int(emp_id))
                except Exception:
                    return Response({"employee_id": ["Invalid employee id."]}, status=status.HTTP_400_BAD_REQUEST)
                if not is_employee_user(emp_obj):
                    return Response({"employee_id": ["Provided user is not an employee."]}, status=status.HTTP_400_BAD_REQUEST)
                employee_to_attribute = emp_obj
        else:
            # Employee caller must not attribute to another employee
            if request.data.get("employee_id") is not None:
                return Response({"employee_id": "Not allowed for employee."}, status=status.HTTP_400_BAD_REQUEST)

        # Build eligibility filter (prevents duplicates/repeats)
        base_qs = CouponCode.objects.all()
        if is_employee_user(user):
            base_qs = base_qs.filter(
                assigned_employee=user,
                status="ASSIGNED_EMPLOYEE",
                assigned_consumer__isnull=True,
            )
        else:
            base_qs = base_qs.filter(
                assigned_agency=user,
                assigned_employee__isnull=True,
                status="ASSIGNED_AGENCY",
                assigned_consumer__isnull=True,
            )
        if batch_id:
            base_qs = base_qs.filter(batch_id=batch_id)

        available_before = base_qs.count()
        if available_before <= 0:
            return Response(
                {
                    "available_before": 0,
                    "assigned": 0,
                    "available_after": 0,
                    "detail": "No eligible codes in your pool.",
                },
                status=status.HTTP_200_OK,
            )

        from django.db import transaction
        with transaction.atomic():
            # Try to lock rows to avoid double-pick in concurrent calls (Postgres)
            try:
                locking_qs = base_qs.select_for_update(skip_locked=True)
            except Exception:
                locking_qs = base_qs

            pick_ids = list(
                locking_qs.order_by("serial", "id").values_list("id", flat=True)[:count]
            )
            if not pick_ids:
                # Could happen under contention
                available_after = base_qs.count()
                return Response(
                    {
                        "available_before": available_before,
                        "assigned": 0,
                        "available_after": available_after,
                        "detail": "No eligible codes available now.",
                    },
                    status=status.HTTP_200_OK,
                )

            update_kwargs = {"assigned_consumer_id": consumer.id, "status": "SOLD"}
            if employee_to_attribute:
                update_kwargs["assigned_employee_id"] = employee_to_attribute.id

            # Guarded update (ensures still-eligible at write time to prevent duplicates)
            write_qs = CouponCode.objects.filter(id__in=pick_ids)
            if is_employee_user(user):
                write_qs = write_qs.filter(
                    assigned_employee=user,
                    status="ASSIGNED_EMPLOYEE",
                    assigned_consumer__isnull=True,
                )
            else:
                write_qs = write_qs.filter(
                    assigned_agency=user,
                    assigned_employee__isnull=True,
                    status="ASSIGNED_AGENCY",
                    assigned_consumer__isnull=True,
                )

            affected = write_qs.update(**update_kwargs)

            # Audit trail
            AuditTrail.objects.create(
                action="employee_assigned_consumer_by_count" if is_employee_user(user) else "agency_assigned_consumer_by_count",
                actor=user,
                batch_id=(int(batch_id) if batch_id else None),
                notes=notes,
                metadata={
                    "consumer_id": consumer.id,
                    "consumer_username": consumer.username,
                    "count": int(affected or 0),
                    "employee_id": getattr(employee_to_attribute, "id", None),
                },
            )

        # Compute remaining and sample of actually assigned codes
        available_after = base_qs.count()
        sample_codes = list(
            CouponCode.objects.filter(id__in=pick_ids, assigned_consumer=consumer)
            .values_list("code", flat=True)[:5]
        )

        return Response(
            {
                "available_before": available_before,
                "assigned": int(affected or 0),
                "available_after": available_after,
                "sample_codes": sample_codes,
                "consumer": {"id": consumer.id, "username": consumer.username},
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="assign-employee-count", permission_classes=[IsAuthenticated])
    def assign_employee_count(self, request):
        """
        Agency bulk assign e-coupon codes by count to an employee from agency's pool.
        Body:
          {
            "employee_username": "E123",  // or provide "employee_id"
            "employee_id": 55,            // optional if username provided
            "count": 10,
            "batch": 1,                   // optional
            "notes": "optional"
          }
        Returns counts to display remaining inventory without extra calls.
        """
        user = request.user
        if not is_agency_user(user):
            return Response({"detail": "Only agency users can assign to employees by count."}, status=status.HTTP_403_FORBIDDEN)

        employee_username = (request.data.get("employee_username") or "").strip()
        emp_id_raw = request.data.get("employee_id")
        try:
            cnt = int(request.data.get("count"))
        except Exception:
            cnt = 0
        batch_id = request.data.get("batch")
        notes = (request.data.get("notes") or "").strip()

        if cnt <= 0:
            return Response({"detail": "Positive count is required."}, status=status.HTTP_400_BAD_REQUEST)

        employee = None
        if employee_username:
            employee = CustomUser.objects.filter(username__iexact=employee_username).first()
            if not employee:
                return Response({"employee_username": ["Employee not found."]}, status=status.HTTP_400_BAD_REQUEST)
        elif emp_id_raw is not None:
            try:
                employee = CustomUser.objects.get(id=int(emp_id_raw))
            except Exception:
                return Response({"employee_id": ["Invalid employee id."]}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"detail": "Provide employee_username or employee_id."}, status=status.HTTP_400_BAD_REQUEST)

        if not is_employee_user(employee):
            return Response({"employee": ["Provided user is not an employee."]}, status=status.HTTP_400_BAD_REQUEST)

        base_qs = CouponCode.objects.filter(
            assigned_agency=user,
            assigned_employee__isnull=True,
            assigned_consumer__isnull=True,
            status="ASSIGNED_AGENCY",
        )
        if batch_id:
            base_qs = base_qs.filter(batch_id=batch_id)

        available_before = base_qs.count()
        if available_before <= 0:
            return Response(
                {
                    "available_before": 0,
                    "assigned": 0,
                    "available_after": 0,
                    "detail": "No eligible codes in your pool.",
                },
                status=status.HTTP_200_OK,
            )

        with transaction.atomic():
            try:
                locking_qs = base_qs.select_for_update(skip_locked=True)
            except Exception:
                locking_qs = base_qs

            pick_ids = list(locking_qs.order_by("serial", "id").values_list("id", flat=True)[:cnt])
            if not pick_ids:
                available_after = base_qs.count()
                return Response(
                    {
                        "available_before": available_before,
                        "assigned": 0,
                        "available_after": available_after,
                        "detail": "No eligible codes available now.",
                    },
                    status=status.HTTP_200_OK,
                )

            write_qs = CouponCode.objects.filter(id__in=pick_ids).filter(
                assigned_agency=user,
                assigned_employee__isnull=True,
                assigned_consumer__isnull=True,
                status="ASSIGNED_AGENCY",
            )
            affected = write_qs.update(assigned_employee_id=employee.id, status="ASSIGNED_EMPLOYEE")

            AuditTrail.objects.create(
                action="agency_assigned_to_employee_by_count",
                actor=user,
                batch_id=(int(batch_id) if batch_id else None),
                notes=notes,
                metadata={
                    "employee_id": employee.id,
                    "count": int(affected or 0),
                },
            )

        available_after = base_qs.count()
        sample_codes = list(
            CouponCode.objects.filter(id__in=pick_ids, assigned_employee=employee)
            .values_list("code", flat=True)[:5]
        )

        return Response(
            {
                "available_before": available_before,
                "assigned": int(affected or 0),
                "available_after": available_after,
                "sample_codes": sample_codes,
                "employee": {"id": employee.id, "username": employee.username},
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="agency-summary", permission_classes=[IsAuthenticated])
    def agency_summary(self, request):
        if not is_agency_user(request.user):
            return Response({"detail": "Only agency users can access."}, status=status.HTTP_403_FORBIDDEN)

        agg = (CouponCode.objects
               .filter(assigned_agency=request.user)
               .values("status")
               .annotate(c=Count("id")))

        metrics = {"available": 0, "assigned_employee": 0, "sold": 0, "redeemed": 0, "revoked": 0}
        total = 0
        for row in agg:
            st = (row.get("status") or "").upper()
            if st == "ASSIGNED_AGENCY":
                metrics["available"] = row["c"]
            elif st == "ASSIGNED_EMPLOYEE":
                metrics["assigned_employee"] = row["c"]
            elif st == "SOLD":
                metrics["sold"] = row["c"]
            elif st == "REDEEMED":
                metrics["redeemed"] = row["c"]
            elif st == "REVOKED":
                metrics["revoked"] = row["c"]
            total += int(row["c"] or 0)
        metrics["total"] = total
        return Response(metrics, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="admin-agency-assignment-summary", permission_classes=[IsAuthenticated])
    def admin_agency_assignment_summary(self, request):
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can view this summary."}, status=status.HTTP_403_FORBIDDEN)

        batch_id = request.query_params.get("batch")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        qs = CouponCode.objects.filter(assigned_agency__isnull=False)
        if batch_id:
            qs = qs.filter(batch_id=batch_id)
        if date_from:
            try:
                qs = qs.filter(created_at__gte=date_from)
            except Exception:
                pass
        if date_to:
            try:
                qs = qs.filter(created_at__lte=date_to)
            except Exception:
                pass

        by_agency = {}
        for c in qs.only("id", "assigned_agency_id", "status").select_related("assigned_agency__city", "assigned_agency__state"):
            aid = c.assigned_agency_id
            if aid not in by_agency:
                u = c.assigned_agency
                by_agency[aid] = {
                    "agency_id": aid,
                    "username": getattr(u, "username", None),
                    "full_name": getattr(u, "full_name", "") or "",
                    "pincode": getattr(u, "pincode", "") or "",
                    "city": getattr(getattr(u, "city", None), "name", None),
                    "state": getattr(getattr(u, "state", None), "name", None),
                    "counts": {"AVAILABLE": 0, "ASSIGNED_AGENCY": 0, "ASSIGNED_EMPLOYEE": 0, "SOLD": 0, "REDEEMED": 0, "REVOKED": 0},
                    "total": 0,
                }
            entry = by_agency[aid]
            st = c.status or "AVAILABLE"
            if st not in entry["counts"]:
                entry["counts"][st] = 0
            entry["counts"][st] += 1
            entry["total"] += 1

        return Response({"results": list(by_agency.values())}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="admin-ecoupons-bootstrap", permission_classes=[IsAuthenticated])
    def admin_ecoupons_bootstrap(self, request):
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can access."}, status=status.HTTP_403_FORBIDDEN)

        # Reference lists (lean payloads)
        coupons = list(Coupon.objects.only("id", "title", "campaign").order_by("-created_at").values("id", "title", "campaign"))
        batches_qs = CouponBatch.objects.only("id", "prefix", "serial_start", "serial_end", "created_at").order_by("-created_at")
        batches = []
        for b in batches_qs:
            total = None
            try:
                if b.serial_start is not None and b.serial_end is not None:
                    total = int(b.serial_end) - int(b.serial_start) + 1
            except Exception:
                total = None
            batches.append({
                "id": b.id,
                "prefix": b.prefix,
                "serial_start": b.serial_start,
                "serial_end": b.serial_end,
                "created_at": b.created_at,
                "total": total,
            })

        agencies = list(
            CustomUser.objects.filter(Q(role="agency") | Q(category__startswith="agency"))
            .only("id", "username").order_by("id").values("id", "username")
        )
        employees = list(
            CustomUser.objects.filter(Q(role="employee") | Q(category="employee"))
            .only("id", "username").order_by("id").values("id", "username")
        )

        default_batch_id = batches[0]["id"] if batches else None

        # Metrics for default batch
        metrics = {"available": 0, "assigned_agency": 0, "assigned_employee": 0, "sold": 0, "redeemed": 0, "revoked": 0}
        if default_batch_id:
            agg = CouponCode.objects.filter(batch_id=default_batch_id).values("status").annotate(c=Count("id"))
            for row in agg:
                st = (row["status"] or "").upper()
                if st == "AVAILABLE": metrics["available"] = row["c"]
                elif st == "ASSIGNED_AGENCY": metrics["assigned_agency"] = row["c"]
                elif st == "ASSIGNED_EMPLOYEE": metrics["assigned_employee"] = row["c"]
                elif st == "SOLD": metrics["sold"] = row["c"]
                elif st == "REDEEMED": metrics["redeemed"] = row["c"]
                elif st == "REVOKED": metrics["revoked"] = row["c"]

        # Assignment history (flattened)
        def flatten_assignments(qs):
            out = []
            for r in qs:
                action = r.action or ""
                meta = r.metadata or {}
                by = getattr(r.actor, "username", None)
                at = r.created_at
                batch_id = r.batch_id

                if action == "bulk_assigned_to_employees" and isinstance(meta.get("assignments"), list):
                    for it in meta["assignments"]:
                        out.append({
                            "id": f"{action}-{batch_id}-{it.get('employee_id')}-{at.isoformat() if at else ''}",
                            "role": "employee",
                            "assignee_id": it.get("employee_id"),
                            "assignee_name": f"Employee #{it.get('employee_id')}",
                            "serial_start": None,
                            "serial_end": None,
                            "count": it.get("count"),
                            "batch_display": f"#{batch_id}" if batch_id else "",
                            "assigned_by": by,
                            "assigned_at": at,
                            "info": "Random codes",
                        })
                    continue

                role = "employee" if "employee" in action else "agency"
                assignee_id = meta.get("employee_id") if role == "employee" else meta.get("agency_id")
                count = meta.get("count") or meta.get("total_assigned")
                s_range = meta.get("serial_range")
                if isinstance(s_range, list) and len(s_range) == 2 and all(isinstance(x, int) for x in s_range):
                    start, end = s_range
                    info = f"{start} - {end}"
                    if count is None:
                        count = (end - start + 1)
                    serial_start, serial_end = start, end
                else:
                    info = "Random codes"
                    serial_start = serial_end = None

                out.append({
                    "id": f"{action}-{batch_id}-{assignee_id or ''}-{at.isoformat() if at else ''}",
                    "role": role,
                    "assignee_id": assignee_id,
                    "assignee_name": (f"{'Employee' if role=='employee' else 'Agency'} #{assignee_id}") if assignee_id else None,
                    "serial_start": serial_start,
                    "serial_end": serial_end,
                    "count": count,
                    "batch_display": f"#{batch_id}" if batch_id else "",
                    "assigned_by": by,
                    "assigned_at": at,
                    "info": info,
                })
            return out

        page = int(request.query_params.get("page") or 1)
        page_size = int(request.query_params.get("page_size") or 25)
        start = (page - 1) * page_size
        end = start + page_size
        actions = [
            "assigned_to_agency", "assigned_to_agency_by_count",
            "assigned_to_employee", "bulk_assigned_to_employees",
            "bulk_assigned_to_agencies", "agency_assigned_to_employee_by_count",
            "admin_assigned_to_employee_by_count",
            "agency_assigned_consumer_by_count", "employee_assigned_consumer_by_count",
        ]
        assign_qs = AuditTrail.objects.filter(action__in=actions)
        if default_batch_id:
            assign_qs = assign_qs.filter(batch_id=default_batch_id)
        assign_qs = assign_qs.select_related("actor", "batch").order_by("-created_at")
        total_assign = assign_qs.count()
        page_items = list(assign_qs[start:end])
        flat = flatten_assignments(page_items)

        out = {
            "coupons": coupons,
            "batches": batches,
            "agencies": agencies,
            "employees": employees,
            "default_batch_id": default_batch_id,
            "metrics": metrics,
            "assignments": {
                "results": flat,
                "count": total_assign,
                "page": page,
                "page_size": page_size,
            },
        }
        return Response(out, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="admin-ecoupons-dashboard", permission_classes=[IsAuthenticated])
    def admin_ecoupons_dashboard(self, request):
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can access."}, status=status.HTTP_403_FORBIDDEN)

        batch_id = request.data.get("batch")
        try:
            batch_id = int(batch_id) if batch_id else None
        except Exception:
            batch_id = None

        assign_payload = request.data.get("assign") or {}
        page = int(assign_payload.get("page") or 1)
        page_size = int(assign_payload.get("page_size") or 25)
        role_filter = (assign_payload.get("role") or "").strip().lower()
        assignee_id = assign_payload.get("assignee_id")
        try:
            assignee_id = int(assignee_id) if assignee_id else None
        except Exception:
            assignee_id = None

        include_summary = bool(request.data.get("include_summary"))
        summary_filters = request.data.get("summary") or {}
        date_from = summary_filters.get("date_from") or None
        date_to = summary_filters.get("date_to") or None

        # Metrics
        metrics = {"available": 0, "assigned_agency": 0, "assigned_employee": 0, "sold": 0, "redeemed": 0, "revoked": 0}
        if batch_id:
            agg = CouponCode.objects.filter(batch_id=batch_id).values("status").annotate(c=Count("id"))
            for row in agg:
                st = (row["status"] or "").upper()
                if st == "AVAILABLE": metrics["available"] = row["c"]
                elif st == "ASSIGNED_AGENCY": metrics["assigned_agency"] = row["c"]
                elif st == "ASSIGNED_EMPLOYEE": metrics["assigned_employee"] = row["c"]
                elif st == "SOLD": metrics["sold"] = row["c"]
                elif st == "REDEEMED": metrics["redeemed"] = row["c"]
                elif st == "REVOKED": metrics["revoked"] = row["c"]

        # Assignments (flattened)
        def flatten_assignments(qs):
            out = []
            for r in qs:
                action = r.action or ""
                meta = r.metadata or {}
                by = getattr(r.actor, "username", None)
                at = r.created_at
                b_id = r.batch_id

                if action == "bulk_assigned_to_employees" and isinstance(meta.get("assignments"), list):
                    for it in meta["assignments"]:
                        out.append({
                            "id": f"{action}-{b_id}-{it.get('employee_id')}-{at.isoformat() if at else ''}",
                            "role": "employee",
                            "assignee_id": it.get("employee_id"),
                            "assignee_name": f"Employee #{it.get('employee_id')}",
                            "serial_start": None,
                            "serial_end": None,
                            "count": it.get("count"),
                            "batch_display": f"#{b_id}" if b_id else "",
                            "assigned_by": by,
                            "assigned_at": at,
                            "info": "Random codes",
                        })
                    continue

                role = "employee" if "employee" in action else "agency"
                assignee = meta.get("employee_id") if role == "employee" else meta.get("agency_id")
                cnt = meta.get("count") or meta.get("total_assigned")
                s_range = meta.get("serial_range")
                if isinstance(s_range, list) and len(s_range) == 2 and all(isinstance(x, int) for x in s_range):
                    start, end = s_range
                    info = f"{start} - {end}"
                    if cnt is None:
                        cnt = (end - start + 1)
                    s_start, s_end = start, end
                else:
                    info = "Random codes"
                    s_start = s_end = None

                out.append({
                    "id": f"{action}-{b_id}-{assignee or ''}-{at.isoformat() if at else ''}",
                    "role": role,
                    "assignee_id": assignee,
                    "assignee_name": (f"{'Employee' if role=='employee' else 'Agency'} #{assignee}") if assignee else None,
                    "serial_start": s_start,
                    "serial_end": s_end,
                    "count": cnt,
                    "batch_display": f"#{b_id}" if b_id else "",
                    "assigned_by": by,
                    "assigned_at": at,
                    "info": info,
                })
            return out

        actions = [
            "assigned_to_agency", "assigned_to_agency_by_count",
            "assigned_to_employee", "bulk_assigned_to_employees",
            "bulk_assigned_to_agencies", "agency_assigned_to_employee_by_count",
            "admin_assigned_to_employee_by_count",
            "agency_assigned_consumer_by_count", "employee_assigned_consumer_by_count",
        ]
        aq = AuditTrail.objects.filter(action__in=actions).select_related("actor", "batch")
        if batch_id:
            aq = aq.filter(batch_id=batch_id)
        if role_filter in ("agency", "employee"):
            if role_filter == "employee":
                aq = aq.filter(Q(action__icontains="employee") | Q(metadata__has_key="employee_id"))
            else:
                aq = aq.exclude(Q(action__icontains="employee") | Q(metadata__has_key="employee_id"))
        if assignee_id:
            # Try both agency and employee keys in metadata
            aq = aq.filter(Q(metadata__employee_id=assignee_id) | Q(metadata__agency_id=assignee_id))

        aq = aq.order_by("-created_at")
        total = aq.count()
        start = (page - 1) * page_size
        items = list(aq[start:start + page_size])
        flat = flatten_assignments(items)

        out = {
            "metrics": metrics,
            "assignments": {
                "results": flat,
                "count": total,
                "page": page,
                "page_size": page_size,
            },
        }

        if include_summary:
            qs = CouponCode.objects.filter(assigned_agency__isnull=False)
            if batch_id:
                qs = qs.filter(batch_id=batch_id)
            if date_from:
                try:
                    qs = qs.filter(created_at__gte=date_from)
                except Exception:
                    pass
            if date_to:
                try:
                    qs = qs.filter(created_at__lte=date_to)
                except Exception:
                    pass

            by_agency = {}
            for c in qs.only("id", "assigned_agency_id", "status").select_related("assigned_agency__city", "assigned_agency__state"):
                aid = c.assigned_agency_id
                if aid not in by_agency:
                    u = c.assigned_agency
                    by_agency[aid] = {
                        "agency_id": aid,
                        "username": getattr(u, "username", None),
                        "full_name": getattr(u, "full_name", "") or "",
                        "pincode": getattr(u, "pincode", "") or "",
                        "city": getattr(getattr(u, "city", None), "name", None),
                        "state": getattr(getattr(u, "state", None), "name", None),
                        "counts": {"AVAILABLE": 0, "ASSIGNED_AGENCY": 0, "ASSIGNED_EMPLOYEE": 0, "SOLD": 0, "REDEEMED": 0, "REVOKED": 0},
                        "total": 0,
                    }
                entry = by_agency[aid]
                st = c.status or "AVAILABLE"
                if st not in entry["counts"]:
                    entry["counts"][st] = 0
                entry["counts"][st] += 1
                entry["total"] += 1

            out["summary"] = {"results": list(by_agency.values())}

        return Response(out, status=status.HTTP_200_OK)

class CouponBatchViewSet(mixins.CreateModelMixin,
                         mixins.ListModelMixin,
                         mixins.RetrieveModelMixin,
                         viewsets.GenericViewSet):
    queryset = CouponBatch.objects.select_related("coupon", "created_by").all()
    serializer_class = CouponBatchSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["post"], url_path="create-ecoupons", permission_classes=[IsAuthenticated])
    def create_ecoupons(self, request):
        """
        Admin creates a random e-coupon batch by count.
        Body:
        {
          "coupon": <coupon_id>,
          "count": 500,
          "value": 150,              # optional; defaults to 150; allowed: 50, 150, 750
          "prefix": "LDGR"           # optional, defaults to 'LDGR'
        }
        Generates codes like: LDGR + 7-char uppercase alphanumeric (e.g., LDGRX7K9A2B).
        """
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can create e-coupon batches."}, status=status.HTTP_403_FORBIDDEN)

        try:
            coupon_id = int(request.data.get("coupon"))
        except Exception:
            return Response({"coupon": ["This field is required (integer)."]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            count = int(request.data.get("count"))
        except Exception:
            return Response({"count": ["This field is required (integer)."]}, status=status.HTTP_400_BAD_REQUEST)
        if count <= 0:
            return Response({"count": ["Must be > 0."]}, status=status.HTTP_400_BAD_REQUEST)

        # Denomination: accept any positive decimal, default 150 if not provided
        value_param = request.data.get("value") or request.data.get("denomination") or request.data.get("amount")
        from decimal import Decimal, InvalidOperation
        try:
            code_value = Decimal(str(value_param)) if value_param is not None else Decimal("150")
        except (InvalidOperation, TypeError, ValueError):
            return Response({"value": ["Invalid denomination. Provide a positive number."], "detail": "Invalid denomination."}, status=status.HTTP_400_BAD_REQUEST)
        if code_value <= 0:
            return Response({"value": ["Denomination must be > 0."], "detail": "Denomination must be positive."}, status=status.HTTP_400_BAD_REQUEST)

        prefix = (str(request.data.get("prefix") or "LDGR")).strip().upper() or "LDGR"

        # Resolve coupon
        try:
            coupon = Coupon.objects.get(id=coupon_id)
        except Coupon.DoesNotExist:
            return Response({"coupon": ["Invalid coupon id."]}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Create a grouping batch record (serials are placeholders; codes will not use serial)
            batch = CouponBatch.objects.create(
                coupon=coupon,
                prefix=prefix,
                serial_start=1,
                serial_end=count,
                serial_width=0,
                created_by=request.user,
            )

            # Generate unique random codes: PREFIX + 7-char A-Z0-9
            import random, string
            alphabet = string.ascii_uppercase + string.digits

            def gen_one():
                return prefix + "".join(random.choices(alphabet, k=7))

            to_create = []
            # Prefetch existing codes with this prefix to reduce collisions
            existing = set(CouponCode.objects.filter(code__startswith=prefix).values_list("code", flat=True))
            seen = set()
            while len(to_create) < count:
                candidate = gen_one()
                if candidate in existing or candidate in seen:
                    continue
                seen.add(candidate)
                to_create.append(CouponCode(
                    code=candidate,
                    coupon=coupon,
                    issued_channel="e_coupon",
                    assigned_employee=None,
                    assigned_agency=None,
                    batch=batch,
                    serial=None,
                    value=code_value,
                    issued_by=request.user,
                    status="AVAILABLE",
                ))

            if to_create:
                CouponCode.objects.bulk_create(to_create, batch_size=1000)

            AuditTrail.objects.create(
                action="batch_created_random_ecoupons",
                actor=request.user,
                batch=batch,
                notes=f"Generated {len(to_create)} random e-codes",
                metadata={"prefix": prefix, "count": len(to_create), "value": code_value},
            )

        return Response(self.get_serializer(batch).data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        # Admin sees all; agency/employee can see for visibility (reporting)
        return super().get_queryset()

    def create(self, request, *args, **kwargs):
        """
        Admin creates a coupon batch (physical or e-coupon) and system generates sequential codes, e.g. LDGR0001..LDGR5000.
        Body:
        {
          "coupon": <coupon_id>,
          "prefix": "LDGR",
          "serial_start": 1,
          "serial_end": 5000,
          "serial_width": 4,
          "issued_channel": "e_coupon"  // optional; defaults to "physical"
        }
        """
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can create batches."}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            batch = serializer.save(created_by=request.user)

            # Generate codes for this batch
            start = int(batch.serial_start)
            end = int(batch.serial_end)
            width = int(batch.serial_width or 4)
            prefix = (batch.prefix or "").strip()
            issued_channel = (str(request.data.get("issued_channel") or "physical")).strip().lower()
            if issued_channel not in ("physical", "e_coupon"):
                issued_channel = "physical"

            # Denomination: accept any positive decimal, default 150 if not provided
            value_param = request.data.get("value") or request.data.get("denomination") or request.data.get("amount")
            from decimal import Decimal, InvalidOperation
            try:
                code_value = Decimal(str(value_param)) if value_param is not None else Decimal("150")
            except (InvalidOperation, TypeError, ValueError):
                return Response({"value": ["Invalid denomination. Provide a positive number."], "detail": "Invalid denomination."}, status=status.HTTP_400_BAD_REQUEST)
            if code_value <= 0:
                return Response({"value": ["Denomination must be > 0."], "detail": "Denomination must be positive."}, status=status.HTTP_400_BAD_REQUEST)

            # Validate no duplicate codes
            to_create = []
            for s in range(start, end + 1):
                code_str = f"{prefix}{str(s).zfill(width)}"
                to_create.append(CouponCode(
                    code=code_str,
                    coupon=batch.coupon,
                    issued_channel=issued_channel,
                    assigned_employee=None,
                    assigned_agency=None,
                    batch=batch,
                    serial=s,
                    value=code_value,
                    issued_by=request.user,
                    status="AVAILABLE",
                ))

            # Avoid unique collisions by filtering out existing
            existing_codes = set(CouponCode.objects.filter(code__in=[c.code for c in to_create]).values_list("code", flat=True))
            final_list = [c for c in to_create if c.code not in existing_codes]
            if final_list:
                CouponCode.objects.bulk_create(final_list, batch_size=1000)

            AuditTrail.objects.create(
                action="batch_created",
                actor=request.user,
                batch=batch,
                notes=f"Generated {len(final_list)} codes",
                metadata={"prefix": prefix, "range": [start, end], "width": width, "issued_channel": issued_channel, "value": code_value},
            )

        return Response(self.get_serializer(batch).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="assign-agency", permission_classes=[IsAuthenticated])
    def assign_agency(self, request, pk=None):
        """
        Admin assigns a serial range of this batch to an Agency.
        Body: { "agency_id": 123, "serial_start": 1, "serial_end": 500 }
        If serial_start/end not provided, assign entire batch currently AVAILABLE.
        """
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can assign to agencies."}, status=status.HTTP_403_FORBIDDEN)
        try:
            batch = self.get_object()
        except Exception:
            return Response({"detail": "Batch not found."}, status=status.HTTP_404_NOT_FOUND)

        agency_id = request.data.get("agency_id")
        if not agency_id:
            return Response({"agency_id": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            agency = CustomUser.objects.get(id=agency_id)
        except CustomUser.DoesNotExist:
            return Response({"agency_id": ["Invalid agency id."]}, status=status.HTTP_400_BAD_REQUEST)
        if not is_agency_user(agency):
            return Response({"agency_id": ["Provided user is not an agency." ]}, status=status.HTTP_400_BAD_REQUEST)

        s_start = request.data.get("serial_start")
        s_end = request.data.get("serial_end")
        qs = CouponCode.objects.filter(batch=batch, status__in=["AVAILABLE", "ASSIGNED_AGENCY"])
        if s_start is not None and s_end is not None:
            try:
                s_start = int(s_start); s_end = int(s_end)
            except Exception:
                return Response({"detail": "serial_start and serial_end must be integers."}, status=status.HTTP_400_BAD_REQUEST)
            if s_start > s_end:
                return Response({"detail": "serial_start cannot be greater than serial_end."}, status=status.HTTP_400_BAD_REQUEST)
            qs = qs.filter(serial__gte=s_start, serial__lte=s_end)
        count = qs.update(assigned_agency=agency, status="ASSIGNED_AGENCY")

        AuditTrail.objects.create(
            action="assigned_to_agency",
            actor=request.user,
            batch=batch,
            notes=f"Assigned {count} to {agency.username}",
            metadata={"agency_id": agency.id, "serial_range": [s_start, s_end] if s_start is not None else None},
        )
        return Response({"assigned": count}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="bulk-assign-agencies", permission_classes=[IsAuthenticated])
    def bulk_assign_agencies(self, request, pk=None):
        """
        Admin utility to assign a fixed number of AVAILABLE codes to each agency.
        Body: { "per_agency": 3000, "agency_ids": [1,2,...] (optional) }
        """
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can bulk-assign to agencies."}, status=status.HTTP_403_FORBIDDEN)
        try:
            batch = self.get_object()
        except Exception:
            return Response({"detail": "Batch not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            per_agency = int(request.data.get("per_agency"))
        except Exception:
            return Response({"per_agency": ["This field is required and must be integer."]}, status=status.HTTP_400_BAD_REQUEST)

        agency_ids = request.data.get("agency_ids")
        qs_agencies = CustomUser.objects.filter(Q(role="agency") | Q(category__startswith="agency"))
        if agency_ids:
            qs_agencies = qs_agencies.filter(id__in=agency_ids)

        agency_list = list(qs_agencies.values_list("id", flat=True))
        if not agency_list:
            return Response({"detail": "No agencies found to assign."}, status=status.HTTP_400_BAD_REQUEST)

        code_ids = list(CouponCode.objects.filter(batch=batch, status="AVAILABLE").order_by("serial", "id").values_list("id", flat=True))

        result = {}
        idx = 0
        with transaction.atomic():
            for aid in agency_list:
                chunk = code_ids[idx: idx + per_agency]
                if not chunk:
                    break
                updated = CouponCode.objects.filter(id__in=chunk).update(assigned_agency_id=aid, status="ASSIGNED_AGENCY")
                result[str(aid)] = updated
                idx += per_agency

            AuditTrail.objects.create(
                action="bulk_assigned_to_agencies",
                actor=request.user,
                batch=batch,
                notes=f"Per agency {per_agency}",
                metadata={"agency_ids": agency_list, "total_assigned": sum(result.values()) if result else 0},
            )

        return Response({"assigned_per_agency": result, "remaining_available": max(0, len(code_ids) - idx)}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="assign-employee", permission_classes=[IsAuthenticated])
    def assign_employee(self, request, pk=None):
        """
        Agency assigns a serial range of this batch to an Employee.
        Body: { "employee_id": 123, "serial_start": 10, "serial_end": 50 }
        """
        if not is_agency_user(request.user):
            return Response({"detail": "Only agency can assign to employees."}, status=status.HTTP_403_FORBIDDEN)
        try:
            batch = self.get_object()
        except Exception:
            return Response({"detail": "Batch not found."}, status=status.HTTP_404_NOT_FOUND)

        emp_id = request.data.get("employee_id")
        if not emp_id:
            return Response({"employee_id": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            employee = CustomUser.objects.get(id=emp_id)
        except CustomUser.DoesNotExist:
            return Response({"employee_id": ["Invalid employee id."]}, status=status.HTTP_400_BAD_REQUEST)
        if not is_employee_user(employee):
            return Response({"employee_id": ["Provided user is not an employee."]}, status=status.HTTP_400_BAD_REQUEST)

        try:
            s_start = int(request.data.get("serial_start"))
            s_end = int(request.data.get("serial_end"))
        except Exception:
            return Response({"detail": "serial_start and serial_end are required integers."}, status=status.HTTP_400_BAD_REQUEST)
        if s_start > s_end:
            return Response({"detail": "serial_start cannot be greater than serial_end."}, status=status.HTTP_400_BAD_REQUEST)

        # Only codes assigned to this agency can be delegated
        qs = CouponCode.objects.filter(
            batch=batch,
            assigned_agency=request.user,
            serial__gte=s_start,
            serial__lte=s_end,
            status__in=["ASSIGNED_AGENCY", "AVAILABLE"],
        )
        updated = qs.update(assigned_employee=employee, status="ASSIGNED_EMPLOYEE")
        AuditTrail.objects.create(
            action="assigned_to_employee",
            actor=request.user,
            batch=batch,
            notes=f"Assigned {updated} to {employee.username}",
            metadata={"employee_id": employee.id, "serial_range": [s_start, s_end]},
        )
        return Response({"assigned": updated}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="assign-employee-counts", permission_classes=[IsAuthenticated])
    def assign_employee_counts(self, request, pk=None):
        """
        Agency utility to assign counts of codes to multiple employees from this batch.
        Body: { "assignments": [ { "employee_id": 10, "count": 500 }, ... ] }
        """
        if not is_agency_user(request.user):
            return Response({"detail": "Only agency can assign to employees."}, status=status.HTTP_403_FORBIDDEN)
        try:
            batch = self.get_object()
        except Exception:
            return Response({"detail": "Batch not found."}, status=status.HTTP_404_NOT_FOUND)

        assignments = request.data.get("assignments")
        if not isinstance(assignments, list) or not assignments:
            return Response({"assignments": ["Provide a non-empty list of assignments."]}, status=status.HTTP_400_BAD_REQUEST)

        # Validate employees
        emp_items = []
        for item in assignments:
            try:
                emp_id = int(item.get("employee_id"))
                cnt = int(item.get("count"))
            except Exception:
                return Response({"assignments": ["Each item needs integer employee_id and count."]}, status=status.HTTP_400_BAD_REQUEST)
            try:
                emp = CustomUser.objects.get(id=emp_id)
            except CustomUser.DoesNotExist:
                return Response({"assignments": [f"Invalid employee_id {emp_id}"]}, status=status.HTTP_400_BAD_REQUEST)
            if not is_employee_user(emp):
                return Response({"assignments": [f"User {emp_id} is not an employee."]}, status=status.HTTP_400_BAD_REQUEST)
            emp_items.append((emp_id, cnt))

        # Pool of codes assigned to this agency and not yet given to employees
        pool_ids = list(CouponCode.objects.filter(
            batch=batch,
            assigned_agency=request.user,
            status="ASSIGNED_AGENCY",
        ).order_by("serial", "id").values_list("id", flat=True))

        result = {}
        idx = 0
        with transaction.atomic():
            for emp_id, cnt in emp_items:
                chunk = pool_ids[idx: idx + cnt]
                if not chunk:
                    break
                updated = CouponCode.objects.filter(id__in=chunk).update(assigned_employee_id=emp_id, status="ASSIGNED_EMPLOYEE")
                result[str(emp_id)] = updated
                idx += cnt

            AuditTrail.objects.create(
                action="bulk_assigned_to_employees",
                actor=request.user,
                batch=batch,
                notes="Bulk employee assignment",
                metadata={"assignments": assignments, "total_assigned": sum(result.values()) if result else 0},
            )

        return Response({"assigned_per_employee": result, "remaining_unassigned_for_agency": max(0, len(pool_ids) - idx)}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="assign-agency-count", permission_classes=[IsAuthenticated])
    def assign_agency_count(self, request, pk=None):
        """
        Admin assigns the next N AVAILABLE codes from this batch to a specific agency.
        Body: { "agency_id": <id>, "count": <int> }
        """
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can assign by count."}, status=status.HTTP_403_FORBIDDEN)
        try:
            batch = self.get_object()
        except Exception:
            return Response({"detail": "Batch not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            agency_id = int(request.data.get("agency_id"))
            count = int(request.data.get("count"))
        except Exception:
            return Response({"detail": "agency_id and count are required integers."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            agency = CustomUser.objects.get(id=agency_id)
        except CustomUser.DoesNotExist:
            return Response({"agency_id": ["Invalid agency id."]}, status=status.HTTP_400_BAD_REQUEST)
        if not is_agency_user(agency):
            return Response({"agency_id": ["Provided user is not an agency."]}, status=status.HTTP_400_BAD_REQUEST)

        code_ids = list(
            CouponCode.objects
            .filter(batch=batch, status="AVAILABLE")
            .order_by("serial", "id")
            .values_list("id", flat=True)[:count]
        )
        if not code_ids:
            return Response({"assigned": 0, "detail": "No available codes."}, status=status.HTTP_200_OK)

        with transaction.atomic():
            updated = CouponCode.objects.filter(id__in=code_ids).update(
                assigned_agency=agency, status="ASSIGNED_AGENCY"
            )
            AuditTrail.objects.create(
                action="assigned_to_agency_by_count",
                actor=request.user,
                batch=batch,
                notes=f"Assigned {updated} by count to {agency.username}",
                metadata={"agency_id": agency.id, "count": updated},
            )
        return Response({"assigned": updated}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="admin-assign-employee-count", permission_classes=[IsAuthenticated])
    def admin_assign_employee_count(self, request, pk=None):
        """
        Admin assigns the next N AVAILABLE codes (not yet owned by any agency/employee) from this batch directly to an employee.
        Body: { "employee_id": <id>, "count": <int> }
        """
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can assign by count."}, status=status.HTTP_403_FORBIDDEN)
        try:
            batch = self.get_object()
        except Exception:
            return Response({"detail": "Batch not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            employee_id = int(request.data.get("employee_id"))
            count = int(request.data.get("count"))
        except Exception:
            return Response({"detail": "employee_id and count are required integers."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            employee = CustomUser.objects.get(id=employee_id)
        except CustomUser.DoesNotExist:
            return Response({"employee_id": ["Invalid employee id."]}, status=status.HTTP_400_BAD_REQUEST)
        if not is_employee_user(employee):
            return Response({"employee_id": ["Provided user is not an employee."]}, status=status.HTTP_400_BAD_REQUEST)

        code_ids = list(
            CouponCode.objects
            .filter(batch=batch, status="AVAILABLE", assigned_agency__isnull=True, assigned_employee__isnull=True)
            .order_by("serial", "id")
            .values_list("id", flat=True)[:count]
        )
        if not code_ids:
            return Response({"assigned": 0, "detail": "No available codes."}, status=status.HTTP_200_OK)

        with transaction.atomic():
            updated = CouponCode.objects.filter(id__in=code_ids).update(
                assigned_employee=employee, status="ASSIGNED_EMPLOYEE"
            )
            AuditTrail.objects.create(
                action="admin_assigned_to_employee_by_count",
                actor=request.user,
                batch=batch,
                notes=f"Assigned {updated} by count to {employee.username}",
                metadata={"employee_id": employee.id, "count": updated},
            )
        return Response({"assigned": updated}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="agency-assign-employee-count", permission_classes=[IsAuthenticated])
    def agency_assign_employee_count(self, request, pk=None):
        """
        Agency assigns the next N codes from its own pool in this batch to an employee.
        Body: { "employee_id": <id>, "count": <int> }
        """
        if not is_agency_user(request.user):
            return Response({"detail": "Only agency can assign to employees."}, status=status.HTTP_403_FORBIDDEN)
        try:
            batch = self.get_object()
        except Exception:
            return Response({"detail": "Batch not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            employee_id = int(request.data.get("employee_id"))
            count = int(request.data.get("count"))
        except Exception:
            return Response({"detail": "employee_id and count are required integers."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            employee = CustomUser.objects.get(id=employee_id)
        except CustomUser.DoesNotExist:
            return Response({"employee_id": ["Invalid employee id."]}, status=status.HTTP_400_BAD_REQUEST)
        if not is_employee_user(employee):
            return Response({"employee_id": ["Provided user is not an employee."]}, status=status.HTTP_400_BAD_REQUEST)

        pool_ids = list(
            CouponCode.objects
            .filter(batch=batch, assigned_agency=request.user, assigned_employee__isnull=True, status="ASSIGNED_AGENCY")
            .order_by("serial", "id")
            .values_list("id", flat=True)[:count]
        )
        if not pool_ids:
            return Response({"assigned": 0, "detail": "No agency-owned codes available."}, status=status.HTTP_200_OK)

        with transaction.atomic():
            updated = CouponCode.objects.filter(id__in=pool_ids).update(
                assigned_employee=employee, status="ASSIGNED_EMPLOYEE"
            )
            AuditTrail.objects.create(
                action="agency_assigned_to_employee_by_count",
                actor=request.user,
                batch=batch,
                notes=f"Assigned {updated} to {employee.username}",
                metadata={"employee_id": employee.id, "count": updated},
            )
        return Response({"assigned": updated}, status=status.HTTP_200_OK)


    @action(detail=True, methods=["get"], url_path="next-start", permission_classes=[IsAuthenticated])
    def next_start(self, request, pk=None):
        """
        Utility: compute the next starting serial for sequential assignments.
        Query params:
          - role: 'agency' or 'employee' (required)
          - scope: optional, currently supports 'global' (default)
        Returns: { "next_start": <int or null> }
        """
        try:
            batch = self.get_object()
        except Exception:
            return Response({"detail": "Batch not found."}, status=status.HTTP_404_NOT_FOUND)

        role = str(request.query_params.get("role") or "").lower()
        scope = str(request.query_params.get("scope") or "global").lower()

        if role not in ("agency", "employee"):
            return Response({"detail": "role must be 'agency' or 'employee'."}, status=status.HTTP_400_BAD_REQUEST)

        # For scope 'global' (default):
        # - agency next start = first AVAILABLE serial in this batch
        # - employee next start (admin direct) = first AVAILABLE serial with no agency/employee yet
        if role == "agency":
            qs = CouponCode.objects.filter(batch=batch, status="AVAILABLE")
        else:
            qs = CouponCode.objects.filter(
                batch=batch,
                status="AVAILABLE",
                assigned_agency__isnull=True,
                assigned_employee__isnull=True,
            )

        nxt = qs.order_by("serial").values_list("serial", flat=True).first()
        return Response({"next_start": int(nxt) if nxt is not None else None}, status=status.HTTP_200_OK)


class CouponSubmissionViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = CouponSubmission.objects.select_related(
        "consumer", "coupon", "employee_reviewer", "agency_reviewer", "code_ref"
    ).all()
    serializer_class = CouponSubmissionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if is_consumer_user(user):
            return qs.filter(consumer=user)
        if is_employee_user(user):
            # Employee can see submissions related to codes assigned to them OR coupons assigned to them (legacy)
            return qs.filter(
                Q(code_ref__assigned_employee=user) |
                Q(coupon__assignment__employee=user)
            )
        if is_agency_user(user):
            # Agency can see submissions in their pincode or those routed to them via TR
            return qs.filter(Q(pincode=user.pincode) | Q(tr_user=user))
        # default: restrict
        return qs.none()

    def create(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(self.get_serializer(instance).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="my-summary", permission_classes=[IsAuthenticated])
    def my_summary(self, request):
        if not is_consumer_user(request.user):
            return Response({"detail": "Only consumers can access."}, status=status.HTTP_403_FORBIDDEN)

        agg = (CouponSubmission.objects
               .filter(consumer=request.user)
               .values("status")
               .annotate(c=Count("id")))
        summary = {"submitted": 0, "employee_approved": 0, "agency_approved": 0, "rejected": 0}
        for row in agg:
            st = (row.get("status") or "").upper()
            if st == "SUBMITTED":
                summary["submitted"] = row["c"]
            elif st == "EMPLOYEE_APPROVED":
                summary["employee_approved"] = row["c"]
            elif st == "AGENCY_APPROVED":
                summary["agency_approved"] = row["c"]
            elif st == "REJECTED":
                summary["rejected"] = row["c"]

        transferred = AuditTrail.objects.filter(action="consumer_transfer", actor=request.user).count()
        summary["transferred"] = transferred
        return Response(summary, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="my", permission_classes=[IsAuthenticated])
    def my_submissions(self, request):
        qs = CouponSubmission.objects.filter(consumer=request.user).order_by("-created_at")
        page = self.paginate_queryset(qs)
        ser = self.get_serializer(page if page is not None else qs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)

    @action(detail=False, methods=["get"], url_path="pending-mine", permission_classes=[IsAuthenticated])
    def pending_mine(self, request):
        if not is_employee_user(request.user):
            return Response({"detail": "Only employees can view pending submissions."}, status=status.HTTP_403_FORBIDDEN)
        qs = CouponSubmission.objects.filter(
            Q(code_ref__assigned_employee=request.user) |
            Q(coupon__assignment__employee=request.user),
            status="SUBMITTED"
        ).exclude(code_ref__issued_channel="e_coupon").order_by("-created_at")
        page = self.paginate_queryset(qs)
        ser = self.get_serializer(page if page is not None else qs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)

    @action(detail=False, methods=["get"], url_path="pending-agency", permission_classes=[IsAuthenticated])
    def pending_agency(self, request):
        if not is_agency_user(request.user):
            return Response({"detail": "Only agency users can view pending agency submissions."}, status=status.HTTP_403_FORBIDDEN)
        qs = CouponSubmission.objects.filter(
            Q(status="EMPLOYEE_APPROVED", pincode=request.user.pincode) |
            Q(
                status="SUBMITTED",
                code_ref__assigned_employee__isnull=True,
                code_ref__assigned_agency=request.user,
                pincode=request.user.pincode,
            ) |
            Q(status="SUBMITTED", tr_user=request.user)
        ).exclude(code_ref__issued_channel="e_coupon").order_by("-created_at")
        page = self.paginate_queryset(qs)
        ser = self.get_serializer(page if page is not None else qs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)

    @action(detail=True, methods=["post"], url_path="employee-approve", permission_classes=[IsAuthenticated])
    def employee_approve(self, request, pk=None):
        if not is_employee_user(request.user):
            return Response({"detail": "Only employees can approve at this stage."}, status=status.HTTP_403_FORBIDDEN)
        try:
            sub = self.get_object()
        except Exception:
            return Response({"detail": "Submission not found."}, status=status.HTTP_404_NOT_FOUND)

        # Check ownership via code_ref or legacy coupon assignment
        owner_ok = False
        if sub.code_ref_id and sub.code_ref.assigned_employee_id == request.user.id:
            owner_ok = True
        else:
            try:
                assignment = sub.coupon.assignment
                owner_ok = assignment.employee_id == request.user.id
            except CouponAssignment.DoesNotExist:
                owner_ok = False

        if not owner_ok:
            return Response({"detail": "You are not assigned to this coupon/code."}, status=status.HTTP_403_FORBIDDEN)

        if sub.status != "SUBMITTED":
            return Response({"detail": f"Invalid state transition from {sub.status}."}, status=status.HTTP_400_BAD_REQUEST)

        comment = request.data.get("comment", "")
        sub.mark_employee_review(request.user, approved=True, comment=comment)
        sub.save(update_fields=[
            "employee_reviewer", "employee_reviewed_at", "employee_comment", "status"
        ])
        return Response(self.get_serializer(sub).data)

    @action(detail=True, methods=["post"], url_path="employee-reject", permission_classes=[IsAuthenticated])
    def employee_reject(self, request, pk=None):
        if not is_employee_user(request.user):
            return Response({"detail": "Only employees can reject at this stage."}, status=status.HTTP_403_FORBIDDEN)

        try:
            sub = self.get_object()
        except Exception:
            return Response({"detail": "Submission not found."}, status=status.HTTP_404_NOT_FOUND)

        owner_ok = False
        if sub.code_ref_id and sub.code_ref.assigned_employee_id == request.user.id:
            owner_ok = True
        else:
            try:
                assignment = sub.coupon.assignment
                owner_ok = assignment.employee_id == request.user.id
            except CouponAssignment.DoesNotExist:
                owner_ok = False

        if not owner_ok:
            return Response({"detail": "You are not assigned to this coupon/code."}, status=status.HTTP_403_FORBIDDEN)

        if sub.status != "SUBMITTED":
            return Response({"detail": f"Invalid state transition from {sub.status}."}, status=status.HTTP_400_BAD_REQUEST)

        comment = request.data.get("comment", "")
        sub.mark_employee_review(request.user, approved=False, comment=comment)
        sub.save(update_fields=[
            "employee_reviewer", "employee_reviewed_at", "employee_comment", "status"
        ])
        return Response(self.get_serializer(sub).data)

    @action(detail=True, methods=["post"], url_path="agency-approve", permission_classes=[IsAuthenticated])
    def agency_approve(self, request, pk=None):
        if not is_agency_user(request.user):
            return Response({"detail": "Only agency users can approve at this stage."}, status=status.HTTP_403_FORBIDDEN)

        try:
            sub = self.get_object()
        except Exception:
            return Response({"detail": "Submission not found."}, status=status.HTTP_404_NOT_FOUND)

        # Allow agency to approve when:
        # - Normal path: EMPLOYEE_APPROVED
        # - Direct agency sale: SUBMITTED + no assigned employee + code belongs to this agency
        can_approve = False
        if sub.status == "EMPLOYEE_APPROVED":
            can_approve = True
        elif sub.status == "SUBMITTED":
            if (sub.code_ref_id and sub.code_ref.assigned_employee_id is None and sub.code_ref.assigned_agency_id == request.user.id) or (sub.tr_user_id == request.user.id):
                can_approve = True
        if not can_approve:
            return Response({"detail": f"Invalid state transition from {sub.status}."}, status=status.HTTP_400_BAD_REQUEST)

        # Coverage check applies only if not routed by TR to this agency
        if not (sub.tr_user_id == request.user.id):
            if not request.user.pincode or request.user.pincode != sub.pincode:
                return Response({"detail": "Submission not within your pincode coverage."}, status=status.HTTP_403_FORBIDDEN)

        comment = request.data.get("comment", "")
        # Persist the agency review on the model (method is defined on the model in latest state)
        sub.agency_reviewer = request.user
        sub.agency_reviewed_at = timezone.now()
        sub.agency_comment = comment or ""
        sub.status = "AGENCY_APPROVED"
        sub.save(update_fields=[
            "agency_reviewer", "agency_reviewed_at", "agency_comment", "status"
        ])

        # If this submission used a specific code instance, mark it REDEEMED (signal will ensure idempotent)
        if sub.code_ref_id:
            sub.code_ref.mark_redeemed()
            sub.code_ref.save(update_fields=["status"])

        return Response(self.get_serializer(sub).data)

    @action(detail=True, methods=["post"], url_path="agency-reject", permission_classes=[IsAuthenticated])
    def agency_reject(self, request, pk=None):
        if not is_agency_user(request.user):
            return Response({"detail": "Only agency users can reject at this stage."}, status=status.HTTP_403_FORBIDDEN)

        try:
            sub = self.get_object()
        except Exception:
            return Response({"detail": "Submission not found."}, status=status.HTTP_404_NOT_FOUND)

        can_reject = False
        if sub.status == "EMPLOYEE_APPROVED":
            can_reject = True
        elif sub.status == "SUBMITTED" and sub.tr_user_id == request.user.id:
            can_reject = True
        if not can_reject:
            return Response({"detail": f"Invalid state transition from {sub.status}."}, status=status.HTTP_400_BAD_REQUEST)

        # Coverage check applies only if not routed by TR to this agency
        if not (sub.tr_user_id == request.user.id):
            if not request.user.pincode or request.user.pincode != sub.pincode:
                return Response({"detail": "Submission not within your pincode coverage."}, status=status.HTTP_403_FORBIDDEN)

        comment = request.data.get("comment", "")
        sub.agency_reviewer = request.user
        sub.agency_reviewed_at = timezone.now()
        sub.agency_comment = comment or ""
        sub.status = "REJECTED"
        sub.save(update_fields=[
            "agency_reviewer", "agency_reviewed_at", "agency_comment", "status"
        ])
        return Response(self.get_serializer(sub).data)


    @action(detail=True, methods=["post"], url_path="consumer-approve", permission_classes=[IsAuthenticated])
    def consumer_approve(self, request, pk=None):
        # Consumer can finalize approval when submission was routed to them via TR
        if not is_consumer_user(request.user):
            return Response({"detail": "Only consumers can approve routed submissions."}, status=status.HTTP_403_FORBIDDEN)
        try:
            sub = self.get_object()
        except Exception:
            return Response({"detail": "Submission not found."}, status=status.HTTP_404_NOT_FOUND)
        if sub.status != "SUBMITTED" or sub.tr_user_id != request.user.id:
            return Response({"detail": "Not allowed for this submission."}, status=status.HTTP_403_FORBIDDEN)

        comment = (request.data.get("comment") or "").strip()
        sub.agency_reviewer = None
        sub.agency_reviewed_at = timezone.now()
        sub.agency_comment = comment
        sub.status = "AGENCY_APPROVED"
        sub.save(update_fields=["agency_reviewer", "agency_reviewed_at", "agency_comment", "status"])

        # Mark code redeemed (signal ensures idempotent side effects)
        if sub.code_ref_id:
            sub.code_ref.mark_redeemed()
            sub.code_ref.save(update_fields=["status"])

        # Audit trail for consumer approval
        try:
            AuditTrail.objects.create(
                action="consumer_approved",
                actor=request.user,
                coupon_code=sub.code_ref,
                submission=sub,
                notes=comment or "",
            )
        except Exception:
            pass

        return Response(self.get_serializer(sub).data)

    @action(detail=True, methods=["post"], url_path="consumer-reject", permission_classes=[IsAuthenticated])
    def consumer_reject(self, request, pk=None):
        # Consumer can reject when submission was routed to them via TR
        if not is_consumer_user(request.user):
            return Response({"detail": "Only consumers can reject routed submissions."}, status=status.HTTP_403_FORBIDDEN)
        try:
            sub = self.get_object()
        except Exception:
            return Response({"detail": "Submission not found."}, status=status.HTTP_404_NOT_FOUND)
        if sub.status != "SUBMITTED" or sub.tr_user_id != request.user.id:
            return Response({"detail": "Not allowed for this submission."}, status=status.HTTP_403_FORBIDDEN)

        comment = (request.data.get("comment") or "").strip()
        sub.agency_reviewer = None
        sub.agency_reviewed_at = timezone.now()
        sub.agency_comment = comment
        sub.status = "REJECTED"
        sub.save(update_fields=["agency_reviewer", "agency_reviewed_at", "agency_comment", "status"])

        try:
            AuditTrail.objects.create(
                action="consumer_rejected",
                actor=request.user,
                coupon_code=sub.code_ref,
                submission=sub,
                notes=comment or "",
            )
        except Exception:
            pass

        return Response(self.get_serializer(sub).data)

class CommissionViewSet(mixins.ListModelMixin,
                        mixins.RetrieveModelMixin,
                        viewsets.GenericViewSet):
    queryset = Commission.objects.select_related("recipient", "coupon_code", "submission").all()
    serializer_class = CommissionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Non-admins see only their own commissions
        if not is_admin_user(user):
            qs = qs.filter(recipient=user)
        # Filters
        status_in = self.request.query_params.get("status")
        role = self.request.query_params.get("role")
        if status_in:
            qs = qs.filter(status=status_in)
        if role:
            qs = qs.filter(role=role)
        return qs.order_by("-earned_at")

    @action(detail=False, methods=["get"], url_path="mine", permission_classes=[IsAuthenticated])
    def mine(self, request):
        qs = self.get_queryset().filter(recipient=request.user)
        page = self.paginate_queryset(qs)
        ser = self.get_serializer(page if page is not None else qs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)

    @action(detail=True, methods=["post"], url_path="mark-paid", permission_classes=[IsAuthenticated])
    def mark_paid(self, request, pk=None):
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can mark commissions as paid."}, status=status.HTTP_403_FORBIDDEN)
        try:
            com = self.get_object()
        except Exception:
            return Response({"detail": "Commission not found."}, status=status.HTTP_404_NOT_FOUND)
        if com.status == "paid":
            return Response({"detail": "Already paid."}, status=status.HTTP_400_BAD_REQUEST)
        com.status = "paid"
        com.paid_at = timezone.now()
        com.save(update_fields=["status", "paid_at"])
        return Response(self.get_serializer(com).data, status=status.HTTP_200_OK)


class AuditTrailViewSet(mixins.ListModelMixin,
                        mixins.RetrieveModelMixin,
                        viewsets.GenericViewSet):
    queryset = AuditTrail.objects.select_related("actor", "coupon_code", "submission", "batch").all()
    serializer_class = AuditTrailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        # Filters
        action_in = self.request.query_params.get("action")
        code = self.request.query_params.get("code")
        batch_id = self.request.query_params.get("batch")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if action_in:
            qs = qs.filter(action=action_in)
        if code:
            qs = qs.filter(Q(coupon_code__code=code) | Q(submission__coupon_code=code))
        if batch_id:
            qs = qs.filter(batch_id=batch_id)
        if date_from:
            try:
                qs = qs.filter(created_at__gte=date_from)
            except Exception:
                pass
        if date_to:
            try:
                qs = qs.filter(created_at__lte=date_to)
            except Exception:
                pass
        return qs.order_by("-created_at")


# ===========================
# Public v1 Coupon Endpoints
# ===========================
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from business.services.activation import activate_150_active, activate_50, redeem_150, ensure_first_purchase_activation


class CouponActivateView(APIView):
    """
    POST /api/v1/coupon/activate/
    Body:
      {
        "type": "150" | "50",
        "source": { ... optional context ... }
      }
    Effects:
      - type "150": opens FIVE_150 (L6) + THREE_150 (L15), pays direct/self bonuses
      - type "50": opens THREE_50 (L15)
      - records all ledger via Wallet.credit inside activation services
      - stamps first_purchase_activated_at and unlocks flags (idempotent)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        t = str(request.data.get("type") or "").strip()
        source = request.data.get("source") or {}
        if t not in ("150", "50"):
            return Response({"detail": "type must be '150' or '50'."}, status=status.HTTP_400_BAD_REQUEST)
        if t == "150":
            ok = activate_150_active(request.user, {"type": "coupon_150_activate", **source})
        else:
            ok = activate_50(request.user, {"type": "coupon_50_activate", **source})
        # Mark first purchase flags (safe idempotent)
        try:
            ensure_first_purchase_activation(request.user, {"type": "coupon_first_purchase", **source})
        except Exception:
            pass
        # Record activation audit for e-coupons (no approval flow)
        try:
            code_str = str(source.get("code") or "").strip()
            ch = str(source.get("channel") or "")
            if code_str and ch == "e_coupon":
                code_obj = CouponCode.objects.filter(code=code_str).first()
                if code_obj and code_obj.assigned_consumer_id == request.user.id:
                    AuditTrail.objects.create(
                        action="coupon_activated",
                        actor=request.user,
                        coupon_code=code_obj,
                        notes="",
                        metadata={"type": t},
                    )
        except Exception:
            pass

        # E-coupon activation commission distribution
        try:
            code_str = str(source.get("code") or "").strip()
            ch = str(source.get("channel") or "")
            if code_str and ch == "e_coupon":
                code_obj = CouponCode.objects.filter(code=code_str).select_related("assigned_employee", "assigned_agency").first()
                if code_obj and code_obj.assigned_consumer_id == request.user.id:
                    # Idempotency guard: award only once per code
                    if not AuditTrail.objects.filter(action="ecoupon_commission_awarded", coupon_code=code_obj).exists():
                        from accounts.models import Wallet
                        from decimal import Decimal
                        awards = []
                        # Employee assigned path: 15 to employee, 15 to agency/sub-franchise
                        if code_obj.assigned_employee_id:
                            if code_obj.assigned_employee:
                                awards.append(("employee", code_obj.assigned_employee, Decimal("15.00")))
                            if code_obj.assigned_agency:
                                awards.append(("agency", code_obj.assigned_agency, Decimal("15.00")))
                        # Agency direct path: 30 to agency
                        elif code_obj.assigned_agency_id:
                            if code_obj.assigned_agency:
                                awards.append(("agency", code_obj.assigned_agency, Decimal("30.00")))
                        # Credit wallets
                        for role, user_obj, amt in awards:
                            try:
                                w = Wallet.get_or_create_for_user(user_obj)
                                w.credit(
                                    amt,
                                    tx_type="COMMISSION_CREDIT",
                                    meta={"role": role, "source": "ECOUPON_ACTIVATION", "code": code_obj.code},
                                    source_type="ECOUPON_COMMISSION",
                                    source_id=str(code_obj.id),
                                )
                            except Exception:
                                pass
                        # Audit award summary
                        try:
                            AuditTrail.objects.create(
                                action="ecoupon_commission_awarded",
                                actor=request.user,
                                coupon_code=code_obj,
                                notes="Activation commission split",
                                metadata={"awards": [{"role": r, "user": getattr(u, "username", None), "amount": str(a)} for (r, u, a) in awards]},
                            )
                        except Exception:
                            pass
        except Exception:
            pass

        return Response({"activated": bool(ok), "detail": f"Coupon {t} activation processed."}, status=status.HTTP_200_OK)


class CouponRedeemView(APIView):
    """
    POST /api/v1/coupon/redeem/
    Body:
      {
        "type": "150",
        "source": { ... optional context ... }
      }
    Effects:
      - credits ₹140 to wallet (configurable)
      - ledger recorded within service
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        t = str(request.data.get("type") or "").strip()
        source = request.data.get("source") or {}
        if t != "150":
            return Response({"detail": "Only type '150' is supported for redeem."}, status=status.HTTP_400_BAD_REQUEST)
        ok = redeem_150(request.user, {"type": "coupon_150_redeem", **source})
        # Mark code redeemed and audit for e-coupons (no approval flow)
        try:
            code_str = str(source.get("code") or "").strip()
            ch = str(source.get("channel") or "")
            if code_str and ch == "e_coupon":
                code_obj = CouponCode.objects.filter(code=code_str).first()
                if code_obj and code_obj.assigned_consumer_id == request.user.id and code_obj.status != "REDEEMED":
                    code_obj.mark_redeemed()
                    code_obj.save(update_fields=["status"])
                    AuditTrail.objects.create(
                        action="coupon_redeemed",
                        actor=request.user,
                        coupon_code=code_obj,
                        notes="",
                        metadata={"type": t},
                    )
        except Exception:
            pass
        return Response({"redeemed": bool(ok), "detail": "Coupon 150 redeem processed."}, status=status.HTTP_200_OK)


# ===============================
# E‑Coupon Store/Admin Endpoints
# ===============================
class ECouponPaymentConfigViewSet(viewsets.ModelViewSet):
    queryset = ECouponPaymentConfig.objects.all().order_by("-created_at")
    serializer_class = ECouponPaymentConfigSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        if is_admin_user(self.request.user):
            return qs
        # Non-admins can only see active config(s)
        return qs.filter(is_active=True)

    def create(self, request, *args, **kwargs):
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can create payment configs."}, status=status.HTTP_403_FORBIDDEN)
        ser = self.get_serializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        instance = ser.save(created_by=request.user)
        return Response(self.get_serializer(instance).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can update payment configs."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can update payment configs."}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can delete payment configs."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="set-active")
    def set_active(self, request, pk=None):
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can set active config."}, status=status.HTTP_403_FORBIDDEN)
        try:
            cfg = self.get_object()
        except Exception:
            return Response({"detail": "Config not found."}, status=status.HTTP_404_NOT_FOUND)
        with transaction.atomic():
            ECouponPaymentConfig.objects.exclude(id=cfg.id).update(is_active=False)
            cfg.is_active = True
            cfg.save(update_fields=["is_active"])
        return Response(self.get_serializer(cfg).data, status=status.HTTP_200_OK)


class ECouponProductViewSet(viewsets.ModelViewSet):
    queryset = ECouponProduct.objects.select_related("coupon").all()
    serializer_class = ECouponProductSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset().order_by("denomination", "-created_at")
        user = self.request.user
        # Admin sees everything; can optionally filter by role param
        if is_admin_user(user):
            role = (self.request.query_params.get("role") or "").strip().lower()
            if role == "consumer":
                qs = qs.filter(enable_consumer=True)
            elif role == "agency":
                qs = qs.filter(enable_agency=True)
            elif role == "employee":
                qs = qs.filter(enable_employee=True)
            return qs

        # Non-admins see only active + role-enabled
        qs = qs.filter(is_active=True)
        if is_consumer_user(user):
            qs = qs.filter(enable_consumer=True)
        elif is_agency_user(user):
            qs = qs.filter(enable_agency=True)
        elif is_employee_user(user):
            qs = qs.filter(enable_employee=True)
        else:
            # Unknown role → hide
            qs = qs.none()
        return qs

    def create(self, request, *args, **kwargs):
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can create products."}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can update products."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can update products."}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can delete products."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class ECouponOrderViewSet(mixins.CreateModelMixin,
                          mixins.ListModelMixin,
                          mixins.RetrieveModelMixin,
                          viewsets.GenericViewSet):
    queryset = ECouponOrder.objects.select_related("buyer", "product", "payment_config", "reviewer").all().order_by("-created_at")
    serializer_class = ECouponOrderSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def _role_of(self, user):
        if is_consumer_user(user):
            return "consumer"
        if is_agency_user(user):
            return "agency"
        if is_employee_user(user):
            return "employee"
        return None

    def list(self, request, *args, **kwargs):
        # Default list: admin sees all, others see their own via /mine
        if not is_admin_user(request.user):
            return self.mine(request)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        from decimal import Decimal, InvalidOperation
        user = request.user
        role = self._role_of(user)
        if role is None:
            return Response({"detail": "Your role is not allowed to purchase e‑coupons."}, status=status.HTTP_403_FORBIDDEN)

        # Product and quantity
        try:
            product_id = int(request.data.get("product"))
        except Exception:
            return Response({"product": ["This field is required (integer)."]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            qty = int(request.data.get("quantity"))
        except Exception:
            return Response({"quantity": ["This field is required (integer)."]}, status=status.HTTP_400_BAD_REQUEST)
        if qty <= 0:
            return Response({"quantity": ["Must be > 0."]}, status=status.HTTP_400_BAD_REQUEST)

        product = ECouponProduct.objects.select_related("coupon").filter(id=product_id).first()
        if not product:
            return Response({"product": ["Invalid product id."]}, status=status.HTTP_400_BAD_REQUEST)

        # Visibility rules for non-admins
        if not is_admin_user(user):
            if not product.is_active:
                return Response({"detail": "Product is not active."}, status=status.HTTP_400_BAD_REQUEST)
            if role == "consumer" and not product.enable_consumer:
                return Response({"detail": "Product not available for consumers."}, status=status.HTTP_403_FORBIDDEN)
            if role == "agency" and not product.enable_agency:
                return Response({"detail": "Product not available for agencies."}, status=status.HTTP_403_FORBIDDEN)
            if role == "employee" and not product.enable_employee:
                return Response({"detail": "Product not available for employees."}, status=status.HTTP_403_FORBIDDEN)

        if product.max_per_order and qty > int(product.max_per_order):
            return Response({"quantity": [f"Max per order is {product.max_per_order}."]}, status=status.HTTP_400_BAD_REQUEST)

        # Active payment config required
        cfg = ECouponPaymentConfig.objects.filter(is_active=True).order_by("-created_at").first()
        if not cfg:
            return Response({"detail": "Payment is temporarily unavailable. Please try later."}, status=status.HTTP_409_CONFLICT)

        # Compute totals
        try:
            unit_price = product.price_per_unit
            amount_total = unit_price * qty
        except Exception:
            from decimal import Decimal as D
            amount_total = D("0.00")

        order = ECouponOrder.objects.create(
            buyer=user,
            role_at_purchase=role,
            product=product,
            denomination_snapshot=product.denomination,
            quantity=qty,
            amount_total=amount_total,
            payment_config=cfg,
            payment_proof_file=request.FILES.get("payment_proof_file"),
            utr=(request.data.get("utr") or "").strip(),
            notes=(request.data.get("notes") or "").strip(),
            status="SUBMITTED",
        )

        # Audit trail (best effort)
        try:
            AuditTrail.objects.create(
                action="store_order_submitted",
                actor=user,
                notes=f"Submitted order #{order.id}",
                metadata={"order_id": order.id, "product_id": product.id, "qty": qty, "total": str(amount_total)},
            )
        except Exception:
            pass

        return Response(self.get_serializer(order).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="mine")
    def mine(self, request):
        qs = self.get_queryset().filter(buyer=request.user)
        page = self.paginate_queryset(qs)
        ser = self.get_serializer(page if page is not None else qs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)

    @action(detail=False, methods=["get"], url_path="pending")
    def pending(self, request):
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can view pending orders."}, status=status.HTTP_403_FORBIDDEN)
        qs = self.get_queryset().filter(status="SUBMITTED")
        page = self.paginate_queryset(qs)
        ser = self.get_serializer(page if page is not None else qs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)

    @action(detail=False, methods=["get"], url_path="bootstrap")
    def bootstrap(self, request):
        # Products for current role + active payment config
        user = request.user
        role = "consumer" if is_consumer_user(user) else ("agency" if is_agency_user(user) else ("employee" if is_employee_user(user) else None))
        prods = ECouponProduct.objects.filter(is_active=True).order_by("denomination")
        if role == "consumer":
            prods = prods.filter(enable_consumer=True)
        elif role == "agency":
            prods = prods.filter(enable_agency=True)
        elif role == "employee":
            prods = prods.filter(enable_employee=True)
        else:
            prods = ECouponProduct.objects.none()

        cfg = ECouponPaymentConfig.objects.filter(is_active=True).order_by("-created_at").first()
        prod_ser = ECouponProductSerializer(prods, many=True, context={"request": request})
        cfg_ser = ECouponPaymentConfigSerializer(cfg, context={"request": request}) if cfg else None
        return Response({"products": prod_ser.data, "payment_config": (cfg_ser.data if cfg_ser else None)})

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can approve orders."}, status=status.HTTP_403_FORBIDDEN)
        try:
            order = self.get_object()
        except Exception:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        if order.status == "APPROVED":
            return Response(self.get_serializer(order).data, status=status.HTTP_200_OK)

        role = order.role_at_purchase
        if role not in ("consumer", "agency", "employee"):
            return Response({"detail": "Invalid role on order."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            base_qs = CouponCode.objects.filter(
                issued_channel="e_coupon",
                coupon=order.product.coupon,
                value=order.denomination_snapshot,
                status="AVAILABLE",
                assigned_agency__isnull=True,
                assigned_employee__isnull=True,
                assigned_consumer__isnull=True,
            )
            try:
                locking_qs = base_qs.select_for_update(skip_locked=True)
            except Exception:
                locking_qs = base_qs

            need = int(order.quantity or 0)
            pick_ids = list(locking_qs.order_by("serial", "id").values_list("id", flat=True)[:need])
            if len(pick_ids) < need:
                return Response({"detail": "Insufficient e‑coupon inventory for this denomination."}, status=status.HTTP_409_CONFLICT)

            update_kwargs = {}
            if role == "consumer":
                update_kwargs = {"assigned_consumer_id": order.buyer_id, "status": "SOLD"}
            elif role == "agency":
                update_kwargs = {"assigned_agency_id": order.buyer_id, "status": "ASSIGNED_AGENCY"}
            elif role == "employee":
                update_kwargs = {"assigned_employee_id": order.buyer_id, "status": "ASSIGNED_EMPLOYEE"}

            write_qs = CouponCode.objects.filter(id__in=pick_ids).filter(
                issued_channel="e_coupon",
                status="AVAILABLE",
                assigned_agency__isnull=True,
                assigned_employee__isnull=True,
                assigned_consumer__isnull=True,
            )
            affected = write_qs.update(**update_kwargs)
            sample_codes = list(CouponCode.objects.filter(id__in=pick_ids).values_list("code", flat=True)[:5])

            order.status = "APPROVED"
            order.reviewer = request.user
            order.reviewed_at = timezone.now()
            order.review_note = (request.data.get("review_note") or "").strip()
            order.allocated_count = int(affected or 0)
            order.allocated_sample_codes = sample_codes
            order.save(update_fields=["status", "reviewer", "reviewed_at", "review_note", "allocated_count", "allocated_sample_codes"])

            try:
                AuditTrail.objects.create(
                    action="store_order_approved",
                    actor=request.user,
                    notes=f"Approved order #{order.id}",
                    metadata={"order_id": order.id, "allocated": int(affected or 0), "role": role},
                )
            except Exception:
                pass

        return Response(self.get_serializer(order).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        if not is_admin_user(request.user):
            return Response({"detail": "Only admin can reject orders."}, status=status.HTTP_403_FORBIDDEN)
        try:
            order = self.get_object()
        except Exception:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        if order.status in ("APPROVED", "REJECTED", "CANCELLED"):
            return Response({"detail": f"Order already {order.status}."}, status=status.HTTP_400_BAD_REQUEST)

        order.status = "REJECTED"
        order.reviewer = request.user
        order.reviewed_at = timezone.now()
        order.review_note = (request.data.get("review_note") or "").strip()
        order.save(update_fields=["status", "reviewer", "reviewed_at", "review_note"])

        try:
            AuditTrail.objects.create(
                action="store_order_rejected",
                actor=request.user,
                notes=f"Rejected order #{order.id}",
                metadata={"order_id": order.id},
            )
        except Exception:
            pass

        return Response(self.get_serializer(order).data, status=status.HTTP_200_OK)
