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

import logging
logger = logging.getLogger(__name__)

# Ensure Hubble webhook models are registered under the business app.
# We keep them in a separate module to avoid bloating this file.
try:
    from .hubble_models import HubbleWebhookEvent  # noqa: F401
except Exception:
    HubbleWebhookEvent = None


def _default_withdrawals_start_time():
    return timezone.datetime.strptime("00:00", "%H:%M").time()


def _default_withdrawals_end_time():
    return timezone.datetime.strptime("23:59", "%H:%M").time()

def is_matrix_eligible(u) -> bool:
    """
    Matrix Eligibility:
    - category must be 'consumer'
    - must NOT be staff or superuser
    - role must NOT be 'agency' or 'employee'
    """
    try:
        if not u:
            return False
        role = str(getattr(u, "role", "") or "").strip().lower()
        category = str(getattr(u, "category", "") or "").strip().lower()
        if getattr(u, "is_staff", False) or getattr(u, "is_superuser", False):
            return False
        if role in ("agency", "employee"):
            return False
        if category != "consumer":
            return False
        return True
    except Exception:
        return False


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
    # New DB-driven category mapping (nullable for backward compatibility)
    category = models.ForeignKey('business.MerchantCategory', null=True, blank=True, on_delete=models.SET_NULL, related_name='registrations')
    subcategory = models.ForeignKey('business.MerchantSubCategory', null=True, blank=True, on_delete=models.SET_NULL, related_name='registrations')
    business_address = models.TextField()

    # Commercial terms
    commission_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    SERVICE_MODE_ONLINE = 'ONLINE'
    SERVICE_MODE_OFFLINE = 'OFFLINE'
    SERVICE_MODE_BOTH = 'BOTH'
    SERVICE_MODE_CHOICES = [
        (SERVICE_MODE_ONLINE, 'Online'),
        (SERVICE_MODE_OFFLINE, 'Offline'),
        (SERVICE_MODE_BOTH, 'Both'),
    ]
    service_mode = models.CharField(max_length=16, choices=SERVICE_MODE_CHOICES, default=SERVICE_MODE_BOTH, db_index=True)

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


