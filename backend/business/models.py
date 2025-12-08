from django.db import models
from django.conf import settings
from django.utils import timezone

# Optional Cloudinary raw/media storage for business app (ebooks, proofs)
try:
    from cloudinary_storage.storage import RawMediaCloudinaryStorage, MediaCloudinaryStorage
    RAW_STORAGE = RawMediaCloudinaryStorage()
    MEDIA_STORAGE = MediaCloudinaryStorage()
except Exception:
    RAW_STORAGE = None
    MEDIA_STORAGE = None


class BusinessRegistration(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_FORWARDED = 'forwarded'
    STATUS_CLOSED = 'closed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_FORWARDED, 'Forwarded'),
        (STATUS_CLOSED, 'Closed'),
    ]

    # Generated 6-digit id, unique per registration
    unique_id = models.CharField(max_length=6, unique=True, blank=True, null=True, editable=False, db_index=True)

    # Applicant details
    full_name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)

    # Business details
    business_name = models.CharField(max_length=255)
    business_category = models.CharField(max_length=100)
    business_address = models.TextField()

    # Sponsorship and geo
    sponsor_id = models.CharField(max_length=64, blank=True)
    country = models.ForeignKey('locations.Country', null=True, blank=True, on_delete=models.SET_NULL, related_name='business_registrations')
    state = models.ForeignKey('locations.State', null=True, blank=True, on_delete=models.SET_NULL, related_name='business_registrations')
    city = models.ForeignKey('locations.City', null=True, blank=True, on_delete=models.SET_NULL, related_name='business_registrations')
    pincode = models.CharField(max_length=10, blank=True, db_index=True)

    # Workflow
    review_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    forwarded_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='received_business_enquiries')
    forwarded_at = models.DateTimeField(null=True, blank=True)

    # Audit
    registered_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='submitted_business_registrations')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Business Registration'
        verbose_name_plural = 'Business Registrations'

    def __str__(self):
        prefix = 'TRB'
        uid = self.unique_id or '------'
        return f'{prefix}{uid} - {self.business_name}'

    @classmethod
    def generate_unique_id(cls) -> str:
        import random
        while True:
            candidate = f"{random.randint(0, 999999):06d}"
            if not cls.objects.filter(unique_id=candidate).exists():
                return candidate

    def save(self, *args, **kwargs):
        if not self.unique_id:
            self.unique_id = self.generate_unique_id()
        super().save(*args, **kwargs)


# ==========================
# Auto-Pool & Commission CFG
# ==========================
from decimal import Decimal
from django.db import transaction
from django.utils.functional import cached_property


class CommissionConfig(models.Model):
    """
    Singleton-style config used across coupon redemption and product purchases.
    - base_coupon_value: wallet credit on e-coupon redeem and unit entry amount for pool
    - l1..l5: percentages for hierarchical commission distribution on AUTO_POOL
    - enable_pool_distribution: master toggle for auto-pool commission distribution
    - geo layer percents: dynamic geo-role based payouts (toggle via enable_geo_distribution)

    Extended for MLM Packages / Pools:
    - prime_activation_amount (default 150), global_activation_amount (default 50)
    - redeem_credit_amount_150 (default 140)
    - active_direct_bonus_amount (₹2 on Active), active_self_bonus_amount (₹1 to self on 3-matrix Active)
    - five_matrix_levels (default 6), five_matrix_percents_json (list of percents)
    - three_matrix_levels (default 15), three_matrix_percents_json (list of percents)
    - product_opens_prime (default False): whether product approval also opens 150 Active pools
    - rewards_weights_json: weights for reward progress accrual
    - enable_geo_distribution_on_activation: optionally apply geo payouts on Active as well
    """
    base_coupon_value = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("150.00"))
    enable_pool_distribution = models.BooleanField(default=True)

    # Tax withholding for commission credits
    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("10.00"))
    tax_company_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="tax_pool_configs")

    # L1..L5 percentages (sum can be any number; we don't enforce =100 here)
    l1_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("2.00"))
    l2_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("1.00"))
    l3_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("1.00"))
    l4_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.50"))
    l5_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.50"))

    # Geo role distribution
    enable_geo_distribution = models.BooleanField(default=True)
    sub_franchise_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("15.00"))
    pincode_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("4.00"))
    pincode_coord_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("2.00"))
    district_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("1.00"))
    district_coord_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("1.00"))
    state_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("1.00"))
    state_coord_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("1.00"))
    employee_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("2.00"))
    royalty_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("10.00"))

    # ===== Extended fields for MLM feature set =====
    prime_activation_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("150.00"))
    global_activation_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("50.00"))
    redeem_credit_amount_150 = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("140.00"))
    active_direct_bonus_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("2.00"))
    active_self_bonus_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1.00"))
    five_matrix_levels = models.PositiveIntegerField(default=6)
    five_matrix_percents_json = models.JSONField(default=list, help_text="List of percents for 5-matrix levels (length=five_matrix_levels)")
    three_matrix_levels = models.PositiveIntegerField(default=15)
    three_matrix_percents_json = models.JSONField(default=list, help_text="List of percents for 3-matrix levels (length=three_matrix_levels)")
    product_opens_prime = models.BooleanField(default=False)
    rewards_weights_json = models.JSONField(default=dict, help_text='e.g., {"prime":1,"global":1,"coupon_submission":1,"active":1,"redeem":0}')
    reward_points_config_json = models.JSONField(
        default=dict,
        help_text='Admin-configurable reward points schedule: {"tiers":[{"count":1,"points":1000},...], "after":{"base_count":5,"per_coupon":20000}}'
    )
    enable_geo_distribution_on_activation = models.BooleanField(default=False)

    # Trikonekt toggles and fixed-amount configs
    enable_franchise_on_join = models.BooleanField(default=True)
    enable_franchise_on_purchase = models.BooleanField(default=True)
    autopool_trigger_on_direct_referral = models.BooleanField(default=True)

    # Fixed rupee splits (override hardcoded amounts via admin if needed)
    franchise_fixed_json = models.JSONField(
        default=dict,
        help_text='e.g., {"sub_franchise":15,"pincode":4,"pincode_coord":2,"district":1,"district_coord":1,"state":1,"state_coord":1}'
    )
    referral_join_fixed_json = models.JSONField(
        default=dict,
        help_text='e.g., {"direct":5,"l1":2,"l2":1,"l3":1,"l4":0.5,"l5":0.5}'
    )

    # Master Commission configuration JSON (Agency/Employee uplines, Consumer matrices)
    master_commission_json = models.JSONField(
        default=dict,
        help_text='Editable config for agency/employee upline splits and consumer 3/5 matrix. Keys: agency, employee, consumer_matrix_3, consumer_matrix_5, general'
    )

    # Fixed amount overrides for matrix payouts (if non-empty, overrides percent-based distribution)
    three_matrix_amounts_json = models.JSONField(default=list, help_text="Fixed rupees per level for 3-matrix (length 15)")
    five_matrix_amounts_json = models.JSONField(default=list, help_text="Fixed rupees per level for 5-matrix (length 6)")

    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Commission Config"
        verbose_name_plural = "Commission Config"

    def __str__(self):
        return f"CommissionConfig base={self.base_coupon_value}"

    @classmethod
    def get_solo(cls) -> "CommissionConfig":
        obj = cls.objects.first()
        if obj:
            return obj
        return cls.objects.create()


