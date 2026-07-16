from django.contrib.auth.models import AbstractUser
from django.db import models, transaction
from locations.models import State


class CustomUser(AbstractUser):
    # USERNAME_FIELD must be globally unique in Django; keep global uniqueness.
    username = models.CharField(max_length=150, unique=True, db_index=True)

    ROLE_CHOICES = [
        ('user', 'User'),
        ('agency', 'Agency'),
        ('employee', 'Employee'),
    ]

    CATEGORY_CHOICES = [
        ('consumer', 'Consumer (General User)'),
        ('employee', 'Employee'),
        ('business', 'Business'),
        ('merchant', 'Merchant'),
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
    IDENTITY_END_USER = 'END_USER'
    IDENTITY_ADMIN = 'ADMIN'
    IDENTITY_TYPE_CHOICES = [
        (IDENTITY_END_USER, 'End User'),
        (IDENTITY_ADMIN, 'Admin'),
    ]

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user', db_index=True)
    identity_type = models.CharField(max_length=20, choices=IDENTITY_TYPE_CHOICES, default=IDENTITY_END_USER, db_index=True)
    # Specific registration category for username/ownership logic
    category = models.CharField(max_length=40, choices=CATEGORY_CHOICES, default='consumer', db_index=True)
    # Admin RBAC Role (single role per admin user; null for non-admins)
    admin_role = models.ForeignKey('adminapi.Role', null=True, blank=True, on_delete=models.SET_NULL, related_name='users')
    admin_roles = models.ManyToManyField('adminapi.Role', through='adminapi.UserRole', related_name='assigned_users', blank=True)

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
    avatar = models.ImageField(upload_to='uploads/profile/', blank=True, null=True, max_length=500)
    sponsor_id = models.CharField(max_length=64, blank=True)
    prefix_code = models.CharField(max_length=6, blank=True, db_index=True)
    prefixed_id = models.CharField(max_length=32, unique=True, null=True, blank=True)
    # 5-Matrix genealogy fields
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='children')
    matrix_position = models.PositiveSmallIntegerField(null=True, blank=True, db_index=True)
    depth = models.PositiveIntegerField(default=0, db_index=True)

    # Activation/eligibility flags
    first_purchase_activated_at = models.DateTimeField(null=True, blank=True)
    # Admin-controlled account status for earnings/eligibility
    account_active = models.BooleanField(default=False, db_index=True)
    autopool_enabled = models.BooleanField(default=False)
    rewards_enabled = models.BooleanField(default=False)
    is_agency_unlocked = models.BooleanField(default=False)
    can_create_self_accounts = models.BooleanField(default=False)
    # Encrypted copy of the last set password (Fernet). Visible only to superusers in admin.
    last_password_encrypted = models.TextField(null=True, blank=True)

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
            # Speed up AdminUsers list filters and ordering
            models.Index(fields=['date_joined']),
            models.Index(fields=['account_active', 'date_joined']),
            models.Index(fields=['first_purchase_activated_at']),
            models.Index(fields=['role', 'category']),
            models.Index(fields=['identity_type', 'is_staff']),
        ]

    def __str__(self):
        return f"{self.username} ({self.role} / {self.category})"

    # Prefix mapping and allocation for hierarchical sponsor codes
    PREFIX_MAP = {
        'consumer': 'TR',
        'employee': 'TREP',
        'business': 'TRBS',
        'merchant': 'TRBS',
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
        if self.is_staff or self.is_superuser:
            self.identity_type = CustomUser.IDENTITY_ADMIN
        elif not self.identity_type:
            self.identity_type = CustomUser.IDENTITY_END_USER

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

        # Initialize account_active default on creation:
        # - Agencies start INACTIVE by default (activate after first AgencyPackagePayment)
        # - Business/Merchant remain Active by default
        if getattr(self._state, "adding", False):
            try:
                if self.category in ("business", "merchant"):
                    self.account_active = True
            except Exception:
                # best-effort
                pass

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
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver


class Wallet(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='wallet')
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # New dual-balance model
    main_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)         # Gross earnings (e.g., commissions)
    withdrawable_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0) # Net withdrawable after tax withholding
    self_account_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # Streamed 25% reserve for auto-activation packs
    franchise_total_earning = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    franchise_active_work = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    franchise_inactive_work = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    franchise_self_rebirth = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    franchise_company_marketing = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    franchise_reward_points = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    franchise_shopping_scanner = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Wallet<{self.user.username}> ₹{self.balance}"

    @transaction.atomic
    def credit(
        self,
        amount: Decimal,
        tx_type: str,
        meta: dict | None = None,
        source_type: str | None = None,
        source_id: str | None = None,
        matrix_account_id: int | None = None,
    ):
        """
        Credit logic with dual-wallet support:
        - COMMISSION_CREDIT: withhold cfg.tax_percent to company wallet, add gross to main, net to withdrawable.
        - Other credits: add to main (no withholding), do not change withdrawable unless explicitly done elsewhere.
        """
        # Determine activation status; accrue to main ledger for inactive users, but do not add to withdrawable or run auto-block
        try:
            inactive = not bool(getattr(self.user, "account_active", False))
        except Exception:
            inactive = False
        from decimal import Decimal as D
        # Lock this wallet row
        w = Wallet.objects.select_for_update().get(pk=self.pk)
        amt = D(amount or 0)

        meta = meta or {}
        tx_name = str(tx_type or "")
        tx_upper = tx_name.upper()
        COMMISSION_WITHHOLD_TYPES = {
            "COMMISSION_CREDIT",
            "DIRECT_REF_BONUS",
            "LEVEL_BONUS",
            "AUTOPOOL_BONUS_FIVE",
            "AUTOPOOL_BONUS_THREE",
            "FRANCHISE_INCOME",
            "GLOBAL_ROYALTY",
            # Prime payouts (direct/self) should follow 75/25 streaming
            "PRIME_150_DIRECT",
            "PRIME_750_DIRECT",
            "PRIME_150_SELF",
            "PRIME_750_SELF",
            # Monthly 759 payouts follow 75/25 streaming
            "MONTHLY_759_DIRECT",
            "MONTHLY_759_SELF",
        }
        # Normalize tx type for classification to make PRIME streaming robust
        is_commission = (tx_upper in COMMISSION_WITHHOLD_TYPES)
        is_prime_tx = tx_upper.startswith("PRIME_") and (tx_upper.endswith("_DIRECT") or tx_upper.endswith("_SELF"))
        no_withhold = bool(meta.get("no_withhold"))

        user_role = str(getattr(self.user, "role", "") or "").lower()
        user_category = str(getattr(self.user, "category", "") or "").lower()
        is_franchise_user = user_role == "agency" or user_category.startswith("agency_")
        if tx_upper == "FRANCHISE_INCOME" and is_franchise_user and not no_withhold and amt > 0:
            active_work = (amt * D("0.1875")).quantize(D("0.01"))
            inactive_work = (amt * D("0.1875")).quantize(D("0.01"))
            self_rebirth = (amt * D("0.25")).quantize(D("0.01"))
            company_marketing = (amt - active_work - inactive_work - self_rebirth).quantize(D("0.01"))

            w.franchise_total_earning = (w.franchise_total_earning or D("0")) + amt
            w.franchise_active_work = (w.franchise_active_work or D("0")) + active_work
            w.franchise_inactive_work = (w.franchise_inactive_work or D("0")) + inactive_work
            w.franchise_self_rebirth = (w.franchise_self_rebirth or D("0")) + self_rebirth
            w.franchise_company_marketing = (w.franchise_company_marketing or D("0")) + company_marketing
            w.balance = (w.balance or D("0")) + amt
            w.save(update_fields=[
                "balance",
                "franchise_total_earning",
                "franchise_active_work",
                "franchise_inactive_work",
                "franchise_self_rebirth",
                "franchise_company_marketing",
                "updated_at",
            ])

            split_meta = {
                **(meta or {}),
                "ledger": "FRANCHISE_BUCKETS",
                "split": "FRANCHISE_18_75_18_75_25_37_5",
                "gross": str(amt),
                "active_work_18_75": str(active_work),
                "inactive_work_18_75": str(inactive_work),
                "self_rebirth_25": str(self_rebirth),
                "company_marketing_37_5": str(company_marketing),
                "orig_type": str(tx_type),
            }
            WalletTransaction.objects.create(
                user=self.user,
                amount=amt,
                balance_after=w.balance,
                type="FRANCHISE_INCOME",
                source_type=source_type or '',
                source_id=str(source_id) if source_id is not None else '',
                meta=split_meta,
                matrix_account_id=matrix_account_id,
            )
            return w.balance

        if (is_commission or is_prime_tx) and not no_withhold and amt > 0:
            # 75/25 streaming model:
            # - 75% -> income (main + withdrawable when active)
            # - 25% -> self reserve (self_account_balance)
            income = (amt * D("0.75")).quantize(D("0.01"))
            self_part = (amt - income).quantize(D("0.01"))
            if self_part < D("0.00"):
                self_part = D("0.00")

            # Update balances (streaming does NOT touch withdrawable_balance)
            w.main_balance = (w.main_balance or D("0")) + income
            w.self_account_balance = (w.self_account_balance or D("0")) + self_part
            w.balance = (w.balance or D("0")) + amt
            w.save(update_fields=["balance", "main_balance", "self_account_balance", "updated_at"])

            # Record 75% income credit (for visibility)
            meta_main = {**(meta or {}), "ledger": "MAIN", "split": "STREAM_75_25", "gross": str(amt), "income_75": str(income), "self_25": str(self_part), "orig_type": str(tx_type)}
            if inactive:
                meta_main["pending_due_to_inactive"] = True
            WalletTransaction.objects.create(
                user=self.user,
                amount=income,
                balance_after=w.balance,
                type="INCOME_CREDIT_75",
                source_type=source_type or '',
                source_id=str(source_id) if source_id is not None else '',
                meta=meta_main,
                matrix_account_id=matrix_account_id,
            )


            # 25% self reserve credit marker
            if self_part > 0:
                WalletTransaction.objects.create(
                    user=self.user,
                    amount=self_part,
                    balance_after=w.balance,
                    type="SELF_ACCOUNT_CREDIT",
                    source_type=source_type or '',
                    source_id=str(source_id) if source_id is not None else '',
                    meta={**(meta or {}), "ledger": "SELF_ACCOUNT", "split": "STREAM_75_25", "orig_type": str(tx_type)},
                    matrix_account_id=matrix_account_id,
                )

            # Apply micro-packs (₹250) from self reserve for active users
            if not inactive:
                try:
                    self._apply_self_account_rule(w)
                except Exception:
                    pass

            return w.balance

        # Default: non-commission or withholding disabled
        w.main_balance = (w.main_balance or D("0")) + amt
        w.balance = (w.balance or D("0")) + amt
        w.save(update_fields=['balance', 'main_balance', 'updated_at'])
        meta2 = dict(meta or {})
        if inactive:
            meta2["pending_due_to_inactive"] = True
        WalletTransaction.objects.create(
            user=self.user,
            amount=amt,
            balance_after=w.balance,
            type=tx_type,
            source_type=source_type or '',
            source_id=str(source_id) if source_id is not None else '',
            meta=meta2,
            matrix_account_id=matrix_account_id,
        )
        return w.balance

    @transaction.atomic
    def debit(
        self,
        amount: Decimal,
        tx_type: str,
        meta: dict | None = None,
        source_type: str | None = None,
        source_id: str | None = None,
        matrix_account_id: int | None = None,
    ):
        from decimal import Decimal as D
        amt = D(amount or 0)
        if amt <= 0:
            raise ValueError("Debit amount must be positive.")
        # Lock this wallet row
        w = Wallet.objects.select_for_update().get(pk=self.pk)

        if tx_type == "INTERNAL_WALLET_DEBIT":
            upload_sources = ["WALLET_UPLOAD", "UPLOAD_TO_WALLET", "PACKAGE_UPLOAD", "PACKAGE_BUY_UPLOAD"]
            internal_credit = WalletTransaction.objects.filter(
                user=self.user,
                type="INTERNAL_WALLET_CREDIT",
                amount__gt=0,
            ).exclude(source_type__in=upload_sources).aggregate(total=models.Sum("amount"))["total"] or D("0")
            internal_debit = WalletTransaction.objects.filter(
                user=self.user,
                type="INTERNAL_WALLET_DEBIT",
                amount__lt=0,
            ).exclude(source_type__in=upload_sources).aggregate(total=models.Sum("amount"))["total"] or D("0")
            internal_available = D(str(internal_credit)) + D(str(internal_debit))
            if internal_available < amt:
                raise ValueError("Insufficient internal wallet balance.")
            w.balance = (w.balance or D("0")) - amt
            if w.balance < 0:
                raise ValueError("Insufficient wallet balance.")
            w.save(update_fields=["balance", "updated_at"])
        elif tx_type == "WITHDRAWAL_DEBIT":
            # Debit specifically from the withdrawal pocket.
            new_wd = (w.withdrawable_balance or D("0")) - amt
            if new_wd < 0:
                raise ValueError("Insufficient withdrawal wallet balance.")
            w.withdrawable_balance = new_wd
            w.balance = (w.balance or D("0")) - amt
            if w.balance < 0:
                w.balance = D("0")
            w.save(update_fields=['balance', 'withdrawable_balance', 'updated_at'])
        else:
            # Generic debit from total; reduce main first
            new_main = (w.main_balance or D("0"))
            take_main = min(new_main, amt)
            new_main = new_main - take_main
            rem = amt - take_main
            new_wd = (w.withdrawable_balance or D("0"))
            if rem > 0:
                if new_wd < rem:
                    raise ValueError("Insufficient wallet balance.")
                new_wd = new_wd - rem
            w.main_balance = new_main
            w.withdrawable_balance = new_wd
            w.balance = (w.balance or D("0")) - amt
            if w.balance < 0:
                raise ValueError("Insufficient wallet balance.")
            w.save(update_fields=['balance', 'main_balance', 'withdrawable_balance', 'updated_at'])

        WalletTransaction.objects.create(
            user=self.user,
            amount=amt * D('-1'),
            balance_after=w.balance,
            type=tx_type,
            source_type=source_type or '',
            source_id=str(source_id) if source_id is not None else '',
            meta=meta or {},
            matrix_account_id=matrix_account_id,
        )
        return w.balance

    @classmethod
    @transaction.atomic
    def release_pending_for_user(cls, user: "CustomUser"):
        """
        Convert all pending_due_to_inactive credits into withdrawable credits for the given user.
        - For commission transactions: use recorded 'net' in meta.
        - For non-commission transactions: release full amount.
        - Does not change total balance; only increases withdrawable balance and appends WITHDRAWABLE_CREDIT markers.
        - Clears the pending flag on original transactions to ensure idempotency.
        """
        from decimal import Decimal as D
        if not user:
            return
        # Ensure wallet and lock for update
        w = cls.get_or_create_for_user(user)
        w = cls.objects.select_for_update().get(pk=w.pk)

        # Find all transactions marked pending due to inactive
        qs = WalletTransaction.objects.filter(user=user, meta__pending_due_to_inactive=True).order_by("id")
        for tx in qs:
            try:
                meta = dict(tx.meta or {})
            except Exception:
                meta = {}
            # Determine net to release
            net_val = meta.get("net", None)
            try:
                net = D(str(net_val)) if net_val is not None else D(str(tx.amount or "0"))
            except Exception:
                net = D("0")
            if net <= 0:
                # Clear the pending flag even if nothing to release
                if meta.get("pending_due_to_inactive"):
                    meta["pending_due_to_inactive"] = False
                    tx.meta = meta
                    tx.save(update_fields=["meta"])
                continue

            # Increase withdrawable only (do not change total balance/main)
            w.withdrawable_balance = (w.withdrawable_balance or D("0")) + net
            w.save(update_fields=["withdrawable_balance", "updated_at"])

            # Append a withdrawable credit marker linked to original tx
            WalletTransaction.objects.create(
                user=user,
                amount=net,
                balance_after=w.balance,
                type="WITHDRAWABLE_CREDIT",
                source_type=tx.source_type or "",
                source_id=tx.source_id or "",
                meta={"ledger": "WITHDRAWAL", "released_from": "pending_inactive", "original_tx_id": tx.id},
            )

            # Clear pending flag on original transaction
            meta["pending_due_to_inactive"] = False
            meta["released_from_pending"] = True
            try:
                meta["released_net"] = str(net)
            except Exception:
                pass
            tx.meta = meta
            tx.save(update_fields=["meta"])

    @classmethod
    def get_or_create_for_user(cls, user: CustomUser) -> "Wallet":
        w, _ = cls.objects.get_or_create(user=user, defaults={'balance': Decimal('0.00')})
        return w


    def _apply_self_account_rule(self, w: "Wallet"):
        """
        Consume self_account_balance in ₹250 micro-packs:
          - ₹150 auto e‑coupon purchase for self (requires available coupon; if not available, stop)
          - ₹50 direct sponsor bonus (to registered_by, or routed to company if no sponsor)
          - ₹50 company/royalty credit
        Effects per pack:
          - self_account_balance -= 250
          - balance -= 250
          - Transactions:
              SELF_ACCOUNT_DEBIT -250 (pack marker)
              AUTO_PURCHASE_DEBIT -150 (if coupon allocated)
              ADJUSTMENT_DEBIT -50 (user-side marker for company portion)
              ADJUSTMENT_DEBIT -50 (user-side marker for sponsor portion)
              Sponsor DIRECT_REF_BONUS +50 (no_withhold)
              Company TAX_POOL_CREDIT +50 (no_withhold)
          - AuditTrail: action="auto_250_self_pack_applied"
        """
        from decimal import Decimal as D
        try:
            from coupons.models import AuditTrail, CouponCode
        except Exception:
            return  # coupons app not available

        # Helper: resolve company recipient
        def _get_company_user():
            try:
                from business.models import CommissionConfig, RootConsumerConfig
                cfg = CommissionConfig.get_solo()
                # Prefer Root Consumer if configured, else tax_company_user
                rc = RootConsumerConfig.get_solo().get_root_user()
                cu = rc or getattr(cfg, "tax_company_user", None)
            except Exception:
                cu = None
            if cu:
                return cu
            try:
                return CustomUser.objects.filter(category="company").first() or CustomUser.objects.filter(is_superuser=True).first()
            except Exception:
                return None

        # Reentrancy Guard: Prevent recursive execution on the same wallet instance
        if getattr(w, "_applying_self_rule", False):
            return
        w._applying_self_rule = True

        try:
            sponsor = getattr(self.user, "registered_by", None)
            company_user = _get_company_user()

            loops = 0
            while True:
                loops += 1
                if loops > 50:
                    break  # hard safety

                # Re-fetch the wallet row from database at the start of each iteration to get
                # the absolute latest balance (accounting for recursive/nested credits)
                try:
                    w = Wallet.objects.select_for_update().get(pk=w.pk)
                    cur_self = D(str(getattr(w, "self_account_balance", "0") or "0"))
                except Exception:
                    cur_self = D("0")

                if cur_self < D("250.00"):
                    break

                # Balance safety check before deduction
                if cur_self < D("250.00") or (w.balance or D("0")) < D("250.00"):
                    break

                # Deduct the pack from self-reserve and overall balance
                w.self_account_balance = cur_self - D("250.00")
                w.balance = (w.balance or D("0")) - D("250.00")
                w.save(update_fields=["balance", "self_account_balance", "updated_at"])

                # Record SELF_ACCOUNT_DEBIT marker with breakdown and pack index
                try:
                    existing = WalletTransaction.objects.filter(user=self.user, type="SELF_ACCOUNT_DEBIT", source_type="SELF_250_PACK").count()
                    pack_index = int(existing) + 1
                except Exception:
                    pack_index = None

                WalletTransaction.objects.create(
                    user=self.user,
                    amount=D("-250.00"),
                    balance_after=w.balance,
                    type="SELF_ACCOUNT_DEBIT",
                    source_type="SELF_250_PACK",
                    source_id="",
                    meta={
                        "source_type": "SELF_250_PACK",
                        "breakdown": {"coupon": 150, "sponsor": 50, "company": 50},
                        "coupon_code": None,
                        "sponsor_user_id": getattr(sponsor, "id", None) if sponsor else getattr(company_user, "id", None),
                        "company_user_id": getattr(company_user, "id", None),
                        "pack_index": pack_index,
                    }
                )

                # Record prime purchase marker (₹150 used for Prime 150 activation)
                try:
                    WalletTransaction.objects.create(
                        user=self.user,
                        amount=D("-150.00"),
                        balance_after=w.balance,
                        type="AUTO_PURCHASE_DEBIT",
                        source_type="SELF_250_PACK",
                        source_id=str(pack_index) if pack_index is not None else "",
                        meta={"source_type": "SELF_250_PACK", "purchase": "PRIME_150", "pack_index": pack_index},
                    )
                except Exception:
                    pass

                # Trigger Prime 150 payout engine (idempotent by source_type + source_id)
                try:
                    from business.services.prime import distribute_prime_150_payouts
                    distribute_prime_150_payouts(
                        self.user,
                        source={"type": "SELF_250_PACK", "id": str(pack_index) if pack_index is not None else ""}
                    )
                except Exception:
                    # best-effort; do not roll back pack application
                    pass

                # Sponsor and company portions (₹50 each). If no sponsor, route sponsor portion to company.
                sponsor_bonus = D("50.00")
                company_share = D("50.00")
                sponsor_recipient = sponsor if sponsor else company_user

                # Credit sponsor/company wallets (no withholding)
                if sponsor_recipient and sponsor_bonus > 0:
                    try:
                        sw = Wallet.get_or_create_for_user(sponsor_recipient)
                        sw.credit(
                            sponsor_bonus,
                            tx_type="DIRECT_REF_BONUS",
                            meta={"from_user_id": self.user.id, "from_user": getattr(self.user, "username", None), "no_withhold": True, "auto_rule": "SELF_250_PACK"},
                            source_type="SELF_250_PACK",
                            source_id="",
                        )
                    except Exception:
                        pass

                if company_user and company_share > 0:
                    try:
                        cw = Wallet.get_or_create_for_user(company_user)
                        cw.credit(
                            company_share,
                            tx_type="TAX_POOL_CREDIT",
                            meta={"from_user_id": self.user.id, "from_user": getattr(self.user, "username", None), "no_withhold": True, "auto_rule": "SELF_250_PACK"},
                            source_type="SELF_250_PACK",
                            source_id="",
                        )
                    except Exception:
                        pass

                # Audit pack application
                try:
                    AuditTrail.objects.create(
                        action="auto_250_self_pack_applied",
                        actor=self.user,
                        notes="Applied SELF_250_PACK",
                        metadata={
                            "prime_used": True,
                            "pack_index": pack_index,
                            "sponsor_id": getattr(sponsor_recipient, "id", None),
                            "company_id": getattr(company_user, "id", None),
                        },
                    )
                except Exception:
                    pass
        finally:
            w._applying_self_rule = False


