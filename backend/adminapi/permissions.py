from rest_framework.permissions import BasePermission


class IsAdminOrStaff(BasePermission):
    """
    Allows access only to admin users (is_superuser) or staff (is_staff).
    """
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return bool(user.is_superuser or user.is_staff)
