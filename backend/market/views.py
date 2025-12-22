from rest_framework import generics, permissions, parsers, status
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Q, F
from rest_framework.views import APIView
from django.http import HttpResponse
from django.conf import settings
from xhtml2pdf import pisa
import os
from .models import Product, PurchaseRequest, Banner, BannerItem, BannerPurchaseRequest, MerchantShop, MerchantProfile, Shop
from .serializers import (
    ProductSerializer,
    PurchaseRequestSerializer,
    PurchaseRequestStatusSerializer,
    BannerSerializer,
    BannerItemSerializer,
    BannerPurchaseRequestSerializer,
    BannerPurchaseRequestStatusSerializer,
    MerchantShopSerializer,
    MerchantProfileSerializer,
    ShopSerializer,
)


class IsProductOwner(permissions.BasePermission):
    """
    Allows access only to the owner of the product (or staff).
    """

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if getattr(request.user, "is_staff", False):
            return True
        return getattr(obj, "created_by_id", None) == request.user.id


class ProductListCreate(generics.ListCreateAPIView):
    """
    GET /api/products — list all products (filter by country, state, city, pincode, category, name)
    POST /api/products — agency adds a product
    """
    serializer_class = ProductSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        qs = Product.objects.select_related("created_by").all().order_by("-created_at")

        params = self.request.query_params
        country = (params.get("country") or "").strip()
        state = (params.get("state") or "").strip()
        city = (params.get("city") or "").strip()
        pincode = (params.get("pincode") or "").strip()
        category = (params.get("category") or "").strip()
        name = (params.get("name") or "").strip()
        q = (params.get("q") or "").strip()
        sort = (params.get("sort") or params.get("ordering") or "").strip().lower()
        active_str = (params.get("active") or "").strip().lower()
        hide_sold_out = (params.get("hide_sold_out") or "").strip().lower() in ("1", "true", "yes")
        mine = (params.get("mine") or "").strip() in ("1", "true", "yes")

        if mine and self.request.user and self.request.user.is_authenticated:
            qs = qs.filter(created_by_id=self.request.user.id)

        # Map active flag to quantity-based status when provided
        if active_str in ("true", "1", "yes"):
            qs = qs.filter(quantity__gt=0)
        elif active_str in ("false", "0", "no"):
            qs = qs.filter(quantity=0)

        # Hide out-of-stock items only when explicitly requested for public marketplace
        if hide_sold_out and not (mine and self.request.user and self.request.user.is_authenticated):
            qs = qs.filter(quantity__gt=0)

        # Location and attribute filters
        if country:
            qs = qs.filter(country__iexact=country)
        if state:
            qs = qs.filter(state__iexact=state)
        if city:
            qs = qs.filter(city__iexact=city)
        if pincode:
            qs = qs.filter(pincode__iexact=pincode)
        if category:
            qs = qs.filter(category__iexact=category)
        if name:
            qs = qs.filter(name__icontains=name)

        # Keyword search across key fields
        if q:
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(description__icontains=q)
                | Q(category__icontains=q)
                | Q(pincode__icontains=q)
            )

        # Sorting support
        if sort == "price_asc":
            qs = qs.order_by("price")
        elif sort == "price_desc":
            qs = qs.order_by("-price")
        elif sort == "newest":
            qs = qs.order_by("-created_at")
        elif sort == "oldest":
            qs = qs.order_by("created_at")
        # default remains newest from initial order_by

        return qs

    def perform_create(self, serializer):
        serializer.save()  # created_by gets set in serializer.create()