class FranchiseWalletSettings(models.Model):
    inactive_work_day = models.PositiveSmallIntegerField(default=30)
    inactive_work_enabled = models.BooleanField(default=True)
    reward_min_withdrawal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("1000.00"))
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Franchise Wallet Settings"
        verbose_name_plural = "Franchise Wallet Settings"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1, defaults={
            "inactive_work_day": 30,
            "inactive_work_enabled": True,
            "reward_min_withdrawal": Decimal("1000.00"),
        })
        return obj

    def save(self, *args, **kwargs):
        if self.inactive_work_day < 1:
            self.inactive_work_day = 1
        if self.inactive_work_day > 31:
            self.inactive_work_day = 31
        super().save(*args, **kwargs)


class FranchiseWorkApproval(models.Model):
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="franchise_work_approvals", db_index=True)
    year = models.PositiveSmallIntegerField(db_index=True)
    month = models.PositiveSmallIntegerField(db_index=True)
    consumer_subscription_750_count = models.PositiveIntegerField(default=0)
    prime_subscription_8250_count = models.PositiveIntegerField(default=0)
    smart_purchase_plan_1000_count = models.PositiveIntegerField(default=0)
    franchise_reference_count = models.PositiveIntegerField(default=0)
    captain_business_connect_reference_count = models.PositiveIntegerField(default=0)
    tri_trip_reference_count = models.PositiveIntegerField(default=0)
    organized_meeting_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="PENDING", db_index=True)
    note = models.TextField(blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="franchise_work_approvals_decided")
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-year", "-month", "-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "year", "month"], name="uniq_franchise_work_approval_user_month"),
        ]
        indexes = [
            models.Index(fields=["year", "month", "status"]),
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self):
        return f"FranchiseWorkApproval<{self.user_id}:{self.year}-{self.month}:{self.status}>"


