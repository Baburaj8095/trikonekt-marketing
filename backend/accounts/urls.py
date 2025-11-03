from django.urls import path
from .views import RegisterView, CustomTokenObtainPairView, ResetPasswordView, UsersListView, MyEmployeesListView, MyBusinessesListView, MeView, regions_by_sponsor, hierarchy, WalletMe, WalletTransactionsList
from rest_framework_simplejwt.views import TokenRefreshView

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
    # Wallet
    path('wallet/me/', WalletMe.as_view(), name='wallet_me'),
    path('wallet/me/transactions/', WalletTransactionsList.as_view(), name='wallet_transactions'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