class AutoPoolAccount(models.Model):
    """
    Minimal pool account anchored to consumer.username.
    Created whenever:
      - e-coupon is redeemed/approved
      - a product request is approved (treated as purchase success)
      - new activation actions (Active 150 / 50) per MLM rules
    """
    STATUS_CHOICES = (
        ("ACTIVE", "ACTIVE"),
        ("PENDING", "PENDING"),
        ("CLOSED", "CLOSED"),
    )
    POOL_TYPE_CHOICES = (
        ("FIVE_150", "FIVE_150"),
        ("THREE_150", "THREE_150"),
        ("THREE_50", "THREE_50"),
    )
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pool_accounts")
    username_key = models.CharField(max_length=150, db_index=True)
    entry_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("150.00"))
    pool_type = models.CharField(max_length=16, choices=POOL_TYPE_CHOICES, default="THREE_150", db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="ACTIVE", db_index=True)
    # Sibling position under parent (1-based). Null for root accounts.
    position = models.PositiveSmallIntegerField(null=True, blank=True, db_index=True)
    # Provenance for idempotent creation and reporting (e.g., ECOUPON_ORDER, PROMO_PURCHASE)
    source_type = models.CharField(max_length=32, blank=True, default="", db_index=True)
    source_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    parent_account = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    level = models.PositiveIntegerField(default=1, db_index=True)  # optional metadata for hierarchy traversal
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["username_key", "status"]),
            models.Index(fields=["pool_type", "status"]),
            models.Index(fields=["parent_account", "pool_type", "position"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["parent_account", "pool_type", "position"],
                name="uniq_autopool_sibling_position",
                condition=models.Q(parent_account__isnull=False),
            )
        ]

    def __str__(self):
        return f"Pool<{self.username_key}> ₹{self.entry_amount} [{self.status}] ({self.pool_type})"

    @classmethod
    def create_for_user(cls, user, amount: Decimal):
        """
        Simple creation without complex placement logic.
        Anchors to the consumer's username; parent/level can be extended later.
        """
        return cls.objects.create(
            owner=user,
            username_key=getattr(user, "username", "") or "",
            entry_amount=Decimal(amount or 0) or Decimal("0.00"),
            pool_type="THREE_150",
            status="ACTIVE",
            parent_account=None,
            level=1,
        )

    @classmethod
    def create_five_150_for_user(cls, user, amount: Decimal | None = None, source_type: str = "", source_id: str = ""):
        from decimal import Decimal as D
        amt = D(amount) if amount is not None else D("150.00")
        return cls.place_in_five_pool(user, "FIVE_150", amt, source_type=source_type, source_id=source_id)

    @classmethod
    def create_three_150_for_user(cls, user, amount: Decimal | None = None):
        from decimal import Decimal as D
        amt = D(amount) if amount is not None else D("150.00")
        return cls.place_in_three_pool(user, "THREE_150", amt)

    @classmethod
    def create_three_50_for_user(cls, user, amount: Decimal | None = None):
        from decimal import Decimal as D
        amt = D(amount) if amount is not None else D("50.00")
        return cls.place_in_three_pool(user, "THREE_50", amt)

    # ---------- 3-Matrix placement helpers ----------
    @classmethod
    def _first_upline_account(cls, user, pool_type: str):
        """
        Return the first ACTIVE AutoPoolAccount in the registered_by upline for the given pool_type.
        """
        cur = user
        seen = set()
        while cur and getattr(cur, "id", None) and cur.id not in seen:
            seen.add(cur.id)
            acc = cls.objects.filter(owner=cur, pool_type=pool_type, status="ACTIVE").order_by("id").first()
            if acc:
                return acc
            cur = getattr(cur, "registered_by", None)
        return None

    @classmethod
    def _base_self_account(cls, user, pool_type: str):
        """
        Oldest ACTIVE self account for this owner in the given pool (acts as the main/root for clustering).
        """
        try:
            return cls.objects.filter(owner=user, pool_type=pool_type, status="ACTIVE").order_by("id").first()
        except Exception:
            return None

    @classmethod
    def _next_username_key(cls, user, pool_type: str, sep: str = "-") -> str:
        """
        Deterministic display label:
          - First self account per (user, pool_type): base username (no suffix)
          - Subsequent accounts: base-2, base-3, ...
        """
        base = (getattr(user, "username", "") or "")
        try:
            count = cls.objects.filter(owner=user, pool_type=pool_type, status="ACTIVE").count()
        except Exception:
            count = 0
        idx = int(count) + 1
        return base if idx == 1 else f"{base}{sep}{idx}"

    @classmethod
    def place_in_three_pool(cls, user, pool_type: str, amount: Decimal, source_type: str = "", source_id: str = ""):
        """
        Preferred behavior:
          - If user already has a base self account in this pool, place new self-accounts under that subtree (3-wide BFS).
          - Else, fall back to upline BFS placement (legacy), which becomes the base.
        """
        from collections import deque
        from decimal import Decimal as D
        from django.db import transaction as _tx
        amt = D(amount or 0)

        with _tx.atomic():
            base_self = cls._base_self_account(user, pool_type)
            uname = cls._next_username_key(user, pool_type)

            # If base exists, BFS within the user's own subtree (cluster under main)
            if base_self:
                q = deque([base_self])
                while q:
                    node = q.popleft()
                    child_qs = cls.objects.filter(parent_account=node, pool_type=pool_type, status="ACTIVE").order_by("id")
                    cnt = child_qs.count()
                    if cnt < 3:
                        return cls.objects.create(
                            owner=user,
                            username_key=uname,
                            entry_amount=amt,
                            pool_type=pool_type,
                            status="ACTIVE",
                            parent_account=node,
                            level=(getattr(node, "level", 0) or 0) + 1,
                            position=(cnt + 1),
                            source_type=source_type or "",
                            source_id=source_id or "",
                        )
                    for ch in child_qs:
                        q.append(ch)

                # Fallback: attach directly under base_self if traversal exhausted
                child_qs2 = cls.objects.filter(parent_account=base_self, pool_type=pool_type, status="ACTIVE").order_by("id")
                pos = child_qs2.count() + 1
                return cls.objects.create(
                    owner=user,
                    username_key=uname,
                    entry_amount=amt,
                    pool_type=pool_type,
                    status="ACTIVE",
                    parent_account=base_self,
                    level=(getattr(base_self, "level", 0) or 0) + 1,
                    position=pos,
                    source_type=source_type or "",
                    source_id=source_id or "",
                )

            # No base exists yet: legacy placement under first upline account with capacity
            root_acc = cls._first_upline_account(user, pool_type)

            # If no upline account exists, create a root account (this becomes the base)
            if not root_acc:
                return cls.objects.create(
                    owner=user,
                    username_key=uname,
                    entry_amount=amt,
                    pool_type=pool_type,
                    status="ACTIVE",
                    parent_account=None,
                    level=1,
                    position=None,
                    source_type=source_type or "",
                    source_id=source_id or "",
                )

            # BFS to find first account with <3 children in same pool
            q = deque([root_acc])
            while q:
                node = q.popleft()
                child_qs = cls.objects.filter(parent_account=node, pool_type=pool_type, status="ACTIVE").order_by("id")
                cnt = child_qs.count()
                if cnt < 3:
                    return cls.objects.create(
                        owner=user,
                        username_key=uname,
                        entry_amount=amt,
                        pool_type=pool_type,
                        status="ACTIVE",
                        parent_account=node,
                        level=(getattr(node, "level", 0) or 0) + 1,
                        position=(cnt + 1),
                        source_type=source_type or "",
                        source_id=source_id or "",
                    )
                for ch in child_qs:
                    q.append(ch)

            # Fallback: attach under root_acc
            child_qs2 = cls.objects.filter(parent_account=root_acc, pool_type=pool_type, status="ACTIVE").order_by("id")
            pos = child_qs2.count() + 1
            return cls.objects.create(
                owner=user,
                username_key=uname,
                entry_amount=amt,
                pool_type=pool_type,
                status="ACTIVE",
                parent_account=root_acc,
                level=(getattr(root_acc, "level", 0) or 0) + 1,
                position=pos,
                source_type=source_type or "",
                source_id=source_id or "",
            )

    @classmethod
    def place_in_five_pool(cls, user, pool_type: str, amount: Decimal, source_type: str = "", source_id: str = ""):
        """
        Preferred behavior:
          - If user already has a base self account in this pool, place new self-accounts under that subtree (5-wide BFS).
          - Else, fall back to upline BFS placement (legacy), which becomes the base.
        """
        from collections import deque
        from decimal import Decimal as D
        from django.db import transaction as _tx
        amt = D(amount or 0)

        with _tx.atomic():
            base_self = cls._base_self_account(user, pool_type)
            uname = cls._next_username_key(user, pool_type)

            # If base exists, BFS within the user's own subtree (cluster under main)
            if base_self:
                q = deque([base_self])
                while q:
                    node = q.popleft()
                    child_qs = cls.objects.filter(parent_account=node, pool_type=pool_type, status="ACTIVE").order_by("id")
                    cnt = child_qs.count()
                    if cnt < 5:
                        return cls.objects.create(
                            owner=user,
                            username_key=uname,
                            entry_amount=amt,
                            pool_type=pool_type,
                            status="ACTIVE",
                            parent_account=node,
                            level=(getattr(node, "level", 0) or 0) + 1,
                            position=(cnt + 1),
                            source_type=source_type or "",
                            source_id=source_id or "",
                        )
                    for ch in child_qs:
                        q.append(ch)

                # Fallback: attach directly under base_self if traversal exhausted
                child_qs2 = cls.objects.filter(parent_account=base_self, pool_type=pool_type, status="ACTIVE").order_by("id")
                pos = child_qs2.count() + 1
                return cls.objects.create(
                    owner=user,
                    username_key=uname,
                    entry_amount=amt,
                    pool_type=pool_type,
                    status="ACTIVE",
                    parent_account=base_self,
                    level=(getattr(base_self, "level", 0) or 0) + 1,
                    position=pos,
                    source_type=source_type or "",
                    source_id=source_id or "",
                )

            # No base exists yet: legacy placement under first upline account with capacity
            root_acc = cls._first_upline_account(user, pool_type)

            # Root-level when no upline account exists
            if not root_acc:
                return cls.objects.create(
                    owner=user,
                    username_key=uname,
                    entry_amount=amt,
                    pool_type=pool_type,
                    status="ACTIVE",
                    parent_account=None,
                    level=1,
                    position=None,
                    source_type=source_type or "",
                    source_id=source_id or "",
                )

            q = deque([root_acc])
            while q:
                node = q.popleft()
                child_qs = cls.objects.filter(parent_account=node, pool_type=pool_type, status="ACTIVE").order_by("id")
                cnt = child_qs.count()
                if cnt < 5:
                    return cls.objects.create(
                        owner=user,
                        username_key=uname,
                        entry_amount=amt,
                        pool_type=pool_type,
                        status="ACTIVE",
                        parent_account=node,
                        level=(getattr(node, "level", 0) or 0) + 1,
                        position=(cnt + 1),
                        source_type=source_type or "",
                        source_id=source_id or "",
                    )
                for ch in child_qs:
                    q.append(ch)

            # Fallback under root (shouldn't happen with BFS)
            child_qs2 = cls.objects.filter(parent_account=root_acc, pool_type=pool_type, status="ACTIVE").order_by("id")
            pos = child_qs2.count() + 1
            return cls.objects.create(
                owner=user,
                username_key=uname,
                entry_amount=amt,
                pool_type=pool_type,
                status="ACTIVE",
                parent_account=root_acc,
                level=(getattr(root_acc, "level", 0) or 0) + 1,
                position=pos,
                source_type=source_type or "",
                source_id=source_id or "",
            )

    @classmethod
    def place_three_150_for_user(cls, user, amount: Decimal | None = None):
        from decimal import Decimal as D
        amt = D(amount) if amount is not None else D("150.00")
        return cls.place_in_three_pool(user, "THREE_150", amt)

    @classmethod
    def place_three_50_for_user(cls, user, amount: Decimal | None = None):
        from decimal import Decimal as D
        amt = D(amount) if amount is not None else D("50.00")
        return cls.place_in_three_pool(user, "THREE_50", amt)


