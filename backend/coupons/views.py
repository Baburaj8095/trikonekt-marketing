from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from rest_framework import status, viewsets, mixins
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import CustomUser
from .models import (
    Coupon,
    CouponAssignment,
    CouponSubmission,
    CouponCode,
    CouponBatch,
    Commission,
    AuditTrail,
)
from .serializers import (
    CouponSerializer,
    CouponAssignmentSerializer,
    CouponSubmissionSerializer,
    CouponCodeSerializer,
    CouponBatchSerializer,
    CommissionSerializer,
    AuditTrailSerializer,
)


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
        return qs

    @action(detail=False, methods=["get"], url_path="mine", permission_classes=[IsAuthenticated])
    def mine(self, request):
        if not is_employee_user(request.user):
            return Response({"detail": "Only employees can view their codes."}, status=status.HTTP_403_FORBIDDEN)
        qs = self.get_queryset().filter(assigned_employee=request.user)
        page = self.paginate_queryset(qs)
        ser = self.get_serializer(page if page is not None else qs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)


    @action(detail=True, methods=["post"], url_path="assign-consumer", permission_classes=[IsAuthenticated])
    def assign_consumer(self, request, pk=None):
        """
        Employee or Agency assigns an e-coupon code to a Consumer.
        This creates a CouponSubmission on behalf of the consumer in SUBMITTED state
        so the normal review/commission/wallet signal flow proceeds.
        Body: { "consumer_username": "U123456", "pincode": "585101", "notes": "optional" }
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
        pincode = (request.data.get("pincode") or "").strip()
        notes = (request.data.get("notes") or "").strip()

        if not consumer_username:
            return Response({"consumer_username": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        if not pincode:
            return Response({"pincode": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)

        consumer = CustomUser.objects.filter(username__iexact=consumer_username).first()
        if not consumer or not is_consumer_user(consumer):
            return Response({"consumer_username": ["Consumer not found or invalid."]}, status=status.HTTP_400_BAD_REQUEST)

        # Prevent multiple open submissions for this code
        open_exists = CouponSubmission.objects.filter(code_ref=code, status__in=("SUBMITTED", "EMPLOYEE_APPROVED")).exists()
        if open_exists:
            return Response({"detail": "There is already an open submission for this code."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            sub = CouponSubmission.objects.create(
                consumer=consumer,
                coupon=code.coupon,
                coupon_code=code.code,
                code_ref=code,
                pincode=pincode,
                notes=notes,
                status="SUBMITTED",
            )
            # Mark code as SOLD (distributed to consumer)
            code.mark_sold()
            code.save(update_fields=["status"])

            AuditTrail.objects.create(
                action="assigned_to_consumer",
                actor=request.user,
                coupon_code=code,
                submission=sub,
                metadata={"consumer_username": consumer.username},
            )

        ser = CouponSubmissionSerializer(sub)
        return Response(ser.data, status=status.HTTP_201_CREATED)

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


class CouponBatchViewSet(mixins.CreateModelMixin,
                         mixins.ListModelMixin,
                         mixins.RetrieveModelMixin,
                         viewsets.GenericViewSet):
    queryset = CouponBatch.objects.select_related("coupon", "created_by").all()
    serializer_class = CouponBatchSerializer
    permission_classes = [IsAuthenticated]

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
                    value=150,
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
                metadata={"prefix": prefix, "range": [start, end], "width": width},
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

        code_ids = list(CouponCode.objects.filter(batch=batch, status="AVAILABLE").order_by("serial").values_list("id", flat=True))

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
        ).order_by("serial").values_list("id", flat=True))

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
            # Agency can see submissions in their pincode (v1 simple rule)
            return qs.filter(pincode=user.pincode)
        # default: restrict
        return qs.none()

    def create(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(self.get_serializer(instance).data, status=status.HTTP_201_CREATED)

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
        ).order_by("-created_at")
        page = self.paginate_queryset(qs)
        ser = self.get_serializer(page if page is not None else qs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)

    @action(detail=False, methods=["get"], url_path="pending-agency", permission_classes=[IsAuthenticated])
    def pending_agency(self, request):
        if not is_agency_user(request.user):
            return Response({"detail": "Only agency users can view pending agency submissions."}, status=status.HTTP_403_FORBIDDEN)
        qs = CouponSubmission.objects.filter(
            Q(status="EMPLOYEE_APPROVED") |
            Q(
                status="SUBMITTED",
                code_ref__assigned_employee__isnull=True,
                code_ref__assigned_agency=request.user,
            ),
            pincode=request.user.pincode,
        ).order_by("-created_at")
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
            if sub.code_ref_id and sub.code_ref.assigned_employee_id is None and sub.code_ref.assigned_agency_id == request.user.id:
                can_approve = True
        if not can_approve:
            return Response({"detail": f"Invalid state transition from {sub.status}."}, status=status.HTTP_400_BAD_REQUEST)

        # v1 coverage: match pincode
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

        if sub.status != "EMPLOYEE_APPROVED":
            return Response({"detail": f"Invalid state transition from {sub.status}."}, status=status.HTTP_400_BAD_REQUEST)

        # v1 coverage: match pincode
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
        return Response({"redeemed": bool(ok), "detail": "Coupon 150 redeem processed."}, status=status.HTTP_200_OK)
