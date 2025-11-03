from django.contrib import admin
from django.utils.html import format_html
from django.db import connection
from django.db.utils import OperationalError, ProgrammingError

from .models import FileUpload, DashboardCard, LuckyDrawSubmission, JobApplication, HomeCard, AgencyCouponQuota


def is_agency_staff(user):
    return bool(getattr(user, "is_staff", False) and getattr(user, "role", None) == "agency")


def agency_pin(user):
    return (getattr(user, "pincode", "") or "").strip().lower()


@admin.register(FileUpload)
class FileUploadAdmin(admin.ModelAdmin):
    list_display = ("id", "file_thumb", "title", "user", "user_pincode", "user_city", "user_state", "user_country", "file", "created_at")
    list_filter = ("created_at", "user")
    search_fields = ("title", "user__username")
    ordering = ("-created_at",)

    def file_thumb(self, obj):
        try:
            f = getattr(obj, "file", None)
            url = getattr(f, "url", None)
            name = getattr(f, "name", "") or ""
            if url and str(name).lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
                return format_html('<img src="{}" style="height:60px;width:auto;border-radius:4px;" />', url)
        except Exception:
            pass
        return "-"
    file_thumb.short_description = "File"

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if is_agency_staff(request.user):
            pin = agency_pin(request.user)
            if pin:
                return qs.filter(user__pincode__iexact=pin)
            return qs.none()
        return qs.none()

    # Admin module visibility and perms in index/sidebar
    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)

    def get_model_perms(self, request):
        if request.user.is_superuser:
            return super().get_model_perms(request)
        if is_agency_staff(request.user):
            return {"add": True, "change": True, "delete": True, "view": True}
        return {"add": False, "change": False, "delete": False, "view": False}

    # Object/page-level permissions
    def has_view_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)

    def has_add_permission(self, request):
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if is_agency_staff(request.user):
            if obj is None:
                return True
            user_pin = agency_pin(request.user)
            obj_pin = (getattr(getattr(obj, "user", None), "pincode", "") or "").strip().lower()
            return bool(user_pin) and user_pin == obj_pin
        return False

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if is_agency_staff(request.user):
            if obj is None:
                return True
            user_pin = agency_pin(request.user)
            obj_pin = (getattr(getattr(obj, "user", None), "pincode", "") or "").strip().lower()
            return bool(user_pin) and user_pin == obj_pin
        return False

    def get_readonly_fields(self, request, obj=None):
        base = ("file_thumb",)
        if request.user.is_superuser:
            ro = super().get_readonly_fields(request, obj)
            return tuple(ro) + base if isinstance(ro, (list, tuple)) else base
        if is_agency_staff(request.user):
            return ("created_at",) + base
        ro = super().get_readonly_fields(request, obj)
        return tuple(ro) + base if isinstance(ro, (list, tuple)) else base

    def user_pincode(self, obj):
        user = getattr(obj, "user", None)
        return getattr(user, "pincode", "") if user else ""

    def user_city(self, obj):
        user = getattr(obj, "user", None)
        city = getattr(user, "city", None) if user else None
        return getattr(city, "name", str(city)) if city else ""

    def user_state(self, obj):
        user = getattr(obj, "user", None)
        state = getattr(user, "state", None) if user else None
        return getattr(state, "name", str(state)) if state else ""

    def user_country(self, obj):
        user = getattr(obj, "user", None)
        country = getattr(user, "country", None) if user else None
        return getattr(country, "name", str(country)) if country else ""


@admin.register(DashboardCard)
class DashboardCardAdmin(admin.ModelAdmin):
    list_display = ("id", "image_thumb", "key", "title", "is_active", "route", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("key", "title", "route")
    ordering = ("-updated_at", "-created_at")
    readonly_fields = ("image_thumb",)

    def image_thumb(self, obj):
        try:
            img = getattr(obj, "image", None)
            url = getattr(img, "url", None)
            if url:
                return format_html('<img src="{}" style="height:60px;width:auto;border-radius:4px;" />', url)
        except Exception:
            pass
        return "-"
    image_thumb.short_description = "Image"

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)

    def get_model_perms(self, request):
        if request.user.is_superuser:
            return super().get_model_perms(request)
        if is_agency_staff(request.user):
            # Cards are global configuration; grant full CRUD if agency must have write/read/view.
            return {"add": True, "change": True, "delete": True, "view": True}
        return {"add": False, "change": False, "delete": False, "view": False}

    def has_view_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)

    def has_add_permission(self, request):
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)


@admin.register(HomeCard)
class HomeCardAdmin(admin.ModelAdmin):
    list_display = ("id", "image_thumb", "title", "order", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("title",)
    ordering = ("order", "-created_at")
    readonly_fields = ("image_thumb",)

    def image_thumb(self, obj):
        try:
            img = getattr(obj, "image", None)
            url = getattr(img, "url", None)
            if url:
                return format_html('<img src="{}" style="height:60px;width:auto;border-radius:4px;" />', url)
        except Exception:
            pass
        return "-"
    image_thumb.short_description = "Image"

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)

    def get_model_perms(self, request):
        if request.user.is_superuser:
            return super().get_model_perms(request)
        if is_agency_staff(request.user):
            return {"add": True, "change": True, "delete": True, "view": True}
        return {"add": False, "change": False, "delete": False, "view": False}

    def has_view_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)

    def has_add_permission(self, request):
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)


