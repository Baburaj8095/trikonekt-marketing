from rest_framework import serializers
from .models import Notification, DeviceToken


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "title",
            "body",
            "deep_link",
            "priority",
            "pinned_until",
            "delivered_at",
            "read_at",
            "created_at",
            "channel",
            "is_broadcast",
            "batch",
            "is_read",
        ]
        read_only_fields = fields

    def get_is_read(self, obj):
        try:
            return bool(getattr(obj, "read_at", None))
        except Exception:
            return False


class DeviceTokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=500)
    platform = serializers.ChoiceField(choices=[("web", "Web"), ("android", "Android"), ("ios", "iOS")], default="web")
    provider = serializers.ChoiceField(choices=[("fcm", "Firebase Cloud Messaging"), ("onesignal", "OneSignal")], default="fcm")
    subscribed = serializers.BooleanField(required=False, default=True)
    app_version = serializers.CharField(required=False, allow_blank=True, default="")
