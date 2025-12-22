from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.settings import api_settings
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
        if provided_role:
            pr = str(provided_role).strip().lower()
            user_role = str(getattr(self.user, "role", "") or "").strip().lower()
            user_cat = str(getattr(self.user, "category", "") or "").strip().lower()

            # Allow declared role OR special-case mapping:
            # - "business" is valid when user's category is business (even if role is "user")
            # - "consumer" is valid when role is "user" and category is consumer (legacy)
            allowed = (
                pr == user_role
                or (pr == "business" and user_cat == "business")
                or (pr == "consumer" and user_role == "user" and user_cat == "consumer")
            )
            if not allowed:
                raise serializers.ValidationError({"detail": "Role mismatch: not authorized for this role."})

        # Business logins are allowed (no special blocking)
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['username'] = user.username
        token['full_name'] = getattr(user, 'full_name', '') or ''
        token['category'] = getattr(user, 'category', '') or ''
        # Effective role for UI routing: treat business distinctly from generic "user"
        token['role_effective'] = 'business' if (getattr(user, 'category', '') or '').lower() == 'business' else user.role
        # Admin flags for guarding Admin UI routes
        token['is_staff'] = bool(getattr(user, 'is_staff', False))
        token['is_superuser'] = bool(getattr(user, 'is_superuser', False))
        return token


class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    """
    Ensure refreshed access tokens include our custom claims so Admin route guard keeps working.
    - Hardened: when the user referenced by the token no longer exists, return a validation error
      instead of 500.
    """
    def validate(self, attrs):
        UserModel = get_user_model()
        # Catch a deleted user referenced by refresh token to avoid 500
        try:
            data = super().validate(attrs)
        except UserModel.DoesNotExist:
            raise serializers.ValidationError({"detail": "User for this token no longer exists."})
        # Keep default handling for other exceptions (e.g. invalid token/expiry)
        # to allow SimpleJWT to return the appropriate error response.
        # Add custom claims to the returned access token
        try:
            refresh = RefreshToken(attrs.get("refresh"))
            claim = api_settings.USER_ID_CLAIM
            field = api_settings.USER_ID_FIELD
            user_id = refresh.get(claim, None)
            if user_id is not None:
                user = UserModel.objects.filter(**{field: user_id}).first()
                if user:
                    access = refresh.access_token
                    access["role"] = user.role
                    access["username"] = user.username
                    access["full_name"] = getattr(user, "full_name", "") or ""
                    access["category"] = getattr(user, "category", "") or ""
                    access["role_effective"] = "business" if (getattr(user, "category", "") or "").lower() == "business" else user.role
                    access["is_staff"] = bool(getattr(user, "is_staff", False))
                    access["is_superuser"] = bool(getattr(user, "is_superuser", False))
                    data["access"] = str(access)
        except Exception:
            # If anything fails, return the default data without extra claims
            pass
        return data


class CustomTokenRefreshView(TokenRefreshView):
    serializer_class = CustomTokenRefreshSerializer
