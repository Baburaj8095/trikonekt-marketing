from django.contrib import admin
admin.site.site_header = "Trikonekt Administration"
admin.site.site_title = "Trikonekt Admin"
admin.site.index_title = "Welcome to Trikonekt"
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/accounts/', include('accounts.urls')),
    path('api/uploads/', include('uploads.urls')),
    path('api/coupons/', include('coupons.urls')),
    path('api/location/', include('locations.urls')),
    path('api/business/', include('business.urls')),
    path('api/', include('market.urls')),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
