from django.contrib import admin, messages
from django.conf import settings
from django import forms
from django.contrib.admin.helpers import ActionForm
from django.db import transaction
from django.db.models import Q

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

# Hide coupons-related models from Django Admin unless explicitly enabled.
# Set HIDE_COUPONS_IN_ADMIN = False in settings.py to re-enable these admin screens.
HIDE_COUPONS_IN_ADMIN = getattr(settings, "HIDE_COUPONS_IN_ADMIN", True)


class CouponAdminActionForm(ActionForm):
    """
    Extra fields shown above the action dropdown on list pages. Actions can read these values
    from request.POST to perform bulk operations (generate codes, assign agency/employee, ranges).
    """
    issued_channel = forms.ChoiceField(
        choices=(("physical", "Physical"), ("e_coupon", "E-Coupon")),
        required=False,
        help_text="Channel for generated codes (default: E-Coupon).",
    )
    agency = forms.ModelChoiceField(
        queryset=CustomUser.objects.none(),
        required=False,
        help_text="Target agency for assignment actions.",
    )
    employee = forms.ModelChoiceField(
        queryset=CustomUser.objects.none(),
        required=False,
        help_text="Target employee for assignment actions.",
    )
    serial_start = forms.IntegerField(required=False, min_value=1)
    serial_end = forms.IntegerField(required=False, min_value=1)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Populate dynamic querysets
        self.fields["agency"].queryset = CustomUser.objects.filter(
            Q(role="agency") | Q(category__startswith="agency")
        ).order_by("username")
        self.fields["employee"].queryset = CustomUser.objects.filter(
            Q(role="employee") | Q(category="employee")
        ).order_by("username")


