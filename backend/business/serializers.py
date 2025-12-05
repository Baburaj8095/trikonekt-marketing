from rest_framework import serializers
from .models import BusinessRegistration, DailyReport
from locations.models import Country, State, City


class BusinessRegistrationSerializer(serializers.ModelSerializer):
    # Optional write-only helpers to resolve FK by names/codes
    country = serializers.PrimaryKeyRelatedField(queryset=Country.objects.all(), required=False, allow_null=True)
    state = serializers.PrimaryKeyRelatedField(queryset=State.objects.all(), required=False, allow_null=True)
    city = serializers.PrimaryKeyRelatedField(queryset=City.objects.all(), required=False, allow_null=True)
    country_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    country_code = serializers.CharField(required=False, allow_blank=True, write_only=True)  # iso2 like IN
    state_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    state_code = serializers.CharField(required=False, allow_blank=True, write_only=True)    # optional
    city_name = serializers.CharField(required=False, allow_blank=True, write_only=True)

    # Accept "address" alias for business_address from some UIs
    address = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = BusinessRegistration
        fields = [
            'id', 'unique_id',
            'full_name', 'email', 'phone',
            'business_name', 'business_category', 'business_address', 'address',
            'sponsor_id',
            'country', 'state', 'city', 'pincode',
            'country_name', 'country_code', 'state_name', 'state_code', 'city_name',
            'review_status', 'forwarded_to', 'forwarded_at', 'registered_by',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'unique_id', 'review_status', 'forwarded_to', 'forwarded_at', 'registered_by', 'created_at', 'updated_at']
        extra_kwargs = {
            'business_address': {'required': False, 'allow_blank': True},
        }

    def to_internal_value(self, data):
        d = (data or {}).copy()
        # Accept address alias for business_address to satisfy field-level validation
        if not d.get('business_address') and d.get('address'):
            d['business_address'] = d.get('address')

        def _extract_id(val):
            if isinstance(val, dict):
                for k in ('id', 'value', 'pk'):
                    if k in val and val[k] is not None:
                        return val[k]
            return val

        # Alias mapping (snake_case and camelCase) for PK fields often sent by forms
        alias_pairs = [
            ('country', 'country_id'), ('state', 'state_id'), ('city', 'city_id'),
            ('country', 'countryId'), ('state', 'stateId'), ('city', 'cityId'),
        ]
        for field, alias in alias_pairs:
            if d.get(alias) is not None and d.get(field) is None:
                d[field] = d.get(alias)

        # Normalize PK-or-name values for country/state/city:
        # - int OK
        # - digit string -> int
        # - non-digit string -> move to helper write-only (country_code/country_name/state_name/city_name)
        for field in ('country', 'state', 'city'):
            if field not in d:
                continue
            raw = _extract_id(d.get(field))
            # Already int
            if isinstance(raw, int):
                d[field] = raw
                continue
            # String handling
            if isinstance(raw, str):
                sval = raw.strip()
                if sval.isdigit():
                    d[field] = int(sval)
                    continue
                if field == 'country':
                    if 1 <= len(sval) <= 3 and sval.isalpha():
                        d['country_code'] = sval
                    else:
                        d['country_name'] = sval
                elif field == 'state':
                    d['state_name'] = sval
                else:
                    d['city_name'] = sval
                d.pop(field, None)
                continue
            # Other types -> stringify
            sval = str(raw).strip()
            if sval.isdigit():
                d[field] = int(sval)
            else:
                if field == 'country':
                    if 1 <= len(sval) <= 3 and sval.isalpha():
                        d['country_code'] = sval
                    else:
                        d['country_name'] = sval
                elif field == 'state':
                    d['state_name'] = sval
                else:
                    d['city_name'] = sval
                d.pop(field, None)

        # Normalize pincode to digits only; allow dicts {value/pincode/PIN/pin: ...}
        if 'pincode' in d:
            pin_raw = d.get('pincode')
            if isinstance(pin_raw, dict):
                pin_raw = pin_raw.get('value') or pin_raw.get('pincode') or pin_raw.get('PIN') or pin_raw.get('pin') or ''
            pin_str = ''.join(c for c in str(pin_raw or '').strip() if c.isdigit())
            if pin_str:
                d['pincode'] = pin_str

        return super().to_internal_value(d)

    def validate(self, attrs):
        # Required fields for a business registration
        bn = (attrs.get('business_name') or '').strip()
        bc = (attrs.get('business_category') or '').strip()
        ba = (attrs.get('business_address') or attrs.get('address') or '').strip()
        sponsor = (attrs.get('sponsor_id') or '').strip()
        missing = {}
        if not bn:
            missing['business_name'] = 'Business name is required.'
        if not bc:
            missing['business_category'] = 'Business category is required.'
        if not ba:
            missing['business_address'] = 'Business address is required.'
        if not sponsor:
            missing['sponsor_id'] = 'Sponsor ID is required.'

        # Enforce geo selection and 6-digit pincode for merchant registration
        pin_raw = (attrs.get('pincode') or '').strip()
        pin_digits = ''.join(c for c in pin_raw if c.isdigit())
        if not pin_digits or len(pin_digits) != 6:
            missing['pincode'] = '6-digit pincode is required.'
        country_present = bool(attrs.get('country')) or bool((attrs.get('country_name') or '').strip() or (attrs.get('country_code') or '').strip())
        state_present = bool(attrs.get('state')) or bool((attrs.get('state_name') or '').strip())
        city_present = bool(attrs.get('city')) or bool((attrs.get('city_name') or '').strip())
        if not country_present:
            missing['country'] = 'Country selection is required.'
        if not state_present:
            missing['state'] = 'State selection is required.'
        if not city_present:
            missing['city'] = 'District selection is required.'

        if missing:
            raise serializers.ValidationError(missing)

        # Normalize pincode to digits in attrs for downstream create()
        if pin_digits and attrs.get('pincode') != pin_digits:
            attrs['pincode'] = pin_digits
        return attrs

    def _resolve_locations(self, validated_data):
        country = validated_data.pop('country', None)
        state = validated_data.pop('state', None)
        city = validated_data.pop('city', None)
        # helper write-only values
        country_name = (validated_data.pop('country_name', '') or '').strip()
        country_code = (validated_data.pop('country_code', '') or '').strip()
        state_name = (validated_data.pop('state_name', '') or '').strip()
        state_code = (validated_data.pop('state_code', '') or '').strip()
        city_name = (validated_data.pop('city_name', '') or '').strip()

        if country is None and (country_code or country_name):
            country_qs = Country.objects.all()
            if country_code:
                c = country_qs.filter(iso2__iexact=country_code).first()
                if c:
                    country = c
            if country is None and country_name:
                c = country_qs.filter(name__iexact=country_name).first()
                if c:
                    country = c

        if state is None and state_name and country is not None:
            s = State.objects.filter(country=country, name__iexact=state_name).first()
            if s is None:
                s = State.objects.filter(country=country, name__icontains=state_name).first()
            if s:
                state = s

        if city is None and city_name and state is not None:
            ci = City.objects.filter(state=state, name__iexact=city_name).first()
            if ci is None:
                ci = City.objects.filter(state=state, name__icontains=city_name).first()
            if ci:
                city = ci

        return country, state, city

    def create(self, validated_data):
        request = self.context.get('request')
        # Extract/normalize fields
        full_name = (validated_data.pop('full_name', '') or '').strip()
        email = (validated_data.pop('email', '') or '').strip()
        phone = (validated_data.pop('phone', '') or '').strip()
        business_name = (validated_data.pop('business_name', '') or '').strip()
        business_category = (validated_data.pop('business_category', '') or '').strip()
        business_address = (validated_data.pop('business_address', '') or validated_data.pop('address', '') or '').strip()
        pincode = (validated_data.pop('pincode', '') or '').strip()
        sponsor_id = (validated_data.pop('sponsor_id', '') or '').strip()

        # Resolve location FKs
        country, state, city = self._resolve_locations(validated_data)

        reg = BusinessRegistration.objects.create(
            full_name=full_name,
            email=email,
            phone=phone,
            business_name=business_name,
            business_category=business_category,
            business_address=business_address,
            sponsor_id=sponsor_id,
            pincode=pincode,
            country=country,
            state=state,
            city=city,
            registered_by=(request.user if request and getattr(request, 'user', None) and request.user.is_authenticated else None)
        )
        return reg


class DailyReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyReport
        fields = [
            "id",
            "reporter",
            "role",
            "date",
            "tr_registered",
            "wg_registered",
            "asia_pay_registered",
            "dm_account_registered",
            "e_coupon_issued",
            "physical_coupon_issued",
            "product_sold",
            "total_amount",
        ]
        read_only_fields = ("id", "reporter", "role", "date")


# ==============================
# Packages: Serializers
# ==============================
from .models import Package, AgencyPackageAssignment, AgencyPackagePayment
from decimal import Decimal
from django.utils import timezone


class PackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Package
        fields = [
            "id",
            "code",
            "name",
            "description",
            "amount",
            "is_active",
            "created_at",
            "updated_at",
        ]


class AgencyPackagePaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgencyPackagePayment
        fields = ["id", "amount", "paid_at", "reference", "notes", "assignment"]
        read_only_fields = ["id", "paid_at"]


class AgencyPackageAssignmentSerializer(serializers.ModelSerializer):
    package = PackageSerializer(read_only=True)
    total_amount = serializers.SerializerMethodField()
    paid_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    months_remaining = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = AgencyPackageAssignment
        fields = [
            "id",
            "package",
            "created_at",
            "total_amount",
            "paid_amount",
            "remaining_amount",
            "months_remaining",
            "status",
        ]

    def _sum_payments(self, obj) -> Decimal:
        try:
            # Use prefetched payments if available
            pays = getattr(obj, "payments").all()
            total = sum((p.amount or Decimal("0.00")) for p in pays)
            return (Decimal(total or 0)).quantize(Decimal("0.01"))
        except Exception:
            return Decimal("0.00")

    def get_total_amount(self, obj) -> str:
        amt = getattr(getattr(obj, "package", None), "amount", Decimal("0.00")) or Decimal("0.00")
        return f"{Decimal(amt).quantize(Decimal('0.01'))}"

    def get_paid_amount(self, obj) -> str:
        return f"{self._sum_payments(obj)}"

    def get_remaining_amount(self, obj) -> str:
        try:
            total = Decimal(getattr(obj.package, "amount", Decimal("0.00")) or 0)
            paid = self._sum_payments(obj)
            rem = total - paid
            if rem < 0:
                rem = Decimal("0.00")
            return f"{rem.quantize(Decimal('0.01'))}"
        except Exception:
            return "0.00"

    def get_months_remaining(self, obj) -> int:
        try:
            start = getattr(obj, "created_at", None) or timezone.now()
            now = timezone.now()
            years = now.year - start.year
            months = years * 12 + (now.month - start.month)
            # If current day hasn't reached assignment day, count as not a full month
            if now.day < start.day:
                months -= 1
            if months < 0:
                months = 0
            if months > 12:
                months = 12
            return max(0, 12 - months)
        except Exception:
            return 0

    def get_status(self, obj) -> str:
        try:
            total = Decimal(getattr(obj.package, "amount", Decimal("0.00")) or 0)
            paid = self._sum_payments(obj)
            if paid <= 0:
                return "inactive"
            if paid < total:
                return "partial"
            return "active"
        except Exception:
            return "inactive"


