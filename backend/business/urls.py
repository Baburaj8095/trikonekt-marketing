from django.urls import path
from .views import BusinessRegistrationCreateView, BusinessRegistrationListAdminView

urlpatterns = [
    path('register/', BusinessRegistrationCreateView.as_view(), name='business_register'),
    path('registrations/', BusinessRegistrationListAdminView.as_view(), name='business_registrations_admin'),
]
