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
        data = data.copy()
        # Accept address alias for business_address to satisfy field-level validation
        if not data.get('business_address') and data.get('address'):
            data['business_address'] = data.get('address')
        return super().to_internal_value(data)

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
        if missing:
            raise serializers.ValidationError(missing)
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
