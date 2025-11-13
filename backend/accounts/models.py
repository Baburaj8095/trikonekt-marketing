from django.contrib.auth.models import AbstractUser
from django.db import models, transaction
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
        ('company_manager', 'Company Manager'),
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
    age = models.PositiveSmallIntegerField(null=True, blank=True)
    country = models.ForeignKey('locations.Country', null=True, blank=True, on_delete=models.SET_NULL, related_name='users')
    state = models.ForeignKey('locations.State', null=True, blank=True, on_delete=models.SET_NULL, related_name='users')
    city = models.ForeignKey('locations.City', null=True, blank=True, on_delete=models.SET_NULL, related_name='users')
    pincode = models.CharField(max_length=10, blank=True, db_index=True)
    address = models.TextField(blank=True)
    avatar = models.ImageField(upload_to='uploads/profile/', blank=True, null=True)
    sponsor_id = models.CharField(max_length=64, blank=True)
    prefix_code = models.CharField(max_length=6, blank=True, db_index=True)
    prefixed_id = models.CharField(max_length=32, unique=True, null=True, blank=True)
    # 5-Matrix genealogy fields
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='children')
    matrix_position = models.PositiveSmallIntegerField(null=True, blank=True, db_index=True)
    depth = models.PositiveIntegerField(default=0, db_index=True)

    # Activation/eligibility flags
    first_purchase_activated_at = models.DateTimeField(null=True, blank=True)
    autopool_enabled = models.BooleanField(default=False)
    rewards_enabled = models.BooleanField(default=False)
    is_agency_unlocked = models.BooleanField(default=False)
    can_create_self_accounts = models.BooleanField(default=False)

    class Meta(AbstractUser.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=['parent', 'matrix_position'],
                name='uniq_parent_matrix_position',
                condition=models.Q(parent__isnull=False)
            ),
        ]
        indexes = [
            models.Index(fields=['parent']),
            models.Index(fields=['depth']),
        ]

    def __str__(self):
        return f"{self.username} ({self.role} / {self.category})"

    # Prefix mapping and allocation for hierarchical sponsor codes
    PREFIX_MAP = {
        'consumer': 'TR',
        'employee': 'TREP',
        'business': 'TRBS',
        'company': 'TR',
        'agency_state_coordinator': 'TRSC',
        'agency_state': 'TRST',
        'agency_district_coordinator': 'TRDC',
        'agency_district': 'TRDT',
        'agency_pincode_coordinator': 'TRPC',
        'agency_pincode': 'TRPN',
        'agency_sub_franchise': 'TRSF',
        'company_manager': 'TRCM',
    }

    @classmethod
    def category_to_prefix(cls, category: str) -> str:
        cat = (category or '').strip() or 'consumer'
        return cls.PREFIX_MAP.get(cat, 'TR')

    @classmethod
    @transaction.atomic
    def allocate_prefixed_id(cls, category: str) -> str:
        """
        Allocate and return a new prefixed sponsor/code like PREFIX-0000000001.
        """
        prefix = cls.category_to_prefix(category)
        next_num = PrefixSequence.allocate_next(prefix)
        return f"{prefix}-{next_num:010d}"

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
        # Ensure 6-digit registration id
        if not self.unique_id:
            self.unique_id = self.generate_unique_id()

        # Allocate hierarchical prefix code and ID once category is known
        if not getattr(self, "prefixed_id", None) and (self.category or ""):
            try:
                code = CustomUser.allocate_prefixed_id(self.category)
                self.prefixed_id = code
                try:
                    self.prefix_code = code.split("-", 1)[0]
                except Exception:
                    self.prefix_code = CustomUser.category_to_prefix(self.category)
            except Exception:
                # best-effort; fall back to lazy allocation on next save
                pass

        # Sponsor ID defaults to hierarchical prefixed_id if available, else username
        if not self.sponsor_id:
            self.sponsor_id = self.prefixed_id or self.username or ""

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


# Prefix-based sequential code allocator for hierarchical IDs (e.g., TR-0000000001)
class PrefixSequence(models.Model):
    prefix = models.CharField(max_length=10, unique=True)
    last_number = models.BigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Prefix Sequence"
        verbose_name_plural = "Prefix Sequences"

    @classmethod
    @transaction.atomic
    def allocate_next(cls, prefix: str) -> int:
        p, _ = cls.objects.select_for_update().get_or_create(prefix=prefix, defaults={"last_number": 0})
        p.last_number = int(p.last_number or 0) + 1
        p.save(update_fields=["last_number", "updated_at"])
        return int(p.last_number)

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
        ('BANNER_PURCHASE_DEBIT', 'Banner Purchase Debit'),
        ('COMMISSION_CREDIT', 'Commission Credit'),
        ('AUTO_POOL_DEBIT', 'Auto Pool Debit'),
        ('ADJUSTMENT_CREDIT', 'Adjustment Credit'),
        ('ADJUSTMENT_DEBIT', 'Adjustment Debit'),
        ('REFUND_CREDIT', 'Refund Credit'),
        # Added for MLM/Packages
        ('PRIME_ACTIVATION_CREDIT', 'Prime Activation Credit'),
        ('GLOBAL_ACTIVATION_CREDIT', 'Global Activation Credit'),
        ('DIRECT_REF_BONUS', 'Direct Referral Bonus'),
        ('WELCOME_BONUS', 'Welcome Bonus'),
        ('SELF_BONUS_ACTIVE', 'Self Bonus (Active)'),
        ('LEVEL_BONUS', 'Level Bonus'),
        ('AUTOPOOL_BONUS_FIVE', 'Auto-Pool Bonus (5-Matrix)'),
        ('AUTOPOOL_BONUS_THREE', 'Auto-Pool Bonus (3-Matrix)'),
        ('WITHDRAWAL_DEBIT', 'Withdrawal Debit'),
        ('LIFETIME_WITHDRAWAL_BONUS', 'Lifetime Withdrawal Bonus'),
        ('GLOBAL_ROYALTY', 'Global Royalty'),
        ('REWARD_CREDIT', 'Reward Credit'),
        ('REWARD_DEBIT', 'Reward Debit'),
        ('FRANCHISE_INCOME', 'Franchise Income'),
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


