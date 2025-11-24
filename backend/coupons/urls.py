from rest_framework.routers import DefaultRouter
from django.urls import path, include

from .views import (
    CouponViewSet,
    CouponAssignmentViewSet,
    CouponSubmissionViewSet,
    CouponCodeViewSet,
    CouponBatchViewSet,
    CommissionViewSet,
    AuditTrailViewSet,
    ECouponPaymentConfigViewSet,
    ECouponProductViewSet,
    ECouponOrderViewSet,
)

router = DefaultRouter()
router.register(r'coupons', CouponViewSet, basename='coupon')
router.register(r'assignments', CouponAssignmentViewSet, basename='coupon-assignment')
router.register(r'codes', CouponCodeViewSet, basename='coupon-code')
router.register(r'submissions', CouponSubmissionViewSet, basename='coupon-submission')
router.register(r'batches', CouponBatchViewSet, basename='coupon-batch')
router.register(r'commissions', CommissionViewSet, basename='commission')
router.register(r'audits', AuditTrailViewSet, basename='audit')
router.register(r'store/payment-configs', ECouponPaymentConfigViewSet, basename='ecoupon-payment-config')
router.register(r'store/products', ECouponProductViewSet, basename='ecoupon-product')
router.register(r'store/orders', ECouponOrderViewSet, basename='ecoupon-order')

urlpatterns = [
    path('', include(router.urls)),
]
