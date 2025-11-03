from django.contrib.auth.models import AbstractUser
from django.db import models
from locations.models import State


class CustomUser(AbstractUser):
    ROLE_CHOICES = [
        ('user', 'User'),
        ('agency', 'Agency'),
        ('employee', 'Employee'),
    ]

    CATEGORY_CHOICES = [
        ('consumer', 'Consumer (General User)'),
        ('employee', 'Employee'),
        ('business', 'Business'),
        ('company', 'Company'),
        ('agency_state_coordinator', 'Agency State Coordinator'),
        ('agency_state', 'Agency State'),
        ('agency_district_coordinator', 'Agency District Coordinator'),
        ('agency_district', 'Agency District'),
        ('agency_pincode_coordinator', 'Agency Pincode Coordinator'),
        ('agency_pincode', 'Agency Pincode'),
        ('agency_sub_franchise', 'Agency Sub-Franchise'),
    ]

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user', db_index=True)
    # Specific registration category for username/ownership logic
    category = models.CharField(max_length=40, choices=CATEGORY_CHOICES, default='consumer', db_index=True)

    # 6-digit unique registration id
    unique_id = models.CharField(max_length=6, unique=True, blank=True, null=True, editable=False)

    # The user who registered this account (used for employees/businesses created by a user)
    registered_by = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='registrations'
    )

    # Registration profile fields
    full_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    country = models.ForeignKey('locations.Country', null=True, blank=True, on_delete=models.SET_NULL, related_name='users')
    state = models.ForeignKey('locations.State', null=True, blank=True, on_delete=models.SET_NULL, related_name='users')
    city = models.ForeignKey('locations.City', null=True, blank=True, on_delete=models.SET_NULL, related_name='users')
    pincode = models.CharField(max_length=10, blank=True, db_index=True)
    sponsor_id = models.CharField(max_length=64, blank=True)

    def __str__(self):
        return f"{self.username} ({self.role} / {self.category})"

    @classmethod
    def generate_unique_id(cls) -> str:
        """
        Generate a 6-digit unique numeric id not used by any CustomUser.unique_id.
        """
        import random
        while True:
            candidate = f"{random.randint(0, 999999):06d}"
            if not cls.objects.filter(unique_id=candidate).exists():
                return candidate

    def save(self, *args, **kwargs):
        if not self.unique_id:
            self.unique_id = self.generate_unique_id()
        if not self.sponsor_id and self.username:
            # Ensure every account has a shareable Sponsor ID; admin-created "Company" users included
            self.sponsor_id = self.username
        super().save(*args, **kwargs)


# Existing proxy example retained
class PincodeUser(CustomUser):
    class Meta:
        proxy = True
        verbose_name = "Pincode User"
        verbose_name_plural = "Pincode Users"


# Proxy models to expose separate sections in Django admin for each registration type
class ConsumerAccount(CustomUser):
    class Meta:
        proxy = True
        verbose_name = "Consumer"
        verbose_name_plural = "Consumers"


class EmployeeAccount(CustomUser):
    class Meta:
        proxy = True
        verbose_name = "Employee"
        verbose_name_plural = "Employees"


class CompanyAccount(CustomUser):
    class Meta:
        proxy = True
        verbose_name = "Company"
        verbose_name_plural = "Companies"


class AgencyStateCoordinator(CustomUser):
    class Meta:
        proxy = True
        verbose_name = "Agency State Coordinator"
        verbose_name_plural = "Agency State Coordinators"


class AgencyState(CustomUser):
    class Meta:
        proxy = True
        verbose_name = "Agency State"
        verbose_name_plural = "Agency States"


class AgencyDistrictCoordinator(CustomUser):
    class Meta:
        proxy = True
        verbose_name = "Agency District Coordinator"
        verbose_name_plural = "Agency District Coordinators"


class AgencyDistrict(CustomUser):
    class Meta:
        proxy = True
        verbose_name = "Agency District"
        verbose_name_plural = "Agency Districts"


class AgencyPincodeCoordinator(CustomUser):
    class Meta:
        proxy = True
        verbose_name = "Agency Pincode Coordinator"
        verbose_name_plural = "Agency Pincode Coordinators"


class AgencyPincode(CustomUser):
    class Meta:
        proxy = True
        verbose_name = "Agency Pincode"
        verbose_name_plural = "Agency Pincodes"


class AgencySubFranchise(CustomUser):
    class Meta:
        proxy = True
        verbose_name = "Agency Sub-Franchise"
        verbose_name_plural = "Agency Sub-Franchises"


