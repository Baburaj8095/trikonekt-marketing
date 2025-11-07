from django.contrib import admin
admin.site.site_header = "Trikonekt Administration"
admin.site.site_title = "Trikonekt Admin"
admin.site.index_title = "Welcome to Trikonekt"
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from core.views import CompanyInfoView, CompanyPackagesView
from coupons.views import CouponActivateView, CouponRedeemView
from accounts.views import WalletMe, WalletTransactionsList, UserKYCMeView
from business.views import DailyReportSubmitView, DailyReportMyView, DailyReportAllView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/accounts/', include('accounts.urls')),
    path('api/uploads/', include('uploads.urls')),
    path('api/coupons/', include('coupons.urls')),
    path('api/location/', include('locations.urls')),
    path('api/business/', include('business.urls')),
    path('api/admin/', include('adminapi.urls')),
    path('api/company/', CompanyInfoView.as_view()),
    path('api/company/packages/', CompanyPackagesView.as_view()),
    path('api/', include('market.urls')),
    # v1 aliases and public endpoints
    path('api/v1/coupon/activate/', CouponActivateView.as_view()),
    path('api/v1/coupon/redeem/', CouponRedeemView.as_view()),
    path('api/v1/wallet/', WalletMe.as_view()),
    path('api/v1/wallet/transactions/', WalletTransactionsList.as_view()),
    path('api/v1/kyc/submit/', UserKYCMeView.as_view()),
    path('api/v1/kyc/status/', UserKYCMeView.as_view()),
    path('api/v1/reports/submit/', DailyReportSubmitView.as_view()),
    path('api/v1/reports/my-reports/', DailyReportMyView.as_view()),
    path('api/v1/reports/all/', DailyReportAllView.as_view()),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