# ==============================
# Consumer Promo Packages (Prime/Monthly)
# ==============================
from .models import PromoPackage, PromoPurchase, PromoPackageProduct


class PromoPackageSerializer(serializers.ModelSerializer):
    promo_products = serializers.SerializerMethodField(read_only=True)
    monthly_meta = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PromoPackage
        fields = [
            "id",
            "code",
            "name",
            "description",
            "type",
            "price",
            "is_active",
            "payment_qr",
            "upi_id",
            "created_at",
            "updated_at",
            "promo_products",
            "monthly_meta",
        ]

    def get_promo_products(self, obj):
        try:
            items = obj.promo_products.filter(is_active=True).select_related("product").order_by("display_order", "id")
        except Exception:
            items = []
        request = self.context.get("request") if hasattr(self, "context") else None
        out = []
        for it in items:
            p = getattr(it, "product", None)
            if not p:
                continue
            img = None
            try:
                f = getattr(p, "image", None)
                if f:
                    url = f.url
                    img = request.build_absolute_uri(url) if (request and url and not str(url).startswith("http")) else url
            except Exception:
                img = None
            out.append({
                "id": getattr(p, "id", None),
                "name": getattr(p, "name", None),
                "price": str(getattr(p, "price", "")),
                "image_url": img,
            })
        return out

    def get_monthly_meta(self, obj):
        """
        Returns per-user monthly status for the current package number:
        {
          "current_package_number": <int>,
          "purchased_boxes": [ints],  # for the current package number
          "total_boxes": 12,
          "available_numbers": [ints]  # admin-seeded active numbers (optional)
        }
        """
        try:
            if str(getattr(obj, "type", "")) != "MONTHLY":
                return None
            request = self.context.get("request") if hasattr(self, "context") else None
            user = request.user if request and getattr(request, "user", None) and request.user.is_authenticated else None
            if not user:
                return None

            from .models import PromoMonthlyPackage, PromoMonthlyBox  # local import

            # Admin seeded numbers (optional)
            seeds = list(PromoMonthlyPackage.objects.filter(package=obj, is_active=True).order_by("number"))
            available_numbers = [s.number for s in seeds] if seeds else [1]

            def total_for(num):
                if seeds:
                    for s in seeds:
                        if int(s.number) == int(num):
                            tb = int(getattr(s, "total_boxes", 12) or 12)
                            return tb if tb > 0 else 12
                return 12

            # Determine the current enabled number for this user: smallest number not yet complete
            current = None
            if seeds:
                for s in seeds:
                    tb = total_for(s.number)
                    paid = PromoMonthlyBox.objects.filter(user=user, package=obj, package_number=s.number).count()
                    if int(paid) < int(tb):
                        current = int(s.number)
                        break
                if current is None and seeds:
                    # All seeded numbers completed
                    current = int(seeds[-1].number)
            else:
                # No seeds -> default to #1 with 12 boxes
                current = 1

            total_boxes = total_for(current)
            purchased = list(
                PromoMonthlyBox.objects.filter(user=user, package=obj, package_number=current)
                .values_list("box_number", flat=True)
            )
            return {
                "current_package_number": int(current),
                "purchased_boxes": [int(x) for x in purchased],
                "total_boxes": int(total_boxes),
                "available_numbers": available_numbers,
            }
        except Exception:
            return None


