from django.db.models import Count
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework import status

from accounts.models import CustomUser
from .models import Role, Permission, RolePermission
from .serializers_rbac import (
    RoleSerializer,
    PermissionSerializer,
    RolePermissionMapSerializer,
    AdminUserCreateSerializer,
    AdminUserAssignRoleSerializer,
    AdminMeSerializer,
)
from .permissions import IsAdminOrStaff, HasAnyPermission, has_admin_module_access, IsSuperAdmin, MODULE_KEYS


# -------- Admin current user info --------
class AdminMeView(APIView):
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        # Auto-seed RBAC defaults if empty and caller is superuser
        try:
            if getattr(request.user, "is_superuser", False):
                if Permission.objects.count() == 0:
                    # Seed canonical permissions and Super Admin role
                    codes = set([
                        "manage_dashboard",
                        # Users
                        "manage_users", "show_users", "create_users", "edit_users", "delete_users",
                        # Roles
                        "manage_roles", "show_roles", "create_roles", "edit_roles", "delete_roles",
                        # Permissions
                        "manage_permissions", "show_permissions", "create_permissions", "edit_permissions", "delete_permissions",
                    ])
                    # Module-based codes supported by has_admin_module_access
                    try:
                        for mk in MODULE_KEYS:
                            mk = str(mk).strip().lower()
                            if not mk:
                                continue
                            codes.add(mk)
                            codes.add(f"screen_{mk}")
                            codes.add(f"module_{mk}")
                    except Exception:
                        pass
                    existing = set(Permission.objects.values_list("code", flat=True))
                    to_create = [Permission(code=c, label=c.replace("_", " ").title()) for c in sorted(codes) if c not in existing]
                    if to_create:
                        Permission.objects.bulk_create(to_create, ignore_conflicts=True)
                # Ensure a default SUPER role exists
                if not Role.objects.filter(name__iexact="Super Admin").exists():
                    Role.objects.create(name="Super Admin", is_super=True)
        except Exception:
            # best-effort: do not block /me
            pass
        return Response(AdminMeSerializer(request.user).data, status=200)


# -------- Admin Users: GET (list via existing view), POST (create admin) --------
class AdminUsersListCreate(APIView):
    """
    Unifies:
     - GET /api/admin/users/  (delegates to existing AdminUsersList to preserve behavior)
     - POST /api/admin/users/ (create staff admin user with optional RBAC role)
    Security:
     - GET requires any of: manage_users | show_users
     - POST requires: create_users
     - Inactive admins blocked by IsAdminOrStaff; superuser bypasses RBAC
    """
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        # RBAC check (default deny)
        from .permissions import get_effective_permissions
        u = request.user
        if not getattr(u, "is_superuser", False):
            perms = get_effective_permissions(u)
            if "*" not in perms and not (("manage_users" in perms) or ("show_users" in perms)):
                return Response({"detail": "Forbidden"}, status=403)

        # Delegate to existing list view using DRF's as_view to ensure proper initialization
        from .views import AdminUsersList
        django_request = getattr(request, "_request", request)
        return AdminUsersList.as_view()(django_request)

    def post(self, request):
        # RBAC create protection
        from .permissions import get_effective_permissions
        u = request.user
        if not getattr(u, "is_superuser", False):
            perms = get_effective_permissions(u)
            if "*" not in perms and ("create_users" not in perms and "manage_users" not in perms):
                return Response({"detail": "Forbidden"}, status=403)

        ser = AdminUserCreateSerializer(data=request.data)
        if ser.is_valid():
            obj = ser.save()
            return Response(
                {
                    "id": obj.id,
                    "username": obj.username,
                    "email": obj.email,
                    "full_name": obj.full_name,
                    "is_active": obj.is_active,
                    "is_staff": obj.is_staff,
                    "admin_role": ({"id": obj.admin_role_id, "name": getattr(obj.admin_role, "name", None)} if obj.admin_role_id else None),
                },
                status=201,
            )
        return Response(ser.errors, status=400)