# ==============================
# Merchant Category Management
# ==============================
class MerchantCategory(models.Model):
    name = models.CharField(max_length=150, unique=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    sort_order = models.IntegerField(default=0, db_index=True)
    audience = models.CharField(max_length=16, choices=(("CONSUMER", "CONSUMER"), ("MERCHANT", "MERCHANT")), default="CONSUMER", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name = "Merchant Category"
        verbose_name_plural = "Merchant Categories"

    def __str__(self):
        return self.name


class MerchantSubCategory(models.Model):
    category = models.ForeignKey(MerchantCategory, on_delete=models.CASCADE, related_name="subcategories")
    name = models.CharField(max_length=150)
    is_active = models.BooleanField(default=True, db_index=True)
    sort_order = models.IntegerField(default=0, db_index=True)
    audience = models.CharField(max_length=16, choices=(("CONSUMER", "CONSUMER"), ("MERCHANT", "MERCHANT")), default="CONSUMER", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["category_id", "sort_order", "name"]
        verbose_name = "Merchant Subcategory"
        verbose_name_plural = "Merchant Subcategories"
        constraints = [
            models.UniqueConstraint(fields=["category", "name"], name="uniq_merchant_subcategory_per_category")
        ]

    def __str__(self):
        try:
            return f"{getattr(self.category, 'name', 'Category')} → {self.name}"
        except Exception:
            return self.name

# ==========================
# Root Consumer Configuration
# ==========================
class RootConsumerConfig(models.Model):
    """
    Singleton config holding the single designated Root Consumer user.
    Root user must be a consumer (category='consumer'), not staff/superuser and matrix-eligible.
    """
    root_user = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="as_root_consumer")
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Root Consumer Config"
        verbose_name_plural = "Root Consumer Config"

    def __str__(self):
        return f"RootConsumer<{getattr(self.root_user, 'username', None)}>"

    @classmethod
    def get_solo(cls) -> "RootConsumerConfig":
        obj = cls.objects.first()
        return obj or cls.objects.create()

    def get_root_user(self):
        u = getattr(self, "root_user", None)
        try:
            if u and is_matrix_eligible(u):
                return u
        except Exception:
            pass
        try:
            if u and getattr(u, "category", "") == "consumer" and not getattr(u, "is_staff", False) and not getattr(u, "is_superuser", False):
                return u
        except Exception:
            pass
        return None

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
    redeem_credit_amount_150 = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("150.00"))
    # PRIME 750 behavior
    prime_750_units = models.PositiveIntegerField(default=5, help_text="How many 150-units to open for PRIME 750")
    prime_750_redeem_mode = models.CharField(max_length=24, default="units_and_wallet", help_text="units_and_wallet | wallet_only")
    # MONTHLY 759: open 5/3 matrices only on the first purchase/box when True
    monthly_759_open_once = models.BooleanField(default=True, help_text="If true, 5/3 matrices open only on the first 759 purchase")
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

    # ==========================
    # Withdrawals Window Config
    # ==========================
    # Admin-configurable: which weekday and what time window (IST) withdrawals are allowed.
    # weekday follows Python datetime.weekday(): Monday=0 .. Sunday=6
    withdrawals_enabled = models.BooleanField(default=True)
    withdrawals_weekday = models.PositiveSmallIntegerField(default=2, help_text="0=Mon .. 6=Sun")
    withdrawals_start_time = models.TimeField(default=_default_withdrawals_start_time)
    withdrawals_end_time = models.TimeField(default=_default_withdrawals_end_time)

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

    # ----------------------
    # Master config getters
    # ----------------------
    from decimal import Decimal as _D

    def _m(self) -> dict:
        try:
            return dict(self.master_commission_json or {})
        except Exception:
            return {}

    def get_tax_percent(self) -> _D:
        m = self._m()
        try:
            v = m.get("tax", {}).get("percent", None)
            if v is None:
                return self._D(str(self.tax_percent or "10.00"))
            return self._D(str(v))
        except Exception:
            return self._D("10.00")

    def get_company_user(self):
        # Prefer explicit config; else fallback to stored relation; else best-effort resolve
        u = getattr(self, "tax_company_user", None)
        if u:
            return u
        try:
            from accounts.models import CustomUser
            return CustomUser.objects.filter(category="company").first() or CustomUser.objects.filter(is_superuser=True).first()
        except Exception:
            return None

    def get_withdrawal_sponsor_percent(self) -> _D:
        m = self._m()
        try:
            v = m.get("withdrawal", {}).get("sponsor_percent", None)
            if v is None:
                # default behavior earlier: 3%
                return self._D("3.00")
            return self._D(str(v))
        except Exception:
            return self._D("3.00")

    # ----------------------
    # Withdrawals window
    # ----------------------
    def get_withdrawals_window(self) -> dict:
        """Returns admin-configured withdrawals window.

        Shape:
          {
            enabled: bool,
            weekday: int (0=Mon..6=Sun),
            start_time: datetime.time,
            end_time: datetime.time
          }

        Note: window is interpreted in IST at request time.
        """
        try:
            enabled = bool(getattr(self, "withdrawals_enabled", True))
        except Exception:
            enabled = True
        try:
            weekday = int(getattr(self, "withdrawals_weekday", 2) or 0)
        except Exception:
            weekday = 2
        # Clamp weekday
        if weekday < 0 or weekday > 6:
            weekday = 2
        try:
            st = getattr(self, "withdrawals_start_time", None)
        except Exception:
            st = None
        try:
            et = getattr(self, "withdrawals_end_time", None)
        except Exception:
            et = None
        # Fallback defaults
        from datetime import time
        st = st if st is not None else time(0, 0)
        et = et if et is not None else time(23, 59, 59)
        return {"enabled": enabled, "weekday": weekday, "start_time": st, "end_time": et}

    def get_auto_block_config(self) -> dict:
        """
        Returns:
          {
            "block_size": Decimal,      # default 1000.00
            "coupon_cost": Decimal,     # default 150.00
            "tds_fixed": Decimal,       # default 50.00
            "sponsor_bonus": Decimal,   # default 50.00
            "enable_coupon": bool       # default True
          }
        """
        m = self._m()
        ab = dict(m.get("auto_block", {}) or {})
        try:
            block_size = self._D(str(ab.get("block_size", "1000.00")))
            coupon_cost = self._D(str(ab.get("coupon_cost", "150.00")))
            tds_fixed = self._D(str(ab.get("tds_fixed", "50.00")))
            sponsor_bonus = self._D(str(ab.get("sponsor_bonus", "50.00")))
            enable_coupon = bool(ab.get("enable_coupon", True))
            return {
                "block_size": block_size,
                "coupon_cost": coupon_cost,
                "tds_fixed": tds_fixed,
                "sponsor_bonus": sponsor_bonus,
                "enable_coupon": enable_coupon,
            }
        except Exception:
            return {
                "block_size": self._D("1000.00"),
                "coupon_cost": self._D("150.00"),
                "tds_fixed": self._D("50.00"),
                "sponsor_bonus": self._D("50.00"),
                "enable_coupon": True,
            }

    def get_referral_join_config(self) -> dict:
        """
        Returns direct and L1..L5 fixed amounts for referral join payouts.
        { "direct": D, "levels": [D,D,D,D,D] }
        """
        m = self._m()
        rj = dict(m.get("referral_join", {}) or {})
        try:
            direct = self._D(str(rj.get("direct", "")))
            levels = [self._D(str(x)) for x in (rj.get("levels") or [])]
        except Exception:
            direct = None
            levels = []
        # Fallback to legacy typed JSON on model if master missing
        if direct is None:
            try:
                direct = self._D(str((self.referral_join_fixed_json or {}).get("direct", "0")))
            except Exception:
                direct = self._D("0.00")
        if not levels:
            try:
                rjf = dict(self.referral_join_fixed_json or {})
                levels = [
                    self._D(str(rjf.get("l1", "0"))),
                    self._D(str(rjf.get("l2", "0"))),
                    self._D(str(rjf.get("l3", "0"))),
                    self._D(str(rjf.get("l4", "0"))),
                    self._D(str(rjf.get("l5", "0"))),
                ]
            except Exception:
                levels = [self._D("0") for _ in range(5)]
        return {"direct": direct, "levels": levels[:5]}

    def get_level_percents(self) -> list[_D]:
        """
        L1..L5 percents for hierarchical commission (COMMISSION_CREDIT).
        Prefers master_commission_json["upline"] or falls back to l1_percent..l5_percent fields.
        """
        m = self._m()
        upline = dict(m.get("upline", {}) or {})
        try:
            arr = [
                self._D(str(upline.get("l1", ""))),
                self._D(str(upline.get("l2", ""))),
                self._D(str(upline.get("l3", ""))),
                self._D(str(upline.get("l4", ""))),
                self._D(str(upline.get("l5", ""))),
            ]
        except Exception:
            arr = []
        if not any(arr):
            arr = [
                self._D(str(self.l1_percent or "0")),
                self._D(str(self.l2_percent or "0")),
                self._D(str(self.l3_percent or "0")),
                self._D(str(self.l4_percent or "0")),
                self._D(str(self.l5_percent or "0")),
            ]
        return arr

    def get_upline_percents_dynamic(self) -> list[_D]:
        """
        Dynamic-length upline percent list.
        Preference order:
          1) master_commission_json["upline"]["percents"] -> list
          2) master_commission_json["upline"] keys l1..lN (sorted by N)
          3) typed fields l1_percent..l5_percent
        """
        m = self._m()
        try:
            u = dict(m.get("upline", {}) or {})
        except Exception:
            u = {}
        # 1) Direct list form: percents
        lst = u.get("percents")
        if isinstance(lst, list) and lst:
            out: list[CommissionConfig._D] = []
            for v in lst:
                try:
                    out.append(self._D(str(v)))
                except Exception:
                    out.append(self._D("0"))
            return out
        # 2) Map form: l1..lN keys
        try:
            pairs = []
            for k, v in u.items():
                if isinstance(k, str):
                    kl = k.lower()
                    if kl.startswith("l") and kl[1:].isdigit():
                        pairs.append((int(kl[1:]), v))
            if pairs:
                pairs.sort(key=lambda x: x[0])
                out2: list[CommissionConfig._D] = []
                for _, v in pairs:
                    try:
                        out2.append(self._D(str(v)))
                    except Exception:
                        out2.append(self._D("0"))
                return out2
        except Exception:
            pass
        # 3) Fallback to typed DB fields (L1..L5)
        return [
            self._D(str(self.l1_percent or "0")),
            self._D(str(self.l2_percent or "0")),
            self._D(str(self.l3_percent or "0")),
            self._D(str(self.l4_percent or "0")),
            self._D(str(self.l5_percent or "0")),
        ]

    def get_geo_percents(self) -> dict:
        """
        Returns geo role percents as a dict. Keys:
          sub_franchise, pincode, pincode_coord, district, district_coord, state, state_coord, employee, royalty
        """
        m = self._m()
        g = dict(m.get("geo", {}) or {})
        out = {}
        def _get(k, fallback):
            try:
                return self._D(str(g.get(k, ""))) if k in g else self._D(str(fallback))
            except Exception:
                return self._D("0")
        out["sub_franchise"] = _get("sub_franchise", self.sub_franchise_percent or 0)
        out["pincode"] = _get("pincode", self.pincode_percent or 0)
        out["pincode_coord"] = _get("pincode_coord", self.pincode_coord_percent or 0)
        out["district"] = _get("district", self.district_percent or 0)
        out["district_coord"] = _get("district_coord", self.district_coord_percent or 0)
        out["state"] = _get("state", self.state_percent or 0)
        out["state_coord"] = _get("state_coord", self.state_coord_percent or 0)
        out["employee"] = _get("employee", self.employee_percent or 0)
        out["royalty"] = _get("royalty", self.royalty_percent or 0)
        return out

    def get_matrix_three_levels(self) -> int:
        m = self._m()
        try:
            v = int(m.get("matrix_three", {}).get("levels", "") or 0)
            if v > 0:
                return v
        except Exception:
            pass
        # Fallback to admin product-screen overrides when global matrix_three.levels is absent.
        # This keeps structural placement depth aligned with AdminCommissionDistribute's
        # product matrix tabs without changing placement semantics.
        try:
            cm3 = dict(m.get("consumer_matrix_3", {}) or {})
            candidate_levels = []
            for key in ("150", "750", "759", "rs759", "prime759", "prime_759", "monthly_759", "monthly759"):
                row = dict(cm3.get(key, {}) or {})
                try:
                    lvl = int(row.get("levels", 0) or 0)
                    if lvl > 0:
                        candidate_levels.append(lvl)
                except Exception:
                    continue
            if candidate_levels:
                return max(candidate_levels)
        except Exception:
            pass
        return int(self.three_matrix_levels or 15)

    def get_matrix_three_fixed_amounts(self) -> list[_D]:
        m = self._m()
        arr = m.get("matrix_three", {}).get("fixed_amounts", [])
        if arr:
            try:
                return [self._D(str(x)) for x in arr]
            except Exception:
                return []
        try:
            return [self._D(str(x)) for x in (self.three_matrix_amounts_json or [])]
        except Exception:
            return []

    def get_matrix_three_percents(self) -> list[_D]:
        m = self._m()
        arr = m.get("matrix_three", {}).get("percents", [])
        if arr:
            try:
                return [self._D(str(x)) for x in arr]
            except Exception:
                return []
        try:
            return [self._D(str(x)) for x in (self.three_matrix_percents_json or [])]
        except Exception:
            return []

    def get_matrix_five_levels(self) -> int:
        import logging
        logger = logging.getLogger(__name__)

        m = self._m()
        # Top-level matrix_five.levels (legacy/global)
        top_v = 0
        try:
            top_v = int(m.get("matrix_five", {}).get("levels", "") or 0)
        except Exception:
            top_v = 0

        # Consumer/product-specific overrides (preferred if present)
        candidate_levels = []
        try:
            cm5 = dict(m.get("consumer_matrix_5", {}) or {})
            for key in ("150", "750", "759", "rs759", "prime759", "prime_759", "monthly_759", "monthly759"):
                row = dict(cm5.get(key, {}) or {})
                try:
                    lvl = int(row.get("levels", 0) or 0)
                    if lvl > 0:
                        candidate_levels.append(lvl)
                except Exception:
                    continue
        except Exception:
            candidate_levels = []

        max_candidate = max(candidate_levels) if candidate_levels else 0

        # Decide effective depth: prefer the product-specific max, but fall back to top-level or DB field.
        effective = max(max_candidate, int(self.five_matrix_levels or 0), top_v)

        # Warn when legacy top-level value conflicts with product overrides to help ops diagnose
        if top_v > 0 and max_candidate > 0 and top_v != max_candidate:
            # Avoid log spam during bulk operations (repair/backfill can call this hundreds of times).
            # We only need to see this warning once per process.
            try:
                if not getattr(self, "_mx5_levels_mismatch_warned", False):
                    logger.warning(
                        "matrix_five levels mismatch: top=%s vs consumer_product_max=%s; using=%s",
                        top_v,
                        max_candidate,
                        effective,
                    )
                    setattr(self, "_mx5_levels_mismatch_warned", True)
            except Exception:
                # Best-effort: still warn if attribute setting fails
                logger.warning(
                    "matrix_five levels mismatch: top=%s vs consumer_product_max=%s; using=%s",
                    top_v,
                    max_candidate,
                    effective,
                )

        # If nothing configured, fall back to a safe default (6)
        if effective <= 0:
            return 6
        return int(effective)

    def get_matrix_five_fixed_amounts(self) -> list[_D]:
        m = self._m()
        arr = m.get("matrix_five", {}).get("fixed_amounts", [])
        if arr:
            try:
                return [self._D(str(x)) for x in arr]
            except Exception:
                return []
        try:
            return [self._D(str(x)) for x in (self.five_matrix_amounts_json or [])]
        except Exception:
            return []

    def get_matrix_five_percents(self) -> list[_D]:
        m = self._m()
        arr = m.get("matrix_five", {}).get("percents", [])
        if arr:
            try:
                return [self._D(str(x)) for x in arr]
            except Exception:
                return []
        # No legacy typed percents for five matrix; return empty if not provided
        return []

    def get_active_150_direct_bonus(self) -> _D:
        m = self._m()
        try:
            v = m.get("active_150", {}).get("direct_bonus", None)
            if v is None:
                return self._D(str(self.active_direct_bonus_amount or "0"))
            return self._D(str(v))
        except Exception:
            return self._D(str(self.active_direct_bonus_amount or "0"))

    def get_active_150_self_bonus(self) -> _D:
        m = self._m()
        try:
            v = m.get("active_150", {}).get("self_bonus", None)
            if v is None:
                return self._D(str(self.active_self_bonus_amount or "0"))
            return self._D(str(v))
        except Exception:
            return self._D(str(self.active_self_bonus_amount or "0"))


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
    # Monotonic per (owner, pool_type). Distinguishes multiple entries of the same user in the same matrix.
    user_entry_index = models.PositiveIntegerField(default=0, db_index=True)
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
            # Backfill / repair speed indexes (see migration 0034_autopool_backfill_speed_indexes)
            models.Index(
                fields=["owner", "pool_type", "status", "source_id"],
                name="ap_owner_pool_stat_sid",
            ),
            models.Index(
                fields=["owner", "pool_type", "status", "source_type"],
                name="ap_owner_pool_stat_st",
            ),
            models.Index(
                fields=["pool_type", "status", "source_type", "source_id"],
                name="ap_pool_stat_st_sid",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["parent_account", "pool_type", "position"],
                name="uniq_autopool_sibling_position",
                condition=models.Q(parent_account__isnull=False),
            ),
            models.UniqueConstraint(
                fields=["owner", "pool_type", "user_entry_index"],
                name="uniq_user_entry_index_per_user_pool",
            ),
            models.UniqueConstraint(
                fields=["pool_type"],
                name="uniq_single_sentinel_per_pool",
                condition=models.Q(parent_account__isnull=True),
            ),
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
    def create_five_150_for_user(
        cls,
        user,
        amount: Decimal | None = None,
        source_type: str = "",
        source_id: str = "",
        start_entry_id: int | None = None,
        max_allowed: int = 1,
    ):
        """
        FIVE_150 sponsor-anchored forced matrix.
        - 1st entry: Anchor to sponsor's subtree when the direct sponsor has an ACTIVE FIVE_150 entry.
        - 2nd+ entries: Anchor BFS under user's own base (first) FIVE_150 entry
          so subsequent self-accounts cluster beneath the user's own subtree.
        - Otherwise, fall back to the pool sentinel root.
        """
        # Eligibility gate
        try:
            if not is_matrix_eligible(user):
                try:
                    logger.info("matrix skipped: user not eligible", extra={"where": "create_five_150_for_user", "user_id": getattr(user, "id", None)})
                except Exception:
                    pass
                return None
        except Exception:
            return None
        from decimal import Decimal as D
        from business.services.placement import GenericPlacement
        amt = D(amount) if amount is not None else D("150.00")
        # Sponsor-anchored: begin BFS from sponsor's subtree when available; else fallback to sentinel
        # Idempotency / per-source guard:
        # NOTE: Allow unlimited RECOVERY sources (batch fix); other sources respect max_allowed
        try:
            if source_type and source_id:
                # RECOVERY sources are allowed unlimited (for batch reconciliation)
                if str(source_type).upper() != "RECOVERY":
                    existing_same_source = cls.objects.filter(
                        owner=user, pool_type="FIVE_150", source_type=str(source_type), source_id=str(source_id)
                    ).count()
                    if existing_same_source >= int(max_allowed or 1):
                        try:
                            logger.info(
                                "skip create_five_150_for_user: already created for same source",
                                extra={"user_id": getattr(user, "id", None), "source_type": source_type, "source_id": source_id, "max_allowed": max_allowed},
                            )
                        except Exception:
                            pass
                        return None
            else:
                # No source info: respect max_allowed limit on total count
                existing_total = cls.objects.filter(owner=user, pool_type="FIVE_150").count()
                if existing_total >= int(max_allowed or 1):
                    try:
                        logger.info(
                            "skip create_five_150_for_user: owner already has max FIVE_150",
                            extra={"user_id": getattr(user, "id", None), "existing_total": existing_total, "max_allowed": max_allowed},
                        )
                    except Exception:
                        pass
                    return None
        except Exception:
            pass

        # For 2nd+ entries: anchor BFS under user's own base (first) FIVE_150 entry
        # so that subsequent self-accounts cluster beneath the user's own subtree.
        # 1st entry still anchors to sponsor's subtree as before.
        if start_entry_id is not None:
            start_id = start_entry_id
        else:
            own_base = cls._base_self_account(user, "FIVE_150")
            if own_base:
                # User already has at least one FIVE_150 entry → place under it
                start_id = int(own_base.id)
            else:
                # First entry → anchor to sponsor's subtree
                start_id = cls._sponsor_start_entry_id_for(user, "FIVE_150")
        # If no anchor resolved, fall back to global pool root
        if start_id is None:
            root = cls.objects.filter(parent_account__isnull=True, pool_type="FIVE_150").first()
            start_id = root.id if root else None
        return GenericPlacement.place_account(
            owner=user,
            pool_type="FIVE_150",
            amount=amt,
            source_type=source_type or "",
            source_id=source_id or "",
            start_entry_id=start_id,
        )

    @classmethod
    def create_three_150_for_user(
        cls,
        user,
        amount: Decimal | None = None,
        source_type: str = "SYSTEM",
        source_id: str = "",
        max_allowed: int = 1,
    ):
        """
        Global auto-pool placement for THREE_150 (ignores sponsor). Starts from sentinel root.
        """
        # Eligibility gate
        try:
            if not is_matrix_eligible(user):
                try:
                    logger.info("matrix skipped: user not eligible", extra={"where": "create_three_150_for_user", "user_id": getattr(user, "id", None)})
                except Exception:
                    pass
                return None
        except Exception:
            return None
        from decimal import Decimal as D
        from business.services.placement import GenericPlacement
        amt = D(amount) if amount is not None else D("150.00")
        # Idempotency / per-source guard for THREE_150
        # NOTE: Allow unlimited RECOVERY sources (batch fix); other sources respect max_allowed
        try:
            if source_type and source_id:
                # RECOVERY sources are allowed unlimited (for batch reconciliation)
                if str(source_type).upper() != "RECOVERY":
                    existing_same_source = cls.objects.filter(
                        owner=user, pool_type="THREE_150", source_type=str(source_type), source_id=str(source_id)
                    ).count()
                    if existing_same_source >= int(max_allowed or 1):
                        try:
                            logger.info(
                                "skip create_three_150_for_user: already created for same source",
                                extra={"user_id": getattr(user, "id", None), "source_type": source_type, "source_id": source_id, "max_allowed": max_allowed},
                            )
                        except Exception:
                            pass
                        return None
            else:
                # No source info: respect max_allowed limit on total count
                existing_total = cls.objects.filter(owner=user, pool_type="THREE_150").count()
                if existing_total >= int(max_allowed or 1):
                    try:
                        logger.info(
                            "skip create_three_150_for_user: owner already has max THREE_150",
                            extra={"user_id": getattr(user, "id", None), "existing_total": existing_total, "max_allowed": max_allowed},
                        )
                    except Exception:
                        pass
                    return None
        except Exception:
            pass

        # Global pool placement: ignore sponsor anchor
        return GenericPlacement.place_account(
            owner=user,
            pool_type="THREE_150",
            amount=amt,
            source_type=source_type or "SYSTEM",
            source_id=source_id or "",
            start_entry_id=None,
        )

    @classmethod
    def create_three_50_for_user(cls, user, amount: Decimal | None = None):
        """
        Deterministic forced-matrix placement for THREE_50 using GenericPlacement.
        """
        # Eligibility gate
        try:
            if not is_matrix_eligible(user):
                try:
                    logger.info("matrix skipped: user not eligible", extra={"where": "create_three_50_for_user", "user_id": getattr(user, "id", None)})
                except Exception:
                    pass
                return None
        except Exception:
            return None
        from decimal import Decimal as D
        from business.services.placement import GenericPlacement
        amt = D(amount) if amount is not None else D("50.00")
        return GenericPlacement.place_account(
            owner=user,
            pool_type="THREE_50",
            amount=amt,
        )

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
    def _is_virtual_root_user(cls, user):
        try:
            if getattr(user, "id", None) == 32:
                return True
            rc = RootConsumerConfig.get_solo()
            ru = rc.get_root_user()
            return bool(ru and getattr(ru, "id", None) == getattr(user, "id", None))
        except Exception:
            return getattr(user, "id", None) == 32

    @classmethod
    def _sponsor_start_entry_id_for(cls, user, pool_type: str):
        """
        Resolve sponsor-scoped BFS start entry for placement:
        - Return sponsor's PRIMARY entry (entry_idx=1) in this pool_type
          so placement spreads consistently under sponsor's main account
        - If sponsor doesn't have entry_idx=1, fall back to global root
        """
        try:
            sponsor = getattr(user, "registered_by", None)
            if not sponsor or not getattr(sponsor, "id", None):
                return None
            # Do not anchor to virtual root/sentinel user; force global/sentinel BFS in such cases
            try:
                if cls._is_virtual_root_user(sponsor):
                    return None
            except Exception:
                pass
            # Get sponsor's PRIMARY entry (entry_idx=1) - their first account in this matrix
            acc = cls.objects.filter(
                owner=sponsor,
                pool_type=pool_type,
                user_entry_index=1,
                status="ACTIVE",
            ).first()
            return int(acc.id) if acc else None
        except Exception:
            return None

    @classmethod
    def place_in_three_pool(cls, user, pool_type: str, amount: Decimal, source_type: str = "", source_id: str = ""):
        """
        3×N placement engine.
        - THREE_150: global auto-pool (ignore sponsor), start from sentinel.
        - Other 3× pools (e.g., THREE_50): preserve sponsor-anchored behavior if sponsor has an entry.
        """
        # Eligibility gate
        try:
            if not is_matrix_eligible(user):
                try:
                    logger.info("matrix skipped: user not eligible", extra={"where": "place_in_three_pool", "user_id": getattr(user, "id", None), "pool_type": pool_type})
                except Exception:
                    pass
                return None
        except Exception:
            return None
        from decimal import Decimal as D
        from business.services.placement import GenericPlacement
        amt = D(amount or 0)
        start_id = None if str(pool_type) == "THREE_150" else cls._sponsor_start_entry_id_for(user, pool_type)
        return GenericPlacement.place_account(
            owner=user,
            pool_type=pool_type,
            amount=amt,
            source_type=source_type or "",
            source_id=source_id or "",
            start_entry_id=start_id,
        )

    @classmethod
    def place_in_five_pool(cls, user, pool_type: str, amount: Decimal, source_type: str = "", source_id: str = ""):
        """
        FIVE_150 sponsor-anchored forced matrix placement.
        - 1st entry: Anchor to sponsor's subtree when the direct sponsor has an ACTIVE FIVE_150 entry.
        - 2nd+ entries: Anchor BFS under user's own base (first) entry so self-accounts cluster together.
        - Otherwise, fall back to the pool sentinel root.
        """
        # Eligibility gate
        try:
            if not is_matrix_eligible(user):
                try:
                    logger.info("matrix skipped: user not eligible", extra={"where": "place_in_five_pool", "user_id": getattr(user, "id", None), "pool_type": pool_type})
                except Exception:
                    pass
                return None
        except Exception:
            return None
        from decimal import Decimal as D
        from business.services.placement import GenericPlacement
        amt = D(amount or 0)
        # For 2nd+ FIVE_150 entries: BFS under user's own base entry (self-clustering)
        # 1st entry still anchors to sponsor's subtree
        own_base = cls._base_self_account(user, pool_type)
        if own_base:
            start_id = int(own_base.id)
        else:
            start_id = cls._sponsor_start_entry_id_for(user, pool_type)
        return GenericPlacement.place_account(
            owner=user,
            pool_type=pool_type,
            amount=amt,
            source_type=source_type or "",
            source_id=source_id or "",
            start_entry_id=start_id,
        )

    @classmethod
    def place_three_150_for_user(cls, user, amount: Decimal | None = None, source_type: str = "SYSTEM", source_id: str = ""):
        from decimal import Decimal as D
        amt = D(amount) if amount is not None else D("150.00")
        return cls.place_in_three_pool(user, "THREE_150", amt, source_type=source_type or "SYSTEM", source_id=source_id or "")

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


def distribute_auto_pool_commissions(payer_user, base_amount: Decimal, fixed_key: str | None = None, source_type: str = "", source_id: str = "", extra_meta: dict | None = None):
    """
    Distribute commissions to L1..L5 and geo roles based on CommissionConfig.
    Credits wallets directly and records WalletTransaction entries.
    If fixed_key is provided and CommissionConfig.master_commission_json["geo_mode"][fixed_key] == "fixed",
    then use fixed rupee amounts from CommissionConfig.master_commission_json["geo_fixed"][fixed_key] for geo roles.
    Optional source_type/source_id/extra_meta are forwarded to Wallet.credit for idempotent tracking/audit.
    """
    from accounts.models import Wallet, CustomUser, AgencyRegionAssignment  # local import to avoid circulars
    cfg = CommissionConfig.get_solo()
    if not cfg.enable_pool_distribution:
        return
    st = source_type or "AUTO_POOL_GEO"
    sid = source_id or str(getattr(payer_user, "id", ""))

    # Percentages mapping (config-driven; dynamic length)
    levels = cfg.get_upline_percents_dynamic()
    labels = ["L{}".format(i + 1) for i in range(len(levels))]
    percents = [(labels[i], Decimal(levels[i] or 0)) for i in range(len(levels))]
    upline = _resolve_upline(payer_user, depth=len(levels))

    with transaction.atomic():
        # Hierarchical L1..L5 (disabled for consumer payer to remove "level bonus")
            is_consumer = False
            try:
                is_consumer = str(getattr(payer_user, "category", "") or "").strip().lower() == "consumer"
            except Exception:
                is_consumer = False
            if not is_consumer:
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

            # Resolve agency recipients using region assignments (pincode/district/state) like franchise flow
            recipients = {
                "Sub Franchise": None,
                "Pincode": None,
                "Pincode Coord": None,
                "District": None,
                "District Coord": None,
                "State": None,
                "State Coord": None,
            }

            # Pincode-level roles (exact pin)
            if pin:
                recipients["Sub Franchise"] = CustomUser.objects.filter(
                    category="agency_sub_franchise",
                    region_assignments__level="pincode",
                    region_assignments__pincode=pin,
                ).distinct().first()
                recipients["Pincode"] = CustomUser.objects.filter(
                    category="agency_pincode",
                    region_assignments__level="pincode",
                    region_assignments__pincode=pin,
                ).distinct().first()
                recipients["Pincode Coord"] = CustomUser.objects.filter(
                    category="agency_pincode_coordinator",
                    region_assignments__level="pincode",
                    region_assignments__pincode=pin,
                ).distinct().first()

            # District/State-level roles (scoped by State best-effort)
            if state:
                recipients["District"] = CustomUser.objects.filter(
                    category="agency_district",
                    region_assignments__level="district",
                    region_assignments__state=state,
                ).distinct().first()
                recipients["District Coord"] = CustomUser.objects.filter(
                    category="agency_district_coordinator",
                    region_assignments__level="district",
                    region_assignments__state=state,
                ).distinct().first()
                recipients["State"] = CustomUser.objects.filter(
                    category="agency_state",
                    region_assignments__level="state",
                    region_assignments__state=state,
                ).distinct().first()
                recipients["State Coord"] = CustomUser.objects.filter(
                    category="agency_state_coordinator",
                    region_assignments__level="state",
                    region_assignments__state=state,
                ).distinct().first()

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

            # Rule: Skip Sub Franchise payout for consumer activations (ambiguous when multiple SF per pincode)
            try:
                if str(getattr(payer_user, "category", "") or "").lower() == "consumer":
                    recipients["Sub Franchise"] = None
            except Exception:
                pass

            # Decide fixed vs percent based on master_commission_json and fixed_key
            master = dict(getattr(cfg, "master_commission_json", {}) or {})
            mode_map = dict(master.get("geo_mode", {}) or {})
            fixed_map_all = dict(master.get("geo_fixed", {}) or {})
            use_fixed = bool(fixed_key and (str(mode_map.get(fixed_key, "")).lower() == "fixed"))

            role_key_to_label = {
                "sub_franchise": "Sub Franchise",
                "pincode": "Pincode",
                "pincode_coord": "Pincode Coord",
                "district": "District",
                "district_coord": "District Coord",
                "state": "State",
                "state_coord": "State Coord",
                "employee": "Employee",
                "royalty": "Royalty",
            }

            if use_fixed and isinstance(fixed_map_all.get(fixed_key), dict):
                fm = fixed_map_all.get(fixed_key) or {}
                for k, v in fm.items():
                    label = role_key_to_label.get(str(k))
                    if not label:
                        continue
                    user_obj = recipients.get(label)
                    if not user_obj:
                        continue
                    try:
                        from decimal import Decimal as D
                        amt = D(str(v or 0)).quantize(D("0.01"))
                    except Exception:
                        amt = Decimal("0.00")
                    if amt <= 0:
                        continue
                    try:
                        w = Wallet.get_or_create_for_user(user_obj)
                        meta2 = {
                            "layer": label,
                            "source": "AUTO_POOL_GEO_FIXED",
                            "package": str(fixed_key or ""),
                            "payer": getattr(payer_user, "username", None),
                        }
                        if extra_meta:
                            try:
                                meta2.update(dict(extra_meta))
                            except Exception:
                                pass
                        w.credit(
                            amt,
                            tx_type="COMMISSION_CREDIT",
                            meta=meta2,
                            source_type=st,
                            source_id=sid,
                        )
                    except Exception:
                        continue
            else:
                # Percent mode: allow per-product percent overrides from master_commission_json
                # Supported locations (first match wins):
                #   - master.geo[fixed_key] = { role_key: percent, ... }
                #   - master.geo_percents[fixed_key] / master.geo_percent[fixed_key]
                #   - master.products[product_key].geo (product_key: coupon150|rs750|rs759)
                override_map = {}
                try:
                    # direct per-key map
                    gm = dict(master.get("geo", {}) or {})
                    if isinstance(gm.get(fixed_key), dict):
                        override_map = dict(gm.get(fixed_key) or {})
                    # explicit geo_percents/geo_percent maps
                    if not override_map:
                        gpx = dict(master.get("geo_percents", {}) or {})
                        if isinstance(gpx.get(fixed_key), dict):
                            override_map = dict(gpx.get(fixed_key) or {})
                    if not override_map:
                        gpx2 = dict(master.get("geo_percent", {}) or {})
                        if isinstance(gpx2.get(fixed_key), dict):
                            override_map = dict(gpx2.get(fixed_key) or {})
                    # legacy products.* map
                    if not override_map:
                        prod_key_map = {"150": "coupon150", "750": "rs750", "759": "rs759"}
                        pk = prod_key_map.get(str(fixed_key))
                        if pk:
                            override_map = dict(((master.get("products", {}) or {}).get(pk, {}) or {}).get("geo", {}) or {})
                except Exception:
                    override_map = {}

                def get_pct(role_key: str, fallback) -> Decimal:
                    try:
                        if role_key in override_map:
                            return Decimal(str(override_map.get(role_key, "0") or "0"))
                    except Exception:
                        pass
                    return Decimal(fallback or 0)

                geo_map = [
                    ("Sub Franchise", get_pct("sub_franchise", cfg.sub_franchise_percent)),
                    ("Pincode", get_pct("pincode", cfg.pincode_percent)),
                    ("Pincode Coord", get_pct("pincode_coord", cfg.pincode_coord_percent)),
                    ("District", get_pct("district", cfg.district_percent)),
                    ("District Coord", get_pct("district_coord", cfg.district_coord_percent)),
                    ("State", get_pct("state", cfg.state_percent)),
                    ("State Coord", get_pct("state_coord", cfg.state_coord_percent)),
                    ("Employee", get_pct("employee", cfg.employee_percent)),
                    ("Royalty", get_pct("royalty", cfg.royalty_percent)),
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
                        meta2 = {"layer": label, "source": "AUTO_POOL_GEO", "payer": getattr(payer_user, "username", None)}
                        if extra_meta:
                            try:
                                meta2.update(dict(extra_meta))
                            except Exception:
                                pass
                        w.credit(
                            amt,
                            tx_type="COMMISSION_CREDIT",
                            meta=meta2,
                            source_type=st,
                            source_id=sid,
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
    # Optional payment details shown to agency for self-payment
    payment_qr = models.ImageField(upload_to="uploads/agency_package_qr/", null=True, blank=True, storage=MEDIA_STORAGE)
    upi_id = models.CharField(max_length=100, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} — {self.name} (₹{self.amount})"


# ==============================
# Franchise Dashboard (Admin-managed)
# ==============================


class FranchiseAchiever(models.Model):
    """Admin-managed achievers mapped by pincode.

    Used on Franchise (agency) dashboard.
    """

    pincode = models.CharField(max_length=10, db_index=True)
    name = models.CharField(max_length=150)
    achieved = models.CharField(max_length=200, blank=True, default="")
    photo = models.ImageField(
        upload_to="uploads/franchise/achievers/",
        null=True,
        blank=True,
        storage=MEDIA_STORAGE,
        max_length=500,
    )
    sort_order = models.IntegerField(default=0, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "-created_at", "id"]
        indexes = [
            models.Index(fields=["pincode", "is_active"]),
        ]

    def __str__(self):
        return f"{self.pincode} - {self.name}"


class WishingBanner(models.Model):
    """Admin-managed wishing banner for franchise dashboard.

    Requirement: show the latest active banner (single latest).
    """

    title = models.CharField(max_length=200, blank=True, default="")
    image = models.ImageField(
        upload_to="uploads/franchise/wishing/",
        null=True,
        blank=True,
        storage=MEDIA_STORAGE,
        max_length=500,
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.title or f"WishingBanner#{self.pk}"


# ======================================
# Team/Consumer Dashboard (Admin managed)
# ======================================
class TeamConsumerWishingBanner(models.Model):
    """Admin-managed wishing banner images for Team/Consumer dashboard."""

    title = models.CharField(max_length=180, blank=True, default="")
    # Store in Cloudinary when enabled (align with uploads app + franchise wishing banner behavior)
    image = models.ImageField(
        upload_to="team_consumer/wishing_banners/",
        null=True,
        blank=True,
        storage=MEDIA_STORAGE,
        max_length=500,
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name = "Team/Consumer Wishing Banner"
        verbose_name_plural = "Team/Consumer Wishing Banners"

    def __str__(self):
        return self.title or f"TeamConsumerWishingBanner#{self.pk}"


class TeamConsumerTopAchiever(models.Model):
    """Admin-managed top achievers displayed in Team/Consumer dashboard."""

    name = models.CharField(max_length=180, blank=True, default="")
    achieved = models.CharField(max_length=220, blank=True, default="")
    sort_order = models.IntegerField(default=0, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    # Store in Cloudinary when enabled (align with franchise achievers)
    photo = models.ImageField(
        upload_to="team_consumer/top_achievers/",
        null=True,
        blank=True,
        storage=MEDIA_STORAGE,
        max_length=500,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "-created_at", "id"]
        verbose_name = "Team/Consumer Top Achiever"
        verbose_name_plural = "Team/Consumer Top Achievers"

    def __str__(self):
        return self.name or f"TeamConsumerTopAchiever#{self.pk}"


class TeamConsumerEducationalVideo(models.Model):
    """Admin-managed educational videos displayed on the Team/Consumer dashboard."""

    title = models.CharField(max_length=180, blank=True, default="")
    description = models.TextField(blank=True, default="")
    required_rank = models.ForeignKey(
        "mlm_ranks.Rank",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="educational_videos",
        help_text="Digital Education Prime rank required to unlock this video.",
    )
    sort_order = models.IntegerField(default=0, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    video = models.FileField(
        upload_to="team_consumer/educational_videos/",
        null=True,
        blank=True,
        storage=RAW_STORAGE,
        max_length=500,
    )
    thumbnail = models.ImageField(
        upload_to="team_consumer/educational_video_thumbnails/",
        null=True,
        blank=True,
        storage=MEDIA_STORAGE,
        max_length=500,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "-created_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["required_rank"],
                condition=models.Q(required_rank__isnull=False),
                name="uniq_team_consumer_education_video_per_rank",
            ),
        ]
        verbose_name = "Team/Consumer Educational Video"
        verbose_name_plural = "Team/Consumer Educational Videos"

    def __str__(self):
        return self.title or f"TeamConsumerEducationalVideo#{self.pk}"


class TeamConsumerDocument(models.Model):
    """Admin-managed PDF documents for Team/Consumer dashboard actions."""

    KIND_PDF = "PDF"
    KIND_BUSINESS_PDF = "BUSINESS_PDF"
    KIND_CERTIFICATE = "CERTIFICATE"
    KIND_CHOICES = (
        (KIND_PDF, "Trikonekt PDF"),
        (KIND_BUSINESS_PDF, "Trikonekt Business PDF"),
        (KIND_CERTIFICATE, "Certificate"),
    )

    kind = models.CharField(max_length=24, choices=KIND_CHOICES, db_index=True)
    title = models.CharField(max_length=180, blank=True, default="")
    file = models.FileField(
        upload_to="team_consumer/documents/",
        null=True,
        blank=True,
        storage=RAW_STORAGE,
        max_length=500,
    )
    sort_order = models.IntegerField(default=0, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["kind", "sort_order", "-created_at", "id"]
        verbose_name = "Team/Consumer Document"
        verbose_name_plural = "Team/Consumer Documents"

    def __str__(self):
        return self.title or f"{self.kind}#{self.pk}"


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


class AgencyPackagePaymentRequest(models.Model):
    """
    Agency-submitted payment request for an AgencyPackageAssignment.
    Admin reviews and on approval a real AgencyPackagePayment is recorded.
    """
    STATUS_CHOICES = (
        ("PENDING", "PENDING"),
        ("APPROVED", "APPROVED"),
        ("REJECTED", "REJECTED"),
    )
    assignment = models.ForeignKey(AgencyPackageAssignment, on_delete=models.CASCADE, related_name="payment_requests")
    agency = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="agency_package_payment_requests", db_index=True)
    package = models.ForeignKey(Package, on_delete=models.CASCADE, related_name="agency_payment_requests")
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    method = models.CharField(max_length=16, default="UPI", db_index=True)
    utr = models.CharField(max_length=100, blank=True, default="", help_text="UPI Reference/UTR")
    payment_proof = models.FileField(upload_to="uploads/agency_package_proofs/", null=True, blank=True, storage=RAW_STORAGE)
    notes = models.TextField(blank=True)

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="PENDING", db_index=True)
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="approved_agency_package_payment_requests")

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["agency", "status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["assignment"],
                condition=models.Q(status="PENDING"),
                name="uniq_pending_request_per_assignment",
            )
        ]

    def __str__(self):
        return f"Req<{self.assignment_id}> ₹{self.amount} {self.status}"


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

    # Payment mode (manual proof vs internal self-package wallet)
    PAYMENT_MODE_MANUAL = "MANUAL"
    PAYMENT_MODE_WALLET = "WALLET"
    PAYMENT_MODE_CHOICES = (
        (PAYMENT_MODE_MANUAL, "MANUAL"),
        (PAYMENT_MODE_WALLET, "WALLET"),
    )
    payment_mode = models.CharField(
        max_length=16,
        choices=PAYMENT_MODE_CHOICES,
        default=PAYMENT_MODE_MANUAL,
        db_index=True,
        help_text="MANUAL=UPI proof upload, WALLET=self package (internal) wallet",
    )

    # For wallet-paid purchases, track debit/refund tx for idempotency/audit
    wallet_debit_tx = models.ForeignKey(
        "accounts.WalletTransaction",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="promo_wallet_debits",
    )
    wallet_refund_tx = models.ForeignKey(
        "accounts.WalletTransaction",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="promo_wallet_refunds",
    )

    # PRIME750 specific: selected product and shipping/delivery metadata
    # Deprecated: selected_product kept for backward compatibility (was market.Product)
    selected_product = models.ForeignKey("market.Product", null=True, blank=True, on_delete=models.SET_NULL, related_name="selected_in_promo_purchases")
    selected_promo_product = models.ForeignKey("PromoProduct", null=True, blank=True, on_delete=models.SET_NULL, related_name="selected_in_promo_purchases")
    shipping_address = models.TextField(blank=True)
    delivery_by = models.DateField(null=True, blank=True)

    # TRI apps (Tri Tour / tri-holidays)
    # Stored for admin filtering/reporting. Optional for non-TRI purchases.
    tri_app_slug = models.SlugField(max_length=60, blank=True, default="", db_index=True)
    tri_product_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)

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
            models.Index(fields=["tri_app_slug", "status", "requested_at"]),
            models.Index(fields=["payment_mode", "status", "requested_at"]),
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


class InvoiceSettings(models.Model):
    company_name = models.CharField(max_length=180, default="Trikonekt")
    gst_number = models.CharField(max_length=32, blank=True, default="")
    company_address = models.TextField(blank=True, default="")
    company_phone = models.CharField(max_length=32, blank=True, default="")
    company_email = models.EmailField(blank=True, default="")
    logo = models.ImageField(upload_to="uploads/invoice/", null=True, blank=True, storage=MEDIA_STORAGE)
    invoice_prefix = models.CharField(max_length=24, default="TRK/INV/")
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    footer_text = models.TextField(blank=True, default="Thank you for your purchase.")
    is_active = models.BooleanField(default=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_active", "-updated_at", "-id"]

    def __str__(self):
        return f"InvoiceSettings<{self.company_name}>"


class PackageInvoice(models.Model):
    promo_purchase = models.OneToOneField(PromoPurchase, on_delete=models.CASCADE, related_name="invoice")
    invoice_number = models.CharField(max_length=48, unique=True, db_index=True)
    invoice_date = models.DateTimeField(default=timezone.now, db_index=True)

    company_name = models.CharField(max_length=180)
    company_gst_number = models.CharField(max_length=32, blank=True, default="")
    company_address = models.TextField(blank=True, default="")
    company_phone = models.CharField(max_length=32, blank=True, default="")
    company_email = models.EmailField(blank=True, default="")
    logo_url = models.CharField(max_length=500, blank=True, default="")

    consumer_name = models.CharField(max_length=180, blank=True, default="")
    consumer_phone = models.CharField(max_length=32, blank=True, default="")
    consumer_username = models.CharField(max_length=180, blank=True, default="")
    consumer_address = models.TextField(blank=True, default="")
    consumer_city = models.CharField(max_length=120, blank=True, default="")
    consumer_state = models.CharField(max_length=120, blank=True, default="")
    consumer_pincode = models.CharField(max_length=20, blank=True, default="")

    package_name = models.CharField(max_length=180)
    package_code = models.CharField(max_length=80, blank=True, default="")
    quantity = models.PositiveIntegerField(default=1)
    taxable_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_mode = models.CharField(max_length=32, blank=True, default="")
    footer_text = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-invoice_date", "-id"]
        indexes = [
            models.Index(fields=["invoice_date", "invoice_number"]),
        ]

    def __str__(self):
        return self.invoice_number


class PromoProductOrder(models.Model):
    """
    Minimal order record for PRIME 750 PRODUCT choice so admin can dispatch later.
    Idempotent per PromoPurchase via OneToOne relation.
    """
    STATUS_CHOICES = (
        ("PENDING", "PENDING"),
        ("DISPATCHED", "DISPATCHED"),
        ("CANCELLED", "CANCELLED"),
    )
    promo_purchase = models.OneToOneField("PromoPurchase", on_delete=models.CASCADE, related_name="product_order")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="promo_product_orders")
    product = models.ForeignKey("PromoProduct", null=True, blank=True, on_delete=models.SET_NULL, related_name="orders")
    shipping_address = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="PENDING", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"PromoProductOrder<{self.promo_purchase_id}:{getattr(self.product, 'id', None)}> {self.status}"


class Promo759Subscription(models.Model):
    """
    Minimal subscription marker for PRIME_759 approvals.
    Used to ensure idempotency and visibility of subscription activation for month-1 payout.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="promo_759_subscriptions", db_index=True)
    promo_purchase = models.OneToOneField("PromoPurchase", on_delete=models.CASCADE, related_name="subscription_759")
    active_from = models.DateTimeField(auto_now_add=True, db_index=True)
    status = models.CharField(max_length=16, default="ACTIVE", db_index=True)
    metadata = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["-active_from", "-id"]

    def __str__(self):
        return f"Promo759Subscription<{self.promo_purchase_id}:{self.user_id}> {self.status}"


# ==============================
# TRI Apps (Holidays, EV, etc.) — Admin-managed catalogs
# ==============================
class TriApp(models.Model):
    """
    Admin-configurable TRI App surface (e.g., Holidays, EV Vehicles, Furniture, etc.).
    Flags control UI capabilities for price visibility, add-to-cart and payment.
    """
    slug = models.SlugField(max_length=60, unique=True, db_index=True, help_text="URL key e.g., tri-holidays, tri-ev")
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    # Sort order for category grid (admin-controlled)
    sort_order = models.IntegerField(default=0, db_index=True)

    # UI capability toggles (admin-controlled)
    allow_price = models.BooleanField(default=False, help_text="If false, hide product prices to users.")
    allow_add_to_cart = models.BooleanField(default=False, help_text="If false, disable Add to Cart buttons.")
    allow_payment = models.BooleanField(default=False, help_text="If false, disable Checkout/Payment flows.")

    banner_image = models.ImageField(upload_to="uploads/tri_apps/banners/", null=True, blank=True, storage=MEDIA_STORAGE)
    icon = models.ImageField(upload_to="uploads/tri_apps/icons/", null=True, blank=True, storage=MEDIA_STORAGE)

    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "slug"]
        verbose_name = "TRI App"
        verbose_name_plural = "TRI Apps"

    def __str__(self):
        return f"{self.slug} — {self.name}"


class TriAppProduct(models.Model):
    """
    Products under a TRI App. Images are uploadable via admin and shown on user UI.
    Price/add-to-cart/payment are governed by TriApp flags.
    """
    app = models.ForeignKey(TriApp, on_delete=models.CASCADE, related_name="products", db_index=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)], default=0)
    # Admin-configured max percent of line total that can be paid using reward points at checkout.
    # Example: 3.00 means up to 3% of (price * qty) can be redeemed from user's reward points.
    max_reward_points_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="Max % of line total redeemable via reward points")
    currency = models.CharField(max_length=8, default="INR")
    image = models.ImageField(upload_to="uploads/tri_apps/products/", null=True, blank=True, storage=MEDIA_STORAGE)
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["app_id", "display_order", "id"]
        indexes = [
            models.Index(fields=["app", "is_active", "display_order"]),
        ]

    def __str__(self):
        return f"{getattr(self.app, 'slug', 'app')} → {self.name}"

from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender=AgencyPackagePayment)
def activate_agency_on_any_payment(sender, instance: AgencyPackagePayment, created: bool, **kwargs):
    # Activate agency account on first recorded package payment (>= ₹0.01)
    if not created:
        return
    try:
        if getattr(instance, "amount", None) and instance.amount > Decimal("0.00"):
            assignment = instance.assignment
            agency = getattr(assignment, "agency", None)
            if agency and not getattr(agency, "account_active", False):
                agency.account_active = True
                agency.save(update_fields=["account_active"])
    except Exception:
        # best-effort; do not block payment save
        pass
