from django.urls import path
from .views import (
    BusinessRegistrationCreateView,
    BusinessRegistrationListAdminView,
    SelfActivation50View,
    RewardProgressMeView,
    RewardRedeemView,
)

urlpatterns = [
    path('register/', BusinessRegistrationCreateView.as_view(), name='business_register'),
    path('registrations/', BusinessRegistrationListAdminView.as_view(), name='business_registrations_admin'),

    # MLM packages
    path('activations/self-50/', SelfActivation50View.as_view(), name='self_activation_50'),

    # Rewards
    path('rewards/me/', RewardProgressMeView.as_view(), name='reward_progress_me'),
    path('rewards/redeem/', RewardRedeemView.as_view(), name='reward_redeem'),
]
