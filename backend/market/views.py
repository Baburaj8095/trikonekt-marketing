from rest_framework import generics, permissions, parsers, status
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Q, F
from .models import Product, PurchaseRequest, Banner, BannerItem, BannerPurchaseRequest
from .serializers import (
    ProductSerializer,
    PurchaseRequestSerializer,
    PurchaseRequestStatusSerializer,
    BannerSerializer,
    BannerItemSerializer,
    BannerPurchaseRequestSerializer,
    BannerPurchaseRequestStatusSerializer,
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
        mine = (params.get("mine") or "").strip() in ("1", "true", "yes")
        if mine and self.request.user and self.request.user.is_authenticated:
            qs = qs.filter(created_by_id=self.request.user.id)
        # Hide out-of-stock items for public/consumer marketplace.
        # Agencies using ?mine=1 still see their sold-out items.
        if not (mine and self.request.user and self.request.user.is_authenticated):
            qs = qs.filter(quantity__gt=0)

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

                if getattr(instance, "payment_method", "wallet") == "wallet" and instance.created_by_id and total_amount is not None:
                    try:
                        from accounts.models import Wallet
                        w = Wallet.get_or_create_for_user(instance.created_by)
                        # This raises on insufficient funds
                        w.debit(
                            total_amount,
                            tx_type="PRODUCT_PURCHASE_DEBIT",
                            meta={
                                "product_id": product.id,
                                "product_name": product.name,
                                "unit_price": str(unit_price) if unit_price is not None else None,
                                "quantity": req_qty,
                                "request_id": instance.id,
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

        return Response(PurchaseRequestSerializer(instance, context={"request": request}).data, status=status.HTTP_200_OK)


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
