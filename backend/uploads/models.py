from django.db import models
from accounts.models import CustomUser

# Optional Cloudinary raw storage for non-image files (e.g., PDFs)
# Safe in dev: if cloudinary_storage isn't installed/active, RAW_STORAGE stays None and
# Django will use DEFAULT_FILE_STORAGE (filesystem or MediaCloudinaryStorage).
try:
    from cloudinary_storage.storage import RawMediaCloudinaryStorage, MediaCloudinaryStorage
    RAW_STORAGE = RawMediaCloudinaryStorage()
    MEDIA_STORAGE = MediaCloudinaryStorage()
except Exception:
    RAW_STORAGE = None
    MEDIA_STORAGE = None

class FileUpload(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, null=True, blank=True)
    title = models.CharField(max_length=100)
    file = models.FileField(upload_to='uploads/', storage=RAW_STORAGE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class DashboardCard(models.Model):
    key = models.SlugField(max_length=50, unique=True)
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    route = models.CharField(max_length=200)
    role = models.CharField(max_length=20, blank=True, help_text="Optional: restrict this card to a specific role (user/employee/agency)")
    image = models.ImageField(upload_to='uploads/cards/', blank=True, null=True, storage=MEDIA_STORAGE)
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class LuckyDrawSubmission(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='lucky_draws')
    username = models.CharField(max_length=150, blank=True)
    role = models.CharField(max_length=30, blank=True)
    phone = models.CharField(max_length=20, blank=True)

    # Existing fields
    sl_number = models.CharField(max_length=100)
    ledger_number = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10)
    image = models.ImageField(upload_to='uploads/lucky_draw/', storage=MEDIA_STORAGE)

    # New requested fields
    coupon_purchaser_name = models.CharField(max_length=150, blank=True)
    purchase_date = models.DateField(null=True, blank=True)
    address = models.TextField(blank=True)
    referral_name = models.CharField(max_length=150, blank=True)
    referral_id = models.CharField(max_length=64, blank=True)
    agency_name = models.CharField(max_length=150, blank=True)
    agency_pincode = models.CharField(max_length=10, blank=True)
    tr_referral_id = models.CharField(max_length=64, blank=True)
    tr_emp_id = models.CharField(max_length=64, blank=True)

    # Assignment and approval workflow
    STATUS_CHOICES = (
        ("SUBMITTED", "Submitted"),
        ("TRE_APPROVED", "TRE Approved"),
        ("TRE_REJECTED", "TRE Rejected"),
        ("AGENCY_APPROVED", "Agency Approved"),
        ("AGENCY_REJECTED", "Agency Rejected"),
        ("ADMIN_APPROVED", "Admin Approved"),
        ("ADMIN_REJECTED", "Admin Rejected"),
    )
    assigned_tre = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_lucky_draws"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="SUBMITTED", db_index=True)

    tre_reviewer = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="tre_lucky_reviews"
    )
    tre_reviewed_at = models.DateTimeField(null=True, blank=True)
    tre_comment = models.TextField(blank=True)

    agency_reviewer = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="agency_lucky_reviews"
    )
    agency_reviewed_at = models.DateTimeField(null=True, blank=True)
    agency_comment = models.TextField(blank=True)

    admin_reviewer = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="admin_lucky_reviews"
    )
    admin_reviewed_at = models.DateTimeField(null=True, blank=True)
    admin_comment = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def mark_tre_review(self, reviewer: CustomUser, approved: bool, comment: str = ""):
        from django.utils import timezone
        self.tre_reviewer = reviewer
        self.tre_reviewed_at = timezone.now()
        self.tre_comment = comment or ""
        self.status = "TRE_APPROVED" if approved else "TRE_REJECTED"

    def mark_agency_review(self, reviewer: CustomUser, approved: bool, comment: str = ""):
        from django.utils import timezone
        self.agency_reviewer = reviewer
        self.agency_reviewed_at = timezone.now()
        self.agency_comment = comment or ""
        self.status = "AGENCY_APPROVED" if approved else "AGENCY_REJECTED"

    def mark_admin_review(self, reviewer: CustomUser, approved: bool, comment: str = ""):
        from django.utils import timezone
        self.admin_reviewer = reviewer
        self.admin_reviewed_at = timezone.now()
        self.admin_comment = comment or ""
        self.status = "ADMIN_APPROVED" if approved else "ADMIN_REJECTED"

    def __str__(self):
        return f"{self.username or 'anon'} - {self.sl_number}"


