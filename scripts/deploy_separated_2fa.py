import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

totp_view_code = '''
import time, json, secrets, io, base64, pyotp, qrcode, jwt
from datetime import datetime, timezone as dt_timezone
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import connection
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated

def make_temp_2fa_token(username, purpose="admin_2fa", ttl=300):
    payload = {
        "admin_username": username,
        "purpose": purpose,
        "exp": int(time.time()) + ttl,
        "iat": int(time.time()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

def decode_temp_2fa_token(token, purpose="admin_2fa"):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("purpose") != purpose:
            return None
        return payload.get("admin_username")
    except Exception:
        return None

def generate_qr_base64(uri):
    qr = qrcode.QRCode(box_size=6, border=2)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

def make_admin_jwt_tokens(admin_user):
    now = int(time.time())
    access_exp = now + 86400 # 24 hours
    refresh_exp = now + (86400 * 30) # 30 days

    access_payload = {
        "token_type": "access",
        "exp": access_exp,
        "iat": now,
        "jti": secrets.token_hex(16),
        "user_id": 1,
        "role": "admin",
        "username": admin_user["username"],
        "full_name": admin_user["full_name"],
        "category": "staff",
        "role_effective": "admin",
        "is_staff": True,
        "is_superuser": True,
        "identity_type": "ADMIN",
    }
    refresh_payload = {
        "token_type": "refresh",
        "exp": refresh_exp,
        "iat": now,
        "jti": secrets.token_hex(16),
        "user_id": 1,
        "role": "admin",
        "username": admin_user["username"],
        "full_name": admin_user["full_name"],
        "category": "staff",
        "role_effective": "admin",
        "is_staff": True,
        "is_superuser": True,
        "identity_type": "ADMIN",
    }
    access_token = jwt.encode(access_payload, settings.SECRET_KEY, algorithm="HS256")
    refresh_token = jwt.encode(refresh_payload, settings.SECRET_KEY, algorithm="HS256")
    return access_token, refresh_token

def get_or_create_totp_record(username):
    with connection.cursor() as cur:
        cur.execute("SELECT id, secret_key, is_enabled, backup_codes, last_used_timestep FROM accounts_admin_totp WHERE username = %s;", [username])
        row = cur.fetchone()
        if row:
            backup_codes = row[3] if isinstance(row[3], list) else (json.loads(row[3]) if row[3] else [])
            return {
                "id": row[0],
                "secret_key": row[1],
                "is_enabled": bool(row[2]),
                "backup_codes": backup_codes,
                "last_used_timestep": row[4] or 0,
            }
        else:
            secret = pyotp.random_base32()
            backup_codes = [secrets.token_hex(4).upper() for _ in range(8)]
            cur.execute(
                """
                INSERT INTO accounts_admin_totp (username, secret_key, is_enabled, backup_codes, last_used_timestep)
                VALUES (%s, %s, FALSE, %s::jsonb, 0)
                RETURNING id, secret_key, is_enabled, backup_codes, last_used_timestep;
                """,
                [username, secret, json.dumps(backup_codes)]
            )
            new_row = cur.fetchone()
            return {
                "id": new_row[0],
                "secret_key": new_row[1],
                "is_enabled": False,
                "backup_codes": backup_codes,
                "last_used_timestep": 0,
            }


class AdminLoginWith2FAView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = (request.data.get("username") or "").strip().lower()
        password = (request.data.get("password") or "").strip()
        
        if not username or not password:
            return Response({"detail": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        # Query dedicated admin table
        with connection.cursor() as cur:
            cur.execute("""
            SELECT id, username, password_hash, full_name, email, phone, role, is_superuser, is_active
            FROM accounts_admin_portal_user
            WHERE LOWER(username) = %s OR LOWER(email) = %s OR phone = %s;
            """, [username, username, username])
            row = cur.fetchone()

        if not row:
            return Response({"detail": "Invalid admin username or password."}, status=status.HTTP_401_UNAUTHORIZED)

        admin_user = {
            "id": row[0],
            "username": row[1],
            "password_hash": row[2],
            "full_name": row[3],
            "email": row[4],
            "phone": row[5],
            "role": row[6],
            "is_superuser": row[7],
            "is_active": row[8],
        }

        if not admin_user["is_active"]:
            return Response({"detail": "This admin account has been deactivated. Contact SuperAdmin."}, status=status.HTTP_403_FORBIDDEN)

        if not check_password(password, admin_user["password_hash"]):
            return Response({"detail": "Invalid admin username or password."}, status=status.HTTP_401_UNAUTHORIZED)

        totp_rec = get_or_create_totp_record(admin_user["username"])
        temp_token = make_temp_2fa_token(admin_user["username"])

        if not totp_rec["is_enabled"]:
            # Prompt for 1st-time Google Authenticator setup
            uri = pyotp.totp.TOTP(totp_rec["secret_key"]).provisioning_uri(
                name=admin_user["username"],
                issuer_name="Trikonekt"
            )
            qr_base64 = generate_qr_base64(uri)
            return Response({
                "require_2fa_setup": True,
                "temp_token": temp_token,
                "secret": totp_rec["secret_key"],
                "qr_code": qr_base64,
                "backup_codes": totp_rec["backup_codes"],
                "username": admin_user["username"],
                "full_name": admin_user["full_name"],
            }, status=status.HTTP_200_OK)
        else:
            # Prompt for 6-digit TOTP
            return Response({
                "require_2fa_verify": True,
                "temp_token": temp_token,
                "username": admin_user["username"],
                "full_name": admin_user["full_name"],
            }, status=status.HTTP_200_OK)


class Admin2FASetupConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        temp_token = (request.data.get("temp_token") or "").strip()
        otp_code = (request.data.get("otp_code") or "").strip().replace(" ", "").replace("-", "")

        username = decode_temp_2fa_token(temp_token)
        if not username:
            return Response({"detail": "Session expired or invalid. Please log in again."}, status=status.HTTP_400_BAD_REQUEST)

        with connection.cursor() as cur:
            cur.execute("SELECT id, username, full_name, email, phone, role, is_superuser, is_active FROM accounts_admin_portal_user WHERE username = %s;", [username])
            row = cur.fetchone()
            if not row:
                return Response({"detail": "Admin account not found."}, status=status.HTTP_404_NOT_FOUND)
            admin_user = {
                "id": row[0], "username": row[1], "full_name": row[2], "email": row[3], "phone": row[4], "role": row[5], "is_superuser": row[6], "is_active": row[7]
            }

            cur.execute("SELECT id, secret_key, is_enabled FROM accounts_admin_totp WHERE username = %s;", [username])
            totp_row = cur.fetchone()
            if not totp_row:
                return Response({"detail": "2FA setup record not found."}, status=status.HTTP_400_BAD_REQUEST)
            secret_key = totp_row[1]

        totp = pyotp.TOTP(secret_key)
        if not totp.verify(otp_code, valid_window=1):
            return Response({"detail": "Invalid 6-digit code. Check your Google Authenticator app and try again."}, status=status.HTTP_400_BAD_REQUEST)

        current_timestep = int(time.time() / 30)
        with connection.cursor() as cur:
            cur.execute(
                """
                UPDATE accounts_admin_totp
                SET is_enabled = TRUE, last_verified_at = CURRENT_TIMESTAMP, last_used_timestep = %s, updated_at = CURRENT_TIMESTAMP
                WHERE username = %s;
                """,
                [current_timestep, username]
            )
            cur.execute("UPDATE accounts_admin_portal_user SET last_login = CURRENT_TIMESTAMP WHERE username = %s;", [username])

        access, refresh = make_admin_jwt_tokens(admin_user)
        return Response({
            "access": access,
            "refresh": refresh,
            "message": "Google Authenticator 2FA configured and verified successfully!",
            "user": {
                "id": admin_user["id"],
                "username": admin_user["username"],
                "full_name": admin_user["full_name"],
                "role": "admin",
                "is_staff": True,
                "is_superuser": True,
            }
        }, status=status.HTTP_200_OK)


class Admin2FAVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        temp_token = (request.data.get("temp_token") or "").strip()
        raw_code = (request.data.get("otp_code") or "").strip().replace(" ", "").replace("-", "").upper()

        username = decode_temp_2fa_token(temp_token)
        if not username:
            return Response({"detail": "Session expired or invalid. Please log in again."}, status=status.HTTP_400_BAD_REQUEST)

        with connection.cursor() as cur:
            cur.execute("SELECT id, username, full_name, email, phone, role, is_superuser, is_active FROM accounts_admin_portal_user WHERE username = %s;", [username])
            row = cur.fetchone()
            if not row:
                return Response({"detail": "Admin account not found."}, status=status.HTTP_404_NOT_FOUND)
            admin_user = {
                "id": row[0], "username": row[1], "full_name": row[2], "email": row[3], "phone": row[4], "role": row[5], "is_superuser": row[6], "is_active": row[7]
            }

            cur.execute("SELECT id, secret_key, is_enabled, backup_codes, last_used_timestep FROM accounts_admin_totp WHERE username = %s;", [username])
            totp_row = cur.fetchone()
            if not totp_row or not totp_row[2]:
                return Response({"detail": "2FA is not enabled for this admin account."}, status=status.HTTP_400_BAD_REQUEST)
            secret_key = totp_row[1]
            backup_codes = totp_row[3] if isinstance(totp_row[3], list) else (json.loads(totp_row[3]) if totp_row[3] else [])
            last_used_timestep = totp_row[4] or 0

        totp = pyotp.TOTP(secret_key)
        current_timestep = int(time.time() / 30)

        # 1. Check rolling 6-digit code
        is_totp_match = False
        if len(raw_code) == 6 and raw_code.isdigit():
            if totp.verify(raw_code, valid_window=1):
                if current_timestep <= last_used_timestep:
                    return Response({"detail": "This code was already used. Please wait for the next 30-second code."}, status=status.HTTP_400_BAD_REQUEST)
                is_totp_match = True
                with connection.cursor() as cur:
                    cur.execute(
                        "UPDATE accounts_admin_totp SET last_used_timestep = %s, last_verified_at = CURRENT_TIMESTAMP WHERE username = %s;",
                        [current_timestep, username]
                    )

        # 2. Check Backup Recovery Code
        is_backup_match = False
        if not is_totp_match and backup_codes:
            if raw_code in [b.upper() for b in backup_codes]:
                is_backup_match = True
                remaining_backups = [b for b in backup_codes if b.upper() != raw_code]
                with connection.cursor() as cur:
                    cur.execute(
                        "UPDATE accounts_admin_totp SET backup_codes = %s::jsonb, last_verified_at = CURRENT_TIMESTAMP WHERE username = %s;",
                        [json.dumps(remaining_backups), username]
                    )

        if not is_totp_match and not is_backup_match:
            return Response({"detail": "Invalid authentication code or recovery code. Please try again."}, status=status.HTTP_400_BAD_REQUEST)

        with connection.cursor() as cur:
            cur.execute("UPDATE accounts_admin_portal_user SET last_login = CURRENT_TIMESTAMP WHERE username = %s;", [username])

        access, refresh = make_admin_jwt_tokens(admin_user)
        return Response({
            "access": access,
            "refresh": refresh,
            "user": {
                "id": admin_user["id"],
                "username": admin_user["username"],
                "full_name": admin_user["full_name"],
                "role": "admin",
                "is_staff": True,
                "is_superuser": True,
            }
        }, status=status.HTTP_200_OK)


class Admin2FAResetView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        target_username = (request.data.get("username") or "").strip()
        if not target_username:
            target_username = request.user.username

        with connection.cursor() as cur:
            cur.execute("DELETE FROM accounts_admin_totp WHERE username = %s;", [target_username])

        return Response({"message": f"2FA reset successfully for admin '{target_username}'. They will be prompted to re-enroll on next login."}, status=status.HTTP_200_OK)


class AdminSubAdminsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        with connection.cursor() as cur:
            cur.execute("""
            SELECT id, username, full_name, email, phone, role, is_superuser, is_active, last_login, created_at
            FROM accounts_admin_portal_user
            ORDER BY id ASC;
            """)
            rows = cur.fetchall()
            admins = []
            for r in rows:
                admins.append({
                    "id": r[0],
                    "username": r[1],
                    "full_name": r[2],
                    "email": r[3],
                    "phone": r[4],
                    "role": r[5],
                    "is_superuser": r[6],
                    "is_active": r[7],
                    "last_login": r[8],
                    "created_at": r[9],
                })
        return Response({"count": len(admins), "results": admins}, status=status.HTTP_200_OK)

    def post(self, request):
        username = (request.data.get("username") or "").strip().lower()
        password = (request.data.get("password") or "").strip()
        full_name = (request.data.get("full_name") or "").strip()
        email = (request.data.get("email") or "").strip()
        phone = (request.data.get("phone") or "").strip()
        
        if not username or not password:
            return Response({"detail": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        hashed_pw = make_password(password)
        with connection.cursor() as cur:
            try:
                cur.execute("""
                INSERT INTO accounts_admin_portal_user (username, password_hash, full_name, email, phone, role, is_superuser, is_active)
                VALUES (%s, %s, %s, %s, %s, 'super_admin', TRUE, TRUE)
                RETURNING id, username, full_name, email, phone, role, is_superuser, is_active;
                """, [username, hashed_pw, full_name, email, phone])
                r = cur.fetchone()
                return Response({
                    "id": r[0], "username": r[1], "full_name": r[2], "email": r[3], "phone": r[4], "role": r[5], "is_superuser": r[6], "is_active": r[7]
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({"detail": f"Admin username already exists or invalid: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
'''

deploy_script = f"""
cat << 'EOF' > /srv/trikonekt/staging/backend/adminapi/views_totp_2fa.py
{totp_view_code}
EOF
sudo systemctl restart trikonekt-staging-web
"""

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", deploy_script]
res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
print("Deployed separated views_totp_2fa.py and restarted service:", res.returncode)
if res.stderr:
    print("STDERR:", res.stderr)
