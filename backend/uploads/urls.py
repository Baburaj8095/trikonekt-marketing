from django.urls import path
from .views import (
    DashboardCardList,
    HomeCardList,
    LuckyDrawSubmissionView,
    LuckyDrawHistoryTREView,
    LuckyDrawPendingTREView,
    LuckyDrawTREApproveView,
    LuckyDrawTRERejectView,
    LuckyDrawPendingAgencyView,
    LuckyDrawAgencyApproveView,
    LuckyDrawAgencyRejectView,
    LuckyCouponAssignmentView,
    LuckyCouponAssignmentDetailView,
    AgencyQuotaView,
    StorageInfoView,
    DebugReuploadHomeCardView,
    DebugReuploadAllHomeCardsView,
)

urlpatterns = [
    # Public/home content
    path('cards/', DashboardCardList.as_view(), name='dashboard-cards'),
    path('homecard/', HomeCardList.as_view(), name='homecard'),
    path('homecard/<int:pk>/debug-reupload/', DebugReuploadHomeCardView.as_view(), name='homecard-debug-reupload'),
    path('homecard/debug-reupload-all/', DebugReuploadAllHomeCardsView.as_view(), name='homecard-debug-reupload-all'),
    # Diagnostics (prod safe): verify storage backend and CLOUDINARY_URL usage
    path('debug/storage/', StorageInfoView.as_view(), name='storage-info'),

    # Lucky draw (user submits physical coupon; TRE -> Agency approvals)
    path('lucky-draw/', LuckyDrawSubmissionView.as_view(), name='lucky-draw'),
    path('lucky-draw/tre/history/', LuckyDrawHistoryTREView.as_view(), name='lucky-draw-tre-history'),
    path('lucky-draw/pending/tre/', LuckyDrawPendingTREView.as_view(), name='lucky-draw-pending-tre'),
    path('lucky-draw/pending/agency/', LuckyDrawPendingAgencyView.as_view(), name='lucky-draw-pending-agency'),
    path('lucky-draw/<int:pk>/tre-approve/', LuckyDrawTREApproveView.as_view(), name='lucky-draw-tre-approve'),
    path('lucky-draw/<int:pk>/tre-reject/', LuckyDrawTRERejectView.as_view(), name='lucky-draw-tre-reject'),
    path('lucky-draw/<int:pk>/agency-approve/', LuckyDrawAgencyApproveView.as_view(), name='lucky-draw-agency-approve'),
    path('lucky-draw/<int:pk>/agency-reject/', LuckyDrawAgencyRejectView.as_view(), name='lucky-draw-agency-reject'),

    # Agency assigns "counts" of physical coupons to employees (tracking only)
    path('lucky-assignments/', LuckyCouponAssignmentView.as_view(), name='lucky-assignments'),
    path('lucky-assignments/<int:pk>/', LuckyCouponAssignmentDetailView.as_view(), name='lucky-assignments-detail'),
    # Agency quota (admin-assigned) summary: quota, assigned, remaining
    path('agency-quota/', AgencyQuotaView.as_view(), name='agency-quota'),
]