class JobApplication(models.Model):
    EMPLOYMENT_CHOICES = (
        ("full_time", "Full-time"),
        ("part_time", "Part-time"),
    )

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="job_applications", null=True, blank=True)
    full_name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    employment_type = models.CharField(max_length=20, choices=EMPLOYMENT_CHOICES)
    resume = models.FileField(upload_to="uploads/resumes/", storage=RAW_STORAGE)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=10, blank=True)
    experience_years = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    skills = models.TextField(blank=True)
    education = models.TextField(blank=True)
    expected_salary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        who = self.user.username if self.user_id else (self.email or "unknown")
        return f"{who} - {self.get_employment_type_display()}"


class HomeCard(models.Model):
    title = models.CharField(max_length=150, blank=True)
    image = models.ImageField(upload_to="uploads/homecard/", storage=MEDIA_STORAGE)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title or f"HomeCard #{self.pk}"


class HeroBanner(models.Model):
    """
    Admin-managed hero carousel banners. Shown at top of User Dashboard (max 3 on client).
    """
    title = models.CharField(max_length=200, blank=True, default="")
    link = models.URLField(blank=True, default="")
    image = models.ImageField(upload_to="uploads/hero/", storage=MEDIA_STORAGE)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "-created_at"]

    def __str__(self):
        return self.title or f"HeroBanner #{self.pk}"


class Promotion(models.Model):
    """
    Admin-managed promos for 'Deals & Promotions' section.
    Use keys like 'prime', 'tri-spinwin' to override existing cards without layout changes.
    """
    key = models.SlugField(max_length=50, blank=True, help_text="Optional stable key (e.g., 'prime', 'tri-spinwin')")
    label = models.CharField(max_length=150, blank=True)
    image = models.ImageField(upload_to="uploads/promotions/", storage=MEDIA_STORAGE)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "-created_at"]

    def __str__(self):
        return self.label or (self.key or f"Promotion #{self.pk}")


class CategoryBanner(models.Model):
    """
    Admin-provided banners for category rows in dashboard (Electronics, Furniture, EV).
    Keys must match dashboard app keys to enable overrides without UI changes.
    """
    KEY_CHOICES = (
        ("tri-electronics", "TRI Electronics"),
        ("tri-furniture", "TRI Furniture"),
        ("tri-ev", "TRI EV"),
    )
    key = models.CharField(max_length=50, choices=KEY_CHOICES)
    label = models.CharField(max_length=150, blank=True)
    image = models.ImageField(upload_to="uploads/categories/", storage=MEDIA_STORAGE)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "-created_at"]
        unique_together = (("key",),)

    def __str__(self):
        return self.label or self.key


class LuckyCouponAssignment(models.Model):
    CHANNEL_CHOICES = (
        ("physical", "Physical"),
    )

    agency = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="lucky_assignments_made"
    )
    employee = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="lucky_assignments"
    )
    quantity = models.PositiveIntegerField(default=0)
    # Employee-updated progress: how many of the assigned physical coupons have been sold
    sold_count = models.PositiveIntegerField(default=0)
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default="physical")
    note = models.TextField(blank=True)
    created_by = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_lucky_assignments"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        emp = getattr(self.employee, "username", "unknown")
        qty = self.quantity or 0
        return f"Assign {qty} ({self.channel}) to {emp}"


class AgencyCouponQuota(models.Model):
    """
    Admin-managed quota of physical Lucky Draw coupons assignable by an Agency to its Employees.
    This tracks only the 'count' allowed for assignment (not specific CouponCode instances).
    """
    agency = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name="lucky_quota")
    quota = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        who = getattr(self.agency, "username", "agency")
        return f"{who} quota {self.quota}"


class LuckyDrawEligibility(models.Model):
    """
    Per-user Lucky Draw eligibility earned from approved PRIME 750 purchases with choice=COUPON.
    tokens: number of entries earned
    consumed: number of entries consumed (future use; not auto-consumed yet)
    """
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="lucky_draw_eligibilities", db_index=True)
    purchase = models.ForeignKey("business.PromoPurchase", on_delete=models.SET_NULL, null=True, blank=True, related_name="lucky_draw_eligibility")
    tokens = models.PositiveIntegerField(default=1)
    consumed = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        indexes = [
            models.Index(fields=["user"]),
        ]

    def remaining(self) -> int:
        try:
            rem = int(self.tokens or 0) - int(self.consumed or 0)
            return rem if rem > 0 else 0
        except Exception:
            return 0

    def __str__(self):
        return f"Eligibility<{self.user_id}> +{self.tokens} -{self.consumed}"