class FranchiseEducationPDF(models.Model):
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to="franchise/education_pdfs/")
    is_active = models.BooleanField(default=True, db_index=True)
    uploaded_by = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="franchise_education_pdfs_uploaded")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"FranchiseEducationPDF<{self.title}>"


class FranchiseAgreementTemplate(models.Model):
    title = models.CharField(max_length=180, default="Franchise Agreement")
    content = models.TextField(blank=True)
    updated_by = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="franchise_agreement_templates_updated")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Franchise Agreement Template"
        verbose_name_plural = "Franchise Agreement Template"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1, defaults={
            "title": "Franchise Agreement",
            "content": (
                "This Franchise Agreement is entered into between Trikonekt and {full_name}.\n\n"
                "Agency Details:\n"
                "Name: {full_name}\n"
                "Phone: {phone}\n"
                "Category/Role: {category_role}\n"
                "Geo Location: {geo_location}\n\n"
                "The agency agrees to follow Trikonekt operating guidelines, compliance requirements, "
                "and franchise responsibilities as communicated by the company."
            ),
        })
        return obj

    def __str__(self):
        return f"FranchiseAgreementTemplate<{self.title}>"


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
        # Dual-wallet support
        ('WITHDRAWABLE_CREDIT', 'Withdrawable Credit'),
        ('TAX_POOL_CREDIT', 'Tax Pool Credit'),
        ('ECOUPON_WALLET_DEBIT', 'E-Coupon Wallet Debit'),
        ('AUTO_PURCHASE_DEBIT', 'Auto Purchase Debit'),
        ('PRODUCT_WALLET_CREDIT', 'Product Wallet Credit'),
        ('SHOPPING_WALLET_CREDIT', 'Shopping Wallet Credit'),
        ('SHOPPING_WALLET_DEBIT', 'Shopping Wallet Debit'),
        ('SHOPPING_WALLET_TRANSFER_OUT', 'Shopping Wallet Transfer Out'),
        ('COUPON_WALLET_CREDIT', 'Coupon Wallet Credit'),
        ('COUPON_WALLET_DEBIT', 'Coupon Wallet Debit'),
        ('COUPON_WALLET_TRANSFER_OUT', 'Coupon Wallet Transfer Out'),
        ('COUPON_WALLET_REFUND', 'Coupon Wallet Refund'),
        ('PACKAGE_COUPON_WALLET_CREDIT', 'Package Coupon Wallet Credit'),
        ('PACKAGE_COUPON_WALLET_DEBIT', 'Package Coupon Wallet Debit'),
        ('VOUCHER_CREATE_DEBIT', 'Voucher Create Debit'),
        ('VOUCHER_REDEEM_CREDIT', 'Voucher Redeem Credit'),
        ('INTERNAL_WALLET_CREDIT', 'Internal Wallet Credit'),
        ('INTERNAL_WALLET_DEBIT', 'Internal Wallet Debit'),
        ('INTERNAL_WALLET_TRANSFER_OUT', 'Internal Wallet Transfer Out'),
        ('WALLET_TO_WALLET_IN', 'Wallet To Wallet In'),
        ('WALLET_TO_WALLET_OUT', 'Wallet To Wallet Out'),
        ('WITHDRAWAL_WALLET_TRANSFER_OUT', 'Withdrawal Wallet Transfer Out'),
        ('WITHDRAWAL_WALLET_CREDIT', 'Withdrawal Wallet Credit'),
        ('FRANCHISE_WD_CREDIT', 'Franchise Withdrawal Credit'),
        ('FRANCHISE_WD_TRANSFER', 'Franchise Withdrawal Transfer'),
        ('FRANCHISE_REWARD_CREDIT', 'Franchise Reward Credit'),
        # Streaming 75/25 support
        ('INCOME_CREDIT_75', 'Income Credit'),
        ('SELF_ACCOUNT_CREDIT', 'Self Account Credit'),
        ('SELF_ACCOUNT_DEBIT', 'Self Account Debit (250 Pack)'),
        ('AUTO_ECOUPON_ISSUED', 'Auto E-Coupon Issued'),
    ]
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='wallet_transactions', db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    type = models.CharField(max_length=32, choices=TYPE_CHOICES, db_index=True)
    source_type = models.CharField(max_length=64, blank=True, default='')
    source_id = models.CharField(max_length=64, blank=True, default='')
    matrix_account = models.ForeignKey(
        'business.AutoPoolAccount',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='wallet_transactions',
        db_index=True,
    )
    meta = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class WalletAccount(models.Model):
    WALLET_TYPE_CHOICES = [
        ("MAIN", "Main Wallet"),
        ("TOTAL_EARNINGS", "Total Earnings"),
        ("REDEEM_POINTS", "Redeem Points"),
        ("COUPON_POCKET", "Coupon Pocket"),
        ("SELF_PACKAGE_POCKET", "Self Package Pocket"),
        ("ADD_MONEY_POCKET", "Add Money Pocket"),
        ("WITHDRAWAL_WALLET", "Withdrawal Wallet"),
        ("PACKAGE_PURCHASE_COUPON", "Package Purchase Coupon"),
        ("SHOPPING_REBIRTH", "Shopping/Rebirth Wallets"),
        ("REWARD_WALLET", "Reward Wallet"),
        ("GIFT_CARD", "Gift Cards"),
        ("ECOMMERCE", "B2B/B2C Orders"),
        ("SYSTEM", "System/Company Wallet"),
    ]
    STATUS_CHOICES = [
        ("ACTIVE", "Active"),
        ("LOCKED", "Locked"),
        ("SUSPENDED", "Suspended"),
        ("CLOSED", "Closed"),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="wallet_accounts", db_index=True)
    wallet_type = models.CharField(max_length=40, choices=WALLET_TYPE_CHOICES, db_index=True)
    current_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    available_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    locked_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    pending_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ACTIVE", db_index=True)
    legacy_wallet = models.ForeignKey(Wallet, null=True, blank=True, on_delete=models.SET_NULL, related_name="wallet_accounts")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user_id", "wallet_type"]
        constraints = [
            models.UniqueConstraint(fields=["user", "wallet_type"], name="uniq_wallet_account_user_type"),
        ]
        indexes = [
            models.Index(fields=["wallet_type", "status"]),
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self) -> str:
        return f"WalletAccount<{self.user_id}:{self.wallet_type}:{self.current_balance}>"


