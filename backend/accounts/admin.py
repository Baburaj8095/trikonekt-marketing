from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Q
import csv
from django import forms
from django.contrib.admin.helpers import ActionForm
from .models import (
    CustomUser, PincodeUser,
    ConsumerAccount, EmployeeAccount, CompanyAccount,
    AgencyStateCoordinator, AgencyState, AgencyDistrictCoordinator, AgencyDistrict,
    AgencyPincodeCoordinator, AgencyPincode, AgencySubFranchise, AgencyRegionAssignment,
    Wallet, WalletTransaction, UserKYC, WithdrawalRequest
)
from django.contrib.admin.widgets import FilteredSelectMultiple
from locations.models import State, City
from locations.views import _build_district_index, india_place_variants
from django.urls import reverse
from django.utils.html import format_html
from django.contrib import messages


# ======================
# Bulk region assignment form for Agency categories
# ======================
class CustomUserAdminForm(forms.ModelForm):
    # Shown for State Coordinator (max 2)
    assign_states = forms.ModelMultipleChoiceField(
        queryset=State.objects.all(),
        required=False,
        widget=FilteredSelectMultiple("States", is_stacked=False),
        help_text="For State Coordinator: select up to 2 States."
    )
    # Shown for District Coordinator (max 2); choices populated from user's State -> Cities
    assign_districts = forms.MultipleChoiceField(
        required=False,
        choices=[],
        widget=FilteredSelectMultiple("Districts", is_stacked=False),
        help_text="For District Coordinator: select up to 4 Districts. District list is derived from Cities under the selected State on the profile."
    )
    # Shown for Pincode Coordinator (max 4)
    assign_pincodes = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 2}),
        help_text="For Pincode Coordinator: enter up to 4 pincodes, comma-separated (e.g. 585103,585104)."
    )

    class Meta:
        model = CustomUser
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Populate district choices from user's selected State (profile tab)
        user = self.instance if (self.instance and self.instance.pk) else None
        current_state = getattr(user, "state", None)
        if current_state:
            city_names = City.objects.filter(state=current_state).order_by("name").values_list("name", flat=True).distinct()
            self.fields["assign_districts"].choices = [(n, n) for n in city_names]
        else:
            self.fields["assign_districts"].choices = []

        # Pre-populate from existing region assignments
        if user:
            self.fields["assign_states"].initial = list(
                State.objects.filter(region_assignments__user=user, region_assignments__level="state")
                .values_list("id", flat=True)
            )
            self.fields["assign_districts"].initial = list(
                user.region_assignments.filter(level="district").values_list("district", flat=True)
            )
            pins = list(user.region_assignments.filter(level="pincode").values_list("pincode", flat=True))
            if pins:
                self.fields["assign_pincodes"].initial = ", ".join(pins)

    def clean(self):
        cleaned = super().clean()
        cat = cleaned.get("category") or (self.instance.category if self.instance else None)

        if cat == "agency_state_coordinator":
            states = cleaned.get("assign_states") or []
            if len(states) > 2:
                raise forms.ValidationError("Select maximum 2 states for State Coordinator.")

        if cat == "agency_district_coordinator":
            dists = cleaned.get("assign_districts") or []
            if len(dists) > 4:
                raise forms.ValidationError("Select maximum 4 districts for District Coordinator.")

        if cat == "agency_pincode_coordinator":
            raw = (cleaned.get("assign_pincodes") or "").replace("\n", ",")
            pins = [p.strip() for p in raw.split(",") if p.strip()]
            if len(pins) > 4:
                raise forms.ValidationError("Select maximum 4 pincodes for Pincode Coordinator.")
            for p in pins:
                if not p.isdigit() or len(p) != 6:
                    raise forms.ValidationError(f"Invalid pincode: {p}")
            cleaned["assign_pincodes"] = ",".join(pins)

        return cleaned


