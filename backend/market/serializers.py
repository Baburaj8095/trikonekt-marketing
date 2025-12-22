from rest_framework import serializers
from .models import (
    Product,
    PurchaseRequest,
    Banner,
    BannerItem,
    BannerPurchaseRequest,
    MerchantShop,
    MerchantProfile,
    Shop,
)
from django.conf import settings
try:
    from cloudinary_storage.storage import MediaCloudinaryStorage
except Exception:
    MediaCloudinaryStorage = None


class ProductSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'description',
            'category',
            'price',
            'quantity',
            'discount',
            'max_reward_redeem_percent',
            'image',
            'image_url',
            'country',
            'state',
            'city',
            'pincode',
            'created_by',
            'created_by_name',
            'created_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_by_name', 'created_at']

    def get_created_by_name(self, obj):
        u = getattr(obj, 'created_by', None)
        if not u:
            return None
        # Prefer full_name if available then username
        return getattr(u, 'full_name', None) or getattr(u, 'username', None)

    def get_image_url(self, obj):
        f = getattr(obj, "image", None)
        if not f:
            return None
        url = None
        # If Cloudinary-backed field, use its URL directly
        try:
            storage_mod = getattr(getattr(f, "storage", None), "__module__", "")
            if "cloudinary" in storage_mod:
                url = f.url
        except Exception:
            url = None

        # Otherwise, if Cloudinary is active, only return Cloudinary URL when asset exists there
        if not url and MediaCloudinaryStorage and "cloudinary" in str(getattr(settings, "DEFAULT_FILE_STORAGE", "")):
            try:
                name = getattr(f, "name", None)
                if name:
                    storage = MediaCloudinaryStorage()
                    if hasattr(storage, "exists") and storage.exists(name):
                        url = storage.url(name)
            except Exception:
                url = None

        # Fallback to field URL (likely /media/... served by backend)
        if not url:
            try:
                url = f.url
            except Exception:
                url = None

        if not url:
            return None
        request = self.context.get("request") if hasattr(self, "context") else None
        return request.build_absolute_uri(url) if (request and not str(url).startswith("http")) else url

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        else:
            raise serializers.ValidationError({'detail': 'Authentication required to create products.'})
        return super().create(validated_data)


class PurchaseRequestSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField(read_only=True)
    owner_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PurchaseRequest
        fields = [
            'id',
            'product',
            'product_name',
            'consumer_name',
            'consumer_email',
            'consumer_phone',
            'consumer_address',
            'quantity',
            'reward_discount_amount',
            'payment_method',
            'status',
            'owner_name',
            'created_by',
            'created_at',
        ]
        read_only_fields = ['id', 'status', 'owner_name', 'created_by', 'created_at']

    def get_product_name(self, obj):
        try:
            return obj.product.name
        except Exception:
            return None

    def get_owner_name(self, obj):
        try:
            u = obj.product.created_by
            return getattr(u, 'full_name', None) or getattr(u, 'username', None)
        except Exception:
            return None

    def create(self, validated_data):
        # Basic stock validation at request creation time
        from decimal import Decimal
        product = validated_data.get('product')
        qty = int(validated_data.get('quantity') or 1)
        pay_method = validated_data.get('payment_method') or 'wallet'
        if not product:
            raise serializers.ValidationError({'product': 'This field is required.'})
        if qty <= 0:
            raise serializers.ValidationError({'quantity': 'Quantity must be at least 1.'})
        if int(getattr(product, 'quantity', 0)) < qty:
            raise serializers.ValidationError({'detail': 'Insufficient stock for this product.'})

        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        else:
            # Anonymous users cannot use wallet payments
            if str(pay_method).lower() == 'wallet':
                raise serializers.ValidationError({'payment_method': 'Login required to pay via wallet.'})

        # If wallet payment requested by authenticated user, do a best-effort balance check (apply reward discount if provided)
        if str(pay_method).lower() == 'wallet' and validated_data.get('created_by'):
            # Compute unit selling price after product-level discount
            unit_price = (Decimal(product.price) * (Decimal('1.00') - (Decimal(product.discount or 0) / Decimal('100.00')))).quantize(Decimal('0.01'))
            total = (unit_price * Decimal(qty)).quantize(Decimal('0.01'))

            # Normalize and clamp reward discount amount from client (₹)
            try:
                redeem_in = validated_data.get('reward_discount_amount', 0)
            except Exception:
                redeem_in = 0
            try:
                redeem = Decimal(str(redeem_in or 0))
            except Exception:
                redeem = Decimal('0.00')
            if redeem < 0:
                redeem = Decimal('0.00')
            # clamp to gross total
            if redeem > total:
                redeem = total
            # server-side cap: respect product.max_reward_redeem_percent
            try:
                pct = Decimal(getattr(product, 'max_reward_redeem_percent', 0) or 0)
            except Exception:
                pct = Decimal('0')
            if pct > Decimal('0'):
                cap = (total * (pct / Decimal('100.00'))).quantize(Decimal('0.01'))
                if redeem > cap:
                    redeem = cap
            # Persist clamped value back to be stored on the model
            validated_data['reward_discount_amount'] = redeem.quantize(Decimal('0.01'))

            effective_total = (total - redeem).quantize(Decimal('0.01'))
            try:
                from accounts.models import Wallet
                w = Wallet.get_or_create_for_user(validated_data['created_by'])
                if (w.balance or Decimal('0')) < effective_total:
                    raise serializers.ValidationError({'detail': f'Insufficient wallet balance. Needed ₹{effective_total} after reward discount.'})
            except serializers.ValidationError:
                raise
            except Exception:
                # If wallet fetch fails, allow request creation; final check happens on approval
                pass

        # Allow anonymous creation when pay_method is cash (created_by stays null)
        instance = super().create(validated_data)

        # Reserve reward points hold if applicable (best-effort; do not block creation)
        try:
            from decimal import Decimal as D
            user = validated_data.get('created_by')
            # product and qty are validated above
            redeem_val = D(str(validated_data.get('reward_discount_amount') or '0'))
            if user and redeem_val > D('0.00'):
                from accounts.models import RewardPointsAccount
                hold = RewardPointsAccount.reserve_value(
                    user,
                    redeem_val,
                    source_type="PRODUCT_PR",
                    source_id=str(instance.id),
                    meta={"product_id": getattr(product, "id", None), "quantity": qty},
                )
                try:
                    # Link the hold to the request for later commit/release
                    instance.reward_points_hold_id = getattr(hold, "id", None)
                    instance.save(update_fields=["reward_points_hold"])
                except Exception:
                    pass
        except Exception:
            # If reservation fails (insufficient points or service error), proceed without blocking creation
            pass

        return instance


class PurchaseRequestStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseRequest
        fields = ['status']
        extra_kwargs = {
            'status': {'required': True}
        }

    def validate_status(self, value):
        allowed = {c for c, _ in PurchaseRequest.STATUS_CHOICES}
        if value not in allowed:
            raise serializers.ValidationError(f"Status must be one of: {', '.join(sorted(allowed))}")
        return value


# =====================
# Banners + BannerItems
# =====================

class BannerItemSerializer(serializers.ModelSerializer):
    selling_price = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = BannerItem
        fields = [
            'id',
            'banner',
            'name',
            'price',
            'quantity',
            'discount',
            'coupon_redeem_percent',
            'commission_pool_percent',
            'gift',
            'selling_price',
            'created_at',
        ]
        read_only_fields = ['id', 'selling_price', 'created_at', 'banner']

    def get_selling_price(self, obj):
        try:
            return str(obj.selling_price)
        except Exception:
            return None


class BannerSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    image_url = serializers.SerializerMethodField(read_only=True)
    items = BannerItemSerializer(many=True, read_only=True)

    class Meta:
        model = Banner
        fields = [
            'id',
            'title',
            'description',
            'image',
            'image_url',
            'country',
            'state',
            'city',
            'pincode',
            'is_active',
            'created_by',
            'created_by_name',
            'created_at',
            'items',
        ]
        read_only_fields = ['id', 'created_by', 'created_by_name', 'created_at', 'items']

    def get_created_by_name(self, obj):
        u = getattr(obj, 'created_by', None)
        if not u:
            return None
        return getattr(u, 'full_name', None) or getattr(u, 'username', None)

    def get_image_url(self, obj):
        f = getattr(obj, "image", None)
        if not f:
            return None
        url = None
        # If Cloudinary-backed field, use its URL directly
        try:
            storage_mod = getattr(getattr(f, "storage", None), "__module__", "")
            if "cloudinary" in storage_mod:
                url = f.url
        except Exception:
            url = None

        # Otherwise, if Cloudinary is active, only return Cloudinary URL when asset exists there
        if not url and MediaCloudinaryStorage and "cloudinary" in str(getattr(settings, "DEFAULT_FILE_STORAGE", "")):
            try:
                name = getattr(f, "name", None)
                if name:
                    storage = MediaCloudinaryStorage()
                    if hasattr(storage, "exists") and storage.exists(name):
                        url = storage.url(name)
            except Exception:
                url = None

        # Fallback to field URL (likely /media/... served by backend)
        if not url:
            try:
                url = f.url
            except Exception:
                url = None

        if not url:
            return None
        request = self.context.get("request") if hasattr(self, "context") else None
        return request.build_absolute_uri(url) if (request and not str(url).startswith("http")) else url

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        else:
            raise serializers.ValidationError({'detail': 'Authentication required to create banners.'})
        return super().create(validated_data)