class AdminUserActivateView(APIView):
    permission_classes = [IsAdminOrStaff, HasAnyPermission("edit_users", "manage_users")]

    def post(self, request, pk: int):
        user = CustomUser.objects.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found"}, status=404)
        if not user.is_active:
            user.is_active = True
            user.save(update_fields=["is_active"])
        return Response({"id": user.id, "is_active": user.is_active}, status=200)


class AdminUserDeactivateView(APIView):
    permission_classes = [IsAdminOrStaff, HasAnyPermission("edit_users", "manage_users")]

    def post(self, request, pk: int):
        user = CustomUser.objects.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found"}, status=404)
        if user.is_active:
            user.is_active = False
            user.save(update_fields=["is_active"])
        return Response({"id": user.id, "is_active": user.is_active}, status=200)


class AdminUserAssignRoleView(APIView):
    permission_classes = [IsAdminOrStaff, HasAnyPermission("edit_users", "manage_users")]

    def post(self, request, pk: int):
        user = CustomUser.objects.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found"}, status=404)
        ser = AdminUserAssignRoleSerializer(data=request.data, context={"user": user})
        if ser.is_valid():
            ser.save()
            r = user.admin_role
            return Response({"ok": True, "role": ({"id": r.id, "name": r.name} if r else None)}, status=200)
        return Response(ser.errors, status=400)


# -------- Roles --------
class RoleListCreateView(APIView):
    permission_classes = [IsAdminOrStaff, HasAnyPermission("manage_roles", "show_roles", "create_roles")]

    def get(self, request):
        qs = Role.objects.all().annotate(assigned_count=Count("users"))
        data = RoleSerializer(qs, many=True).data
        return Response(data, status=200)

    def post(self, request):
        # create requires create_roles or manage_roles
        from .permissions import get_effective_permissions
        u = request.user
        if not getattr(u, "is_superuser", False):
            perms = get_effective_permissions(u)
            if "*" not in perms and (("create_roles" not in perms) and ("manage_roles" not in perms)):
                return Response({"detail": "Forbidden"}, status=403)
        ser = RoleSerializer(data=request.data)
        if ser.is_valid():
            obj = ser.save()
            return Response(RoleSerializer(obj).data, status=201)
        return Response(ser.errors, status=400)


class RoleDetailView(APIView):
    permission_classes = [IsAdminOrStaff, HasAnyPermission("manage_roles", "edit_roles", "show_roles", "delete_roles")]

    def patch(self, request, pk: int):
        obj = Role.objects.filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Not found"}, status=404)
        # edit requires edit_roles or manage_roles
        from .permissions import get_effective_permissions
        u = request.user
        if not getattr(u, "is_superuser", False):
            perms = get_effective_permissions(u)
            if "*" not in perms and (("edit_roles" not in perms) and ("manage_roles" not in perms)):
                return Response({"detail": "Forbidden"}, status=403)
        ser = RoleSerializer(obj, data=request.data, partial=True)
        if ser.is_valid():
            obj = ser.save()
            return Response(RoleSerializer(obj).data, status=200)
        return Response(ser.errors, status=400)

    def delete(self, request, pk: int):
        obj = Role.objects.filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Not found"}, status=404)
        # delete requires delete_roles or manage_roles
        from .permissions import get_effective_permissions
        u = request.user
        if not getattr(u, "is_superuser", False):
            perms = get_effective_permissions(u)
            if "*" not in perms and (("delete_roles" not in perms) and ("manage_roles" not in perms)):
                return Response({"detail": "Forbidden"}, status=403)
        # block deletion if assigned
        assigned = CustomUser.objects.filter(admin_role_id=obj.id).exists()
        if assigned:
            return Response({"detail": "Cannot delete role: assigned to one or more users."}, status=400)
        obj.delete()
        return Response(status=204)


# -------- Permissions --------
class PermissionListCreateView(APIView):
    permission_classes = [IsAdminOrStaff, HasAnyPermission("manage_permissions", "show_permissions", "create_permissions")]

    def get(self, request):
        qs = Permission.objects.all().order_by("code")
        return Response(PermissionSerializer(qs, many=True).data, status=200)

    def post(self, request):
        # create requires create_permissions or manage_permissions
        from .permissions import get_effective_permissions
        u = request.user
        if not getattr(u, "is_superuser", False):
            perms = get_effective_permissions(u)
            if "*" not in perms and (("create_permissions" not in perms) and ("manage_permissions" not in perms)):
                return Response({"detail": "Forbidden"}, status=403)
        ser = PermissionSerializer(data=request.data)
        if ser.is_valid():
            obj = ser.save()
            return Response(PermissionSerializer(obj).data, status=201)
        return Response(ser.errors, status=400)


