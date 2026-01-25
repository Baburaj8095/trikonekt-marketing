from django.urls import path
from .views import (
    UIEcommerceHomeView,
    UICategoryConfigView,
    UIPageConfigListCreate,
    UIPageConfigDetail,
)

urlpatterns = [
    # Public UI configs
    path("pages/ecommerce-home/", UIEcommerceHomeView.as_view(), name="ui_ecommerce_home"),
    path("pages/category/", UICategoryConfigView.as_view(), name="ui_category_config"),

    # Admin CRUD for UI Page Configs
    path("admin/pages/", UIPageConfigListCreate.as_view(), name="ui_pageconfig_list_create"),
    path("admin/pages/<int:pk>/", UIPageConfigDetail.as_view(), name="ui_pageconfig_detail"),
]
