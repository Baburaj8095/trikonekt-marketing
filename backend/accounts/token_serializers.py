from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Username-only login: do not resolve or infer by phone
        initial = getattr(self, "initial_data", {}) or {}
        username = (initial.get("username") or attrs.get("username") or "").strip()
        password = (initial.get("password") or attrs.get("password") or "").strip()

        if not username:
            raise serializers.ValidationError({"detail": "Username is required."})
        attrs["username"] = username

        data = super().validate(attrs)

        # Optional: if the client provides a role, ensure it matches the user's role
        provided_role = initial.get("role")
        if provided_role and provided_role != getattr(self.user, "role", None):
            raise serializers.ValidationError({"detail": "Role mismatch: not authorized for this role."})

        # Business logins are allowed (no special blocking)
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
