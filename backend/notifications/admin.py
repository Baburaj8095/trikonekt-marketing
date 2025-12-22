from django.contrib import admin
from django.utils.html import format_html
from .models import DeviceToken, Notification, NotificationBatch, NotificationEventTemplate
from .services import dispatch_template_now


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "platform", "provider", "subscribed", "role_cached", "last_seen_at", "created_at")
    list_filter = ("platform", "provider", "subscribed", "role_cached")
    search_fields = ("user__username", "token")
    autocomplete_fields = ("user",)
    readonly_fields = ("last_seen_at", "created_at")


@admin.register(NotificationEventTemplate)
class NotificationEventTemplateAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "title", "is_active", "priority", "pinned_until", "updated_at", "preview_audience")
    list_filter = ("is_active", "priority")
    search_fields = ("name", "title", "description", "body", "dedupe_key")
    actions = ["action_dispatch_now"]

    def preview_audience(self, obj):
        try:
            aud = obj.audience or {}
            roles = aud.get("roles") or []
            return ", ".join([str(r) for r in roles]) or "-"
        except Exception:
            return "-"

    @admin.action(description="Dispatch now to configured audience")
    def action_dispatch_now(self, request, queryset):
        count = 0
        for tpl in queryset:
            try:
                dispatch_template_now(template=tpl, actor=request.user)
                count += 1
            except Exception:
                pass
        self.message_user(request, f"Queued {count} template(s) for dispatch.")


@admin.register(NotificationBatch)
class NotificationBatchAdmin(admin.ModelAdmin):
    list_display = ("id", "template", "status", "scheduled_for", "started_at", "finished_at", "targets_users", "targets_devices", "created_by", "created_at")
    list_filter = ("status",)
    search_fields = ("template__name",)
    autocomplete_fields = ("template", "created_by")
    readonly_fields = ("started_at", "finished_at", "created_at")

    def targets_users(self, obj):
        try:
            return (obj.target_counts or {}).get("users") or 0
        except Exception:
            return 0

    def targets_devices(self, obj):
        try:
            return (obj.target_counts or {}).get("devices") or 0
        except Exception:
            return 0


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "title", "channel", "priority", "is_broadcast", "delivered_at", "read_at", "created_at")
    list_filter = ("channel", "priority", "is_broadcast", "read_at")
    search_fields = ("user__username", "title", "body", "deep_link", "provider_message_id")
    autocomplete_fields = ("user", "batch")
    readonly_fields = ("delivered_at", "read_at", "created_at")
