from django.contrib import admin
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Q
import csv
from django import forms
from decimal import Decimal
import json

from .models import BusinessRegistration, CommissionConfig, AutoPoolAccount, RewardProgress, RewardRedemption, UserMatrixProgress, ReferralJoinPayout, FranchisePayout, DailyReport, WithholdingReserve, Package, AgencyPackageAssignment, AgencyPackagePayment, PromoPackage, PromoProduct, PromoPurchase, PromoPackageProduct, PromoMonthlyPackage, PromoMonthlyBox, PromoEBook, PromoPackageEBook, EBookAccess, TriApp, TriAppProduct
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


class CommissionConfigForm(forms.ModelForm):
    # Monthly 759 (admin-friendly fields mapped to master_commission_json["monthly_759"])
    monthly_759_direct_first_month = forms.DecimalField(required=False, min_value=0, label="Monthly 759: Direct (first month)")
    monthly_759_direct_monthly = forms.DecimalField(required=False, min_value=0, label="Monthly 759: Direct (subsequent months)")
    monthly_759_levels_fixed = forms.CharField(required=False, label="Monthly 759: Levels fixed (comma-separated 5 values)", widget=forms.Textarea(attrs={"rows": 2}))
    monthly_759_agency_enabled = forms.BooleanField(required=False, label="Monthly 759: Agency distribution enabled")

    # Geo overrides for Active 150 (mapped to master_commission_json['geo_mode']['active_150'] and ['geo_fixed']['active_150'])
    geo_mode_active_150 = forms.ChoiceField(
        required=False,
        choices=(("percent", "Percent-based"), ("fixed", "Fixed amounts")),
        label="Geo Mode for Active 150"
    )
    geo_fixed_active_150_json = forms.CharField(
        required=False,
        label="Geo fixed amounts for Active 150 (JSON: role->amount)",
        widget=forms.Textarea(attrs={"rows": 3, "placeholder": '{"sub_franchise":15,"pincode":4,"pincode_coord":2,"district":1,"district_coord":1,"state":1,"state_coord":1,"employee":0,"royalty":0}'})
    )

    # Consumer matrix overrides (stored under master_commission_json.consumer_matrix_3 / consumer_matrix_5)
    consumer_3_50_percents = forms.CharField(
        required=False,
        label="Consumer 3‑Matrix 50: percents (15 comma-separated)",
        widget=forms.Textarea(attrs={"rows": 2})
    )
    consumer_3_50_fixed = forms.CharField(
        required=False,
        label="Consumer 3‑Matrix 50: fixed amounts (15 comma-separated)",
        widget=forms.Textarea(attrs={"rows": 2})
    )
    consumer_3_150_percents = forms.CharField(
        required=False,
        label="Consumer 3‑Matrix 150: percents (15 comma-separated)",
        widget=forms.Textarea(attrs={"rows": 2})
    )
    consumer_3_150_fixed = forms.CharField(
        required=False,
        label="Consumer 3‑Matrix 150: fixed amounts (15 comma-separated)",
        widget=forms.Textarea(attrs={"rows": 2})
    )
    consumer_5_150_percents = forms.CharField(
        required=False,
        label="Consumer 5‑Matrix 150: percents (6 comma-separated)",
        widget=forms.Textarea(attrs={"rows": 2})
    )
    consumer_5_150_fixed = forms.CharField(
        required=False,
        label="Consumer 5‑Matrix 150: fixed amounts (6 comma-separated)",
        widget=forms.Textarea(attrs={"rows": 2})
    )

    # Geo overrides for Monthly 759
    geo_mode_monthly_759 = forms.ChoiceField(
        required=False,
        choices=(("percent", "Percent-based"), ("fixed", "Fixed amounts")),
        label="Geo Mode for Monthly 759"
    )
    geo_fixed_monthly_759_json = forms.CharField(
        required=False,
        label="Geo fixed amounts for Monthly 759 (JSON: role->amount)",
        widget=forms.Textarea(attrs={"rows": 3, "placeholder": '{"sub_franchise":25,"pincode":0,"pincode_coord":0,"district":0,"district_coord":0,"state":0,"state_coord":0,"employee":0,"royalty":0}'})
    )

    class Meta:
        model = CommissionConfig
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        inst = self.instance
        master = {}
        try:
            master = dict(getattr(inst, "master_commission_json", {}) or {})
        except Exception:
            master = {}

        # Monthly 759 defaults
        m759 = dict(master.get("monthly_759", {}) or {})
        self.fields["monthly_759_direct_first_month"].initial = m759.get("direct_first_month", 250)
        self.fields["monthly_759_direct_monthly"].initial = m759.get("direct_monthly", 50)
        levels = m759.get("levels_fixed") or [50, 10, 5, 5, 10]
        try:
            self.fields["monthly_759_levels_fixed"].initial = ", ".join(str(x) for x in levels[:5])
        except Exception:
            self.fields["monthly_759_levels_fixed"].initial = "50, 10, 5, 5, 10"
        self.fields["monthly_759_agency_enabled"].initial = bool(m759.get("agency_enabled", True))

        # Geo mode/fixed for Active 150
        geo_mode = (master.get("geo_mode") or {}).get("active_150")
        self.fields["geo_mode_active_150"].initial = geo_mode or "percent"
        fixed_map = (master.get("geo_fixed") or {}).get("active_150") or {}
        try:
            self.fields["geo_fixed_active_150_json"].initial = json.dumps(fixed_map, ensure_ascii=False)
        except Exception:
            self.fields["geo_fixed_active_150_json"].initial = ""

        # Consumer matrix overrides (initials)
        cm3 = dict(master.get("consumer_matrix_3", {}) or {})
        cm5 = dict(master.get("consumer_matrix_5", {}) or {})
        try:
            m3_50 = dict(cm3.get("50", {}) or {})
            p = m3_50.get("percents") or []
            self.fields["consumer_3_50_percents"].initial = ", ".join(str(x) for x in p[:15]) if p else ""
            f = m3_50.get("fixed_amounts") or []
            self.fields["consumer_3_50_fixed"].initial = ", ".join(str(x) for x in f[:15]) if f else ""
        except Exception:
            pass
        try:
            m3_150 = dict(cm3.get("150", {}) or {})
            p = m3_150.get("percents") or []
            self.fields["consumer_3_150_percents"].initial = ", ".join(str(x) for x in p[:15]) if p else ""
            f = m3_150.get("fixed_amounts") or []
            self.fields["consumer_3_150_fixed"].initial = ", ".join(str(x) for x in f[:15]) if f else ""
        except Exception:
            pass
        try:
            m5_150 = dict(cm5.get("150", {}) or {})
            p = m5_150.get("percents") or []
            self.fields["consumer_5_150_percents"].initial = ", ".join(str(x) for x in p[:6]) if p else ""
            f = m5_150.get("fixed_amounts") or []
            self.fields["consumer_5_150_fixed"].initial = ", ".join(str(x) for x in f[:6]) if f else ""
        except Exception:
            pass

        # Geo monthly 759 override (initials)
        geo_mode_m = (master.get("geo_mode") or {}).get("monthly_759")
        self.fields["geo_mode_monthly_759"].initial = geo_mode_m or "percent"
        fixed_map_m = (master.get("geo_fixed") or {}).get("monthly_759") or {}
        try:
            self.fields["geo_fixed_monthly_759_json"].initial = json.dumps(fixed_map_m, ensure_ascii=False)
        except Exception:
            self.fields["geo_fixed_monthly_759_json"].initial = ""

    def save(self, commit=True):
        inst = super().save(commit=False)
        # Work on a copy of existing master
        try:
            master = dict(getattr(inst, "master_commission_json", {}) or {})
        except Exception:
            master = {}

        # Monthly 759
        m759 = dict(master.get("monthly_759", {}) or {})
        dfm = self.cleaned_data.get("monthly_759_direct_first_month")
        dm = self.cleaned_data.get("monthly_759_direct_monthly")
        levels_raw = (self.cleaned_data.get("monthly_759_levels_fixed") or "").strip()
        agency_enabled = bool(self.cleaned_data.get("monthly_759_agency_enabled"))

        if dfm is not None:
            try:
                m759["direct_first_month"] = float(Decimal(str(dfm)))
            except Exception:
                pass
        if dm is not None:
            try:
                m759["direct_monthly"] = float(Decimal(str(dm)))
            except Exception:
                pass
        if levels_raw:
            try:
                parts = [p.strip() for p in levels_raw.replace("\n", ",").split(",") if p.strip()]
                vals = [float(Decimal(p)) for p in parts][:5]
                m759["levels_fixed"] = vals
            except Exception:
                # keep existing if parsing fails
                pass
        m759["agency_enabled"] = agency_enabled
        master["monthly_759"] = m759

        # Geo mode/fixed for Active 150
        gm = dict(master.get("geo_mode", {}) or {})
        mode_val = self.cleaned_data.get("geo_mode_active_150")
        if mode_val in {"percent", "fixed"}:
            gm["active_150"] = mode_val
        master["geo_mode"] = gm

        gf = dict(master.get("geo_fixed", {}) or {})
        fixed_json_txt = (self.cleaned_data.get("geo_fixed_active_150_json") or "").strip()
        if fixed_json_txt:
            try:
                fixed_map = json.loads(fixed_json_txt)
                if isinstance(fixed_map, dict):
                    # normalize numeric values
                    norm = {}
                    for k, v in fixed_map.items():
                        try:
                            norm[str(k)] = float(Decimal(str(v)))
                        except Exception:
                            continue
                    gf["active_150"] = norm
            except Exception:
                # ignore if invalid json
                pass
        master["geo_fixed"] = gf

        # Geo override: Monthly 759
        gm2 = dict(master.get("geo_mode", {}) or {})
        mode_m759 = self.cleaned_data.get("geo_mode_monthly_759")
        if mode_m759 in {"percent", "fixed"}:
            gm2["monthly_759"] = mode_m759
        master["geo_mode"] = gm2

        gf2 = dict(master.get("geo_fixed", {}) or {})
        fixed_m759_txt = (self.cleaned_data.get("geo_fixed_monthly_759_json") or "").strip()
        if fixed_m759_txt:
            try:
                fixed_map2 = json.loads(fixed_m759_txt)
                if isinstance(fixed_map2, dict):
                    norm2 = {}
                    for k, v in fixed_map2.items():
                        try:
                            norm2[str(k)] = float(Decimal(str(v)))
                        except Exception:
                            continue
                    gf2["monthly_759"] = norm2
            except Exception:
                pass
        master["geo_fixed"] = gf2

        # Consumer matrix overrides
        cm3 = dict(master.get("consumer_matrix_3", {}) or {})
        cm5 = dict(master.get("consumer_matrix_5", {}) or {})

        def _parse_csv(txt):
            parts = [p.strip() for p in (txt or "").replace("\n", ",").split(",") if p.strip()]
            out = []
            for p in parts:
                try:
                    out.append(float(Decimal(p)))
                except Exception:
                    continue
            return out

        # 3-Matrix 50
        t = self.cleaned_data.get("consumer_3_50_percents")
        if t:
            sec = dict(cm3.get("50", {}) or {})
            sec["percents"] = _parse_csv(t)[:15]
            cm3["50"] = sec
        t = self.cleaned_data.get("consumer_3_50_fixed")
        if t:
            sec = dict(cm3.get("50", {}) or {})
            sec["fixed_amounts"] = _parse_csv(t)[:15]
            cm3["50"] = sec

        # 3-Matrix 150
        t = self.cleaned_data.get("consumer_3_150_percents")
        if t:
            sec = dict(cm3.get("150", {}) or {})
            sec["percents"] = _parse_csv(t)[:15]
            cm3["150"] = sec
        t = self.cleaned_data.get("consumer_3_150_fixed")
        if t:
            sec = dict(cm3.get("150", {}) or {})
            sec["fixed_amounts"] = _parse_csv(t)[:15]
            cm3["150"] = sec

        # 5-Matrix 150
        t = self.cleaned_data.get("consumer_5_150_percents")
        if t:
            sec = dict(cm5.get("150", {}) or {})
            sec["percents"] = _parse_csv(t)[:6]
            cm5["150"] = sec
        t = self.cleaned_data.get("consumer_5_150_fixed")
        if t:
            sec = dict(cm5.get("150", {}) or {})
            sec["fixed_amounts"] = _parse_csv(t)[:6]
            cm5["150"] = sec

        master["consumer_matrix_3"] = cm3
        master["consumer_matrix_5"] = cm5

        inst.master_commission_json = master
        if commit:
            inst.save()
        return inst