class FinancialTransaction(models.Model):
    CATEGORY_CHOICES = [
        ("ADD_MONEY", "Add Money"),
        ("WITHDRAWAL", "Withdrawal"),
        ("WALLET_TRANSFER", "Wallet Transfer"),
        ("VOUCHER_CREATE", "Voucher Creation"),
        ("VOUCHER_REDEEM", "Voucher Redemption"),
        ("PACKAGE_PURCHASE", "Package Purchase"),
        ("MLM_INCOME", "MLM Income"),
        ("SPONSOR_INCOME", "Sponsor Income"),
        ("MATRIX_INCOME", "Matrix Earnings"),
        ("SELF_REBIRTH", "Self Rebirth"),
        ("SHOPPING_REWARD", "Shopping Rewards"),
        ("FRANCHISE_REWARD", "Franchise Rewards"),
        ("REWARD_DISTRIBUTION", "Reward Distribution"),
        ("GST_INVOICE", "GST Invoice"),
        ("ADMIN_ADJUSTMENT", "Admin Adjustment"),
        ("REFUND", "Refund"),
        ("SETTLEMENT", "Settlement"),
    ]
    STATUS_CHOICES = [
        ("DRAFT", "Draft"),
        ("PENDING", "Pending"),
        ("PROCESSING", "Processing"),
        ("COMPLETED", "Completed"),
        ("FAILED", "Failed"),
        ("REVERSED", "Reversed"),
        ("CANCELLED", "Cancelled"),
    ]
    APPROVAL_STATUS_CHOICES = [
        ("NOT_REQUIRED", "Not Required"),
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
        ("CANCELLED", "Cancelled"),
    ]

    transaction_ref = models.CharField(max_length=64, unique=True, db_index=True)
    flow_id = models.CharField(max_length=64, blank=True, db_index=True)
    idempotency_key = models.CharField(max_length=128, null=True, blank=True, unique=True)
    user = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="financial_transactions", db_index=True)
    category = models.CharField(max_length=40, choices=CATEGORY_CHOICES, db_index=True)
    source_module = models.CharField(max_length=80, blank=True, db_index=True)
    source_id = models.CharField(max_length=80, blank=True, db_index=True)
    destination_module = models.CharField(max_length=80, blank=True)
    gross_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    charges_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    gst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    tds_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    net_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING", db_index=True)
    approval_status = models.CharField(max_length=20, choices=APPROVAL_STATUS_CHOICES, default="NOT_REQUIRED", db_index=True)
    payment_gateway_reference = models.CharField(max_length=120, blank=True, db_index=True)
    utr_number = models.CharField(max_length=80, blank=True, db_index=True)
    reference_id = models.CharField(max_length=100, blank=True, db_index=True)
    legacy_wallet_transaction = models.ForeignKey(
        WalletTransaction,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="financial_transactions",
    )
    created_by = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="created_financial_transactions")
    approved_by = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="approved_financial_transactions")
    approved_at = models.DateTimeField(null=True, blank=True)
    remarks = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["category", "status", "created_at"]),
            models.Index(fields=["source_module", "source_id"]),
            models.Index(fields=["user", "status", "created_at"]),
            models.Index(fields=["approval_status", "created_at"]),
            models.Index(fields=["flow_id", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"FinancialTransaction<{self.transaction_ref}:{self.category}:{self.status}>"


class LedgerEntry(models.Model):
    DIRECTION_CHOICES = [
        ("DEBIT", "Debit"),
        ("CREDIT", "Credit"),
    ]
    ENTRY_STATUS_CHOICES = [
        ("POSTED", "Posted"),
        ("PENDING", "Pending"),
        ("REVERSED", "Reversed"),
    ]

    financial_transaction = models.ForeignKey(FinancialTransaction, on_delete=models.PROTECT, related_name="ledger_entries")
    wallet_account = models.ForeignKey(WalletAccount, on_delete=models.PROTECT, related_name="ledger_entries")
    user = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="ledger_entries", db_index=True)
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES, db_index=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    balance_before = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    balance_after = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=20, choices=ENTRY_STATUS_CHOICES, default="POSTED", db_index=True)
    entry_ref = models.CharField(max_length=80, blank=True, db_index=True)
    remarks = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["wallet_account", "created_at"]),
            models.Index(fields=["financial_transaction", "direction"]),
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"LedgerEntry<{self.financial_transaction_id}:{self.direction}:{self.amount}>"


