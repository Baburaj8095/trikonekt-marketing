from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status


class CompanyInfoView(APIView):
    """
    GET /api/company
    Returns static Company section information.
    """
    authentication_classes = []  # public
    permission_classes = []

    def get(self, request):
        data = {
            "about": "Trikonekt is a next-generation digital commerce and networking platform combining wealth creation, e-commerce, and rewards.",
            "vision": "To empower every individual through a transparent, digital, and rewarding ecosystem.",
            "mission": "To connect opportunities, growth, and technology to build financial independence globally.",
        }
        return Response(data, status=status.HTTP_200_OK)


class CompanyPackagesView(APIView):
    """
    GET /api/company/packages
    Returns static package and rewards details for display in frontend.
    """
    authentication_classes = []  # public
    permission_classes = []

    def get(self, request):
        packages = {
            "package_1_prime_150": {
                "name": "Package 1 – ₹150 Prime Subscription",
                "price": 150,
                "benefits": [
                    "Free lucky coupon (₹50 lakh worth gifts)",
                    "Trikonekt redeem bonus",
                    "Referral bonus ₹15 per direct",
                    "Direct welcome bonus ₹5",
                    "Level bonus (5 matrix, up to ₹17,750)",
                    "Global autopool bonus (3 matrix, L1–L15)",
                    "3% lifetime withdrawal bonus on referral withdrawals",
                    "3% global royalty after 25 self accounts (₹150)",
                    "Rewards (coupon-based incentives)",
                ],
            },
            "package_2_product_purchase": {
                "name": "Package 2 – Product Purchase (Prime Subscription)",
                "details": [
                    "Purchase any TriCart product and get ₹150 Prime + ₹50 Global accounts",
                    "Eligible for all benefits of Packages 1 & 3",
                ],
            },
            "package_3_self_50": {
                "name": "Package 3 – ₹50 Self Block Activation",
                "price": 50,
                "benefits": [
                    "Unlocks global autopool",
                    "Rewards",
                    "Eligible for 15-level bonus",
                ],
            },
            "rewards_thresholds": [
                {"key": "resort_trip", "title": "Resort trip", "coupons": 600},
                {"key": "mobile_fund", "title": "Mobile fund", "coupons": 600},
                {"key": "bike_fund", "title": "Bike fund", "coupons": 1500},
                {"key": "thailand_trip", "title": "Thailand trip", "coupons": 2800},
            ],
        }
        return Response(packages, status=status.HTTP_200_OK)

class HealthzView(APIView):
    """
    GET /healthz
    Lightweight health check with DB ping for Render health checks.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        from django.db import connection
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception as e:
            return Response({"status": "error", "db": False, "error": str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"status": "ok", "db": True}, status=status.HTTP_200_OK)
