from django.urls import path

from .views import (
    RanksListView,
    UserUpgradeEligibilityView,
    UpgradeInitiateView,
    UpgradeSuccessView,
    UpgradePaymentRequestView,
    MyRankUpgradesView,
    AdminRankUpgradesView,
    AdminUpgradeCommissionsView,
    AdminCommissionHoldsView,
    AdminApproveRankUpgradeView,
    AdminRejectRankUpgradeView,
    MyCommissionHoldsView,
    MyLevelBonusProgressView,
    RankMatrixTreeView,
    RankMatrixSubtreeView,
    RankMatrixBFSView,
)

urlpatterns = [
    # Public/User APIs
    path("ranks/", RanksListView.as_view()),
    path("user/upgrade-eligibility/", UserUpgradeEligibilityView.as_view()),
    path("upgrade/initiate/", UpgradeInitiateView.as_view()),
    path("upgrade/success/", UpgradeSuccessView.as_view()),
    path("upgrade/payment-request/", UpgradePaymentRequestView.as_view()),
    path("user/rank-upgrades/", MyRankUpgradesView.as_view()),
    path("user/rank-commission-holds/", MyCommissionHoldsView.as_view()),
    path("user/level-bonus-progress/", MyLevelBonusProgressView.as_view()),
    # Rank-1 Five-Matrix Tree
    path("rank-matrix/tree/", RankMatrixTreeView.as_view()),
    path("rank-matrix/subtree/", RankMatrixSubtreeView.as_view()),
    path("rank-matrix/tree-bfs/", RankMatrixBFSView.as_view()),

    # Admin APIs
    path("admin/rank-upgrades/", AdminRankUpgradesView.as_view()),
    path("admin/rank-upgrades/<int:upgrade_id>/commissions/", AdminUpgradeCommissionsView.as_view()),
    path("admin/rank-commission-holds/", AdminCommissionHoldsView.as_view()),
    path("admin/rank-upgrades/<int:upgrade_id>/approve/", AdminApproveRankUpgradeView.as_view()),
    path("admin/rank-upgrades/<int:upgrade_id>/reject/", AdminRejectRankUpgradeView.as_view()),
]
