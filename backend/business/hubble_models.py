from __future__ import annotations

from django.db import models


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
