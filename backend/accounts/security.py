import hashlib
import hmac
import logging
import random
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from .models import AuditLog, CustomUser, PasswordResetOTP

logger = logging.getLogger(__name__)
GENERIC_OTP_MESSAGE = "If the account exists, OTP has been sent."
OTP_TTL_SECONDS = 5 * 60
OTP_RESEND_SECONDS = 60
OTP_MAX_ATTEMPTS = 5


def get_client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",", 1)[0].strip()
    return request.META.get("REMOTE_ADDR") or None


def audit(action, request=None, actor_user=None, resource_type="", resource_id="", before=None, after=None):
    try:
        actor = actor_user
        if actor is None and request is not None:
            actor = getattr(request, "user", None)
            if not getattr(actor, "is_authenticated", False):
                actor = None
        AuditLog.objects.create(
            actor_user=actor,
            action=action,
            resource_type=resource_type or "",
            resource_id=str(resource_id or ""),
            before_json=before,
            after_json=after,
            ip_address=get_client_ip(request) if request else None,
            user_agent=(request.META.get("HTTP_USER_AGENT", "") if request else "")[:2000],
        )
    except Exception:
        logger.exception("audit log write failed")


def otp_hash(otp, user_id, identity_type, purpose=PasswordResetOTP.PURPOSE_PASSWORD_RESET):
    secret = str(getattr(settings, "SECRET_KEY", ""))
    msg = f"{user_id}:{identity_type}:{purpose}:{otp}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def resolve_password_reset_user(identifier, identity_type):
    identifier = str(identifier or "").strip()
    if not identifier:
        return None
    digits = "".join(ch for ch in identifier if ch.isdigit())
    User = get_user_model()
    q = Q(username__iexact=identifier) | Q(email__iexact=identifier)
    if digits:
        q |= Q(phone__iexact=digits) | Q(username__iexact=digits)
    qs = User.objects.filter(q, is_active=True)
    if identity_type == CustomUser.IDENTITY_ADMIN:
        qs = qs.filter(identity_type=CustomUser.IDENTITY_ADMIN, is_staff=True)
    else:
        qs = qs.exclude(identity_type=CustomUser.IDENTITY_ADMIN)
    return qs.order_by("id").first()


def _rate_key(kind, identity_type, ip, identifier):
    ident = hashlib.sha256(str(identifier or "").lower().encode("utf-8")).hexdigest()[:24]
    return f"pwd_otp:{kind}:{identity_type}:{ip or 'unknown'}:{ident}"


def _increment_or_block(key, limit, window_seconds):
    try:
        count = cache.get(key) or 0
        if int(count) >= int(limit):
            return False
        cache.set(key, int(count) + 1, timeout=window_seconds)
    except Exception:
        pass
    return True


def _send_otp_email(user, otp, subject, message):
    recipient = getattr(user, "email", "") or ""
    if recipient and getattr(settings, "MAIL_ENABLED", False):
        try:
            send_mail(
                subject,
                message,
                getattr(settings, "DEFAULT_FROM_EMAIL", None) or getattr(settings, "EMAIL_HOST_USER", None),
                [recipient],
                fail_silently=True,
            )
        except Exception:
            logger.exception("OTP mail failed")
    else:
        logger.info("OTP generated for user_id=%s identity=%s", user.id, getattr(user, "identity_type", ""))


