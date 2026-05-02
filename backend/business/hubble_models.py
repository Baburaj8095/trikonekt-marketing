from __future__ import annotations

from django.db import models
from django.conf import settings
from django.utils import timezone


class HubbleWebhookEvent(models.Model):
    """Raw Hubble webhook events for audit + idempotent processing."""

    STATUS_PENDING = "PENDING"
    STATUS_PROCESSING = "PROCESSING"
    STATUS_DONE = "DONE"
    STATUS_FAILED = "FAILED"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_DONE, "Done"),
        (STATUS_FAILED, "Failed"),
    ]

    provider = models.CharField(max_length=32, default="hubble", db_index=True)
    event_type = models.CharField(max_length=64, blank=True, default="", db_index=True)
    transaction_reference_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    status = models.CharField(max_length=32, blank=True, default="", db_index=True)

    # Dedup key: derived from payload (prefer transactionReferenceId + status)
    idempotency_key = models.CharField(max_length=255, unique=True, db_index=True)

    # Signature header value (for debugging)
    x_verify = models.CharField(max_length=256, blank=True, default="")

    # Store raw body and parsed json
    raw_body = models.TextField(blank=True, default="")
    payload = models.JSONField(null=True, blank=True)

    received_at = models.DateTimeField(auto_now_add=True, db_index=True)
    processed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    process_status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    process_error = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-received_at"]
        indexes = [
            models.Index(fields=["provider", "event_type", "received_at"]),
            models.Index(fields=["transaction_reference_id", "status"]),
        ]

    def __str__(self) -> str:
        return f"HubbleWebhookEvent<{self.id}> {self.event_type} {self.transaction_reference_id} {self.status}"


class HubbleTransaction(models.Model):
    """Canonical transaction view for Hubble Gift Cards.

    This is the *source of truth* our app should use for user-visible status and any wallet/ledger
    reconciliation.

    We keep HubbleWebhookEvent as the raw immutable audit log and project events into this table.
    """

    STATUS_PROCESSING = "PROCESSING"
    STATUS_COMPLETED = "COMPLETED"
    STATUS_FAILED = "FAILED"
    STATUS_REVERSED = "REVERSED"
    STATUS_UNKNOWN = "UNKNOWN"

    STATUS_CHOICES = [
        (STATUS_PROCESSING, "Processing"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
        (STATUS_REVERSED, "Reversed"),
        (STATUS_UNKNOWN, "Unknown"),
    ]

    provider = models.CharField(max_length=32, default="hubble", db_index=True)
    transaction_reference_id = models.CharField(max_length=64, unique=True, db_index=True)

    # Hubble's user identifier in webhook payloads (maps to our SSO JWT 'sub')
    hubble_user_id = models.CharField(max_length=128, blank=True, default="", db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="hubble_transactions",
        db_index=True,
    )

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_UNKNOWN, db_index=True)

    # Amounts are stored as strings/decimals depending on provider payload; keep as Decimal when possible.
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=8, blank=True, default="")

    # Optional: last seen webhook event pointer
    last_event = models.ForeignKey(
        "business.HubbleWebhookEvent",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="as_last_event_for_transactions",
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_webhook_received_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        indexes = [
            models.Index(fields=["provider", "status", "updated_at"]),
            models.Index(fields=["user", "status", "updated_at"]),
            models.Index(fields=["hubble_user_id", "updated_at"]),
        ]

    def __str__(self) -> str:
        return f"HubbleTransaction<{self.id}> {self.transaction_reference_id} {self.status}"

    @classmethod
    def normalize_status(cls, raw: str) -> str:
        v = str(raw or "").strip().upper()
        if v in ("PROCESSING",):
            return cls.STATUS_PROCESSING
        if v in ("COMPLETED", "SUCCESS", "SUCCEEDED"):
            return cls.STATUS_COMPLETED
        if v in ("FAILED", "FAILURE"):
            return cls.STATUS_FAILED
        if v in ("REVERSED", "REVERSED_SUCCESS", "REVERSE"):
            return cls.STATUS_REVERSED
        return cls.STATUS_UNKNOWN

    def apply_status_transition(self, new_status: str) -> None:
        """Apply a conservative state machine.

        Backward-compatible / safety-oriented rules:
        - COMPLETED is terminal unless REVERSED arrives.
        - FAILED is terminal unless a later COMPLETED arrives (some providers retry async).
        - REVERSED is terminal.
        """
        ns = self.normalize_status(new_status)
        cur = self.normalize_status(self.status)
        if cur == self.STATUS_REVERSED:
            return
        if ns == self.STATUS_REVERSED:
            self.status = ns
            return
        if cur == self.STATUS_COMPLETED and ns != self.STATUS_REVERSED:
            return
        # Allow FAILED -> COMPLETED (late success) and PROCESSING -> anything
        self.status = ns
