from django.urls import path
from .views import (
    BusinessRegistrationCreateView,
    BusinessRegistrationListAdminView,
    SelfActivation50View,
    RewardProgressMeView,
    RewardRedeemView,
    ActivationStatusView,
    AgencyPackagesMeView,
    AdminCreateAgencyPackagePaymentView,
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
)

urlpatterns = [
    path('register/', BusinessRegistrationCreateView.as_view(), name='business_register'),
    path('registrations/', BusinessRegistrationListAdminView.as_view(), name='business_registrations_admin'),

    # MLM packages
    path('activations/self-50/', SelfActivation50View.as_view(), name='self_activation_50'),
    path('activation/status/', ActivationStatusView.as_view(), name='activation_status'),

    # Agency Packages
    path('agency-packages/', AgencyPackagesMeView.as_view(), name='agency_packages_me'),
    path('agency-packages/<int:pk>/payments/', AdminCreateAgencyPackagePaymentView.as_view(), name='agency_package_payment_create'),

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
]