# ======================
# Upload to Wallet (admin approval)
# ======================


class WalletUploadRequest(models.Model):
    """User-submitted wallet upload request (amount + UTR + proof).

    On admin approval, the amount is credited into the user's Add Money pocket
    via WalletTransaction with type INTERNAL_WALLET_CREDIT and source_type=WALLET_UPLOAD.
    """

    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
        ("CANCELLED", "Cancelled"),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="wallet_upload_requests", db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    utr = models.CharField(max_length=64, db_index=True)
    proof = models.FileField(upload_to="wallet_uploads/", null=True, blank=True)
    remarks = models.TextField(blank=True, default="")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="PENDING", db_index=True)

    requested_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="wallet_upload_decisions")

    reject_reason = models.TextField(blank=True, default="")

    # Idempotency guard: store the created WalletTransaction id when approved
    wallet_transaction = models.ForeignKey(
        "WalletTransaction",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="wallet_upload_requests",
    )

    class Meta:
        ordering = ["-requested_at", "-id"]
        indexes = [
            models.Index(fields=["status", "requested_at"], name="wul_status_req_idx"),
            models.Index(fields=["user", "status"], name="wul_user_status_idx"),
        ]

    def __str__(self) -> str:
        return f"WalletUploadRequest<{self.user_id}> ₹{self.amount} {self.status}"



