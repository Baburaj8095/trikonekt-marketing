from rest_framework import serializers
from accounts.models import CustomUser, WithdrawalRequest, UserKYC, WalletTransaction
from market.models import PurchaseRequest, BannerPurchaseRequest
from business.models import UserMatrixProgress
from locations.models import Country, State, City


class AdminUserNodeSerializer(serializers.ModelSerializer):
    state_name = serializers.SerializerMethodField()
    direct_count = serializers.IntegerField(read_only=True)
    has_children = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "username",
            "full_name",
            "role",
            "category",
            "phone",
            "state_name",
            "pincode",
            "direct_count",
            "has_children",
        ]

    def get_state_name(self, obj):
        try:
            return obj.state.name if getattr(obj, "state_id", None) else ""
        except Exception:
            return ""

    def get_has_children(self, obj):
        try:
            dc = getattr(obj, "direct_count", 0) or 0
            return dc > 0
        except Exception:
            return False


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


class AdminUserEditSerializer(serializers.ModelSerializer):
    """
    Admin-side editable fields for a user. Primary keys for geo fields.
    """
    country = serializers.PrimaryKeyRelatedField(queryset=Country.objects.all(), required=False, allow_null=True)
    state = serializers.PrimaryKeyRelatedField(queryset=State.objects.all(), required=False, allow_null=True)
    city = serializers.PrimaryKeyRelatedField(queryset=City.objects.all(), required=False, allow_null=True)

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
            "is_active",
        ]


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