class BannerPurchaseRequestSerializer(serializers.ModelSerializer):
    banner_title = serializers.SerializerMethodField(read_only=True)
    item_name = serializers.SerializerMethodField(read_only=True)
    unit_selling_price = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = BannerPurchaseRequest
        fields = [
            'id',
            'banner',
            'banner_item',
            'banner_title',
            'item_name',
            'unit_selling_price',
            'consumer_name',
            'consumer_email',
            'consumer_phone',
            'consumer_address',
            'quantity',
            'payment_method',
            'status',
            'created_by',
            'created_at',
        ]
        read_only_fields = [
            'id', 'banner', 'banner_item', 'banner_title', 'item_name', 'unit_selling_price',
            'status', 'created_by', 'created_at'
        ]

    def get_banner_title(self, obj):
        try:
            return obj.banner.title
        except Exception:
            return None

    def get_item_name(self, obj):
        try:
            return obj.banner_item.name
        except Exception:
            return None

    def get_unit_selling_price(self, obj):
        try:
            return str(obj.banner_item.selling_price)
        except Exception:
            return None

    def validate(self, attrs):
        # Basic validation that relies on view to attach banner/banner_item
        qty = int(attrs.get('quantity') or 1)
        if qty <= 0:
            raise serializers.ValidationError({'quantity': 'Quantity must be at least 1.'})
        return super().validate(attrs)

    def create(self, validated_data):
        request = self.context.get('request')
        pay_method = (validated_data.get('payment_method') or BannerPurchaseRequest.PAYMENT_WALLET).lower()
        if request and request.user and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        else:
            # Anonymous users cannot use wallet
            if pay_method == 'wallet':
                raise serializers.ValidationError({'payment_method': 'Login required to pay via wallet.'})
        # Quantity and stock checks happen in the view where banner_item is available
        return super().create(validated_data)


class BannerPurchaseRequestStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = BannerPurchaseRequest
        fields = ['status']
        extra_kwargs = {'status': {'required': True}}

    def validate_status(self, value):
        allowed = {c for c, _ in BannerPurchaseRequest.STATUS_CHOICES}
        if value not in allowed:
            raise serializers.ValidationError(f"Status must be one of: {', '.join(sorted(allowed))}")
        return value