class ConsumerVoucher(models.Model):
    """Consumer-created voucher funded from the Coupon Pocket wallet."""

    TYPE_TRIZONE = "TRIZONE"
    TYPE_ONLINE = "ONLINE"
    TYPE_NEAR_STORE = "NEAR_STORE"
    TYPE_PACKAGE_PURCHASE = "PACKAGE_PURCHASE"

    TYPE_CHOICES = [
        (TYPE_TRIZONE, "Triozone Coupon"),
        (TYPE_ONLINE, "Online Coupon"),
        (TYPE_NEAR_STORE, "Near Store Coupon"),
        (TYPE_PACKAGE_PURCHASE, "Self Package Coupon"),
    ]

    STATUS_ACTIVE = "ACTIVE"
    STATUS_REDEEMED = "REDEEMED"
    STATUS_EXPIRED = "EXPIRED"
    STATUS_CANCELLED = "CANCELLED"

    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_REDEEMED, "Redeemed"),
        (STATUS_EXPIRED, "Expired"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    creator = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name="created_consumer_vouchers", db_index=True)
    assigned_to = models.ForeignKey(
        CustomUser,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="assigned_consumer_vouchers",
        help_text="Optional intended redeemer, mainly for package purchase coupons.",
    )
    redeemed_by = models.ForeignKey(
        CustomUser,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="redeemed_consumer_vouchers",
    )
    voucher_type = models.CharField(max_length=32, choices=TYPE_CHOICES, db_index=True)
    code = models.CharField(max_length=32, unique=True, db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_ACTIVE, db_index=True)
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
    redeemed_at = models.DateTimeField(null=True, blank=True)
    expired_at = models.DateTimeField(null=True, blank=True)
    debit_transaction = models.ForeignKey(
        "WalletTransaction",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="voucher_debits",
    )
    redeem_transaction = models.ForeignKey(
        "WalletTransaction",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="voucher_redeems",
    )
    refund_transaction = models.ForeignKey(
        "WalletTransaction",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="voucher_refunds",
    )

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["creator", "status"], name="cv_creator_status_idx"),
            models.Index(fields=["assigned_to", "status"], name="cv_assignee_status_idx"),
            models.Index(fields=["voucher_type", "status"], name="cv_type_status_idx"),
        ]

    def __str__(self) -> str:
        return f"ConsumerVoucher<{self.code}> {self.voucher_type} {self.status}"


# ======================
# Reward Points Ledger
# ======================

class RewardPointsAccount(models.Model):
    """
    Independent reward points balance (not the money wallet).
    Points can be earned and redeemed; redemption can be reserved via RewardPointsHold
    and is finally deducted on order approval.
    """
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name="reward_points_account")
    balance_points = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user"]),
        ]

    def __str__(self) -> str:
        return f"RPA<{getattr(self.user, 'username', 'user')}> {self.balance_points} pts"

    @classmethod
    def get_or_create_for_user(cls, user: CustomUser) -> "RewardPointsAccount":
        acc, _ = cls.objects.get_or_create(user=user, defaults={"balance_points": Decimal("0.00")})
        return acc

    @classmethod
    def point_value_in_inr(cls) -> Decimal:
        """
        Conversion rate: 1 point => ₹1.00 (configurable later via CommissionConfig).
        """
        return Decimal("1.00")

    @classmethod
    def get_available_points(cls, user: CustomUser) -> Decimal:
        from decimal import Decimal as D
        acc = cls.get_or_create_for_user(user)
        # Sum of pending holds
        pending = RewardPointsHold.objects.filter(user=user, status=RewardPointsHold.STATUS_PENDING).aggregate(
            s=models.Sum("points")
        )["s"] or D("0.00")
        avail = (acc.balance_points or D("0.00")) - pending
        if avail < D("0.00"):
            avail = D("0.00")
        return avail.quantize(D("0.01"))

    @classmethod
    def get_available_value_in_inr(cls, user: CustomUser) -> Decimal:
        from decimal import Decimal as D
        pts = cls.get_available_points(user)
        rate = cls.point_value_in_inr()
        return (pts * rate).quantize(D("0.01"))

    @classmethod
    @transaction.atomic
    def reserve_value(cls, user: CustomUser, value_in_inr: Decimal, *, source_type: str, source_id: str, meta: dict | None = None) -> "RewardPointsHold":
        """
        Reserve (hold) reward points for a purchase equal to the given ₹ value.
        Raises ValidationError if insufficient available points.
        """
        from decimal import Decimal as D
        rate = cls.point_value_in_inr()
        val = D(str(value_in_inr or "0"))
        if val <= D("0"):
            raise ValidationError("Reserve value must be positive.")
        need_points = (val / rate).quantize(D("0.01"))
        acc = cls.get_or_create_for_user(user)
        # Lock account row
        acc = RewardPointsAccount.objects.select_for_update().get(pk=acc.pk)
        available = cls.get_available_points(user)
        if available < need_points:
            raise ValidationError("Insufficient reward points to reserve.")
        hold = RewardPointsHold.objects.create(
            user=user,
            points=need_points,
            status=RewardPointsHold.STATUS_PENDING,
            source_type=source_type or "",
            source_id=str(source_id or ""),
            metadata={**(meta or {}), "reserved_value": str(val), "rate": str(rate)},
        )
        return hold

    @classmethod
    @transaction.atomic
    def commit_hold(cls, hold: "RewardPointsHold", *, commit_points: Decimal | None = None, meta: dict | None = None):
        """
        Convert a pending hold into a final redemption by deducting points from the account.
        If commit_points is provided and smaller than hold.points, only that many points are redeemed;
        the remainder becomes available automatically because the hold will no longer be pending.
        """
        from decimal import Decimal as D
        if not hold or hold.status != RewardPointsHold.STATUS_PENDING:
            raise ValidationError("Hold is not pending.")
        pts = D(str(commit_points if commit_points is not None else hold.points))
        if pts <= D("0"):
            # Nothing to commit; just release the hold
            hold.status = RewardPointsHold.STATUS_RELEASED
            hold.save(update_fields=["status", "updated_at"])
            return
        if pts > hold.points:
            pts = hold.points

        acc = RewardPointsAccount.get_or_create_for_user(hold.user)
        # Lock account row
        acc = RewardPointsAccount.objects.select_for_update().get(pk=acc.pk)
        if (acc.balance_points or D("0.00")) < pts:
            raise ValidationError("Insufficient reward points to commit.")
        acc.balance_points = (acc.balance_points or D("0.00")) - pts
        acc.save(update_fields=["balance_points", "updated_at"])

        RewardPointsTransaction.objects.create(
            user=hold.user,
            points=pts * D("-1"),
            type=RewardPointsTransaction.TYPE_REDEEM,
            meta=meta or {},
        )
        # Mark hold completed (store committed info)
        md = hold.metadata or {}
        md["committed_points"] = str(pts)
        hold.metadata = md
        hold.status = RewardPointsHold.STATUS_COMPLETED
        hold.save(update_fields=["metadata", "status", "updated_at"])

    @classmethod
    @transaction.atomic
    def release_hold(cls, hold: "RewardPointsHold"):
        if not hold or hold.status != RewardPointsHold.STATUS_PENDING:
            return
        hold.status = RewardPointsHold.STATUS_RELEASED
        hold.save(update_fields=["status", "updated_at"])

    @classmethod
    @transaction.atomic
    def credit_points(cls, user: CustomUser, points: Decimal, *, reason: str = "EARN", meta: dict | None = None):
        """
        Credit (earn) reward points to the user's account.
        """
        from decimal import Decimal as D
        pts = D(str(points or "0"))
        if pts <= D("0"):
            raise ValidationError("Credit points must be positive.")
        acc = cls.get_or_create_for_user(user)
        acc = RewardPointsAccount.objects.select_for_update().get(pk=acc.pk)
        acc.balance_points = (acc.balance_points or D("0.00")) + pts
        acc.save(update_fields=["balance_points", "updated_at"])
        RewardPointsTransaction.objects.create(
            user=user,
            points=pts,
            type=RewardPointsTransaction.TYPE_EARN,
            meta=meta or {"reason": reason},
        )


