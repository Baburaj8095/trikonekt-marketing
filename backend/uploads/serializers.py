from rest_framework import serializers
from .models import FileUpload, DashboardCard, LuckyDrawSubmission, JobApplication, HomeCard, LuckyCouponAssignment


class FileUploadSerializer(serializers.ModelSerializer):
    user_pincode = serializers.SerializerMethodField()
    user_city = serializers.SerializerMethodField()
    user_state = serializers.SerializerMethodField()
    user_country = serializers.SerializerMethodField()

    class Meta:
        model = FileUpload
        fields = "__all__"
        read_only_fields = ["user"]

    def get_user_pincode(self, obj):
        return getattr(getattr(obj, "user", None), "pincode", "") or ""

    def get_user_city(self, obj):
        city = getattr(getattr(obj, "user", None), "city", None)
        return getattr(city, "name", str(city)) if city else ""

    def get_user_state(self, obj):
        state = getattr(getattr(obj, "user", None), "state", None)
        return getattr(state, "name", str(state)) if state else ""

    def get_user_country(self, obj):
        country = getattr(getattr(obj, "user", None), "country", None)
        return getattr(country, "name", str(country)) if country else ""


class HomeCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = HomeCard
        fields = ["id", "title", "image", "order", "is_active", "created_at"]


class DashboardCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = DashboardCard
        fields = ["id", "key", "title", "description", "route", "role", "image", "is_active"]


class LuckyDrawSubmissionSerializer(serializers.ModelSerializer):
    user_city = serializers.SerializerMethodField()
    user_state = serializers.SerializerMethodField()
    user_country = serializers.SerializerMethodField()
    assigned_tre_username = serializers.SerializerMethodField()

    class Meta:
        model = LuckyDrawSubmission
        fields = [
            "id",
            "user",
            "username",
            "role",
            "phone",
            "sl_number",
            "ledger_number",
            "pincode",
            # New fields from UI
            "coupon_purchaser_name",
            "purchase_date",
            "address",
            "referral_name",
            "referral_id",
            "agency_name",
            "agency_pincode",
            "tr_referral_id",
            "tr_emp_id",
            # Workflow/assignment
            "status",
            "assigned_tre",
            "assigned_tre_username",
            "tre_reviewer",
            "tre_reviewed_at",
            "tre_comment",
            "agency_reviewer",
            "agency_reviewed_at",
            "agency_comment",
            # Derived user location for convenience
            "user_city",
            "user_state",
            "user_country",
            "image",
            "created_at",
        ]
        read_only_fields = [
            "user",
            "username",
            "role",
            "created_at",
            "status",
            "assigned_tre",
            "tre_reviewer",
            "tre_reviewed_at",
            "agency_reviewer",
            "agency_reviewed_at",
        ]

    def validate_image(self, value):
        if not value:
            raise serializers.ValidationError("Image is required.")
        content_type = getattr(value, "content_type", None)
        if content_type and not content_type.startswith("image/"):
            raise serializers.ValidationError("Only image files are allowed.")
        return value

    def get_user_city(self, obj):
        city = getattr(getattr(obj, "user", None), "city", None)
        return getattr(city, "name", str(city)) if city else ""

    def get_user_state(self, obj):
        state = getattr(getattr(obj, "user", None), "state", None)
        return getattr(state, "name", str(state)) if state else ""

    def get_user_country(self, obj):
        country = getattr(getattr(obj, "user", None), "country", None)
        return getattr(country, "name", str(country)) if country else ""

    def get_assigned_tre_username(self, obj):
        tre = getattr(obj, "assigned_tre", None)
        return getattr(tre, "username", "") if tre else ""


class JobApplicationSerializer(serializers.ModelSerializer):
    user_country = serializers.SerializerMethodField()

    class Meta:
        model = JobApplication
        fields = "__all__"
        read_only_fields = ["user"]

    def get_user_country(self, obj):
        country = getattr(getattr(obj, "user", None), "country", None)
        return getattr(country, "name", str(country)) if country else ""


class LuckyCouponAssignmentSerializer(serializers.ModelSerializer):
    employee_username = serializers.SerializerMethodField()
    employee_full_name = serializers.SerializerMethodField()
    employee_email = serializers.SerializerMethodField()
    employee_phone = serializers.SerializerMethodField()
    employee_pincode = serializers.SerializerMethodField()
    created_by_username = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()

    class Meta:
        model = LuckyCouponAssignment
        fields = [
            "id",
            "employee",
            "employee_username",
            "employee_full_name",
            "employee_email",
            "employee_phone",
            "employee_pincode",
            "quantity",
            "sold_count",
            "remaining",
            "channel",
            "note",
            "created_by_username",
            "created_at",
        ]
        read_only_fields = ["created_by_username", "created_at"]

    def get_employee_username(self, obj):
        return getattr(getattr(obj, "employee", None), "username", "")

    def get_employee_full_name(self, obj):
        return getattr(getattr(obj, "employee", None), "full_name", "") or ""

    def get_employee_email(self, obj):
        return getattr(getattr(obj, "employee", None), "email", "") or ""

    def get_employee_phone(self, obj):
        return getattr(getattr(obj, "employee", None), "phone", "") or ""

    def get_employee_pincode(self, obj):
        return getattr(getattr(obj, "employee", None), "pincode", "") or ""

    def get_created_by_username(self, obj):
        return getattr(getattr(obj, "created_by", None), "username", "") or ""

    def get_remaining(self, obj):
        try:
            qty = int(getattr(obj, "quantity", 0) or 0)
            sold = int(getattr(obj, "sold_count", 0) or 0)
            rem = qty - sold
            return rem if rem > 0 else 0
        except Exception:
            return 0
