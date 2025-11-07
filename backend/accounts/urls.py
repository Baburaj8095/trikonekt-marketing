from django.urls import path
from .views import RegisterView, CustomTokenObtainPairView, ResetPasswordView, UsersListView, MyEmployeesListView, MyBusinessesListView, MeView, regions_by_sponsor, hierarchy, WalletMe, WalletTransactionsList, UserKYCMeView, WithdrawalCreateView, MyWithdrawalsListView, TeamSummaryView
from .token_serializers import CustomTokenRefreshView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('password/reset/', ResetPasswordView.as_view(), name='password_reset'),
    path('users/', UsersListView.as_view(), name='users_list'),
    path('me/', MeView.as_view(), name='me'),
    path('my/employees/', MyEmployeesListView.as_view(), name='my_employees'),
    path('my/businesses/', MyBusinessesListView.as_view(), name='my_businesses'),
    path('regions/by-sponsor/', regions_by_sponsor, name='regions_by_sponsor'),
    path('hierarchy/', hierarchy, name='hierarchy'),
    path('team/summary/', TeamSummaryView.as_view(), name='team_summary'),
    # Wallet
    path('wallet/me/', WalletMe.as_view(), name='wallet_me'),
    path('wallet/me/transactions/', WalletTransactionsList.as_view(), name='wallet_transactions'),
    # KYC + Withdrawals
    path('kyc/me/', UserKYCMeView.as_view(), name='kyc_me'),
    path('withdrawals/', WithdrawalCreateView.as_view(), name='withdrawals_create'),
    path('withdrawals/me/', MyWithdrawalsListView.as_view(), name='my_withdrawals'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
]
