from django.db import models, transaction
from django.db.models import F
from django.core.exceptions import ValidationError
from django.conf import settings

# Optional Cloudinary storage for images (align with DashboardCard/HomeCard approach)
try:
    from cloudinary_storage.storage import MediaCloudinaryStorage
    MEDIA_STORAGE = MediaCloudinaryStorage()
except Exception:
    MEDIA_STORAGE = None


class Product(models.Model):
    """
    Unified product pool. Can be created by admin (via Django admin) or by agencies (via API).
    Location fields are stored as simple strings for easy filtering and cascading dropdowns.
    """
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=100, db_index=True)

    price = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.PositiveIntegerField(default=0)
    # discount represented as percentage (e.g., 10.00 for 10%)
    discount = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    image = models.ImageField(upload_to='products/', null=True, blank=True, storage=MEDIA_STORAGE)

    country = models.CharField(max_length=64, db_index=True)
    state = models.CharField(max_length=64, db_index=True)
    city = models.CharField(max_length=128, db_index=True)
    pincode = models.CharField(max_length=10, db_index=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='products'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.name


class PurchaseRequest(models.Model):
    """
    Buy intent submitted by consumers. Agencies/Admins can review requests for the products they own.
    """
    STATUS_PENDING = 'Pending'
    STATUS_APPROVED = 'Approved'
    STATUS_REJECTED = 'Rejected'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='purchase_requests')

    consumer_name = models.CharField(max_length=255)
    consumer_email = models.EmailField()
    consumer_phone = models.CharField(max_length=20)
    consumer_address = models.TextField()

    quantity = models.PositiveIntegerField(default=1)
    # payment: 'wallet' (debit consumer wallet) or 'cash' (handled offline)
    PAYMENT_WALLET = 'wallet'
    PAYMENT_CASH = 'cash'
    PAYMENT_CHOICES = [
        (PAYMENT_WALLET, 'Wallet'),
        (PAYMENT_CASH, 'Cash'),
    ]
    payment_method = models.CharField(max_length=16, choices=PAYMENT_CHOICES, default=PAYMENT_WALLET, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)

    # Optional: track the user who submitted the request for "My Orders" views
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='purchase_requests'
    )
    created_at = models.DateTimeField(auto_now_add=True)


    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"PR#{self.pk} - {self.product.name} x {self.quantity} ({self.status})"


# =========================
# Banner + Items (Agencies)
# =========================

class Banner(models.Model):
    """
    Agency banner that represents a curated table/list of product items.
    Consumers see the banner image; on click they get a table of items configured by the agency.
    """
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='products/banners/', null=True, blank=True, storage=MEDIA_STORAGE)

    # Simple location filters (same model as Product for easy marketplace filtering)
    country = models.CharField(max_length=64, db_index=True, blank=True, default="")
    state = models.CharField(max_length=64, db_index=True, blank=True, default="")
    city = models.CharField(max_length=128, db_index=True, blank=True, default="")
    pincode = models.CharField(max_length=10, db_index=True, blank=True, default="")

    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='banners'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"Banner<{self.title}>"


class BannerItem(models.Model):
    """
    Item row inside a Banner. Agency defines pricing, inventory and percentage info.
    selling_price is derived as price * (1 - discount/100)
    """
    banner = models.ForeignKey(Banner, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(max_length=255)

    price = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.PositiveIntegerField(default=0)
    discount = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # percent
    coupon_redeem_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # percent of selling price
    commission_pool_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # percent of selling price
    # Optional gift/offer text shown to consumers (e.g., "Free mug" or "Buy 1 Get 1")
    gift = models.CharField(max_length=255, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['banner', 'name']),
        ]

    def __str__(self) -> str:
        return f"{self.name} (Banner#{self.banner_id})"

    @property
    def selling_price(self):
        try:
            from decimal import Decimal
            p = (self.price or 0)
            d = (self.discount or 0)
            return (p * (Decimal("1.00") - (d / Decimal("100.00"))))
        except Exception:
            return self.price


class BannerPurchaseRequest(models.Model):
    """
    Buy intent submitted by consumers for Banner Items.
    Approval will decrement BannerItem.quantity and optionally debit wallet if chosen.
    """
    STATUS_PENDING = 'Pending'
    STATUS_APPROVED = 'Approved'
    STATUS_REJECTED = 'Rejected'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    PAYMENT_WALLET = 'wallet'
    PAYMENT_CASH = 'cash'
    PAYMENT_CHOICES = [
        (PAYMENT_WALLET, 'Wallet'),
        (PAYMENT_CASH, 'Cash'),
    ]

    banner = models.ForeignKey(Banner, on_delete=models.CASCADE, related_name='purchase_requests')
    banner_item = models.ForeignKey(BannerItem, on_delete=models.CASCADE, related_name='purchase_requests')

    consumer_name = models.CharField(max_length=255)
    consumer_email = models.EmailField()
    consumer_phone = models.CharField(max_length=20)
    consumer_address = models.TextField()

    quantity = models.PositiveIntegerField(default=1)
    payment_method = models.CharField(max_length=16, choices=PAYMENT_CHOICES, default=PAYMENT_WALLET, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='banner_purchase_requests'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['banner', 'status']),
        ]

    def __str__(self) -> str:
        try:
            return f"BPR#{self.pk} - {self.banner_item.name} x {self.quantity} ({self.status})"
        except Exception:
            return f"BPR#{self.pk} ({self.status})"
