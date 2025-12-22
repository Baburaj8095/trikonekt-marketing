from django.urls import path
from .views import (
    DeviceTokenRegisterView,
    InboxListView,
    MarkReadView,
    PinnedListView,
    UnreadCountView,
    AdminTemplateDispatchView,
    AdminTemplateBulkDispatchView,
)

urlpatterns = [
    path("device-token/", DeviceTokenRegisterView.as_view()),
    path("inbox/", InboxListView.as_view()),
    path("mark-read/", MarkReadView.as_view()),
    path("pinned/", PinnedListView.as_view()),
    path("unread-count/", UnreadCountView.as_view()),
    # Admin dispatch endpoints
    path("admin/templates/<int:pk>/dispatch/", AdminTemplateDispatchView.as_view()),
    path("admin/templates/bulk-dispatch/", AdminTemplateBulkDispatchView.as_view()),
]
