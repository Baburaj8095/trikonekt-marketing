from django.contrib import admin
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Q
import csv

from .models import BusinessRegistration, CommissionConfig, AutoPoolAccount, RewardProgress, RewardRedemption, UserMatrixProgress, ReferralJoinPayout, FranchisePayout, DailyReport, WithholdingReserve
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
    list_display = ("base_coupon_value", "enable_pool_distribution", "enable_geo_distribution", "enable_franchise_on_join", "enable_franchise_on_purchase", "autopool_trigger_on_direct_referral", "updated_at", "created_at")
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
        ("Trikonekt Toggles", {"fields": ("enable_franchise_on_join", "enable_franchise_on_purchase", "autopool_trigger_on_direct_referral")}),
        ("Trikonekt Fixed Amounts", {"fields": ("franchise_fixed_json", "referral_join_fixed_json", "three_matrix_amounts_json", "five_matrix_amounts_json")}),
        ("Audit", {"fields": ("updated_at", "created_at")}),
    )


@admin.register(AutoPoolAccount)
class AutoPoolAccountAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "username_key", "pool_type", "entry_amount", "status", "level", "created_at")
    list_filter = ("pool_type", "status")
    search_fields = ("username_key", "owner__username")
    raw_id_fields = ("owner", "parent_account")
    ordering = ("-created_at",)


@admin.register(RewardProgress)
class RewardProgressAdmin(admin.ModelAdmin):
    list_display = ("user", "coupon_count", "updated_at", "created_at")
    search_fields = ("user__username",)
    raw_id_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")
    actions = ["reset_coupons"]

    def reset_coupons(self, request, queryset):
        updated = 0
        for rp in queryset:
            try:
                rp.coupon_count = 0
                rp.save(update_fields=["coupon_count", "updated_at"])
                updated += 1
            except Exception:
                continue
        self.message_user(request, f"Reset coupons for {updated} user(s).")
    reset_coupons.short_description = "Reset coupon counts to 0"


@admin.register(RewardRedemption)
class RewardRedemptionAdmin(admin.ModelAdmin):
    list_display = ("user", "reward_key", "coupons_spent", "status", "requested_at", "decided_by", "decided_at")
    list_filter = ("status", "reward_key", "requested_at")
    search_fields = ("user__username",)
    raw_id_fields = ("user", "decided_by")
    readonly_fields = ("requested_at", "decided_at")
    actions = ["approve_selected", "reject_selected"]

    def approve_selected(self, request, queryset):
        from django.utils import timezone
        updated = 0
        for rr in queryset:
            try:
                if rr.status == "requested":
                    rr.status = "approved"
                    rr.decided_by = request.user
                    rr.decided_at = timezone.now()
                    rr.save(update_fields=["status", "decided_by", "decided_at"])
                    updated += 1
            except Exception:
                continue
        self.message_user(request, f"Approved {updated} redemption(s).")
    approve_selected.short_description = "Approve selected redemptions"

    def reject_selected(self, request, queryset):
        from django.utils import timezone
        updated = 0
        for rr in queryset:
            try:
                if rr.status == "requested":
                    rr.status = "rejected"
                    rr.decided_by = request.user
                    rr.decided_at = timezone.now()
                    rr.save(update_fields=["status", "decided_by", "decided_at"])
                    updated += 1
            except Exception:
                continue
        self.message_user(request, f"Rejected {updated} redemption(s).")
    reject_selected.short_description = "Reject selected redemptions"


@admin.register(UserMatrixProgress)
class UserMatrixProgressAdmin(admin.ModelAdmin):
    list_display = ("user", "pool_type", "total_earned", "level_reached", "updated_at")
    list_filter = ("pool_type",)
    search_fields = ("user__username",)
    raw_id_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(ReferralJoinPayout)
class ReferralJoinPayoutAdmin(admin.ModelAdmin):
    list_display = ("user_new", "source_type", "source_id", "created_at")
    search_fields = ("user_new__username", "source_id")
    raw_id_fields = ("user_new",)
    readonly_fields = ("created_at",)


@admin.register(FranchisePayout)
class FranchisePayoutAdmin(admin.ModelAdmin):
    list_display = ("user_new", "trigger", "source_type", "source_id", "created_at")
    list_filter = ("trigger",)
    search_fields = ("user_new__username", "source_id")
    raw_id_fields = ("user_new",)
    readonly_fields = ("created_at",)


@admin.register(DailyReport)
class DailyReportAdmin(admin.ModelAdmin):
    list_display = (
        "date", "reporter", "role",
        "tr_registered", "wg_registered", "asia_pay_registered", "dm_account_registered",
        "e_coupon_issued", "physical_coupon_issued", "product_sold", "total_amount",
    )
    list_filter = ("role", "date")
    search_fields = ("reporter__username",)
    raw_id_fields = ("reporter",)
    ordering = ("-date", "-id")


@admin.register(WithholdingReserve)
class WithholdingReserveAdmin(admin.ModelAdmin):
    list_display = ("user", "source_type", "source_id", "percent", "gross_amount", "withheld_amount", "status", "created_at")
    list_filter = ("status", "source_type", "created_at")
    search_fields = ("user__username", "source_id")
    raw_id_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)

# ======================
# Prune Business admin: keep only CommissionConfig and DailyReport
# ======================
from django.contrib.admin.sites import NotRegistered as _AdminNotRegistered

def _try_unregister(model_cls):
    try:
        admin.site.unregister(model_cls)
    except _AdminNotRegistered:
        pass
    except Exception:
        pass

# Unregister business models not requested
_try_unregister(BusinessRegistration)
_try_unregister(AutoPoolAccount)
_try_unregister(RewardProgress)
_try_unregister(RewardRedemption)
_try_unregister(UserMatrixProgress)
_try_unregister(ReferralJoinPayout)
_try_unregister(FranchisePayout)
_try_unregister(WithholdingReserve)
