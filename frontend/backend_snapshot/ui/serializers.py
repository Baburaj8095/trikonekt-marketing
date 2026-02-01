from rest_framework import serializers
from .models import UIPageConfig


class UIPageConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = UIPageConfig
        fields = [
            "id",
            "key",
            "title",
            "is_active",
            "version",
            "config",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_config(self, value):
        # Delegate to model.clean() by assigning and calling full_clean in create/update
        if value is None or not isinstance(value, dict):
            raise serializers.ValidationError("config must be a dict")
        if "sections" not in value or not isinstance(value.get("sections"), list):
            raise serializers.ValidationError("config.sections must be a list")
        return value

    def create(self, validated_data):
        obj = UIPageConfig(**validated_data)
        obj.full_clean()
        obj.save()
        return obj

    def update(self, instance, validated_data):
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.full_clean()
        instance.save()
        return instance
