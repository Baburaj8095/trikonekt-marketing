from django.urls import path
from .views import (
    DashboardCardList,
    HomeCardList,
    HeroBannerList,
    PromotionList,
    CategoryBannerList,
    LuckyDrawSubmissionView,
    LuckyDrawHistoryTREView,
    LuckyDrawPendingTREView,
    LuckyDrawTREApproveView,
    LuckyDrawTRERejectView,
    LuckyDrawPendingAgencyView,
    LuckyDrawAgencyApproveView,
    LuckyDrawAgencyRejectView,
    LuckyDrawAdminApproveView,
    LuckyDrawAdminRejectView,
    LuckyCouponAssignmentView,
    LuckyCouponAssignmentDetailView,
    AgencyQuotaView,
    StorageInfoView,
    DebugReuploadHomeCardView,
    DebugReuploadAllHomeCardsView,
    FileUploadView,
    LuckyDrawEligibilityMeView,
    # Spin-based Lucky Draw
    LuckySpinDrawListCreateView,
    LuckySpinDrawDetailView,
    LuckySpinDrawLockView,
    LuckySpinDrawUnlockView,
    LuckySpinWinnerCreateView,
    LuckySpinWinnerDeleteView,
    LuckySpinActiveView,
    LuckySpinAttemptView,
)

urlpatterns = [
    # Public/home content
    path('cards/', DashboardCardList.as_view(), name='dashboard-cards'),
    path('homecard/', HomeCardList.as_view(), name='homecard'),
    path('homecard/<int:pk>/debug-reupload/', DebugReuploadHomeCardView.as_view(), name='homecard-debug-reupload'),
    path('homecard/debug-reupload-all/', DebugReuploadAllHomeCardsView.as_view(), name='homecard-debug-reupload-all'),
    # New admin-driven dashboard media
    path('hero-banners/', HeroBannerList.as_view(), name='hero-banners'),
    path('promotions/', PromotionList.as_view(), name='promotions'),
    path('category-banners/', CategoryBannerList.as_view(), name='category-banners'),
    # Diagnostics (prod safe): verify storage backend and CLOUDINARY_URL usage
    path('debug/storage/', StorageInfoView.as_view(), name='storage-info'),
    path('files/', FileUploadView.as_view(), name='file-uploads'),

    # Lucky draw (user submits physical coupon; TRE -> Agency approvals)
    path('lucky-draw/', LuckyDrawSubmissionView.as_view(), name='lucky-draw'),
    path('lucky-draw/tre/history/', LuckyDrawHistoryTREView.as_view(), name='lucky-draw-tre-history'),
    path('lucky-draw/pending/tre/', LuckyDrawPendingTREView.as_view(), name='lucky-draw-pending-tre'),
    path('lucky-draw/pending/agency/', LuckyDrawPendingAgencyView.as_view(), name='lucky-draw-pending-agency'),
    path('lucky-draw/<int:pk>/tre-approve/', LuckyDrawTREApproveView.as_view(), name='lucky-draw-tre-approve'),
    path('lucky-draw/<int:pk>/tre-reject/', LuckyDrawTRERejectView.as_view(), name='lucky-draw-tre-reject'),
    path('lucky-draw/<int:pk>/agency-approve/', LuckyDrawAgencyApproveView.as_view(), name='lucky-draw-agency-approve'),
    path('lucky-draw/<int:pk>/agency-reject/', LuckyDrawAgencyRejectView.as_view(), name='lucky-draw-agency-reject'),
    path('lucky-draw/<int:pk>/admin-approve/', LuckyDrawAdminApproveView.as_view(), name='lucky-draw-admin-approve'),
    path('lucky-draw/<int:pk>/admin-reject/', LuckyDrawAdminRejectView.as_view(), name='lucky-draw-admin-reject'),
    # Lucky draw eligibility earned from PRIME 750 (COUPON)
    path('lucky-draw/eligibility/', LuckyDrawEligibilityMeView.as_view(), name='lucky-draw-eligibility'),

    # Agency assigns "counts" of physical coupons to employees (tracking only)
    path('lucky-assignments/', LuckyCouponAssignmentView.as_view(), name='lucky-assignments'),
    path('lucky-assignments/<int:pk>/', LuckyCouponAssignmentDetailView.as_view(), name='lucky-assignments-detail'),
    # Agency quota (admin-assigned) summary: quota, assigned, remaining
    path('agency-quota/', AgencyQuotaView.as_view(), name='agency-quota'),

    # Spin-based Lucky Draw (admin-configured)
    path('spin/draws/', LuckySpinDrawListCreateView.as_view(), name='spin-draws'),
    path('spin/draws/<int:pk>/', LuckySpinDrawDetailView.as_view(), name='spin-draw-detail'),
    path('spin/draws/<int:pk>/lock/', LuckySpinDrawLockView.as_view(), name='spin-draw-lock'),
    path('spin/draws/<int:pk>/unlock/', LuckySpinDrawUnlockView.as_view(), name='spin-draw-unlock'),
    path('spin/draws/<int:pk>/winners/', LuckySpinWinnerCreateView.as_view(), name='spin-draw-winner-create'),
    path('spin/winners/<int:pk>/', LuckySpinWinnerDeleteView.as_view(), name='spin-winner-delete'),
    path('spin/active/', LuckySpinActiveView.as_view(), name='spin-active'),
    path('spin/<int:pk>/attempt/', LuckySpinAttemptView.as_view(), name='spin-attempt'),
]
