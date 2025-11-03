from rest_framework import generics, permissions
from rest_framework.permissions import IsAdminUser
from .models import BusinessRegistration
from .serializers import BusinessRegistrationSerializer


class BusinessRegistrationCreateView(generics.CreateAPIView):
    """
    Public endpoint to submit a Business Registration request.
    """
    permission_classes = [permissions.AllowAny]
    queryset = BusinessRegistration.objects.all()
    serializer_class = BusinessRegistrationSerializer


class BusinessRegistrationListAdminView(generics.ListAPIView):
    """
    Optional: Admin-only listing endpoint (admin can use Django Admin UI instead).
    """
    permission_classes = [IsAdminUser]
    queryset = BusinessRegistration.objects.select_related('country', 'state', 'city', 'registered_by', 'forwarded_to')
    serializer_class = BusinessRegistrationSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_val = self.request.query_params.get('status')
        if status_val:
            qs = qs.filter(review_status=status_val)
        return qs
