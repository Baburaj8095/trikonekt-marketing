from django.urls import path
from .views import (
    AdminMetricsView,
    AdminUserTreeRoot,
    AdminUserTreeChildren,
    AdminUsersList,
    AdminECouponBulkCreateView,
    AdminECouponAssignView,
    AdminKYCList,
    AdminKYCVerifyView,
    AdminKYCRejectView,
    AdminWithdrawalList,
    AdminWithdrawalApproveView,
    AdminWithdrawalRejectView,
    AdminMatrixProgressList,
    AdminMatrixTree,
    AdminAutopoolSummary,
)

urlpatterns = [
    path("metrics/", AdminMetricsView.as_view()),
    path("users/tree/root/", AdminUserTreeRoot.as_view()),
    path("users/tree/children/", AdminUserTreeChildren.as_view()),
    path("users/", AdminUsersList.as_view()),

    # E-Coupons (ELC)
    path("coupons/bulk-ecoupons/", AdminECouponBulkCreateView.as_view()),
    path("coupons/assign-ecoupons/", AdminECouponAssignView.as_view()),

    # KYC
    path("kyc/", AdminKYCList.as_view()),
    path("kyc/<int:user_id>/verify/", AdminKYCVerifyView.as_view()),
    path("kyc/<int:user_id>/reject/", AdminKYCRejectView.as_view()),

    # Withdrawals
    path("withdrawals/", AdminWithdrawalList.as_view()),
    path("withdrawals/<int:pk>/approve/", AdminWithdrawalApproveView.as_view()),
    path("withdrawals/<int:pk>/reject/", AdminWithdrawalRejectView.as_view()),

    # Matrix & Autopool
    path("matrix/progress/", AdminMatrixProgressList.as_view()),
    path("matrix/tree/", AdminMatrixTree.as_view()),
    path("autopool/summary/", AdminAutopoolSummary.as_view()),
]
