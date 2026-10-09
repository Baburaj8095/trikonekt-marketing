import os
import re
import sys

rbac_file = "/srv/trikonekt/staging/backend/adminapi/views_rbac.py"

with open(rbac_file, "r", encoding="utf-8") as f:
    code = f.read()

new_classes = '''
class AdminUsersListCreate(APIView):
    permission_classes = [IsAdminOrStaff]

    def _list_staff_admins(self, request):
        search = (request.query_params.get("search") or "").strip().lower()
        from django.db import connection
        with connection.cursor() as cur:
            query = """
                SELECT u.id, u.username, u.email, u.full_name, u.phone, u.role, u.is_superuser, u.is_active, u.created_at, u.last_login, COALESCE(t.is_enabled, FALSE) AS totp_enabled
                FROM accounts_admin_portal_user u
                LEFT JOIN accounts_admin_totp t ON LOWER(u.username) = LOWER(t.username)
            """
            params = []
            if search:
                query += " WHERE LOWER(u.username) LIKE %s OR LOWER(u.full_name) LIKE %s OR LOWER(u.email) LIKE %s OR u.phone LIKE %s"
                s = f"%{search}%"
                params = [s, s, s, s]
            query += " ORDER BY u.id ASC;"
            cur.execute(query, params)
            rows = cur.fetchall()
            results = []
            for r in rows:
                is_super = bool(r[6] or str(r[5]).lower() in ("super_admin", "super admin"))
                results.append({
                    "id": r[0],
                    "username": r[1],
                    "email": r[2] or "",
                    "full_name": r[3] or r[1],
                    "phone": r[4] or "",
                    "role": r[5] or "Super Admin",
                    "is_superuser": is_super,
                    "is_staff": True,
                    "is_active": bool(r[7]),
                    "date_joined": r[8],
                    "created_at": r[8],
                    "last_login": r[9],
                    "totp_enabled": bool(r[10]),
                    "admin_role": {
                        "id": 1 if is_super else 2,
                        "name": "Super Admin" if is_super else (r[5] or "Admin"),
                        "is_super": is_super,
                    },
                    "admin_roles": [{
                        "id": 1 if is_super else 2,
                        "name": "Super Admin" if is_super else (r[5] or "Admin"),
                        "is_super": is_super,
                    }],
                })
        return Response({"count": len(results), "results": results}, status=200)

    def get(self, request):
        staff_only = str(request.query_params.get("staff") or request.query_params.get("admin_only") or "").lower()
        if staff_only in ("1", "true", "yes"):
            return self._list_staff_admins(request)

        from .views import AdminUsersList
        v = AdminUsersList()
        v.request = request
        v.args = getattr(request, "parser_context", {}).get("args", ()) if hasattr(request, "parser_context") else ()
        v.kwargs = getattr(request, "parser_context", {}).get("kwargs", {}) if hasattr(request, "parser_context") else {}
        v.format_kwarg = None
        return v.list(request)

    def post(self, request):
        from django.contrib.auth.hashers import make_password
        from django.db import connection
        username = (request.data.get("username") or "").strip().lower()
        password = (request.data.get("password") or "").strip()
        full_name = (request.data.get("full_name") or "").strip()
        email = (request.data.get("email") or "").strip()
        phone = (request.data.get("phone") or "").strip()
        role = (request.data.get("role") or "Super Admin").strip()
        is_super = bool(request.data.get("is_superuser", True))

        if not username:
            return Response({"username": ["Username is required."]}, status=400)
        if not password or len(password) < 8:
            return Response({"password": ["Password must be at least 8 characters."]}, status=400)

        hashed_pw = make_password(password)
        with connection.cursor() as cur:
            cur.execute("SELECT id FROM accounts_admin_portal_user WHERE LOWER(username) = %s;", [username])
            if cur.fetchone():
                return Response({"username": ["An admin with that username already exists."]}, status=400)

            cur.execute(
                """
                INSERT INTO accounts_admin_portal_user (username, password_hash, full_name, email, phone, role, is_superuser, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE)
                RETURNING id, username, full_name, email, phone, role, is_superuser, is_active, created_at;
                """,
                [username, hashed_pw, full_name or username, email, phone, role, is_super]
            )
            r = cur.fetchone()

        return Response({
            "id": r[0],
            "username": r[1],
            "full_name": r[2],
            "email": r[3],
            "phone": r[4],
            "role": r[5],
            "is_superuser": r[6],
            "is_staff": True,
            "is_active": r[7],
            "date_joined": r[8],
            "admin_role": {"id": 1 if r[6] else 2, "name": r[5], "is_super": r[6]},
        }, status=201)


class AdminUserActivateView(APIView):
    permission_classes = [IsAdminOrStaff]

    def post(self, request, pk: int):
        from django.db import connection
        with connection.cursor() as cur:
            cur.execute("UPDATE accounts_admin_portal_user SET is_active = TRUE WHERE id = %s RETURNING id;", [pk])
            if cur.fetchone():
                return Response({"id": pk, "is_active": True}, status=200)

        user = CustomUser.objects.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found"}, status=404)
        if not user.is_active:
            user.is_active = True
            user.save(update_fields=["is_active"])
        return Response({"id": user.id, "is_active": user.is_active}, status=200)


class AdminUserDeactivateView(APIView):
    permission_classes = [IsAdminOrStaff]

    def post(self, request, pk: int):
        from django.db import connection
        with connection.cursor() as cur:
            cur.execute("UPDATE accounts_admin_portal_user SET is_active = FALSE WHERE id = %s RETURNING id;", [pk])
            if cur.fetchone():
                return Response({"id": pk, "is_active": False}, status=200)

        user = CustomUser.objects.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found"}, status=404)
        if user.is_active:
            user.is_active = False
            user.save(update_fields=["is_active"])
        return Response({"id": user.id, "is_active": user.is_active}, status=200)


class AdminUserAssignRoleView(APIView):
    permission_classes = [IsAdminOrStaff]

    def post(self, request, pk: int):
        role_id = request.data.get("role_id")
        role_name = request.data.get("role_name") or ("Super Admin" if role_id == 1 else "Custom Admin")
        from django.db import connection
        with connection.cursor() as cur:
            cur.execute("UPDATE accounts_admin_portal_user SET role = %s, is_superuser = %s WHERE id = %s RETURNING id, role, is_superuser;", [role_name, role_id == 1, pk])
            r = cur.fetchone()
            if r:
                return Response({"ok": True, "role": {"id": 1 if r[2] else 2, "name": r[1], "is_super": r[2]}}, status=200)

        user = CustomUser.objects.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found"}, status=404)
        ser = AdminUserAssignRoleSerializer(data=request.data, context={"user": user, "request": request})
        if ser.is_valid():
            ser.save()
            r = user.admin_role
            return Response({"ok": True, "role": ({"id": r.id, "name": r.name} if r else None)}, status=200)
        return Response(ser.errors, status=400)


class AdminUserDetailView(APIView):
    permission_classes = [IsAdminOrStaff]

    def get(self, request, pk: int):
        from django.db import connection
        with connection.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.username, u.email, u.full_name, u.phone, u.role, u.is_superuser, u.is_active, u.created_at, u.last_login, COALESCE(t.is_enabled, FALSE) AS totp_enabled
                FROM accounts_admin_portal_user u
                LEFT JOIN accounts_admin_totp t ON LOWER(u.username) = LOWER(t.username)
                WHERE u.id = %s;
            """, [pk])
            r = cur.fetchone()
            if r:
                is_super = bool(r[6] or str(r[5]).lower() in ("super_admin", "super admin"))
                return Response({
                    "id": r[0],
                    "username": r[1],
                    "email": r[2] or "",
                    "full_name": r[3] or r[1],
                    "phone": r[4] or "",
                    "role": r[5] or "Super Admin",
                    "is_superuser": is_super,
                    "is_staff": True,
                    "is_active": bool(r[7]),
                    "date_joined": r[8],
                    "created_at": r[8],
                    "last_login": r[9],
                    "totp_enabled": bool(r[10]),
                    "admin_role": {"id": 1 if is_super else 2, "name": "Super Admin" if is_super else (r[5] or "Admin"), "is_super": is_super},
                }, status=200)

        user = CustomUser.objects.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found"}, status=404)
        return Response(AdminMeSerializer(user).data, status=200)

    def patch(self, request, pk: int):
        from django.contrib.auth.hashers import make_password
        from django.db import connection
        full_name = request.data.get("full_name")
        email = request.data.get("email")
        phone = request.data.get("phone")
        password = request.data.get("password")
        role = request.data.get("role")

        with connection.cursor() as cur:
            cur.execute("SELECT id, username, email, full_name, phone, role, is_superuser, is_active FROM accounts_admin_portal_user WHERE id = %s;", [pk])
            existing = cur.fetchone()
            if existing:
                updates = []
                params = []
                if full_name is not None:
                    updates.append("full_name = %s")
                    params.append(full_name.strip())
                if email is not None:
                    updates.append("email = %s")
                    params.append(email.strip())
                if phone is not None:
                    updates.append("phone = %s")
                    params.append(phone.strip())
                if role is not None:
                    updates.append("role = %s")
                    params.append(role.strip())
                if password and len(password.strip()) >= 8:
                    updates.append("password_hash = %s")
                    params.append(make_password(password.strip()))
                if updates:
                    params.append(pk)
                    cur.execute(f"UPDATE accounts_admin_portal_user SET {', '.join(updates)} WHERE id = %s RETURNING id, username, email, full_name, phone, role, is_superuser, is_active;", params)
                    r = cur.fetchone()
                    return Response({
                        "id": r[0],
                        "username": r[1],
                        "email": r[2],
                        "full_name": r[3],
                        "phone": r[4],
                        "role": r[5],
                        "is_superuser": r[6],
                        "is_active": r[7],
                    }, status=200)
                return Response({"id": pk, "message": "No changes"}, status=200)

        user = CustomUser.objects.filter(pk=pk).first()
        if not user:
            return Response({"detail": "Not found"}, status=404)
        if email: user.email = email.strip()
        if password and len(password.strip()) >= 8: user.set_password(password.strip())
        user.save()
        return Response({"id": user.id, "email": user.email}, status=200)

    def delete(self, request, pk: int):
        from django.db import connection
        with connection.cursor() as cur:
            cur.execute("DELETE FROM accounts_admin_portal_user WHERE id = %s RETURNING username;", [pk])
            r = cur.fetchone()
            if r:
                cur.execute("DELETE FROM accounts_admin_totp WHERE LOWER(username) = %s;", [r[0].lower()])
                return Response({"deleted": True, "username": r[0]}, status=200)
        return Response({"detail": "Not found"}, status=404)
'''

pattern = r"class AdminUsersListCreate\(APIView\):.*?(?=\n# -------- Roles --------|\nclass RoleListCreateView|\Z)"
if re.search(pattern, code, flags=re.DOTALL):
    code = re.sub(pattern, new_classes.strip() + "\n\n", code, flags=re.DOTALL)
else:
    code += "\n\n" + new_classes.strip() + "\n"

with open(rbac_file, "w", encoding="utf-8") as f:
    f.write(code)

print("views_rbac.py patched successfully on EC2.")