if not HIDE_COUPONS_IN_ADMIN:

    @admin.register(Coupon)
    class CouponAdmin(admin.ModelAdmin):
        list_display = ("code", "title", "campaign", "issuer", "is_active", "valid_from", "valid_to", "created_at")
        list_filter = ("is_active", "campaign", "created_at")
        search_fields = ("code", "title", "campaign", "issuer__username")
        ordering = ("-created_at",)

    @admin.register(CouponAssignment)
    class CouponAssignmentAdmin(admin.ModelAdmin):
        list_display = ("coupon", "employee", "assigned_by", "status", "assigned_at")
        list_filter = ("status", "assigned_at")
        search_fields = ("coupon__code", "employee__username", "assigned_by__username")
        autocomplete_fields = ("coupon", "employee", "assigned_by")
        ordering = ("-assigned_at",)

    @admin.register(CouponCode)
    class CouponCodeAdmin(admin.ModelAdmin):
        list_display = ("code", "coupon", "issued_channel", "assigned_agency", "assigned_employee", "batch", "serial", "value", "issued_by", "status", "created_at")
        list_filter = ("issued_channel", "status", "created_at", "batch")
        search_fields = ("code", "coupon__title", "assigned_employee__username", "assigned_agency__username", "issued_by__username")
        autocomplete_fields = ("coupon", "assigned_employee", "assigned_agency", "issued_by", "batch")
        ordering = ("-created_at",)

        action_form = CouponAdminActionForm
        actions = ["assign_selected_to_agency", "assign_selected_to_employee", "revoke_selected_codes"]

        @admin.action(description="Assign selected codes to Agency (sets status=ASSIGNED_AGENCY)")
        def assign_selected_to_agency(self, request, queryset):
            form = CouponAdminActionForm(request.POST)
            if not form.is_valid():
                messages.error(request, "Invalid action form data.")
                return
            agency = form.cleaned_data.get("agency")
            if not agency:
                messages.error(request, "Please select an Agency in the action form.")
                return

            # Only move codes that are not revoked/redeemed and not already sold
            qs = queryset.filter(status__in=["AVAILABLE", "ASSIGNED_AGENCY"])
            updated = qs.update(assigned_agency=agency, assigned_employee=None, status="ASSIGNED_AGENCY")
            if updated:
                AuditTrail.objects.create(
                    action="admin_assign_codes_to_agency",
                    actor=getattr(request, "user", None),
                    notes=f"Assigned {updated} selected codes to agency {agency.username}",
                    metadata={"agency_id": agency.id, "code_ids": list(qs.values_list("id", flat=True)[:1000])},
                )
            messages.success(request, f"Assigned {updated} code(s) to {agency.username}.")

        @admin.action(description="Assign selected codes to Employee (requires codes owned by an Agency; sets status=ASSIGNED_EMPLOYEE)")
        def assign_selected_to_employee(self, request, queryset):
            form = CouponAdminActionForm(request.POST)
            if not form.is_valid():
                messages.error(request, "Invalid action form data.")
                return
            employee = form.cleaned_data.get("employee")
            if not employee:
                messages.error(request, "Please select an Employee in the action form.")
                return

            # Only allow delegating from agency-owned pool
            qs = queryset.filter(
                assigned_agency__isnull=False,
                status__in=["ASSIGNED_AGENCY", "AVAILABLE"],
            )
            updated = qs.update(assigned_employee=employee, status="ASSIGNED_EMPLOYEE")
            if updated:
                AuditTrail.objects.create(
                    action="admin_assign_codes_to_employee",
                    actor=getattr(request, "user", None),
                    notes=f"Assigned {updated} selected codes to employee {employee.username}",
                    metadata={"employee_id": employee.id, "code_ids": list(qs.values_list("id", flat=True)[:1000])},
                )
            messages.success(request, f"Assigned {updated} code(s) to employee {employee.username}.")

        @admin.action(description="Revoke selected codes (sets status=REVOKED)")
        def revoke_selected_codes(self, request, queryset):
            # This is a blunt tool; use carefully
            qs = queryset.exclude(status="REVOKED")
            updated = qs.update(status="REVOKED")
            if updated:
                AuditTrail.objects.create(
                    action="admin_revoke_codes",
                    actor=getattr(request, "user", None),
                    notes=f"Revoked {updated} selected codes",
                    metadata={"code_ids": list(qs.values_list("id", flat=True)[:1000])},
                )
            messages.warning(request, f"Revoked {updated} code(s).")

    @admin.register(CouponSubmission)
    class CouponSubmissionAdmin(admin.ModelAdmin):
        list_display = (
            "coupon_code",
            "consumer",
            "pincode",
            "status",
            "employee_reviewer",
            "employee_reviewed_at",
            "agency_reviewer",
            "agency_reviewed_at",
            "created_at",
        )
        list_filter = ("status", "pincode", "created_at")
        search_fields = ("coupon_code", "consumer__username", "employee_reviewer__username", "agency_reviewer__username")
        autocomplete_fields = ("consumer", "coupon", "employee_reviewer", "agency_reviewer", "code_ref")
        date_hierarchy = "created_at"
        ordering = ("-created_at",)

    @admin.register(CouponBatch)
    class CouponBatchAdmin(admin.ModelAdmin):
        list_display = ("id", "coupon", "prefix", "serial_start", "serial_end", "serial_width", "created_by", "created_at")
        search_fields = ("prefix", "coupon__title")
        list_filter = ("created_at",)
        autocomplete_fields = ("coupon", "created_by")
        ordering = ("-created_at",)

        action_form = CouponAdminActionForm
        actions = ["generate_e_coupon_codes", "assign_range_to_agency"]

        @admin.action(description="Generate codes for selected batches (default: E-Coupon channel)")
        def generate_e_coupon_codes(self, request, queryset):
            form = CouponAdminActionForm(request.POST)
            form.is_valid()  # best effort; we'll default if missing
            issued_channel = (form.cleaned_data or {}).get("issued_channel") or "e_coupon"
            issued_channel = str(issued_channel).lower()
            if issued_channel not in ("physical", "e_coupon"):
                issued_channel = "e_coupon"

            total_created = 0
            with transaction.atomic():
                for batch in queryset:
                    try:
                        start = int(batch.serial_start)
                        end = int(batch.serial_end)
                        width = int(batch.serial_width or 4)
                        prefix = (batch.prefix or "").strip()
                    except Exception:
                        messages.error(request, f"Invalid serial configuration for batch {batch.id}.")
                        continue

                    # Build desired codes
                    desired_codes = [f"{prefix}{str(s).zfill(width)}" for s in range(start, end + 1)]
                    existing = set(CouponCode.objects.filter(code__in=desired_codes).values_list("code", flat=True))
                    to_insert = []
                    for s in range(start, end + 1):
                        code_str = f"{prefix}{str(s).zfill(width)}"
                        if code_str in existing:
                            continue
                        to_insert.append(CouponCode(
                            code=code_str,
                            coupon=batch.coupon,
                            issued_channel=issued_channel,
                            assigned_employee=None,
                            assigned_agency=None,
                            batch=batch,
                            serial=s,
                            value=150,
                            issued_by=getattr(request, "user", None),
                            status="AVAILABLE",
                        ))
                    if to_insert:
                        CouponCode.objects.bulk_create(to_insert, batch_size=1000)
                        total_created += len(to_insert)
                        AuditTrail.objects.create(
                            action="admin_generate_codes",
                            actor=getattr(request, "user", None),
                            batch=batch,
                            notes=f"Generated {len(to_insert)} codes (channel={issued_channel})",
                            metadata={
                                "prefix": prefix,
                                "range": [start, end],
                                "width": width,
                                "issued_channel": issued_channel,
                            },
                        )
            if total_created:
                messages.success(request, f"Generated {total_created} code(s) across selected batches.")
            else:
                messages.info(request, "No new codes were generated (possibly already exist).")

        @admin.action(description="Assign serial range of selected batch(es) to Agency (sets status=ASSIGNED_AGENCY)")
        def assign_range_to_agency(self, request, queryset):
            form = CouponAdminActionForm(request.POST)
            if not form.is_valid():
                messages.error(request, "Invalid action form data.")
                return
            agency = form.cleaned_data.get("agency")
            s_start = form.cleaned_data.get("serial_start")
            s_end = form.cleaned_data.get("serial_end")

            if not agency:
                messages.error(request, "Please select an Agency in the action form.")
                return

            total_updated = 0
            with transaction.atomic():
                for batch in queryset:
                    qs = CouponCode.objects.filter(batch=batch, status__in=["AVAILABLE", "ASSIGNED_AGENCY"])
                    if s_start is not None and s_end is not None:
                        if s_start > s_end:
                            messages.error(request, f"Invalid range for batch {batch.id}: start > end.")
                            continue
                        qs = qs.filter(serial__gte=s_start, serial__lte=s_end)
                    updated = qs.update(assigned_agency=agency, assigned_employee=None, status="ASSIGNED_AGENCY")
                    total_updated += updated
                    if updated:
                        AuditTrail.objects.create(
                            action="admin_assign_range_to_agency",
                            actor=getattr(request, "user", None),
                            batch=batch,
                            notes=f"Assigned {updated} codes to {agency.username}",
                            metadata={
                                "agency_id": agency.id,
                                "serial_range": [s_start, s_end] if (s_start is not None and s_end is not None) else None,
                            },
                        )
            messages.success(request, f"Assigned {total_updated} code(s) to agency {agency.username}.")

    @admin.register(Commission)
    class CommissionAdmin(admin.ModelAdmin):
        list_display = ("recipient", "role", "amount", "status", "earned_at", "paid_at", "coupon_code", "submission")
        list_filter = ("role", "status", "earned_at", "paid_at")
        search_fields = ("recipient__username", "coupon_code__code", "submission__coupon_code")
        autocomplete_fields = ("recipient", "coupon_code", "submission")
        ordering = ("-earned_at",)

    @admin.register(AuditTrail)
    class AuditTrailAdmin(admin.ModelAdmin):
        list_display = ("action", "actor", "coupon_code", "submission", "batch", "created_at")
        list_filter = ("action", "created_at")
        search_fields = ("coupon_code__code", "submission__coupon_code", "actor__username")
        autocomplete_fields = ("actor", "coupon_code", "submission", "batch")
        date_hierarchy = "created_at"
        ordering = ("-created_at",)