@admin.register(CommissionConfig)
class CommissionConfigAdmin(admin.ModelAdmin):
    form = CommissionConfigForm
    list_display = (
        "base_coupon_value",
        "enable_pool_distribution",
        "enable_geo_distribution",
        "enable_franchise_on_join",
        "enable_franchise_on_purchase",
        "autopool_trigger_on_direct_referral",
        "updated_at",
        "created_at",
    )
    readonly_fields = ("updated_at", "created_at")
    fieldsets = (
        ("Base", {"fields": ("base_coupon_value",)}),

        ("Global Toggles", {"fields": (
            "enable_pool_distribution",
            "enable_geo_distribution",
            "enable_geo_distribution_on_activation",
        )}),

        ("Hierarchical L1-L5 (Upline percent)", {"fields": ("l1_percent", "l2_percent", "l3_percent", "l4_percent", "l5_percent")}),

        ("Prime 150 (Active)", {"fields": (
            "prime_activation_amount",
            "redeem_credit_amount_150",
            "active_direct_bonus_amount",
            "active_self_bonus_amount",
            "product_opens_prime",
        )}),

        ("Global 50", {"fields": ("global_activation_amount",)}),

        ("3‑Matrix (Consumer)", {"fields": (
            "three_matrix_levels",
            "three_matrix_percents_json",
            "three_matrix_amounts_json",
        )}),

        ("5‑Matrix (Consumer)", {"fields": (
            "five_matrix_levels",
            "five_matrix_percents_json",
            "five_matrix_amounts_json",
        )}),

        ("Monthly 759 (Admin Config)", {"fields": (
            "monthly_759_direct_first_month",
            "monthly_759_direct_monthly",
            "monthly_759_levels_fixed",
            "monthly_759_agency_enabled",
        )}),

        ("Geo Override: Monthly 759", {"fields": (
            "geo_mode_monthly_759",
            "geo_fixed_monthly_759_json",
        )}),

        ("Consumer 3‑Matrix Overrides", {"fields": (
            "consumer_3_50_percents",
            "consumer_3_50_fixed",
            "consumer_3_150_percents",
            "consumer_3_150_fixed",
        )}),

        ("Consumer 5‑Matrix Overrides", {"fields": (
            "consumer_5_150_percents",
            "consumer_5_150_fixed",
        )}),

        ("Agency Geo Distribution (Global Percent)", {"fields": (
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

        ("Geo Override: Active 150", {"fields": (
            "geo_mode_active_150",
            "geo_fixed_active_150_json",
        )}),

        ("Trikonekt Fixed Amounts / Referral", {"fields": (
            "franchise_fixed_json",
            "referral_join_fixed_json",
        )}),

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


# ==============================
# Packages (Admin)
# ==============================
class AgencyPackagePaymentInline(admin.TabularInline):
    model = AgencyPackagePayment
    extra = 0
    readonly_fields = ("paid_at",)
    fields = ("amount", "reference", "notes", "paid_at")


@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "amount", "is_active", "is_default", "created_at")
    list_filter = ("is_active", "is_default")
    search_fields = ("code", "name")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("code",)
    fieldsets = (
        ("Package", {"fields": ("code", "name", "description", "amount", "is_active", "is_default")}),
        ("Audit", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(AgencyPackageAssignment)
class AgencyPackageAssignmentAdmin(admin.ModelAdmin):
    list_display = ("agency", "package", "total_amount", "paid_amount", "remaining_amount", "status_label", "created_at")
    list_filter = ("package", "created_at")
    search_fields = ("agency__username", "package__code", "package__name")
    raw_id_fields = ("agency", "package")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)
    inlines = [AgencyPackagePaymentInline]

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related("package", "agency").prefetch_related("payments")

    def total_amount(self, obj):
        return getattr(obj.package, "amount", 0)
    total_amount.short_description = "Total (₹)"

    def paid_amount(self, obj):
        try:
            return sum((p.amount or 0) for p in getattr(obj, "payments").all())
        except Exception:
            return 0
    paid_amount.short_description = "Paid (₹)"

    def remaining_amount(self, obj):
        try:
            total = self.total_amount(obj) or 0
            paid = self.paid_amount(obj) or 0
            rem = total - paid
            return rem if rem > 0 else 0
        except Exception:
            return 0
    remaining_amount.short_description = "Remaining (₹)"

    def status_label(self, obj):
        try:
            total = self.total_amount(obj) or 0
            paid = self.paid_amount(obj) or 0
            if paid <= 0:
                return "Inactive ✗"
            if paid < total:
                return "Partial ✓"
            return "Active ✓"
        except Exception:
            return "Inactive ✗"
    status_label.short_description = "Status"

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        # Restrict agency choices to only agency users (role=agency or category startswith 'agency')
        if db_field.name == "agency":
            kwargs["queryset"] = CustomUser.objects.filter(Q(role="agency") | Q(category__startswith="agency"))
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(AgencyPackagePayment)
class AgencyPackagePaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "assignment", "amount", "paid_at", "reference")
    list_filter = ("paid_at",)
    search_fields = ("assignment__agency__username", "assignment__package__code", "reference")
    raw_id_fields = ("assignment",)
    ordering = ("-paid_at", "-id")


# ==============================
# Consumer Promo Packages (Admin)
# ==============================
@admin.register(PromoPackage)
class PromoPackageAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "type", "price", "is_active", "created_at")
    list_filter = ("type", "is_active")
    search_fields = ("code", "name")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("Promo Package", {"fields": ("code", "name", "description", "type", "price", "is_active")}),
        ("Payment Details", {"fields": ("payment_qr", "upi_id")}),
        ("Audit", {"fields": ("created_at", "updated_at")}),
    )
    ordering = ("code",)

@admin.register(PromoProduct)
class PromoProductAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "price", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name",)
    ordering = ("-created_at", "-id")


@admin.register(PromoPackageProduct)
class PromoPackageProductAdmin(admin.ModelAdmin):
    list_display = ("id", "package", "product", "is_active", "display_order")
    list_filter = ("is_active", "package")
    search_fields = ("package__code", "product__name")
    raw_id_fields = ("package", "product")
    ordering = ("package", "display_order", "id")


@admin.register(PromoMonthlyPackage)
class PromoMonthlyPackageAdmin(admin.ModelAdmin):
    list_display = ("id", "package", "number", "total_boxes", "is_active")
    list_filter = ("is_active", "package")
    search_fields = ("package__code", "package__name")
    raw_id_fields = ("package",)
    ordering = ("package", "number")


@admin.register(PromoMonthlyBox)
class PromoMonthlyBoxAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "package", "package_number", "box_number", "purchase", "created_at")
    list_filter = ("package", "package_number")
    search_fields = ("user__username", "package__code")
    raw_id_fields = ("user", "package", "purchase")
    ordering = ("-created_at", "-id")