class MerchantShopSerializer(serializers.ModelSerializer):
    owner_username = serializers.SerializerMethodField(read_only=True)
    image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = MerchantShop
        fields = [
            'id',
            'owner',
            'owner_username',
            'name',
            'mobile',
            'address',
            'image',
            'image_url',
            'country',
            'state',
            'city',
            'pincode',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['id', 'owner', 'owner_username', 'is_active', 'created_at']

    def get_owner_username(self, obj):
        u = getattr(obj, 'owner', None)
        if not u:
            return None
        return getattr(u, 'username', None) or getattr(u, 'full_name', None)

    def get_image_url(self, obj):
        f = getattr(obj, "image", None)
        if not f:
            return None
        url = None
        # If Cloudinary-backed field, use its URL directly
        try:
            storage_mod = getattr(getattr(f, "storage", None), "__module__", "")
            if "cloudinary" in storage_mod:
                url = f.url
        except Exception:
            url = None

        # Otherwise, if Cloudinary is active, only return Cloudinary URL when asset exists there
        if not url and MediaCloudinaryStorage and "cloudinary" in str(getattr(settings, "DEFAULT_FILE_STORAGE", "")):
            try:
                name = getattr(f, "name", None)
                if name:
                    storage = MediaCloudinaryStorage()
                    if hasattr(storage, "exists") and storage.exists(name):
                        url = storage.url(name)
            except Exception:
                url = None

        # Fallback to field URL (likely /media/... served by backend)
        if not url:
            try:
                url = f.url
            except Exception:
                url = None

        if not url:
            return None
        request = self.context.get("request") if hasattr(self, "context") else None
        return request.build_absolute_uri(url) if (request and not str(url).startswith("http")) else url

    def create(self, validated_data):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            raise serializers.ValidationError({'detail': 'Authentication required to create shop.'})
        # Enforce 1 shop per owner
        try:
            exists = MerchantShop.objects.filter(owner_id=request.user.id).exists()
            if exists:
                raise serializers.ValidationError({'detail': 'You already have a registered shop.'})
        except serializers.ValidationError:
            raise
        except Exception:
            # best-effort check; DB uniqueness is also enforced by OneToOne
            pass
        validated_data['owner'] = request.user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Do not allow changing owner via serializer
        validated_data.pop('owner', None)
        return super().update(instance, validated_data)


class MerchantProfileSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = MerchantProfile
        fields = [
            'id',
            'user',
            'username',
            'business_name',
            'mobile_number',
            'is_verified',
            'created_at',
        ]
        read_only_fields = ['id', 'user', 'username', 'is_verified', 'created_at']

    def get_username(self, obj):
        try:
            return getattr(obj.user, "username", None)
        except Exception:
            return None

    def update(self, instance, validated_data):
        # user/is_verified are controlled separately (admin moderation)
        validated_data.pop("user", None)
        validated_data.pop("is_verified", None)
        return super().update(instance, validated_data)


class ShopSerializer(serializers.ModelSerializer):
    merchant_username = serializers.SerializerMethodField(read_only=True)
    image_url = serializers.SerializerMethodField(read_only=True)
    distance_km = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Shop
        fields = [
            'id',
            'merchant',
            'merchant_username',
            'shop_name',
            'address',
            'city',
            'latitude',
            'longitude',
            'contact_number',
            'shop_image',
            'image_url',
            'status',
            'distance_km',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'merchant',
            'merchant_username',
            'status',           # status moderated by staff; merchants cannot set directly
            'distance_km',
            'created_at',
        ]

    def get_merchant_username(self, obj):
        u = getattr(obj, 'merchant', None)
        if not u:
            return None
        return getattr(u, 'username', None) or getattr(u, 'full_name', None)

    def get_image_url(self, obj):
        f = getattr(obj, "shop_image", None)
        if not f:
            return None
        url = None
        # If Cloudinary-backed field, use its URL directly
        try:
            storage_mod = getattr(getattr(f, "storage", None), "__module__", "")
            if "cloudinary" in storage_mod:
                url = f.url
        except Exception:
            url = None

        # Otherwise, if Cloudinary is active, only return Cloudinary URL when asset exists there
        if not url and MediaCloudinaryStorage and "cloudinary" in str(getattr(settings, "DEFAULT_FILE_STORAGE", "")):
            try:
                name = getattr(f, "name", None)
                if name:
                    storage = MediaCloudinaryStorage()
                    if hasattr(storage, "exists") and storage.exists(name):
                        url = storage.url(name)
            except Exception:
                url = None

        # Fallback to field URL (likely /media/... served by backend)
        if not url:
            try:
                url = f.url
            except Exception:
                url = None

        if not url:
            return None
        request = self.context.get("request") if hasattr(self, "context") else None
        return request.build_absolute_uri(url) if (request and not str(url).startswith("http")) else url

    def get_distance_km(self, obj):
        try:
            d = getattr(obj, "_distance_km", None)
            if d is None:
                d = getattr(obj, "distance_km", None)
            if d is None:
                return None
            # normalize to string with 2 decimals
            return round(float(d), 2)
        except Exception:
            return None

    def create(self, validated_data):
        request = self.context.get('request')
        if not request or not getattr(request, "user", None) or not request.user.is_authenticated:
            raise serializers.ValidationError({'detail': 'Authentication required to create shop.'})
        # Only merchants/business accounts can create shops
        try:
            cat = str(getattr(request.user, "category", "")).lower()
            if cat not in {"merchant", "business"} and not getattr(request.user, "is_staff", False):
                raise serializers.ValidationError({'detail': 'Only merchant/business accounts can create shops.'})
        except serializers.ValidationError:
            raise
        except Exception:
            # best-effort; allow staff override
            pass
        validated_data['merchant'] = request.user
        # status remains default (PENDING); staff can approve later
        # Prevent clients from injecting status on create
        validated_data.pop('status', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # merchant cannot be changed via serializer
        validated_data.pop('merchant', None)
        # Non-staff cannot change status
        request = self.context.get('request')
        if not (request and getattr(request.user, "is_staff", False)):
            validated_data.pop('status', None)
        return super().update(instance, validated_data)


class ShopStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shop
        fields = ['status']
        extra_kwargs = {'status': {'required': True}}

    def validate_status(self, value):
        allowed = {c for c, _ in Shop.STATUS_CHOICES}
        if value not in allowed:
            raise serializers.ValidationError(f"Status must be one of: {', '.join(sorted(allowed))}")
        return value
