from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.views import TokenRefreshView

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    require_admin_identity = False

    def validate(self, attrs):
        # Flexible identifier resolution:
        # - Accept exact username as-is
        # - If a 10-digit number is provided, try to resolve to prefixed usernames (TRBS, TR, TREP, TRPN, TRSF, TRST, TRDT)
        #   or plain digits (coordinators).
        # - If multiple accounts resolve for the same phone, return 400 with multiple_accounts to let client disambiguate.
        initial = getattr(self, "initial_data", {}) or {}
        raw_username = (initial.get("username") or attrs.get("username") or "").strip()
        password = (initial.get("password") or attrs.get("password") or "").strip()

        if not raw_username:
            raise serializers.ValidationError({"detail": "Username is required."})

        attrs["password"] = password

        def only_digits(s: str) -> str:
            return "".join(c for c in (s or "") if c.isdigit())

        digits = only_digits(raw_username)
        candidates = [raw_username]

        if digits and len(digits) >= 6:
            # Known registration prefixes
            prefixes = ["TRBS", "TR", "TREP", "TRPN", "TRSF", "TRST", "TRDT"]
            for p in prefixes:
                candidates.append(f"{p}{digits}")
            # Coordinators use plain digits as username
            candidates.append(digits)

            # Deduplicate while preserving order
            seen = set()
            uniq = []
            for c in candidates:
                k = c.lower()
                if k not in seen:
                    seen.add(k)
                    uniq.append(c)
            candidates = uniq

            # Resolve to existing accounts among candidates
            User = get_user_model()
            cond = Q()
            for c in candidates:
                cond |= Q(username__iexact=c)
            if digits:
                cond |= Q(phone__iexact=digits)
            matches = list(User.objects.filter(cond).only("id", "username", "role", "category"))

            if len(matches) == 1:
                attrs["username"] = matches[0].username
            elif len(matches) > 1:
                # Prefer exact typed username over other candidates
                exact = next((u for u in matches if str(u.username).lower() == str(raw_username).lower()), None)
                if exact:
                    attrs["username"] = exact.username
                else:
                    # If client supplied target role, prefer the right category
                    provided_role = (initial.get("role") or "").strip().lower()
                    preferred = None
                    if provided_role in ("business", "merchant"):
                        preferred = [u for u in matches if str(getattr(u, "category", "")).lower() in ("business", "merchant")]
                    elif provided_role == "employee":
                        preferred = [u for u in matches if (str(getattr(u, "role", "")).lower() == "employee" or str(getattr(u, "category", "")).lower() == "employee")]
                    elif provided_role == "agency":
                        preferred = [u for u in matches if str(getattr(u, "category", "")).lower().startswith("agency")]
                    elif provided_role == "user":
                        preferred = [u for u in matches if str(getattr(u, "category", "")).lower() == "consumer"]

                    if preferred and len(preferred) == 1:
                        attrs["username"] = preferred[0].username
                    else:
                        # Ask client to select one explicit username
                        raise serializers.ValidationError({
                            "detail": "Multiple accounts found for this identifier. Please login with an exact username.",
                            "multiple_accounts": [
                                {"username": u.username, "category": u.category, "role": u.role} for u in matches
                            ],
                        })
            else:
                # No candidate matched; fall back to raw username
                attrs["username"] = raw_username
        else:
            attrs["username"] = raw_username

        User = get_user_model()
        user_for_message = User.objects.filter(username__iexact=attrs.get("username")).first()
        if user_for_message:
            if not getattr(user_for_message, "is_active", False):
                raise serializers.ValidationError({"detail": "Account is inactive."})
            if not user_for_message.check_password(password):
                raise serializers.ValidationError({"detail": "Wrong password."})

        data = super().validate(attrs)

        identity_type = str(getattr(self.user, "identity_type", "") or "").upper()
        is_admin = identity_type == "ADMIN" or bool(getattr(self.user, "is_staff", False) or getattr(self.user, "is_superuser", False))
        if self.require_admin_identity:
            if not is_admin:
                raise serializers.ValidationError({"detail": "Not authorized for admin login."})
        elif is_admin:
            raise serializers.ValidationError({"detail": "Admin accounts must use the admin login."})

        # Optional: if the client provides a role, ensure it matches the user's role.
        # Skip strict role check when the user explicitly typed an exact username (to allow TRBS########## even if UI role defaulted to "user").
        provided_role = initial.get("role")
        exact_typed = str(raw_username or "").strip().lower() == str(attrs.get("username") or "").strip().lower()
        if provided_role and not exact_typed:
            pr = str(provided_role).strip().lower()
            user_role = str(getattr(self.user, "role", "") or "").strip().lower()
            user_cat = str(getattr(self.user, "category", "") or "").strip().lower()

            # Allow declared role OR special-case mappings:
            # - "business" or "merchant" are valid when user's category is business or merchant (even if role is "user")
            # - "consumer" is valid when role is "user" and category is consumer (legacy)
            # - "agency" is valid when role is "agency" or category starts with "agency_"
            # - "employee" is valid when role == "employee" or category == "employee"
            allowed = (
                pr == user_role
                or (pr in ("business", "merchant") and user_cat in ("business", "merchant"))
                or (pr == "consumer" and user_role == "user" and user_cat == "consumer")
                or (pr == "agency" and (user_role == "agency" or user_cat.startswith("agency")))
                or (pr == "employee" and (user_role == "employee" or user_cat == "employee"))
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
        cat = (getattr(user, 'category', '') or '').lower()
        token['role_effective'] = 'business' if cat in ('business', 'merchant') else user.role
        # Admin flags for guarding Admin UI routes
        token['is_staff'] = bool(getattr(user, 'is_staff', False))
        token['is_superuser'] = bool(getattr(user, 'is_superuser', False))
        token['identity_type'] = getattr(user, 'identity_type', '') or ('ADMIN' if getattr(user, 'is_staff', False) else 'END_USER')
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
                    cat = (getattr(user, "category", "") or "").lower()
                    access["role_effective"] = "business" if cat in ("business", "merchant") else user.role
                    access["is_staff"] = bool(getattr(user, "is_staff", False))
                    access["is_superuser"] = bool(getattr(user, "is_superuser", False))
                    access["identity_type"] = getattr(user, "identity_type", "") or ("ADMIN" if getattr(user, "is_staff", False) else "END_USER")
                    data["access"] = str(access)
        except Exception:
            # If anything fails, return the default data without extra claims
            pass
        return data


class CustomTokenRefreshView(TokenRefreshView):
    serializer_class = CustomTokenRefreshSerializer


class AdminTokenObtainPairSerializer(CustomTokenObtainPairSerializer):
    require_admin_identity = True