@admin.register(PromoEBook)
class PromoEBookAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("title",)
    readonly_fields = ("created_at",)
    ordering = ("-created_at", "-id")
    fieldsets = (
        ("E-Book", {"fields": ("title", "description", "file", "cover", "is_active")}),
        ("Audit", {"fields": ("created_at",)}),
    )


@admin.register(PromoPackageEBook)
class PromoPackageEBookAdmin(admin.ModelAdmin):
    list_display = ("id", "package", "ebook", "is_active", "display_order")
    list_filter = ("is_active", "package")
    search_fields = ("package__code", "ebook__title")
    raw_id_fields = ("package", "ebook")
    ordering = ("package", "display_order", "id")


@admin.register(EBookAccess)
class EBookAccessAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "ebook", "granted_at")
    search_fields = ("user__username", "ebook__title")
    raw_id_fields = ("user", "ebook")
    ordering = ("-granted_at", "-id")
    readonly_fields = ("granted_at",)


@admin.register(PromoPurchase)
class PromoPurchaseAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "package", "status", "selected_product", "amount_paid", "delivery_by", "requested_at", "approved_at")
    list_filter = ("status", "package__type", "requested_at")
    search_fields = ("user__username", "package__code", "package__name", "selected_product__name")
    raw_id_fields = ("user", "approved_by", "package", "selected_product")
    readonly_fields = ("requested_at", "approved_at", "active_from", "active_to", "delivery_by")
    list_select_related = ("user", "package", "approved_by", "selected_product")
    ordering = ("-requested_at", "-id")
    actions = ["approve_selected", "reject_selected"]

    def approve_selected(self, request, queryset):
        from datetime import date
        from calendar import monthrange
        updated = 0
        for obj in queryset.select_related("package", "user"):
            try:
                if obj.status != "PENDING":
                    continue
                obj.status = "APPROVED"
                obj.approved_by = request.user
                obj.approved_at = timezone.now()
                today = timezone.localdate()
                if obj.package.type == "MONTHLY":
                    # Allocate permanent paid boxes for this purchase
                    created_boxes = 0
                    try:
                        from .models import PromoMonthlyBox
                        boxes = list(getattr(obj, "boxes_json", []) or [])
                        number = int(getattr(obj, "package_number", 1) or 1)
                        for b in boxes:
                            try:
                                bn = int(b)
                                _, created = PromoMonthlyBox.objects.get_or_create(
                                    user=obj.user,
                                    package=obj.package,
                                    package_number=number,
                                    box_number=bn,
                                    defaults={"purchase": obj},
                                )
                                if created:
                                    created_boxes += 1
                            except Exception:
                                continue
                    except Exception:
                        pass
                    # No calendar active window for per-box flow
                    obj.active_from = None
                    obj.active_to = None
                else:
                    obj.active_from = today
                    obj.active_to = None

                fields_to_update = ["status", "approved_by", "approved_at", "active_from", "active_to"]
                # Set delivery_by for PRIME ₹750 purchases (30 days from approval date)
                try:
                    from decimal import Decimal as D
                    price = D(str(getattr(obj.package, "price", "0")))
                    is_prime_750 = str(getattr(obj.package, "type", "")) == "PRIME" and abs(price - D("750")) <= D("0.5")
                except Exception:
                    is_prime_750 = False
                if is_prime_750:
                    from datetime import timedelta
                    obj.delivery_by = timezone.localdate() + timedelta(days=30)
                    fields_to_update.append("delivery_by")

                obj.save(update_fields=fields_to_update)
                updated += 1
            except Exception:
                continue
        self.message_user(request, f"Approved {updated} promo purchase(s).")
    approve_selected.short_description = "Approve selected PENDING purchases"

    def reject_selected(self, request, queryset):
        updated = 0
        for obj in queryset.select_related("package", "user"):
            try:
                if obj.status != "PENDING":
                    continue
                obj.status = "REJECTED"
                obj.approved_by = request.user
                obj.approved_at = timezone.now()
                obj.save(update_fields=["status", "approved_by", "approved_at"])
                updated += 1
            except Exception:
                continue
        self.message_user(request, f"Rejected {updated} promo purchase(s).")
    reject_selected.short_description = "Reject selected PENDING purchases"