class PermissionDetailView(APIView):
    permission_classes = [IsAdminOrStaff, HasAnyPermission("manage_permissions", "edit_permissions", "show_permissions", "delete_permissions")]

    def patch(self, request, pk: int):
        obj = Permission.objects.filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Not found"}, status=404)
        # edit requires edit_permissions or manage_permissions
        from .permissions import get_effective_permissions
        u = request.user
        if not getattr(u, "is_superuser", False):
            perms = get_effective_permissions(u)
            if "*" not in perms and (("edit_permissions" not in perms) and ("manage_permissions" not in perms)):
                return Response({"detail": "Forbidden"}, status=403)
        ser = PermissionSerializer(obj, data=request.data, partial=True)
        if ser.is_valid():
            obj = ser.save()
            return Response(PermissionSerializer(obj).data, status=200)
        return Response(ser.errors, status=400)

    def delete(self, request, pk: int):
        obj = Permission.objects.filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Not found"}, status=404)
        # delete requires delete_permissions or manage_permissions
        from .permissions import get_effective_permissions
        u = request.user
        if not getattr(u, "is_superuser", False):
            perms = get_effective_permissions(u)
            if "*" not in perms and (("delete_permissions" not in perms) and ("manage_permissions" not in perms)):
                return Response({"detail": "Forbidden"}, status=403)
        obj.delete()
        return Response(status=204)


# -------- Role-Permission mapping --------
class RolePermissionsListView(ListAPIView):
    """
    List mapping rows: Role Name | Permission | Date
    """
    permission_classes = [IsAdminOrStaff, HasAnyPermission("manage_roles", "manage_permissions", "show_roles", "show_permissions")]
    serializer_class = RolePermissionMapSerializer

    def get_queryset(self):
        return RolePermission.objects.select_related("role", "permission").order_by("-created_at")

    def post(self, request):
        """
        Also support bulk-assign on the same endpoint as per API spec.
        Body: { "role_id": int, "permission_ids": [int, ...] }
        """
        role_id = request.data.get("role_id")
        ids = request.data.get("permission_ids") or []
        try:
            role_id = int(role_id)
        except Exception:
            return Response({"detail": "role_id must be integer"}, status=400)
        role = Role.objects.filter(id=role_id).first()
        if not role:
            return Response({"detail": "Role not found"}, status=404)
        # validate permission ids
        pids = []
        for x in ids:
            try:
                pids.append(int(x))
            except Exception:
                pass
        existing = set(RolePermission.objects.filter(role=role).values_list("permission_id", flat=True))
        to_create = [pid for pid in pids if pid not in existing]
        objs = [RolePermission(role=role, permission_id=pid) for pid in to_create]
        if objs:
            RolePermission.objects.bulk_create(objs, ignore_conflicts=True)
        return Response({"ok": True, "added": len(objs)}, status=200)


class RolePermissionsBulkAssignView(APIView):
    """
    POST /api/admin/role-permissions/
    Body: { "role_id": int, "permission_ids": [int, ...] }
    Merge-style assign (adds missing, keeps existing). Prefer PUT on /roles/{id}/permissions for replace semantics.
    """
    permission_classes = [IsAdminOrStaff, HasAnyPermission("manage_roles", "manage_permissions")]

    def post(self, request):
        role_id = request.data.get("role_id")
        ids = request.data.get("permission_ids") or []
        try:
            role_id = int(role_id)
        except Exception:
            return Response({"detail": "role_id must be integer"}, status=400)
        role = Role.objects.filter(id=role_id).first()
        if not role:
            return Response({"detail": "Role not found"}, status=404)
        # validate permission ids
        pids = []
        for x in ids:
            try:
                pids.append(int(x))
            except Exception:
                pass
        existing = set(RolePermission.objects.filter(role=role).values_list("permission_id", flat=True))
        to_create = [pid for pid in pids if pid not in existing]
        objs = [RolePermission(role=role, permission_id=pid) for pid in to_create]
        if objs:
            RolePermission.objects.bulk_create(objs, ignore_conflicts=True)
        return Response({"ok": True, "added": len(objs)}, status=200)


