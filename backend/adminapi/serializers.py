from rest_framework import serializers
from accounts.models import CustomUser, WithdrawalRequest, UserKYC, WalletTransaction, SupportTicket, SupportTicketMessage
from market.models import PurchaseRequest, BannerPurchaseRequest
from business.models import UserMatrixProgress, CommissionConfig
from locations.models import Country, State, City
from core.crypto import encrypt_string, decrypt_string


class AdminUserNodeSerializer(serializers.ModelSerializer):
    state_name = serializers.SerializerMethodField()
    country_name = serializers.SerializerMethodField()
    district_name = serializers.SerializerMethodField()
    sponsor_id = serializers.SerializerMethodField()
    wallet_balance = serializers.SerializerMethodField()
    wallet_status = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    kyc_verified = serializers.SerializerMethodField()
    kyc_verified_at = serializers.SerializerMethodField()
    kyc_status = serializers.SerializerMethodField()
    commission_level = serializers.SerializerMethodField()
    direct_count = serializers.IntegerField(read_only=True)
    has_children = serializers.SerializerMethodField()
    has_usable_password = serializers.SerializerMethodField()
    password_status = serializers.SerializerMethodField()
    password_algo = serializers.SerializerMethodField()
    password_plain = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "username",
            "full_name",
            "email",
            "role",
            "category",
            "phone",
            "pincode",
            "district_name",
            "state_name",
            "country_name",
            "sponsor_id",
            "date_joined",
            "wallet_balance",
            "wallet_status",
            "avatar_url",
            "is_active",
            "direct_count",
            "has_children",
            "has_usable_password",
            "password_status",
            "password_algo",
            "password_plain",
            "kyc_verified",
            "kyc_verified_at",
            "kyc_status",
            "commission_level",
            "account_active",
        ]

    def get_state_name(self, obj):
        try:
            return obj.state.name if getattr(obj, "state_id", None) else ""
        except Exception:
            return ""

    def get_country_name(self, obj):
        try:
            return obj.country.name if getattr(obj, "country_id", None) else ""
        except Exception:
            return ""

    def get_district_name(self, obj):
        try:
            # Map "District" to City model's name (as per schema)
            return obj.city.name if getattr(obj, "city_id", None) else ""
        except Exception:
            return ""

    def get_sponsor_id(self, obj):
        try:
            # Prefer the actual upline (registered_by) used during registration
            rb = getattr(obj, "registered_by", None)
            sid = (getattr(obj, "sponsor_id", "") or "").strip()

            if rb:
                # Username is commonly used as sponsor code; fallback to prefixed_id
                val = (getattr(rb, "username", "") or "").strip() or (getattr(rb, "prefixed_id", "") or "").strip()
                if val:
                    return val

            # If stored sponsor_id equals self identifiers, hide it
            uname = (getattr(obj, "username", "") or "").strip()
            pid = (getattr(obj, "prefixed_id", "") or "").strip()
            pid2 = pid.replace("-", "") if pid else ""
            if sid and sid.lower() in {uname.lower(), pid.lower(), pid2.lower()}:
                return ""

            return sid
        except Exception:
            return (getattr(obj, "sponsor_id", "") or "")

    def get_wallet_balance(self, obj):
        try:
            w = getattr(obj, "wallet", None)
            if not w:
                return ""
            # Prefer main_balance if present, fall back to balance
            bal = getattr(w, "main_balance", None)
            if bal is None:
                bal = getattr(w, "balance", None)
            return float(bal) if bal is not None else ""
        except Exception:
            return ""

    def get_wallet_status(self, obj):
        try:
            # No explicit status field in Wallet; show "OK" if wallet exists
            return "OK" if getattr(obj, "wallet", None) else ""
        except Exception:
            return ""

    def get_avatar_url(self, obj):
        try:
            file = getattr(obj, "avatar", None)
            if not file:
                return ""
            url = getattr(file, "url", "") or ""
            if not url:
                return ""
            req = getattr(self, "context", {}).get("request", None)
            if req:
                try:
                    return req.build_absolute_uri(url)
                except Exception:
                    pass
            return url
        except Exception:
            return ""

    def get_has_children(self, obj):
        try:
            dc = getattr(obj, "direct_count", 0) or 0
            return dc > 0
        except Exception:
            return False

    def get_kyc_verified(self, obj):
        try:
            kyc = getattr(obj, "kyc", None)
            return bool(getattr(kyc, "verified", False)) if kyc else False
        except Exception:
            return False

    def get_kyc_verified_at(self, obj):
        try:
            kyc = getattr(obj, "kyc", None)
            return getattr(kyc, "verified_at", None) if kyc else None
        except Exception:
            return None

    def get_kyc_status(self, obj):
        try:
            kyc = getattr(obj, "kyc", None)
            if not kyc:
                return ""
            return "Verified" if bool(getattr(kyc, "verified", False)) else "Pending"
        except Exception:
            return ""

    def get_commission_level(self, obj):
        try:
            # Prefer prefetched related manager 'matrix_progress'
            mp = getattr(obj, "matrix_progress", None)
            items = None
            try:
                items = list(mp.all()) if mp is not None else None
            except Exception:
                items = None
            if items is None:
                items = list(UserMatrixProgress.objects.filter(user_id=getattr(obj, "id", None)))
            lvl = 0
            for rec in (items or []):
                try:
                    lvl = max(lvl, int(getattr(rec, "level_reached", 0) or 0))
                except Exception:
                    pass
            return int(lvl)
        except Exception:
            return 0

    def get_has_usable_password(self, obj):
        """
        Return True only when a real, usable hashed password is present.
        Handle edge cases where password is empty string ('') which Django's
        has_usable_password may treat as usable in some versions.
        """
        try:
            from django.contrib.auth.hashers import UNUSABLE_PASSWORD_PREFIX
        except Exception:
            UNUSABLE_PASSWORD_PREFIX = "!"  # fallback

        try:
            pwd = getattr(obj, "password", "") or ""
            # Empty or too short strings are not real hashes
            if not isinstance(pwd, str) or len(pwd) < 20:
                return False
            # Explicit unusable marker
            if pwd.startswith(UNUSABLE_PASSWORD_PREFIX):
                return False
            # Prefer model API if available
            if hasattr(obj, "has_usable_password"):
                try:
                    return bool(obj.has_usable_password())
                except Exception:
                    pass
            # Heuristic: known hash prefixes
            known_prefixes = ("pbkdf2_", "argon2", "bcrypt", "scrypt")
            return any(pwd.startswith(pfx) for pfx in known_prefixes)
        except Exception:
            return False

    def get_password_status(self, obj):
        """
        Human-readable password status for admin grid: Usable | Unusable | Empty.
        """
        try:
            pwd = getattr(obj, "password", "") or ""
            if not isinstance(pwd, str) or len(pwd) < 20:
                return "Empty"
            try:
                from django.contrib.auth.hashers import UNUSABLE_PASSWORD_PREFIX
                if pwd.startswith(UNUSABLE_PASSWORD_PREFIX):
                    return "Unusable"
            except Exception:
                pass
            if hasattr(obj, "has_usable_password"):
                try:
                    return "Usable" if obj.has_usable_password() else "Unusable"
                except Exception:
                    pass
            # Fallback heuristic
            known_prefixes = ("pbkdf2_", "argon2", "bcrypt", "scrypt")
            return "Usable" if any(pwd.startswith(pfx) for pfx in known_prefixes) else "Unusable"
        except Exception:
            return "Empty"

    def get_password_algo(self, obj):
        """
        Return the password hash algorithm (e.g., pbkdf2_sha256, bcrypt, argon2).
        Do NOT expose the hash or salt; only a readable algorithm label.
        Empty string when password is empty or unusable.
        """
        try:
            from django.contrib.auth.hashers import UNUSABLE_PASSWORD_PREFIX
        except Exception:
            UNUSABLE_PASSWORD_PREFIX = "!"  # fallback

        try:
            pwd = getattr(obj, "password", "") or ""
            if not isinstance(pwd, str) or len(pwd) < 20:
                return ""
            if pwd.startswith(UNUSABLE_PASSWORD_PREFIX):
                return ""
            # Django encoded passwords are "algorithm$..." (pbkdf2_sha256$..., bcrypt$..., argon2$argon2id$...)
            algo = pwd.split("$", 1)[0]
            return str(algo) if algo else ""
        except Exception:
            return ""


    def get_password_plain(self, obj):
        # Performance guard: never decrypt in list views
        try:
            ctx = getattr(self, "context", {}) or {}
            if ctx.get("purpose") != "detail":
                return ""
            req = ctx.get("request")
            u = getattr(req, "user", None) if req else None
            # Allow both superusers and staff (admin panel operators) to view last-set plaintext
            if not u or not (getattr(u, "is_superuser", False) or getattr(u, "is_staff", False)):
                return ""
            token = getattr(obj, "last_password_encrypted", None)
            if not token:
                return ""
            plain = decrypt_string(token)
            return plain or ""
        except Exception:
            return ""


class AdminKYCSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    state_name = serializers.SerializerMethodField()
    pincode = serializers.CharField(source="user.pincode", read_only=True)

    class Meta:
        model = UserKYC
        fields = [
            "user_id",
            "username",
            "full_name",
            "phone",
            "state_name",
            "pincode",
            "bank_name",
            "bank_account_number",
            "ifsc_code",
            "verified",
            "verified_at",
            "updated_at",
        ]

    def get_state_name(self, obj):
        try:
            st = getattr(obj.user, "state", None)
            return st.name if st else ""
        except Exception:
            return ""


class AdminWithdrawalSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)

    class Meta:
        model = WithdrawalRequest
        fields = [
            "id",
            "user_id",
            "username",
            "full_name",
            "phone",
            "amount",
            "method",
            "upi_id",
            "bank_name",
            "bank_account_number",
            "ifsc_code",
            "status",
            "note",
            "payout_ref",
            "requested_at",
            "decided_at",
        ]


class AdminMatrixProgressSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)

    class Meta:
        model = UserMatrixProgress
        fields = [
            "user_id",
            "username",
            "full_name",
            "phone",
            "pool_type",
            "total_earned",
            "level_reached",
            "per_level_counts",
            "per_level_earned",
            "updated_at",
        ]


class AdminWalletTransactionSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = WalletTransaction
        fields = [
            "id",
            "user_id",
            "username",
            "type",
            "amount",
            "balance_after",
            "meta",
            "created_at",
        ]


class AdminAutopoolTxnSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    prefixed_id = serializers.SerializerMethodField()
    sponsor_id = serializers.SerializerMethodField()
    net_amount = serializers.SerializerMethodField()
    main_balance = serializers.SerializerMethodField()
    withdrawable_balance = serializers.SerializerMethodField()

    class Meta:
        model = WalletTransaction
        fields = [
            "id",
            "user_id",
            "username",
            "full_name",
            "prefixed_id",
            "sponsor_id",
            "type",
            "source_type",
            "amount",
            "net_amount",
            "main_balance",
            "withdrawable_balance",
            "created_at",
        ]

    def get_prefixed_id(self, obj):
        try:
            return getattr(obj.user, "prefixed_id", "") or ""
        except Exception:
            return ""

    def get_sponsor_id(self, obj):
        try:
            return getattr(obj.user, "sponsor_id", "") or ""
        except Exception:
            return ""

    def get_net_amount(self, obj):
        try:
            meta = getattr(obj, "meta", None) or {}
            net = meta.get("net")
            if net is None:
                # No withholding meta recorded -> treat gross as net
                return float(obj.amount or 0)
            try:
                return float(net)
            except Exception:
                from decimal import Decimal as D
                return float(D(str(net or "0")))
        except Exception:
            return float(obj.amount or 0)

    def get_main_balance(self, obj):
        try:
            w = getattr(obj.user, "wallet", None)
            if not w:
                return 0.0
            return float(getattr(w, "main_balance", 0) or 0)
        except Exception:
            return 0.0

    def get_withdrawable_balance(self, obj):
        try:
            w = getattr(obj.user, "wallet", None)
            if not w:
                return 0.0
            return float(getattr(w, "withdrawable_balance", 0) or 0)
        except Exception:
            return 0.0