class SubscriptionActivation(models.Model):
    """
    Idempotent record of package activations/redemptions to prevent duplicates per source.
    """
    PACKAGE_CHOICES = (
        ("PRIME_150_ACTIVE", "PRIME_150_ACTIVE"),
        ("PRIME_150_REDEEM", "PRIME_150_REDEEM"),
        ("GLOBAL_50", "GLOBAL_50"),
        ("SELF_50", "SELF_50"),
        ("PRODUCT_PRIME", "PRODUCT_PRIME"),
        ("PRODUCT_GLOBAL_50", "PRODUCT_GLOBAL_50"),
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscription_activations", db_index=True)
    package = models.CharField(max_length=32, choices=PACKAGE_CHOICES, db_index=True)
    source_type = models.CharField(max_length=32, blank=True, default="", db_index=True)
    source_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    metadata = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "package"]),
            models.Index(fields=["source_type", "source_id"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "package", "source_type", "source_id"],
                name="uniq_activation_user_pkg_source",
            )
        ]

    def __str__(self):
        return f"{self.user_id} {self.package} {self.source_type}:{self.source_id}"


class UserMatrixProgress(models.Model):
    """
    Rollup progress/earnings for autopool per user and pool type.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="matrix_progress")
    pool_type = models.CharField(max_length=16, choices=AutoPoolAccount.POOL_TYPE_CHOICES, db_index=True)
    total_earned = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    level_reached = models.PositiveIntegerField(default=0)
    per_level_counts = models.JSONField(default=dict, blank=True)   # {"1": count, "2": count, ...}
    per_level_earned = models.JSONField(default=dict, blank=True)   # {"1": "amount", "2": "amount", ...}
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("user", "pool_type"),)
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["user", "pool_type"]),
        ]

    def __str__(self):
        return f"MatrixProgress<{getattr(self.user, 'username', 'user')}:{self.pool_type}>"


class ReferralJoinPayout(models.Model):
    """
    Idempotency marker for referral join payouts.
    Unique per new user.
    """
    user_new = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="referral_join_payout")
    source_type = models.CharField(max_length=32, blank=True, default="")
    source_id = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"ReferralJoinPayout<{self.user_new_id}>"


class FranchisePayout(models.Model):
    """
    Idempotency marker for franchise benefit distribution.
    Unique per (user_new, trigger, source_type, source_id).
    """
    TRIGGER_CHOICES = (("registration", "registration"), ("purchase", "purchase"))
    user_new = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="franchise_payouts")
    trigger = models.CharField(max_length=16, choices=TRIGGER_CHOICES, db_index=True)
    source_type = models.CharField(max_length=32, blank=True, default="", db_index=True)
    source_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user_new", "trigger", "source_type", "source_id"], name="uniq_franchise_payout_marker")
        ]
        indexes = [
            models.Index(fields=["trigger", "created_at"]),
        ]

    def __str__(self):
        return f"FranchisePayout<{self.user_new_id}:{self.trigger}:{self.source_type}:{self.source_id}>"


# ---------------
# Helper services
# ---------------
def _resolve_upline(user, depth: int = 5):
    """
    Traverse registered_by chain up to `depth` levels (L1..L5).
    """
    chain = []
    cur = user
    visited = set()
    for _ in range(depth):
        parent = getattr(cur, "registered_by", None)
        if not parent or parent.id in visited:
            break
        chain.append(parent)
        visited.add(parent.id)
        cur = parent
    return chain


def distribute_auto_pool_commissions(payer_user, base_amount: Decimal):
    """
    Distribute commissions to L1..L5 and geo roles based on CommissionConfig.
    Credits wallets directly and records WalletTransaction entries.
    """
    from accounts.models import Wallet, CustomUser, AgencyRegionAssignment  # local import to avoid circulars
    cfg = CommissionConfig.get_solo()
    if not cfg.enable_pool_distribution:
        return

    # Percentages mapping (L1..L5)
    percents = [
        ("L1", Decimal(cfg.l1_percent or 0)),
        ("L2", Decimal(cfg.l2_percent or 0)),
        ("L3", Decimal(cfg.l3_percent or 0)),
        ("L4", Decimal(cfg.l4_percent or 0)),
        ("L5", Decimal(cfg.l5_percent or 0)),
    ]
    upline = _resolve_upline(payer_user, depth=5)

    with transaction.atomic():
        # Hierarchical L1..L5
        for idx, (label, pct) in enumerate(percents):
            if idx >= len(upline):
                break
            recipient = upline[idx]
            amt = (Decimal(base_amount) * pct / Decimal("100")).quantize(Decimal("0.01"))
            if amt <= 0:
                continue
            try:
                w = Wallet.get_or_create_for_user(recipient)
                w.credit(
                    amt,
                    tx_type="COMMISSION_CREDIT",
                    meta={"level": label, "source": "AUTO_POOL", "payer": getattr(payer_user, "username", None)},
                    source_type="AUTO_POOL",
                    source_id=str(getattr(payer_user, "id", "")),
                )
            except Exception:
                # best-effort: don't block the main flow on one payout
                continue

        # Geo role distribution (best-effort; optional)
        try:
            if not cfg.enable_geo_distribution:
                return

            pin = (getattr(payer_user, "pincode", "") or "").strip()
            state = getattr(payer_user, "state", None)

            def first_qs(qs):
                try:
                    return qs.first()
                except Exception:
                    return None

            recipients = {}

            # Sub Franchise at pincode
            if pin:
                sf_qs = CustomUser.objects.filter(category="agency_sub_franchise", region_assignments__level="pincode", region_assignments__pincode=pin).distinct()
                recipients["Sub Franchise"] = first_qs(sf_qs)

            # Pincode
            if pin:
                ap_qs = CustomUser.objects.filter(category="agency_pincode", region_assignments__level="pincode", region_assignments__pincode=pin).distinct()
                recipients["Pincode"] = first_qs(ap_qs)

                apc_qs = CustomUser.objects.filter(category="agency_pincode_coordinator", region_assignments__level="pincode", region_assignments__pincode=pin).distinct()
                recipients["Pincode Coord"] = first_qs(apc_qs)

            # District (best-effort: if district not known, target any district user in same state)
            if state:
                ad_qs = CustomUser.objects.filter(category="agency_district", region_assignments__level="district", region_assignments__state=state).distinct()
                recipients["District"] = first_qs(ad_qs)

                adc_qs = CustomUser.objects.filter(category="agency_district_coordinator", region_assignments__level="district", region_assignments__state=state).distinct()
                recipients["District Coord"] = first_qs(adc_qs)

                # State
                as_qs = CustomUser.objects.filter(category="agency_state", region_assignments__level="state", region_assignments__state=state).distinct()
                recipients["State"] = first_qs(as_qs)

                asc_qs = CustomUser.objects.filter(category="agency_state_coordinator", region_assignments__level="state", region_assignments__state=state).distinct()
                recipients["State Coord"] = first_qs(asc_qs)

            # Employee: prefer immediate registered_by if employee, else first employee in upline
            emp = None
            parent = getattr(payer_user, "registered_by", None)
            if parent and (getattr(parent, "category", None) == "employee" or getattr(parent, "role", None) == "employee"):
                emp = parent
            else:
                for u in upline:
                    if getattr(u, "category", None) == "employee" or getattr(u, "role", None) == "employee":
                        emp = u
                        break
            recipients["Employee"] = emp

            # Royalty: pick first superuser (fallback to any staff)
            royalty = CustomUser.objects.filter(is_superuser=True).first() or CustomUser.objects.filter(is_staff=True).first()
            recipients["Royalty"] = royalty

            geo_map = [
                ("Sub Franchise", Decimal(cfg.sub_franchise_percent or 0)),
                ("Pincode", Decimal(cfg.pincode_percent or 0)),
                ("Pincode Coord", Decimal(cfg.pincode_coord_percent or 0)),
                ("District", Decimal(cfg.district_percent or 0)),
                ("District Coord", Decimal(cfg.district_coord_percent or 0)),
                ("State", Decimal(cfg.state_percent or 0)),
                ("State Coord", Decimal(cfg.state_coord_percent or 0)),
                ("Employee", Decimal(cfg.employee_percent or 0)),
                ("Royalty", Decimal(cfg.royalty_percent or 0)),
            ]

            for label, pct in geo_map:
                user_obj = recipients.get(label)
                if not user_obj:
                    continue
                amt = (Decimal(base_amount) * pct / Decimal("100")).quantize(Decimal("0.01"))
                if amt <= 0:
                    continue
                try:
                    w = Wallet.get_or_create_for_user(user_obj)
                    w.credit(
                        amt,
                        tx_type="COMMISSION_CREDIT",
                        meta={"layer": label, "source": "AUTO_POOL_GEO", "payer": getattr(payer_user, "username", None)},
                        source_type="AUTO_POOL_GEO",
                        source_id=str(getattr(payer_user, "id", "")),
                    )
                except Exception:
                    continue
        except Exception:
            # Do not break the main flow due to geo failure
            pass


class ReportMetric(models.Model):
    """
    Manual daily metrics (Admin-editable) with Today and Total values.
    System metrics are computed via reporting endpoints and are not stored here.
    """
    KEY_CHOICES = (
        ("TR_ID", "TR_ID"),
        ("WG_ID", "WG_ID"),
        ("ASIA_PAY_ID", "ASIA_PAY_ID"),
        ("DM_ACCOUNT", "DM_ACCOUNT"),
    )
    date = models.DateField(db_index=True)
    key = models.CharField(max_length=32, choices=KEY_CHOICES, db_index=True)
    today_value = models.IntegerField(default=0)
    total_value = models.IntegerField(default=0)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="updated_report_metrics")
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["date", "key"], name="uniq_reportmetric_date_key")
        ]

    def __str__(self):
        return f"{self.date} {self.key}: {self.today_value}/{self.total_value}"


# ==================
# Daily Reports (Employee/Sub-Franchise)
# ==================
class DailyReport(models.Model):
    ROLE_CHOICES = (
        ("EMPLOYEE", "Employee"),
        ("SUBFRANCHISE", "Sub-Franchise"),
    )
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="daily_reports", db_index=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, db_index=True)
    date = models.DateField(auto_now_add=True, db_index=True)

    tr_registered = models.IntegerField(default=0)
    wg_registered = models.IntegerField(default=0)
    asia_pay_registered = models.IntegerField(default=0)
    dm_account_registered = models.IntegerField(default=0)
    e_coupon_issued = models.IntegerField(default=0)
    physical_coupon_issued = models.IntegerField(default=0)
    product_sold = models.IntegerField(default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ["-date", "-id"]
        indexes = [
            models.Index(fields=["reporter", "date"]),
            models.Index(fields=["role", "date"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["reporter", "date"], name="uniq_daily_report_per_user_per_date"),
        ]

    def __str__(self):
        return f"DailyReport<{getattr(self.reporter, 'username', 'user')} {self.role} {self.date}>"

# ==================
# Rewards Management
# ==================
class RewardProgress(models.Model):
    """
    Tracks coupon-based incentive progress for each user.
    Incremented when a coupon submission is agency-approved.
    """
    REWARD_KEYS = (
        ("resort_trip", "Resort Trip"),     # 600 coupons
        ("mobile_fund", "Mobile Fund"),     # 600 coupons
        ("bike_fund", "Bike Fund"),         # 1500 coupons
        ("thailand_trip", "Thailand Trip"), # 2800 coupons
    )
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reward_progress")
    coupon_count = models.PositiveIntegerField(default=0, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Rewards<{getattr(self.user, 'username', 'user')}> coupons={self.coupon_count}"


class RewardRedemption(models.Model):
    STATUS_CHOICES = (
        ("requested", "Requested"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reward_redemptions")
    reward_key = models.CharField(max_length=32, db_index=True)  # one of RewardProgress.REWARD_KEYS keys
    coupons_spent = models.PositiveIntegerField(default=0)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="requested", db_index=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="reward_decisions")

    class Meta:
        ordering = ["-requested_at"]
        indexes = [
            models.Index(fields=["user", "reward_key"]),
            models.Index(fields=["status", "requested_at"]),
        ]

    def __str__(self):
        return f"Reward<{self.user_id}:{self.reward_key}> {self.status}"

class WithholdingReserve(models.Model):
    """
    Holds withheld amounts (e.g., 10% from legacy split) to distribute later.
    """
    STATUS_CHOICES = (
        ("reserved", "reserved"),
        ("partial", "partial"),
        ("distributed", "distributed"),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="withholding_reserves", db_index=True)
    source_type = models.CharField(max_length=32, blank=True, default="LEGACY_SPLIT", db_index=True)
    source_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("10.00"))
    gross_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    withheld_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="reserved", db_index=True)
    breakdown = models.JSONField(null=True, blank=True)  # later distribution details
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["source_type", "source_id"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "source_type", "source_id"],
                name="uniq_withholding_reserve_user_source",
            )
        ]

    def __str__(self):
        return f"Reserve<{self.user_id}:{self.source_type}:{self.source_id}> {self.withheld_amount}"


class CompanyCommissionPayout(models.Model):
    """
    Payout rows generated from the 10% tax (company pool) distribution.
    Linked to the TAX_POOL_CREDIT WalletTransaction created during withholding.
    """
    tax_tx = models.ForeignKey('accounts.WalletTransaction', on_delete=models.CASCADE, related_name='company_tax_payouts', db_index=True)
    source_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='company_tax_sources')
    beneficiary = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='company_tax_benefits')
    pool_key = models.CharField(max_length=32, db_index=True)
    role_key = models.CharField(max_length=32, db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    metadata = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["tax_tx"]),
            models.Index(fields=["beneficiary"]),
            models.Index(fields=["pool_key", "role_key"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tax_tx", "beneficiary", "pool_key", "role_key"],
                name="uniq_company_tax_payout_row",
            )
        ]

    def __str__(self):
        return f"Payout<{self.pool_key}:{self.role_key}> ₹{self.amount}"

# ==============================
# Packages for Agency Dashboard
# ==============================
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError


class Package(models.Model):
    code = models.CharField(max_length=16, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False, help_text="If true, auto-assign to every agency by default")
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} — {self.name} (₹{self.amount})"


class AgencyPackageAssignment(models.Model):
    """
    Assign a Package to an Agency (CustomUser with role/category agency_*).
    One (agency, package) pair is unique to prevent duplicates.
    """
    agency = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="package_assignments", db_index=True)
    package = models.ForeignKey(Package, on_delete=models.CASCADE, related_name="assignments")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "agency_id"]
        unique_together = (("agency", "package"),)
        indexes = [
            models.Index(fields=["agency", "package"]),
        ]

    def __str__(self):
        return f"{getattr(self.agency, 'username', self.agency_id)} → {self.package.code}"

    def _ensure_agency_user(self):
        u = getattr(self, "agency", None)
        role = str(getattr(u, "role", "") or "").lower()
        cat = str(getattr(u, "category", "") or "").lower()
        if not (role == "agency" or cat.startswith("agency")):
            raise ValidationError({"agency": "Packages can only be assigned to agency users."})

    def save(self, *args, **kwargs):
        # Enforce agency-only assignments on all creation/update paths
        self._ensure_agency_user()
        return super().save(*args, **kwargs)


class AgencyPackagePayment(models.Model):
    """
    Payment recorded by Admin against an AgencyPackageAssignment.
    """
    assignment = models.ForeignKey(AgencyPackageAssignment, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    paid_at = models.DateTimeField(auto_now_add=True, db_index=True)
    reference = models.CharField(max_length=100, blank=True, default="")
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-paid_at", "-id"]
        indexes = [
            models.Index(fields=["assignment", "paid_at"]),
        ]

    def __str__(self):
        return f"Pay<{self.assignment_id}> ₹{self.amount} @ {self.paid_at:%Y-%m-%d}"


# ==============================
# Consumer Promo Packages (Prime/Monthly)
# ==============================
class PromoPackage(models.Model):
    TYPE_CHOICES = (
        ("PRIME", "PRIME"),
        ("MONTHLY", "MONTHLY"),
    )
    code = models.CharField(max_length=32, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=16, choices=TYPE_CHOICES, default="PRIME", db_index=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0.01)])
    is_active = models.BooleanField(default=True)

    # Admin-seeded payment details (optional)
    payment_qr = models.ImageField(upload_to="uploads/promo_qr/", null=True, blank=True)
    upi_id = models.CharField(max_length=100, blank=True)

    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} — {self.name} (₹{self.price}) [{self.type}]"


class PromoProduct(models.Model):
    """
    Dedicated Promo Product decoupled from Market products.
    Admin can upload/manage these separately for promo packages.
    """
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0.01)])
    image = models.ImageField(upload_to="uploads/promo_products/", null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.name


class PromoPackageProduct(models.Model):
    """
    Mapping of PromoPackage (specifically PRIME750) to Market Products.
    Admin can seed any number of products under the 750₹ promo.
    """
    package = models.ForeignKey(PromoPackage, on_delete=models.CASCADE, related_name="promo_products")
    product = models.ForeignKey("PromoProduct", on_delete=models.CASCADE, related_name="promo_packages")
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["display_order", "id"]
        unique_together = (("package", "product"),)
        indexes = [
            models.Index(fields=["package", "is_active", "display_order"]),
        ]

    def __str__(self):
        return f"{getattr(self.package, 'code', 'PKG')} -> {getattr(self.product, 'name', 'Product')}"

class PromoMonthlyPackage(models.Model):
    """
    Admin-seeded Monthly package numbers (1..N) for a given PromoPackage of type MONTHLY.
    total_boxes defaults to 12 as per requirement "1 year = 12 boxes".
    """
    package = models.ForeignKey(PromoPackage, on_delete=models.CASCADE, related_name="monthly_packages")
    number = models.PositiveIntegerField(db_index=True)
    is_active = models.BooleanField(default=True)
    total_boxes = models.PositiveIntegerField(default=12)

    class Meta:
        ordering = ["package_id", "number"]
        unique_together = (("package", "number"),)
        indexes = [
            models.Index(fields=["package", "number", "is_active"]),
        ]

    def __str__(self):
        return f"{getattr(self.package, 'code', 'PKG')} #{self.number}"


class PromoMonthlyBox(models.Model):
    """
    Records paid boxes per user for a MONTHLY PromoPackage.
    Boxes are permanently paid per (user, package, package_number).
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="promo_monthly_boxes", db_index=True)
    package = models.ForeignKey(PromoPackage, on_delete=models.CASCADE, related_name="promo_monthly_boxes")
    package_number = models.PositiveIntegerField(db_index=True)
    box_number = models.PositiveIntegerField(db_index=True)
    purchase = models.ForeignKey("PromoPurchase", null=True, blank=True, on_delete=models.SET_NULL, related_name="monthly_boxes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["user", "package", "package_number", "box_number"], name="uniq_monthly_box_user_pkg_num_box"),
        ]
        indexes = [
            models.Index(fields=["user", "package", "package_number"]),
            models.Index(fields=["package", "package_number", "box_number"]),
        ]

    def __str__(self):
        return f"{self.user_id}:{getattr(self.package, 'code', 'PKG')} #{self.package_number} [{self.box_number}]"