@transaction.atomic
def request_password_reset_otp(request, identity_type, identifier):
    ip = get_client_ip(request)
    key = _rate_key("request", identity_type, ip, identifier)
    if not _increment_or_block(key, limit=8, window_seconds=15 * 60):
        audit("otp.request.rate_limited", request=request, resource_type="password_reset", resource_id=identity_type)
        return False

    user = resolve_password_reset_user(identifier, identity_type)
    if not user:
        audit("otp.request", request=request, resource_type="password_reset", resource_id=identity_type)
        return True

    cooldown_key = f"pwd_otp:cooldown:{user.id}:{identity_type}"
    if cache.get(cooldown_key):
        audit("otp.request.cooldown", request=request, actor_user=user, resource_type="password_reset", resource_id=user.id)
        return True
    cache.set(cooldown_key, "1", timeout=OTP_RESEND_SECONDS)

    purpose = PasswordResetOTP.PURPOSE_PASSWORD_RESET
    PasswordResetOTP.objects.filter(user=user, identity_type=identity_type, purpose=purpose, is_used=False).update(is_used=True)
    otp = f"{random.SystemRandom().randint(0, 999999):06d}"
    PasswordResetOTP.objects.create(
        user=user,
        identity_type=identity_type,
        purpose=purpose,
        otp_hash=otp_hash(otp, user.id, identity_type, purpose),
        expires_at=timezone.now() + timedelta(seconds=OTP_TTL_SECONDS),
        max_attempts=OTP_MAX_ATTEMPTS,
        ip_address=ip,
    )

    _send_otp_email(
        user,
        otp,
        "Trikonekt password reset OTP",
        f"Your Trikonekt password reset OTP is {otp}. It expires in 5 minutes.",
    )

    audit("otp.request", request=request, actor_user=user, resource_type="password_reset", resource_id=user.id)
    return True


def verify_password_reset_otp(request, identity_type, identifier, otp):
    ip = get_client_ip(request)
    if not _increment_or_block(_rate_key("verify", identity_type, ip, identifier), 20, 15 * 60):
        return False
    user = resolve_password_reset_user(identifier, identity_type)
    if not user:
        audit("otp.verify.failed", request=request, resource_type="password_reset", resource_id=identity_type)
        return False
    row = (
        PasswordResetOTP.objects
        .filter(user=user, identity_type=identity_type, purpose=PasswordResetOTP.PURPOSE_PASSWORD_RESET, is_used=False)
        .order_by("-created_at")
        .first()
    )
    if not row or row.expires_at <= timezone.now() or row.attempt_count >= row.max_attempts:
        audit("otp.verify.failed", request=request, actor_user=user, resource_type="password_reset", resource_id=user.id)
        return False
    row.attempt_count += 1
    row.save(update_fields=["attempt_count"])
    ok = hmac.compare_digest(row.otp_hash, otp_hash(str(otp or "").strip(), user.id, identity_type, PasswordResetOTP.PURPOSE_PASSWORD_RESET))
    audit("otp.verify.success" if ok else "otp.verify.failed", request=request, actor_user=user, resource_type="password_reset", resource_id=user.id)
    return ok


@transaction.atomic
def reset_password_with_otp(request, identity_type, identifier, otp, new_password):
    user = resolve_password_reset_user(identifier, identity_type)
    if not user:
        return False
    if not verify_password_reset_otp(request, identity_type, identifier, otp):
        return False
    validate_password(new_password, user=user)
    row = (
        PasswordResetOTP.objects
        .select_for_update()
        .filter(user=user, identity_type=identity_type, purpose=PasswordResetOTP.PURPOSE_PASSWORD_RESET, is_used=False)
        .order_by("-created_at")
        .first()
    )
    if not row or row.expires_at <= timezone.now():
        return False
    user.set_password(new_password)
    user.save(update_fields=["password"])
    row.is_used = True
    row.save(update_fields=["is_used"])
    PasswordResetOTP.objects.filter(user=user, identity_type=identity_type, purpose=PasswordResetOTP.PURPOSE_PASSWORD_RESET, is_used=False).update(is_used=True)
    invalidate_user_tokens(user)
    audit("password.reset", request=request, actor_user=user, resource_type="user", resource_id=user.id)
    return True


