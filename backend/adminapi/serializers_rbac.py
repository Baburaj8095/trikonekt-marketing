from rest_framework import serializers
from django.db import transaction
from accounts.models import CustomUser
from .models import Role, Permission, RolePermission


class RoleSerializer(serializers.ModelSerializer):
    assigned_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Role
        fields = ["id", "name", "is_super", "created_at", "updated_at", "assigned_count"]
        read_only_fields = ["id", "created_at", "updated_at", "assigned_count"]


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "code", "label", "created_at"]
        read_only_fields = ["id", "created_at"]


class RolePermissionMapSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source="role.name", read_only=True)
    permission_code = serializers.CharField(source="permission.code", read_only=True)

    class Meta:
        model = RolePermission
        fields = ["id", "role", "role_name", "permission", "permission_code", "created_at"]
        read_only_fields = ["id", "role_name", "permission_code", "created_at"]


class AdminUserCreateSerializer(serializers.ModelSerializer):
    """
    Create admin/staff user with optional role assignment.
    Request fields:
      - username (required, unique)
      - password (required, min 8)
      - email, full_name (optional)
      - is_active (optional, default True)
      - role_id (optional, adminapi.Role id)
    """
    password = serializers.CharField(write_only=True, min_length=8)
    role_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = CustomUser
        fields = ["id", "username", "email", "full_name", "password", "is_active", "role_id"]
        read_only_fields = ["id"]

    @transaction.atomic
    def create(self, validated_data):
        role_id = validated_data.pop("role_id", None)
        password = validated_data.pop("password")
        # Always create as staff for admin access (not superuser)
        user = CustomUser.objects.create(is_staff=True, **validated_data)
        user.set_password(password)
        user.save(update_fields=["password"])
        # Optional RBAC role assignment
        if role_id:
            try:
                r = Role.objects.get(pk=role_id)
                user.admin_role = r
                user.save(update_fields=["admin_role"])
            except Role.DoesNotExist:
                raise serializers.ValidationError({"role_id": "Role not found"})
        return user


class AdminUserAssignRoleSerializer(serializers.Serializer):
    role_id = serializers.IntegerField(allow_null=True, required=True)

    def validate(self, attrs):
        role_id = attrs.get("role_id")
        if role_id is None:
            return attrs
        if not Role.objects.filter(id=role_id).exists():
            raise serializers.ValidationError({"role_id": "Role not found"})
        return attrs

    @transaction.atomic
    def save(self, **kwargs):
        user: CustomUser = self.context["user"]
        role_id = self.validated_data.get("role_id")
        if role_id is None:
            user.admin_role = None
        else:
            user.admin_role_id = role_id
        user.save(update_fields=["admin_role"])
        return user


class AdminMeSerializer(serializers.Serializer):
    """
    Lightweight serializer for /api/admin/me/
    """
    user = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    def get_user(self, obj):
        u = obj
        return {
            "id": getattr(u, "id", None),
            "username": getattr(u, "username", None),
            "email": getattr(u, "email", None),
            "full_name": getattr(u, "full_name", None),
            "is_active": bool(getattr(u, "is_active", False)),
            "is_staff": bool(getattr(u, "is_staff", False)),
            "is_superuser": bool(getattr(u, "is_superuser", False)),
        }

    def get_role(self, obj):
        u = obj
        r = getattr(u, "admin_role", None)
        if not r:
            return None
        return {"id": getattr(r, "id", None), "name": getattr(r, "name", None), "is_super": bool(getattr(r, "is_super", False))}

    def get_permissions(self, obj):
        from .permissions import get_effective_permissions
        p = get_effective_permissions(obj)
        if "*" in p:
            # Super admin: return union of all existing codes (so FE can hide correctly)
            codes = list(Permission.objects.values_list("code", flat=True))
            return sorted(set([str(c) for c in codes]))
        return sorted(list(p))
