from django.db import models
from django.conf import settings
from django.utils import timezone


UserModel = settings.AUTH_USER_MODEL


class Coupon(models.Model):
    code = models.CharField(max_length=64, unique=True, db_index=True)
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    campaign = models.CharField(max_length=100, blank=True)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_to = models.DateTimeField(null=True, blank=True)
    issuer = models.ForeignKey(UserModel, on_delete=models.PROTECT, related_name="issued_coupons")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.code} - {self.title}"


class CouponCode(models.Model):
    CHANNEL_CHOICES = (
        ("physical", "Physical"),
        ("e_coupon", "E-Coupon"),
    )
    STATUS_CHOICES = (
        ("AVAILABLE", "AVAILABLE"),
        ("ASSIGNED_AGENCY", "ASSIGNED_AGENCY"),      # assigned to agency (admin -> agency)
        ("ASSIGNED_EMPLOYEE", "ASSIGNED_EMPLOYEE"),  # assigned to employee (agency -> employee)
        ("SOLD", "SOLD"),        # distributed to consumer / submission created
        ("REDEEMED", "REDEEMED"),# final approved by agency
        ("REVOKED", "REVOKED"),
    )

    code = models.CharField(max_length=64, unique=True, db_index=True)
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name="codes")
    issued_channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default="physical")
    assigned_employee = models.ForeignKey(UserModel, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_codes")
    assigned_agency = models.ForeignKey(UserModel, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_codes_agency")
    batch = models.ForeignKey("CouponBatch", null=True, blank=True, on_delete=models.SET_NULL, related_name="codes")
    serial = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    value = models.DecimalField(max_digits=8, decimal_places=2, default=150)
    issued_by = models.ForeignKey(UserModel, on_delete=models.PROTECT, related_name="generated_codes")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="AVAILABLE", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["coupon"]),
            models.Index(fields=["batch"]),
            models.Index(fields=["serial"]),
        ]

    def __str__(self):
        return f"{self.code} [{self.status}]"

    def mark_assigned(self, employee):
        # Backwards compatibility: assign to employee
        self.assigned_employee = employee
        self.status = "ASSIGNED_EMPLOYEE"

    def mark_assigned_to_employee(self, employee):
        self.assigned_employee = employee
        self.status = "ASSIGNED_EMPLOYEE"

    def mark_assigned_to_agency(self, agency):
        self.assigned_agency = agency
        self.status = "ASSIGNED_AGENCY"

    def mark_sold(self):
        # Called when a consumer submits this code
        if self.status in ("AVAILABLE", "ASSIGNED_AGENCY", "ASSIGNED_EMPLOYEE"):
            self.status = "SOLD"

    def mark_redeemed(self):
        self.status = "REDEEMED"


class CouponAssignment(models.Model):
    ASSIGNMENT_STATUS = (
        ("ASSIGNED", "ASSIGNED"),
        ("SOLD", "SOLD"),
        ("REVOKED", "REVOKED"),
    )

    coupon = models.OneToOneField(Coupon, on_delete=models.CASCADE, related_name="assignment")
    employee = models.ForeignKey(UserModel, on_delete=models.PROTECT, related_name="coupon_assignments")
    assigned_by = models.ForeignKey(UserModel, on_delete=models.PROTECT, related_name="coupon_assignments_made")
    assigned_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=ASSIGNMENT_STATUS, default="ASSIGNED")

    class Meta:
        ordering = ["-assigned_at"]

    def __str__(self):
        return f"{self.coupon.code} -> {getattr(self.employee, 'username', 'employee')} ({self.status})"


