from django.contrib import admin
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Q
import csv

from .models import BusinessRegistration, CommissionConfig, AutoPoolAccount
from accounts.models import CustomUser


@admin.register(BusinessRegistration)
class BusinessRegistrationAdmin(admin.ModelAdmin):
    """
    Dedicated admin for Business Registrations (separate app):
    - Shows business profile fields
    - Allows inline forwarding assignment (forwarded_to) and status change
    - Provides actions to export CSV and mark as forwarded
    """
    list_display = (
        'unique_id',
        'business_name', 'business_category', 'business_address',
        'full_name', 'email', 'phone',
        'country', 'state', 'city', 'pincode',
        'sponsor_id',
        'review_status', 'forwarded_to', 'forwarded_at',
        'registered_by', 'created_at'
    )
    search_fields = (
        'unique_id',
        'business_name', 'business_category', 'business_address',
        'full_name', 'email', 'phone', 'pincode', 'sponsor_id'
    )
    list_filter = ('review_status', 'country', 'state', 'created_at')
    list_select_related = ('country', 'state', 'city', 'registered_by', 'forwarded_to')
    ordering = ('-created_at',)
    raw_id_fields = ('country', 'state', 'city', 'registered_by', 'forwarded_to')
    list_display_links = ('unique_id', 'business_name')
    list_editable = ('review_status', 'forwarded_to')
    actions = ['export_as_csv', 'mark_as_forwarded']

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'forwarded_to':
            qs = CustomUser.objects.filter(Q(role='agency') | Q(category__startswith='agency_'))
            kwargs['queryset'] = qs
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def export_as_csv(self, request, queryset):
        """
        Download selected Business Registrations as CSV for forwarding to concerned agency.
        """
        response = HttpResponse(content_type='text/csv')
        filename = f"business_registrations_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        writer = csv.writer(response)
        writer.writerow([
            'unique_id',
            'business_name', 'business_category', 'business_address',
            'full_name', 'email', 'phone',
            'country', 'state', 'city', 'pincode',
            'sponsor_id',
            'review_status', 'forwarded_to', 'forwarded_at',
            'registered_by', 'created_at'
        ])
        for r in queryset:
            writer.writerow([
                r.unique_id,
                r.business_name, r.business_category, r.business_address,
                r.full_name, r.email, r.phone,
                str(getattr(r, 'country', '') or ''), str(getattr(r, 'state', '') or ''), str(getattr(r, 'city', '') or ''),
                r.pincode,
                r.sponsor_id,
                r.review_status, getattr(r.forwarded_to, 'username', None), r.forwarded_at,
                getattr(r.registered_by, 'username', None), r.created_at
            ])
        return response
    export_as_csv.short_description = "Download selected as CSV"

    def mark_as_forwarded(self, request, queryset):
        """
        Mark selected registrations as forwarded and stamp forwarded_at.
        Note: You can set 'forwarded_to' inline via the table (list_editable).
        """
        updated = queryset.update(review_status='forwarded', forwarded_at=timezone.now())
        self.message_user(request, f"Marked {updated} registration(s) as forwarded.")
    mark_as_forwarded.short_description = "Mark selected as Forwarded"


@admin.register(CommissionConfig)
class CommissionConfigAdmin(admin.ModelAdmin):
    list_display = ("base_coupon_value", "enable_pool_distribution", "enable_geo_distribution", "updated_at", "created_at")
    readonly_fields = ("updated_at", "created_at")
    fieldsets = (
        ("Base", {"fields": ("base_coupon_value",)}),
        ("Toggles", {"fields": ("enable_pool_distribution", "enable_geo_distribution")}),
        ("Hierarchical L1-L5", {"fields": ("l1_percent", "l2_percent", "l3_percent", "l4_percent", "l5_percent")}),
        ("Geo Distribution", {"fields": (
            "sub_franchise_percent",
            "pincode_percent",
            "pincode_coord_percent",
            "district_percent",
            "district_coord_percent",
            "state_percent",
            "state_coord_percent",
            "employee_percent",
            "royalty_percent",
        )}),
        ("Audit", {"fields": ("updated_at", "created_at")}),
    )


@admin.register(AutoPoolAccount)
class AutoPoolAccountAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "username_key", "entry_amount", "status", "level", "created_at")
    list_filter = ("status",)
    search_fields = ("username_key", "owner__username")
    raw_id_fields = ("owner", "parent_account")
    ordering = ("-created_at",)