class AdminUserEditSerializer(serializers.ModelSerializer):
    """
    Admin-side editable fields for a user. Primary keys for geo fields.
    """
    country = serializers.PrimaryKeyRelatedField(queryset=Country.objects.all(), required=False, allow_null=True)
    state = serializers.PrimaryKeyRelatedField(queryset=State.objects.all(), required=False, allow_null=True)
    city = serializers.PrimaryKeyRelatedField(queryset=City.objects.all(), required=False, allow_null=True)
    # Write-only password field to allow admin reset; Django stores hashed passwords (non-reversible)
    password = serializers.CharField(write_only=True, required=False, allow_blank=False, min_length=8)

    class Meta:
        model = CustomUser
        fields = [
            "email",
            "full_name",
            "phone",
            "age",
            "address",
            "pincode",
            "role",
            "category",
            "country",
            "state",
            "city",
            "sponsor_id",
            "account_active",
            "is_active",
            "password",
        ]

    def update(self, instance, validated_data):
        # Pop password if provided and set via set_password
        password = validated_data.pop("password", None)

        # Only superuser can modify sponsor_id; strip whitespace
        request = getattr(self, "context", {}).get("request", None)
        if "sponsor_id" in validated_data:
            is_super = bool(getattr(getattr(request, "user", None), "is_superuser", False))
            if not is_super:
                validated_data.pop("sponsor_id", None)
            else:
                sid = validated_data.get("sponsor_id")
                if isinstance(sid, str):
                    validated_data["sponsor_id"] = sid.strip()

        instance = super().update(instance, validated_data)
        if password:
            instance.set_password(password)
            # Store encrypted reversible copy (visible only to superusers)
            try:
                enc = encrypt_string(password)
                instance.last_password_encrypted = enc
                instance.save(update_fields=["password", "last_password_encrypted"])
            except Exception:
                instance.save(update_fields=["password"])
        return instance


class AdminPurchaseRequestSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(source="product.id", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    owner_username = serializers.CharField(source="product.created_by.username", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = PurchaseRequest
        fields = [
            "id",
            "product_id",
            "product_name",
            "consumer_name",
            "consumer_email",
            "consumer_phone",
            "consumer_address",
            "quantity",
            "payment_method",
            "status",
            "owner_username",
            "created_by_username",
            "created_at",
        ]


class AdminBannerPurchaseRequestSerializer(serializers.ModelSerializer):
    banner_id = serializers.IntegerField(source="banner.id", read_only=True)
    banner_title = serializers.CharField(source="banner.title", read_only=True)
    banner_item_id = serializers.IntegerField(source="banner_item.id", read_only=True)
    item_name = serializers.CharField(source="banner_item.name", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = BannerPurchaseRequest
        fields = [
            "id",
            "banner_id",
            "banner_title",
            "banner_item_id",
            "item_name",
            "consumer_name",
            "consumer_email",
            "consumer_phone",
            "consumer_address",
            "quantity",
            "payment_method",
            "status",
            "created_by_username",
            "created_at",
        ]


class AdminSupportTicketMessageSerializer(serializers.ModelSerializer):
    author_username = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = SupportTicketMessage
        fields = ["id", "author", "author_username", "message", "created_at"]
        read_only_fields = ["id", "author_username", "created_at"]

    def get_author_username(self, obj):
        try:
            return getattr(obj.author, "username", None)
        except Exception:
            return None


class AdminSupportTicketSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    state_name = serializers.SerializerMethodField()
    pincode = serializers.CharField(source="user.pincode", read_only=True)
    admin_assignee_username = serializers.SerializerMethodField(read_only=True)
    messages = AdminSupportTicketMessageSerializer(many=True, read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            "id",
            "type",
            "status",
            "subject",
            "message",
            "resolution_note",
            "admin_assignee",
            "admin_assignee_username",
            "user_id",
            "username",
            "full_name",
            "phone",
            "state_name",
            "pincode",
            "created_at",
            "updated_at",
            "messages",
        ]
        read_only_fields = ["user_id", "username", "full_name", "phone", "state_name", "pincode", "created_at", "updated_at", "messages", "admin_assignee_username"]

    def get_state_name(self, obj):
        try:
            st = getattr(obj.user, "state", None)
            return st.name if st else ""
        except Exception:
            return ""

    def get_admin_assignee_username(self, obj):
        try:
            return getattr(obj.admin_assignee, "username", None)
        except Exception:
            return None


class AdminAutopoolConfigSerializer(serializers.Serializer):
    """
    Admin editable config for consumer autopool (3-matrix and 5-matrix).
    Reads/writes CommissionConfig singleton.
    """
    five_matrix_levels = serializers.IntegerField(min_value=1, required=False)
    five_matrix_amounts_json = serializers.ListField(child=serializers.FloatField(min_value=0), allow_null=True, required=False)
    five_matrix_percents_json = serializers.ListField(child=serializers.FloatField(min_value=0), allow_null=True, required=False)

    three_matrix_levels = serializers.IntegerField(min_value=1, required=False)
    three_matrix_amounts_json = serializers.ListField(child=serializers.FloatField(min_value=0), allow_null=True, required=False)
    three_matrix_percents_json = serializers.ListField(child=serializers.FloatField(min_value=0), allow_null=True, required=False)

    updated_at = serializers.DateTimeField(read_only=True, required=False)

    def to_representation(self, instance):
        from decimal import Decimal as D
        cfg = instance if isinstance(instance, CommissionConfig) else CommissionConfig.get_solo()

        def _norm_list(lst, n):
            arr = list(lst or [])
            out = []
            for i in range(min(len(arr), n)):
                try:
                    v = D(str(arr[i]))
                    if v < 0:
                        v = D("0")
                    out.append(float(v.quantize(D("0.01"))))
                except Exception:
                    out.append(0.0)
            while len(out) < n:
                out.append(0.0)
            return out

        five_levels = int(getattr(cfg, "five_matrix_levels", 6) or 6)
        three_levels = int(getattr(cfg, "three_matrix_levels", 15) or 15)

        return {
            "five_matrix_levels": five_levels,
            "five_matrix_amounts_json": _norm_list(getattr(cfg, "five_matrix_amounts_json", []) or [], five_levels),
            "five_matrix_percents_json": _norm_list(getattr(cfg, "five_matrix_percents_json", []) or [], five_levels),
            "three_matrix_levels": three_levels,
            "three_matrix_amounts_json": _norm_list(getattr(cfg, "three_matrix_amounts_json", []) or [], three_levels),
            "three_matrix_percents_json": _norm_list(getattr(cfg, "three_matrix_percents_json", []) or [], three_levels),
            "updated_at": getattr(cfg, "updated_at", None),
        }

    def update(self, instance, validated_data):
        from decimal import Decimal as D
        cfg = instance

        five_levels = int(validated_data.get("five_matrix_levels", getattr(cfg, "five_matrix_levels", 6) or 6))
        three_levels = int(validated_data.get("three_matrix_levels", getattr(cfg, "three_matrix_levels", 15) or 15))
        cfg.five_matrix_levels = max(1, five_levels)
        cfg.three_matrix_levels = max(1, three_levels)

        def _coerce(lst, n):
            if lst is None:
                return []
            arr = list(lst or [])
            out = []
            for i in range(min(len(arr), n)):
                try:
                    v = D(str(arr[i]))
                    if v < 0:
                        v = D("0")
                    out.append(float(v.quantize(D("0.01"))))
                except Exception:
                    out.append(0.0)
            while len(out) < n:
                out.append(0.0)
            return out

        if "five_matrix_amounts_json" in validated_data:
            cfg.five_matrix_amounts_json = _coerce(validated_data.get("five_matrix_amounts_json"), cfg.five_matrix_levels)
        if "five_matrix_percents_json" in validated_data:
            cfg.five_matrix_percents_json = _coerce(validated_data.get("five_matrix_percents_json"), cfg.five_matrix_levels)
        if "three_matrix_amounts_json" in validated_data:
            cfg.three_matrix_amounts_json = _coerce(validated_data.get("three_matrix_amounts_json"), cfg.three_matrix_levels)
        if "three_matrix_percents_json" in validated_data:
            cfg.three_matrix_percents_json = _coerce(validated_data.get("three_matrix_percents_json"), cfg.three_matrix_levels)

        try:
            cfg.save()
        except Exception:
            cfg.save()
        return cfg

    def create(self, validated_data):
        cfg = CommissionConfig.get_solo()
        return self.update(cfg, validated_data)
