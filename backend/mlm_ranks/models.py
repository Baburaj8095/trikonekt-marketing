from decimal import Decimal
from django.conf import settings
from django.db import models


class Rank(models.Model):
    """
    L1..L10 rank definitions with team size and upgrade amount.
    """
    rank_name = models.CharField(max_length=100, unique=True, db_index=True)
    level_number = models.PositiveSmallIntegerField(unique=True, db_index=True)  # 1..10
    team_size_required = models.PositiveIntegerField(default=0)
    upgrade_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["level_number"]
        indexes = [
            models.Index(fields=["level_number"]),
        ]

    def __str__(self) -> str:
        return f"{self.rank_name} (L{self.level_number})"


class UserRank(models.Model):
    """
    Per-user current rank state and cached counters for team size and directs.
    One row per user.
    """
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="rank_profile", db_index=True)
    current_rank = models.ForeignKey(Rank, on_delete=models.PROTECT, related_name="holders")
    achieved_at = models.DateTimeField(null=True, blank=True)

    # Cached counters (Prime 750 gated as per business rules)
    total_team_size = models.PositiveIntegerField(default=0)
    direct_count = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["current_rank"]),
        ]

    def __str__(self) -> str:
        return f"UserRank<{getattr(self.user, 'username', self.user_id)}> -> {getattr(self.current_rank, 'rank_name', None)}"


class RankUpgrade(models.Model):
    """
    Rank upgrade payment/activation record.
    """
    STATUS_INITIATED = "INITIATED"
    STATUS_SUCCESS = "SUCCESS"
    STATUS_FAILED = "FAILED"
    STATUS_CANCELLED = "CANCELLED"
    STATUS_CHOICES = (
        (STATUS_INITIATED, "INITIATED"),
        (STATUS_SUCCESS, "SUCCESS"),
        (STATUS_FAILED, "FAILED"),
        (STATUS_CANCELLED, "CANCELLED"),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="rank_upgrades", db_index=True)
    from_rank = models.ForeignKey(Rank, on_delete=models.PROTECT, related_name="from_upgrades")
    to_rank = models.ForeignKey(Rank, on_delete=models.PROTECT, related_name="to_upgrades")

    upgrade_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    net_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    payment_status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_INITIATED, db_index=True)
    upgraded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["payment_status"]),
            models.Index(fields=["to_rank"]),
        ]

    def __str__(self) -> str:
        return f"Upgrade<{self.user_id}: {getattr(self.from_rank, 'rank_name', None)} -> {getattr(self.to_rank, 'rank_name', None)}> {self.payment_status}"


class UpgradeCommission(models.Model):
    """
    Commission rows created during an upgrade.
    May be credited immediately (released) or placed on hold with CommissionHold.
    """
    TYPE_DIRECT = "DIRECT"
    TYPE_LEVEL = "LEVEL"
    TYPE_CHOICES = (
        (TYPE_DIRECT, "DIRECT"),
        (TYPE_LEVEL, "LEVEL"),
    )

    STATUS_PENDING = "PENDING"
    STATUS_CREDITED = "CREDITED"
    STATUS_HELD = "HELD"
    STATUS_FORFEITED = "FORFEITED_TO_COMPANY"
    STATUS_CHOICES = (
        (STATUS_PENDING, "PENDING"),
        (STATUS_CREDITED, "CREDITED"),
        (STATUS_HELD, "HELD"),
        (STATUS_FORFEITED, "FORFEITED_TO_COMPANY"),
    )

    upgrade = models.ForeignKey(RankUpgrade, on_delete=models.CASCADE, related_name="commissions", db_index=True)
    from_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="upgrade_commissions_origin")
    to_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="upgrade_commissions_target", db_index=True)

    # level=0 indicates direct sponsor commission; 1..10 indicates level pool
    level = models.PositiveSmallIntegerField(default=0, db_index=True)
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    commission_type = models.CharField(max_length=16, choices=TYPE_CHOICES, db_index=True)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["upgrade_id", "level", "id"]
        indexes = [
            models.Index(fields=["to_user", "status"]),
            models.Index(fields=["upgrade", "level"]),
            models.Index(fields=["commission_type", "status"]),
        ]

    def __str__(self) -> str:
        return f"UC<{self.upgrade_id} L{self.level} {self.commission_type} ₹{self.commission_amount} → {self.to_user_id} [{self.status}]>"


