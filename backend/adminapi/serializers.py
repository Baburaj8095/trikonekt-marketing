from rest_framework import serializers
from accounts.models import CustomUser, WithdrawalRequest, UserKYC, WalletTransaction, SupportTicket, SupportTicketMessage, AgencyRegionAssignment
from market.models import PurchaseRequest, BannerPurchaseRequest
from business.models import UserMatrixProgress, CommissionConfig, AutoPoolAccount
from locations.models import Country, State, City
from core.crypto import encrypt_string, decrypt_string
from django.core.mail import send_mail
from django.conf import settings
from locations.views import PINCODES_OFFLINE, india_place_variants
from django.db import transaction


class AdminUserNodeSerializer(serializers.ModelSerializer):
    state_name = serializers.SerializerMethodField()
    country_name = serializers.SerializerMethodField()
    district_name = serializers.SerializerMethodField()
    sponsor_id = serializers.SerializerMethodField()
    wallet_balance = serializers.SerializerMethodField()
    wallet_status = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    kyc_verified = serializers.SerializerMethodField()
    kyc_verified_at = serializers.SerializerMethodField()
    kyc_status = serializers.SerializerMethodField()
    commission_level = serializers.SerializerMethodField()
    direct_count = serializers.IntegerField(read_only=True)
    has_children = serializers.SerializerMethodField()
    has_usable_password = serializers.SerializerMethodField()
    password_status = serializers.SerializerMethodField()
    password_algo = serializers.SerializerMethodField()
    password_plain = serializers.SerializerMethodField()
    activated_ecoupon_count = serializers.SerializerMethodField()
    last_promo_package = serializers.SerializerMethodField()
    admin_role = serializers.SerializerMethodField()
    # Prime/Monthly purchase counts and monthly summary
    prime150_count = serializers.SerializerMethodField()
    prime750_count = serializers.SerializerMethodField()
    monthly_759_count = serializers.SerializerMethodField()
    monthly_current_number = serializers.SerializerMethodField()
    monthly_boxes_paid_current = serializers.SerializerMethodField()
    monthly_total_boxes_current = serializers.SerializerMethodField()
    monthly_boxes_remaining_current = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "username",
            "full_name",
            "email",
            "role",
            "category",
            "phone",
            "pincode",
            "district_name",
            "state_name",
            "country_name",
            "sponsor_id",
            "date_joined",
            "wallet_balance",
            "wallet_status",
            "avatar_url",
            "is_active",
            "is_staff",
            "is_superuser",
            "direct_count",
            "has_children",
            "has_usable_password",
            "password_status",
            "password_algo",
            "password_plain",
            "kyc_verified",
            "kyc_verified_at",
            "kyc_status",
            "commission_level",
            "activated_ecoupon_count",
            "last_promo_package",
            "admin_role",
            # Prime/Monthly purchase counts
            "prime150_count",
            "prime750_count",
            "monthly_759_count",
            # Monthly summary for current package number
            "monthly_current_number",
            "monthly_boxes_paid_current",
            "monthly_total_boxes_current",
            "monthly_boxes_remaining_current",
            "account_active",
        ]

    def get_state_name(self, obj):
        try:
            if getattr(obj, "state_id", None):
                return obj.state.name
            # Fallback via prefetched agency assignments when state FK isn't set on user
            try:
                pref = getattr(obj, "prefetched_agency_assignments", None)
                if pref is not None:
                    assn = pref[0] if len(pref) > 0 else None
                else:
                    assn = (
                        AgencyRegionAssignment.objects.select_related("state")
                        .filter(user_id=getattr(obj, "id", None))
                        .order_by("id")
                        .first()
                    )
            except Exception:
                assn = None
            if assn and getattr(assn, "state", None):
                return assn.state.name or ""
            return ""
        except Exception:
            return ""

    def get_country_name(self, obj):
        try:
            if getattr(obj, "country_id", None):
                return obj.country.name
            # Derive from user's state if present
            try:
                if getattr(obj, "state_id", None) and getattr(obj.state, "country_id", None):
                    return obj.state.country.name or ""
            except Exception:
                pass
            # Fallback via agency assignments
            try:
                pref = getattr(obj, "prefetched_agency_assignments", None)
                if pref is not None:
                    assn = pref[0] if len(pref) > 0 else None
                else:
                    assn = (
                        AgencyRegionAssignment.objects.select_related("state__country")
                        .filter(user_id=getattr(obj, "id", None))
                        .order_by("id")
                        .first()
                    )
            except Exception:
                assn = None
            if assn and getattr(assn, "state", None) and getattr(assn.state, "country_id", None):
                return assn.state.country.name or ""
            return ""
        except Exception:
            return ""

    def get_district_name(self, obj):
        try:
            # Prefer City FK when present
            if getattr(obj, "city_id", None):
                return obj.city.name
            # Fallback via agency assignments where district is stored as a string
            try:
                pref = getattr(obj, "prefetched_agency_assignments", None)
                if pref is not None:
                    assn = pref[0] if len(pref) > 0 else None
                else:
                    assn = (
                        AgencyRegionAssignment.objects
                        .filter(user_id=getattr(obj, "id", None))
                        .order_by("id")
                        .first()
                    )
            except Exception:
                assn = None
            if assn and getattr(assn, "district", ""):
                return assn.district or ""
            return ""
        except Exception:
            return ""

    def get_sponsor_id(self, obj):
        try:
            # Prefer the stored sponsor_id when set; fall back to registered_by when empty
            sid = (getattr(obj, "sponsor_id", "") or "").strip()

            # If stored sponsor_id equals self identifiers, hide it
            uname = (getattr(obj, "username", "") or "").strip()
            pid = (getattr(obj, "prefixed_id", "") or "").strip()
            pid2 = pid.replace("-", "") if pid else ""
            if sid:
                if sid.lower() in {uname.lower(), pid.lower(), pid2.lower()}:
                    return ""
                return sid

            # Fallback to the actual upline (registered_by) used during registration
            rb = getattr(obj, "registered_by", None)
            if rb:
                # Username is commonly used as sponsor code; fallback to prefixed_id
                val = (getattr(rb, "username", "") or "").strip() or (getattr(rb, "prefixed_id", "") or "").strip()
                if val:
                    return val

            return ""
        except Exception:
            return (getattr(obj, "sponsor_id", "") or "")

    def get_wallet_balance(self, obj):
        try:
            w = getattr(obj, "wallet", None)
            if not w:
                return ""
            # Prefer main_balance if present, fall back to balance
            bal = getattr(w, "main_balance", None)
            if bal is None:
                bal = getattr(w, "balance", None)
            return float(bal) if bal is not None else ""
        except Exception:
            return ""

    def get_wallet_status(self, obj):
        try:
            # No explicit status field in Wallet; show "OK" if wallet exists
            return "OK" if getattr(obj, "wallet", None) else ""
        except Exception:
            return ""

    def get_avatar_url(self, obj):
        try:
            f = getattr(obj, "avatar", None)
            if not f:
                return ""
            # If the stored name is already an absolute URL (Cloudinary), return it verbatim
            try:
                name = getattr(f, "name", "") or ""
                if isinstance(name, str) and (name.startswith("http://") or name.startswith("https://")):
                    return name
            except Exception:
                pass

            # Best-effort migrate local avatar to Cloudinary on read if configured
            try:
                import os
                if os.environ.get("CLOUDINARY_URL"):
                    file_obj = None
                    try:
                        f.open("rb")
                        file_obj = getattr(f, "file", None) or f
                    except Exception:
                        file_obj = None
                    if file_obj is not None:
                        try:
                            from cloudinary import uploader as _clduploader  # type: ignore
                            try:
                                file_obj.seek(0)
                            except Exception:
                                pass
                            res = _clduploader.upload(
                                file_obj,
                                folder="uploads/profile",
                                resource_type="image",
                                invalidate=True,
                            )
                            url2 = (res or {}).get("secure_url") or (res or {}).get("url")
                            if url2:
                                obj.avatar.name = url2
                                obj.save(update_fields=["avatar"])
                                return url2
                        except Exception:
                            pass
            except Exception:
                pass

            # Else, fall back to storage-provided URL (relative under MEDIA_URL)
            url = getattr(f, "url", "") or ""
            if not url:
                return ""
            # Fix corrupted MEDIA URL that percent-encodes a remote absolute URL (e.g., /media/https%3A/...)
            # Also handle single-slash forms like "https:/res.cloudinary.com" and normalize to "https://..."
            try:
                from urllib.parse import unquote
                import re
                decoded = unquote(url)
                m = re.search(r"(https?:/{1,2}[^\"\\s]+)", decoded)
                if m:
                    remote = m.group(1)
                    # Normalize single slash to double slash
                    remote = remote.replace("https:/", "https://").replace("http:/", "http://")
                    # Persist cleaned remote URL for future requests
                    try:
                        obj.avatar.name = remote
                        obj.save(update_fields=["avatar"])
                    except Exception:
                        pass
                    return remote
            except Exception:
                pass
            req = getattr(self, "context", {}).get("request", None)
            if req:
                try:
                    return req.build_absolute_uri(url)
                except Exception:
                    pass
            return url
        except Exception:
            return ""

    def get_has_children(self, obj):
        try:
            dc = getattr(obj, "direct_count", 0) or 0
            return dc > 0
        except Exception:
            return False

    def get_kyc_verified(self, obj):
        try:
            kyc = getattr(obj, "kyc", None)
            return bool(getattr(kyc, "verified", False)) if kyc else False
        except Exception:
            return False

    def get_kyc_verified_at(self, obj):
        try:
            kyc = getattr(obj, "kyc", None)
            return getattr(kyc, "verified_at", None) if kyc else None
        except Exception:
            return None

    def get_kyc_status(self, obj):
        try:
            kyc = getattr(obj, "kyc", None)
            if not kyc:
                return ""
            return "Verified" if bool(getattr(kyc, "verified", False)) else "Pending"
        except Exception:
            return ""

    def get_commission_level(self, obj):
        try:
            # Prefer prefetched related manager 'matrix_progress'
            mp = getattr(obj, "matrix_progress", None)
            items = None
            try:
                items = list(mp.all()) if mp is not None else None
            except Exception:
                items = None
            if items is None:
                items = list(UserMatrixProgress.objects.filter(user_id=getattr(obj, "id", None)))
            lvl = 0
            for rec in (items or []):
                try:
                    lvl = max(lvl, int(getattr(rec, "level_reached", 0) or 0))
                except Exception:
                    pass
            return int(lvl)
        except Exception:
            return 0

    def get_has_usable_password(self, obj):
        """
        Return True only when a real, usable hashed password is present.
        Handle edge cases where password is empty string ('') which Django's
        has_usable_password may treat as usable in some versions.
        """
        try:
            from django.contrib.auth.hashers import UNUSABLE_PASSWORD_PREFIX
        except Exception:
            UNUSABLE_PASSWORD_PREFIX = "!"  # fallback

        try:
            pwd = getattr(obj, "password", "") or ""
            # Empty or too short strings are not real hashes
            if not isinstance(pwd, str) or len(pwd) < 20:
                return False
            # Explicit unusable marker
            if pwd.startswith(UNUSABLE_PASSWORD_PREFIX):
                return False
            # Prefer model API if available
            if hasattr(obj, "has_usable_password"):
                try:
                    return bool(obj.has_usable_password())
                except Exception:
                    pass
            # Heuristic: known hash prefixes
            known_prefixes = ("pbkdf2_", "argon2", "bcrypt", "scrypt")
            return any(pwd.startswith(pfx) for pfx in known_prefixes)
        except Exception:
            return False

    def get_password_status(self, obj):
        """
        Human-readable password status for admin grid: Usable | Unusable | Empty.
        """
        try:
            pwd = getattr(obj, "password", "") or ""
            if not isinstance(pwd, str) or len(pwd) < 20:
                return "Empty"
            try:
                from django.contrib.auth.hashers import UNUSABLE_PASSWORD_PREFIX
                if pwd.startswith(UNUSABLE_PASSWORD_PREFIX):
                    return "Unusable"
            except Exception:
                pass
            if hasattr(obj, "has_usable_password"):
                try:
                    return "Usable" if obj.has_usable_password() else "Unusable"
                except Exception:
                    pass
            # Fallback heuristic
            known_prefixes = ("pbkdf2_", "argon2", "bcrypt", "scrypt")
            return "Usable" if any(pwd.startswith(pfx) for pfx in known_prefixes) else "Unusable"
        except Exception:
            return "Empty"

    def get_password_algo(self, obj):
        """
        Return the password hash algorithm (e.g., pbkdf2_sha256, bcrypt, argon2).
        Do NOT expose the hash or salt; only a readable algorithm label.
        Empty string when password is empty or unusable.
        """
        try:
            from django.contrib.auth.hashers import UNUSABLE_PASSWORD_PREFIX
        except Exception:
            UNUSABLE_PASSWORD_PREFIX = "!"  # fallback

        try:
            pwd = getattr(obj, "password", "") or ""
            if not isinstance(pwd, str) or len(pwd) < 20:
                return ""
            if pwd.startswith(UNUSABLE_PASSWORD_PREFIX):
                return ""
            # Django encoded passwords are "algorithm$..." (pbkdf2_sha256$..., bcrypt$..., argon2$argon2id$...)
            algo = pwd.split("$", 1)[0]
            return str(algo) if algo else ""
        except Exception:
            return ""


    def get_password_plain(self, obj):
        # Performance guard: never decrypt in list views
        try:
            ctx = getattr(self, "context", {}) or {}
            if ctx.get("purpose") != "detail":
                return ""
            req = ctx.get("request")
            u = getattr(req, "user", None) if req else None
            # Allow both superusers and staff (admin panel operators) to view last-set plaintext
            if not u or not (getattr(u, "is_superuser", False) or getattr(u, "is_staff", False)):
                return ""
            token = getattr(obj, "last_password_encrypted", None)
            if not token:
                return ""
            plain = decrypt_string(token)
            return plain or ""
        except Exception:
            return ""


    def get_activated_ecoupon_count(self, obj):
        """
        Activated E‑Coupons shown in Admin Users:
        - Physical/Lucky path: count of AGENCY_APPROVED submissions by the user
        - E‑Coupon path: unique coupon codes either ACTIVATED (audit) or REDEEMED
          (union of coupon_code ids to avoid double counting).
        """
        try:
            ctx = getattr(self, "context", {}) or {}
            if ctx.get("purpose") != "detail":
                return int(getattr(obj, "activated_ecoupon_count", 0) or 0)
            uid = getattr(obj, "id", None)
            if not uid:
                return 0
            from coupons.models import CouponSubmission, AuditTrail, CouponCode
            # Physical coupons via submission approvals
            sub_cnt = int(
                CouponSubmission.objects.filter(
                    consumer_id=uid, status="AGENCY_APPROVED"
                ).count()
            )
            # E‑coupon activations via explicit activation endpoint (distinct coupon_code_id)
            act_ids = list(
                AuditTrail.objects.filter(
                    action="coupon_activated", actor_id=uid
                ).values_list("coupon_code_id", flat=True).distinct()
            )
            # E‑coupon redemptions (owned by this user)
            red_ids = list(
                CouponCode.objects.filter(
                    assigned_consumer_id=uid, status="REDEEMED"
                ).values_list("id", flat=True)
            )
            # Unique set of e‑coupon codes that are activated/redeemed
            ecodes = set([i for i in act_ids if i] + [i for i in red_ids if i])
            return sub_cnt + len(ecodes)
        except Exception:
            return 0

    def get_last_promo_package(self, obj):
        try:
            # Prefer prefetched approved purchases (to_attr="approved_promo_purchases") to avoid N+1
            pp = None
            try:
                pre = getattr(obj, "approved_promo_purchases", None)
                if isinstance(pre, list) and pre:
                    pp = pre[0]
            except Exception:
                pp = None
            if pp is None:
                from business.models import PromoPurchase
                pp = (
                    PromoPurchase.objects.select_related("package")
                    .filter(user_id=getattr(obj, "id", None), status="APPROVED")
                    .order_by("-approved_at", "-id")
                    .first()
                )
            if not pp:
                return ""
            pkg = getattr(pp, "package", None)
            code = (getattr(pkg, "code", "") or "").strip()
            name = (getattr(pkg, "name", "") or "").strip()
            return f"{code} — {name}" if code and name else (name or code or "")
        except Exception:
            return ""

    def get_admin_role(self, obj):
        try:
            rid = getattr(obj, "admin_role_id", None)
            if not rid:
                return None
            name = getattr(getattr(obj, "admin_role", None), "name", None)
            return {"id": rid, "name": name}
        except Exception:
            return None

    # -------- Prime/Monthly counters and monthly summary --------
    def _approved_promo_purchases(self, obj):
        try:
            pre = getattr(obj, "approved_promo_purchases", None)
            if isinstance(pre, list):
                return pre
        except Exception:
            pass
        # Fallback: fetch minimal fields if not prefetched (e.g., export path)
        try:
            from business.models import PromoPurchase
            return list(
                PromoPurchase.objects.select_related("package")
                .filter(user_id=getattr(obj, "id", None), status="APPROVED")
                .order_by("-approved_at", "-id")
            )
        except Exception:
            return []

    def get_prime150_count(self, obj) -> int:
        try:
            from decimal import Decimal as D
            cnt = 0
            for p in self._approved_promo_purchases(obj):
                try:
                    typ = str(getattr(getattr(p, "package", None), "type", "") or "")
                    price = D(str(getattr(getattr(p, "package", None), "price", "0") or "0"))
                    if typ == "PRIME" and (abs(price - D("150")) <= D("0.5")):
                        cnt += 1
                except Exception:
                    continue
            return int(cnt)
        except Exception:
            return 0

    def get_prime750_count(self, obj) -> int:
        try:
            from decimal import Decimal as D
            cnt = 0
            for p in self._approved_promo_purchases(obj):
                try:
                    typ = str(getattr(getattr(p, "package", None), "type", "") or "")
                    price = D(str(getattr(getattr(p, "package", None), "price", "0") or "0"))
                    if typ == "PRIME" and (abs(price - D("750")) <= D("0.5")):
                        cnt += 1
                except Exception:
                    continue
            return int(cnt)
        except Exception:
            return 0

    def get_monthly_759_count(self, obj) -> int:
        """
        Sum of quantity across approved MONTHLY purchases (fallback to len(boxes_json) when quantity missing).
        """
        try:
            total = 0
            for p in self._approved_promo_purchases(obj):
                try:
                    if str(getattr(getattr(p, "package", None), "type", "") or "") != "MONTHLY":
                        continue
                    q = getattr(p, "quantity", None)
                    if q is None:
                        try:
                            boxes = list(getattr(p, "boxes_json", []) or [])
                            q = len(boxes)
                        except Exception:
                            q = 0
                    total += int(q or 0)
                except Exception:
                    continue
            return int(total)
        except Exception:
            return 0

    def _monthly_summary(self, obj):
        """
        Returns tuple:
          (current_number, boxes_paid_current, total_boxes_current, remaining_current)
        Defaults: (None, 0, 12, 12)
        """
        try:
            purchases = [p for p in self._approved_promo_purchases(obj)
                         if str(getattr(getattr(p, "package", None), "type", "") or "") == "MONTHLY"]
            if not purchases:
                return (None, 0, 12, 12)

            # Pick a monthly package (most recent approved)
            try:
                pkg = getattr(purchases[0], "package", None)
            except Exception:
                pkg = None

            # Seed totals per number (optional)
            totals = {}
            try:
                from business.models import PromoMonthlyPackage
                for s in PromoMonthlyPackage.objects.filter(package=pkg, is_active=True).order_by("number"):
                    try:
                        tb = int(getattr(s, "total_boxes", 12) or 12)
                        if tb <= 0:
                            tb = 12
                        totals[int(getattr(s, "number", 0) or 0)] = tb
                    except Exception:
                        continue
            except Exception:
                totals = {}

            def total_for(n: int) -> int:
                try:
                    if int(n) in totals:
                        return int(totals[int(n)])
                except Exception:
                    pass
                return 12

            # Paid boxes per package_number for this user+package
            from django.db.models import Count
            try:
                from business.models import PromoMonthlyBox
                agg = (
                    PromoMonthlyBox.objects.filter(user_id=getattr(obj, "id", None), package=pkg)
                    .values("package_number")
                    .annotate(c=Count("id"))
                )
                paid_map = {int(row["package_number"]): int(row["c"] or 0) for row in agg}
            except Exception:
                paid_map = {}

            # Determine current number = smallest number where paid < total
            # Use seeded numbers if present; else consider keys present in paid_map ascending, then fallback to 1
            numbers = sorted(totals.keys()) if totals else sorted(set(list(paid_map.keys()) + [1]))
            if not numbers:
                numbers = [1]
            current = None
            for n in numbers:
                if int(paid_map.get(n, 0)) < int(total_for(n)):
                    current = int(n)
                    break
            if current is None:
                current = int(numbers[-1])

            paid = int(paid_map.get(current, 0))
            total = int(total_for(current))
            remaining = max(0, total - paid)
            return (current, paid, total, remaining)
        except Exception:
            return (None, 0, 12, 12)

    def get_monthly_current_number(self, obj):
        try:
            cur, _, _, _ = self._monthly_summary(obj)
            return cur
        except Exception:
            return None

    def get_monthly_boxes_paid_current(self, obj) -> int:
        try:
            _, paid, _, _ = self._monthly_summary(obj)
            return int(paid)
        except Exception:
            return 0

    def get_monthly_total_boxes_current(self, obj) -> int:
        try:
            _, __, total, _ = self._monthly_summary(obj)
            return int(total)
        except Exception:
            return 12

    def get_monthly_boxes_remaining_current(self, obj) -> int:
        try:
            _, __, ___, rem = self._monthly_summary(obj)
            return int(rem)
        except Exception:
            return 12

class AdminKYCSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    state_name = serializers.SerializerMethodField()
    pincode = serializers.CharField(source="user.pincode", read_only=True)

    class Meta:
        model = UserKYC
        fields = [
            "user_id",
            "username",
            "full_name",
            "phone",
            "state_name",
            "pincode",
            "bank_name",
            "bank_account_number",
            "ifsc_code",
            "verified",
            "verified_at",
            "updated_at",
        ]

    def get_state_name(self, obj):
        try:
            st = getattr(obj.user, "state", None)
            return st.name if st else ""
        except Exception:
            return ""


class AdminWithdrawalSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)

    class Meta:
        model = WithdrawalRequest
        fields = [
            "id",
            "user_id",
            "username",
            "full_name",
            "phone",
            "amount",
            "method",
            "upi_id",
            "bank_name",
            "bank_account_number",
            "ifsc_code",
            "status",
            "note",
            "payout_ref",
            "requested_at",
            "decided_at",
        ]


class AdminMatrixProgressSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)

    class Meta:
        model = UserMatrixProgress
        fields = [
            "user_id",
            "username",
            "full_name",
            "phone",
            "pool_type",
            "total_earned",
            "level_reached",
            "per_level_counts",
            "per_level_earned",
            "updated_at",
        ]


class AdminWalletTransactionSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = WalletTransaction
        fields = [
            "id",
            "user_id",
            "username",
            "type",
            "amount",
            "balance_after",
            "meta",
            "created_at",
        ]


class AdminAutopoolTxnSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    prefixed_id = serializers.SerializerMethodField()
    sponsor_id = serializers.SerializerMethodField()
    net_amount = serializers.SerializerMethodField()
    main_balance = serializers.SerializerMethodField()
    withdrawable_balance = serializers.SerializerMethodField()
    level_index = serializers.SerializerMethodField()

    class Meta:
        model = WalletTransaction
        fields = [
            "id",
            "user_id",
            "username",
            "full_name",
            "prefixed_id",
            "sponsor_id",
            "type",
            "source_type",
            "amount",
            "net_amount",
            "main_balance",
            "withdrawable_balance",
            "level_index",
            "created_at",
        ]

    def get_prefixed_id(self, obj):
        try:
            return getattr(obj.user, "prefixed_id", "") or ""
        except Exception:
            return ""

    def get_sponsor_id(self, obj):
        try:
            return getattr(obj.user, "sponsor_id", "") or ""
        except Exception:
            return ""

    def get_net_amount(self, obj):
        try:
            meta = getattr(obj, "meta", None) or {}
            net = meta.get("net")
            if net is None:
                # No withholding meta recorded -> treat gross as net
                return float(obj.amount or 0)
            try:
                return float(net)
            except Exception:
                from decimal import Decimal as D
                return float(D(str(net or "0")))
        except Exception:
            return float(obj.amount or 0)

    def get_main_balance(self, obj):
        try:
            w = getattr(obj.user, "wallet", None)
            if not w:
                return 0.0
            return float(getattr(w, "main_balance", 0) or 0)
        except Exception:
            return 0.0

    def get_withdrawable_balance(self, obj):
        try:
            w = getattr(obj.user, "wallet", None)
            if not w:
                return 0.0
            return float(getattr(w, "withdrawable_balance", 0) or 0)
        except Exception:
            return 0.0

    def get_level_index(self, obj):
        try:
            meta = getattr(obj, "meta", None) or {}
            val = meta.get("level_index")
            if val is None:
                return None
            try:
                return int(val)
            except Exception:
                from decimal import Decimal as D
                return int(D(str(val)))
        except Exception:
            return None