class RewardPointsTransaction(models.Model):
    TYPE_EARN = "EARN"
    TYPE_REDEEM = "REDEEM"
    TYPE_ADJUST = "ADJUST"
    TYPE_CHOICES = [
        (TYPE_EARN, "Earn"),
        (TYPE_REDEEM, "Redeem"),
        (TYPE_ADJUST, "Adjust"),
    ]
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="reward_points_transactions", db_index=True)
    points = models.DecimalField(max_digits=12, decimal_places=2)
    type = models.CharField(max_length=16, choices=TYPE_CHOICES, db_index=True)
    meta = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "type"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        return f"RPT<{getattr(self.user, 'username', 'user')}> {self.type} {self.points} pts"


class RewardPointsHold(models.Model):
    STATUS_PENDING = "PENDING"
    STATUS_COMPLETED = "COMPLETED"
    STATUS_RELEASED = "RELEASED"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_RELEASED, "Released"),
    ]
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="reward_points_holds", db_index=True)
    points = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    source_type = models.CharField(max_length=64, blank=True, default="")
    source_id = models.CharField(max_length=64, blank=True, default="")
    metadata = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["source_type", "source_id"]),
        ]

    def __str__(self) -> str:
        return f"Hold<{getattr(self.user, 'username', 'user')}> {self.points} pts [{self.status}]"


@receiver(post_save, sender=CustomUser)
def create_reward_account_for_new_user(sender, instance: CustomUser, created: bool, **kwargs):
    if created:
        def _create_rpa():
            try:
                RewardPointsAccount.objects.get_or_create(user=instance, defaults={"balance_points": Decimal("0.00")})
            except Exception:
                # Do not block user creation
                pass
        try:
            transaction.on_commit(_create_rpa)
        except Exception:
            # Fallback when on_commit is unavailable (e.g., autocommit)
            _create_rpa()


class UserKYC(models.Model):
    """
    Consumer KYC details for withdrawals and payouts.
    """
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name="kyc")
    bank_name = models.CharField(max_length=150, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)
    ifsc_code = models.CharField(max_length=20, blank=True)
    # Optional: link to user's DigiLocker document or Aadhaar proof
    aadhaar_digilocker_url = models.CharField(max_length=255, blank=True)
    verified = models.BooleanField(default=False, db_index=True)
    verified_by = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="kyc_verified_set")
    verified_at = models.DateTimeField(null=True, blank=True)
    kyc_reopen_allowed = models.BooleanField(default=False, db_index=True)
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
        ("bank", "Bank Transfer"),
    )
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    )
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="withdrawal_requests", db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=16, choices=METHOD_CHOICES, default="bank", db_index=True)
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
        def _create_wallet():
            try:
                Wallet.objects.get_or_create(user=instance, defaults={'balance': Decimal('0.00')})
            except Exception:
                # Avoid blocking user creation if wallet init fails
                pass
        try:
            transaction.on_commit(_create_wallet)
        except Exception:
            # Fallback when on_commit is unavailable (e.g., autocommit)
            _create_wallet()


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
        from business.models import CommissionConfig, AutoPoolAccount
        cfg = CommissionConfig.get_solo()
    except Exception:
        cfg = None

    # Disabled: Do not create 5-matrix entries on registration.
    # Matrix entries (FIVE_150/THREE_150) must open only after first PRIME activation (150/750/759).
    # Previously this block created FIVE_150 on join when cfg.autopool_trigger_on_direct_referral was True.

    # DEFERRED: No referral/matrix payouts on registration.
    # Intentionally not calling referral.on_user_join here. Payouts will be triggered on first activation.

    # DEFERRED: No franchise payouts on registration.
    # Franchise payouts will be triggered on first activation inside ensure_first_purchase_activation.


@receiver(post_save, sender=CustomUser)
def release_pending_on_activation(sender, instance: CustomUser, created: bool, **kwargs):
    """
    When a user's account_active becomes True (via admin or any other path),
    release all pending_due_to_inactive wallet credits into withdrawable balance.
    Idempotent: original txs have their pending flag cleared on release.
    """
    if created:
        return
    try:
        if getattr(instance, "account_active", False):
            from accounts.models import Wallet
            Wallet.release_pending_for_user(instance)
    except Exception:
        # best-effort; do not block saves
        pass

class UserNominee(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="nominees", db_index=True)
    name = models.CharField(max_length=150)
    relationship = models.CharField(max_length=50, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    share_percent = models.PositiveSmallIntegerField(default=0)  # 0..100
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        indexes = [
            models.Index(fields=["user"]),
        ]

    def __str__(self) -> str:
        return f"Nominee<{self.user.username}: {self.name} ({self.share_percent}%)>"

class SupportTicket(models.Model):
    TYPE_CHOICES = [
        ('KYC_REVERIFY', 'KYC Re-verification'),
        ('GENERAL', 'General'),
    ]
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('in_progress', 'In Progress'),
        ('resolved', 'Resolved'),
        ('rejected', 'Rejected'),
        ('closed', 'Closed'),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='support_tickets', db_index=True)
    type = models.CharField(max_length=32, choices=TYPE_CHOICES, db_index=True)
    subject = models.CharField(max_length=200)
    message = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open', db_index=True)
    admin_assignee = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name='assigned_tickets')
    resolution_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'type'],
                name='uniq_open_kyc_reverify_ticket',
                condition=models.Q(type='KYC_REVERIFY') & models.Q(status__in=['open', 'in_progress'])
            ),
        ]

    def __str__(self) -> str:
        return f"Ticket<{self.id}> {self.type} {self.status}"


class SupportTicketMessage(models.Model):
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='messages')
    author = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='support_messages')
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']

    def __str__(self) -> str:
        return f"Msg<{self.ticket_id} by {getattr(self.author, 'username', '')}>"


class PasswordResetOTP(models.Model):
    IDENTITY_TYPE_CHOICES = CustomUser.IDENTITY_TYPE_CHOICES
    PURPOSE_PASSWORD_RESET = "PASSWORD_RESET"
    PURPOSE_ADMIN_LOGIN = "ADMIN_LOGIN"
    PURPOSE_CHOICES = [
        (PURPOSE_PASSWORD_RESET, "Password Reset"),
        (PURPOSE_ADMIN_LOGIN, "Admin Login"),
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="password_reset_otps")
    identity_type = models.CharField(max_length=20, choices=IDENTITY_TYPE_CHOICES, db_index=True)
    purpose = models.CharField(max_length=32, choices=PURPOSE_CHOICES, default=PURPOSE_PASSWORD_RESET, db_index=True)
    otp_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField(db_index=True)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=5)
    is_used = models.BooleanField(default=False, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "password_reset_otps"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "identity_type", "is_used"]),
            models.Index(fields=["user", "identity_type", "purpose", "is_used"]),
            models.Index(fields=["expires_at", "is_used"]),
            models.Index(fields=["ip_address", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"PasswordResetOTP<{self.user_id}:{self.identity_type}:{'used' if self.is_used else 'active'}>"


class AuditLog(models.Model):
    actor_user = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_events")
    action = models.CharField(max_length=80, db_index=True)
    resource_type = models.CharField(max_length=100, blank=True, db_index=True)
    resource_id = models.CharField(max_length=100, blank=True, db_index=True)
    before_json = models.JSONField(null=True, blank=True)
    after_json = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["actor_user", "action"]),
            models.Index(fields=["resource_type", "resource_id"]),
        ]

    def __str__(self) -> str:
        return f"AuditLog<{self.action}:{self.resource_type}:{self.resource_id}>"


