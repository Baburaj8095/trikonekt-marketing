from __future__ import annotations

from datetime import timedelta
from typing import Iterable, Optional, Tuple, List, Dict

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from accounts.models import CustomUser
from .models import (
    DeviceToken,
    Notification,
    NotificationBatch,
    NotificationEventTemplate,
)


def _effective_role_for_user(role: str, category: str) -> str:
    """
    Normalize role for audience reporting.
    """
    r = (role or "").strip().lower()
    c = (category or "").strip().lower()
    if c in ("business", "merchant"):
        return "business"
    if r in ("agency", "employee"):
        return r
    if c.startswith("agency"):
        return "agency"
    return "consumer"


def _q_for_role_token(token: str) -> Q:
    """
    Build a Q filter for a single role token from audience.roles
    Supported tokens: consumer, business, merchant, agency, employee, company, all
    """
    t = (token or "").strip().lower()
    if t in ("all", "*"):
        return Q()
    if t in ("consumer", "user"):
        return Q(role__iexact="user") & Q(category__iexact="consumer")
    if t in ("business", "merchant"):
        return Q(category__in=["business", "merchant"])
    if t == "agency":
        return Q(role__iexact="agency") | Q(category__istartswith="agency")
    if t == "employee":
        return Q(role__iexact="employee")
    if t == "company":
        return Q(category__iexact="company")
    # Fallback: assume it's a CustomUser.role value
    return Q(role__iexact=t)


def _build_audience_q(audience: dict | None) -> Tuple[Q, Dict]:
    """
    Convert template.audience into a Q filter and normalized config.
    audience structure example:
      {
        "roles": ["consumer", "agency", "employee", "merchant"],
        "require_active": true,
        "user_ids": [1,2,3],
        "exclude_user_ids": [4,5]
      }
    """
    aud = dict(audience or {})
    roles = aud.get("roles") or []
    user_ids = aud.get("user_ids") or []
    exclude_ids = aud.get("exclude_user_ids") or []
    require_active = bool(aud.get("require_active", True))

    q = Q()
    if roles:
        role_q = Q()
        for r in roles:
            role_q = role_q | _q_for_role_token(r)
        q = q & role_q
    if user_ids:
        q = q & Q(id__in=[int(x) for x in user_ids if str(x).isdigit()])
    if exclude_ids:
        q = q & ~Q(id__in=[int(x) for x in exclude_ids if str(x).isdigit()])
    if require_active:
        q = q & Q(account_active=True)
    return q, {"roles": roles, "require_active": require_active, "user_ids": user_ids, "exclude_user_ids": exclude_ids}


def _dedupe_user_ids(template: NotificationEventTemplate, user_ids: Iterable[int]) -> List[int]:
    """
    If template.dedupe_key is set, avoid creating duplicate notifications for same user
    with identical title/body/deep_link within a recent window.
    """
    ids = list(set(int(x) for x in user_ids if str(x).isdigit()))
    if not ids:
        return []

    if not (template.dedupe_key or "").strip():
        return ids

    cutoff = timezone.now() - timedelta(days=7)
    # Find users who already have a similar recent broadcast
    existing = set(
        Notification.objects.filter(
            user_id__in=ids,
            is_broadcast=True,
            title=template.title,
            body=template.body,
            deep_link=template.deep_link,
            created_at__gte=cutoff,
        ).values_list("user_id", flat=True)
    )
    return [uid for uid in ids if uid not in existing]


def estimated_target_device_counts(user_ids: Iterable[int]) -> int:
    """
    Count subscribed device tokens for supplied user ids, best-effort.
    """
    ids = list(set(int(x) for x in user_ids if str(x).isdigit()))
    if not ids:
        return 0
    return DeviceToken.objects.filter(user_id__in=ids, subscribed=True).count()


def _should_send_in_app(template: NotificationEventTemplate) -> bool:
    try:
        ch = dict(template.channels or {})
        return bool(ch.get("in_app", True))
    except Exception:
        return True


def _should_send_push(template: NotificationEventTemplate) -> bool:
    try:
        ch = dict(template.channels or {})
        push_flag = bool(ch.get("push", False))
    except Exception:
        push_flag = False
    return push_flag and bool(getattr(settings, "NOTIFICATIONS_PUSH_ENABLED", False))