def _process_bulk_region_assignments(user: CustomUser, cleaned_data: dict):
    """
    Create/update AgencyRegionAssignment rows from bulk fields depending on category.
    - State Coordinator: assign_states (max 2)
    - District Coordinator: assign_districts (max 2) under user's selected State
    - Pincode Coordinator: assign_pincodes (max 4)
    """
    cat = getattr(user, "category", None)

    # State Coordinator
    if cat == "agency_state_coordinator":
        selected_states = list(cleaned_data.get("assign_states") or [])
        # Remove states not selected
        user.region_assignments.filter(level="state").exclude(state__in=selected_states).delete()
        # Ensure selected exist
        for st in selected_states:
            AgencyRegionAssignment.objects.get_or_create(
                user=user, level="state", state=st, defaults={"district": "", "pincode": ""}
            )

    # District Coordinator
    if cat == "agency_district_coordinator":
        st = getattr(user, "state", None)
        if st:
            selected_dists = list(cleaned_data.get("assign_districts") or [])
            user.region_assignments.filter(level="district", state=st).exclude(district__in=selected_dists).delete()
            for d in selected_dists:
                AgencyRegionAssignment.objects.get_or_create(
                    user=user, level="district", state=st, district=d, defaults={"pincode": ""}
                )

    # Pincode Coordinator
    if cat == "agency_pincode_coordinator":
        pins_str = cleaned_data.get("assign_pincodes") or ""
        pins = [p.strip() for p in pins_str.split(",") if p.strip()]
        if pins:
            user.region_assignments.filter(level="pincode").exclude(pincode__in=pins).delete()
            for p in pins:
                AgencyRegionAssignment.objects.get_or_create(
                    user=user, level="pincode", pincode=p
                )

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    form = CustomUserAdminForm
    list_display = (
        'username', 'email', 'role', 'category', 'unique_id',
        'full_name', 'phone', 'country', 'state', 'city', 'pincode',
        'sponsor_id', 'registered_by', 'is_staff', 'is_active'
    )
    list_filter = ('role', 'category', 'is_staff', 'is_active', 'country', 'state', 'registered_by')
    fieldsets = (
        (None, {'fields': ('username', 'email', 'password', 'role', 'category', 'registered_by')}),
        ('Profile', {'fields': ('full_name', 'phone', 'country', 'state', 'city', 'pincode', 'sponsor_id')}),
        ('Permissions', {'fields': ('is_staff', 'is_active', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {'classes': ('wide',), 'fields': (
            'username', 'email', 'password1', 'password2', 'role', 'category', 'full_name',
            'phone', 'country', 'state', 'city', 'pincode', 'sponsor_id',
            'is_staff', 'is_active'
        )}),
    )
    search_fields = ('username', 'email', 'full_name', 'phone', 'pincode', 'sponsor_id', 'unique_id')
    list_select_related = ('country', 'state', 'city', 'registered_by')
    raw_id_fields = ('country', 'state', 'city', 'registered_by')
    ordering = ('username',)
    # unique_id is non-editable on the model; expose it as read-only in admin
    readonly_fields = ('unique_id',)

    # Append bulk region fields section on change form
    def get_fieldsets(self, request, obj=None):
        fs = list(super().get_fieldsets(request, obj))
        fields = ()
        cat = getattr(obj, 'category', None) if obj else None
        if cat == 'agency_state_coordinator':
            fields = ('assign_states',)
        elif cat == 'agency_district_coordinator':
            fields = ('assign_districts',)
        elif cat == 'agency_pincode_coordinator':
            fields = ('assign_pincodes',)
        elif obj is None:
            # On add form, expose all to allow initial save + refresh workflow
            fields = ('assign_states', 'assign_districts', 'assign_pincodes')
        if fields:
            fs.append((
                'Region Bulk Assignments',
                {'fields': fields}
            ))
        return fs

    # Persist bulk selections into AgencyRegionAssignment
    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        try:
            _process_bulk_region_assignments(obj, form.cleaned_data)
        except Exception:
            # Avoid blocking normal save if bulk processing fails
            pass

    # Show region assignment inlines for Agency categories on change view
    def get_inline_instances(self, request, obj=None):
        if obj is None:
            return []
        allowed = _allowed_region_inlines_for_category(getattr(obj, 'category', None))
        return [inline(self.model, self.admin_site) for inline in allowed]

    # Limit visibility for agency staff to pincode-matched end users only
    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related('country', 'state', 'city', 'registered_by')
        if request.user.is_superuser:
            return qs
        role = getattr(request.user, 'role', None)
        if role == 'agency' and request.user.is_staff and not request.user.is_superuser:
            user_pin = (getattr(request.user, 'pincode', '') or '').strip()
            if user_pin:
                return qs.filter(role='user', pincode__iexact=user_pin)
            return qs.none()
        return qs

    # Prevent agency staff from creating or deleting users in admin
    def has_add_permission(self, request):
        if not request.user.is_superuser and getattr(request.user, 'role', None) == 'agency':
            return False
        return super().has_add_permission(request)

    def has_delete_permission(self, request, obj=None):
        if not request.user.is_superuser and getattr(request.user, 'role', None) == 'agency':
            return False
        return super().has_delete_permission(request, obj)

    # Make fields read-only for agency staff (view-only access)
    def get_readonly_fields(self, request, obj=None):
        ro = list(super().get_readonly_fields(request, obj))
        if not request.user.is_superuser and getattr(request.user, 'role', None) == 'agency':
            ro.extend([
                'username', 'email', 'role', 'category', 'unique_id', 'registered_by',
                'full_name', 'phone', 'country', 'state', 'city', 'pincode', 'sponsor_id',
                'is_staff', 'is_active', 'is_superuser', 'groups', 'user_permissions',
                'last_login', 'date_joined', 'password'
            ])
        return tuple(ro)

    # Hide bulk actions for agency staff
    def get_actions(self, request):
        actions = super().get_actions(request)
        if not request.user.is_superuser and getattr(request.user, 'role', None) == 'agency':
            return {}
        return actions

    # Ensure the Accounts app and this model appear in admin for agency staff
    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return getattr(request.user, 'role', None) == 'agency' and request.user.is_staff


@admin.register(PincodeUser)
class PincodeUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'full_name', 'phone', 'sponsor_id', 'email', 'pincode', 'country', 'state', 'city', 'date_joined', 'is_active')
    search_fields = ('username', 'email', 'full_name', 'phone', 'pincode', 'sponsor_id')
    list_select_related = ('country', 'state', 'city')
    ordering = ('-date_joined',)

    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related('country', 'state', 'city')
        qs = qs.filter(role='user')
        if request.user.is_superuser:
            return qs
        if getattr(request.user, 'role', None) == 'agency' and request.user.is_staff:
            pin = (getattr(request.user, 'pincode', '') or '').strip()
            if pin:
                return qs.filter(pincode__iexact=pin)
            return qs.none()
        return qs.none()

    def get_model_perms(self, request):
        base = super().get_model_perms(request)
        if request.user.is_superuser:
            return base
        if getattr(request.user, 'role', None) == 'agency' and request.user.is_staff:
            return {'add': False, 'change': False, 'delete': False, 'view': True}
        return {'add': False, 'change': False, 'delete': False, 'view': False}

    def has_view_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return getattr(request.user, 'role', None) == 'agency' and request.user.is_staff

    def has_module_permission(self, request):
        if request.user.is_superuser:
            return True
        return getattr(request.user, 'role', None) == 'agency' and request.user.is_staff

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


# ======================
# Region assignment inline forms and inlines
# ======================
class AgencyStateAssignmentForm(forms.ModelForm):
    class Meta:
        model = AgencyRegionAssignment
        fields = ['state']

    def save(self, commit=True):
        obj = super().save(commit=False)
        obj.level = 'state'
        obj.district = ''
        obj.pincode = ''
        if commit:
            obj.save()
        return obj


class AgencyDistrictAssignmentForm(forms.ModelForm):
    class Meta:
        model = AgencyRegionAssignment
        fields = ['state', 'district']

    def save(self, commit=True):
        obj = super().save(commit=False)
        obj.level = 'district'
        obj.pincode = ''
        if commit:
            obj.save()
        return obj


class AgencyPincodeAssignmentForm(forms.ModelForm):
    class Meta:
        model = AgencyRegionAssignment
        fields = ['pincode']

    def save(self, commit=True):
        obj = super().save(commit=False)
        obj.level = 'pincode'
        obj.state = None
        obj.district = ''
        if commit:
            obj.save()
        return obj


class AgencyStateAssignmentInline(admin.TabularInline):
    model = AgencyRegionAssignment
    form = AgencyStateAssignmentForm
    extra = 1
    fields = ('state',)
    verbose_name = 'State Assignment'
    verbose_name_plural = 'State Assignments'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.filter(level='state')


class AgencyDistrictAssignmentInline(admin.TabularInline):
    model = AgencyRegionAssignment
    form = AgencyDistrictAssignmentForm
    extra = 1
    fields = ('state', 'district')
    verbose_name = 'District Assignment'
    verbose_name_plural = 'District Assignments'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.filter(level='district')


class AgencyPincodeAssignmentInline(admin.TabularInline):
    model = AgencyRegionAssignment
    form = AgencyPincodeAssignmentForm
    extra = 1
    fields = ('pincode',)
    verbose_name = 'Pincode Assignment'
    verbose_name_plural = 'Pincode Assignments'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.filter(level='pincode')


def _allowed_region_inlines_for_category(category: str):
    """
    Return the list of Inline classes to render for the given agency category.
    """
    if category in ('agency_state_coordinator', 'agency_state'):
        return [AgencyStateAssignmentInline]
    if category in ('agency_district_coordinator', 'agency_district'):
        return [AgencyDistrictAssignmentInline]
    if category in ('agency_pincode_coordinator', 'agency_pincode', 'agency_sub_franchise'):
        return [AgencyPincodeAssignmentInline]
    return []

# Next-level mapping for admin counts/links
NEXT_CATEGORIES = {
    'company': {'agency_state_coordinator'},
    'agency_state_coordinator': {'agency_state'},
    'agency_state': {'agency_district_coordinator'},
    'agency_district_coordinator': {'agency_district'},
    'agency_district': {'agency_pincode_coordinator'},
    'agency_pincode_coordinator': {'agency_pincode'},
    'agency_pincode': {'agency_sub_franchise'},
    'agency_sub_franchise': set(),
}

NEXT_LABELS = {
    'company': 'State Coordinators',
    'agency_state_coordinator': 'States',
    'agency_state': 'District Coordinators',
    'agency_district_coordinator': 'Districts',
    'agency_district': 'Pincode Coordinators',
    'agency_pincode_coordinator': 'Pincode Users',
    'agency_pincode': 'Sub-Franchises',
    'agency_sub_franchise': '',
}

def _next_categories_for(category: str):
    return NEXT_CATEGORIES.get(category or '', set())

def _next_label_for(category: str) -> str:
    return NEXT_LABELS.get(category or '', 'Next')

# Bulk region admin action form for quick distribution
class BulkRegionActionForm(ActionForm):
    # Django admin actions require an 'action' field on custom ActionForm subclasses
    action = forms.ChoiceField(required=False)
    LEVEL_CHOICES = (
        ('state', 'State'),
        ('district', 'District'),
        ('pincode', 'Pincode'),
    )
    level = forms.ChoiceField(choices=LEVEL_CHOICES, required=True)
    state = forms.ModelChoiceField(queryset=State.objects.all(), required=False, help_text="Required for District level. Optional for State/Pincode.")
    districts_csv = forms.CharField(required=False, widget=forms.Textarea(attrs={'rows': 2}), help_text="Comma-separated district names. Used when level=district.")
    pincodes_csv = forms.CharField(required=False, widget=forms.Textarea(attrs={'rows': 2}), help_text="Comma-separated 6-digit pincodes. Used when level=pincode.")
    replace = forms.BooleanField(required=False, help_text="Replace existing assignments at this level for selected users.")
    ignore_caps = forms.BooleanField(required=False, help_text="Ignore per-category caps (4 districts, 4 pincodes).")

    # Distribution fields (for 'Distribute users by region' action)
    dist_child_category = forms.ChoiceField(
        choices=(('agency_sub_franchise', 'Sub-Franchise'),),
        required=False,
        help_text="Child category to distribute; defaults to Sub-Franchise."
    )
    dist_source_parent = forms.ModelChoiceField(
        queryset=CustomUser.objects.all(),
        required=False,
        help_text="Limit to users currently registered by this parent; leave empty to use Company/Admin."
    )
    dist_use_manual = forms.BooleanField(required=False, help_text="Use manual region filters instead of owner assignments.")
    dist_state = forms.ModelChoiceField(queryset=State.objects.all(), required=False)
    dist_districts_csv = forms.CharField(required=False, widget=forms.Textarea(attrs={'rows': 2}))
    dist_pincodes_csv = forms.CharField(required=False, widget=forms.Textarea(attrs={'rows': 2}))
    dist_preview = forms.BooleanField(required=False, initial=False, help_text="Preview only; do not apply changes.")

# Helper base for category-specific proxies
class CategoryProxyAdmin(admin.ModelAdmin):
    category_value = None  # override in subclasses
    form = CustomUserAdminForm
    actions = ('bulk_assign_regions', 'distribute_users_by_region',)
    action_form = BulkRegionActionForm

    list_display = (
        'username', 'unique_id', 'email', 'full_name', 'phone',
        'country', 'state', 'city', 'pincode', 'sponsor_id', 'registered_by', 'date_joined', 'is_active',
        'next_level_count', 'view_next_level'
    )
    search_fields = ('username', 'unique_id', 'email', 'full_name', 'phone', 'pincode', 'sponsor_id')
    list_filter = ('country', 'state', 'is_active')
    list_select_related = ('country', 'state', 'city', 'registered_by')
    ordering = ('-date_joined',)

    def next_level_count(self, obj):
        cats = _next_categories_for(self.category_value or getattr(obj, 'category', None))
        if not cats:
            return 0
        return CustomUser.objects.filter(registered_by=obj, category__in=cats).count()
    next_level_count.short_description = 'Children count'

    def view_next_level(self, obj):
        cats = _next_categories_for(self.category_value or getattr(obj, 'category', None))
        if not cats:
            return '-'
        # Use first category for link when multiple
        cat = sorted(list(cats))[0]
        url = reverse('admin:accounts_customuser_changelist')
        qs = f"?registered_by__id__exact={obj.id}&category__exact={cat}"
        label = _next_label_for(self.category_value or getattr(obj, 'category', None)) or 'Children'
        return format_html('<a href="{}{}">View {}</a>', url, qs, label)
    view_next_level.allow_tags = True
    view_next_level.short_description = 'View children'

    def get_fieldsets(self, request, obj=None):
        fs = list(super().get_fieldsets(request, obj))
        # Decide which bulk fields to show based on category
        cat = self.category_value or (getattr(obj, 'category', None) if obj else None)
        fields = ()
        if cat == 'agency_state_coordinator':
            fields = ('assign_states',)
        elif cat == 'agency_district_coordinator':
            fields = ('assign_districts',)
        elif cat == 'agency_pincode_coordinator':
            fields = ('assign_pincodes',)
        elif obj is None and not self.category_value:
            fields = ('assign_states', 'assign_districts', 'assign_pincodes')
        if fields:
            fs.append((
                'Region Bulk Assignments',
                {'fields': fields}
            ))
        return fs

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        try:
            _process_bulk_region_assignments(obj, form.cleaned_data)
        except Exception:
            pass

    # Render appropriate region assignment inline(s) based on this proxy category
    def get_inline_instances(self, request, obj=None):
        category = getattr(obj, 'category', None) or self.category_value
        allowed = _allowed_region_inlines_for_category(category)
        return [inline(self.model, self.admin_site) for inline in allowed]

    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related('country', 'state', 'city', 'registered_by')
        if self.category_value:
            qs = qs.filter(category=self.category_value)
        return qs

    # Admin action: bulk assign regions to selected users
    def bulk_assign_regions(self, request, queryset):
        # Permission: superuser or Company staff
        is_company_staff = getattr(request.user, 'is_staff', False) and getattr(request.user, 'category', '') == 'company'
        if not (request.user.is_superuser or is_company_staff):
            self.message_user(request, "You do not have permission to distribute regions.", level=messages.ERROR)
            return

        form = BulkRegionActionForm(request.POST)
        if not form.is_valid():
            self.message_user(request, f"Invalid input: {form.errors}", level=messages.ERROR)
            return

        level = form.cleaned_data['level']
        state = form.cleaned_data.get('state')
        replace = bool(form.cleaned_data.get('replace'))
        ignore_caps = bool(form.cleaned_data.get('ignore_caps'))

        created = 0
        skipped = 0
        removed = 0

        for user in queryset:
            # Replace mode: remove existing assignments at this level (optionally scoped)
            try:
                if replace:
                    rm = user.region_assignments.filter(level=level)
                    if level == 'district' and state:
                        rm = rm.filter(state=state)
                    removed += rm.count()
                    rm.delete()
            except Exception:
                pass

            try:
                if level == 'state':
                    if not state:
                        skipped += 1
                        continue
                    # Cap: 2 states for state coordinator (unless override)
                    if not ignore_caps and self.category_value == 'agency_state_coordinator':
                        if user.region_assignments.filter(level='state').count() >= 2:
                            skipped += 1
                            continue
                    _, made = AgencyRegionAssignment.objects.get_or_create(
                        user=user, level='state', state=state, defaults={'district': '', 'pincode': ''}
                    )
                    created += int(made)

                elif level == 'district':
                    if not state:
                        skipped += 1
                        continue
                    districts = [d.strip() for d in (form.cleaned_data.get('districts_csv') or '').split(',') if d.strip()]
                    if not districts:
                        skipped += 1
                        continue
                    # Cap: 4 districts for DC/D (unless override)
                    if not ignore_caps and self.category_value in ('agency_district_coordinator', 'agency_district'):
                        if user.region_assignments.filter(level='district', state=state).count() >= 4:
                            skipped += 1
                            continue
                    for d in districts:
                        _, made = AgencyRegionAssignment.objects.get_or_create(
                            user=user, level='district', state=state, district=d, defaults={'pincode': ''}
                        )
                        created += int(made)

                elif level == 'pincode':
                    pins_raw = (form.cleaned_data.get('pincodes_csv') or '').replace('\n', ',')
                    pins = [p.strip() for p in pins_raw.split(',') if p.strip()]
                    if not pins:
                        skipped += 1
                        continue
                    # Cap: 4 pincodes for PC/P (unless override)
                    if not ignore_caps and self.category_value in ('agency_pincode_coordinator', 'agency_pincode'):
                        if user.region_assignments.filter(level='pincode').count() >= 4:
                            skipped += 1
                            continue
                    for p in pins:
                        if len(p) == 6 and p.isdigit():
                            _, made = AgencyRegionAssignment.objects.get_or_create(
                                user=user, level='pincode', pincode=p
                            )
                            created += int(made)
                        else:
                            skipped += 1
                else:
                    skipped += 1
            except Exception:
                skipped += 1

        self.message_user(
            request,
            f"Bulk assign summary: created={created}, removed={removed if replace else 0}, skipped={skipped}",
            level=messages.INFO
        )
    bulk_assign_regions.short_description = "Bulk assign regions (admin/company only)"

    # Admin action: distribute users by region (re-parenting based on coverage)
    def distribute_users_by_region(self, request, queryset):
        # Permission: superuser or Company staff
        is_company_staff = getattr(request.user, 'is_staff', False) and getattr(request.user, 'category', '') == 'company'
        if not (request.user.is_superuser or is_company_staff):
            self.message_user(request, "You do not have permission to distribute users.", level=messages.ERROR)
            return

        form = BulkRegionActionForm(request.POST)
        if not form.is_valid():
            self.message_user(request, f"Invalid input: {form.errors}", level=messages.ERROR)
            return

        child_cat = form.cleaned_data.get('dist_child_category') or 'agency_sub_franchise'
        source_parent = form.cleaned_data.get('dist_source_parent')
        use_manual = bool(form.cleaned_data.get('dist_use_manual'))
        m_state = form.cleaned_data.get('dist_state')
        m_districts_csv = form.cleaned_data.get('dist_districts_csv') or ''
        m_pincodes_csv = (form.cleaned_data.get('dist_pincodes_csv') or '').replace('\\n', ',')
        preview = bool(form.cleaned_data.get('dist_preview'))

        try:
            idx = _build_district_index() or {}
        except Exception:
            idx = {}

        def coverage_for_owner(owner):
            pins = set()
            try:
                if use_manual:
                    # Manual filters override
                    if m_pincodes_csv:
                        for p in [x.strip() for x in m_pincodes_csv.split(',') if x.strip()]:
                            if p.isdigit() and len(p) == 6:
                                pins.add(p)
                    dlist = [d.strip() for d in (m_districts_csv or '').split(',') if d.strip()]
                    if m_state and dlist:
                        sname = (m_state.name or '').strip().lower()
                        for d in dlist:
                            for dv in (india_place_variants(d) or [d]):
                                dkey = (dv or '').strip().lower()
                                pins.update(idx.get((sname, dkey), set()))
                                pins.update(idx.get(('', dkey), set()))
                    if m_state and not dlist and not m_pincodes_csv:
                        # All pins within the given state
                        sname = (m_state.name or '').strip().lower()
                        for (skey, _d), pset in (idx.items() if hasattr(idx, 'items') else []):
                            if skey == sname:
                                pins.update(pset)
                    return pins

                # Compute from owner's assignments
                assigns = owner.region_assignments.all().select_related('state')
                for a in assigns:
                    if a.level == 'pincode':
                        p = (a.pincode or '').strip()
                        if p and p.isdigit() and len(p) == 6:
                            pins.add(p)
                    elif a.level == 'district':
                        sname = (getattr(a.state, 'name', '') or '').strip().lower()
                        for dv in (india_place_variants(a.district) or [a.district]):
                            dkey = (dv or '').strip().lower()
                            pins.update(idx.get((sname, dkey), set()))
                            pins.update(idx.get(('', dkey), set()))
                    elif a.level == 'state' and a.state:
                        sname = (a.state.name or '').strip().lower()
                        for (skey, _d), pset in (idx.items() if hasattr(idx, 'items') else []):
                            if skey == sname:
                                pins.update(pset)
            except Exception:
                pass
            return pins

        # Base candidates: users in child category under Company/Admin unless a specific parent is chosen
        base = CustomUser.objects.filter(category=child_cat)
        if source_parent:
            base = base.filter(registered_by=source_parent)
        else:
            base = base.filter(
                Q(registered_by__category='company') |
                Q(registered_by__is_staff=True) |
                Q(registered_by__is_superuser=True)
            )

        total_moved = 0
        total_scanned = 0
        total_skipped = 0

        for owner in queryset:
            pins = coverage_for_owner(owner)
            if not pins:
                continue
            candidates = base.filter(pincode__in=list(pins))
            count = candidates.count()
            total_scanned += count
            if preview or count == 0:
                continue
            try:
                updated = candidates.update(registered_by=owner)
                total_moved += updated
                # Exclude moved users from further owners in this run
                base = base.exclude(id__in=candidates.values_list('id', flat=True))
            except Exception:
                total_skipped += count

        if preview:
            self.message_user(
                request,
                f"Preview: owners={queryset.count()}, candidates_scanned={total_scanned}. No changes applied.",
                level=messages.INFO
            )
        else:
            self.message_user(
                request,
                f"Distribution complete: moved={total_moved}, scanned={total_scanned}, skipped={total_skipped}.",
                level=messages.INFO
            )

    distribute_users_by_region.short_description = "Distribute users by region (admin/company only)"

    def has_add_permission(self, request):
        # Proxies are for viewing/filtering; creation should go through main CustomUser
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(ConsumerAccount)
class ConsumerAccountAdmin(CategoryProxyAdmin):
    category_value = 'consumer'
    verbose_name = "Consumer (TRC)"


@admin.register(EmployeeAccount)
class EmployeeAccountAdmin(CategoryProxyAdmin):
    category_value = 'employee'
    verbose_name = "Employee (TRE)"


@admin.register(CompanyAccount)
class CompanyAdmin(CustomUserAdmin):
    list_display = (
        'username', 'unique_id', 'email', 'full_name', 'phone',
        'country', 'state', 'city', 'pincode', 'sponsor_id', 'registered_by', 'date_joined', 'is_active',
        'next_level_count', 'view_next_level'
    )

    def next_level_count(self, obj):
        cats = _next_categories_for('company')
        return CustomUser.objects.filter(registered_by=obj, category__in=cats).count()
    next_level_count.short_description = 'Children count'

    def view_next_level(self, obj):
        cats = _next_categories_for('company')
        if not cats:
            return '-'
        cat = sorted(list(cats))[0]
        url = reverse('admin:accounts_customuser_changelist')
        qs = f"?registered_by__id__exact={obj.id}&category__exact={cat}"
        label = _next_label_for('company') or 'Children'
        return format_html('<a href="{}{}">View {}</a>', url, qs, label)
    view_next_level.allow_tags = True
    view_next_level.short_description = 'View children'
    """
    Admin section for Company records (sponsor-only identities).
    - Not exposed to frontend UI options.
    - Username acts as shareable Sponsor ID for State Coordinator registration.
    - Category is forced to 'company' and locked in forms.
    """

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.filter(category='company')

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        # Lock category to 'company' and set sane defaults
        if 'category' in form.base_fields:
            f = form.base_fields['category']
            f.initial = 'company'
            f.disabled = True
        if 'role' in form.base_fields:
            form.base_fields['role'].initial = 'user'
        return form

    def save_model(self, request, obj, form, change):
        obj.category = 'company'
        if not obj.role:
            obj.role = 'user'
        # sponsor_id will auto-fill from username in model.save()
        super().save_model(request, obj, form, change)


@admin.register(AgencyStateCoordinator)
class AgencyStateCoordinatorAdmin(CategoryProxyAdmin):
    category_value = 'agency_state_coordinator'
    verbose_name = "Agency State Coordinator (TRSC)"


@admin.register(AgencyState)
class AgencyStateAdmin(CategoryProxyAdmin):
    category_value = 'agency_state'
    verbose_name = "Agency State (TRS)"


@admin.register(AgencyDistrictCoordinator)
class AgencyDistrictCoordinatorAdmin(CategoryProxyAdmin):
    category_value = 'agency_district_coordinator'
    verbose_name = "Agency District Coordinator (TRDC)"


@admin.register(AgencyDistrict)
class AgencyDistrictAdmin(CategoryProxyAdmin):
    category_value = 'agency_district'
    verbose_name = "Agency District (TRD)"


@admin.register(AgencyPincodeCoordinator)
class AgencyPincodeCoordinatorAdmin(CategoryProxyAdmin):
    category_value = 'agency_pincode_coordinator'
    verbose_name = "Agency Pincode Coordinator (TRPC)"


@admin.register(AgencyPincode)
class AgencyPincodeAdmin(CategoryProxyAdmin):
    category_value = 'agency_pincode'
    verbose_name = "Agency Pincode (TRP)"


@admin.register(AgencySubFranchise)
class AgencySubFranchiseAdmin(CategoryProxyAdmin):
    category_value = 'agency_sub_franchise'
    verbose_name = "Agency Sub-Franchise (TRSF)"


# ======================
# Region Assignment Admin
# ======================
@admin.register(AgencyRegionAssignment)
class AgencyRegionAssignmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'level', 'state', 'district', 'pincode', 'created_at')
    list_filter = ('level', 'state')
    search_fields = ('user__username', 'user__unique_id', 'district', 'pincode')
    raw_id_fields = ('user', 'state')
    ordering = ('-created_at',)

