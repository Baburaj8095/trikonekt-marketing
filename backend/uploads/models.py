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
