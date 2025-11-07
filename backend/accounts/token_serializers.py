from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Allow login by phone for all user types.
        # If client sends "phone", or "username" is digits-only, map to actual username via phone/username lookup.
        initial = getattr(self, 'initial_data', {}) or {}
        raw_username = (initial.get('username') or '').strip()
        raw_phone = (initial.get('phone') or '').strip()

        def only_digits(s: str) -> str:
            return ''.join(c for c in (s or '') if c.isdigit())

        phone_digits = only_digits(raw_phone or raw_username)

        if phone_digits:
            try:
                User = get_user_model()
                # Try to resolve user by phone/digits or legacy username equal to digits
                u = User.objects.filter(Q(phone__iexact=phone_digits) | Q(username__iexact=phone_digits)).first()
                if u:
                    # Replace attrs username with the resolved actual username
                    attrs['username'] = u.username
            except Exception:
                # Fallback: let default validation handle errors
                pass

        data = super().validate(attrs)

        provided_role = initial.get('role')
        if provided_role and provided_role != getattr(self.user, 'role', None):
            raise serializers.ValidationError({'detail': 'Role mismatch: not authorized for this role.'})

        # Disable login for Business registrations
        if getattr(self.user, 'category', None) == 'business':
            raise serializers.ValidationError({'detail': 'Business login is disabled. Your registration will be processed by admin.'})
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
