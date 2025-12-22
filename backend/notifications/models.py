from django.conf import settings
from django.db import models
from django.utils import timezone

User = settings.AUTH_USER_MODEL


class DeviceToken(models.Model):
    """
    Stores device/browser push tokens per user (scaffold for future push).
    """
    PLATFORM_CHOICES = [
        ("web", "Web"),
        ("android", "Android"),
        ("ios", "iOS"),
    ]
    PROVIDER_CHOICES = [
        ("fcm", "Firebase Cloud Messaging"),
        ("onesignal", "OneSignal"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="device_tokens", db_index=True)
    platform = models.CharField(max_length=16, choices=PLATFORM_CHOICES, default="web", db_index=True)
    provider = models.CharField(max_length=16, choices=PROVIDER_CHOICES, default="fcm", db_index=True)
    token = models.TextField(unique=True)
    subscribed = models.BooleanField(default=True, db_index=True)
    role_cached = models.CharField(max_length=32, blank=True, default="", db_index=True)  # denormalized for audience filters
    app_version = models.CharField(max_length=32, blank=True, default="")
    last_seen_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "platform"]),
            models.Index(fields=["platform", "provider"]),
        ]

    def __str__(self):
        return f"DeviceToken<{getattr(self, 'id', None)}> {self.platform}/{self.provider} [{ 'on' if self.subscribed else 'off' }]"


class NotificationEventTemplate(models.Model):
    """
    Admin-configurable broadcast template.
    """
    PRIORITY_CHOICES = [
        ("normal", "Normal"),
        ("high", "High"),
    ]

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    title = models.CharField(max_length=150)
    body = models.TextField()
    deep_link = models.CharField(max_length=255, blank=True)
    image_url = models.URLField(blank=True)
    channels = models.JSONField(default=dict, blank=True)   # e.g., {"push": false, "in_app": true}
    audience = models.JSONField(default=dict, blank=True)   # e.g., {"roles": ["consumer","agency","employee","merchant"]}
    priority = models.CharField(max_length=12, choices=PRIORITY_CHOICES, default="normal")
    pinned_until = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    dedupe_key = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        return f"Template<{self.name}>"


class NotificationBatch(models.Model):
    """
    One dispatch instance created from a template (send-now or scheduled).
    """
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]
    template = models.ForeignKey(NotificationEventTemplate, on_delete=models.CASCADE, related_name="batches")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="notification_batches")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending", db_index=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    target_counts = models.JSONField(default=dict, blank=True)  # {"users": 0, "devices": 0}
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"Batch<{self.id}> {self.template.name} [{self.status}]"


class Notification(models.Model):
    """
    Per-recipient in-app record (also acts as the dashboard "event").
    """
    CHANNEL_CHOICES = [
        ("in_app", "In App"),
        ("push", "Push"),
        ("email", "Email"),
    ]
    PRIORITY_CHOICES = [
        ("normal", "Normal"),
        ("high", "High"),
    ]

    batch = models.ForeignKey(NotificationBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications", db_index=True)
    role_cached = models.CharField(max_length=32, blank=True, default="", db_index=True)
    channel = models.CharField(max_length=16, choices=CHANNEL_CHOICES, default="in_app", db_index=True)
    is_broadcast = models.BooleanField(default=True, db_index=True)

    title = models.CharField(max_length=150)
    body = models.TextField()
    deep_link = models.CharField(max_length=255, blank=True)
    priority = models.CharField(max_length=12, choices=PRIORITY_CHOICES, default="normal")
    pinned_until = models.DateTimeField(null=True, blank=True)

    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    provider_message_id = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["user", "is_broadcast", "created_at"]),
            models.Index(fields=["user", "read_at"]),
            models.Index(fields=["priority", "created_at"]),
        ]

    def mark_read(self):
        if not self.read_at:
            self.read_at = timezone.now()
            self.save(update_fields=["read_at"])

    @property
    def is_read(self) -> bool:
        return bool(self.read_at)

    def __str__(self):
        return f"Notif<{self.id}> {getattr(self, 'title', '')}"