class CouponSubmission(models.Model):
    STATUS = (
        ("SUBMITTED", "SUBMITTED"),
        ("EMPLOYEE_APPROVED", "EMPLOYEE_APPROVED"),
        ("AGENCY_APPROVED", "AGENCY_APPROVED"),
        ("REJECTED", "REJECTED"),
    )

    consumer = models.ForeignKey(UserModel, on_delete=models.PROTECT, related_name="coupon_submissions")
    coupon = models.ForeignKey(Coupon, on_delete=models.PROTECT, related_name="submissions")
    # Keep plain text coupon_code for fast filtering and legacy
    coupon_code = models.CharField(max_length=64, db_index=True)
    # Link to instance when CouponCode exists
    code_ref = models.ForeignKey(CouponCode, null=True, blank=True, on_delete=models.SET_NULL, related_name="submissions")

    pincode = models.CharField(max_length=10, db_index=True)
    notes = models.TextField(blank=True)
    file = models.FileField(upload_to="uploads/coupon_submissions/")
    status = models.CharField(max_length=20, choices=STATUS, default="SUBMITTED", db_index=True)

    employee_reviewer = models.ForeignKey(
        UserModel, null=True, blank=True, on_delete=models.SET_NULL, related_name="employee_reviews"
    )
    employee_reviewed_at = models.DateTimeField(null=True, blank=True)
    employee_comment = models.TextField(blank=True)

    agency_reviewer = models.ForeignKey(
        UserModel, null=True, blank=True, on_delete=models.SET_NULL, related_name="agency_reviews"
    )
    agency_reviewed_at = models.DateTimeField(null=True, blank=True)
    agency_comment = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["pincode"]),
            models.Index(fields=["coupon"]),
            models.Index(fields=["coupon_code"]),
        ]

    def __str__(self):
        return f"{self.coupon_code} by {getattr(self.consumer, 'username', 'user')} [{self.status}]"

    def mark_employee_review(self, reviewer, approved: bool, comment: str = ""):
        self.employee_reviewer = reviewer
        self.employee_reviewed_at = timezone.now()
        self.employee_comment = comment or ""
        if approved:
            self.status = "EMPLOYEE_APPROVED"
        else:
            self.status = "REJECTED"

    def mark_agency_review(self, reviewer, approved: bool, comment: str = ""):
        self.agency_reviewer = reviewer
        self.agency_reviewed_at = timezone.now()
        self.agency_comment = comment or ""
        if approved:
            self.status = "AGENCY_APPROVED"
        else:
            self.status = "REJECTED"


class CouponBatch(models.Model):
    """
    Physical Lucky Coupon batch definition with sequential serials and code prefix.
    Example: prefix='LC', serial_start=1, serial_end=2000 -> LC0001..LC2000
    """
    coupon = models.ForeignKey(Coupon, on_delete=models.PROTECT, related_name="batches")
    prefix = models.CharField(max_length=20, help_text="Code prefix, e.g. 'LC'")
    serial_start = models.PositiveIntegerField()
    serial_end = models.PositiveIntegerField()
    serial_width = models.PositiveIntegerField(default=4)
    created_by = models.ForeignKey(UserModel, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_batches")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def count(self) -> int:
        try:
            return int(self.serial_end) - int(self.serial_start) + 1
        except Exception:
            return 0

    def __str__(self):
        return f"{self.prefix}{str(self.serial_start).zfill(self.serial_width)}-{self.prefix}{str(self.serial_end).zfill(self.serial_width)}"


class Commission(models.Model):
    ROLE_CHOICES = (
        ("agency", "Agency"),
        ("employee", "Employee"),
    )
    STATUS_CHOICES = (
        ("earned", "Earned"),
        ("paid", "Paid"),
        ("reversed", "Reversed"),
    )

    recipient = models.ForeignKey(UserModel, on_delete=models.PROTECT, related_name="commissions")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, db_index=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=15)
    coupon_code = models.ForeignKey(CouponCode, on_delete=models.SET_NULL, null=True, blank=True, related_name="commissions")
    submission = models.ForeignKey("CouponSubmission", on_delete=models.CASCADE, related_name="commissions")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="earned", db_index=True)
    earned_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["-earned_at"]
        indexes = [
            models.Index(fields=["role", "status"]),
        ]

    def __str__(self):
        return f"{self.role} {self.recipient_id} ₹{self.amount} ({self.status})"