@transaction.atomic
def request_admin_login_otp(request, identifier):
    identity_type = CustomUser.IDENTITY_ADMIN
    ip = get_client_ip(request)
    key = _rate_key("admin_login_request", identity_type, ip, identifier)
    if not _increment_or_block(key, limit=8, window_seconds=15 * 60):
        audit("login.otp.request.rate_limited", request=request, resource_type="admin_login", resource_id=identity_type)
        return False

    user = resolve_password_reset_user(identifier, identity_type)
    if not user:
        audit("login.otp.request", request=request, resource_type="admin_login", resource_id=identity_type)
        return True

    cooldown_key = f"login_otp:cooldown:{user.id}:{identity_type}"
    if cache.get(cooldown_key):
        audit("login.otp.request.cooldown", request=request, actor_user=user, resource_type="admin_login", resource_id=user.id)
        return True
    cache.set(cooldown_key, "1", timeout=OTP_RESEND_SECONDS)

    purpose = PasswordResetOTP.PURPOSE_ADMIN_LOGIN
    PasswordResetOTP.objects.filter(user=user, identity_type=identity_type, purpose=purpose, is_used=False).update(is_used=True)
    otp = f"{random.SystemRandom().randint(0, 999999):06d}"
    PasswordResetOTP.objects.create(
        user=user,
        identity_type=identity_type,
        purpose=purpose,
        otp_hash=otp_hash(otp, user.id, identity_type, purpose),
        expires_at=timezone.now() + timedelta(seconds=OTP_TTL_SECONDS),
        max_attempts=OTP_MAX_ATTEMPTS,
        ip_address=ip,
    )
    _send_otp_email(
        user,
        otp,
        "Trikonekt admin login OTP",
        f"Your Trikonekt admin login OTP is {otp}. It expires in 5 minutes.",
    )
    audit("login.otp.request", request=request, actor_user=user, resource_type="admin_login", resource_id=user.id)
    return True


@transaction.atomic
def verify_admin_login_otp(request, identifier, otp):
    identity_type = CustomUser.IDENTITY_ADMIN
    ip = get_client_ip(request)
    if not _increment_or_block(_rate_key("admin_login_verify", identity_type, ip, identifier), 20, 15 * 60):
        return None
    user = resolve_password_reset_user(identifier, identity_type)
    if not user:
        audit("login.otp.failed", request=request, resource_type="admin_login", resource_id=identity_type)
        return None
    purpose = PasswordResetOTP.PURPOSE_ADMIN_LOGIN
    row = (
        PasswordResetOTP.objects
        .select_for_update()
        .filter(user=user, identity_type=identity_type, purpose=purpose, is_used=False)
        .order_by("-created_at")
        .first()
    )
    if not row or row.expires_at <= timezone.now() or row.attempt_count >= row.max_attempts:
        audit("login.otp.failed", request=request, actor_user=user, resource_type="admin_login", resource_id=user.id)
        return None
    row.attempt_count += 1
    row.save(update_fields=["attempt_count"])
    ok = hmac.compare_digest(row.otp_hash, otp_hash(str(otp or "").strip(), user.id, identity_type, purpose))
    if not ok:
        audit("login.otp.failed", request=request, actor_user=user, resource_type="admin_login", resource_id=user.id)
        return None
    row.is_used = True
    row.save(update_fields=["is_used"])
    audit("login.otp.success", request=request, actor_user=user, resource_type="admin_login", resource_id=user.id)
    return user


def invalidate_user_tokens(user):
    try:
        token_ids = list(OutstandingToken.objects.filter(user=user).values_list("id", flat=True))
        if not token_ids:
            return
        existing = set(BlacklistedToken.objects.filter(token_id__in=token_ids).values_list("token_id", flat=True))
        missing = [tid for tid in token_ids if tid not in existing]
        if missing:
            BlacklistedToken.objects.bulk_create(
                [BlacklistedToken(token_id=tid) for tid in missing],
                ignore_conflicts=True,
                batch_size=500,
            )
    except Exception:
        logger.exception("token invalidation failed for user_id=%s", getattr(user, "id", None))


class PasswordResetRequestSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True)
    email = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    captcha_token = serializers.CharField(required=False, allow_blank=True)

    def get_identifier(self):
        return (
            self.validated_data.get("identifier")
            or self.validated_data.get("username")
            or self.validated_data.get("email")
            or self.validated_data.get("phone")
            or ""
        )


class PasswordResetVerifySerializer(PasswordResetRequestSerializer):
    otp = serializers.RegexField(r"^\d{6}$")


class PasswordResetConfirmSerializer(PasswordResetVerifySerializer):
    new_password = serializers.CharField(min_length=8, write_only=True)


class AdminLoginOTPVerifySerializer(PasswordResetRequestSerializer):
    otp = serializers.RegexField(r"^\d{6}$")
