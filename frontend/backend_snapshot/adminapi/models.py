from django.db import models
from django.utils import timezone


class Role(models.Model):
    """
    Admin RBAC Role.
    - name: unique human-readable name (e.g., "Admin", "Super Admin")
    - is_super: role with implicit access to all permissions (bypass)
    """
    name = models.CharField(max_length=100, unique=True, db_index=True)
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
