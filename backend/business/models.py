from django.db import models
from django.conf import settings
from django.utils import timezone


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
    """
    base_coupon_value = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("150.00"))
    enable_pool_distribution = models.BooleanField(default=True)

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
    """
    STATUS_CHOICES = (
        ("ACTIVE", "ACTIVE"),
        ("PENDING", "PENDING"),
        ("CLOSED", "CLOSED"),
    )
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pool_accounts")
    username_key = models.CharField(max_length=150, db_index=True)
    entry_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("150.00"))
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="ACTIVE", db_index=True)
    parent_account = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    level = models.PositiveIntegerField(default=1, db_index=True)  # optional metadata for hierarchy traversal
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["username_key", "status"]),
        ]

    def __str__(self):
        return f"Pool<{self.username_key}> ₹{self.entry_amount} [{self.status}]"

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
            status="ACTIVE",
            parent_account=None,
            level=1,
        )


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