# ======================
# Wallet Admin
# ======================
@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ('user', 'balance', 'updated_at', 'created_at')
    search_fields = ('user__username',)
    raw_id_fields = ('user',)
    readonly_fields = ('created_at', 'updated_at')


class TxRoleFilter(admin.SimpleListFilter):
    title = "Commission Role (meta.role)"
    parameter_name = "tx_role"

    def lookups(self, request, model_admin):
        return (("employee", "Employee"), ("agency", "Agency"), ("other", "Other/Unset"))

    def queryset(self, request, queryset):
        val = self.value()
        if not val:
            return queryset
        try:
            if val in ("employee", "agency"):
                return queryset.filter(meta__contains={"role": val})
            if val == "other":
                return queryset.exclude(meta__has_key="role")
        except Exception:
            # SQLite fallback without has_key
            if val in ("employee", "agency"):
                return queryset.filter(meta__contains={"role": val})
            if val == "other":
                return queryset.exclude(meta__contains={"role": "employee"}).exclude(meta__contains({"role": "agency"}))
        return queryset


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'type', 'amount', 'balance_after', 'source_type', 'source_id', 'created_at')
    list_filter = ('type', 'source_type', TxRoleFilter)
    search_fields = ('user__username', 'source_id')
    raw_id_fields = ('user',)
    readonly_fields = ('created_at',)
    actions = ['export_as_csv']

    def export_as_csv(self, request, queryset):
        import csv
        from django.http import HttpResponse
        resp = HttpResponse(content_type='text/csv')
        resp['Content-Disposition'] = 'attachment; filename=wallet_transactions.csv'
        writer = csv.writer(resp)
        writer.writerow(['user', 'type', 'amount', 'balance_after', 'source_type', 'source_id', 'meta', 'created_at'])
        for t in queryset:
            writer.writerow([
                getattr(t.user, 'username', ''),
                t.type, t.amount, t.balance_after,
                t.source_type, t.source_id,
                t.meta, t.created_at
            ])
        return resp
    export_as_csv.short_description = "Export selected to CSV"


