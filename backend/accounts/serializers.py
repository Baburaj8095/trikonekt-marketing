from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.db.models import Q

from core.crypto import encrypt_string

from .models import CustomUser, AgencyRegionAssignment, WalletTransaction, Wallet, UserKYC, WithdrawalRequest, SupportTicket, SupportTicketMessage
from locations.models import Country, State, City



AGENCY_CATEGORIES = {
    'agency_state_coordinator',
    'agency_state',
    'agency_district_coordinator',
    'agency_district',
    'agency_pincode_coordinator',
    'agency_pincode',
    'agency_sub_franchise',
}

# Assignment caps per spec
MAX_STATES_PER_SC = 2           # State Coordinator can select max 2 states
MAX_DISTRICTS_PER_DC = 4        # District Coordinator can manage max 4 districts
MAX_PINCODES_PER_PC = 4         # Pincode Coordinator can manage up to 4 pincodes


class RegisterSerializer(serializers.ModelSerializer):
    # Inputs
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    full_name = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    country = serializers.PrimaryKeyRelatedField(queryset=Country.objects.all(), required=False, allow_null=True)
    state = serializers.PrimaryKeyRelatedField(queryset=State.objects.all(), required=False, allow_null=True)
    city = serializers.PrimaryKeyRelatedField(queryset=City.objects.all(), required=False, allow_null=True)
    pincode = serializers.CharField(required=False, allow_blank=True)
    sponsor_id = serializers.CharField(required=True, allow_blank=False)
    category = serializers.ChoiceField(choices=[(code, code) for code, _ in CustomUser.CATEGORY_CHOICES], required=False, default='consumer')

    # Region assignment inputs (write-only)
    # For agency_state_coordinator
    assign_states = serializers.ListField(child=serializers.IntegerField(), required=False, write_only=True)

    # For agency_state and deeper levels
    selected_state = serializers.PrimaryKeyRelatedField(queryset=State.objects.all(), required=False, allow_null=True, write_only=True)

    # For agency_district_coordinator
    assign_districts = serializers.ListField(child=serializers.CharField(allow_blank=False), required=False, write_only=True)

    # For agency_district and deeper levels
    selected_district = serializers.CharField(required=False, allow_blank=True, write_only=True)

    # For agency_pincode_coordinator
    assign_pincodes = serializers.ListField(child=serializers.RegexField(r'^\d{6}$'), required=False, write_only=True)

    # For agency_pincode and agency_sub_franchise
    selected_pincode = serializers.RegexField(r'^\d{6}$', required=False, allow_blank=True, write_only=True)

    # Optional write-only helpers to resolve FK by names/codes coming from Geoapify
    country_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    country_code = serializers.CharField(required=False, allow_blank=True, write_only=True)  # iso2 like IN
    state_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    state_code = serializers.CharField(required=False, allow_blank=True, write_only=True)    # e.g. KA (may be unused)
    city_name = serializers.CharField(required=False, allow_blank=True, write_only=True)

    # Outputs
    username = serializers.CharField(read_only=True)
    unique_id = serializers.CharField(read_only=True)

    class Meta:
        model = CustomUser
        fields = (
            'id', 'username', 'unique_id', 'prefixed_id', 'prefix_code', 'email', 'password', 'role', 'category',
            'full_name', 'phone',
            'country', 'state', 'city', 'pincode', 'sponsor_id',
            # region assignment inputs
            'assign_states', 'selected_state', 'assign_districts', 'selected_district',
            'assign_pincodes', 'selected_pincode',
            # helper write-only inputs
            'country_name', 'country_code', 'state_name', 'state_code', 'city_name'
        )
        extra_kwargs = {
            'role': {'required': False},
        }

    def validate(self, attrs):
        category = attrs.get('category', 'consumer') or 'consumer'
        phone = (attrs.get('phone') or '').strip()
        sponsor = (attrs.get('sponsor_id') or '').strip()

        # Phone required for all non-business registrations; allow same phone for multiple accounts (different prefixes)
        if category != 'business':
            if not phone:
                raise serializers.ValidationError({'phone': 'Phone number is required.'})
            phone_digits = ''.join(c for c in phone if c.isdigit())
            if not phone_digits or len(phone_digits) != 10:
                raise serializers.ValidationError({'phone': 'Enter a valid 10-digit phone number.'})

        if category == 'business':
            raise serializers.ValidationError({'category': 'Business registration has moved. Use /api/business/register/.'})

        # Sponsor required: accept username, prefixed_id (with/without dash), phone digits, or unique_id
        if not sponsor:
            raise serializers.ValidationError({'sponsor_id': 'Sponsor ID is required.'})

        raw = sponsor.strip()
        q = Q(username__iexact=raw) | Q(prefixed_id__iexact=raw) | Q(unique_id__iexact=raw)
        # also support dashless prefixed codes
        t_no_dash = ''.join(ch for ch in raw if ch.isalnum())
        if t_no_dash and t_no_dash != raw:
            q = q | Q(prefixed_id__iexact=t_no_dash)
        digits = ''.join(ch for ch in raw if ch.isdigit())
        if digits:
            q = q | Q(phone__iexact=digits) | Q(username__iexact=digits)
        sponsor_user = CustomUser.objects.filter(q).first()
        if not sponsor_user:
            raise serializers.ValidationError({'sponsor_id': 'Sponsor not found. Use username/prefixed code/phone.'})

        # Enforce agency hierarchy transitions only for agency categories
        if category in AGENCY_CATEGORIES:
            # Admin/staff can only sponsor State Coordinators
            if getattr(sponsor_user, 'is_superuser', False) or getattr(sponsor_user, 'is_staff', False):
                # Admin/company sponsor can onboard any agency category (including sub-franchise)
                allowed_next = AGENCY_CATEGORIES
                sponsor_cat = 'admin'
            else:
                allowed = {
                    'agency_state_coordinator': {'agency_state'},
                    'agency_state': {'agency_district_coordinator'},
                    'agency_district_coordinator': {'agency_district'},
                    'agency_district': {'agency_pincode_coordinator'},
                    'agency_pincode_coordinator': {'agency_pincode'},
                    'agency_pincode': {'agency_sub_franchise'},
                    'agency_sub_franchise': {'agency_sub_franchise'},
                }
                sponsor_cat = getattr(sponsor_user, 'category', '') or ''
                allowed_next = allowed.get(sponsor_cat, set())

            if category not in allowed_next:
                raise serializers.ValidationError({
                    'category': f'Invalid category for sponsor. Sponsor category "{sponsor_cat}" can sponsor only {sorted(list(allowed_next))}.'
                })

            admin_relaxed = (getattr(sponsor_user, 'is_superuser', False) or getattr(sponsor_user, 'is_staff', False))
            # Region-level validations by category
            # Store resolved values for use in create()
            self._assign_states = []
            self._assign_districts = []
            self._assign_pincodes = []
            self._selected_state = None
            self._selected_district = None
            self._selected_pincode = None

            if category == 'agency_state_coordinator' and not admin_relaxed:
                ids = attrs.get('assign_states') or []
                if not ids:
                    raise serializers.ValidationError({'assign_states': 'At least one state must be selected.'})
                if len(ids) > MAX_STATES_PER_SC:
                    raise serializers.ValidationError({'assign_states': f'Maximum {MAX_STATES_PER_SC} states allowed.'})
                # Admin sponsor has no assignments; allow any states
                states_qs = State.objects.filter(id__in=ids)
                if states_qs.count() != len(set(ids)):
                    raise serializers.ValidationError({'assign_states': 'One or more selected states are invalid.'})
                self._assign_states = list(states_qs)

            elif category == 'agency_state_coordinator' and admin_relaxed:
                ids = attrs.get('assign_states') or []
                # Optional: accept any provided here; caps enforced in admin distribution.
                states_qs = State.objects.filter(id__in=ids) if ids else State.objects.none()
                self._assign_states = list(states_qs)
            elif category == 'agency_state' and not admin_relaxed:
                sel_state = attrs.get('selected_state')
                if not sel_state:
                    raise serializers.ValidationError({'selected_state': 'State selection is required.'})
                # Validate that sponsor has this state assignment (unless sponsor is admin, which can't sponsor this category anyway)
                ok = AgencyRegionAssignment.objects.filter(user=sponsor_user, level='state', state=sel_state).exists()
                if not ok:
                    raise serializers.ValidationError({'selected_state': 'Selected state is not under the sponsor\'s assignment.'})
                self._selected_state = sel_state

            elif category == 'agency_state' and admin_relaxed:
                sel_state = attrs.get('selected_state')
                self._selected_state = sel_state if sel_state else None
            elif category == 'agency_district_coordinator':
                sel_state = attrs.get('selected_state')
                if not sel_state:
                    raise serializers.ValidationError({'selected_state': 'State selection is required.'})
                ok = AgencyRegionAssignment.objects.filter(user=sponsor_user, level='state', state=sel_state).exists()
                if not ok:
                    raise serializers.ValidationError({'selected_state': 'Selected state is not under the sponsor\'s assignment.'})
                districts = [d.strip() for d in (attrs.get('assign_districts') or []) if d and str(d).strip()]
                if not districts:
                    raise serializers.ValidationError({'assign_districts': 'At least one district must be provided.'})
                if len(districts) > MAX_DISTRICTS_PER_DC:
                    raise serializers.ValidationError({'assign_districts': f'Maximum {MAX_DISTRICTS_PER_DC} districts allowed.'})
                self._selected_state = sel_state
                # de-dup case-insensitively but preserve order
                seen = set()
                normed = []
                for d in districts:
                    key = d.lower()
                    if key not in seen:
                        seen.add(key)
                        normed.append(d)
                self._assign_districts = normed

            elif category == 'agency_district':
                sel_state = attrs.get('selected_state')
                sel_district = (attrs.get('selected_district') or '').strip()
                if not sel_state:
                    raise serializers.ValidationError({'selected_state': 'State selection is required.'})
                if not sel_district:
                    raise serializers.ValidationError({'selected_district': 'District selection is required.'})
                ok = AgencyRegionAssignment.objects.filter(
                    user=sponsor_user, level='district', state=sel_state, district__iexact=sel_district
                ).exists()
                if not ok:
                    raise serializers.ValidationError({'selected_district': 'Selected district is not under the sponsor\'s assignment.'})
                self._selected_state = sel_state
                self._selected_district = sel_district

            elif category == 'agency_pincode_coordinator':
                sel_state = attrs.get('selected_state')
                sel_district = (attrs.get('selected_district') or '').strip()
                if not sel_state:
                    raise serializers.ValidationError({'selected_state': 'State selection is required.'})
                if not sel_district:
                    raise serializers.ValidationError({'selected_district': 'District selection is required.'})
                ok = AgencyRegionAssignment.objects.filter(
                    user=sponsor_user, level='district', state=sel_state, district__iexact=sel_district
                ).exists()
                if not ok:
                    raise serializers.ValidationError({'selected_district': 'Selected district is not under the sponsor\'s assignment.'})
                pins = [p for p in (attrs.get('assign_pincodes') or []) if p]
                if not pins:
                    raise serializers.ValidationError({'assign_pincodes': 'At least one pincode must be provided.'})
                if len(pins) > MAX_PINCODES_PER_PC:
                    raise serializers.ValidationError({'assign_pincodes': f'Maximum {MAX_PINCODES_PER_PC} pincodes allowed.'})
                # de-dup preserve order
                seenp = set()
                Pins = []
                for p in pins:
                    if p not in seenp:
                        seenp.add(p)
                        Pins.append(p)
                self._selected_state = sel_state
                self._selected_district = sel_district
                self._assign_pincodes = Pins

            elif category == 'agency_pincode':
                sel_pin = (attrs.get('selected_pincode') or '').strip()
                if not sel_pin:
                    raise serializers.ValidationError({'selected_pincode': 'Pincode selection is required.'})
                ok = AgencyRegionAssignment.objects.filter(
                    user=sponsor_user, level='pincode', pincode=sel_pin
                ).exists()
                if not ok:
                    raise serializers.ValidationError({'selected_pincode': 'Selected pincode is not under the sponsor\'s assignment.'})
                self._selected_pincode = sel_pin

            elif category == 'agency_sub_franchise':
                sel_pin = (attrs.get('selected_pincode') or '').strip()
                if not sel_pin:
                    raise serializers.ValidationError({'selected_pincode': 'Pincode selection is required.'})
                # Allow any valid 6-digit pincode for sub-franchise; no sponsor assignment restriction
                self._selected_pincode = sel_pin

        # Keep a reference for use in create()
        self._sponsor_user = sponsor_user

        # Enforce per-role username uniqueness (and special consumer rule)
        try:
            phone_digits = ''.join(c for c in (phone or '') if c.isdigit())
        except Exception:
            phone_digits = (phone or '')
        username_base = self._build_username(category, phone_digits, '')
        # USERNAME_FIELD is globally unique; enforce against username only.
        if CustomUser.objects.filter(username__iexact=username_base).exists():
            if category == 'consumer':
                # Deterministic username TR+phone => same phone implies same username for consumer
                raise serializers.ValidationError({'phone': 'Consumer already exists for this phone number.'})
            raise serializers.ValidationError({'detail': 'Username already exists.'})

        # Basic email validation presence is optional; rely on DRF internal if provided
        return attrs

    def _resolve_locations(self, validated_data):
        country = validated_data.pop('country', None)
        state = validated_data.pop('state', None)
        city = validated_data.pop('city', None)
        # helper write-only values from Geoapify
        country_name = (validated_data.pop('country_name', '') or '').strip()
        country_code = (validated_data.pop('country_code', '') or '').strip()
        state_name = (validated_data.pop('state_name', '') or '').strip()
        state_code = (validated_data.pop('state_code', '') or '').strip()
        city_name = (validated_data.pop('city_name', '') or '').strip()

        # Best-effort resolve by code/name when PKs weren't provided
        if country is None and (country_code or country_name):
            country_qs = Country.objects.all()
            if country_code:
                c = country_qs.filter(iso2__iexact=country_code).first()
                if c:
                    country = c
            if country is None and country_name:
                c = country_qs.filter(name__iexact=country_name).first()
                if c:
                    country = c

        if state is None and state_name and country is not None:
            s = State.objects.filter(country=country, name__iexact=state_name).first()
            if s is None:
                s = State.objects.filter(country=country, name__icontains=state_name).first()
            if s:
                state = s

        if city is None and city_name and state is not None:
            ci = City.objects.filter(state=state, name__iexact=city_name).first()
            if ci is None:
                ci = City.objects.filter(state=state, name__icontains=city_name).first()
            if ci:
                city = ci

        return country, state, city

    def _derive_role(self, category: str) -> str:
        if category in AGENCY_CATEGORIES:
            return 'agency'
        if category == 'employee':
            return 'employee'
        # consumer and business default to basic user
        return 'user'

    def _build_username(self, category: str, phone: str, unique_id: str) -> str:
        """
        Generate admin-friendly usernames using prefixes by category.
        - Consumer: TR+phone
        - Employee: TREP+phone
        - Sub-Franchise: TRSF+phone
        - Pincode Agency: TRPN+phone
        - State Agency: TRST+phone
        - District Agency: TRDT+phone
        - Business: TRBS+phone
        - Coordinators (state/district/pincode): unchanged scheme -> use phone only (no prefix)
        """
        phone_digits = ''.join(c for c in (phone or '') if c.isdigit())

        coordinator_cats = {
            'agency_state_coordinator',
            'agency_district_coordinator',
            'agency_pincode_coordinator',
        }

        prefix_map = {
            'consumer': 'TR',
            'employee': 'TREP',
            'agency_sub_franchise': 'TRSF',
            'agency_pincode': 'TRPN',
            'agency_state': 'TRST',
            'agency_district': 'TRDT',
            'business': 'TRBS',
        }

        if category in coordinator_cats:
            base = phone_digits  # do not change coordinator usernames
        else:
            pref = prefix_map.get(category)
            if pref:
                base = f"{pref}{phone_digits}"
            else:
                # default to consumer-like prefix
                base = f"TR{phone_digits}"

        username = base
        return username

    @transaction.atomic
    def create(self, validated_data):
        request = self.context.get('request')
        # resolve FKs (may be overridden by selected values for agency categories)
        country, state, city = self._resolve_locations(validated_data)

        full_name = validated_data.pop('full_name', '')
        phone = (validated_data.pop('phone', '') or '').strip()
        phone_digits = ''.join(c for c in phone if c.isdigit())
        pincode = validated_data.pop('pincode', '')
        sponsor_id = validated_data.pop('sponsor_id', '')
        category = validated_data.pop('category', 'consumer') or 'consumer'

        # Region assignment inputs (write-only) already validated and cached on self.*
        # But pop from validated_data to avoid passing to create_user
        validated_data.pop('assign_states', None)
        validated_data.pop('selected_state', None)
        validated_data.pop('assign_districts', None)
        validated_data.pop('selected_district', None)
        validated_data.pop('assign_pincodes', None)
        validated_data.pop('selected_pincode', None)

        # Decide role if not explicitly provided
        role = validated_data.get('role')
        if not role:
            role = self._derive_role(category)

        # Pre-generate 6-digit id for this registration
        unique_id = CustomUser.generate_unique_id()

        # Build username based on category rules
        username = self._build_username(category, phone_digits, unique_id)

        # Determine who registered this account:
        # Prefer the sponsor user (by username) as the parent link; fall back to the authenticated actor.
        registered_by = getattr(self, '_sponsor_user', None)
        if not registered_by and request and request.user and request.user.is_authenticated:
            registered_by = request.user

        # Create user with registered_by set BEFORE first save so post_save can credit sponsor
        user = CustomUser(
            username=username,
            email=validated_data.get('email', ''),
            role=role,
            category=category,
            unique_id=unique_id,
            full_name=full_name,
            phone=phone_digits,
            pincode=pincode,
            country=country,
            state=state,
            city=city,
            registered_by=registered_by,
        )
        # Store upline's code in sponsor_id; keep user's own referral code in prefixed_id (allocated on save)
        try:
            if registered_by:
                user.sponsor_id = getattr(registered_by, "username", "") or sponsor_id
            else:
                user.sponsor_id = sponsor_id
        except Exception:
            user.sponsor_id = sponsor_id
        pwd_raw = validated_data.get('password')
        user.set_password(pwd_raw)
        try:
            user.last_password_encrypted = encrypt_string(pwd_raw)
        except Exception:
            user.last_password_encrypted = user.last_password_encrypted or None
        user.save()  # triggers post_save(created=True) with registered_by present

        # Post-create agency region handling
        if category in AGENCY_CATEGORIES:
            # Override fields based on selected inputs and create assignments accordingly
            if category == 'agency_state_coordinator':
                # Assign states
                for st in getattr(self, '_assign_states', []):
                    AgencyRegionAssignment.objects.create(
                        user=user, level='state', state=st
                    )

            elif category == 'agency_state':
                sel_state = getattr(self, '_selected_state', None)
                if sel_state:
                    user.state = sel_state
                    AgencyRegionAssignment.objects.create(
                        user=user, level='state', state=sel_state
                    )

            elif category == 'agency_district_coordinator':
                sel_state = getattr(self, '_selected_state', None)
                if sel_state:
                    user.state = sel_state
                for d in getattr(self, '_assign_districts', []):
                    AgencyRegionAssignment.objects.create(
                        user=user, level='district', state=sel_state, district=d
                    )

            elif category == 'agency_district':
                sel_state = getattr(self, '_selected_state', None)
                sel_district = getattr(self, '_selected_district', None)
                if sel_state:
                    user.state = sel_state
                if sel_state and sel_district:
                    # District user should sponsor pincode coordinators => hold district assignment
                    AgencyRegionAssignment.objects.create(
                        user=user, level='district', state=sel_state, district=sel_district
                    )

            elif category == 'agency_pincode_coordinator':
                sel_state = getattr(self, '_selected_state', None)
                sel_district = getattr(self, '_selected_district', None)
                if sel_state:
                    user.state = sel_state
                for pin in getattr(self, '_assign_pincodes', []):
                    AgencyRegionAssignment.objects.create(
                        user=user, level='pincode', state=sel_state, district=sel_district, pincode=pin
                    )

            elif category == 'agency_pincode':
                sel_pin = getattr(self, '_selected_pincode', None)
                if sel_pin:
                    user.pincode = sel_pin
                    # Pincode user should sponsor sub-franchise => hold pincode assignment
                    AgencyRegionAssignment.objects.create(
                        user=user, level='pincode', pincode=sel_pin
                    )

            elif category == 'agency_sub_franchise':
                sel_pin = getattr(self, '_selected_pincode', None)
                if sel_pin:
                    user.pincode = sel_pin

        user.save()
        return user