# ==============================
# Superuser → Consumer clone + Root Consumer auto-setup
# ==============================
def _generate_unique_consumer_username(base: str) -> str:
    """
    Generate a unique username based on base with '-consumer' suffix.
    Falls back to '-consumer-2', '-consumer-3', ...
    """
    from django.utils.text import slugify
    base = (base or "admin").strip()
    base_cons = f"{base}-consumer"
    uname = base_cons
    i = 2
    while CustomUser.objects.filter(username=uname).exists():
        uname = f"{base_cons}-{i}"
        i += 1
    return uname


def _clone_superuser_as_consumer(superuser: CustomUser) -> CustomUser | None:
    """
    Create a non-staff, non-superuser consumer clone of the given superuser.
    Copies hashed password so creds are initially the same. Idempotent by username uniqueness.
    Sets RootConsumerConfig.root_user if not configured yet.
    """
    try:
        # Guard: do not clone if already a consumer clone exists with likely suffix
        base = f"{getattr(superuser, 'username', 'admin')}-consumer"
        exists = CustomUser.objects.filter(username__startswith=base).exists()
        if exists:
            consumer = CustomUser.objects.filter(username__startswith=base).order_by("id").first()
        else:
            uname = _generate_unique_consumer_username(getattr(superuser, "username", "admin"))
            consumer = CustomUser.objects.create(
                username=uname,
                password=superuser.password,  # hashed password copied as-is
                email=getattr(superuser, "email", "") or "",
                full_name=getattr(superuser, "full_name", "") or "",
                phone=getattr(superuser, "phone", "") or "",
                country=getattr(superuser, "country", None),
                state=getattr(superuser, "state", None),
                city=getattr(superuser, "city", None),
                pincode=getattr(superuser, "pincode", "") or "",
                address=getattr(superuser, "address", "") or "",
                role="user",
                category="consumer",
                is_staff=False,
                is_superuser=False,
                account_active=True,
                registered_by=None,
            )
        # Attempt to set as Root Consumer if not set
        try:
            from business.models import RootConsumerConfig
            cfg = RootConsumerConfig.get_solo()
            if not cfg.get_root_user():
                cfg.root_user = consumer
                cfg.save(update_fields=["root_user", "updated_at"])
        except Exception:
            pass
        return consumer
    except Exception:
        return None


@receiver(post_save, sender=CustomUser)
def ensure_consumer_clone_for_new_superuser(sender, instance: CustomUser, created: bool, **kwargs):
    """
    Whenever a new superuser is created, also create a consumer clone for domain usage,
    and set it as Root Consumer if not already configured.
    """
    if not created:
        return
    try:
        if getattr(instance, "is_superuser", False):
            _clone_superuser_as_consumer(instance)
    except Exception:
        # best-effort; never block user creation
        pass


@receiver(pre_save, sender=CustomUser)
def _capture_old_identifiers_on_rename(sender, instance: CustomUser, **kwargs):
    """
    Before saving a user, capture the OLD sponsor identifier variants if username/phone changed.
    These will be used post-commit to relink legacy directs (registered_by is NULL, sponsor_id matches old token).
    """
    # Only for updates
    if not getattr(instance, "pk", None):
        return
    try:
        old = CustomUser.objects.only("id", "username", "phone", "prefixed_id", "unique_id").get(pk=instance.pk)
    except CustomUser.DoesNotExist:
        return
    try:
        old_username = (getattr(old, "username", "") or "").strip()
        old_phone = (getattr(old, "phone", "") or "").strip()
        old_pref = (getattr(old, "prefixed_id", "") or "").strip()
        old_unique = (getattr(old, "unique_id", "") or "").strip()
        new_username = (getattr(instance, "username", "") or "").strip()
        new_phone = (getattr(instance, "phone", "") or "").strip()
        changed = (old_username != new_username) or (old_phone != new_phone)
        if not changed:
            return
        idents = set()
        if old_pref:
            idents.add(old_pref)
            # include dashed/undashed TR variants
            if "-" in old_pref:
                idents.add(old_pref.replace("-", "", 1))
            else:
                if len(old_pref) > 2 and old_pref[:2].isalpha():
                    idents.add(f"{old_pref[:2]}-{old_pref[2:]}")
        if old_username:
            idents.add(old_username)
        if old_unique:
            idents.add(old_unique)
        digs_user = "".join(ch for ch in old_username if ch.isdigit())
        if digs_user:
            idents.add(digs_user)
        digs_phone = "".join(ch for ch in old_phone if ch.isdigit())
        if digs_phone:
            idents.add(digs_phone)
        # Stash on instance for post_save
        instance._old_sponsor_idents = list({v for v in idents if v})
        instance._identifiers_changed = True
    except Exception:
        # Non-blocking
        instance._old_sponsor_idents = []
        instance._identifiers_changed = False


@receiver(post_save, sender=CustomUser)
def _normalize_directs_and_labels_after_rename(sender, instance: CustomUser, created: bool, **kwargs):
    """
    After a username/phone edit, automatically:
      - Link legacy children (registered_by IS NULL) whose sponsor_id matched OLD tokens, to this user via registered_by
      - Normalize those children's sponsor_id to this user's current prefixed_id (fallback: username)
      - Refresh AutoPoolAccount.username_key labels for this user across pools to reflect the new username
    Idempotent and best-effort. Does nothing on create or when no identifiers changed.
    """
    if created:
        return
    try:
        idents = list(getattr(instance, "_old_sponsor_idents", []) or [])
        changed = bool(getattr(instance, "_identifiers_changed", False))
    except Exception:
        idents = []
        changed = False
    if not changed or not idents:
        return

    def _apply():
        # 1) Relink legacy directs (registered_by IS NULL and sponsor_id in old tokens)
        try:
            new_sid = (getattr(instance, "prefixed_id", None) or getattr(instance, "username", "") or "").strip()
            if new_sid:
                (
                    CustomUser.objects
                    .filter(registered_by__isnull=True, sponsor_id__in=idents)
                    .update(registered_by_id=instance.id, sponsor_id=new_sid)
                )
        except Exception:
            # non-blocking
            pass

        # 2) Refresh AutoPoolAccount.username_key labels for display coherence
        try:
            from business.models import AutoPoolAccount  # local import to avoid circulars at import time
            base = (getattr(instance, "username", "") or "").strip()
            if not base:
                return
            for pt in ("FIVE_150", "THREE_150", "THREE_50"):
                try:
                    qs = AutoPoolAccount.objects.filter(owner=instance, pool_type=pt, status="ACTIVE").order_by("id")
                except Exception:
                    qs = []
                idx = 0
                for acc in qs:
                    idx += 1
                    desired = base if idx == 1 else f"{base}-{idx}"
                    try:
                        cur = getattr(acc, "username_key", "") or ""
                    except Exception:
                        cur = ""
                    if cur != desired:
                        acc.username_key = desired
                        try:
                            acc.save(update_fields=["username_key"])
                        except Exception:
                            # skip on save error to avoid blocking the rest
                            continue
        except Exception:
            # best-effort
            pass

    # Execute after outer transaction commits, else run immediately
    try:
        transaction.on_commit(_apply)
    except Exception:
        _apply()
