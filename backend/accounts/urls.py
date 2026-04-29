from django.urls import path
from .views import (
    RegisterView,
    CustomTokenObtainPairView,
    ResetPasswordView,
    UsersListView,
    MyEmployeesListView,
    AgencyEmployeeActivationView,
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
    # Nominees
    NomineeListCreateView,
    NomineeDetailView,
    # Offer letter
    OfferLetterPDFView,
    # Wallet history/banks/spend
    wallet_me_history,
    wallet_me_banks,
    wallet_purchase_ecoupon,
    wallet_purchase_product,
    WalletTransferConsumerLookup,
    WalletTransferOtpRequest,
    WalletTransferConfirm,
    # Direct sponsor member detail
    DirectMemberDetailView,
)
from .token_serializers import CustomTokenRefreshView
from .views_tree import MyFiveMatrixTeamV1, FiveMatrixCountsView, MyMatrix5EntriesTree

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('password/reset/', ResetPasswordView.as_view(), name='password_reset'),
    path('users/', UsersListView.as_view(), name='users_list'),
    path('me/', MeView.as_view(), name='me'),
    path('profile/', ProfileMeView.as_view(), name='profile_me'),
    path('my/employees/', MyEmployeesListView.as_view(), name='my_employees'),
    # Agency can activate/deactivate their employees
    path('agency/employees/<int:pk>/activate/', AgencyEmployeeActivationView.as_view(), name='agency_employee_activate'),
    path('my/businesses/', MyBusinessesListView.as_view(), name='my_businesses'),
    path('regions/by-sponsor/', regions_by_sponsor, name='regions_by_sponsor'),
    path('hierarchy/', hierarchy, name='hierarchy'),
    path('my/matrix/tree/', MyMatrixTree.as_view(), name='my_matrix_tree'),
    path('my/matrix/tree5/entries/', MyMatrix5EntriesTree.as_view(), name='my_matrix5_entries_tree'),
    path('matrix/tree5/', MyMatrixTreeByRoot.as_view(), name='my_matrix_tree_by_root'),
    path('my/sponsor/tree/', MySponsorTree.as_view(), name='my_sponsor_tree'),
    path('sponsor/tree/', MySponsorTreeByRoot.as_view(), name='my_sponsor_tree_by_root'),
    path('team/summary/', TeamSummaryView.as_view(), name='team_summary'),
    # Wallet
    path('wallet/me/', WalletMe.as_view(), name='wallet_me'),
    path('wallet/me/transactions/', WalletTransactionsList.as_view(), name='wallet_transactions'),
    path('wallet/me/history/', wallet_me_history, name='wallet_me_history'),
    path('wallet/me/banks/', wallet_me_banks, name='wallet_me_banks'),
    path('wallet/transfer/lookup-consumer/', WalletTransferConsumerLookup.as_view(), name='wallet_transfer_lookup_consumer'),
    path('wallet/transfer/request-otp/', WalletTransferOtpRequest.as_view(), name='wallet_transfer_request_otp'),
    path('wallet/transfer/confirm/', WalletTransferConfirm.as_view(), name='wallet_transfer_confirm'),
    path('wallet/purchase/ecoupon/', wallet_purchase_ecoupon, name='wallet_purchase_ecoupon'),
    path('wallet/purchase/product/', wallet_purchase_product, name='wallet_purchase_product'),
    # KYC + Withdrawals
    path('kyc/me/', UserKYCMeView.as_view(), name='kyc_me'),
    path('withdrawals/', WithdrawalCreateView.as_view(), name='withdrawals_create'),
    path('withdrawals/me/', MyWithdrawalsListView.as_view(), name='my_withdrawals'),
    # Support (User)
    path('support/tickets/', SupportTicketListCreate.as_view(), name='support_tickets'),
    path('support/tickets/<int:pk>/', SupportTicketDetail.as_view(), name='support_ticket_detail'),
    path('support/tickets/<int:pk>/messages/', SupportTicketMessageCreate.as_view(), name='support_ticket_message_create'),
    # Nominees
    path('nominees/', NomineeListCreateView.as_view(), name='nominees_list_create'),
    path('nominees/<int:pk>/', NomineeDetailView.as_view(), name='nominee_detail'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    # Employee Offer Letter (PDF download)
    path('employee/offer-letter/', OfferLetterPDFView.as_view(), name='employee_offer_letter'),
    # New: 5-matrix genealogy (self + subtree within my downline)
    path('my/genealogy/tree5/', MyFiveMatrixTeamV1.as_view(), name='my_genealogy_tree5'),
    # Five-matrix genealogy counts (placed ACTIVE nodes only)
    path('genealogy/5m/counts/', FiveMatrixCountsView.as_view(), name='five_matrix_counts'),
    # Direct sponsor member detail
    path('direct/member-detail/', DirectMemberDetailView.as_view(), name='direct_member_detail'),
]