# ==============================
# Spin-based Lucky Draw (admin-picked winners)
# ==============================
class LuckySpinDraw(models.Model):
    """
    Admin-configured spin window. Spin UI is enabled only between start_at and end_at.
    Winners are fully admin-selected; non-winners always see a losing result.
    """
    STATUS_CHOICES = (
        ("DRAFT", "DRAFT"),
        ("SCHEDULED", "SCHEDULED"),
        ("LOCKED", "LOCKED"),   # config frozen; ready for window
        ("LIVE", "LIVE"),       # within window
        ("ENDED", "ENDED"),     # past end_at
        ("CANCELLED", "CANCELLED"),
    )
    title = models.CharField(max_length=200, blank=True, default="")
    start_at = models.DateTimeField(db_index=True)
    end_at = models.DateTimeField(db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="DRAFT", db_index=True)
    timezone = models.CharField(max_length=64, default="Asia/Kolkata")
    locked = models.BooleanField(default=False, help_text="Freeze config and winners before going live")
    created_by = models.ForeignKey(CustomUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="created_spin_draws")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_at", "-id"]

    def __str__(self):
        return f"SpinDraw<{self.id}> {self.title or ''} [{self.start_at} - {self.end_at}] {self.status}"

    @property
    def is_active_window(self) -> bool:
        from django.utils import timezone
        now = timezone.now()
        return bool(self.locked and self.start_at <= now <= self.end_at)

    def auto_refresh_status(self, save: bool = False):
        """
        Soft status management to aid UI. Does not enforce scheduling beyond hints.
        """
        from django.utils import timezone
        now = timezone.now()
        new = self.status
        if self.locked and self.start_at <= now <= self.end_at:
            new = "LIVE"
        elif now > self.end_at:
            new = "ENDED"
        elif self.locked:
            new = "SCHEDULED"
        else:
            new = "DRAFT"
        if new != self.status:
            self.status = new
            if save:
                try:
                    self.save(update_fields=["status"])
                except Exception:
                    pass


class LuckySpinWinner(models.Model):
    """
    Admin-selected winners for a draw, with optional prize payload.
    """
    PRIZE_TYPE_CHOICES = (
        ("INFO", "Informational"),
        ("WALLET", "Wallet Credit"),
        ("COUPON", "Coupon"),
    )
    draw = models.ForeignKey(LuckySpinDraw, on_delete=models.CASCADE, related_name="winners", db_index=True)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="spin_wins", db_index=True)
    # Snapshot fields for display/audit
    username = models.CharField(max_length=150, blank=True, default="")
    prize_title = models.CharField(max_length=200, blank=True, default="")
    prize_description = models.TextField(blank=True, default="")
    prize_type = models.CharField(max_length=16, choices=PRIZE_TYPE_CHOICES, default="INFO")
    prize_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    prize_meta = models.JSONField(null=True, blank=True)
    is_claimed = models.BooleanField(default=False)
    claimed_at = models.DateTimeField(null=True, blank=True)
    claim_source = models.CharField(max_length=32, blank=True, default="")  # e.g., SPIN, ADMIN

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        unique_together = (("draw", "user"),)
        indexes = [
            models.Index(fields=["draw", "user"]),
        ]

    def __str__(self):
        return f"SpinWinner<{getattr(self.user, 'username', self.user_id)} @ {self.draw_id}>"

    def mark_claimed(self, source: str = "SPIN"):
        from django.utils import timezone
        if not self.is_claimed:
            self.is_claimed = True
            self.claimed_at = timezone.now()
            self.claim_source = source or "SPIN"
            try:
                self.save(update_fields=["is_claimed", "claimed_at", "claim_source"])
            except Exception:
                pass


class LuckySpinAttempt(models.Model):
    """
    A user's spin attempt for a draw. Enforce one attempt per (user, draw).
    """
    RESULT_CHOICES = (("WIN", "WIN"), ("LOSE", "LOSE"))
    draw = models.ForeignKey(LuckySpinDraw, on_delete=models.CASCADE, related_name="attempts", db_index=True)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="spin_attempts", db_index=True)
    result = models.CharField(max_length=8, choices=RESULT_CHOICES)
    payload = models.JSONField(null=True, blank=True)
    spun_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-spun_at", "-id"]
        unique_together = (("draw", "user"),)
        indexes = [
            models.Index(fields=["draw", "user"]),
            models.Index(fields=["user", "spun_at"]),
        ]

    def __str__(self):
        return f"SpinAttempt<{getattr(self.user, 'username', self.user_id)} {self.result} @ {self.draw_id}>"
