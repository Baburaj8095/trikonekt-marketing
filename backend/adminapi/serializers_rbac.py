from rest_framework import serializers
from django.db import transaction
from accounts.models import CustomUser
from .models import Role, Permission, RolePermission, UserRole


class RoleSerializer(serializers.ModelSerializer):
    assigned_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Role
        fields = ["id", "name", "description", "is_system", "is_super", "created_at", "updated_at", "assigned_count"]
        read_only_fields = ["id", "created_at", "updated_at", "assigned_count"]

    def validate_is_super(self, value):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if value and not getattr(user, "is_superuser", False):
            raise serializers.ValidationError("Only a Django superuser can create or edit Super Admin roles.")
        return value


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "code", "name", "module", "label", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_code(self, value):
        value = str(value or "").strip().lower()
        if "." not in value:
            raise serializers.ValidationError("Use resource.action naming, for example users.read.")
        return value


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
    role_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)

    class Meta:
        model = CustomUser
        fields = ["id", "username", "email", "full_name", "password", "is_active", "role_id", "role_ids"]
        read_only_fields = ["id"]

    def _assert_super_role_allowed(self, role_ids):
        role_ids = [int(x) for x in role_ids if x]
        if not role_ids:
            return
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        if getattr(actor, "is_superuser", False):
            return
        if Role.objects.filter(id__in=role_ids, is_super=True).exists():
            raise serializers.ValidationError({"role_id": "Only a Django superuser can assign Super Admin roles."})

    def validate(self, attrs):
        role_ids = []
        if attrs.get("role_id"):
            role_ids.append(attrs.get("role_id"))
        role_ids.extend(attrs.get("role_ids") or [])
        self._assert_super_role_allowed(role_ids)
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        role_id = validated_data.pop("role_id", None)
        role_ids = validated_data.pop("role_ids", [])
        password = validated_data.pop("password")
        # Always create as staff for admin access (not superuser)
        user = CustomUser.objects.create(is_staff=True, identity_type=CustomUser.IDENTITY_ADMIN, **validated_data)
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
        valid_role_ids = list({int(x) for x in role_ids or []})
        if valid_role_ids:
            existing = set(Role.objects.filter(id__in=valid_role_ids).values_list("id", flat=True))
            missing = set(valid_role_ids) - existing
            if missing:
                raise serializers.ValidationError({"role_ids": f"Invalid role ids: {sorted(missing)}"})
            UserRole.objects.bulk_create([UserRole(user=user, role_id=rid) for rid in existing], ignore_conflicts=True)
        return user


class AdminUserAssignRoleSerializer(serializers.Serializer):
    role_id = serializers.IntegerField(allow_null=True, required=True)
    role_ids = serializers.ListField(child=serializers.IntegerField(), required=False)

    def validate(self, attrs):
        role_id = attrs.get("role_id")
        role_ids = attrs.get("role_ids") or []
        ids_to_check = []
        if role_id is not None:
            ids_to_check.append(role_id)
        ids_to_check.extend(role_ids)
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        if ids_to_check and not getattr(actor, "is_superuser", False):
            if Role.objects.filter(id__in=ids_to_check, is_super=True).exists():
                raise serializers.ValidationError({"role_id": "Only a Django superuser can assign Super Admin roles."})
        if role_id is None:
            return attrs
        if not Role.objects.filter(id=role_id).exists():
            raise serializers.ValidationError({"role_id": "Role not found"})
        if role_ids:
            existing = set(Role.objects.filter(id__in=role_ids).values_list("id", flat=True))
            missing = set(role_ids) - existing
            if missing:
                raise serializers.ValidationError({"role_ids": f"Invalid role ids: {sorted(missing)}"})
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
        role_ids = self.validated_data.get("role_ids", None)
        if role_ids is not None:
            UserRole.objects.filter(user=user).delete()
            UserRole.objects.bulk_create([UserRole(user=user, role_id=rid) for rid in set(role_ids)], ignore_conflicts=True)
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
        roles = list(getattr(u, "admin_roles", Role.objects.none()).all())
        r = getattr(u, "admin_role", None)
        if r and all(getattr(x, "id", None) != getattr(r, "id", None) for x in roles):
            roles.append(r)
        if not roles:
            return None
        primary = roles[0]
        return {
            "id": getattr(primary, "id", None),
            "name": getattr(primary, "name", None),
            "is_super": bool(getattr(primary, "is_super", False)),
            "roles": [{"id": x.id, "name": x.name, "is_super": bool(x.is_super)} for x in roles],
        }

    def get_permissions(self, obj):
        from .permissions import get_effective_permissions
        p = get_effective_permissions(obj)
        if "*" in p:
            # Super admin: return union of all existing codes (so FE can hide correctly)
            codes = list(Permission.objects.values_list("code", flat=True))
            return sorted(set([str(c) for c in codes]))
        return sorted(list(p))
