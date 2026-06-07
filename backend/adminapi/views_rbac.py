from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView

from accounts.models import CustomUser
from accounts.security import (
    GENERIC_OTP_MESSAGE,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    PasswordResetVerifySerializer,
    AdminLoginOTPVerifySerializer,
    request_password_reset_otp,
    request_admin_login_otp,
    reset_password_with_otp,
    verify_admin_login_otp,
    verify_password_reset_otp,
    audit,
    invalidate_user_tokens,
)
from accounts.token_serializers import AdminTokenObtainPairSerializer
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


CANONICAL_PERMISSION_DEFS = [
    ("dashboard.read", "Dashboard", "Read dashboard"),
    ("users.read", "Users", "Read users"),
    ("users.write", "Users", "Create and update users"),
    ("users.delete", "Users", "Delete users"),
    ("roles.read", "Roles", "Read roles"),
    ("roles.manage", "Roles", "Manage roles"),
    ("permissions.read", "Permissions", "Read permissions"),
    ("permissions.manage", "Permissions", "Manage permissions"),
    ("withdrawals.read", "Withdrawals", "Read withdrawals"),
    ("withdrawals.approve", "Withdrawals", "Approve withdrawals"),
    ("wallet.read", "Wallet", "Read wallet data"),
    ("wallet.adjust", "Wallet", "Adjust wallet balances"),
    ("kyc.read", "KYC", "Read KYC"),
    ("kyc.approve", "KYC", "Approve KYC"),
    ("reports.read", "Reports", "Read reports"),
    ("settings.manage", "Settings", "Manage settings"),
    ("support.read", "Support", "Read support tickets"),
    ("support.write", "Support", "Respond to support tickets"),
    ("ecoupons.read", "E-Coupons", "Read e-coupons"),
    ("ecoupons.write", "E-Coupons", "Manage e-coupons"),
    ("promo.read", "Promo", "Read promo/package approvals"),
    ("promo.approve", "Promo", "Approve promo/package requests"),
    ("autopool.read", "Autopool", "Read autopool data"),
    ("commissions.read", "Commissions", "Read commissions"),
    ("commissions.manage", "Commissions", "Manage commissions"),
]


def seed_canonical_permissions():
    existing = set(Permission.objects.values_list("code", flat=True))
    objs = []
    for code, module, name in CANONICAL_PERMISSION_DEFS:
        if code not in existing:
            objs.append(Permission(code=code, module=module, name=name, label=name))
    if objs:
        Permission.objects.bulk_create(objs, ignore_conflicts=True)
    role, created = Role.objects.get_or_create(
        name="Super Admin",
        defaults={"is_super": True, "is_system": True, "description": "Full administrative access."},
    )
    if not role.is_super or not role.is_system:
        role.is_super = True
        role.is_system = True
        role.save(update_fields=["is_super", "is_system", "updated_at"])
    return len(objs), created


class AdminTokenObtainPairView(TokenObtainPairView):
    serializer_class = AdminTokenObtainPairSerializer


class AdminLoginOTPRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = PasswordResetRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        request_admin_login_otp(request, ser.get_identifier())
        return Response({"message": "If the admin account exists, OTP has been sent."}, status=status.HTTP_200_OK)


class AdminLoginOTPVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = AdminLoginOTPVerifySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = verify_admin_login_otp(request, ser.get_identifier(), ser.validated_data.get("otp"))
        if not user:
            return Response({"detail": "Invalid or expired OTP."}, status=status.HTTP_400_BAD_REQUEST)
        refresh = AdminTokenObtainPairSerializer.get_token(user)
        return Response({"refresh": str(refresh), "access": str(refresh.access_token)}, status=status.HTTP_200_OK)


class AdminPasswordResetOTPRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = PasswordResetRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        request_password_reset_otp(request, CustomUser.IDENTITY_ADMIN, ser.get_identifier())
        return Response({"message": GENERIC_OTP_MESSAGE}, status=status.HTTP_200_OK)


class AdminPasswordResetOTPVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = PasswordResetVerifySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ok = verify_password_reset_otp(request, CustomUser.IDENTITY_ADMIN, ser.get_identifier(), ser.validated_data.get("otp"))
        return Response({"verified": bool(ok)}, status=status.HTTP_200_OK if ok else status.HTTP_400_BAD_REQUEST)


class AdminPasswordResetOTPConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from django.core.exceptions import ValidationError as DjangoValidationError
        ser = PasswordResetConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            ok = reset_password_with_otp(
                request,
                CustomUser.IDENTITY_ADMIN,
                ser.get_identifier(),
                ser.validated_data.get("otp"),
                ser.validated_data.get("new_password"),
            )
        except DjangoValidationError as exc:
            return Response({"detail": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        if not ok:
            return Response({"detail": "Invalid or expired OTP."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"message": "Password reset successful."}, status=status.HTTP_200_OK)


# -------- Admin current user info --------
class AdminMeView(APIView):
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        # Auto-seed RBAC defaults if empty and caller is superuser
        try:
            if getattr(request.user, "is_superuser", False):
                seed_canonical_permissions()
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

    def _list_staff_admins(self, request):
        search = (request.query_params.get("search") or "").strip()
        try:
            page = max(1, int(request.query_params.get("page") or 1))
        except Exception:
            page = 1
        try:
            page_size = min(200, max(1, int(request.query_params.get("page_size") or 50)))
        except Exception:
            page_size = 50

        qs = (
            CustomUser.objects
            .select_related("admin_role")
            .prefetch_related("admin_roles")
            .filter(is_staff=True, identity_type=CustomUser.IDENTITY_ADMIN)
            .only(
                "id",
                "username",
                "email",
                "full_name",
                "is_active",
                "is_staff",
                "is_superuser",
                "date_joined",
                "admin_role",
                "identity_type",
            )
            .order_by("-date_joined", "-id")
        )
        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(full_name__icontains=search)
                | Q(email__icontains=search)
            )

        count = qs.count()
        start = (page - 1) * page_size
        rows = []
        for obj in qs[start:start + page_size]:
            roles = list(getattr(obj, "admin_roles", Role.objects.none()).all())
            primary = getattr(obj, "admin_role", None)
            if primary and all(r.id != primary.id for r in roles):
                roles.insert(0, primary)
            rows.append({
                "id": obj.id,
                "username": obj.username,
                "email": obj.email,
                "full_name": obj.full_name,
                "is_active": obj.is_active,
                "is_staff": obj.is_staff,
                "is_superuser": obj.is_superuser,
                "identity_type": obj.identity_type,
                "date_joined": obj.date_joined,
                "admin_role": (
                    {"id": primary.id, "name": primary.name, "is_super": bool(primary.is_super)}
                    if primary else None
                ),
                "admin_roles": [{"id": r.id, "name": r.name, "is_super": bool(r.is_super)} for r in roles],
            })
        return Response({"count": count, "results": rows}, status=200)

    def get(self, request):
        # RBAC check (default deny)
        from .permissions import get_effective_permissions
        u = request.user
        if not getattr(u, "is_superuser", False):
            perms = get_effective_permissions(u)
            if "*" not in perms and not (("manage_users" in perms) or ("show_users" in perms)):
                return Response({"detail": "Forbidden"}, status=403)

        staff_only = str(request.query_params.get("staff") or request.query_params.get("admin_only") or "").lower()
        if staff_only in ("1", "true", "yes"):
            return self._list_staff_admins(request)

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

        ser = AdminUserCreateSerializer(data=request.data, context={"request": request})
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
        before = {"is_active": bool(user.is_active)}
        if not user.is_active:
            user.is_active = True
            user.save(update_fields=["is_active"])
            invalidate_user_tokens(user)
            audit("user.access.activate", request=request, actor_user=request.user, resource_type="user", resource_id=user.id, before=before, after={"is_active": True})
        return Response({"id": user.id, "is_active": user.is_active}, status=200)


class AdminUserDeactivateView(APIView):
    permission_classes = [IsAdminOrStaff, HasAnyPermission("edit_users", "manage_users")]

    def post(self, request, pk: int):
        user = CustomUser.objects.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found"}, status=404)
        before = {"is_active": bool(user.is_active)}
        if user.is_active:
            user.is_active = False
            user.save(update_fields=["is_active"])
            invalidate_user_tokens(user)
            audit("user.access.deactivate", request=request, actor_user=request.user, resource_type="user", resource_id=user.id, before=before, after={"is_active": False})
        return Response({"id": user.id, "is_active": user.is_active}, status=200)


class AdminUserAssignRoleView(APIView):
    permission_classes = [IsAdminOrStaff, HasAnyPermission("edit_users", "manage_users")]

    def post(self, request, pk: int):
        user = CustomUser.objects.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found"}, status=404)
        ser = AdminUserAssignRoleSerializer(data=request.data, context={"user": user, "request": request})
        if ser.is_valid():
            before = {"admin_role_id": user.admin_role_id}
            ser.save()
            invalidate_user_tokens(user)
            audit("role.change", request=request, actor_user=request.user, resource_type="user", resource_id=user.id, before=before, after={"admin_role_id": user.admin_role_id})
            r = user.admin_role
            return Response({"ok": True, "role": ({"id": r.id, "name": r.name} if r else None)}, status=200)
        return Response(ser.errors, status=400)


# -------- Roles --------
class RoleListCreateView(APIView):
    permission_classes = [IsAdminOrStaff, HasAnyPermission("manage_roles", "show_roles", "create_roles")]

    def get(self, request):
        qs = Role.objects.all().annotate(assigned_count=Count("users"))
        data = RoleSerializer(qs, many=True, context={"request": request}).data
        return Response(data, status=200)

    def post(self, request):
        # create requires create_roles or manage_roles
        from .permissions import get_effective_permissions
        u = request.user
        if not getattr(u, "is_superuser", False):
            perms = get_effective_permissions(u)
            if "*" not in perms and (("create_roles" not in perms) and ("manage_roles" not in perms)):
                return Response({"detail": "Forbidden"}, status=403)
        ser = RoleSerializer(data=request.data, context={"request": request})
        if ser.is_valid():
            obj = ser.save()
            return Response(RoleSerializer(obj, context={"request": request}).data, status=201)
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
        ser = RoleSerializer(obj, data=request.data, partial=True, context={"request": request})
        if ser.is_valid():
            before = RoleSerializer(obj).data
            obj = ser.save()
            audit("role.change", request=request, actor_user=request.user, resource_type="role", resource_id=obj.id, before=before, after=RoleSerializer(obj, context={"request": request}).data)
            return Response(RoleSerializer(obj, context={"request": request}).data, status=200)
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
        for user in CustomUser.objects.filter(admin_role_id=role.id):
            invalidate_user_tokens(user)
        for user in CustomUser.objects.filter(admin_role_links__role_id=role.id).distinct():
            invalidate_user_tokens(user)
        audit("permission.change", request=request, actor_user=request.user, resource_type="role", resource_id=role.id, after={"permission_ids": pids})
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
        for user in CustomUser.objects.filter(admin_role_id=role.id):
            invalidate_user_tokens(user)
        for user in CustomUser.objects.filter(admin_role_links__role_id=role.id).distinct():
            invalidate_user_tokens(user)
        audit("permission.change", request=request, actor_user=request.user, resource_type="role", resource_id=role.id, after={"permission_ids": pids})
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
        for user in CustomUser.objects.filter(admin_role_id=role.id):
            invalidate_user_tokens(user)
        for user in CustomUser.objects.filter(admin_role_links__role_id=role.id).distinct():
            invalidate_user_tokens(user)
        audit("permission.change", request=request, actor_user=request.user, resource_type="role", resource_id=role.id, after={"permission_ids": pids})
        return Response({"ok": True, "set_count": len(pids)}, status=200)


class AdminPermissionSeedDefaultsView(APIView):
    """
    Seed canonical RBAC permissions and a default SUPER role.
    POST /api/admin/permissions/seed-defaults/
    Security: superuser only.
    """
    permission_classes = [IsAdminOrStaff, IsSuperAdmin]

    def post(self, request):
        created_count, role_created = seed_canonical_permissions()

        total_perms = Permission.objects.count()
        return Response(
            {
                "ok": True,
                "created_permissions": created_count,
                "total_permissions": total_perms,
                "created_super_role": role_created,
            },
            status=200,
        )
