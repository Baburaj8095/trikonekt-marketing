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

        # Initialize account_active default on creation:
        # - Agencies, Employees, and Business start Active by default
        if getattr(self._state, "adding", False):
            try:
                # Default Active:
                # - All agencies (role=agency or category startswith 'agency')
                # - All business (merchant) accounts
                # Employees and Consumers start Inactive by default
                if (self.role in ("agency",)) or (self.category == "business" or str(self.category).startswith("agency")):
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
from django.db.models.signals import post_save
from django.dispatch import receiver


class Wallet(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='wallet')
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # New dual-balance model
    main_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)         # Gross earnings (e.g., commissions)
    withdrawable_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0) # Net withdrawable after tax withholding
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Wallet<{self.user.username}> ₹{self.balance}"

    @transaction.atomic
    def credit(self, amount: Decimal, tx_type: str, meta: dict | None = None, source_type: str | None = None, source_id: str | None = None):
        """
        Credit logic with dual-wallet support:
        - COMMISSION_CREDIT: withhold cfg.tax_percent to company wallet, add gross to main, net to withdrawable.
        - Other credits: add to main (no withholding), do not change withdrawable unless explicitly done elsewhere.
        """
        # Enforce: No wallet credits for inactive accounts (except admin adjustments)
        try:
            if not bool(getattr(self.user, "account_active", False)) and tx_type not in {"ADJUSTMENT_CREDIT", "ADJUSTMENT_DEBIT"}:
                # Skip creating any credit transactions for inactive users
                return self.balance
        except Exception:
            # best-effort guard; if any error evaluating active flag, continue normal flow
            pass
        from decimal import Decimal as D
        # Lock this wallet row
        w = Wallet.objects.select_for_update().get(pk=self.pk)
        amt = D(amount or 0)

        meta = meta or {}
        COMMISSION_WITHHOLD_TYPES = {
            "COMMISSION_CREDIT",
            "DIRECT_REF_BONUS",
            "LEVEL_BONUS",
            "AUTOPOOL_BONUS_FIVE",
            "AUTOPOOL_BONUS_THREE",
            "FRANCHISE_INCOME",
            "GLOBAL_ROYALTY",
        }
        is_commission = (tx_type in COMMISSION_WITHHOLD_TYPES)
        no_withhold = bool(meta.get("no_withhold"))

        if is_commission and not no_withhold and amt > 0:
            # Resolve tax percent and company recipient
            try:
                from business.models import CommissionConfig
                cfg = CommissionConfig.get_solo()
                tax_percent = D(getattr(cfg, "tax_percent", D("10.00")) or D("10.00"))
                company_user = getattr(cfg, "tax_company_user", None)
            except Exception:
                cfg = None
                tax_percent = D("10.00")
                company_user = None

            if not company_user:
                # Fallback: pick first 'company' category user or any superuser
                try:
                    company_user = CustomUser.objects.filter(category="company").first() or CustomUser.objects.filter(is_superuser=True).first()
                except Exception:
                    company_user = None

            tax = (amt * tax_percent / D("100")).quantize(D("0.01"))
            net = (amt - tax).quantize(D("0.01"))
            if net < 0:
                net = D("0.00")

            # Update own wallet balances
            w.main_balance = (w.main_balance or D("0")) + amt
            w.withdrawable_balance = (w.withdrawable_balance or D("0")) + net
            w.balance = (w.balance or D("0")) + amt
            w.save(update_fields=["balance", "main_balance", "withdrawable_balance", "updated_at"])

            # Record gross commission (main ledger)
            WalletTransaction.objects.create(
                user=self.user,
                amount=amt,
                balance_after=w.balance,
                type=tx_type,
                source_type=source_type or '',
                source_id=str(source_id) if source_id is not None else '',
                meta={**meta, "ledger": "MAIN", "gross": str(amt), "net": str(net), "tax": str(tax), "tax_percent": str(tax_percent)}
            )

            # Record net withdrawable component
            if net > 0:
                WalletTransaction.objects.create(
                    user=self.user,
                    amount=net,
                    balance_after=w.balance,
                    type="WITHDRAWABLE_CREDIT",
                    source_type=source_type or '',
                    source_id=str(source_id) if source_id is not None else '',
                    meta={**meta, "ledger": "WITHDRAWAL", "gross": str(amt), "net": str(net), "tax": str(tax), "tax_percent": str(tax_percent)}
                )

            # Route tax to company wallet (no recursive withholding)
            if company_user and tax > 0:
                try:
                    cw = Wallet.get_or_create_for_user(company_user)
                    # Use a non-commission type to avoid withholding
                    cw.credit(
                        tax,
                        tx_type="TAX_POOL_CREDIT",
                        meta={"from_user": getattr(self.user, "username", None), **meta},
                        source_type=source_type or 'TAX_POOL',
                        source_id=str(source_id) if source_id is not None else '',
                    )
                except Exception:
                    # best-effort
                    pass

            # Auto-apply 1k block rule after commission credits (best-effort)
            try:
                self._apply_auto_block_rule(w)
            except Exception:
                pass
            return w.balance

        # Default: non-commission or withholding disabled
        w.main_balance = (w.main_balance or D("0")) + amt
        w.balance = (w.balance or D("0")) + amt
        w.save(update_fields=['balance', 'main_balance', 'updated_at'])
        WalletTransaction.objects.create(
            user=self.user,
            amount=amt,
            balance_after=w.balance,
            type=tx_type,
            source_type=source_type or '',
            source_id=str(source_id) if source_id is not None else '',
            meta=meta or {}
        )
        # Auto-apply 1k block rule after non-commission credit (best-effort)
        try:
            self._apply_auto_block_rule(w)
        except Exception:
            pass
        return w.balance

    @transaction.atomic
    def debit(self, amount: Decimal, tx_type: str, meta: dict | None = None, source_type: str | None = None, source_id: str | None = None):
        from decimal import Decimal as D
        amt = D(amount or 0)
        if amt <= 0:
            raise ValueError("Debit amount must be positive.")
        # Lock this wallet row
        w = Wallet.objects.select_for_update().get(pk=self.pk)

        if tx_type == "WITHDRAWAL_DEBIT":
            # Debit specifically from withdrawable wallet
            wd = (w.withdrawable_balance or D("0")) - amt
            if wd < 0:
                raise ValueError("Insufficient withdrawable balance.")
            w.withdrawable_balance = wd
            w.balance = (w.balance or D("0")) - amt
            if w.balance < 0:
                # Should not happen if balance tracks sum(main+withdrawable), but guard anyway
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
            meta=meta or {}
        )
        return w.balance

    @classmethod
    def get_or_create_for_user(cls, user: CustomUser) -> "Wallet":
        w, _ = cls.objects.get_or_create(user=user, defaults={'balance': Decimal('0.00')})
        return w

    # Auto rule: for every ₹1000 accumulated in main_balance, apply a fixed deduction pack:
    # - ₹150 auto e‑coupon buy for self (if available; skipped if no stock)
    # - ₹50 fixed TDS routed to company tax wallet
    # - ₹50 direct referral bonus to the direct sponsor (registered_by) if present
    # Debits are recorded against user's withdrawable wallet and total balance.
    # Idempotency is ensured via coupons.AuditTrail action="auto_1k_block_applied" per applied block.
    def _apply_auto_block_rule(self, w: "Wallet"):
        from decimal import Decimal as D
        try:
            from coupons.models import AuditTrail, CouponCode
        except Exception:
            return  # coupons app not available; skip

        # Count already-applied blocks for this user
        try:
            blocks_applied = int(
                AuditTrail.objects.filter(action="auto_1k_block_applied", actor=self.user).count()
            )
        except Exception:
            blocks_applied = 0

        # Compute eligible blocks from main_balance
        try:
            main = D(str(getattr(w, "main_balance", 0) or 0))
        except Exception:
            main = D("0")
        total_blocks = int(main // D("1000"))
        to_apply = max(0, int(total_blocks) - int(blocks_applied))
        if to_apply <= 0:
            return

        sponsor = getattr(self.user, "registered_by", None)

        for i in range(to_apply):
            block_no = int(blocks_applied) + i + 1
            coupon_applied = False
            coupon_code_val = None

            # Try to allocate one ₹150 e‑coupon to this consumer
            try:
                base_qs = CouponCode.objects.filter(
                    issued_channel="e_coupon",
                    value=D("150.00"),
                    status="AVAILABLE",
                    assigned_agency__isnull=True,
                    assigned_employee__isnull=True,
                    assigned_consumer__isnull=True,
                )
                try:
                    locking_qs = base_qs.select_for_update(skip_locked=True)
                except Exception:
                    locking_qs = base_qs
                pick_ids = list(locking_qs.order_by("serial", "id").values_list("id", flat=True)[:1])
                if pick_ids:
                    affected = (
                        CouponCode.objects.filter(id__in=pick_ids)
                        .filter(
                            issued_channel="e_coupon",
                            status="AVAILABLE",
                            assigned_agency__isnull=True,
                            assigned_employee__isnull=True,
                            assigned_consumer__isnull=True,
                        )
                        .update(assigned_consumer_id=self.user_id, status="SOLD")
                    )
                    if affected:
                        coupon_applied = True
                        try:
                            cobj = CouponCode.objects.filter(id=pick_ids[0]).only("code").first()
                            coupon_code_val = getattr(cobj, "code", None)
                        except Exception:
                            coupon_code_val = None
            except Exception:
                coupon_applied = False

            tax_fixed = D("50.00")
            sponsor_bonus = D("50.00") if sponsor else D("0.00")
            coupon_cost = D("150.00") if coupon_applied else D("0.00")
            total = (tax_fixed + sponsor_bonus + coupon_cost).quantize(D("0.01"))

            # Debit from withdrawable + total balance (best-effort, do not go negative)
            w.withdrawable_balance = (w.withdrawable_balance or D("0")) - total
            w.balance = (w.balance or D("0")) - total
            if w.withdrawable_balance < 0:
                w.withdrawable_balance = D("0")
            if w.balance < 0:
                w.balance = D("0")
            w.save(update_fields=["balance", "withdrawable_balance", "updated_at"])

            # Record user-side debits
            if coupon_applied and coupon_cost > 0:
                WalletTransaction.objects.create(
                    user=self.user,
                    amount=D("-150.00"),
                    balance_after=w.balance,
                    type="AUTO_PURCHASE_DEBIT",
                    source_type="AUTO_1K_BLOCK",
                    source_id=str(block_no),
                    meta={"reason": "AUTO_1K_BLOCK", "block_index": block_no, "coupon_code": coupon_code_val},
                )
            # Fixed TDS debit marker
            WalletTransaction.objects.create(
                user=self.user,
                amount=D("-50.00"),
                balance_after=w.balance,
                type="ADJUSTMENT_DEBIT",
                source_type="AUTO_1K_BLOCK",
                source_id=str(block_no),
                meta={"reason": "TDS_FIXED_AUTO", "block_index": block_no},
            )
            # Sponsor bonus debit marker (user-side visibility)
            if sponsor_bonus > 0:
                WalletTransaction.objects.create(
                    user=self.user,
                    amount=D("-50.00"),
                    balance_after=w.balance,
                    type="ADJUSTMENT_DEBIT",
                    source_type="AUTO_1K_BLOCK",
                    source_id=str(block_no),
                    meta={"reason": "DIRECT_REF_BONUS_AUTO", "block_index": block_no, "to_user_id": getattr(sponsor, "id", None)},
                )

            # Credit sponsor (no withholding)
            if sponsor and sponsor_bonus > 0:
                try:
                    sw = Wallet.get_or_create_for_user(sponsor)
                    sw.credit(
                        sponsor_bonus,
                        tx_type="DIRECT_REF_BONUS",
                        meta={"from_user_id": self.user.id, "from_user": getattr(self.user, "username", None), "no_withhold": True, "auto_rule": "AUTO_1K_BLOCK", "block_index": block_no},
                        source_type="AUTO_1K_BLOCK",
                        source_id=str(block_no),
                    )
                except Exception:
                    pass

            # Credit company tax wallet (no withholding)
            try:
                from business.models import CommissionConfig
                cfg = CommissionConfig.get_solo()
                company_user = getattr(cfg, "tax_company_user", None)
            except Exception:
                company_user = None
            if not company_user:
                try:
                    company_user = CustomUser.objects.filter(category="company").first() or CustomUser.objects.filter(is_superuser=True).first()
                except Exception:
                    company_user = None
            if company_user:
                try:
                    cw = Wallet.get_or_create_for_user(company_user)
                    cw.credit(
                        tax_fixed,
                        tx_type="TAX_POOL_CREDIT",
                        meta={"from_user_id": self.user.id, "from_user": getattr(self.user, "username", None), "no_withhold": True, "auto_rule": "AUTO_1K_BLOCK", "block_index": block_no},
                        source_type="AUTO_1K_BLOCK",
                        source_id=str(block_no),
                    )
                except Exception:
                    pass

            # Audit for idempotency
            try:
                AuditTrail.objects.create(
                    action="auto_1k_block_applied",
                    actor=self.user,
                    notes=f"Applied auto block {block_no}",
                    metadata={
                        "block_index": block_no,
                        "coupon_applied": bool(coupon_applied),
                        "coupon_cost": str(coupon_cost),
                        "tds_fixed": "50.00",
                        "sponsor_bonus": str(sponsor_bonus),
                    },
                )
            except Exception:
                pass


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

    # DEFERRED: No referral/matrix payouts on registration.
    # Intentionally not calling referral.on_user_join here. Payouts will be triggered on first activation.

    # DEFERRED: No franchise payouts on registration.
    # Franchise payouts will be triggered on first activation inside ensure_first_purchase_activation.


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
