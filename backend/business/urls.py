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
]
