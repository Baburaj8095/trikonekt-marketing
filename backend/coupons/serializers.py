from django.utils import timezone
from rest_framework import serializers
from django.db.models import Q
from django.conf import settings

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


UserModel = settings.AUTH_USER_MODEL


class CouponSerializer(serializers.ModelSerializer):
    issuer_username = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Coupon
        fields = [
            "id",
            "code",
            "title",
            "description",
            "campaign",
            "valid_from",
            "valid_to",
            "issuer",
            "issuer_username",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["issuer", "issuer_username", "created_at"]

    def get_issuer_username(self, obj):
        try:
            return obj.issuer.username
        except Exception:
            return None


class CouponAssignmentSerializer(serializers.ModelSerializer):
    coupon_code = serializers.CharField(source="coupon.code", read_only=True)
    employee_username = serializers.SerializerMethodField(read_only=True)
    assigned_by_username = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CouponAssignment
        fields = [
            "id",
            "coupon",
            "coupon_code",
            "employee",
            "employee_username",
            "assigned_by",
            "assigned_by_username",
            "assigned_at",
            "status",
        ]
        read_only_fields = ["assigned_at"]

    def get_employee_username(self, obj):
        try:
            return obj.employee.username
        except Exception:
            return None

    def get_assigned_by_username(self, obj):
        try:
            return obj.assigned_by.username
        except Exception:
            return None


class CouponCodeSerializer(serializers.ModelSerializer):
    coupon_title = serializers.CharField(source="coupon.title", read_only=True)
    assigned_employee_username = serializers.SerializerMethodField(read_only=True)
    assigned_agency_username = serializers.SerializerMethodField(read_only=True)
    assigned_consumer_username = serializers.SerializerMethodField(read_only=True)
    issued_by_username = serializers.SerializerMethodField(read_only=True)
    state_label = serializers.SerializerMethodField(read_only=True)
    display_status = serializers.SerializerMethodField(read_only=True)
    can_activate = serializers.SerializerMethodField(read_only=True)
    can_transfer = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CouponCode
        fields = [
            "id",
            "code",
            "coupon",
            "coupon_title",
            "issued_channel",
            "assigned_agency",
            "assigned_agency_username",
            "assigned_employee",
            "assigned_employee_username",
            "assigned_consumer",
            "assigned_consumer_username",
            "issued_by",
            "issued_by_username",
            "batch",
            "serial",
            "value",
            "status",
            "state_label",
            "display_status",
            "can_activate",
            "can_transfer",
            "created_at",
        ]
        read_only_fields = ["status", "created_at"]

    def get_assigned_employee_username(self, obj):
        try:
            return obj.assigned_employee.username if obj.assigned_employee_id else None
        except Exception:
            return None

    def get_assigned_agency_username(self, obj):
        try:
            return obj.assigned_agency.username if obj.assigned_agency_id else None
        except Exception:
            return None

    def get_issued_by_username(self, obj):
        try:
            return obj.issued_by.username
        except Exception:
            return None

    def get_assigned_consumer_username(self, obj):
        try:
            return obj.assigned_consumer.username if obj.assigned_consumer_id else None
        except Exception:
            return None

    def get_state_label(self, obj):
        try:
            st = (obj.status or "").upper()
            if st == "ASSIGNED_EMPLOYEE":
                name = obj.assigned_employee.username if obj.assigned_employee_id else None
                return f"Assigned to {name}" if name else "Assigned to employee"
            return st
        except Exception:
            return obj.status

    def get_display_status(self, obj):
        # User-friendly status for consumer dashboard:
        # - When consumer owns the code (SOLD), show "PENDING" until activated
        # - If activation audit exists by the same consumer, show "ACTIVATED"
        # - If redeemed, show "REDEEMED"
        # - If this user has transferred this code away, show "TRANSFERRED"
        try:
            request = self.context.get("request")
            user = getattr(request, "user", None) if request else None
            st = (obj.status or "").upper()
            if user and getattr(user, "id", None):
                from .models import AuditTrail  # local import to avoid circular in some tools
                # If current user initiated a transfer of this code, show TRANSFERRED regardless of current ownership
                did_transfer = AuditTrail.objects.filter(action="consumer_transfer", actor=user, coupon_code=obj).exists()
                if did_transfer:
                    return "TRANSFERRED"
                # For owned codes, show pending/activated/redeemed
                if obj.assigned_consumer_id == user.id:
                    activated = AuditTrail.objects.filter(action="coupon_activated", actor=user, coupon_code=obj).exists()
                    if activated:
                        return "ACTIVATED"
                    if st == "SOLD":
                        return "PENDING"
                    if st == "REDEEMED":
                        return "REDEEMED"
            return st
        except Exception:
            return obj.status

    def get_can_activate(self, obj):
        # Consumer can activate only if they own it, it's not redeemed, not already activated, and not transferred by them
        try:
            request = self.context.get("request")
            user = getattr(request, "user", None) if request else None
            if not (user and getattr(user, "id", None) and obj.assigned_consumer_id == user.id):
                return False
            st = (obj.status or "").upper()
            if st == "REDEEMED":
                return False
            from .models import AuditTrail
            activated = AuditTrail.objects.filter(action="coupon_activated", actor=user, coupon_code=obj).exists()
            did_transfer = AuditTrail.objects.filter(action="consumer_transfer", actor=user, coupon_code=obj).exists()
            return (not activated) and (not did_transfer)
        except Exception:
            return False

    def get_can_transfer(self, obj):
        # Consumer can transfer only if they own it, it's not redeemed, and not activated or previously transferred by them
        try:
            request = self.context.get("request")
            user = getattr(request, "user", None) if request else None
            if not (user and getattr(user, "id", None) and obj.assigned_consumer_id == user.id):
                return False
            st = (obj.status or "").upper()
            if st == "REDEEMED":
                return False
            from .models import AuditTrail
            activated = AuditTrail.objects.filter(action="coupon_activated", actor=user, coupon_code=obj).exists()
            did_transfer = AuditTrail.objects.filter(action="consumer_transfer", actor=user, coupon_code=obj).exists()
            return (not activated) and (not did_transfer)
        except Exception:
            return False


class CouponSubmissionSerializer(serializers.ModelSerializer):
    consumer_username = serializers.SerializerMethodField(read_only=True)
    coupon_id = serializers.IntegerField(source="coupon.id", read_only=True)
    file = serializers.FileField(write_only=True, required=False)
    tr_username = serializers.CharField(write_only=True, required=False, allow_blank=True)
    consumer_tr_username = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = CouponSubmission
        fields = [
            "id",
            "consumer",
            "consumer_username",
            "coupon",
            "coupon_id",
            "coupon_code",
            "code_ref",
            "pincode",
            "notes",
            "file",
            "tr_username",
            "consumer_tr_username",
            "status",
            "employee_reviewer",
            "employee_reviewed_at",
            "employee_comment",
            "agency_reviewer",
            "agency_reviewed_at",
            "agency_comment",
            "created_at",
        ]
        read_only_fields = [
            "consumer",
            "consumer_username",
            "coupon",
            "coupon_id",
            "code_ref",
            "status",
            "employee_reviewer",
            "employee_reviewed_at",
            "agency_reviewer",
            "agency_reviewed_at",
            "created_at",
        ]

    def get_consumer_username(self, obj):
        try:
            return obj.consumer.username
        except Exception:
            return None

    def validate(self, attrs):
        # Expect coupon_code provided on create
        request = self.context.get("request")
        if request and request.method in ("POST", "PUT", "PATCH"):
            coupon_code = attrs.get("coupon_code") or (self.instance.coupon_code if self.instance else None)
            if not coupon_code:
                raise serializers.ValidationError({"coupon_code": "This field is required."})

            # First: try to resolve a specific CouponCode instance (supports physical/e-coupons at scale)
            code_ref = None
            coupon_obj = None
            try:
                code_ref = CouponCode.objects.select_related("coupon").get(code=coupon_code)
                coupon_obj = code_ref.coupon
            except CouponCode.DoesNotExist:
                # Fallback to legacy Coupon by code (v1 single code per campaign)
                try:
                    coupon_obj = Coupon.objects.get(code=coupon_code)
                except Coupon.DoesNotExist:
                    raise serializers.ValidationError({"coupon_code": "Invalid coupon code."})

            now = timezone.now()
            if not coupon_obj.is_active:
                raise serializers.ValidationError({"coupon_code": "This coupon is not active."})
            if coupon_obj.valid_from and coupon_obj.valid_from > now:
                raise serializers.ValidationError({"coupon_code": "This coupon is not yet valid."})
            if coupon_obj.valid_to and coupon_obj.valid_to < now:
                raise serializers.ValidationError({"coupon_code": "This coupon has expired."})

            # Prevent multiple open submissions:
            # - If code_ref exists, enforce uniqueness per code instance
            # - Else enforce at coupon level (legacy)
            if code_ref:
                if code_ref.status not in ("AVAILABLE", "ASSIGNED_AGENCY", "ASSIGNED_EMPLOYEE"):
                    raise serializers.ValidationError({"coupon_code": f"This code is not available (status={code_ref.status})."})
                # Disallow manual submissions for E-Coupons (no manual approval/agency workflow)
                if str(getattr(code_ref, "issued_channel", "")).lower() == "e_coupon":
                    raise serializers.ValidationError({"coupon_code": "E\u2009coupon codes cannot be submitted for manual approval. Use the E\u2009Coupon activation/redeem flow instead."})
                open_exists = CouponSubmission.objects.filter(
                    code_ref=code_ref, status__in=("SUBMITTED", "EMPLOYEE_APPROVED")
                ).exists()
                if open_exists:
                    raise serializers.ValidationError({"coupon_code": "There is already an open submission for this code."})
            else:
                open_exists = CouponSubmission.objects.filter(
                    coupon=coupon_obj, status__in=("SUBMITTED", "EMPLOYEE_APPROVED")
                ).exists()
                if open_exists:
                    raise serializers.ValidationError(
                        {"coupon_code": "There is already an open submission for this coupon."}
                    )

            # TR username routing (resolve to Agency or Consumer)
            tr_username = (attrs.get("tr_username") or "").strip()
            if tr_username:
                from accounts.models import CustomUser
                tr_u = CustomUser.objects.filter(username__iexact=tr_username).first()
                if not tr_u:
                    raise serializers.ValidationError({"tr_username": "Invalid TR ID."})
                role = getattr(tr_u, "role", None)
                # Allow Agency or Consumer ('user')
                if role not in ("agency", "user"):
                    raise serializers.ValidationError({"tr_username": "TR must be an Agency or Consumer username."})
                attrs["_validated_tr_user"] = tr_u
                attrs["_validated_tr_username"] = tr_username

            c_tr = (attrs.get("consumer_tr_username") or "").strip()
            if c_tr:
                attrs["_validated_consumer_tr_username"] = c_tr

            # pincode is optional now (no gating). If omitted, we may default from TR user in create().
            attrs["_validated_coupon_obj"] = coupon_obj
            attrs["_validated_code_ref"] = code_ref

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request else None

        coupon = validated_data.pop("_validated_coupon_obj")
        code_ref = validated_data.pop("_validated_code_ref", None)

        tr_user = validated_data.pop("_validated_tr_user", None)
        tr_username = validated_data.pop("_validated_tr_username", "")
        consumer_tr_username = validated_data.pop("_validated_consumer_tr_username", "")

        entered_code = validated_data.get("coupon_code")
        pincode = (validated_data.get("pincode") or "").strip()
        # Default pincode from TR user if not provided
        if not pincode and tr_user is not None:
            try:
                pincode = getattr(tr_user, "pincode", "") or ""
            except Exception:
                pincode = ""
        # Fallback: default pincode from consumer if still empty
        if not pincode and user is not None:
            try:
                pincode = getattr(user, "pincode", "") or ""
            except Exception:
                pincode = ""
        # Determine routing agency for pending-agency visibility
        route_tr_user = tr_user
        try:
            def _is_agency(u):
                return (getattr(u, "role", None) == "agency") or str(getattr(u, "category", "")).startswith("agency")
            if not (route_tr_user and _is_agency(route_tr_user)):
                # Prefer agency from code_ref assignment
                if code_ref and getattr(code_ref, "assigned_agency_id", None):
                    route_tr_user = code_ref.assigned_agency
                elif pincode:
                    from accounts.models import CustomUser as CU
                    route_tr_user = CU.objects.filter(Q(role="agency") | Q(category__startswith="agency"), pincode=pincode).first()
        except Exception:
            # best-effort routing; leave as-is
            pass
        route_tr_username = getattr(route_tr_user, "username", tr_username)

        sub = CouponSubmission.objects.create(
            consumer=user,
            coupon=coupon,
            coupon_code=entered_code,  # store entered code (either code_ref.code or legacy coupon code)
            code_ref=code_ref,
            pincode=pincode,
            tr_user=route_tr_user,
            tr_username=route_tr_username,
            consumer_tr_username=consumer_tr_username,
            notes=validated_data.get("notes", ""),
            file=validated_data.get("file"),
            status="SUBMITTED",
        )

        # If a specific code instance was used, mark it SOLD
        if code_ref:
            code_ref.mark_sold()
            code_ref.save(update_fields=["status"])

        return sub


class CouponBatchSerializer(serializers.ModelSerializer):
    coupon_title = serializers.CharField(source="coupon.title", read_only=True)
    created_by_username = serializers.SerializerMethodField(read_only=True)
    count = serializers.IntegerField(read_only=True)

    class Meta:
        model = CouponBatch
        fields = [
            "id",
            "coupon",
            "coupon_title",
            "prefix",
            "serial_start",
            "serial_end",
            "serial_width",
            "count",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        read_only_fields = ["count", "created_by", "created_by_username", "created_at"]

    def get_created_by_username(self, obj):
        try:
            return obj.created_by.username if obj.created_by_id else None
        except Exception:
            return None


class CommissionSerializer(serializers.ModelSerializer):
    recipient_username = serializers.SerializerMethodField()
    coupon_code_value = serializers.SerializerMethodField()
    submission_id = serializers.IntegerField(source="submission.id", read_only=True)

    class Meta:
        model = Commission
        fields = [
            "id",
            "recipient",
            "recipient_username",
            "role",
            "amount",
            "status",
            "earned_at",
            "paid_at",
            "coupon_code",
            "coupon_code_value",
            "submission_id",
            "metadata",
        ]
        read_only_fields = ["earned_at", "paid_at"]

    def get_recipient_username(self, obj):
        try:
            return obj.recipient.username
        except Exception:
            return None

    def get_coupon_code_value(self, obj):
        try:
            return float(obj.coupon_code.value) if obj.coupon_code_id else None
        except Exception:
            return None


class AuditTrailSerializer(serializers.ModelSerializer):
    actor_username = serializers.SerializerMethodField()
    coupon_code_value = serializers.CharField(source="coupon_code.code", read_only=True)

    class Meta:
        model = AuditTrail
        fields = [
            "id",
            "action",
            "actor",
            "actor_username",
            "coupon_code",
            "coupon_code_value",
            "submission",
            "batch",
            "notes",
            "metadata",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_actor_username(self, obj):
        try:
            return obj.actor.username if obj.actor_id else None
        except Exception:
            return None


class ECouponPaymentConfigSerializer(serializers.ModelSerializer):
    upi_qr_image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ECouponPaymentConfig
        fields = [
            "id",
            "title",
            "upi_qr_image",
            "upi_qr_image_url",
            "upi_id",
            "payee_name",
            "instructions",
            "is_active",
            "created_by",
            "created_at",
        ]
        read_only_fields = ["created_by", "created_at"]

    def get_upi_qr_image_url(self, obj):
        try:
            request = self.context.get("request")
            if obj.upi_qr_image and hasattr(obj.upi_qr_image, "url"):
                url = obj.upi_qr_image.url
                return request.build_absolute_uri(url) if request else url
        except Exception:
            pass
        return None


class ECouponProductSerializer(serializers.ModelSerializer):
    coupon_title = serializers.CharField(source="coupon.title", read_only=True)

    class Meta:
        model = ECouponProduct
        fields = [
            "id",
            "coupon",
            "coupon_title",
            "denomination",
            "price_per_unit",
            "enable_consumer",
            "enable_agency",
            "enable_employee",
            "is_active",
            "max_per_order",
            "display_title",
            "display_desc",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate(self, attrs):
        denom = attrs.get("denomination", getattr(self.instance, "denomination", None))
        price = attrs.get("price_per_unit", getattr(self.instance, "price_per_unit", None))
        if denom is None:
            raise serializers.ValidationError({"denomination": "This field is required."})
        try:
            if denom <= 0:
                raise serializers.ValidationError({"denomination": "Must be > 0."})
        except Exception:
            raise serializers.ValidationError({"denomination": "Invalid value."})
        if price is None:
            # Default price to denomination if not provided
            attrs["price_per_unit"] = denom
        else:
            try:
                if price <= 0:
                    raise serializers.ValidationError({"price_per_unit": "Must be > 0."})
            except Exception:
                raise serializers.ValidationError({"price_per_unit": "Invalid value."})
        mpo = attrs.get("max_per_order", getattr(self.instance, "max_per_order", None))
        if mpo is not None and mpo <= 0:
            raise serializers.ValidationError({"max_per_order": "Must be positive when provided."})
        return attrs


class ECouponOrderSerializer(serializers.ModelSerializer):
    buyer_username = serializers.SerializerMethodField(read_only=True)
    product_title = serializers.CharField(source="product.display_title", read_only=True)
    reviewer_username = serializers.SerializerMethodField(read_only=True)
    payment_config_title = serializers.CharField(source="payment_config.title", read_only=True)

    class Meta:
        model = ECouponOrder
        fields = [
            "id",
            "buyer",
            "buyer_username",
            "role_at_purchase",
            "product",
            "product_title",
            "denomination_snapshot",
            "quantity",
            "amount_total",
            "payment_config",
            "payment_config_title",
            "payment_proof_file",
            "utr",
            "notes",
            "status",
            "reviewer",
            "reviewer_username",
            "reviewed_at",
            "review_note",
            "allocated_count",
            "allocated_sample_codes",
            "created_at",
        ]
        read_only_fields = [
            "buyer",
            "buyer_username",
            "role_at_purchase",
            "denomination_snapshot",
            "amount_total",
            "payment_config",
            "status",
            "reviewer",
            "reviewer_username",
            "reviewed_at",
            "review_note",
            "allocated_count",
            "allocated_sample_codes",
            "created_at",
        ]

    def get_buyer_username(self, obj):
        try:
            return obj.buyer.username
        except Exception:
            return None

    def get_reviewer_username(self, obj):
        try:
            return obj.reviewer.username if obj.reviewer_id else None
        except Exception:
            return None