def upsert_device_token(
    *,
    user: CustomUser,
    token: str,
    platform: str = "web",
    provider: str = "fcm",
    subscribed: bool = True,
    app_version: str = "",
) -> DeviceToken:
    """
    Create/update a DeviceToken record for a user, keyed by unique token string.
    Reassigns existing token to this user if it was previously associated with someone else.
    """
    platform = (platform or "web").lower()
    provider = (provider or "fcm").lower()
    subscribed = bool(subscribed)
    app_version = app_version or ""

    # Reassign token to current user if exists
    obj, created = DeviceToken.objects.get_or_create(token=str(token), defaults={
        "user": user,
        "platform": platform,
        "provider": provider,
        "subscribed": subscribed,
        "role_cached": _effective_role_for_user(user.role, user.category),
        "app_version": app_version,
    })
    if not created:
        # Update fields and re-bind to this user if changed
        changed = False
        if obj.user_id != user.id:
            obj.user = user
            changed = True
        for f, v in {
            "platform": platform,
            "provider": provider,
            "subscribed": subscribed,
            "app_version": app_version,
            "role_cached": _effective_role_for_user(user.role, user.category),
        }.items():
            if getattr(obj, f) != v:
                setattr(obj, f, v)
                changed = True
        if changed:
            obj.save()
    return obj


@transaction.atomic
def dispatch_template_now(*, template: NotificationEventTemplate, actor: Optional[CustomUser] = None) -> NotificationBatch:
    """
    Dispatch an admin-configured template as an in-app broadcast (and optionally push stub).
    Steps:
      - Compute audience (roles, ids, require_active)
      - Create NotificationBatch (status=processing)
      - Bulk-create Notification rows for recipients (respect dedupe_key)
      - Optionally integrate push provider in future; currently stubbed
      - Mark batch completed with target counts
    """
    template = NotificationEventTemplate.objects.select_for_update().get(pk=template.pk)  # lock row for consistency

    batch = NotificationBatch.objects.create(
        template=template,
        created_by=actor if (actor and getattr(actor, "id", None)) else None,
        status="processing",
        started_at=timezone.now(),
    )

    # Build audience queryset
    audience_q, _aud_norm = _build_audience_q(template.audience)
    base_qs = CustomUser.objects.filter(audience_q).only("id", "username", "role", "category")

    user_ids = list(base_qs.values_list("id", flat=True))
    user_ids = _dedupe_user_ids(template, user_ids)

    # Early complete when nothing to do
    if not user_ids:
        batch.target_counts = {"users": 0, "devices": 0}
        batch.status = "completed"
        batch.finished_at = timezone.now()
        batch.save(update_fields=["target_counts", "status", "finished_at"])
        return batch

    # Prepare Notification rows
    in_app_enabled = _should_send_in_app(template)
    to_create: List[Notification] = []
    now = timezone.now()

    if in_app_enabled:
        # Fetch roles/categories for caching in notifications
        role_map = dict(CustomUser.objects.filter(id__in=user_ids).values_list("id", "role"))
        cat_map = dict(CustomUser.objects.filter(id__in=user_ids).values_list("id", "category"))

        for uid in user_ids:
            role_cached = _effective_role_for_user(role_map.get(uid, ""), cat_map.get(uid, ""))
            to_create.append(
                Notification(
                    batch=batch,
                    user_id=uid,
                    role_cached=role_cached,
                    channel="in_app",
                    is_broadcast=True,
                    title=template.title,
                    body=template.body,
                    deep_link=template.deep_link or "",
                    priority=template.priority or "normal",
                    pinned_until=template.pinned_until,
                    delivered_at=now,
                )
            )

        # Bulk insert in chunks
        chunk = 1000
        for i in range(0, len(to_create), chunk):
            Notification.objects.bulk_create(to_create[i:i + chunk], ignore_conflicts=True)

    # Push channel stub (provider integration can be added later)
    device_count = estimated_target_device_counts(user_ids) if _should_send_push(template) else 0

    batch.target_counts = {"users": len(user_ids), "devices": device_count}
    batch.status = "completed"
    batch.finished_at = timezone.now()
    batch.save(update_fields=["target_counts", "status", "finished_at"])

    return batch