class AgencyRegionAssignment(models.Model):
    """
    Region assignment capability for agency users.

    level:
      - state: user can operate in given State (FK)
      - district: user can operate in given district (free-text) under a specific State
      - pincode: user can operate in given 6-digit pincode
    """
    LEVEL_CHOICES = [
        ('state', 'State'),
        ('district', 'District'),
        ('pincode', 'Pincode'),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='region_assignments')
    level = models.CharField(max_length=16, choices=LEVEL_CHOICES, db_index=True)

    # Context fields
    state = models.ForeignKey('locations.State', null=True, blank=True, on_delete=models.CASCADE, related_name='region_assignments')
    district = models.CharField(max_length=100, blank=True)  # district name (best-effort text)
    pincode = models.CharField(max_length=10, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'level']),
            models.Index(fields=['level', 'state']),
            models.Index(fields=['level', 'pincode']),
        ]
        constraints = [
            # For level=state, ensure uniqueness per user+state
            models.UniqueConstraint(
                fields=['user', 'level', 'state'],
                name='uniq_assignment_user_state',
                condition=models.Q(level='state')
            ),
            # For level=district, ensure uniqueness per user+state+district (case-insensitive)
            models.UniqueConstraint(
                name='uniq_assignment_user_state_district_ci',
                fields=['user', 'state', 'district', 'level'],
                condition=models.Q(level='district')
            ),
            # For level=pincode, ensure uniqueness per user+pincode
            models.UniqueConstraint(
                fields=['user', 'level', 'pincode'],
                name='uniq_assignment_user_pincode',
                condition=models.Q(level='pincode')
            ),
        ]

    def __str__(self):
        desc = None
        if self.level == 'state' and self.state:
            desc = f"State={self.state.name}"
        elif self.level == 'district':
            desc = f"State={getattr(self.state, 'name', '')}, District={self.district}"
        elif self.level == 'pincode':
            desc = f"Pincode={self.pincode}"
        return f"{self.user.username} [{self.level}] {desc or ''}".strip()


# ======================
# Wallet & Ledger Models
# ======================
from decimal import Decimal
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver


class Wallet(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='wallet')
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Wallet<{self.user.username}> ₹{self.balance}"

    @transaction.atomic
    def credit(self, amount: Decimal, tx_type: str, meta: dict | None = None, source_type: str | None = None, source_id: str | None = None):
        # Lock this wallet row
        w = Wallet.objects.select_for_update().get(pk=self.pk)
        w.balance = (w.balance or Decimal('0')) + Decimal(amount)
        w.save(update_fields=['balance', 'updated_at'])
        WalletTransaction.objects.create(
            user=self.user,
            amount=Decimal(amount),
            balance_after=w.balance,
            type=tx_type,
            source_type=source_type or '',
            source_id=str(source_id) if source_id is not None else '',
            meta=meta or {}
        )
        return w.balance

    @transaction.atomic
    def debit(self, amount: Decimal, tx_type: str, meta: dict | None = None, source_type: str | None = None, source_id: str | None = None):
        if Decimal(amount) <= 0:
            raise ValueError("Debit amount must be positive.")
        # Lock this wallet row
        w = Wallet.objects.select_for_update().get(pk=self.pk)
        new_bal = (w.balance or Decimal('0')) - Decimal(amount)
        if new_bal < 0:
            raise ValueError("Insufficient wallet balance.")
        w.balance = new_bal
        w.save(update_fields=['balance', 'updated_at'])
        WalletTransaction.objects.create(
            user=self.user,
            amount=Decimal(amount) * Decimal('-1'),
            balance_after=w.balance,
            type=tx_type,
            source_type=source_type or '',
            source_id=str(source_id) if source_id is not None else '',
            meta=meta or {}
        )
        return w.balance

    @classmethod
    def get_or_create_for_user(cls, user: CustomUser) -> "Wallet":
        w, _ = cls.objects.get_or_create(user=user, defaults={'balance': Decimal('0.00')})
        return w


class WalletTransaction(models.Model):
    TYPE_CHOICES = [
        ('COUPON_PURCHASE_CREDIT', 'Coupon Purchase Credit'),
        ('REDEEM_ECOUPON_CREDIT', 'E-Coupon Redeem Credit'),
        ('PRODUCT_PURCHASE_DEBIT', 'Product Purchase Debit'),
        ('COMMISSION_CREDIT', 'Commission Credit'),
        ('AUTO_POOL_DEBIT', 'Auto Pool Debit'),
        ('ADJUSTMENT_CREDIT', 'Adjustment Credit'),
        ('ADJUSTMENT_DEBIT', 'Adjustment Debit'),
        ('REFUND_CREDIT', 'Refund Credit'),
    ]
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='wallet_transactions', db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    type = models.CharField(max_length=32, choices=TYPE_CHOICES, db_index=True)
    source_type = models.CharField(max_length=64, blank=True, default='')
    source_id = models.CharField(max_length=64, blank=True, default='')
    meta = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'type']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self) -> str:
        return f"{self.user.username} {self.type} {self.amount} -> {self.balance_after}"


@receiver(post_save, sender=CustomUser)
def create_wallet_for_new_user(sender, instance: CustomUser, created: bool, **kwargs):
    if created:
        try:
            Wallet.objects.get_or_create(user=instance, defaults={'balance': Decimal('0.00')})
        except Exception:
            # Avoid blocking user creation if wallet init fails
            pass