@admin.register(LuckyDrawSubmission)
class LuckyDrawSubmissionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "username",
        "role",
        "phone",
        "sl_number",
        "ledger_number",
        "pincode",
        "coupon_purchaser_name",
        "purchase_date",
        "address",
        "referral_name",
        "referral_id",
        "agency_name",
        "agency_pincode",
        "tr_referral_id",
        "tr_emp_id",
        "user_city",
        "user_state",
        "user_country",
        "image_thumb",
        "created_at",
    )
    list_filter = ("role", "created_at")
    search_fields = ("username", "sl_number", "ledger_number", "pincode", "phone")
    ordering = ("-created_at",)
    readonly_fields = getattr(locals(), "readonly_fields", tuple()) + ("image_thumb",)

    def image_thumb(self, obj):
        try:
            img = getattr(obj, "image", None)
            url = getattr(img, "url", None)
            if url:
                return format_html('<img src="{}" style="height:60px;width:auto;border-radius:4px;" />', url)
        except Exception:
            pass
        return "-"
    image_thumb.short_description = "Image"

    def user_city(self, obj):
        user = getattr(obj, "user", None)
        city = getattr(user, "city", None) if user else None
        return getattr(city, "name", str(city)) if city else ""

    def user_state(self, obj):
        user = getattr(obj, "user", None)
        state = getattr(user, "state", None) if user else None
        return getattr(state, "name", str(state)) if state else ""

    def user_country(self, obj):
        user = getattr(obj, "user", None)
        country = getattr(user, "country", None) if user else None
        return getattr(country, "name", str(country)) if country else ""

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if is_agency_staff(request.user):
            pin = agency_pin(request.user)
            if pin:
                return qs.filter(pincode__iexact=pin)
            return qs.none()
        return qs.none()

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)

    def get_model_perms(self, request):
        if request.user.is_superuser:
            return super().get_model_perms(request)
        if is_agency_staff(request.user):
            return {"add": True, "change": True, "delete": True, "view": True}
        return {"add": False, "change": False, "delete": False, "view": False}

    def has_view_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)

    def has_add_permission(self, request):
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if is_agency_staff(request.user):
            if obj is None:
                return True
            user_pin = agency_pin(request.user)
            obj_pin = (getattr(obj, "pincode", "") or "").strip().lower()
            return bool(user_pin) and user_pin == obj_pin
        return False

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if is_agency_staff(request.user):
            if obj is None:
                return True
            user_pin = agency_pin(request.user)
            obj_pin = (getattr(obj, "pincode", "") or "").strip().lower()
            return bool(user_pin) and user_pin == obj_pin
        return False


class JobApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "full_name", "email", "employment_type", "pincode", "city", "state", "user_country", "created_at")
    list_filter = ("employment_type", "created_at")
    search_fields = ("full_name", "email", "user__username", "pincode")
    ordering = ("-created_at",)

    def user_country(self, obj):
        user = getattr(obj, "user", None)
        country = getattr(user, "country", None) if user else None
        return getattr(country, "name", str(country)) if country else ""

    def _table_exists(self):
        try:
            tables = connection.introspection.table_names()
            return JobApplication._meta.db_table in tables
        except Exception:
            return False

    def get_queryset(self, request):
        try:
            if not self._table_exists():
                return JobApplication.objects.none()
            qs = super().get_queryset(request)
            if request.user.is_superuser:
                return qs
            if is_agency_staff(request.user):
                pin = agency_pin(request.user)
                if pin:
                    return qs.filter(pincode__iexact=pin)
                return JobApplication.objects.none()
            return JobApplication.objects.none()
        except (OperationalError, ProgrammingError):
            return JobApplication.objects.none()

    def has_module_permission(self, request):
        if not self._table_exists():
            return False
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)

    def get_model_perms(self, request):
        if not self._table_exists():
            return {"add": False, "change": False, "delete": False, "view": False}
        if request.user.is_superuser:
            return super().get_model_perms(request)
        if is_agency_staff(request.user):
            return {"add": True, "change": True, "delete": True, "view": True}
        return {"add": False, "change": False, "delete": False, "view": False}

    def has_view_permission(self, request, obj=None):
        if not self._table_exists():
            return False
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)

    def has_add_permission(self, request):
        if not self._table_exists():
            return False
        if request.user.is_superuser:
            return True
        return is_agency_staff(request.user)

    def has_change_permission(self, request, obj=None):
        if not self._table_exists():
            return False
        if request.user.is_superuser:
            return True
        if is_agency_staff(request.user):
            if obj is None:
                return True
            user_pin = agency_pin(request.user)
            obj_pin = (getattr(obj, "pincode", "") or "").strip().lower()
            return bool(user_pin) and user_pin == obj_pin
        return False

    def has_delete_permission(self, request, obj=None):
        if not self._table_exists():
            return False
        if request.user.is_superuser:
            return True
        if is_agency_staff(request.user):
            if obj is None:
                return True
            user_pin = agency_pin(request.user)
            obj_pin = (getattr(obj, "pincode", "") or "").strip().lower()
            return bool(user_pin) and user_pin == obj_pin
        return False

    def changelist_view(self, request, extra_context=None):
        if not self._table_exists():
            from django.http import HttpResponse
            return HttpResponse("JobApplication table is not migrated yet.", status=503)
        return super().changelist_view(request, extra_context)


@admin.register(AgencyCouponQuota)
class AgencyCouponQuotaAdmin(admin.ModelAdmin):
    list_display = ("agency", "quota", "updated_at", "created_at")
    search_fields = ("agency__username", "agency__pincode")
    autocomplete_fields = ("agency",)
    ordering = ("-updated_at",)

# Conditionally register JobApplication admin only if the DB table exists
try:
    tables = connection.introspection.table_names()
    if JobApplication._meta.db_table in tables:
        admin.site.register(JobApplication, JobApplicationAdmin)
except Exception:
    # During migrations or initial setup, table may not exist; skip registration
    pass