class AuditTrail(models.Model):
    action = models.CharField(max_length=64, db_index=True)
    actor = models.ForeignKey(UserModel, on_delete=models.SET_NULL, null=True, blank=True, related_name="coupon_audits")
    coupon_code = models.ForeignKey(CouponCode, on_delete=models.SET_NULL, null=True, blank=True, related_name="audits")
    submission = models.ForeignKey("CouponSubmission", on_delete=models.SET_NULL, null=True, blank=True, related_name="audits")
    batch = models.ForeignKey(CouponBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name="audits")
    notes = models.TextField(blank=True)
    metadata = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["action"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        ref = self.coupon_code.code if self.coupon_code_id else (self.submission.coupon_code if self.submission_id else "")
        return f"[{self.action}] {ref}"


# Signals for side-effects on approvals
from django.db.models.signals import post_save
from django.dispatch import receiver
from decimal import Decimal


@receiver(post_save, sender=CouponSubmission)
def handle_submission_post_save(sender, instance: "CouponSubmission", created: bool, **kwargs):
    """
    When a submission is created or moves to agency approved, log and create commissions.
    """
    try:
        if created:
            # Audit on creation
            AuditTrail.objects.create(
                action="submission_created",
                actor=instance.consumer,
                coupon_code=instance.code_ref,
                submission=instance,
                metadata={"pincode": instance.pincode},
            )
            return

        # Employee approved audit
        if instance.status == "EMPLOYEE_APPROVED":
            AuditTrail.objects.create(
                action="employee_approved",
                actor=instance.employee_reviewer,
                coupon_code=instance.code_ref,
                submission=instance,
                notes=instance.employee_comment or "",
            )

        # Agency approved: finalize redemption + commissions + audit
        if instance.status == "AGENCY_APPROVED":
            # Mark code redeemed (idempotent)
            if instance.code_ref_id:
                if instance.code_ref.status != "REDEEMED":
                    instance.code_ref.mark_redeemed()
                    instance.code_ref.save(update_fields=["status"])

            # Create commissions if not exists
            already = Commission.objects.filter(submission=instance).exists()
            emp_user = None
            ag_user = None
            if not already:
                emp_user = instance.employee_reviewer or (instance.code_ref.assigned_employee if instance.code_ref_id else None)
                ag_user = instance.agency_reviewer or (instance.code_ref.assigned_agency if instance.code_ref_id else None)
                if emp_user:
                    Commission.objects.create(
                        recipient=emp_user,
                        role="employee",
                        amount=Decimal("15.00"),
                        coupon_code=instance.code_ref,
                        submission=instance,
                        status="earned",
                        metadata={"coupon_value": float(instance.code_ref.value) if instance.code_ref_id else 150},
                    )
                if ag_user:
                    Commission.objects.create(
                        recipient=ag_user,
                        role="agency",
                        amount=Decimal("15.00"),
                        coupon_code=instance.code_ref,
                        submission=instance,
                        status="earned",
                        metadata={"coupon_value": float(instance.code_ref.value) if instance.code_ref_id else 150},
                    )

            # Wallet credits and Auto-Pool creation
            try:
                from accounts.models import Wallet
                from business.models import CommissionConfig, AutoPoolAccount, distribute_auto_pool_commissions

                cfg = CommissionConfig.get_solo()
                # Determine credit value (prefer code_ref.value if available else base config)
                base_val = None
                try:
                    base_val = Decimal(str(getattr(instance.code_ref, "value", ""))) if instance.code_ref_id else None
                except Exception:
                    base_val = None
                credit_value = base_val if base_val is not None else Decimal(cfg.base_coupon_value or 150)

                # Credit consumer wallet
                if instance.consumer_id:
                    w = Wallet.get_or_create_for_user(instance.consumer)
                    w.credit(
                        credit_value,
                        tx_type="REDEEM_ECOUPON_CREDIT",
                        meta={"coupon_code": instance.coupon_code, "submission_id": instance.id},
                        source_type="COUPON",
                        source_id=str(instance.id),
                    )

                    # Fixed commissions to employee and agency wallets (₹15 each) when available
                    if not emp_user:
                        emp_user = instance.employee_reviewer or (instance.code_ref.assigned_employee if instance.code_ref_id else None)
                    if not ag_user:
                        ag_user = instance.agency_reviewer or (instance.code_ref.assigned_agency if instance.code_ref_id else None)

                    if emp_user:
                        try:
                            ew = Wallet.get_or_create_for_user(emp_user)
                            ew.credit(
                                Decimal("15.00"),
                                tx_type="COMMISSION_CREDIT",
                                meta={"role": "employee", "submission_id": instance.id, "coupon_code": instance.coupon_code},
                                source_type="ECOUPON_COMMISSION",
                                source_id=str(instance.id),
                            )
                        except Exception:
                            pass
                    if ag_user:
                        try:
                            aw = Wallet.get_or_create_for_user(ag_user)
                            aw.credit(
                                Decimal("15.00"),
                                tx_type="COMMISSION_CREDIT",
                                meta={"role": "agency", "submission_id": instance.id, "coupon_code": instance.coupon_code},
                                source_type="ECOUPON_COMMISSION",
                                source_id=str(instance.id),
                            )
                        except Exception:
                            pass

                    # Auto-Pool account creation anchored to consumer.username and hierarchical commission
                    try:
                        entry_amt = Decimal(cfg.base_coupon_value or 150)
                        AutoPoolAccount.create_for_user(instance.consumer, entry_amt)
                        distribute_auto_pool_commissions(instance.consumer, entry_amt)
                    except Exception:
                        pass
            except Exception:
                # Non-blocking of main approval flow
                pass

            AuditTrail.objects.create(
                action="agency_approved",
                actor=instance.agency_reviewer,
                coupon_code=instance.code_ref,
                submission=instance,
                notes=instance.agency_comment or "",
            )
    except Exception:
        # Do not break the main transaction due to audit/commission failure
        pass