class PromoEBook(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to="uploads/ebooks/", storage=RAW_STORAGE)
    cover = models.ImageField(upload_to="uploads/ebooks/covers/", null=True, blank=True, storage=MEDIA_STORAGE)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class PromoPackageEBook(models.Model):
    """
    Map PromoPackage (e.g., PRIME 150) to one or more E‑Books that the buyer should receive when choosing EBOOK.
    """
    package = models.ForeignKey(PromoPackage, on_delete=models.CASCADE, related_name="ebooks")
    ebook = models.ForeignKey(PromoEBook, on_delete=models.CASCADE, related_name="packages")
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = (("package", "ebook"),)
        ordering = ["package_id", "display_order", "id"]

    def __str__(self):
        return f"{getattr(self.package, 'code', 'PKG')} → {getattr(self.ebook, 'title', 'E‑Book')}"


class EBookAccess(models.Model):
    """
    Grants a user access to an E‑Book. Created on approval when prime150_choice == 'EBOOK'.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ebook_accesses", db_index=True)
    ebook = models.ForeignKey(PromoEBook, on_delete=models.CASCADE, related_name="accesses")
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("user", "ebook"),)
        ordering = ["-granted_at", "-id"]

    def __str__(self):
        return f"{self.user_id} → {getattr(self.ebook, 'title', 'E‑Book')}"


class PromoPurchase(models.Model):
    STATUS_CHOICES = (
        ("PENDING", "PENDING"),
        ("APPROVED", "APPROVED"),
        ("REJECTED", "REJECTED"),
        ("CANCELLED", "CANCELLED"),
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="promo_purchases", db_index=True)
    package = models.ForeignKey(PromoPackage, on_delete=models.PROTECT, related_name="purchases")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="PENDING", db_index=True)

    # Quantity requested by user for this promo purchase (used to allocate e‑coupons on approval)
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    # For PRIME 150 purchases, capture user's choice: EBOOK or REDEEM (blank for other packages)
    prime150_choice = models.CharField(max_length=16, blank=True, default="", db_index=True, help_text="For PRIME 150: EBOOK or REDEEM")
    # For PRIME 750 purchases, capture user's choice: PRODUCT or REDEEM or COUPON
    prime750_choice = models.CharField(max_length=16, blank=True, default="", db_index=True, help_text="For PRIME 750: PRODUCT or REDEEM or COUPON")

    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0.00)], default=0)
    payment_proof = models.FileField(upload_to="uploads/promo_proofs/", null=True, blank=True, storage=RAW_STORAGE)

    # PRIME750 specific: selected product and shipping/delivery metadata
    # Deprecated: selected_product kept for backward compatibility (was market.Product)
    selected_product = models.ForeignKey("market.Product", null=True, blank=True, on_delete=models.SET_NULL, related_name="selected_in_promo_purchases")
    selected_promo_product = models.ForeignKey("PromoProduct", null=True, blank=True, on_delete=models.SET_NULL, related_name="selected_in_promo_purchases")
    shipping_address = models.TextField(blank=True)
    delivery_by = models.DateField(null=True, blank=True)

    # MONTHLY boxes flow (price per box)
    package_number = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    boxes_json = models.JSONField(default=list, blank=True, help_text="Selected box numbers for MONTHLY (1..12)")

    remarks = models.TextField(blank=True)
    requested_at = models.DateTimeField(auto_now_add=True, db_index=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="approved_promo_purchases")

    # Monthly-specific fields (required when package.type == MONTHLY)
    year = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    month = models.PositiveIntegerField(null=True, blank=True, db_index=True)

    # Active period
    active_from = models.DateField(null=True, blank=True)
    active_to = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["-requested_at", "-id"]
        unique_together = (("user", "package", "year", "month"),)
        indexes = [
            models.Index(fields=["user", "status", "requested_at"]),
            models.Index(fields=["user", "package"]),
            models.Index(fields=["user", "package", "year", "month"]),
        ]

    def __str__(self):
        pkg = getattr(self.package, "code", "pkg")
        return f"PromoPurchase<{self.user_id}:{pkg}:{self.status}>"

    def clean(self):
        """
        Business validations:
        - MONTHLY: either (package_number + boxes_json) OR legacy (year + month) accepted.
        - If boxes_json flow used, require package_number and 1..total_boxes integers; year/month not allowed.
        - Boxes are priced per box; quantity may be inferred from len(boxes_json) at serializer layer.
        """
        from django.core.exceptions import ValidationError
        today = timezone.localdate()

        if self.package and self.package.type == "MONTHLY":
            boxes = list(self.boxes_json or [])
            number = self.package_number
            if boxes and number:
                # Validate boxes range and uniqueness; do not enforce "current package" at model layer
                try:
                    boxes_int = [int(x) for x in boxes]
                except Exception:
                    raise ValidationError({"boxes_json": "Boxes must be integers."})
                if not boxes_int:
                    raise ValidationError({"boxes_json": "Select at least one box."})
                # Determine total boxes from seed (if present) else default 12
                total = 12
                try:
                    seed = None
                    # local import to avoid circulars during migration
                    from .models import PromoMonthlyPackage  # type: ignore
                    seed = PromoMonthlyPackage.objects.filter(package=self.package, number=number, is_active=True).first()
                    if seed and int(getattr(seed, "total_boxes", 12) or 12) > 0:
                        total = int(getattr(seed, "total_boxes", 12))
                except Exception:
                    total = 12
                bad = [b for b in boxes_int if b < 1 or b > total]
                if bad:
                    raise ValidationError({"boxes_json": f"Invalid box numbers: {bad}. Allowed 1..{total}."})
                # Disallow legacy fields in new flow
                if self.year or self.month:
                    raise ValidationError({"month": "Month/year not applicable with boxes selection."})
            else:
                # Legacy monthly validation (fallback for older data)
                if not (self.year and self.month):
                    raise ValidationError({"month": "Provide package_number + boxes OR month and year."})
                try:
                    m = int(self.month)
                    y = int(self.year)
                except Exception:
                    raise ValidationError({"month": "Invalid year/month."})
                if not (1 <= m <= 12):
                    raise ValidationError({"month": "Invalid month value."})
                if int(y) != int(today.year) or int(m) != int(today.month):
                    raise ValidationError({"month": "Only current month purchase is allowed for Monthly Promo."})

                # One per user/package per year-month
                qs = PromoPurchase.objects.filter(user=self.user, package=self.package, year=y, month=m)
                if self.pk:
                    qs = qs.exclude(pk=self.pk)
                if qs.exists():
                    raise ValidationError("Monthly Promo already requested for this month.")
        else:
            # PRIME: must not have year/month set
            if self.year or self.month:
                raise ValidationError({"month": "Month/year not applicable for PRIME packages."})

    def save(self, *args, **kwargs):
        creating = self._state.adding
        if creating and not self.amount_paid and self.package_id:
            try:
                self.amount_paid = self.package.price or 0
            except Exception:
                self.amount_paid = 0
        super().save(*args, **kwargs)
