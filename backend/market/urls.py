from django.urls import re_path
from .views import (
    ProductListCreate,
    ProductDetail,
    PurchaseRequestListCreate,
    PurchaseRequestStatusUpdate,
    BannerListCreate,
    BannerDetail,
    BannerItemListCreate,
    BannerItemDetail,
    BannerPurchaseRequestListCreate,
    BannerPurchaseRequestStatusUpdate,
)

# Support both with and without trailing slash
urlpatterns = [
    # Products
    re_path(r"^products/?$", ProductListCreate.as_view(), name="product-list-create"),
    re_path(r"^products/(?P<pk>\d+)/?$", ProductDetail.as_view(), name="product-detail"),

    # Purchase Requests
    re_path(r"^purchase-requests/?$", PurchaseRequestListCreate.as_view(), name="purchase-request-list-create"),
    re_path(r"^purchase-requests/(?P<pk>\d+)/?$", PurchaseRequestStatusUpdate.as_view(), name="purchase-request-status"),

    # Banners
    re_path(r"^banners/?$", BannerListCreate.as_view(), name="banner-list-create"),
    re_path(r"^banners/(?P<pk>\d+)/?$", BannerDetail.as_view(), name="banner-detail"),
    re_path(r"^banners/(?P<banner_id>\d+)/items/?$", BannerItemListCreate.as_view(), name="banner-item-list-create"),
    re_path(r"^banners/(?P<banner_id>\d+)/items/(?P<pk>\d+)/?$", BannerItemDetail.as_view(), name="banner-item-detail"),

    # Banner Item Purchase Requests
    re_path(r"^banners/(?P<banner_id>\d+)/items/(?P<item_id>\d+)/purchase-requests/?$", BannerPurchaseRequestListCreate.as_view(), name="banner-item-purchase-request-list-create"),
    re_path(r"^banners/purchase-requests/(?P<pk>\d+)/?$", BannerPurchaseRequestStatusUpdate.as_view(), name="banner-item-purchase-request-status"),
]
