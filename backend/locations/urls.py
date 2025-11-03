from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CountryViewSet, StateViewSet, CityViewSet, reverse_geocode, pincode_lookup, postoffice_search, pincodes_by_district, debug_counts

router = DefaultRouter()
router.register(r'countries', CountryViewSet, basename='countries')
router.register(r'states', StateViewSet, basename='states')
router.register(r'cities', CityViewSet, basename='cities')

urlpatterns = [
    path('reverse/', reverse_geocode, name='reverse-geocode'),
    path('pincode/<str:pin>/', pincode_lookup, name='pincode-lookup'),
    path('postoffice/search/', postoffice_search, name='postoffice-search'),
    path('pincodes/by-district/', pincodes_by_district, name='pincodes-by-district'),
    path('debug/counts/', debug_counts, name='debug-counts'),
    path('', include(router.urls)),
]