class UserKYC(models.Model):
    """
    Consumer KYC details for withdrawals and payouts.
    """
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name="kyc")
    bank_name = models.CharField(max_length=150, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)
    ifsc_code = models.CharField(max_length=20, blank=True)
    verified = models.BooleanField(default=False, db_index=True)
    verified_by = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="kyc_verified_set")
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "User KYC"
        verbose_name_plural = "User KYC"

    def __str__(self) -> str:
        return f"KYC<{getattr(self.user, 'username', 'user')}>"


class WithdrawalRequest(models.Model):
    METHOD_CHOICES = (
        ("upi", "UPI"),
        ("bank", "Bank Transfer"),
    )
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    )
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="withdrawal_requests", db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=16, choices=METHOD_CHOICES, default="upi", db_index=True)
    upi_id = models.CharField(max_length=100, blank=True)
    # bank fallback (can be copied from UserKYC on create)
    bank_name = models.CharField(max_length=150, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)
    ifsc_code = models.CharField(max_length=20, blank=True)

    note = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending", db_index=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="withdrawals_decided")
    payout_ref = models.CharField(max_length=100, blank=True)  # external txn id if any

    class Meta:
        ordering = ["-requested_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["status", "requested_at"]),
        ]

    def __str__(self) -> str:
        return f"WDR<{self.user.username}> ₹{self.amount} [{self.status}]"

    @transaction.atomic
    def approve(self, actor: CustomUser, payout_ref: str | None = None):
        if self.status != "pending":
            raise ValueError("Only pending withdrawals can be approved.")
        # Debit user wallet
        w = Wallet.get_or_create_for_user(self.user)
        w.debit(
            self.amount,
            tx_type="WITHDRAWAL_DEBIT",
            meta={"withdrawal_id": self.id, "method": self.method, "payout_ref": payout_ref or ""},
            source_type="WITHDRAWAL",
            source_id=str(self.id),
        )
        # Lifetime 3% referral withdrawal bonus to direct sponsor (if exists)
        sponsor = getattr(self.user, "registered_by", None)
        try:
            if sponsor:
                bonus = (self.amount or Decimal("0")) * Decimal("0.03")
                if bonus > 0:
                    sw = Wallet.get_or_create_for_user(sponsor)
                    sw.credit(
                        bonus.quantize(Decimal("0.01")),
                        tx_type="LIFETIME_WITHDRAWAL_BONUS",
                        meta={"from_user": self.user.username, "withdrawal_id": self.id},
                        source_type="WITHDRAWAL_BONUS",
                        source_id=str(self.id),
                    )
        except Exception:
            # best-effort
            pass
        # Persist status
        from django.utils import timezone as _tz
        self.status = "approved"
        self.decided_by = actor
        self.decided_at = _tz.now()
        if payout_ref:
            self.payout_ref = payout_ref
        self.save(update_fields=["status", "decided_by", "decided_at", "payout_ref"])

    @transaction.atomic
    def reject(self, actor: CustomUser, reason: str | None = None):
        if self.status != "pending":
            raise ValueError("Only pending withdrawals can be rejected.")
        from django.utils import timezone as _tz
        self.status = "rejected"
        self.decided_by = actor
        self.decided_at = _tz.now()
        if reason:
            self.note = (self.note or "") + f"\nRejected: {reason}"
        self.save(update_fields=["status", "decided_by", "decided_at", "note"])


@receiver(post_save, sender=CustomUser)
def create_wallet_for_new_user(sender, instance: CustomUser, created: bool, **kwargs):
    if created:
        try:
            Wallet.objects.get_or_create(user=instance, defaults={'balance': Decimal('0.00')})
        except Exception:
            # Avoid blocking user creation if wallet init fails
            pass


@receiver(post_save, sender=CustomUser)
def handle_new_user_post_save(sender, instance: CustomUser, created: bool, **kwargs):
    """
    On new user creation:
      - Trigger referral join payouts and optional autopool placement.
      - Optionally distribute franchise benefit on registration (config-driven).
    """
    if not created:
        return
    # Best-effort guard against import issues
    cfg = None
    try:
        from business.models import CommissionConfig
        cfg = CommissionConfig.get_solo()
    except Exception:
        pass

    # Referral join payouts (DIRECT_REF_BONUS + LEVEL_BONUS) and optional autopool
    try:
        from business.services import referral as referral_service
        referral_service.on_user_join(instance, source={"type": "user", "id": instance.id})
    except Exception:
        # do not block user creation
        pass

    # Franchise benefit distribution on registration
    try:
        if cfg is None or getattr(cfg, "enable_franchise_on_join", True):
            from business.services import franchise as franchise_service
            franchise_service.distribute_franchise_benefit(
                instance,
                trigger="registration",
                source={"type": "user", "id": instance.id},
            )
    except Exception:
        # best-effort, non-blocking
        pass
