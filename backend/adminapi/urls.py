from django.urls import path, include
from .views import (
    AdminMetricsView,
    AdminUserTreeRoot,
    AdminUserTreeDefaultRoot,
    AdminUserTreeChildren,
    AdminUsersList,
    AdminUserDetail,
    AdminUserImpersonateView,
    AdminUserSetTempPasswordView,
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
    AdminMatrix5Tree,
    AdminAutopoolSummary,
    # Support
    AdminSupportTicketList,
    AdminSupportTicketUpdate,
    AdminSupportTicketMessageCreate,
    AdminSupportTicketApproveKYC,
    AdminPingView,
    AdminUserEditMetaView,
)
from .dynamic import router as dynamic_router, admin_meta as dynamic_admin_meta, admin_meta_summary, admin_meta_fields

urlpatterns = [
    path("metrics/", AdminMetricsView.as_view()),
    path("ping/", AdminPingView.as_view()),
    path("users/tree/root/", AdminUserTreeRoot.as_view()),
    path("users/tree/default-root/", AdminUserTreeDefaultRoot.as_view()),
    path("users/tree/children/", AdminUserTreeChildren.as_view()),
    path("users/", AdminUsersList.as_view()),
    path("users/edit-meta/", AdminUserEditMetaView.as_view()),
    path("users/<int:pk>/", AdminUserDetail.as_view()),
    path("users/<int:pk>/impersonate/", AdminUserImpersonateView.as_view()),
    path("users/<int:pk>/set-temp-password/", AdminUserSetTempPasswordView.as_view()),

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
    path("matrix/tree5/", AdminMatrix5Tree.as_view()),
    path("autopool/summary/", AdminAutopoolSummary.as_view()),

    # Support tickets
    path("support/tickets/", AdminSupportTicketList.as_view()),
    path("support/tickets/<int:pk>/", AdminSupportTicketUpdate.as_view()),
    path("support/tickets/<int:pk>/messages/", AdminSupportTicketMessageCreate.as_view()),
    path("support/tickets/<int:pk>/approve-kyc/", AdminSupportTicketApproveKYC.as_view()),
    # Dynamic admin models (auto-discovered)
    path("", include(dynamic_router.urls)),
    path("admin-meta/", dynamic_admin_meta),
    path("admin-meta/summary/", admin_meta_summary),
    path("admin-meta/fields/<str:app_label>/<str:model_name>/", admin_meta_fields),
]