# ==============================
# TRI Apps (Admin)
# ==============================
class TriAppProductInline(admin.TabularInline):
    model = TriAppProduct
    extra = 0
    fields = ("name", "price", "currency", "image", "is_active", "display_order")
    ordering = ("display_order", "id")


@admin.register(TriApp)
class TriAppAdmin(admin.ModelAdmin):
    list_display = ("slug", "name", "is_active", "allow_price", "allow_add_to_cart", "allow_payment", "updated_at")
    list_filter = ("is_active", "allow_price", "allow_add_to_cart", "allow_payment")
    search_fields = ("slug", "name", "description")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("TRI App", {"fields": ("slug", "name", "description", "is_active")}),
        ("Capabilities", {"fields": ("allow_price", "allow_add_to_cart", "allow_payment")}),
        ("Media", {"fields": ("banner_image",)}),
        ("Audit", {"fields": ("created_at", "updated_at")}),
    )
    inlines = [TriAppProductInline]


@admin.register(TriAppProduct)
class TriAppProductAdmin(admin.ModelAdmin):
    list_display = ("id", "app", "name", "price", "currency", "is_active", "display_order", "updated_at")
    list_filter = ("app", "is_active")
    search_fields = ("name", "app__slug", "app__name")
    raw_id_fields = ("app",)
    ordering = ("app", "display_order", "id")


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