class CommissionHold(models.Model):
    """
    Holds 25% of a recipient's commission when directs < 5 Prime-750.
    Released early when directs >=5; forfeited to company after HOLD_DAYS if not met.
    """
    STATUS_PENDING = "PENDING"
    STATUS_RELEASED = "RELEASED"
    STATUS_FORFEITED = "FORFEITED_TO_COMPANY"
    STATUS_CHOICES = (
        (STATUS_PENDING, "PENDING"),
        (STATUS_RELEASED, "RELEASED"),
        (STATUS_FORFEITED, "FORFEITED_TO_COMPANY"),
    )

    commission = models.OneToOneField(UpgradeCommission, on_delete=models.CASCADE, related_name="hold", db_index=True)
    hold_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    release_date = models.DateField(db_index=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["release_date", "id"]
        indexes = [
            models.Index(fields=["status", "release_date"]),
        ]

    def __str__(self) -> str:
        return f"Hold<{self.commission_id} ₹{self.hold_amount} {self.status} until {self.release_date}>"


class RankUpgradePayment(models.Model):
    """
    User-submitted payment proof for a RankUpgrade (UPI/UTR + screenshot).
    Admin will verify and then approve the associated RankUpgrade.
    """
    upgrade = models.ForeignKey(RankUpgrade, on_delete=models.CASCADE, related_name="payments", db_index=True)
    utr = models.CharField(max_length=100, blank=True, default="")
    remarks = models.TextField(blank=True, default="")
    payment_proof = models.FileField(upload_to="rank_payments/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["upgrade", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"RUPay<{self.upgrade_id} {self.utr or '-'} {self.created_at:%Y-%m-%d}>"


# ---------------- Rank-1 Five-Matrix Models ----------------

class RankMatrixRoot(models.Model):
    """
    Rank-1 matrix root per user. Exactly one row per (user, rank=Rank-1).
    first_upgrade_at/expiry_at define 7-day window starting at first direct approval.
    """
    root_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="rank_matrix_roots", db_index=True)
    rank = models.ForeignKey(Rank, on_delete=models.PROTECT, related_name="matrix_roots", db_index=True)
    first_upgrade_at = models.DateTimeField(null=True, blank=True, db_index=True)
    expiry_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = (("root_user", "rank"),)
        indexes = [
            models.Index(fields=["root_user"]),
            models.Index(fields=["rank"]),
            models.Index(fields=["first_upgrade_at"]),
            models.Index(fields=["expiry_at"]),
        ]

    def __str__(self) -> str:
        return f"MatrixRoot<{getattr(self.root_user, 'id', None)} R{getattr(self.rank, 'id', None)}>"


class RankMatrixNode(models.Model):
    """
    Rank-1 Five-Matrix placement row under a RankMatrixRoot (root_user).
    - parent_user: the user under whom this child sits in the root's matrix
    - level_depth: depth from root (root's direct children = 1)
    - position: 1..5 among siblings (children of the same parent_user)
    """
    root_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="rank_matrix_nodes", db_index=True)
    placed_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="rank_matrix_as_child", db_index=True)
    parent_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="rank_matrix_as_parent", db_index=True)
    level_depth = models.PositiveSmallIntegerField(db_index=True)  # 1..n (root's children are 1)
    position = models.PositiveSmallIntegerField(db_index=True)  # 1..5 among siblings
    approved_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = (
            ("root_user", "placed_user"),
            ("root_user", "parent_user", "position"),
        )
        ordering = ["level_depth", "approved_at", "position", "id"]
        indexes = [
            models.Index(fields=["root_user", "parent_user", "position"]),
            models.Index(fields=["root_user", "placed_user"]),
            models.Index(fields=["root_user", "level_depth"]),
        ]

    def __str__(self) -> str:
        return (
            f"MatrixNode<root={getattr(self.root_user, 'id', None)} "
            f"parent={getattr(self.parent_user, 'id', None)} "
            f"lvl={self.level_depth} pos={self.position} "
            f"child={getattr(self.placed_user, 'id', None)}>"
        )
