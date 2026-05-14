from django.db import models
from django.utils import timezone


class Role(models.Model):
    """
    Admin RBAC Role.
    - name: unique human-readable name (e.g., "Admin", "Super Admin")
    - is_super: role with implicit access to all permissions (bypass)
    """
    name = models.CharField(max_length=100, unique=True, db_index=True)
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=False, db_index=True)
    is_super = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["is_super"]),
        ]

    def __str__(self) -> str:
        return f"{self.name}{' (SUPER)' if self.is_super else ''}"


class Permission(models.Model):
    """
    Admin RBAC Permission.
    - code: unique machine name (e.g., 'manage_users', 'show_users', 'create_users', ...)
    - label: optional human-readable label
    """
    code = models.CharField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=150, blank=True)
    module = models.CharField(max_length=80, blank=True, db_index=True)
    label = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code"]

    def __str__(self) -> str:
        return self.code


class RolePermission(models.Model):
    """
    Mapping between Role and Permission.
    Unique per (role, permission).
    """
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name="permission_roles")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("role", "permission"),)
        indexes = [
            models.Index(fields=["role", "permission"]),
        ]

    def __str__(self) -> str:
        return f"{getattr(self.role, 'name', self.role_id)} -> {getattr(self.permission, 'code', self.permission_id)}"


class UserRole(models.Model):
    """
    Mapping between admin users and RBAC roles.
    Kept separate from CustomUser.admin_role so existing screens keep working while
    new sub-admins can receive one or more roles.
    """
    user = models.ForeignKey('accounts.CustomUser', on_delete=models.CASCADE, related_name='admin_role_links')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='user_role_links')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "adminapi_user_roles"
        unique_together = (("user", "role"),)
        indexes = [
            models.Index(fields=["user", "role"]),
        ]

    def __str__(self) -> str:
        return f"{getattr(self.user, 'username', self.user_id)} -> {getattr(self.role, 'name', self.role_id)}"
