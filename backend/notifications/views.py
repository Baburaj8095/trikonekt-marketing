from django.utils import timezone
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from adminapi.permissions import IsAdminOrStaff

from .models import Notification, NotificationEventTemplate
from .serializers import NotificationSerializer, DeviceTokenSerializer
from .services import upsert_device_token, dispatch_template_now


class DeviceTokenRegisterView(APIView):
    """
    POST: Register or update a device/browser push token for the current user.
    Body:
      {
        "token": "required",
        "platform": "web|android|ios",
        "provider": "fcm|onesignal",
        "subscribed": true/false,
        "app_version": "optional"
      }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = DeviceTokenSerializer(data=request.data or {})
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        data = ser.validated_data
        try:
            obj = upsert_device_token(
                user=request.user,
                token=data["token"],
                platform=data.get("platform") or "web",
                provider=data.get("provider") or "fcm",
                subscribed=bool(data.get("subscribed", True)),
                app_version=data.get("app_version") or "",
            )
            return Response({"ok": True, "id": obj.id}, status=200)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)


class InboxListView(ListAPIView):
    """
    GET: List in-app notifications for the current user.
    Query params:
      - page (default 1), page_size (default 25, max 200)
      - read: 1|true => only read, 0|false|unread => only unread (default: all)
      - pinned: 1|true => only currently pinned (pinned_until is null or in future)
      - since: ISO date (optional) => filter created_at__date >= since
      - ordering: default -created_at
    """
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        u = self.request.user
        qs = Notification.objects.filter(user=u).order_by("-created_at")

        read = (self.request.query_params.get("read") or "").strip().lower()
        if read in ("1", "true", "yes", "read"):
            qs = qs.filter(read_at__isnull=False)
        elif read in ("0", "false", "no", "unread"):
            qs = qs.filter(read_at__isnull=True)

        pinned = (self.request.query_params.get("pinned") or "").strip().lower()
        if pinned in ("1", "true", "yes"):
            now = timezone.now()
            qs = qs.filter(Q(pinned_until__isnull=True) | Q(pinned_until__gte=now))

        since = (self.request.query_params.get("since") or "").strip()
        if since:
            try:
                qs = qs.filter(created_at__date__gte=since)
            except Exception:
                pass

        ordering = (self.request.query_params.get("ordering") or "-created_at").strip()
        if ordering:
            qs = qs.order_by(ordering)
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        try:
            page = int(request.query_params.get("page") or 1)
        except Exception:
            page = 1
        try:
            page_size = int(request.query_params.get("page_size") or 25)
        except Exception:
            page_size = 25
        page = max(1, page)
        page_size = max(1, min(page_size, 200))
        total = qs.count()
        start = (page - 1) * page_size
        end = start + page_size
        ser = self.get_serializer(qs[start:end], many=True)
        return Response({"count": total, "results": ser.data}, status=200)


class MarkReadView(APIView):
    """
    PATCH: Mark notifications as read for current user.
    Body:
      - {"ids": [1,2,3]}  => mark selected
      - {"all": true}     => mark all unread as read
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        data = request.data or {}
        ids = data.get("ids") or []
        mark_all = bool(data.get("all"))

        qs = Notification.objects.filter(user=request.user, read_at__isnull=True)
        if ids and isinstance(ids, list):
            try:
                ids = [int(x) for x in ids if str(x).isdigit()]
            except Exception:
                ids = []
            if ids:
                qs = qs.filter(id__in=ids)
        elif not mark_all:
            return Response({"detail": "Provide ids or set all=true"}, status=400)

        now = timezone.now()
        updated = qs.update(read_at=now)
        return Response({"updated": int(updated)}, status=200)


class PinnedListView(ListAPIView):
    """
    GET: List currently pinned announcements for the current user.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        now = timezone.now()
        return (
            Notification.objects
            .filter(user=self.request.user)
            .filter(Q(pinned_until__isnull=True) | Q(pinned_until__gte=now))
            .order_by("-priority", "-created_at")
        )

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        # Keep this lightweight; max 20 items
        ser = self.get_serializer(qs[:20], many=True)
        return Response({"results": ser.data}, status=200)


class UnreadCountView(APIView):
    """
    GET: Return unread notifications count for the current user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        c = Notification.objects.filter(user=request.user, read_at__isnull=True).count()
        return Response({"unread": c}, status=200)


class AdminTemplateDispatchView(APIView):
    """
    POST: Admin-triggered dispatch for a single template.
    Body: optional for future use; currently ignored
    """
    permission_classes = [IsAdminOrStaff]

    def post(self, request, pk=None):
        if pk is None:
            return Response({"detail": "Template id required"}, status=400)
        try:
            tpl = NotificationEventTemplate.objects.get(pk=int(pk), is_active=True)
        except Exception:
            return Response({"detail": "Template not found"}, status=404)
        try:
            batch = dispatch_template_now(template=tpl, actor=request.user)
            return Response(
                {"ok": True, "batch_id": batch.id, "target_counts": batch.target_counts},
                status=200,
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=400)


class AdminTemplateBulkDispatchView(APIView):
    """
    POST: Admin-triggered bulk dispatch for multiple templates.
    Body:
      { "ids": [1,2,3] }
    """
    permission_classes = [IsAdminOrStaff]

    def post(self, request):
        ids = (request.data or {}).get("ids") or []
        try:
            ids = [int(i) for i in ids if str(i).isdigit()]
        except Exception:
            ids = []
        if not ids:
            return Response({"detail": "Provide template ids"}, status=400)

        ok = 0
        batches = []
        for tpl in NotificationEventTemplate.objects.filter(pk__in=ids, is_active=True):
            try:
                b = dispatch_template_now(template=tpl, actor=request.user)
                ok += 1
                batches.append({"id": b.id, "template": tpl.id, "targets": b.target_counts or {}})
            except Exception:
                pass

        return Response({"ok": ok, "batches": batches}, status=200)
