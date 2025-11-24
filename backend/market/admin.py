from django.contrib import admin
from django.utils.html import format_html
from .models import Product, PurchaseRequest, Banner, BannerItem, BannerPurchaseRequest


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('id', 'image_thumb', 'name', 'category', 'price', 'quantity', 'discount', 'pincode', 'created_by', 'created_at')
    list_filter = ('category', 'pincode', 'created_at')
    search_fields = ('name', 'description', 'category', 'pincode', 'created_by__username', 'created_by__full_name')
    autocomplete_fields = ('created_by',)
    readonly_fields = ('created_at', 'image_thumb')
    fieldsets = (
        ('Basic Info', {
            'fields': ('name', 'description', 'category', 'image', 'image_thumb')
        }),
        ('Pricing & Stock', {
            'fields': ('price', 'quantity', 'discount')
        }),
        ('Location', {
            'fields': ('pincode',)
        }),
        ('Ownership', {
            'fields': ('created_by', 'created_at')
        }),
    )

    def image_thumb(self, obj):
        try:
            if obj.image:
                return format_html('<img src="{}" style="height:60px;width:auto;border-radius:4px;" />', obj.image.url)
        except Exception:
            pass
        return "-"
    image_thumb.short_description = "Image"


@admin.register(PurchaseRequest)
class PurchaseRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'product', 'consumer_name', 'consumer_email', 'consumer_phone', 'quantity', 'payment_method', 'status', 'created_by', 'created_at')
    list_filter = ('status', 'payment_method', 'created_at')
    search_fields = ('product__name', 'consumer_name', 'consumer_email', 'consumer_phone')
    autocomplete_fields = ('product', 'created_by')
    readonly_fields = ('created_at',)

# =====================
# Banners + BannerItems
# =====================

class BannerItemInline(admin.TabularInline):
    model = BannerItem
    extra = 0
    fields = ('name', 'price', 'quantity', 'discount', 'coupon_redeem_percent', 'commission_pool_percent', 'gift', 'created_at')
    readonly_fields = ('created_at',)


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ('id', 'image_thumb', 'title', 'is_active', 'country', 'state', 'city', 'pincode', 'created_by', 'created_at')
    list_filter = ('is_active', 'country', 'state', 'city', 'pincode', 'created_at')
    search_fields = ('title', 'description', 'created_by__username', 'created_by__full_name')
    autocomplete_fields = ('created_by',)
    readonly_fields = ('created_at', 'image_thumb')

    def image_thumb(self, obj):
        try:
            if obj.image:
                return format_html('<img src="{}" style="height:60px;width:auto;border-radius:4px;" />', obj.image.url)
        except Exception:
            pass
        return "-"
    image_thumb.short_description = "Image"
    inlines = [BannerItemInline]

@admin.register(BannerItem)
class BannerItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'banner', 'name', 'price', 'quantity', 'discount', 'coupon_redeem_percent', 'commission_pool_percent', 'gift', 'created_at')
    list_filter = ('created_at', 'banner')
    search_fields = ('name', 'banner__title')
    autocomplete_fields = ('banner',)
    readonly_fields = ('created_at',)


@admin.register(BannerPurchaseRequest)
class BannerPurchaseRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'banner', 'banner_item', 'consumer_name', 'consumer_email', 'consumer_phone', 'quantity', 'payment_method', 'status', 'created_by', 'created_at')
    list_filter = ('status', 'payment_method', 'created_at', 'banner')
    search_fields = ('banner__title', 'banner_item__name', 'consumer_name', 'consumer_email', 'consumer_phone')
    autocomplete_fields = ('banner', 'banner_item', 'created_by')
    readonly_fields = ('created_at',)

# ======================
# Prune Market admin: keep only Product
# ======================
from django.contrib.admin.sites import NotRegistered as _AdminNotRegistered

def _try_unregister(model_cls):
    try:
        admin.site.unregister(model_cls)
    except _AdminNotRegistered:
        pass
    except Exception:
        pass

_try_unregister(Banner)
_try_unregister(BannerItem)
_try_unregister(PurchaseRequest)
_try_unregister(BannerPurchaseRequest)
