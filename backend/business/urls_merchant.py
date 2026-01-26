from django.urls import path
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import MerchantCategory, MerchantSubCategory


class MerchantCategoryListPublic(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        rows = (
            MerchantCategory.objects.filter(is_active=True)
            .order_by("sort_order", "name")
            .values("id", "name")
        )
        return Response(list(rows), status=status.HTTP_200_OK)


class MerchantSubCategoryListPublic(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cat_id = request.query_params.get("category_id")
        try:
            cid = int(cat_id)
        except (TypeError, ValueError):
            return Response([], status=status.HTTP_200_OK)
        rows = (
            MerchantSubCategory.objects.filter(is_active=True, category_id=cid)
            .order_by("sort_order", "name")
            .values("id", "name", "category_id")
        )
        return Response(list(rows), status=status.HTTP_200_OK)


# =============== Admin (CRUD) ===============
from rest_framework.permissions import IsAdminUser


class AdminMerchantCategoryListCreate(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        rows = (
            MerchantCategory.objects.all()
            .order_by("sort_order", "name")
            .values("id", "name", "is_active", "sort_order", "audience", "created_at")
        )
        return Response(list(rows), status=status.HTTP_200_OK)

    def post(self, request):
        name = str(request.data.get("name") or "").strip()
        is_active = bool(request.data.get("is_active", True))
        sort_order = request.data.get("sort_order", 0)
        try:
            sort_order = int(sort_order)
        except Exception:
            sort_order = 0
        aud_raw = str(request.data.get("audience") or "").strip().upper()
        audience = "CONSUMER" if aud_raw not in {"CONSUMER", "MERCHANT"} else aud_raw
        if not name:
            return Response({"name": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        obj, created = MerchantCategory.objects.get_or_create(
            name=name,
            defaults={"is_active": is_active, "sort_order": sort_order, "audience": audience},
        )
        if not created:
            # Update if exists
            obj.is_active = is_active
            obj.sort_order = sort_order
            obj.audience = audience
            obj.save(update_fields=["is_active", "sort_order", "audience"])
        return Response({"id": obj.id, "name": obj.name, "is_active": obj.is_active, "sort_order": obj.sort_order, "audience": obj.audience}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class AdminMerchantCategoryDetail(APIView):
    permission_classes = [IsAdminUser]

    def get_object(self, pk: int):
        return MerchantCategory.objects.filter(pk=pk).first()

    def get(self, request, pk: int):
        obj = self.get_object(pk)
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        data = {"id": obj.id, "name": obj.name, "is_active": obj.is_active, "sort_order": obj.sort_order, "audience": obj.audience, "created_at": obj.created_at}
        return Response(data, status=status.HTTP_200_OK)

    def patch(self, request, pk: int):
        obj = self.get_object(pk)
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        name = request.data.get("name")
        if name is not None:
            name = str(name).strip()
            if not name:
                return Response({"name": ["This field may not be blank."]}, status=status.HTTP_400_BAD_REQUEST)
            obj.name = name
        if "is_active" in request.data:
            obj.is_active = bool(request.data.get("is_active"))
        if "sort_order" in request.data:
            try:
                obj.sort_order = int(request.data.get("sort_order"))
            except Exception:
                pass
        if "audience" in request.data:
            aud_raw = str(request.data.get("audience") or "").strip().upper()
            if aud_raw in {"CONSUMER", "MERCHANT"}:
                obj.audience = aud_raw
        obj.save()
        return Response({"id": obj.id, "name": obj.name, "is_active": obj.is_active, "sort_order": obj.sort_order, "audience": obj.audience}, status=status.HTTP_200_OK)

    def delete(self, request, pk: int):
        obj = self.get_object(pk)
        if not obj:
            return Response(status=status.HTTP_204_NO_CONTENT)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminMerchantSubCategoryListCreate(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = (
            MerchantSubCategory.objects.select_related("category")
            .order_by("category_id", "sort_order", "name")
            .values("id", "name", "is_active", "sort_order", "audience", "category_id", "created_at")
        )
        return Response(list(qs), status=status.HTTP_200_OK)

    def post(self, request):
        name = str(request.data.get("name") or "").strip()
        category_id = request.data.get("category_id")
        is_active = bool(request.data.get("is_active", True))
        sort_order = request.data.get("sort_order", 0)
        try:
            sort_order = int(sort_order)
        except Exception:
            sort_order = 0
        aud_raw = str(request.data.get("audience") or "").strip().upper()
        audience = "CONSUMER" if aud_raw not in {"CONSUMER", "MERCHANT"} else aud_raw
        try:
            cid = int(category_id)
        except Exception:
            return Response({"category_id": ["Invalid or missing category_id."]}, status=status.HTTP_400_BAD_REQUEST)
        if not name:
            return Response({"name": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        cat = MerchantCategory.objects.filter(pk=cid).first()
        if not cat:
            return Response({"category_id": ["Category not found."]}, status=status.HTTP_404_NOT_FOUND)
        try:
            obj, created = MerchantSubCategory.objects.get_or_create(
                category=cat,
                name=name,
                defaults={"is_active": is_active, "sort_order": sort_order, "audience": audience},
            )
            if not created:
                obj.is_active = is_active
                obj.sort_order = sort_order
                obj.audience = audience
                obj.save(update_fields=["is_active", "sort_order", "audience"])
        except Exception as e:
            return Response({"detail": "Failed to create subcategory."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"id": obj.id, "name": obj.name, "is_active": obj.is_active, "sort_order": obj.sort_order, "audience": obj.audience, "category_id": obj.category_id}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class AdminMerchantSubCategoryDetail(APIView):
    permission_classes = [IsAdminUser]

    def get_object(self, pk: int):
        return MerchantSubCategory.objects.filter(pk=pk).first()

    def get(self, request, pk: int):
        obj = self.get_object(pk)
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        data = {"id": obj.id, "name": obj.name, "is_active": obj.is_active, "sort_order": obj.sort_order, "audience": obj.audience, "category_id": obj.category_id, "created_at": obj.created_at}
        return Response(data, status=status.HTTP_200_OK)

    def patch(self, request, pk: int):
        obj = self.get_object(pk)
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if "name" in request.data:
            name = str(request.data.get("name") or "").strip()
            if not name:
                return Response({"name": ["This field may not be blank."]}, status=status.HTTP_400_BAD_REQUEST)
            obj.name = name
        if "is_active" in request.data:
            obj.is_active = bool(request.data.get("is_active"))
        if "sort_order" in request.data:
            try:
                obj.sort_order = int(request.data.get("sort_order"))
            except Exception:
                pass
        if "category_id" in request.data:
            try:
                cid = int(request.data.get("category_id"))
            except Exception:
                return Response({"category_id": ["Invalid category_id."]}, status=status.HTTP_400_BAD_REQUEST)
            cat = MerchantCategory.objects.filter(pk=cid).first()
            if not cat:
                return Response({"category_id": ["Category not found."]}, status=status.HTTP_404_NOT_FOUND)
            obj.category = cat
        if "audience" in request.data:
            aud_raw = str(request.data.get("audience") or "").strip().upper()
            if aud_raw in {"CONSUMER", "MERCHANT"}:
                obj.audience = aud_raw
        obj.save()
        return Response({"id": obj.id, "name": obj.name, "is_active": obj.is_active, "sort_order": obj.sort_order, "audience": obj.audience, "category_id": obj.category_id}, status=status.HTTP_200_OK)

    def delete(self, request, pk: int):
        obj = self.get_object(pk)
        if not obj:
            return Response(status=status.HTTP_204_NO_CONTENT)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


urlpatterns = [
    # Public
    path("categories/", MerchantCategoryListPublic.as_view(), name="merchant_categories_public"),
    path("subcategories/", MerchantSubCategoryListPublic.as_view(), name="merchant_subcategories_public"),
    # Admin
    path("admin/categories/", AdminMerchantCategoryListCreate.as_view(), name="admin_merchant_categories"),
    path("admin/categories/<int:pk>/", AdminMerchantCategoryDetail.as_view(), name="admin_merchant_category_detail"),
    path("admin/subcategories/", AdminMerchantSubCategoryListCreate.as_view(), name="admin_merchant_subcategories"),
    path("admin/subcategories/<int:pk>/", AdminMerchantSubCategoryDetail.as_view(), name="admin_merchant_subcategory_detail"),
]
