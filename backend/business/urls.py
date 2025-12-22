from django.urls import path
from .views import (
    BusinessRegistrationCreateView,
    BusinessRegistrationListAdminView,
    SelfActivation50View,
    RewardProgressMeView,
    RewardRedeemView,
    ActivationStatusView,
    AgencyPackagesMeView,
    AgencyPackageCatalogView,
    AdminCreateAgencyPackagePaymentView,
    AgencyCreateMyAgencyPackagePaymentView,
    AgencyAssignPackageView,
    # Agency package payment requests
    AgencyCreatePaymentRequestView,
    AdminAgencyPaymentRequestListView,
    AdminApproveAgencyPaymentRequestView,
    AdminRejectAgencyPaymentRequestView,
    # Promo packages
    PromoPackageListView,
    PromoPurchaseMeListCreateView,
    AdminPromoPurchaseListView,
    AdminPromoPurchaseApproveView,
    AdminPromoPurchaseRejectView,
    # Rewards points summary
    RewardPointsSummaryView,
    # E‑Books
    EBookMyListView,
    # TRI Apps
    TriAppListView,
    TriAppDetailView,
    # Withdrawals
    WithdrawCommissionBreakdownView,
    AdminApplyWithdrawCommissionView,
)

urlpatterns = [
    path('register/', BusinessRegistrationCreateView.as_view(), name='business_register'),
    path('registrations/', BusinessRegistrationListAdminView.as_view(), name='business_registrations_admin'),

    # MLM packages
    path('activations/self-50/', SelfActivation50View.as_view(), name='self_activation_50'),
    path('activation/status/', ActivationStatusView.as_view(), name='activation_status'),

    # Agency Packages
    path('agency-packages/', AgencyPackagesMeView.as_view(), name='agency_packages_me'),
    path('agency-packages/catalog/', AgencyPackageCatalogView.as_view(), name='agency_packages_catalog'),
    path('agency-packages/assign/', AgencyAssignPackageView.as_view(), name='agency_package_assign'),
    path('agency-packages/<int:pk>/payments/', AdminCreateAgencyPackagePaymentView.as_view(), name='agency_package_payment_create'),
    path('agency-packages/<int:pk>/my-payments/', AgencyCreateMyAgencyPackagePaymentView.as_view(), name='agency_package_my_payment_create'),
    # Agency-submitted payment requests (create/list/approve/reject)
    path('agency-packages/<int:pk>/payment-requests/', AgencyCreatePaymentRequestView.as_view(), name='agency_package_payment_request_create'),
    path('admin/agency-packages/payment-requests/', AdminAgencyPaymentRequestListView.as_view(), name='admin_agency_payment_requests_list'),
    path('admin/agency-packages/payment-requests/<int:pk>/approve/', AdminApproveAgencyPaymentRequestView.as_view(), name='admin_agency_payment_request_approve'),
    path('admin/agency-packages/payment-requests/<int:pk>/reject/', AdminRejectAgencyPaymentRequestView.as_view(), name='admin_agency_payment_request_reject'),

    # Rewards
    path('rewards/me/', RewardProgressMeView.as_view(), name='reward_progress_me'),
    path('rewards/redeem/', RewardRedeemView.as_view(), name='reward_redeem'),
    path('rewards/points/', RewardPointsSummaryView.as_view(), name='reward_points_summary'),
    # E‑Books library (mine)
    path('ebooks/mine/', EBookMyListView.as_view(), name='ebooks_my_list'),

    # Promo Packages (Consumer + Admin)
    path('promo/packages/', PromoPackageListView.as_view(), name='promo_packages_list'),
    path('promo/purchases/', PromoPurchaseMeListCreateView.as_view(), name='promo_purchases_me'),
    path('admin/promo/purchases/', AdminPromoPurchaseListView.as_view(), name='admin_promo_purchases_list'),
    path('admin/promo/purchases/<int:pk>/approve/', AdminPromoPurchaseApproveView.as_view(), name='admin_promo_purchase_approve'),
    path('admin/promo/purchases/<int:pk>/reject/', AdminPromoPurchaseRejectView.as_view(), name='admin_promo_purchase_reject'),

    # TRI Apps (Holidays, EV, etc.)
    path('tri/apps/', TriAppListView.as_view(), name='tri_apps_list'),
    path('tri/apps/<slug:slug>/', TriAppDetailView.as_view(), name='tri_app_detail'),

    # Withdrawals: Direct Refer Commission
    path('withdrawals/breakdown/', WithdrawCommissionBreakdownView.as_view(), name='withdraw_commission_breakdown'),
    path('admin/withdrawals/apply/', AdminApplyWithdrawCommissionView.as_view(), name='admin_apply_withdraw_commission'),
]