class ProductDetail(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/products/:id — get product details
    PUT /api/products/:id — edit a product (owner-only)
    DELETE /api/products/:id — delete product (owner-only)
    """
    serializer_class = ProductSerializer
    queryset = Product.objects.select_related("created_by").all()
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [permissions.IsAuthenticated(), IsProductOwner()]
        # Anyone can view
        return [permissions.AllowAny()]


class PurchaseRequestListCreate(generics.ListCreateAPIView):
    """
    POST /api/purchase-requests — consumer creates a buy request
    GET /api/purchase-requests — fetch all requests for products owned by the logged-in user
    Optional: ?mine=1 to fetch requests created by the logged-in user (consumer "My Orders")
    """
    serializer_class = PurchaseRequestSerializer
    queryset = PurchaseRequest.objects.select_related("product", "product__created_by").all()

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.IsAuthenticated()]
        # Allow anonymous to submit purchase request; created_by will be null if not logged in
        return [permissions.AllowAny()]

    def get_queryset(self):
        qs = super().get_queryset().order_by("-created_at")
        user = self.request.user

        # Default: owner view (agency/admin sees requests for their products)
        mine = (self.request.query_params.get("mine") or "").strip() in ("1", "true", "yes")
        if mine:
            if not user or not user.is_authenticated:
                return PurchaseRequest.objects.none()
            return qs.filter(created_by_id=user.id)

        # Owner view
        if not user or not user.is_authenticated:
            return PurchaseRequest.objects.none()
        if getattr(user, "is_staff", False):
            return qs  # admins see all
        return qs.filter(product__created_by_id=user.id)

    def perform_create(self, serializer):
        # Attach created_by if authenticated (for MyOrders)
        if self.request.user and self.request.user.is_authenticated:
            serializer.save(created_by=self.request.user)
        else:
            serializer.save()


class PurchaseRequestStatusUpdate(generics.UpdateAPIView):
    """
    PATCH /api/purchase-requests/:id — update request status (approve/reject)
    Only the product owner (or staff) can update status.
    """
    serializer_class = PurchaseRequestStatusSerializer
    queryset = PurchaseRequest.objects.select_related("product", "product__created_by").all()

    def get_permissions(self):
        if self.request.method in ("PATCH", "PUT"):
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        if not user or not user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        if not (getattr(user, "is_staff", False) or instance.product.created_by_id == user.id):
            return Response({"detail": "You do not have permission to update this request."}, status=status.HTTP_403_FORBIDDEN)

        partial = kwargs.pop('partial', True)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        desired_status = serializer.validated_data.get("status", instance.status)

        if desired_status == PurchaseRequest.STATUS_APPROVED:
            with transaction.atomic():
                # Lock the product row to avoid race conditions
                product = Product.objects.select_for_update().get(pk=instance.product_id)
                req_qty = int(instance.quantity or 0)
                if req_qty <= 0:
                    return Response({"detail": "Invalid request quantity."}, status=status.HTTP_400_BAD_REQUEST)
                if int(product.quantity) < req_qty:
                    return Response({"detail": "Insufficient stock to approve this request."}, status=status.HTTP_400_BAD_REQUEST)

                # If consumer chose wallet payment, attempt wallet debit before approval + stock decrement
                try:
                    from decimal import Decimal
                    unit_price = (Decimal(product.price) * (Decimal("1.00") - (Decimal(product.discount or 0) / Decimal("100.00")))).quantize(Decimal("0.01"))
                    total_amount = (unit_price * Decimal(req_qty)).quantize(Decimal("0.01"))
                except Exception:
                    unit_price = None
                    total_amount = None

                # Clamp stored reward_discount_amount to product-level max_reward_redeem_percent (defense-in-depth)
                try:
                    from decimal import Decimal as D
                    if total_amount is not None:
                        redeem = D(str(getattr(instance, "reward_discount_amount", "0") or "0"))
                        if redeem < D("0.00"):
                            redeem = D("0.00")
                        # cap to gross total
                        if redeem > D(str(total_amount)):
                            redeem = D(str(total_amount))
                        # server-side cap: respect product.max_reward_redeem_percent
                        try:
                            pct = D(getattr(product, "max_reward_redeem_percent", 0) or 0)
                        except Exception:
                            pct = D("0")
                        if pct > D("0"):
                            cap = (D(str(total_amount)) * (pct / D("100.00"))).quantize(D("0.01"))
                            if redeem > cap:
                                redeem = cap
                        # persist clamped back
                        instance.reward_discount_amount = redeem.quantize(D("0.01"))
                        instance.save(update_fields=["reward_discount_amount"])
                except Exception:
                    pass

                # Commit or release reward points hold based on clamped redeem amount
                try:
                    from decimal import Decimal as D
                    from accounts.models import RewardPointsAccount, RewardPointsHold
                    redeem = D(str(getattr(instance, "reward_discount_amount", "0") or "0")).quantize(D("0.01"))
                    hold = getattr(instance, "reward_points_hold", None)
                    if redeem > D("0.00") and instance.created_by_id:
                        if hold and getattr(hold, "status", "") == RewardPointsHold.STATUS_PENDING:
                            try:
                                RewardPointsAccount.commit_hold(hold, commit_points=redeem, meta={"request_id": instance.id})
                            except Exception:
                                # Failed to commit; zero discount and release hold
                                instance.reward_discount_amount = D("0.00")
                                instance.save(update_fields=["reward_discount_amount"])
                                try:
                                    RewardPointsAccount.release_hold(hold)
                                except Exception:
                                    pass
                        else:
                            # No hold pending; reserve+commit now (best-effort)
                            try:
                                h = RewardPointsAccount.reserve_value(
                                    instance.created_by,
                                    redeem,
                                    source_type="PRODUCT_PR",
                                    source_id=str(instance.id),
                                    meta={"late_commit": True},
                                )
                                RewardPointsAccount.commit_hold(h, commit_points=redeem, meta={"request_id": instance.id})
                                try:
                                    instance.reward_points_hold_id = getattr(h, "id", None)
                                    instance.save(update_fields=["reward_points_hold"])
                                except Exception:
                                    pass
                            except Exception:
                                instance.reward_discount_amount = D("0.00")
                                instance.save(update_fields=["reward_discount_amount"])
                    else:
                        # If no redeem desired but a pending hold exists, release it
                        if hold and getattr(hold, "status", "") == RewardPointsHold.STATUS_PENDING:
                            try:
                                RewardPointsAccount.release_hold(hold)
                            except Exception:
                                pass
                except Exception:
                    pass

                if getattr(instance, "payment_method", "wallet") == "wallet" and instance.created_by_id and total_amount is not None:
                    try:
                        from decimal import Decimal as D
                        # Apply reward discount amount (₹) if any
                        redeem = None
                        try:
                            redeem = D(str(getattr(instance, "reward_discount_amount", "0") or "0"))
                        except Exception:
                            redeem = D("0.00")
                        eff_total = (D(str(total_amount)) - (redeem or D("0.00")))
                        if eff_total < D("0.00"):
                            eff_total = D("0.00")
                        eff_total = eff_total.quantize(D("0.01"))

                        from accounts.models import Wallet
                        w = Wallet.get_or_create_for_user(instance.created_by)
                        # This raises on insufficient funds
                        w.debit(
                            eff_total,
                            tx_type="PRODUCT_PURCHASE_DEBIT",
                            meta={
                                "product_id": product.id,
                                "product_name": product.name,
                                "unit_price": str(unit_price) if unit_price is not None else None,
                                "quantity": req_qty,
                                "request_id": instance.id,
                                "reward_discount_amount": str(redeem or D("0.00")),
                                "gross_total": str(total_amount),
                                "net_total_debited": str(eff_total),
                            },
                            source_type="PRODUCT",
                            source_id=str(product.id),
                        )
                    except ValueError as ve:
                        # Insufficient balance or invalid amount — do not approve
                        return Response({"detail": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
                    except Exception:
                        # Unknown wallet error — fail safe
                        return Response({"detail": "Failed to debit wallet for this purchase."}, status=status.HTTP_400_BAD_REQUEST)

                # Persist Approval
                self.perform_update(serializer)

                # Atomic decrement
                Product.objects.filter(pk=product.pk).update(quantity=F('quantity') - req_qty)
                product.refresh_from_db(fields=["quantity"])
                instance = serializer.instance

                # MLM activations on product purchase approval
                try:
                    from business.services.activation import product_purchase_activations
                    if instance.created_by_id:
                        product_purchase_activations(instance.created_by, {"type": "product", "id": instance.id})
                except Exception:
                    # Non-blocking best-effort payout
                    pass
                # Franchise benefit distribution on purchase (best-effort)
                try:
                    if instance.created_by_id:
                        from business.services.franchise import distribute_franchise_benefit
                        distribute_franchise_benefit(instance.created_by, trigger="purchase", source={"type": "product", "id": instance.id})
                except Exception:
                    pass
        else:
            self.perform_update(serializer)
            instance = serializer.instance

            # On rejection, release any pending reward points hold
            try:
                if instance.status == PurchaseRequest.STATUS_REJECTED:
                    from accounts.models import RewardPointsAccount, RewardPointsHold
                    hold = getattr(instance, "reward_points_hold", None)
                    if hold and getattr(hold, "status", "") == RewardPointsHold.STATUS_PENDING:
                        RewardPointsAccount.release_hold(hold)
            except Exception:
                pass

        return Response(PurchaseRequestSerializer(instance, context={"request": request}).data, status=status.HTTP_200_OK)


# =====================
# Merchant Shops
# =====================

class IsMerchantShopOwner(permissions.BasePermission):
    """
    Allows access only to the owner of the merchant shop (or staff).
    """
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if getattr(request.user, "is_staff", False):
            return True
        return getattr(obj, "owner_id", None) == request.user.id


class MerchantShopListCreate(generics.ListCreateAPIView):
    """
    GET /api/merchant/shops — public list (filters: country, state, city, pincode, q)
    POST /api/merchant/shops — merchant creates their shop (one per owner)
    """
    serializer_class = MerchantShopSerializer
    queryset = MerchantShop.objects.select_related("owner").all().order_by("-created_at")
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        country = (params.get("country") or "").strip()
        state = (params.get("state") or "").strip()
        city = (params.get("city") or "").strip()
        pincode = (params.get("pincode") or "").strip()
        name = (params.get("name") or "").strip()
        q = (params.get("q") or "").strip()
        active = (params.get("active") or "1").strip()
        mine = (params.get("mine") or "").strip() in ("1", "true", "yes")

        if active in ("1", "true", "yes"):
            qs = qs.filter(is_active=True)

        if mine and self.request.user and self.request.user.is_authenticated:
            qs = qs.filter(owner_id=self.request.user.id)

        if country:
            qs = qs.filter(country__iexact=country)
        if state:
            qs = qs.filter(state__iexact=state)
        if city:
            qs = qs.filter(city__iexact=city)
        if pincode:
            qs = qs.filter(pincode__iexact=pincode)
        if name:
            qs = qs.filter(name__icontains=name)
        if q:
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(address__icontains=q)
                | Q(city__icontains=q)
                | Q(state__icontains=q)
                | Q(pincode__icontains=q)
                | Q(owner__username__icontains=q)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save()


class MerchantShopDetail(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/merchant/shops/:id — public details
    PUT/PATCH/DELETE — owner or staff
    """
    serializer_class = MerchantShopSerializer
    queryset = MerchantShop.objects.select_related("owner").all()
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [permissions.IsAuthenticated(), IsMerchantShopOwner()]
        return [permissions.AllowAny()]


class MerchantShopMine(generics.RetrieveUpdateAPIView):
    """
    GET /api/merchant/shops/mine — retrieve my shop (404 if not created)
    PATCH/PUT /api/merchant/shops/mine — update my shop
    """
    serializer_class = MerchantShopSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        user = self.request.user
        try:
            return MerchantShop.objects.select_related("owner").get(owner_id=user.id)
        except MerchantShop.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound({"detail": "No shop found for this account."})

# =====================
# Merchant Marketplace (MerchantProfile + Shops)
# =====================

class IsShopOwner(permissions.BasePermission):
    """
    Owner (merchant) or staff can access.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if getattr(request.user, "is_staff", False):
            return True
        return getattr(obj, "merchant_id", None) == request.user.id


class MerchantProfileMe(generics.RetrieveUpdateAPIView):
    """
    GET/PUT/PATCH /api/merchant/profile — manage my merchant profile.
    Auto-creates profile on first access.
    """
    serializer_class = MerchantProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        user = self.request.user
        obj, _ = MerchantProfile.objects.get_or_create(user=user)
        return obj


class ShopPublicList(generics.ListAPIView):
    """
    GET /api/shops — public list of ACTIVE shops.
    Supports:
      - ?lat=&lng=&radius_km=25 => near-me ordering (Haversine) with radius filter
      - ?city=&q= for basic filtering
    """
    serializer_class = ShopSerializer
    permission_classes = [permissions.AllowAny]

    def list(self, request, *args, **kwargs):
        from math import radians, sin, cos, asin, sqrt

        def haversine_km(lat1, lon1, lat2, lon2):
            # All args in decimal degrees
            try:
                # convert decimal degrees to radians
                lon1, lat1, lon2, lat2 = map(radians, [float(lon1), float(lat1), float(lon2), float(lat2)])
                # haversine formula
                dlon = lon2 - lon1
                dlat = lat2 - lat1
                a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
                c = 2 * asin(sqrt(a))
                r = 6371  # Radius of earth in kilometers
                return c * r
            except Exception:
                return None

        params = request.query_params
        city = (params.get("city") or "").strip()
        q = (params.get("q") or "").strip()
        lat = params.get("lat")
        lng = params.get("lng")
        radius_km = params.get("radius_km")
        try:
            radius_km = float(radius_km) if radius_km is not None else 25.0
        except Exception:
            radius_km = 25.0

        base_qs = Shop.objects.select_related("merchant").filter(status=Shop.STATUS_ACTIVE)
        if city:
            base_qs = base_qs.filter(city__iexact=city)
        if q:
            base_qs = base_qs.filter(
                Q(shop_name__icontains=q) | Q(address__icontains=q) | Q(city__icontains=q) | Q(merchant__username__icontains=q)
            )

        # If no coordinates, fallback to default paginated list (newest first)
        if not (lat and lng):
            queryset = base_qs.order_by("-created_at")
            page = self.paginate_queryset(queryset)
            if page is not None:
                ser = self.get_serializer(page, many=True)
                return self.get_paginated_response(ser.data)
            ser = self.get_serializer(queryset, many=True)
            return Response(ser.data)

        # Near-me flow: compute distances for a capped set
        subset = list(
            base_qs.filter(latitude__isnull=False, longitude__isnull=False)[:1000]  # safety cap
        )
        out = []
        for obj in subset:
            d = haversine_km(lat, lng, obj.latitude, obj.longitude)
            if d is None:
                continue
            obj._distance_km = d
            if radius_km is None or d <= float(radius_km):
                out.append(obj)
        out.sort(key=lambda x: getattr(x, "_distance_km", 1e12))

        page = self.paginate_queryset(out)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(out, many=True)
        return Response(ser.data)


class ShopPublicDetail(generics.RetrieveAPIView):
    """
    GET /api/shops/:id — public details for ACTIVE shop
    """
    serializer_class = ShopSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Shop.objects.select_related("merchant").filter(status=Shop.STATUS_ACTIVE)


class ShopMineListCreate(generics.ListCreateAPIView):
    """
    GET /api/merchant/shops — list my shops (merchant only)
    POST /api/merchant/shops — create a shop (merchant only; status=PENDING)
    """
    serializer_class = ShopSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Shop.objects.none()
        return Shop.objects.select_related("merchant").filter(merchant_id=user.id).order_by("-created_at")

    def perform_create(self, serializer):
        # serializer enforces merchant-only create and sets merchant
        serializer.save()


class ShopOwnerDetail(generics.RetrieveUpdateDestroyAPIView):
    """
    GET/PUT/PATCH/DELETE /api/merchant/shops/:id — owner or staff
    """
    serializer_class = ShopSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    permission_classes = [permissions.IsAuthenticated, IsShopOwner]
    queryset = Shop.objects.select_related("merchant").all()


class PurchaseRequestInvoiceView(APIView):
    """
    GET /api/purchase-requests/:id/invoice/ — Download PDF invoice for a purchase request.
    Visible to:
      - the consumer who created the request
      - the product owner
      - staff
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, *args, **kwargs):
        try:
            pr = PurchaseRequest.objects.select_related("product", "product__created_by", "created_by").get(pk=pk)
        except PurchaseRequest.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if not (
            getattr(user, "is_staff", False)
            or (pr.created_by_id and pr.created_by_id == user.id)
            or (getattr(pr.product, "created_by_id", None) == user.id)
        ):
            return Response({"detail": "You do not have permission to access this invoice."}, status=status.HTTP_403_FORBIDDEN)

        # Company branding
        company_name = getattr(settings, "COMPANY_NAME", "TRI Konekt")
        branding_dir = os.path.join(settings.BASE_DIR, "static", "branding")
        logo_uri = None
        try:
            # Try common branding filenames; use the first one that exists
            candidates = ["logo.png", "logo.jpg", "logo.jpeg", "logo.svg", "trikonekt.png", "trikonekt.jpg"]
            for fname in candidates:
                fpath = os.path.join(branding_dir, fname)
                if os.path.exists(fpath):
                    # xhtml2pdf supports local file paths via link_callback; pass as file:// URI
                    logo_uri = f"file://{fpath.replace('\\', '/')}"
                    break
        except Exception:
            logo_uri = None

        from decimal import Decimal as D
        unit_price = None
        total_amount = None
        try:
            unit_price = (D(pr.product.price) * (D("1.00") - (D(pr.product.discount or 0) / D("100.00")))).quantize(D("0.01"))
            total_amount = (unit_price * D(pr.quantity or 1)).quantize(D("0.01"))
        except Exception:
            pass

        redeem = D(str(getattr(pr, "reward_discount_amount", "0") or "0"))
        if redeem < D("0"):
            redeem = D("0.00")
        net_payable = None
        try:
            net_payable = (D(str(total_amount or "0")) - redeem).quantize(D("0.01"))
            if net_payable < D("0"):
                net_payable = D("0.00")
        except Exception:
            net_payable = None

        # Simple HTML invoice
        safe = lambda x: (str(x) if x is not None else "-")
        html = f"""
        <html>
        <head>
            <meta charset="utf-8" />
            <style>
                body {{ font-family: DejaVu Sans, Arial, sans-serif; font-size: 12px; color: #111; }}
                .header {{ display: flex; align-items: center; margin-bottom: 12px; }}
                .logo {{ height: 48px; margin-right: 12px; }}
                .title {{ font-size: 18px; font-weight: 700; }}
                .muted {{ color: #555; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
                th, td {{ border: 1px solid #ddd; padding: 6px; text-align: left; }}
                th {{ background: #f3f4f6; }}
                .right {{ text-align: right; }}
            </style>
        </head>
        <body>
            <div class="header">
                {"<img class='logo' src='" + logo_uri + "' />" if logo_uri else ""}
                <div>
                    <div class="title">{company_name}</div>
                    <div class="muted">Invoice for Purchase Request #{safe(pr.id)}</div>
                </div>
            </div>

            <table>
                <tr><th>Invoice No.</th><td>INV-PR-{safe(pr.id)}</td><th>Date</th><td>{safe(pr.created_at)}</td></tr>
                <tr><th>Customer</th><td>{safe(getattr(pr.created_by, "full_name", None) or getattr(pr.created_by, "username", None) or pr.consumer_name)}</td><th>Status</th><td>{safe(pr.status)}</td></tr>
                <tr><th>Contact</th><td>{safe(pr.consumer_phone)}</td><th>Email</th><td>{safe(pr.consumer_email)}</td></tr>
                <tr><th>Address</th><td colspan="3">{safe(pr.consumer_address)}</td></tr>
            </table>

            <table>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th class="right">Unit Price (₹)</th>
                        <th class="right">Qty</th>
                        <th class="right">Subtotal (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>{safe(pr.product.name)}</td>
                        <td class="right">{safe(unit_price)}</td>
                        <td class="right">{safe(pr.quantity)}</td>
                        <td class="right">{safe(total_amount)}</td>
                    </tr>
                </tbody>
            </table>

            <table>
                <tr><th class="right">Reward Discount (₹)</th><td class="right">-{safe(redeem)}</td></tr>
                <tr><th class="right">Payment Method</th><td class="right">{safe(pr.payment_method).upper()}</td></tr>
                <tr><th class="right">Amount Payable (₹)</th><td class="right"><strong>{safe(net_payable)}</strong></td></tr>
            </table>

            <p class="muted">This is a system generated invoice.</p>
        </body>
        </html>
        """.strip()

        def link_callback(uri, rel):
            # Allow local file paths (file://) for logo
            if uri.startswith("file://"):
                return uri[7:]
            return uri

        response = HttpResponse(content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="invoice-PR{pr.id}.pdf"'
        pisa_status = pisa.CreatePDF(src=html, dest=response, link_callback=link_callback)
        if pisa_status.err:
            return Response({"detail": "Failed to generate PDF."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return response

# =====================
# Banners + BannerItems
# =====================

class IsBannerOwner(permissions.BasePermission):
    """
    Owner or staff can modify banner and its items.
    """

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if getattr(request.user, "is_staff", False):
            return True
        # obj can be Banner or BannerItem
        owner_id = getattr(obj, "created_by_id", None)
        if owner_id is None and hasattr(obj, "banner"):
            owner_id = getattr(getattr(obj, "banner", None), "created_by_id", None)
        return owner_id == request.user.id


class BannerListCreate(generics.ListCreateAPIView):
    """
    GET /api/banners — public list (filters: country, state, city, pincode, active=1)
    POST /api/banners — agency creates a banner (title, description, image, location filters)
    """
    serializer_class = BannerSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        qs = Banner.objects.select_related("created_by").prefetch_related("items").all().order_by("-created_at")
        params = self.request.query_params
        country = (params.get("country") or "").strip()
        state = (params.get("state") or "").strip()
        city = (params.get("city") or "").strip()
        pincode = (params.get("pincode") or "").strip()
        mine = (params.get("mine") or "").strip() in ("1", "true", "yes")
        active = (params.get("active") or "1").strip()  # default only active

        if active in ("1", "true", "yes"):
            qs = qs.filter(is_active=True)

        if mine and self.request.user and self.request.user.is_authenticated:
            qs = qs.filter(created_by_id=self.request.user.id)

        if country:
            qs = qs.filter(country__iexact=country)
        if state:
            qs = qs.filter(state__iexact=state)
        if city:
            qs = qs.filter(city__iexact=city)
        if pincode:
            qs = qs.filter(pincode__iexact=pincode)
        return qs

    def perform_create(self, serializer):
        serializer.save()


class BannerDetail(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/banners/:id — public details with items
    PUT/PATCH/DELETE /api/banners/:id — owner or staff
    """
    serializer_class = BannerSerializer
    queryset = Banner.objects.select_related("created_by").prefetch_related("items").all()
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [permissions.IsAuthenticated(), IsBannerOwner()]
        return [permissions.AllowAny()]


class BannerItemListCreate(generics.ListCreateAPIView):
    """
    GET /api/banners/:banner_id/items — list items (public)
    POST /api/banners/:banner_id/items — add item (owner or staff)
    """
    serializer_class = BannerItemSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        banner_id = self.kwargs.get("banner_id")
        return BannerItem.objects.filter(banner_id=banner_id).order_by("name")

    def perform_create(self, serializer):
        banner_id = self.kwargs.get("banner_id")
        try:
            banner = Banner.objects.get(pk=banner_id)
        except Banner.DoesNotExist:
            raise permissions.ValidationError({"detail": "Banner not found."})
        # permission check
        user = self.request.user
        if not (getattr(user, "is_staff", False) or (user and user.is_authenticated and banner.created_by_id == user.id)):
            raise permissions.PermissionDenied("You do not have permission to add items to this banner.")
        serializer.save(banner=banner)


class BannerItemDetail(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/banners/:banner_id/items/:id — item details (public)
    PUT/PATCH/DELETE — owner or staff
    """
    serializer_class = BannerItemSerializer
    lookup_url_kwarg = "pk"

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        banner_id = self.kwargs.get("banner_id")
        return BannerItem.objects.select_related("banner").filter(banner_id=banner_id).order_by("name")

    def perform_update(self, serializer):
        item = self.get_object()
        user = self.request.user
        if not (getattr(user, "is_staff", False) or (user and user.is_authenticated and item.banner.created_by_id == user.id)):
            raise permissions.PermissionDenied("You do not have permission to update this item.")
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if not (getattr(user, "is_staff", False) or (user and user.is_authenticated and instance.banner.created_by_id == user.id)):
            raise permissions.PermissionDenied("You do not have permission to delete this item.")
        return super().perform_destroy(instance)


# ================================
# Banner Item Purchase (Consumer)
# ================================

class BannerPurchaseRequestListCreate(generics.ListCreateAPIView):
    """
    POST /api/banners/:banner_id/items/:item_id/purchase-requests — consumer creates a buy request for a banner item
    GET  /api/banners/:banner_id/items/:item_id/purchase-requests — owner/staff list requests for this item
    """
    serializer_class = BannerPurchaseRequestSerializer
    queryset = BannerPurchaseRequest.objects.select_related("banner", "banner_item", "banner__created_by").all()

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.AllowAny()]
        # List is restricted to owner/staff
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset().order_by("-created_at")
        banner_id = self.kwargs.get("banner_id")
        item_id = self.kwargs.get("item_id")
        qs = qs.filter(banner_id=banner_id, banner_item_id=item_id)
        # For GET, enforce owner check unless staff
        if self.request.method == "GET":
            user = self.request.user
            if not user or not user.is_authenticated:
                return BannerPurchaseRequest.objects.none()
            if getattr(user, "is_staff", False):
                return qs
            try:
                banner = Banner.objects.get(pk=banner_id)
            except Banner.DoesNotExist:
                return BannerPurchaseRequest.objects.none()
            if banner.created_by_id != user.id:
                return BannerPurchaseRequest.objects.none()
        return qs

    def perform_create(self, serializer):
        banner_id = self.kwargs.get("banner_id")
        item_id = self.kwargs.get("item_id")
        try:
            banner = Banner.objects.get(pk=banner_id, is_active=True)
        except Banner.DoesNotExist:
            raise permissions.ValidationError({"detail": "Banner not found or inactive."})
        try:
            item = BannerItem.objects.get(pk=item_id, banner_id=banner.id)
        except BannerItem.DoesNotExist:
            raise permissions.ValidationError({"detail": "Banner item not found."})

        # Basic stock validation
        from decimal import Decimal
        req_qty = int(self.request.data.get("quantity") or 1)
        if req_qty <= 0:
            raise permissions.ValidationError({"quantity": "Quantity must be at least 1."})
        if int(getattr(item, "quantity", 0)) < req_qty:
            raise permissions.ValidationError({"detail": "Insufficient stock for this item."})

        pay_method = str(self.request.data.get("payment_method") or BannerPurchaseRequest.PAYMENT_WALLET).lower()

        # If wallet payment requested by authenticated user, do a best-effort balance check
        if pay_method == "wallet" and self.request.user and self.request.user.is_authenticated:
            unit_price = (item.selling_price or Decimal("0.00")).quantize(Decimal("0.01"))
            total = (unit_price * Decimal(req_qty)).quantize(Decimal("0.01"))
            try:
                from accounts.models import Wallet
                w = Wallet.get_or_create_for_user(self.request.user)
                if (w.balance or Decimal("0")) < total:
                    raise permissions.ValidationError({"detail": f"Insufficient wallet balance. Needed ₹{total}."})
            except permissions.ValidationError:
                raise
            except Exception:
                # If wallet fetch fails, allow request creation; final check happens on approval
                pass

        serializer.save(banner=banner, banner_item=item)


class BannerPurchaseRequestStatusUpdate(generics.UpdateAPIView):
    """
    PATCH /api/banners/purchase-requests/:id — update request status (approve/reject)
    Only the banner owner (or staff) can update status.
    """
    serializer_class = BannerPurchaseRequestStatusSerializer
    queryset = BannerPurchaseRequest.objects.select_related("banner", "banner_item", "banner__created_by", "created_by").all()

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        if not user or not user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        if not (getattr(user, "is_staff", False) or instance.banner.created_by_id == user.id):
            return Response({"detail": "You do not have permission to update this request."}, status=status.HTTP_403_FORBIDDEN)

        partial = kwargs.pop('partial', True)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        desired_status = serializer.validated_data.get("status", instance.status)

        if desired_status == BannerPurchaseRequest.STATUS_APPROVED:
            with transaction.atomic():
                # Lock the banner item row
                item = BannerItem.objects.select_for_update().get(pk=instance.banner_item_id)
                req_qty = int(instance.quantity or 0)
                if req_qty <= 0:
                    return Response({"detail": "Invalid request quantity."}, status=status.HTTP_400_BAD_REQUEST)
                if int(item.quantity) < req_qty:
                    return Response({"detail": "Insufficient stock to approve this request."}, status=status.HTTP_400_BAD_REQUEST)

                # Compute amounts
                try:
                    from decimal import Decimal
                    unit_price = (item.selling_price or Decimal("0.00")).quantize(Decimal("0.01"))
                    total_amount = (unit_price * Decimal(req_qty)).quantize(Decimal("0.01"))
                except Exception:
                    unit_price = None
                    total_amount = None

                # Debit wallet if needed
                if getattr(instance, "payment_method", "wallet") == "wallet" and instance.created_by_id and total_amount is not None:
                    try:
                        from accounts.models import Wallet
                        w = Wallet.get_or_create_for_user(instance.created_by)
                        w.debit(
                            total_amount,
                            tx_type="BANNER_PURCHASE_DEBIT",
                            meta={
                                "banner_id": instance.banner_id,
                                "banner_item_id": item.id,
                                "item_name": item.name,
                                "unit_price": str(unit_price) if unit_price is not None else None,
                                "quantity": req_qty,
                                "request_id": instance.id,
                            },
                            source_type="BANNER_ITEM",
                            source_id=str(item.id),
                        )
                    except ValueError as ve:
                        return Response({"detail": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
                    except Exception:
                        return Response({"detail": "Failed to debit wallet for this purchase."}, status=status.HTTP_400_BAD_REQUEST)

                # Persist approval
                self.perform_update(serializer)

                # Decrement stock atomically
                BannerItem.objects.filter(pk=item.pk).update(quantity=F('quantity') - req_qty)
                item.refresh_from_db(fields=["quantity"])
                instance = serializer.instance

                # MLM activations on banner item purchase approval
                try:
                    from business.services.activation import product_purchase_activations
                    if instance.created_by_id:
                        product_purchase_activations(instance.created_by, {"type": "banner_item", "id": instance.id})
                except Exception:
                    # Non-blocking
                    pass
                # Franchise benefit distribution on purchase (best-effort)
                try:
                    if instance.created_by_id:
                        from business.services.franchise import distribute_franchise_benefit
                        distribute_franchise_benefit(instance.created_by, trigger="purchase", source={"type": "banner_item", "id": instance.id})
                except Exception:
                    pass
        else:
            self.perform_update(serializer)
            instance = serializer.instance

        return Response(BannerPurchaseRequestSerializer(instance, context={"request": request}).data, status=status.HTTP_200_OK)


class BannerPurchaseRequestAllList(generics.ListAPIView):
    """
    GET /api/banners/purchase-requests — admin-only list of all banner purchase requests.
    Filters:
      - status=Pending|Approved|Rejected
      - banner_id, item_id (ints)
      - payment_method=wallet|cash
      - created_by (id or username contains; also matches consumer_phone)
    """
    serializer_class = BannerPurchaseRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not getattr(user, "is_staff", False):
            return BannerPurchaseRequest.objects.none()
        qs = BannerPurchaseRequest.objects.select_related(
            "banner", "banner_item", "banner__created_by", "created_by"
        ).all().order_by("-created_at")

        params = self.request.query_params
        status_in = (params.get("status") or "").strip()
        banner_id = (params.get("banner_id") or "").strip()
        item_id = (params.get("item_id") or "").strip()
        payment_method = (params.get("payment_method") or "").strip().lower()
        created_by = (params.get("created_by") or "").strip()

        if status_in in {c for c, _ in BannerPurchaseRequest.STATUS_CHOICES}:
            qs = qs.filter(status=status_in)
        if banner_id.isdigit():
            qs = qs.filter(banner_id=int(banner_id))
        if item_id.isdigit():
            qs = qs.filter(banner_item_id=int(item_id))
        if payment_method in ("wallet", "cash"):
            qs = qs.filter(payment_method=payment_method)
        if created_by:
            if created_by.isdigit():
                qs = qs.filter(Q(created_by_id=int(created_by)) | Q(created_by__username__icontains=created_by))
            else:
                qs = qs.filter(
                    Q(created_by__username__icontains=created_by)
                    | Q(consumer_phone__icontains=created_by)
                )
        return qs
