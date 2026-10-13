from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CountryViewSet, StateViewSet, CityViewSet, reverse_geocode, pincode_lookup, postoffice_search, pincodes_by_district, districts_by_state, debug_counts, postal_legacy_pincode_proxy

router = DefaultRouter()
router.register(r'countries', CountryViewSet, basename='countries')
router.register(r'states', StateViewSet, basename='states')
router.register(r'cities', CityViewSet, basename='cities')

urlpatterns = [
    path('reverse/', reverse_geocode, name='reverse-geocode'),
    path('pincode/<str:pin>/', pincode_lookup, name='pincode-lookup'),
    path('pincode/legacy/<str:pin>/', postal_legacy_pincode_proxy, name='postal-legacy-pincode-proxy'),
    path('postoffice/search/', postoffice_search, name='postoffice-search'),
    path('districts/by-state/', districts_by_state, name='districts-by-state'),
    path('pincodes/by-district/', pincodes_by_district, name='pincodes-by-district'),
    path('debug/counts/', debug_counts, name='debug-counts'),
    path('', include(router.urls)),
]
