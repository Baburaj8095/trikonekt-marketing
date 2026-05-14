from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied

# Canonical module keys (authoritative)
MODULE_KEYS = [
    "users",
    "ecoupons",
    "promo",
    "kyc",
    "withdrawals",
    "support",
    "autopool",
    "commissions",
    "reports_basic",
    "reports_finance",
]

MODULE_PERMISSION_MAP = {
    "users": ("users.read",),
    "ecoupons": ("ecoupons.read",),
    "promo": ("promo.read",),
    "kyc": ("kyc.read",),
    "withdrawals": ("withdrawals.read",),
    "support": ("support.read",),
    "autopool": ("autopool.read",),
    "commissions": ("commissions.read",),
    "reports_basic": ("reports.read",),
    "reports_finance": ("wallet.read", "reports.read"),
}

LEGACY_PERMISSION_ALIASES = {
    "manage_dashboard": ("dashboard.read",),
    "manage_users": ("users.read", "users.write"),
    "show_users": ("users.read",),
    "create_users": ("users.write",),
    "edit_users": ("users.write",),
    "delete_users": ("users.delete",),
    "manage_roles": ("roles.manage",),
    "show_roles": ("roles.read",),
    "create_roles": ("roles.manage",),
    "edit_roles": ("roles.manage",),
    "delete_roles": ("roles.manage",),
    "manage_permissions": ("permissions.manage",),
    "show_permissions": ("permissions.read",),
    "create_permissions": ("permissions.manage",),
    "edit_permissions": ("permissions.manage",),
    "delete_permissions": ("permissions.manage",),
}

def _perm_codename(module_key: str) -> str:
    return f"adminapi.access_{module_key}".strip()


def has_admin_module_access(user, module_key: str) -> bool:
    """
    Module access helper (default-deny).
    Rules:
    - Superuser: allow
    - Staff: allow if any of:
        • Django perm "adminapi.access_<module>"
        • RBAC codes: "screen_<module>", "module_<module>", or "<module>"
        • RBAC wildcard "*" via role.is_super
    - Others: deny
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    if not getattr(user, "is_staff", False):
        return False
    # Path 1: Django permission
    try:
        if user.has_perm(_perm_codename(module_key)):
            return True
    except Exception:
        pass
    # Path 2: RBAC permission codes
    try:
        perms = get_effective_permissions(user)
        if "*" in perms:
            return True
        mk = str(module_key).strip().lower()
        wanted = {mk, f"screen_{mk}", f"module_{mk}", *MODULE_PERMISSION_MAP.get(mk, ())}
        return any(code in perms for code in wanted)
    except Exception:
        return False


class IsAdminOrStaff(BasePermission):
    """
    Allows access only to admin users (is_superuser) or staff (is_staff).
    Additionally enforces inactive users cannot access any admin API.
    """
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        # Non-negotiable: inactive users cannot access any admin API
        if not bool(getattr(user, "is_active", False)):
            return False
        return bool(getattr(user, "is_superuser", False) or getattr(user, "is_staff", False))


class IsSuperAdmin(BasePermission):
    """
    Allows access only to superusers.
    """
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and getattr(user, "is_authenticated", False) and getattr(user, "is_superuser", False))


def HasAdminModuleAccess(module_key: str):
    """
    Factory for a DRF permission class that enforces module-wise access.
    Usage: permission_classes = [IsAdminOrStaff, HasAdminModuleAccess("users")]
    """
    class _ModuleAccess(BasePermission):
        message = "You do not have access to this admin module."

        def has_permission(self, request, view):
            try:
                return has_admin_module_access(getattr(request, "user", None), module_key)
            except Exception:
                return False

    _ModuleAccess.__name__ = f"HasAdminModuleAccess_{module_key}"
    return _ModuleAccess


# ======= RBAC (Role/Permission) helpers and DRF permission =======

def get_effective_permissions(user) -> set[str]:
    """
    Return the set of RBAC permission codes granted to the given user via admin_role.
    Superusers implicitly have all permissions (represented by a special marker '*').
    """
    try:
        if not user or not getattr(user, "is_authenticated", False):
            return set()
        if getattr(user, "is_superuser", False):
            return {"*"}
        # Local import to avoid circulars at import time
        from .models import RolePermission, UserRole
        role_ids = set()
        legacy_role = getattr(user, "admin_role", None)
        if legacy_role:
            if getattr(legacy_role, "is_super", False):
                return {"*"}
            role_ids.add(getattr(legacy_role, "id", None))
        role_ids.update(UserRole.objects.filter(user_id=getattr(user, "id", None)).values_list("role_id", flat=True))
        role_ids.discard(None)
        if not role_ids:
            return set()
        from .models import Role
        if Role.objects.filter(id__in=role_ids, is_super=True).exists():
            return {"*"}
        rows = RolePermission.objects.select_related("permission").filter(role_id__in=role_ids)
        codes = set()
        for r in rows:
            try:
                code = getattr(getattr(r, "permission", None), "code", None)
                if code:
                    codes.add(str(code))
                    for alias in LEGACY_PERMISSION_ALIASES.get(str(code), ()):
                        codes.add(alias)
                    for legacy, canonical in LEGACY_PERMISSION_ALIASES.items():
                        if str(code) in canonical:
                            codes.add(legacy)
            except Exception:
                pass
        return codes
    except Exception:
        return set()


def HasAnyPermission(*required_codes: str):
    """
    Factory for a DRF permission class that enforces RBAC permission codes (any-of).
    Usage:
        permission_classes = [IsAdminOrStaff, HasAnyPermission("manage_users", "show_users")]
    Rules:
      - Default deny if missing
      - Super Admin (Django is_superuser) or role.is_super -> allow
      - Inactive users blocked by IsAdminOrStaff above
    """
    req = tuple([str(c).strip() for c in required_codes if str(c).strip()])

    class _RBACAny(BasePermission):
        message = "You do not have the required permission to access this resource."

        def has_permission(self, request, view):
            user = getattr(request, "user", None)
            if not user or not getattr(user, "is_authenticated", False):
                return False
            if getattr(user, "is_superuser", False):
                return True
            perms = get_effective_permissions(user)
            if "*" in perms:
                return True
            if not req:
                return False
            # any-of
            expanded_req = set(req)
            for c in req:
                expanded_req.update(LEGACY_PERMISSION_ALIASES.get(c, ()))
                for legacy, canonical in LEGACY_PERMISSION_ALIASES.items():
                    if c in canonical:
                        expanded_req.add(legacy)
            for c in expanded_req:
                if c in perms:
                    return True
            return False

    _RBACAny.__name__ = "HasAnyPermission_" + "_or_".join([c.replace(" ", "_") for c in req]) if req else "HasAnyPermission_EMPTY"
    return _RBACAny


def require_permission(*required_codes: str):
    """
    Function/method decorator for non-ViewSet admin actions.
    Usage:
        @require_permission("withdrawals.approve")
        def post(self, request, ...):
            ...
    """
    def _decorator(func):
        def _wrapped(self, request, *args, **kwargs):
            checker = HasAnyPermission(*required_codes)()
            if not checker.has_permission(request, self):
                raise PermissionDenied("You do not have the required permission to access this resource.")
            return func(self, request, *args, **kwargs)
        return _wrapped
    return _decorator
