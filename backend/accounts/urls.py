from django.urls import path
from .views import (
    RegisterView,
    CustomTokenObtainPairView,
    ResetPasswordView,
    UsersListView,
    MyEmployeesListView,
    MyBusinessesListView,
    MeView,
    regions_by_sponsor,
    hierarchy,
    WalletMe,
    WalletTransactionsList,
    UserKYCMeView,
    WithdrawalCreateView,
    MyWithdrawalsListView,
    TeamSummaryView,
    MyMatrixTree,
    MyMatrixTreeByRoot,
    MySponsorTree,
    MySponsorTreeByRoot,
    ProfileMeView,
    # Support portal (user)
    SupportTicketListCreate,
    SupportTicketDetail,
    SupportTicketMessageCreate,
)
from .token_serializers import CustomTokenRefreshView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('password/reset/', ResetPasswordView.as_view(), name='password_reset'),
    path('users/', UsersListView.as_view(), name='users_list'),
    path('me/', MeView.as_view(), name='me'),
    path('profile/', ProfileMeView.as_view(), name='profile_me'),
    path('my/employees/', MyEmployeesListView.as_view(), name='my_employees'),
    path('my/businesses/', MyBusinessesListView.as_view(), name='my_businesses'),
    path('regions/by-sponsor/', regions_by_sponsor, name='regions_by_sponsor'),
    path('hierarchy/', hierarchy, name='hierarchy'),
    path('my/matrix/tree/', MyMatrixTree.as_view(), name='my_matrix_tree'),
    path('matrix/tree5/', MyMatrixTreeByRoot.as_view(), name='my_matrix_tree_by_root'),
    path('my/sponsor/tree/', MySponsorTree.as_view(), name='my_sponsor_tree'),
    path('sponsor/tree/', MySponsorTreeByRoot.as_view(), name='my_sponsor_tree_by_root'),
    path('team/summary/', TeamSummaryView.as_view(), name='team_summary'),
    # Wallet
    path('wallet/me/', WalletMe.as_view(), name='wallet_me'),
    path('wallet/me/transactions/', WalletTransactionsList.as_view(), name='wallet_transactions'),
    # KYC + Withdrawals
    path('kyc/me/', UserKYCMeView.as_view(), name='kyc_me'),
    path('withdrawals/', WithdrawalCreateView.as_view(), name='withdrawals_create'),
    path('withdrawals/me/', MyWithdrawalsListView.as_view(), name='my_withdrawals'),
    # Support (User)
    path('support/tickets/', SupportTicketListCreate.as_view(), name='support_tickets'),
    path('support/tickets/<int:pk>/', SupportTicketDetail.as_view(), name='support_ticket_detail'),
    path('support/tickets/<int:pk>/messages/', SupportTicketMessageCreate.as_view(), name='support_ticket_message_create'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
]
