from rest_framework import generics, permissions, status, parsers
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import UIPageConfig
from .serializers import UIPageConfigSerializer

# Reuse existing admin permission pattern
try:
    from adminapi.permissions import IsAdminOrStaff
except Exception:
    class IsAdminOrStaff(permissions.IsAuthenticated):
        pass


def _default_home_config() -> dict:
    return {
        "sections": [
            {
                "id": "hero",
                "type": "hero_banner",
                "title": "",
                "data_source": {"endpoint": "/api/uploads/hero-banners/"},
                "enabled": True,
            },
            {
                "id": "promotions",
                "type": "promotion_strip",
                "title": "Offers for you",
                "data_source": {"endpoint": "/api/uploads/promotions/"},
                "enabled": True,
            },
            {
                "id": "categories",
                "type": "category_grid",
                "title": "Shop by Category",
                "data_source": {"endpoint": "/api/uploads/category-banners/?is_active=true"},
                "enabled": True,
            },
            {
                "id": "nearby_shops",
                "type": "nearby_shops",
                "title": "Nearby Shops",
                "data_source": {"endpoint": "/api/shops/nearby", "params": {"radius_km": 5, "limit": 20}},
                "enabled": True,
            },
        ]
    }


def _default_category_config() -> dict:
    return {
        "sections": [
            {
                "id": "products",
                "type": "product_grid",
                "title": "",
                "data_source": {"endpoint": "/api/products", "params": {}},
                "enabled": True,
            }
        ]
    }


class UIEcommerceHomeView(APIView):
    """
    GET /api/ui/pages/ecommerce-home/
    Returns active config for key="ecommerce_home"
    Fallback: returns default home config
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cfg_obj = UIPageConfig.objects.filter(key="ecommerce_home", is_active=True).order_by("-updated_at", "-id").first()
        data = _default_home_config() if not cfg_obj else (cfg_obj.config or {})
        # Runtime shim: migrate categories source from business tri/apps to uploads category-banners
        try:
            sections = data.get("sections") or []
            for s in sections:
                if s.get("id") == "categories":
                    ds = s.get("data_source") or {}
                    ep = (ds.get("endpoint") or "").strip()
                    if ep in ("/api/business/tri/apps/", "/api/business/tri/apps"):
                        ds["endpoint"] = "/api/uploads/category-banners/?is_active=true"
                        s["data_source"] = ds
        except Exception:
            # Non-fatal; return whatever we have
            pass
        return Response(data, status=status.HTTP_200_OK)


class UICategoryConfigView(APIView):
    """
    GET /api/ui/pages/category/?slug=<slug>
    Priority:
      - key="category:<slug>"
      - else key="category_default"
      - else default category config
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        slug = (request.query_params.get("slug") or "").strip()
        cfg = None
        if slug:
            cfg = UIPageConfig.objects.filter(key=f"category:{slug}", is_active=True).order_by("-updated_at", "-id").first()
        if not cfg:
            cfg = UIPageConfig.objects.filter(key="category_default", is_active=True).order_by("-updated_at", "-id").first()

        data = _default_category_config() if not cfg else (cfg.config or {})
        # Runtime shim: pass ?app=<slug> to /api/products for category pages so the grid filters by slug
        try:
            if slug:
                sections = data.get("sections") or []
                for s in sections:
                    if s.get("id") == "products":
                        ds = s.get("data_source") or {}
                        params = ds.get("params") or {}
                        if not params.get("app"):
                            params["app"] = slug
                        ds["params"] = params
                        s["data_source"] = ds
        except Exception:
            pass
        return Response(data, status=status.HTTP_200_OK)


# ======================
# Admin CRUD for UIPageConfig
# ======================

class UIPageConfigListCreate(generics.ListCreateAPIView):
    """
    Admin: GET/POST /api/ui/admin/pages/
    """
    serializer_class = UIPageConfigSerializer
    permission_classes = [IsAdminOrStaff]
    parser_classes = [parsers.JSONParser]

    def get_queryset(self):
        qs = UIPageConfig.objects.all().order_by("-updated_at", "-id")
        key = (self.request.query_params.get("key") or "").strip()
        is_active = self.request.query_params.get("is_active")
        if key:
            qs = qs.filter(key__icontains=key)
        if is_active is not None:
            val = str(is_active).strip().lower()
            if val in ("1", "true", "yes"):
                qs = qs.filter(is_active=True)
            elif val in ("0", "false", "no"):
                qs = qs.filter(is_active=False)
        return qs


class UIPageConfigDetail(generics.RetrieveUpdateDestroyAPIView):
    """
    Admin: GET/PATCH/DELETE /api/ui/admin/pages/<id>/
    """
    serializer_class = UIPageConfigSerializer
    permission_classes = [IsAdminOrStaff]
    parser_classes = [parsers.JSONParser]
    queryset = UIPageConfig.objects.all()