from market.models import Product


class PromoPurchaseSerializer(serializers.ModelSerializer):
    package = PromoPackageSerializer(read_only=True)
    # PRIME750: allow selecting a product seeded under the package and optional shipping address
    selected_product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), write_only=True, required=False, allow_null=True, source="selected_product"
    )
    selected_product_name = serializers.SerializerMethodField(read_only=True)
    shipping_address = serializers.CharField(required=False, allow_blank=True)
    # MONTHLY: accept package_number + boxes[] (list of ints) from client; boxes are priced per box
    package_number = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    boxes = serializers.ListField(child=serializers.IntegerField(min_value=1), write_only=True, required=False, allow_empty=False)
    package_id = serializers.PrimaryKeyRelatedField(
        queryset=PromoPackage.objects.filter(is_active=True),
        write_only=True,
        source="package",
    )
    # Admin list convenience fields
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    user_username = serializers.SerializerMethodField()

    def get_user_username(self, obj):
        try:
            u = getattr(obj, "user", None)
            return getattr(u, "username", None)
        except Exception:
            return None

    def get_selected_product_name(self, obj):
        try:
            p = getattr(obj, "selected_product", None)
            return getattr(p, "name", None)
        except Exception:
            return None
        try:
            u = getattr(obj, "user", None)
            return getattr(u, "username", None)
        except Exception:
            return None

    class Meta:
        model = PromoPurchase
        fields = [
            "id",
            "user_id",
            "user_username",
            "package",
            "package_id",
            "quantity",
            "status",
            "amount_paid",
            "payment_proof",
            "remarks",
            "requested_at",
            "approved_at",
            "approved_by",
            "selected_product_name",
            "delivery_by",
            "shipping_address",
            "selected_product_id",
            # MONTHLY box flow
            "package_number",
            "boxes",
            "boxes_json",
            # Legacy (kept for backward compatibility; not used when boxes are provided)
            "year",
            "month",
            "active_from",
            "active_to",
        ]
        read_only_fields = [
            "id",
            "status",
            "amount_paid",
            "requested_at",
            "approved_at",
            "approved_by",
            "active_from",
            "active_to",
        ]

    def get_promo_products(self, obj):
        """
        Return active products mapped to this package (id, name, price, image_url).
        """
        try:
            items = obj.promo_products.filter(is_active=True).select_related("product").order_by("display_order", "id")
        except Exception:
            items = []
        request = self.context.get("request") if hasattr(self, "context") else None
        out = []
        for it in items:
            try:
                p = it.product
            except Exception:
                p = None
            if not p:
                continue
            img = None
            try:
                f = getattr(p, "image", None)
                if f:
                    url = f.url
                    img = request.build_absolute_uri(url) if (request and url and not str(url).startswith("http")) else url
            except Exception:
                img = None
            out.append({
                "id": getattr(p, "id", None),
                "name": getattr(p, "name", None),
                "price": str(getattr(p, "price", "")),
                "image_url": img,
            })
        return out

    def validate(self, attrs):
        pkg = attrs.get("package") or getattr(self.instance, "package", None)
        if not pkg:
            raise serializers.ValidationError({"package_id": "package_id is required."})

        # Quantity validation (>=1)
        qty_raw = None
        try:
            qty_raw = attrs.get("quantity")
        except Exception:
            qty_raw = None
        try:
            qty_val = int(qty_raw if qty_raw is not None else getattr(self.instance, "quantity", 1) or 1)
        except Exception:
            qty_val = 0
        if qty_val <= 0:
            raise serializers.ValidationError({"quantity": "Quantity must be >= 1."})

        request = self.context.get("request")
        user = request.user if request and getattr(request, "user", None) and request.user.is_authenticated else None

        # Monthly validations
        if pkg.type == "MONTHLY":
            # Prefer new flow: package_number + boxes (list of ints). Legacy year/month allowed only if boxes not provided.
            boxes_in = attrs.get("boxes")
            number = attrs.get("package_number")
            if boxes_in and number:
                # Coerce and unique
                try:
                    boxes_int = sorted({int(b) for b in (boxes_in or [])})
                except Exception:
                    raise serializers.ValidationError({"boxes": "Boxes must be integers."})
                if not boxes_int:
                    raise serializers.ValidationError({"boxes": "Select at least one box."})
                if len(boxes_int) > 12:
                    # soft guard; exact limit validated against seed below
                    boxes_int = boxes_int[:12]

                # Resolve total boxes for this number
                total = 12
                try:
                    from .models import PromoMonthlyPackage, PromoMonthlyBox
                    seed = PromoMonthlyPackage.objects.filter(package=pkg, number=number, is_active=True).first()
                    if seed:
                        tb = int(getattr(seed, "total_boxes", 12) or 12)
                        total = tb if tb > 0 else 12
                except Exception:
                    from .models import PromoMonthlyBox  # type: ignore
                    total = 12

                bad = [b for b in boxes_int if b < 1 or b > total]
                if bad:
                    raise serializers.ValidationError({"boxes": f"Invalid box numbers: {bad}. Allowed 1..{total}."})

                # Enforce progression: user can only buy for the smallest package number not yet completed
                if user:
                    # Determine current allowed number
                    allowed = None
                    try:
                        seeds = list(PromoMonthlyPackage.objects.filter(package=pkg, is_active=True).order_by("number"))
                    except Exception:
                        seeds = []
                    def total_for(n):
                        if seeds:
                            for s in seeds:
                                if int(s.number) == int(n):
                                    tb = int(getattr(s, "total_boxes", 12) or 12)
                                    return tb if tb > 0 else 12
                        return 12
                    if seeds:
                        for s in seeds:
                            paid = PromoMonthlyBox.objects.filter(user=user, package=pkg, package_number=s.number).count()
                            if int(paid) < int(total_for(s.number)):
                                allowed = int(s.number)
                                break
                        if allowed is None:
                            allowed = int(seeds[-1].number)
                    else:
                        allowed = 1
                    if int(number) != int(allowed):
                        raise serializers.ValidationError({"package_number": f"Complete previous package first. Allowed package_number is {allowed}."})

                    # Already paid check for selected boxes
                    existing = set(PromoMonthlyBox.objects.filter(user=user, package=pkg, package_number=number, box_number__in=boxes_int).values_list("box_number", flat=True))
                    if existing:
                        raise serializers.ValidationError({"boxes": f"Boxes already paid: {sorted(existing)}"})

                # Map to model fields
                attrs["boxes_json"] = boxes_int
                attrs["year"] = None
                attrs["month"] = None
                # quantity equals number of boxes
                attrs["quantity"] = len(boxes_int)
            else:
                # Legacy path (keep for backward compatibility)
                y = attrs.get("year")
                m = attrs.get("month")
                if not (y and m):
                    raise serializers.ValidationError({"month": "Provide package_number + boxes[] or year + month."})
                try:
                    m = int(m)
                    y = int(y)
                except Exception:
                    raise serializers.ValidationError({"month": "Invalid year/month."})
                if not (1 <= m <= 12):
                    raise serializers.ValidationError({"month": "Invalid month value."})
                today = timezone.localdate()
                if int(y) != int(today.year) or int(m) != int(today.month):
                    raise serializers.ValidationError({"month": "Only current month purchase is allowed for Monthly Promo."})
                if user:
                    qs = PromoPurchase.objects.filter(user=user, package=pkg, year=y, month=m).exclude(status__in=["REJECTED", "CANCELLED"])
                    if self.instance and getattr(self.instance, "pk", None):
                        qs = qs.exclude(pk=self.instance.pk)
                    if qs.exists():
                        raise serializers.ValidationError({"month": "You already have a purchase for this month."})
        else:
            # PRIME must not carry month/year
            if attrs.get("year") or attrs.get("month"):
                raise serializers.ValidationError({"month": "Month/year not applicable for PRIME packages."})

            # PRIME 750 flow: ensure selected_product (if provided) belongs to this package mapping.
            from decimal import Decimal as D
            sp = attrs.get("selected_product") or getattr(self.instance, "selected_product", None)
            price = D(str(getattr(pkg, "price", "0")))
            is_prime_750 = str(getattr(pkg, "type", "")) == "PRIME" and abs(price - D("750")) <= D("0.5")
            if is_prime_750:
                # If admin requires selection, enforce presence
                if sp is None:
                    raise serializers.ValidationError({"selected_product_id": "Please select a product for ₹750 promo."})
                ok = PromoPackageProduct.objects.filter(package=pkg, product=sp, is_active=True).exists()
                if not ok:
                    raise serializers.ValidationError({"selected_product_id": "Selected product is not available for this promo package."})

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request and getattr(request, "user", None) and request.user.is_authenticated else None
        if not user:
            raise serializers.ValidationError({"detail": "Authentication required."})

        # Drop write-only/non-model fields before model create
        # 'boxes' is a write-only helper list; validated data already mapped to boxes_json in validate()
        validated_data.pop("boxes", None)

        # Model-level clean() will enforce current month and uniqueness for monthly
        pp = PromoPurchase.objects.create(
            user=user,
            **validated_data,
        )
        # If monthly boxes flow is used but quantity not explicitly provided, infer from boxes_json
        try:
            if str(getattr(pp.package, "type", "")) == "MONTHLY":
                boxes = list(getattr(pp, "boxes_json", []) or [])
                if boxes:
                    q = int(len(set(int(x) for x in boxes)))
                    if q > 0 and int(pp.quantity or 0) != q:
                        pp.quantity = q
                        pp.save(update_fields=["quantity"])
        except Exception:
            pass

        # Compute amount = quantity * unit price (best-effort); keep existing if already set explicitly
        try:
            from decimal import Decimal as D
            qty = int(getattr(pp, "quantity", 1) or 1)
        except Exception:
            qty = 1
        try:
            unit = getattr(pp.package, "price", 0) or 0
        except Exception:
            unit = 0
        try:
            total = (D(str(unit)) * D(str(qty)))
            if total != pp.amount_paid:
                pp.amount_paid = total
                pp.save(update_fields=["amount_paid"])
        except Exception:
            pass

        return pp
