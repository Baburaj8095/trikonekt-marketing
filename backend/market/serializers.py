from rest_framework import serializers
from .models import Product, PurchaseRequest, Banner, BannerItem, BannerPurchaseRequest
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

        # If wallet payment requested by authenticated user, do a best-effort balance check
        if str(pay_method).lower() == 'wallet' and validated_data.get('created_by'):
            unit_price = (Decimal(product.price) * (Decimal('1.00') - (Decimal(product.discount or 0) / Decimal('100.00')))).quantize(Decimal('0.01'))
            total = (unit_price * Decimal(qty)).quantize(Decimal('0.01'))
            try:
                from accounts.models import Wallet
                w = Wallet.get_or_create_for_user(validated_data['created_by'])
                if (w.balance or Decimal('0')) < total:
                    raise serializers.ValidationError({'detail': f'Insufficient wallet balance. Needed ₹{total}.'})
            except serializers.ValidationError:
                raise
            except Exception:
                # If wallet fetch fails, allow request creation; final check happens on approval
                pass

        # Allow anonymous creation when pay_method is cash (created_by stays null)
        return super().create(validated_data)


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