class RolePermissionsForRoleView(APIView):
    """
    GET /api/admin/roles/{id}/permissions/  -> list permissions for role
    PUT /api/admin/roles/{id}/permissions/  -> replace permissions set for role (bulk)
    """
    permission_classes = [IsAdminOrStaff, HasAnyPermission("manage_roles", "manage_permissions", "show_roles", "show_permissions")]

    def get(self, request, pk: int):
        role = Role.objects.filter(id=pk).first()
        if not role:
            return Response({"detail": "Role not found"}, status=404)
        rows = RolePermission.objects.select_related("permission").filter(role=role)
        out = [{"id": rp.permission_id, "code": getattr(rp.permission, "code", None)} for rp in rows]
        return Response(out, status=200)

    def put(self, request, pk: int):
        # replace requires manage_roles or manage_permissions
        from .permissions import get_effective_permissions
        u = request.user
        if not getattr(u, "is_superuser", False):
            perms = get_effective_permissions(u)
            if "*" not in perms and (("manage_roles" not in perms) and ("manage_permissions" not in perms)):
                return Response({"detail": "Forbidden"}, status=403)

        role = Role.objects.filter(id=pk).first()
        if not role:
            return Response({"detail": "Role not found"}, status=404)
        ids = request.data or []
        pids = []
        if isinstance(ids, dict) and "permission_ids" in ids:
            ids = ids.get("permission_ids")
        if not isinstance(ids, (list, tuple)):
            return Response({"detail": "Provide a list of permission ids"}, status=400)
        for x in ids:
            try:
                pids.append(int(x))
            except Exception:
                pass
        # Replace set atomically
        RolePermission.objects.filter(role=role).exclude(permission_id__in=pids).delete()
        existing = set(RolePermission.objects.filter(role=role).values_list("permission_id", flat=True))
        to_create = [pid for pid in pids if pid not in existing]
        objs = [RolePermission(role=role, permission_id=pid) for pid in to_create]
        if objs:
            RolePermission.objects.bulk_create(objs, ignore_conflicts=True)
        return Response({"ok": True, "set_count": len(pids)}, status=200)


class AdminPermissionSeedDefaultsView(APIView):
    """
    Seed canonical RBAC permissions and a default SUPER role.
    POST /api/admin/permissions/seed-defaults/
    Security: superuser only.
    """
    permission_classes = [IsAdminOrStaff, IsSuperAdmin]

    def post(self, request):
        # Canonical permissions per naming convention
        codes = set([
            "manage_dashboard",
            # Users
            "manage_users", "show_users", "create_users", "edit_users", "delete_users",
            # Roles
            "manage_roles", "show_roles", "create_roles", "edit_roles", "delete_roles",
            # Permissions
            "manage_permissions", "show_permissions", "create_permissions", "edit_permissions", "delete_permissions",
        ])
        # Module-based codes supported by has_admin_module_access
        try:
            for mk in MODULE_KEYS:
                mk = str(mk).strip().lower()
                if not mk:
                    continue
                codes.add(mk)
                codes.add(f"screen_{mk}")
                codes.add(f"module_{mk}")
        except Exception:
            pass

        existing = set(Permission.objects.values_list("code", flat=True))
        to_create = [Permission(code=c, label=c.replace("_", " ").title()) for c in sorted(codes) if c not in existing]
        if to_create:
            Permission.objects.bulk_create(to_create, ignore_conflicts=True)

        # Ensure a default SUPER role exists
        role_created = False
        if not Role.objects.filter(name__iexact="Super Admin").exists():
            Role.objects.create(name="Super Admin", is_super=True)
            role_created = True

        total_perms = Permission.objects.count()
        return Response(
            {
                "ok": True,
                "created_permissions": len(to_create),
                "total_permissions": total_perms,
                "created_super_role": role_created,
            },
            status=200,
        )