class AdminCompanyTaxPayoutSerializer(serializers.ModelSerializer):
    tax_tx_id = serializers.IntegerField(source="tax_tx.id", read_only=True)
    source_user_id = serializers.IntegerField(source="source_user.id", read_only=True)
    source_username = serializers.CharField(source="source_user.username", read_only=True)
    beneficiary_id = serializers.IntegerField(source="beneficiary.id", read_only=True)
    beneficiary_username = serializers.CharField(source="beneficiary.username", read_only=True)
    beneficiary_category = serializers.CharField(source="beneficiary.category", read_only=True)

    class Meta:
        model = __import__("business.models", fromlist=["CompanyCommissionPayout"]).CompanyCommissionPayout  # late import to avoid circular at load time
        fields = [
            "id",
            "tax_tx_id",
            "source_user_id",
            "source_username",
            "beneficiary_id",
            "beneficiary_username",
            "beneficiary_category",
            "pool_key",
            "role_key",
            "amount",
            "metadata",
            "created_at",
        ]


class AdminUserEditSerializer(serializers.ModelSerializer):
    """
    Admin-side editable fields for a user. Primary keys for geo fields.
    """
    country = serializers.PrimaryKeyRelatedField(queryset=Country.objects.all(), required=False, allow_null=True)
    state = serializers.PrimaryKeyRelatedField(queryset=State.objects.all(), required=False, allow_null=True)
    city = serializers.PrimaryKeyRelatedField(queryset=City.objects.all(), required=False, allow_null=True)
    # Write-only password field to allow admin reset; Django stores hashed passwords (non-reversible)
    password = serializers.CharField(write_only=True, required=False, allow_blank=False, min_length=8)

    # Admin-only region assignment inputs (write-only)
    assign_states = serializers.ListField(child=serializers.IntegerField(), required=False, write_only=True)
    assign_districts = serializers.ListField(child=serializers.CharField(allow_blank=False), required=False, write_only=True)
    assign_pincodes = serializers.ListField(child=serializers.RegexField(r'^\d{6}$'), required=False, write_only=True)

    # Read-only current assignments for prefill
    states_assigned = serializers.SerializerMethodField(read_only=True)
    districts_assigned = serializers.SerializerMethodField(read_only=True)
    pincodes_assigned = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CustomUser
        fields = [
            "email",
            "full_name",
            "username",
            "phone",
            "age",
            "address",
            "pincode",
            "role",
            "category",
            "country",
            "state",
            "city",
            "sponsor_id",
            "account_active",
            "is_active",
            "password",
            # Admin-only region assignments (write-only)
            "assign_states",
            "assign_districts",
            "assign_pincodes",
            # Read-only current assignments for prefill
            "states_assigned",
            "districts_assigned",
            "pincodes_assigned",
        ]

    def update(self, instance, validated_data):
        # Accept only whitelisted fields from admin edit dialog and grid toggles
        password = validated_data.pop("password", None)

        # Extract assignment arrays (admin-only, write-only)
        assign_states = validated_data.pop("assign_states", None)
        assign_districts = validated_data.pop("assign_districts", None)
        assign_pincodes = validated_data.pop("assign_pincodes", None)

        # Capture current username and handle explicit username update intent
        old_username = (getattr(instance, "username", "") or "")
        explicit_username = None
        if "username" in validated_data:
            explicit_username = str(validated_data.get("username") or "").strip()
            if explicit_username:
                # Enforce uniqueness (case-insensitive) excluding this user
                if CustomUser.objects.filter(username__iexact=explicit_username).exclude(pk=instance.pk).exists():
                    raise serializers.ValidationError({"username": "Username already in use."})

        # Drop any keys not in allowed set (server-side enforcement)
        allowed = {"email", "full_name", "username", "phone", "pincode", "state", "city", "account_active", "sponsor_id"}
        for k in list(validated_data.keys()):
            if k not in allowed:
                validated_data.pop(k, None)

        # Permission: Allow superuser or admins with edit_users/manage_users to modify sponsor_id; strip whitespace
        request = getattr(self, "context", {}).get("request", None)
        if "sponsor_id" in validated_data:
            u = getattr(request, "user", None)
            is_super = bool(getattr(u, "is_superuser", False))
            can_edit = is_super
            if not can_edit:
                try:
                    from .permissions import get_effective_permissions
                    perms = get_effective_permissions(u)
                    can_edit = ("*" in perms) or ("manage_users" in perms) or ("edit_users" in perms)
                except Exception:
                    can_edit = False
            if not can_edit:
                validated_data.pop("sponsor_id", None)
            else:
                sid = validated_data.get("sponsor_id")
                if isinstance(sid, str):
                    validated_data["sponsor_id"] = sid.strip()

        # Normalize phone to digits and stage username update if phone provided
        new_username = None
        if "phone" in validated_data:
            digits = "".join(ch for ch in str(validated_data.get("phone") or "") if ch.isdigit())
            validated_data["phone"] = digits
            if digits and digits != (instance.phone or ""):
                # Propose username = phone; ensure global uniqueness
                desired = digits
                exists = CustomUser.objects.filter(username__iexact=desired).exclude(pk=instance.pk).exists()
                if exists:
                    desired = f"{digits}-{instance.id or ''}".strip("-")
                    if CustomUser.objects.filter(username__iexact=desired).exclude(pk=instance.pk).exists():
                        desired = f"{digits}-{instance.pk}"
                new_username = desired

        # Persist basic field updates (account_active, phone, pincode, sponsor_id)
        instance = super().update(instance, validated_data)

        # Apply explicit username if provided, else sync username from phone change
        if explicit_username:
            if explicit_username != instance.username:
                instance.username = explicit_username
        elif new_username and new_username != instance.username:
            instance.username = new_username

        # Handle pincode -> auto assign geo FKs
        if "pincode" in validated_data:
            pin = (instance.pincode or "").strip()
            country_name = state_name = city_name = None
            try:
                # Offline fast path
                offline = PINCODES_OFFLINE.get(pin)
                if offline:
                    country_name = (offline.get("country") or "India") or None
                    state_name = offline.get("state") or None
                    city_name = offline.get("district") or offline.get("city") or None
                else:
                    # Network fallback via India Post
                    import requests
                    r = requests.get(f"https://api.postalpincode.in/pincode/{pin}", timeout=12)
                    if r.status_code == 200:
                        arr = r.json() or []
                        if isinstance(arr, list) and arr:
                            entry = arr[0] or {}
                            if entry.get("Status") == "Success":
                                offices = entry.get("PostOffice") or []
                                if offices:
                                    po = offices[0]
                                    country_name = po.get("Country") or "India"
                                    state_name = po.get("State") or None
                                    city_name = po.get("District") or po.get("Name") or None
            except Exception:
                pass

            # Resolve/assign FKs best-effort (case-insensitive by name)
            try:
                if country_name:
                    ctry = Country.objects.filter(name__iexact=country_name).first()
                else:
                    ctry = Country.objects.filter(name__iexact="India").first()
                if ctry:
                    instance.country = ctry
                if state_name:
                    st = State.objects.filter(name__iexact=state_name)
                    if ctry:
                        st = st.filter(country=ctry)
                    st = st.first()
                    if st:
                        instance.state = st
                        if city_name:
                            ci = City.objects.filter(name__iexact=city_name, state=st).first()
                            if not ci:
                                try:
                                    for v in (india_place_variants(city_name) or []):
                                        ci = City.objects.filter(name__iexact=v, state=st).first()
                                        if ci:
                                            break
                                except Exception:
                                    ci = None
                            if ci:
                                instance.city = ci
            except Exception:
                # Do not block save on mapping errors
                pass

        # Handle password change: set and email plaintext to user
        if password:
            instance.set_password(password)
            try:
                enc = encrypt_string(password)
                instance.last_password_encrypted = enc
            except Exception:
                pass
            # Send email with plaintext password (per requirement)
            try:
                to = (instance.email or "").strip()
                if to:
                    subject = "Your password was changed"
                    body_lines = [
                        f"Hello {instance.full_name or instance.username},",
                        "",
                        "Your account password has been reset by an administrator.",
                        f"Username: {instance.username}",
                        f"New Password: {password}",
                        "",
                        "If you did not expect this change, please contact support immediately.",
                    ]
                    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or "no-reply@localhost"
                    send_mail(subject, "\n".join(body_lines), from_email, [to], fail_silently=True)
            except Exception:
                pass

        # Persist all accumulated changes
        username_before_save = getattr(instance, "username", None)
        try:
            instance.save()
        except Exception:
            instance.save()

        # Cascade sponsor_id when username changes: update all users whose sponsor_id equals old username
        try:
            if old_username and username_before_save and str(old_username).strip().lower() != str(username_before_save).strip().lower():
                with transaction.atomic():
                    CustomUser.objects.filter(sponsor_id__iexact=old_username).update(sponsor_id=username_before_save)
        except Exception:
            pass

        # Apply region assignments if provided (coordinator categories)
        try:
            cat = str(getattr(instance, "category", "")).lower()
            # State Coordinator: assign up to 2 states
            if isinstance(assign_states, list) and cat == "agency_state_coordinator":
                allowed_ids = []
                for x in assign_states:
                    try:
                        xi = int(x)
                        allowed_ids.append(xi)
                    except Exception:
                        continue
                from locations.models import State as _St
                states = list(_St.objects.filter(id__in=allowed_ids))[:2]
                # Remove unselected
                instance.region_assignments.filter(level="state").exclude(state__in=states).delete()
                # Ensure selected
                for st in states:
                    AgencyRegionAssignment.objects.get_or_create(
                        user=instance, level="state", state=st, defaults={"district": "", "pincode": ""}
                    )

            # District Coordinator: assign up to 2 districts under current state
            if isinstance(assign_districts, list) and cat == "agency_district_coordinator":
                sel_state = getattr(instance, "state", None)
                if sel_state:
                    # Normalize districts (de-dup, preserve order)
                    dnorm = []
                    seen = set()
                    for d in assign_districts:
                        s = str(d or "").strip()
                        if not s:
                            continue
                        lk = s.lower()
                        if lk in seen:
                            continue
                        seen.add(lk)
                        dnorm.append(s)
                    dnorm = dnorm[:2]
                    instance.region_assignments.filter(level="district", state=sel_state).exclude(district__in=dnorm).delete()
                    for d in dnorm:
                        AgencyRegionAssignment.objects.get_or_create(
                            user=instance, level="district", state=sel_state, district=d, defaults={"pincode": ""}
                        )

            # Pincode Coordinator: assign up to 4 pincodes under current state/district
            if isinstance(assign_pincodes, list) and cat == "agency_pincode_coordinator":
                sel_state = getattr(instance, "state", None)
                try:
                    dname = (getattr(getattr(instance, "city", None), "name", "") or "").strip()
                except Exception:
                    dname = ""
                pins = []
                seenp = set()
                for p in assign_pincodes:
                    s = "".join(ch for ch in str(p or "") if ch.isdigit())
                    if len(s) == 6 and s not in seenp:
                        seenp.add(s)
                        pins.append(s)
                pins = pins[:4]
                if pins:
                    instance.region_assignments.filter(level="pincode").exclude(pincode__in=pins).delete()
                else:
                    # Explicitly clear when empty array provided
                    instance.region_assignments.filter(level="pincode").delete()
                for p in pins:
                    AgencyRegionAssignment.objects.get_or_create(
                        user=instance, level="pincode", state=sel_state, district=dname, pincode=p
                    )
        except Exception:
            # Best-effort; do not block admin edit if assignments fail
            pass

        return instance

    def get_states_assigned(self, obj):
        try:
            rows = AgencyRegionAssignment.objects.select_related("state").filter(user_id=getattr(obj, "id", None), level="state")
            out = []
            for a in rows:
                if getattr(a, "state_id", None) and getattr(a, "state", None):
                    out.append({"id": a.state_id, "name": a.state.name or ""})
            return out
        except Exception:
            return []

    def get_districts_assigned(self, obj):
        try:
            qs = AgencyRegionAssignment.objects.filter(user_id=getattr(obj, "id", None), level="district")
            # If user's primary state is set, filter to it
            st_id = getattr(obj, "state_id", None)
            if st_id:
                qs = qs.filter(state_id=st_id)
            names = []
            seen = set()
            for a in qs.only("district"):
                d = (getattr(a, "district", "") or "").strip()
                if d and d.lower() not in seen:
                    seen.add(d.lower())
                    names.append(d)
            return names
        except Exception:
            return []

    def get_pincodes_assigned(self, obj):
        try:
            qs = AgencyRegionAssignment.objects.filter(user_id=getattr(obj, "id", None), level="pincode")
            pins = []
            seen = set()
            for a in qs.only("pincode"):
                p = (getattr(a, "pincode", "") or "").strip()
                if p and p not in seen:
                    seen.add(p)
                    pins.append(p)
            return pins
        except Exception:
            return []


class AdminPurchaseRequestSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(source="product.id", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    owner_username = serializers.CharField(source="product.created_by.username", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = PurchaseRequest
        fields = [
            "id",
            "product_id",
            "product_name",
            "consumer_name",
            "consumer_email",
            "consumer_phone",
            "consumer_address",
            "quantity",
            "payment_method",
            "status",
            "owner_username",
            "created_by_username",
            "created_at",
        ]


class AdminBannerPurchaseRequestSerializer(serializers.ModelSerializer):
    banner_id = serializers.IntegerField(source="banner.id", read_only=True)
    banner_title = serializers.CharField(source="banner.title", read_only=True)
    banner_item_id = serializers.IntegerField(source="banner_item.id", read_only=True)
    item_name = serializers.CharField(source="banner_item.name", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = BannerPurchaseRequest
        fields = [
            "id",
            "banner_id",
            "banner_title",
            "banner_item_id",
            "item_name",
            "consumer_name",
            "consumer_email",
            "consumer_phone",
            "consumer_address",
            "quantity",
            "payment_method",
            "status",
            "created_by_username",
            "created_at",
        ]


class AdminSupportTicketMessageSerializer(serializers.ModelSerializer):
    author_username = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = SupportTicketMessage
        fields = ["id", "author", "author_username", "message", "created_at"]
        read_only_fields = ["id", "author_username", "created_at"]

    def get_author_username(self, obj):
        try:
            return getattr(obj.author, "username", None)
        except Exception:
            return None


class AdminSupportTicketSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    state_name = serializers.SerializerMethodField()
    pincode = serializers.CharField(source="user.pincode", read_only=True)
    admin_assignee_username = serializers.SerializerMethodField(read_only=True)
    messages = AdminSupportTicketMessageSerializer(many=True, read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            "id",
            "type",
            "status",
            "subject",
            "message",
            "resolution_note",
            "admin_assignee",
            "admin_assignee_username",
            "user_id",
            "username",
            "full_name",
            "phone",
            "state_name",
            "pincode",
            "created_at",
            "updated_at",
            "messages",
        ]
        read_only_fields = ["user_id", "username", "full_name", "phone", "state_name", "pincode", "created_at", "updated_at", "messages", "admin_assignee_username"]

    def get_state_name(self, obj):
        try:
            st = getattr(obj.user, "state", None)
            return st.name if st else ""
        except Exception:
            return ""

    def get_admin_assignee_username(self, obj):
        try:
            return getattr(obj.admin_assignee, "username", None)
        except Exception:
            return None


class AdminAutopoolConfigSerializer(serializers.Serializer):
    """
    Admin editable config for consumer autopool (3-matrix and 5-matrix).
    Reads/writes CommissionConfig singleton.
    """
    five_matrix_levels = serializers.IntegerField(min_value=1, required=False)
    five_matrix_amounts_json = serializers.ListField(child=serializers.FloatField(min_value=0), allow_null=True, required=False)
    five_matrix_percents_json = serializers.ListField(child=serializers.FloatField(min_value=0), allow_null=True, required=False)

    three_matrix_levels = serializers.IntegerField(min_value=1, required=False)
    three_matrix_amounts_json = serializers.ListField(child=serializers.FloatField(min_value=0), allow_null=True, required=False)
    three_matrix_percents_json = serializers.ListField(child=serializers.FloatField(min_value=0), allow_null=True, required=False)

    updated_at = serializers.DateTimeField(read_only=True, required=False)

    def to_representation(self, instance):
        from decimal import Decimal as D
        cfg = instance if isinstance(instance, CommissionConfig) else CommissionConfig.get_solo()

        def _norm_list(lst, n):
            arr = list(lst or [])
            out = []
            for i in range(min(len(arr), n)):
                try:
                    v = D(str(arr[i]))
                    if v < 0:
                        v = D("0")
                    out.append(float(v.quantize(D("0.01"))))
                except Exception:
                    out.append(0.0)
            while len(out) < n:
                out.append(0.0)
            return out

        five_levels = int(getattr(cfg, "five_matrix_levels", 6) or 6)
        three_levels = int(getattr(cfg, "three_matrix_levels", 15) or 15)

        return {
            "five_matrix_levels": five_levels,
            "five_matrix_amounts_json": _norm_list(getattr(cfg, "five_matrix_amounts_json", []) or [], five_levels),
            "five_matrix_percents_json": _norm_list(getattr(cfg, "five_matrix_percents_json", []) or [], five_levels),
            "three_matrix_levels": three_levels,
            "three_matrix_amounts_json": _norm_list(getattr(cfg, "three_matrix_amounts_json", []) or [], three_levels),
            "three_matrix_percents_json": _norm_list(getattr(cfg, "three_matrix_percents_json", []) or [], three_levels),
            "updated_at": getattr(cfg, "updated_at", None),
        }

    def update(self, instance, validated_data):
        from decimal import Decimal as D
        cfg = instance

        five_levels = int(validated_data.get("five_matrix_levels", getattr(cfg, "five_matrix_levels", 6) or 6))
        three_levels = int(validated_data.get("three_matrix_levels", getattr(cfg, "three_matrix_levels", 15) or 15))
        cfg.five_matrix_levels = max(1, five_levels)
        cfg.three_matrix_levels = max(1, three_levels)

        def _coerce(lst, n):
            if lst is None:
                return []
            arr = list(lst or [])
            out = []
            for i in range(min(len(arr), n)):
                try:
                    v = D(str(arr[i]))
                    if v < 0:
                        v = D("0")
                    out.append(float(v.quantize(D("0.01"))))
                except Exception:
                    out.append(0.0)
            while len(out) < n:
                out.append(0.0)
            return out

        if "five_matrix_amounts_json" in validated_data:
            cfg.five_matrix_amounts_json = _coerce(validated_data.get("five_matrix_amounts_json"), cfg.five_matrix_levels)
        if "five_matrix_percents_json" in validated_data:
            cfg.five_matrix_percents_json = _coerce(validated_data.get("five_matrix_percents_json"), cfg.five_matrix_levels)
        if "three_matrix_amounts_json" in validated_data:
            cfg.three_matrix_amounts_json = _coerce(validated_data.get("three_matrix_amounts_json"), cfg.three_matrix_levels)
        if "three_matrix_percents_json" in validated_data:
            cfg.three_matrix_percents_json = _coerce(validated_data.get("three_matrix_percents_json"), cfg.three_matrix_levels)

        try:
            cfg.save()
        except Exception:
            cfg.save()
        return cfg

    def create(self, validated_data):
        cfg = CommissionConfig.get_solo()
        return self.update(cfg, validated_data)


class AdminAutoPoolAccountSerializer(serializers.ModelSerializer):
    owner_id = serializers.IntegerField(source="owner.id", read_only=True)
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    child_count = serializers.SerializerMethodField()
    total_commission = serializers.SerializerMethodField()

    class Meta:
        model = AutoPoolAccount
        fields = [
            "id",
            "owner_id",
            "owner_username",
            "pool_type",
            "status",
            "entry_amount",
            "parent_account_id",
            "level",
            "position",
            "source_type",
            "source_id",
            "created_at",
            "child_count",
            "total_commission",
        ]

    def get_child_count(self, obj):
        try:
            return AutoPoolAccount.objects.filter(parent_account=obj, status="ACTIVE").count()
        except Exception:
            return 0

    def get_total_commission(self, obj):
        """
        Sum of AutoPool bonus credits generated by this matrix account source across all recipients.
        Uses WalletTransaction.source_type/source_id to correlate payouts to this account.
        """
        try:
            qs = WalletTransaction.objects.filter(
                source_type=obj.source_type or "",
                source_id=str(obj.source_id or ""),
                type__in=["AUTOPOOL_BONUS_FIVE", "AUTOPOOL_BONUS_THREE"],
            )
            from decimal import Decimal as D
            total = D("0.00")
            for tx in qs.only("amount"):
                try:
                    total += D(str(getattr(tx, "amount", 0) or 0))
                except Exception:
                    pass
            return float(total)
        except Exception:
            return 0.0
