from django.urls import re_path
from .views import (
    ProductListCreate,
    ProductDetail,
    PurchaseRequestListCreate,
    PurchaseRequestStatusUpdate,
    PurchaseRequestInvoiceView,
    BannerListCreate,
    BannerDetail,
    BannerItemListCreate,
    BannerItemDetail,
    BannerPurchaseRequestListCreate,
    BannerPurchaseRequestStatusUpdate,
    BannerPurchaseRequestAllList,
    # Merchant marketplace (new)
    MerchantCategoryList,
    MerchantSubCategoryList,
    MerchantProfileMe,
    ShopPublicList,
    ShopPublicDetail,
    ShopsNearbyView,
    ShopMineListCreate,
    ShopOwnerDetail,
    # Shop products
    ShopProductsPublicList,
    ShopProductsMineListCreate,
    ShopProductOwnerDetail,
)

# Support both with and without trailing slash
urlpatterns = [
    # Products
    re_path(r"^products/?$", ProductListCreate.as_view(), name="product-list-create"),
    re_path(r"^products/(?P<pk>\d+)/?$", ProductDetail.as_view(), name="product-detail"),

    # Purchase Requests
    re_path(r"^purchase-requests/?$", PurchaseRequestListCreate.as_view(), name="purchase-request-list-create"),
    re_path(r"^purchase-requests/(?P<pk>\d+)/?$", PurchaseRequestStatusUpdate.as_view(), name="purchase-request-status"),
    re_path(r"^purchase-requests/(?P<pk>\d+)/invoice/?$", PurchaseRequestInvoiceView.as_view(), name="purchase-request-invoice"),

    # Banners
    re_path(r"^banners/?$", BannerListCreate.as_view(), name="banner-list-create"),
    re_path(r"^banners/(?P<pk>\d+)/?$", BannerDetail.as_view(), name="banner-detail"),
    re_path(r"^banners/(?P<banner_id>\d+)/items/?$", BannerItemListCreate.as_view(), name="banner-item-list-create"),
    re_path(r"^banners/(?P<banner_id>\d+)/items/(?P<pk>\d+)/?$", BannerItemDetail.as_view(), name="banner-item-detail"),

    # Banner Item Purchase Requests
    re_path(r"^banners/(?P<banner_id>\d+)/items/(?P<item_id>\d+)/purchase-requests/?$", BannerPurchaseRequestListCreate.as_view(), name="banner-item-purchase-request-list-create"),
    re_path(r"^banners/purchase-requests/(?P<pk>\d+)/?$", BannerPurchaseRequestStatusUpdate.as_view(), name="banner-item-purchase-request-status"),
    # Admin-only: list all banner purchase requests
    re_path(r"^banners/purchase-requests/?$", BannerPurchaseRequestAllList.as_view(), name="banner-item-purchase-requests-all"),

    # ============================
    # Merchant marketplace (new)
    # ============================

    # Merchant categories (public)
    re_path(r"^merchant/categories/?$", MerchantCategoryList.as_view(), name="merchant-category-list"),
    re_path(r"^merchant/subcategories/?$", MerchantSubCategoryList.as_view(), name="merchant-subcategory-list"),

    # Public shops (ACTIVE only)
    re_path(r"^shops/nearby/?$", ShopsNearbyView.as_view(), name="shops-nearby"),
    re_path(r"^shops/?$", ShopPublicList.as_view(), name="shop-public-list"),
    re_path(r"^shops/(?P<pk>\d+)/?$", ShopPublicDetail.as_view(), name="shop-public-detail"),
    # Public products for a shop (ACTIVE only)
    re_path(r"^shops/(?P<shop_id>\d+)/products/?$", ShopProductsPublicList.as_view(), name="shop-products-public"),

    # Merchant profile (merchant only)
    re_path(r"^merchant/profile/?$", MerchantProfileMe.as_view(), name="merchant-profile-me"),

    # Merchant's shops (owner only)
    re_path(r"^merchant/shops/?$", ShopMineListCreate.as_view(), name="shop-mine-list-create"),
    re_path(r"^merchant/shops/(?P<pk>\d+)/?$", ShopOwnerDetail.as_view(), name="shop-owner-detail"),
    # Merchant shop products (owner only)
    re_path(r"^merchant/shops/(?P<shop_id>\d+)/products/?$", ShopProductsMineListCreate.as_view(), name="shop-products-mine-list-create"),
    re_path(r"^merchant/products/(?P<pk>\d+)/?$", ShopProductOwnerDetail.as_view(), name="shop-product-owner-detail"),
]