class PublicUserSerializer(serializers.ModelSerializer):
    country = serializers.StringRelatedField()
    state = serializers.StringRelatedField()
    city = serializers.StringRelatedField()
    registered_by_username = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'unique_id', 'prefixed_id', 'prefix_code', 'email', 'full_name', 'phone',
            'country', 'state', 'city', 'pincode', 'address', 'sponsor_id',
            'category', 'role', 'registered_by', 'registered_by_username',
            'avatar_url',
            'date_joined', 'is_active'
        ]
        read_only_fields = fields

    def get_registered_by_username(self, obj):
        return getattr(obj.registered_by, 'username', None)

    def get_avatar_url(self, obj):
        try:
            f = getattr(obj, 'avatar', None)
            if f and getattr(f, 'url', None):
                return f.url
        except Exception:
            pass
        return None


class ProfileMeSerializer(serializers.ModelSerializer):
    country = serializers.PrimaryKeyRelatedField(queryset=Country.objects.all(), required=False, allow_null=True)
    state = serializers.PrimaryKeyRelatedField(queryset=State.objects.all(), required=False, allow_null=True)
    city = serializers.PrimaryKeyRelatedField(queryset=City.objects.all(), required=False, allow_null=True)
    avatar = serializers.ImageField(required=False, allow_null=True)
    avatar_url = serializers.SerializerMethodField(read_only=True)
    age = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=120)

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'email', 'full_name', 'phone', 'age',
            'country', 'state', 'city', 'pincode', 'address',
            'avatar', 'avatar_url',
        ]
        read_only_fields = ['id', 'username', 'avatar_url']

    def get_avatar_url(self, obj):
        try:
            f = getattr(obj, 'avatar', None)
            if f and getattr(f, 'url', None):
                return f.url
        except Exception:
            pass
        return None

