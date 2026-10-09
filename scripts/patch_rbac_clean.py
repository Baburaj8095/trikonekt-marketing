import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_patch = """
rbac_path = '/srv/trikonekt/staging/backend/adminapi/views_rbac.py'
with open(rbac_path, 'r') as f:
    code = f.read()

new_class = '''class AdminUsersListCreate(APIView):
    permission_classes = [IsAdminOrStaff]

    def _list_staff_admins(self, request):
        search = (request.query_params.get("search") or "").strip().lower()
        from django.db import connection
        with connection.cursor() as cur:
            query = "SELECT u.id, u.username, u.email, u.full_name, u.phone, u.role, u.is_superuser, u.is_active, u.created_at, u.last_login, COALESCE(t.is_enabled, FALSE) AS totp_enabled FROM accounts_admin_portal_user u LEFT JOIN accounts_admin_totp t ON LOWER(u.username) = LOWER(t.username)"
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
                results.append({
                    "id": r[0],
                    "username": r[1],
                    "email": r[2] or "",
                    "full_name": r[3] or r[1],
                    "phone": r[4] or "",
                    "role": r[5] or "super_admin",
                    "is_superuser": bool(r[6]),
                    "is_staff": True,
                    "is_active": bool(r[7]),
                    "date_joined": r[8],
                    "last_login": r[9],
                    "totp_enabled": bool(r[10]),
                    "admin_role": {
                        "id": 1,
                        "name": "Super Admin" if r[6] or r[5] == "super_admin" else (r[5] or "Admin"),
                        "is_super": bool(r[6] or r[5] == "super_admin"),
                    },
                    "admin_roles": [{
                        "id": 1,
                        "name": "Super Admin" if r[6] or r[5] == "super_admin" else (r[5] or "Admin"),
                        "is_super": bool(r[6] or r[5] == "super_admin"),
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
        role = (request.data.get("role") or "super_admin").strip()

        if not username:
            return Response({"username": ["This field is required."]}, status=400)
        if not password or len(password) < 8:
            return Response({"password": ["Password must be at least 8 characters."]}, status=400)

        hashed_pw = make_password(password)
        with connection.cursor() as cur:
            cur.execute("SELECT id FROM accounts_admin_portal_user WHERE LOWER(username) = %s;", [username])
            if cur.fetchone():
                return Response({"username": ["An admin with that username already exists."]}, status=400)

            cur.execute(
                "INSERT INTO accounts_admin_portal_user (username, password_hash, full_name, email, phone, role, is_superuser, is_active) VALUES (%s, %s, %s, %s, %s, %s, TRUE, TRUE) RETURNING id, username, full_name, email, phone, role, is_superuser, is_active, created_at;",
                [username, hashed_pw, full_name, email, phone, role]
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
            "admin_role": {"id": 1, "name": "Super Admin", "is_super": True},
        }, status=201)'''

import re
code = re.sub(
    r'class AdminUsersListCreate\(APIView\):.*?(?=\nclass AdminUserActivateView|\Z)',
    new_class + '\\n\\n',
    code,
    flags=re.DOTALL
)

with open(rbac_path, 'w') as f:
    f.write(code)

print('Updated AdminUsersListCreate in views_rbac.py successfully.')
"""

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/patch_rbac_clean.py\n{remote_patch}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/patch_rbac_clean.py\nsudo systemctl restart trikonekt-staging-web"]
res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)
