import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

totp_view_code = '''
import time, json, secrets, io, base64, pyotp, qrcode, jwt
from datetime import datetime, timezone as dt_timezone
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.db import connection
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from accounts.token_serializers import AdminTokenObtainPairSerializer

User = get_user_model()

def make_temp_2fa_token(user_id, purpose="admin_2fa", ttl=300):
    payload = {
        "user_id": user_id,
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
        return payload.get("user_id")
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

def get_or_create_totp_record(user):
    with connection.cursor() as cur:
        cur.execute("SELECT id, secret_key, is_enabled, backup_codes, last_used_timestep FROM accounts_admin_totp WHERE user_id = %s;", [user.id])
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
                INSERT INTO accounts_admin_totp (user_id, secret_key, is_enabled, backup_codes, last_used_timestep)
                VALUES (%s, %s, FALSE, %s::jsonb, 0)
                RETURNING id, secret_key, is_enabled, backup_codes, last_used_timestep;
                """,
                [user.id, secret, json.dumps(backup_codes)]
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
        username = (request.data.get("username") or "").strip()
        password = (request.data.get("password") or "").strip()
        
        if not username or not password:
            return Response({"detail": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        # Authenticate user
        user = authenticate(request, username=username, password=password)
        if not user:
            # Check by phone or other prefixes if custom username resolution is needed
            matches = list(User.objects.filter(phone__iexact=username))
            if not matches:
                matches = list(User.objects.filter(username__iexact=username))
            for m in matches:
                if m.check_password(password):
                    user = m
                    break

        if not user:
            return Response({"detail": "Invalid username or password."}, status=status.HTTP_401_UNAUTHORIZED)

        if not (user.is_staff or user.is_superuser or user.role == "admin"):
            return Response({"detail": "Not an admin account. Please use an authorized staff/admin login."}, status=status.HTTP_403_FORBIDDEN)

        if not user.is_active:
            return Response({"detail": "Admin account is blocked or inactive."}, status=status.HTTP_403_FORBIDDEN)

        totp_rec = get_or_create_totp_record(user)
        temp_token = make_temp_2fa_token(user.id)

        if not totp_rec["is_enabled"]:
            # Need first-time Google Authenticator setup
            uri = pyotp.totp.TOTP(totp_rec["secret_key"]).provisioning_uri(
                name=user.username,
                issuer_name="Trikonekt"
            )
            qr_base64 = generate_qr_base64(uri)
            return Response({
                "require_2fa_setup": True,
                "temp_token": temp_token,
                "secret": totp_rec["secret_key"],
                "qr_code": qr_base64,
                "backup_codes": totp_rec["backup_codes"],
                "username": user.username,
                "full_name": getattr(user, "full_name", "") or user.username,
            }, status=status.HTTP_200_OK)
        else:
            # Already enabled, prompt for 6-digit TOTP
            return Response({
                "require_2fa_verify": True,
                "temp_token": temp_token,
                "username": user.username,
                "full_name": getattr(user, "full_name", "") or user.username,
            }, status=status.HTTP_200_OK)


class Admin2FASetupConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        temp_token = (request.data.get("temp_token") or "").strip()
        otp_code = (request.data.get("otp_code") or "").strip().replace(" ", "").replace("-", "")

        user_id = decode_temp_2fa_token(temp_token)
        if not user_id:
            return Response({"detail": "Session expired or invalid. Please log in again."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        with connection.cursor() as cur:
            cur.execute("SELECT id, secret_key, is_enabled FROM accounts_admin_totp WHERE user_id = %s;", [user.id])
            row = cur.fetchone()
            if not row:
                return Response({"detail": "2FA setup record not found."}, status=status.HTTP_400_BAD_REQUEST)
            secret_key = row[1]

        totp = pyotp.TOTP(secret_key)
        if not totp.verify(otp_code, valid_window=1):
            return Response({"detail": "Invalid 6-digit code. Check your Google Authenticator app and try again."}, status=status.HTTP_400_BAD_REQUEST)

        current_timestep = int(time.time() / 30)
        with connection.cursor() as cur:
            cur.execute(
                """
                UPDATE accounts_admin_totp
                SET is_enabled = TRUE, last_verified_at = CURRENT_TIMESTAMP, last_used_timestep = %s, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = %s;
                """,
                [current_timestep, user.id]
            )

        refresh = AdminTokenObtainPairSerializer.get_token(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "message": "Google Authenticator 2FA configured and verified successfully!",
            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": getattr(user, "full_name", "") or user.username,
                "role": user.role,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
            }
        }, status=status.HTTP_200_OK)


class Admin2FAVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        temp_token = (request.data.get("temp_token") or "").strip()
        raw_code = (request.data.get("otp_code") or "").strip().replace(" ", "").replace("-", "").upper()

        user_id = decode_temp_2fa_token(temp_token)
        if not user_id:
            return Response({"detail": "Session expired or invalid. Please log in again."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        with connection.cursor() as cur:
            cur.execute("SELECT id, secret_key, is_enabled, backup_codes, last_used_timestep FROM accounts_admin_totp WHERE user_id = %s;", [user.id])
            row = cur.fetchone()
            if not row or not row[2]:
                return Response({"detail": "2FA is not enabled for this user."}, status=status.HTTP_400_BAD_REQUEST)
            secret_key = row[1]
            backup_codes = row[3] if isinstance(row[3], list) else (json.loads(row[3]) if row[3] else [])
            last_used_timestep = row[4] or 0

        totp = pyotp.TOTP(secret_key)
        current_timestep = int(time.time() / 30)

        # 1. Check TOTP rolling 6-digit code
        is_totp_match = False
        if len(raw_code) == 6 and raw_code.isdigit():
            if totp.verify(raw_code, valid_window=1):
                if current_timestep <= last_used_timestep:
                    return Response({"detail": "This code was already used. Please wait for the next 30-second code."}, status=status.HTTP_400_BAD_REQUEST)
                is_totp_match = True
                with connection.cursor() as cur:
                    cur.execute(
                        "UPDATE accounts_admin_totp SET last_used_timestep = %s, last_verified_at = CURRENT_TIMESTAMP WHERE user_id = %s;",
                        [current_timestep, user.id]
                    )

        # 2. Check Backup Recovery Code
        is_backup_match = False
        if not is_totp_match and backup_codes:
            if raw_code in [b.upper() for b in backup_codes]:
                is_backup_match = True
                remaining_backups = [b for b in backup_codes if b.upper() != raw_code]
                with connection.cursor() as cur:
                    cur.execute(
                        "UPDATE accounts_admin_totp SET backup_codes = %s::jsonb, last_verified_at = CURRENT_TIMESTAMP WHERE user_id = %s;",
                        [json.dumps(remaining_backups), user.id]
                    )

        if not is_totp_match and not is_backup_match:
            return Response({"detail": "Invalid authentication code or recovery code. Please try again."}, status=status.HTTP_400_BAD_REQUEST)

        refresh = AdminTokenObtainPairSerializer.get_token(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": getattr(user, "full_name", "") or user.username,
                "role": user.role,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
            }
        }, status=status.HTTP_200_OK)


class Admin2FAResetView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not (request.user.is_staff or request.user.is_superuser or request.user.role == "admin"):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        target_id = request.data.get("target_user_id") or request.user.id
        with connection.cursor() as cur:
            cur.execute("DELETE FROM accounts_admin_totp WHERE user_id = %s;", [target_id])

        return Response({"message": f"2FA reset successfully for user ID {target_id}. They will be prompted to re-enroll on next login."}, status=status.HTTP_200_OK)
'''

# Deploy views_totp_2fa.py to /srv/trikonekt/staging/backend/adminapi/views_totp_2fa.py
deploy_script = f"""
cat << 'EOF' > /srv/trikonekt/staging/backend/adminapi/views_totp_2fa.py
{totp_view_code}
EOF
"""

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", deploy_script]
res = subprocess.run(cmd, capture_output=True, text=True)
print("Deployed views_totp_2fa.py:", res.returncode)
if res.stderr:
    print("STDERR:", res.stderr)
