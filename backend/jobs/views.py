from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status as drf_status

from .models import BackgroundTask


class BackgroundTaskStatusView(APIView):
    """
    GET /api/jobs/<id>/status/
    Returns lightweight status for a background task so clients can poll.

    Response:
    {
      "id": 18,
      "type": "coupon_activate",
      "status": "PENDING" | "RUNNING" | "DONE" | "FAILED",
      "last_error": "...",
      "attempts": 1,
      "max_attempts": 5,
      "scheduled_at": "...",
      "started_at": "...",
      "finished_at": "..."
    }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        task = (
            BackgroundTask.objects
            .filter(pk=int(pk))
            .only("id", "type", "status", "last_error", "attempts", "max_attempts", "scheduled_at", "started_at", "finished_at")
            .first()
        )
        if not task:
            return Response({"detail": "Not found."}, status=drf_status.HTTP_404_NOT_FOUND)
        return Response(
            {
                "id": task.id,
                "type": task.type,
                "status": task.status,
                "last_error": task.last_error or "",
                "attempts": int(task.attempts or 0),
                "max_attempts": int(task.max_attempts or 0),
                "scheduled_at": task.scheduled_at,
                "started_at": task.started_at,
                "finished_at": task.finished_at,
            },
            status=drf_status.HTTP_200_OK,
        )