@admin.register(UserKYC)
class UserKYCAdmin(admin.ModelAdmin):
    list_display = ("user", "bank_name", "bank_account_number", "ifsc_code", "verified", "verified_by", "verified_at", "updated_at")
    list_filter = ("verified",)
    search_fields = ("user__username", "bank_account_number", "ifsc_code")
    raw_id_fields = ("user", "verified_by")
    readonly_fields = ("created_at", "updated_at")
    actions = ["mark_verified", "mark_unverified"]

    def mark_verified(self, request, queryset):
        from django.utils import timezone
        updated = 0
        for kyc in queryset:
            try:
                if not kyc.verified:
                    kyc.verified = True
                    kyc.verified_by = request.user
                    kyc.verified_at = timezone.now()
                    kyc.save(update_fields=["verified", "verified_by", "verified_at"])
                    updated += 1
            except Exception:
                continue
        self.message_user(request, f"Marked {updated} KYC record(s) as verified.")
    mark_verified.short_description = "Mark selected as verified"

    def mark_unverified(self, request, queryset):
        updated = 0
        for kyc in queryset:
            try:
                kyc.verified = False
                kyc.verified_by = None
                kyc.verified_at = None
                kyc.save(update_fields=["verified", "verified_by", "verified_at"])
                updated += 1
            except Exception:
                continue
        self.message_user(request, f"Marked {updated} KYC record(s) as unverified.")
    mark_unverified.short_description = "Mark selected as unverified"


@admin.register(WithdrawalRequest)
class WithdrawalRequestAdmin(admin.ModelAdmin):
    list_display = ("user", "amount", "method", "status", "requested_at", "decided_by", "decided_at", "payout_ref")
    list_filter = ("status", "method", "requested_at")
    search_fields = ("user__username", "payout_ref")
    raw_id_fields = ("user", "decided_by")
    readonly_fields = ("requested_at", "decided_at")
    actions = ["approve_selected", "reject_selected"]

    def approve_selected(self, request, queryset):
        updated = 0
        for wr in queryset:
            try:
                if getattr(wr, "status", "") == "pending":
                    wr.approve(actor=request.user)
                    updated += 1
            except Exception:
                continue
        self.message_user(request, f"Approved {updated} withdrawal(s).")
    approve_selected.short_description = "Approve selected withdrawals"

    def reject_selected(self, request, queryset):
        updated = 0
        for wr in queryset:
            try:
                if getattr(wr, "status", "") == "pending":
                    wr.reject(actor=request.user, reason="Rejected via admin action")
                    updated += 1
            except Exception:
                continue
        self.message_user(request, f"Rejected {updated} withdrawal(s).")
    reject_selected.short_description = "Reject selected withdrawals"
