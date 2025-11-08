from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        initial = getattr(self, "initial_data", {}) or {}
        raw_identifier = (initial.get("username") or "").strip()
        raw_phone = (initial.get("phone") or "").strip()
        password = (initial.get("password") or attrs.get("password") or "").strip()

        def only_digits(s: str) -> str:
            return "".join(c for c in (s or "") if c.isdigit())

        digits = only_digits(raw_phone or raw_identifier)

        # If a phone number was provided, try to disambiguate among multiple accounts sharing the same phone
        if digits and password:
            try:
                User = get_user_model()
                candidates = list(User.objects.filter(phone__iexact=digits).distinct())
                # Legacy fallback: if no candidates by phone, try username==digits
                if not candidates:
                    fallback = User.objects.filter(username__iexact=digits).first()
                    if fallback:
                        candidates = [fallback]

                matches = [u for u in candidates if u.check_password(password)]
                if len(matches) == 1:
                    attrs["username"] = matches[0].username
                elif len(matches) > 1:
                    raise serializers.ValidationError({
                        "detail": "Multiple accounts found for this phone. Please choose a username and try again.",
                        "multiple_accounts": [
                            {"username": u.username, "category": getattr(u, "category", None), "role": getattr(u, "role", None)}
                            for u in matches
                        ],
                    })
                # If zero matches, fall through to default super().validate which will fail as usual.
            except serializers.ValidationError:
                raise
            except Exception:
                # Best-effort: fall back to default behavior
                pass
        else:
            # If identifier looks like phone but password missing for pre-check, try simple resolution to first match
            if digits and not password:
                try:
                    User = get_user_model()
                    u = User.objects.filter(Q(phone__iexact=digits) | Q(username__iexact=digits)).first()
                    if u:
                        attrs["username"] = u.username
                except Exception:
                    pass

        data = super().validate(attrs)

        provided_role = initial.get("role")
        if provided_role and provided_role != getattr(self.user, "role", None):
            raise serializers.ValidationError({"detail": "Role mismatch: not authorized for this role."})

        # Business login policy (keep disabled)
        if getattr(self.user, "category", None) == "business":
            raise serializers.ValidationError({"detail": "Business login is disabled. Your registration will be processed by admin."})

        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['username'] = user.username
        token['full_name'] = getattr(user, 'full_name', '') or ''
        # Admin flags for guarding Admin UI routes
        token['is_staff'] = bool(getattr(user, 'is_staff', False))
        token['is_superuser'] = bool(getattr(user, 'is_superuser', False))
        return token


class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    """
    Ensure refreshed access tokens include our custom claims so Admin route guard keeps working.
    """
    def validate(self, attrs):
        data = super().validate(attrs)
        try:
            refresh = RefreshToken(attrs.get("refresh"))
            user_id = refresh.get("user_id", None)
            if user_id:
                User = get_user_model()
                user = User.objects.filter(id=user_id).first()
                if user:
                    access = refresh.access_token
                    access["role"] = user.role
                    access["username"] = user.username
                    access["full_name"] = getattr(user, "full_name", "") or ""
                    access["is_staff"] = bool(getattr(user, "is_staff", False))
                    access["is_superuser"] = bool(getattr(user, "is_superuser", False))
                    data["access"] = str(access)
        except Exception:
            # If anything fails, return the default data without extra claims
            pass
        return data


class CustomTokenRefreshView(TokenRefreshView):
    serializer_class = CustomTokenRefreshSerializer