class UserKYCSerializer(serializers.ModelSerializer):
    can_submit_kyc = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = UserKYC
        fields = [
            "bank_name",
            "bank_account_number",
            "ifsc_code",
            "verified",
            "verified_at",
            "kyc_reopen_allowed",
            "can_submit_kyc",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["verified", "verified_at", "kyc_reopen_allowed", "can_submit_kyc", "created_at", "updated_at"]

    def get_can_submit_kyc(self, obj):
        try:
            return (not bool(getattr(obj, "verified", False))) or bool(getattr(obj, "kyc_reopen_allowed", False))
        except Exception:
            return True

    def update(self, instance, validated_data):
        """
        Guard: Once KYC is verified, user cannot modify unless kyc_reopen_allowed=True.
        On any successful edit, reset verified=False and consume the reopen allowance.
        """
        # If already verified and not reopened via support, block update
        if bool(getattr(instance, "verified", False)) and not bool(getattr(instance, "kyc_reopen_allowed", False)):
            raise serializers.ValidationError({
                "detail": "KYC already verified. Please create a Support ticket to request re-verification.",
                "code": "KYC_LOCKED"
            })

        # Perform updates
        for f in ("bank_name", "bank_account_number", "ifsc_code"):
            if f in validated_data:
                setattr(instance, f, validated_data[f])

        # If previously verified, mark unverified after change
        if bool(getattr(instance, "verified", False)):
            instance.verified = False
            instance.verified_at = None
            instance.verified_by = None

        # Consume reopen allowance after any edit
        instance.kyc_reopen_allowed = False
        instance.save()
        return instance


class SupportTicketMessageSerializer(serializers.ModelSerializer):
    author_username = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = SupportTicketMessage
        fields = ["id", "author", "author_username", "message", "created_at"]
        read_only_fields = ["id", "author_username", "created_at", "author"]

    def get_author_username(self, obj):
        try:
            return getattr(obj.author, "username", None)
        except Exception:
            return None


class SupportTicketSerializer(serializers.ModelSerializer):
    messages = SupportTicketMessageSerializer(many=True, read_only=True)
    user_username = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            "id",
            "user",
            "user_username",
            "type",
            "subject",
            "message",
            "status",
            "admin_assignee",
            "resolution_note",
            "created_at",
            "updated_at",
            "messages",
        ]
        read_only_fields = ["status", "user", "admin_assignee", "resolution_note", "created_at", "updated_at", "messages", "user_username"]

    def get_user_username(self, obj):
        try:
            return getattr(obj.user, "username", None)
        except Exception:
            return None

    def validate(self, attrs):
        # Enforce only one open/in_progress KYC_REVERIFY per user
        req = self.context.get("request")
        user = getattr(req, "user", None) if req else None
        t = (attrs.get("type") or "").strip()
        if user and t == "KYC_REVERIFY":
            exists = SupportTicket.objects.filter(
                user=user, type="KYC_REVERIFY", status__in=["open", "in_progress"]
            ).exists()
            if exists:
                raise serializers.ValidationError({"detail": "An open KYC re-verification request already exists."})
        return attrs

    def create(self, validated_data):
        req = self.context.get("request")
        user = getattr(req, "user", None) if req else None
        if user and not validated_data.get("user"):
            validated_data["user"] = user
        return super().create(validated_data)


class WithdrawalRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = WithdrawalRequest
        fields = [
            "id",
            "amount",
            "method",
            "upi_id",
            "bank_name",
            "bank_account_number",
            "ifsc_code",
            "note",
            "status",
            "requested_at",
            "decided_at",
            "payout_ref",
        ]
        read_only_fields = ["status", "requested_at", "decided_at", "payout_ref"]

    def validate(self, attrs):
        from decimal import Decimal
        amt = attrs.get("amount")
        try:
            if amt is None or Decimal(amt) <= 0:
                raise serializers.ValidationError({"amount": "Amount must be greater than 0."})
        except Exception:
            raise serializers.ValidationError({"amount": "Invalid amount."})

        # Only bank withdrawals are supported
        method = (attrs.get("method") or "bank").lower()
        if method != "bank":
            raise serializers.ValidationError({"method": "Only bank withdrawals are supported."})
        attrs["method"] = "bank"
        # Bank details may be filled from KYC in create()
        return attrs

    def create(self, validated_data):
        """
        Create a withdrawal request with the following business rules:
        - KYC must be verified
        - Wallet balance must be >= ₹500 (enable threshold) AND >= requested amount
        - Only one request allowed within each Wednesday 7PM-9PM (IST) window
        - Requests can only be made on Wednesday between 19:00 and 21:00 IST
        """
        from decimal import Decimal
        from datetime import datetime, time, timedelta, timezone as dt_timezone
        from zoneinfo import ZoneInfo
        from django.utils import timezone
        from .models import WithdrawalRequest, Wallet

        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError({"detail": "Authentication required."})

        # Normalize method + bank fields (will hydrate from KYC later if needed)
        method = (validated_data.get("method") or "bank").lower()
        bank_name = (validated_data.get("bank_name") or "").strip()
        bank_acc = (validated_data.get("bank_account_number") or "").strip()
        ifsc = (validated_data.get("ifsc_code") or "").strip()

        # Amount checks (will also compare against wallet balance below)
        try:
            amount = Decimal(validated_data.get("amount"))
        except Exception:
            raise serializers.ValidationError({"amount": "Invalid amount."})
        if amount <= 0:
            raise serializers.ValidationError({"amount": "Amount must be greater than 0."})

        # KYC must be verified
        try:
            kyc = getattr(user, "kyc", None)
        except Exception:
            kyc = None
        if not kyc or not getattr(kyc, "verified", False):
            raise serializers.ValidationError({"detail": "KYC verification required to request withdrawal.", "code": "KYC_REQUIRED"})

        # Wallet balance must be >= 500 and >= requested amount
        w = Wallet.get_or_create_for_user(user)
        try:
            bal = Decimal(w.balance or 0)
        except Exception:
            bal = Decimal("0")
        if bal < Decimal("500"):
            short = (Decimal("500") - bal)
            raise serializers.ValidationError({
                "detail": "Minimum balance ₹500 required to enable withdrawals.",
                "code": "INSUFFICIENT_MIN_BALANCE",
                "short_by": str(short.quantize(Decimal("0.01"))),
            })
        if amount > bal:
            raise serializers.ValidationError({"detail": "Insufficient wallet balance.", "code": "INSUFFICIENT_BALANCE"})

        # Enforce Wednesday 7PM-9PM IST window
        IST = ZoneInfo("Asia/Kolkata")
        now_local = timezone.now().astimezone(IST)

        # Compute this week's Wednesday date
        # weekday: Mon=0 ... Wed=2
        days_from_wed = now_local.weekday() - 2  # positive if after Wed, negative if before
        wed_date = now_local.date() - timedelta(days=days_from_wed)

        window_start_local = datetime.combine(wed_date, time(19, 0), IST)
        window_end_local = datetime.combine(wed_date, time(21, 0), IST)

        # Determine current/next window info
        if now_local < window_start_local:
            # Not yet opened this week
            next_window_start_local = window_start_local
        elif now_local >= window_end_local:
            # Window is over; next week's Wednesday
            next_wed_date = wed_date + timedelta(days=7)
            next_window_start_local = datetime.combine(next_wed_date, time(19, 0), IST)
        else:
            # We are inside the window
            next_window_start_local = window_start_local

        if not (window_start_local <= now_local < window_end_local):
            raise serializers.ValidationError({
                "detail": "Withdrawals can be requested only on Wednesday between 7:00 PM and 9:00 PM (IST).",
                "code": "WINDOW_CLOSED",
                "next_window_at": next_window_start_local.astimezone(dt_timezone.utc).isoformat(),
                "next_window_at_ist": next_window_start_local.isoformat(),
            })

        # Limit to 1 request per weekly window (this Wednesday 19:00-21:00 IST)
        window_start_utc = window_start_local.astimezone(dt_timezone.utc)
        window_end_utc = window_end_local.astimezone(dt_timezone.utc)
        exists_in_window = WithdrawalRequest.objects.filter(
            user=user,
            requested_at__gte=window_start_utc,
            requested_at__lt=window_end_utc,
        ).exclude(status="rejected").exists()
        if exists_in_window:
            # Next allowed window is next week's Wednesday
            next_wed_date = wed_date + timedelta(days=7)
            next_window_start_local = datetime.combine(next_wed_date, time(19, 0), IST)
            raise serializers.ValidationError({
                "detail": "Only one withdrawal request is allowed per week.",
                "code": "WEEKLY_LIMIT_REACHED",
                "next_window_at": next_window_start_local.astimezone(dt_timezone.utc).isoformat(),
                "next_window_at_ist": next_window_start_local.isoformat(),
            })

        # If bank method and missing fields, hydrate from KYC
        if method == "bank" and (not bank_acc or not ifsc):
            try:
                if kyc:
                    bank_name = bank_name or (kyc.bank_name or "")
                    bank_acc = bank_acc or (kyc.bank_account_number or "")
                    ifsc = ifsc or (kyc.ifsc_code or "")
            except Exception:
                pass
            if not bank_acc or not ifsc:
                raise serializers.ValidationError({"detail": "Bank account number and IFSC are required for bank withdrawals."})

        # Create pending withdrawal request (no immediate debit; debit on admin approval)
        wr = WithdrawalRequest.objects.create(
            user=user,
            amount=amount,
            method="bank",
            upi_id=(validated_data.get("upi_id") or "").strip(),
            bank_name=bank_name,
            bank_account_number=bank_acc,
            ifsc_code=ifsc,
            note=(validated_data.get("note") or ""),
        )
        return wr
