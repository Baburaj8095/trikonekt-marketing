from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Callable, Dict, Optional, Sequence

from django.db import models, transaction
from django.utils import timezone


class BackgroundTask(models.Model):
    """
    Minimal DB-backed background job for running heavy work outside HTTP requests.

    Usage:
      - Enqueue:
          BackgroundTask.enqueue(
              task_type="coupon_dist",
              payload={"user_id": 1, "purchase_id": 45, "coupon_ids": [101, 102], "batch_index": 0},
              idempotency_key="coupon_dist:45:0",
          )

      - Worker loop (management command 'process_tasks' will call this):
          while True:
              task = BackgroundTask.fetch_next()
              if not task:
                  sleep(1)
                  continue
              task.run()
    """

    STATUS_PENDING = "PENDING"
    STATUS_RUNNING = "RUNNING"
    STATUS_DONE = "DONE"
    STATUS_FAILED = "FAILED"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_RUNNING, "Running"),
        (STATUS_DONE, "Done"),
        (STATUS_FAILED, "Failed"),
    ]

    type = models.CharField(max_length=100, db_index=True)
    payload = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=5)
    idempotency_key = models.CharField(max_length=255, unique=True, null=True, blank=True, db_index=True)
    last_error = models.TextField(blank=True)
    scheduled_at = models.DateTimeField(default=timezone.now, db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["scheduled_at", "id"]
        indexes = [
            models.Index(fields=["type", "status", "scheduled_at"]),
        ]

    def __str__(self) -> str:
        return f"Task<{self.id}> {self.type} [{self.status}]"

    @classmethod
    @transaction.atomic
    def enqueue(
        cls,
        task_type: str,
        payload: Optional[Dict[str, Any]] = None,
        *,
        idempotency_key: Optional[str] = None,
        scheduled_at=None,
        max_attempts: int = 5,
    ) -> "BackgroundTask":
        """
        Create a new task or return existing by idempotency_key.
        """
        if scheduled_at is None:
            scheduled_at = timezone.now()
        if idempotency_key:
            obj, created = cls.objects.get_or_create(
                idempotency_key=idempotency_key,
                defaults={
                    "type": task_type,
                    "payload": payload or {},
                    "status": cls.STATUS_PENDING,
                    "scheduled_at": scheduled_at,
                    "max_attempts": max(1, int(max_attempts or 1)),
                },
            )
            # If it exists but was FAILED and attempts < max_attempts, allow requeue by resetting status
            if not created and obj.status in (cls.STATUS_FAILED,) and obj.attempts < obj.max_attempts:
                obj.status = cls.STATUS_PENDING
                obj.scheduled_at = scheduled_at
                obj.payload = payload or obj.payload or {}
                obj.save(update_fields=["status", "scheduled_at", "payload"])
            return obj
        return cls.objects.create(
            type=task_type,
            payload=payload or {},
            status=cls.STATUS_PENDING,
            scheduled_at=scheduled_at,
            max_attempts=max(1, int(max_attempts or 1)),
        )

    @classmethod
    @transaction.atomic
    def fetch_next(cls) -> Optional["BackgroundTask"]:
        """
        Atomically fetch one pending task ready to run and mark it RUNNING.
        Uses select_for_update(skip_locked) to avoid worker contention.
        """
        now = timezone.now()
        qs = (
            cls.objects.select_for_update(skip_locked=True)
            .filter(status=cls.STATUS_PENDING, scheduled_at__lte=now)
            .order_by("scheduled_at", "id")
        )
        obj = qs.first()
        if not obj:
            return None
        obj.status = cls.STATUS_RUNNING
        obj.started_at = now
        obj.attempts = (obj.attempts or 0) + 1
        obj.save(update_fields=["status", "started_at", "attempts"])
        return obj

    def run(self) -> None:
        """
        Execute this task using the registered handler.
        Sets DONE/FAILED and finished_at, records last_error on failure.
        Retries are limited by max_attempts (with backoff handled by the worker loop).
        """
        try:
            handler = get_handler(self.type)
            if not handler:
                raise RuntimeError(f"No handler registered for type '{self.type}'")
            handler(self)
            self.status = self.STATUS_DONE
            self.finished_at = timezone.now()
            self.last_error = ""
            self.save(update_fields=["status", "finished_at", "last_error"])
        except Exception as e:
            # On failure, mark FAILED; the worker can re-schedule with backoff
            self.status = self.STATUS_FAILED
            self.finished_at = timezone.now()
            try:
                self.last_error = f"{type(e).__name__}: {e}"
            except Exception:
                self.last_error = "Task failed"
            self.save(update_fields=["status", "finished_at", "last_error"])


# -----------------------
# Task handlers registry
# -----------------------

_HANDLER_REGISTRY: Dict[str, Callable[[BackgroundTask], None]] = {}


def register_handler(task_type: str, func: Callable[[BackgroundTask], None]) -> None:
    _HANDLER_REGISTRY[task_type] = func


def get_handler(task_type: str) -> Optional[Callable[[BackgroundTask], None]]:
    return _HANDLER_REGISTRY.get(task_type)


# -----------------------
# Concrete task handlers
# -----------------------

def handle_coupon_dist(task: BackgroundTask) -> None:
    """
    Payload: {
      "user_id": int,
      "purchase_id": int,
      "coupon_ids": [int, ...],          # batch
      "amount_150": "150.00",            # optional override, string/number
      "trigger": "promo_purchase",       # optional
    }
    For each coupon id: create/ensure FIVE_150 & THREE_150 accounts and distribute.
    """
    payload = task.payload or {}
    user_id = payload.get("user_id")
    purchase_id = payload.get("purchase_id")
    coupon_ids: Sequence[int] = payload.get("coupon_ids") or []
    amount_150_raw = payload.get("amount_150", "150.00")
    trigger = payload.get("trigger", "promo_purchase")

    if not user_id or not coupon_ids:
        return  # nothing to do

    from decimal import Decimal as D
    try:
        amount_150 = D(str(amount_150_raw))
    except Exception:
        amount_150 = D("150.00")

    # Late imports to avoid circular dependencies
    from accounts.models import CustomUser
    from business.services.activation import open_matrix_accounts_for_coupon

    user = CustomUser.objects.filter(pk=int(user_id)).first()
    if not user:
        return

    for cid in coupon_ids:
        try:
            open_matrix_accounts_for_coupon(user, cid, amount_150=amount_150, distribute=True, trigger=trigger)
        except Exception:
            # continue best-effort
            continue

    # Optional audit for visibility (best-effort)
    try:
        from coupons.models import AuditTrail
        AuditTrail.objects.create(
            action="task_coupon_dist_done",
            actor=user,
            notes=f"Distributed {len(coupon_ids)} coupon(s) for purchase {purchase_id}",
            metadata={"purchase_id": purchase_id, "batch_size": len(coupon_ids)},
        )
    except Exception:
        pass


def handle_monthly_759(task: BackgroundTask) -> None:
    """
    Payload: {
      "user_id": int,
      "purchase_id": int,
      "boxes": [{"package_number": int, "box_number": int, "is_first": bool}, ...]  # batch
    }
    Runs monthly 759 payouts for each box (best-effort).
    """
    payload = task.payload or {}
    user_id = payload.get("user_id")
    purchase_id = payload.get("purchase_id")
    boxes = payload.get("boxes") or []

    if not user_id or not boxes:
        return

    from accounts.models import CustomUser
    from business.services.monthly import distribute_monthly_759_payouts

    user = CustomUser.objects.filter(pk=int(user_id)).first()
    if not user:
        return

    for item in boxes:
        try:
            pkg_no = int(item.get("package_number"))
            box_no = int(item.get("box_number"))
        except Exception:
            continue
        is_first = bool(item.get("is_first"))
        try:
            distribute_monthly_759_payouts(
                user,
                is_first_month=is_first,
                source={"type": "MONTHLY_759", "id": f"{purchase_id}:{pkg_no}:{box_no}"},
            )
        except Exception:
            continue

    # Optional audit for visibility
    try:
        from coupons.models import AuditTrail
        AuditTrail.objects.create(
            action="task_monthly_759_done",
            actor=user,
            notes=f"Monthly 759 payouts for purchase {purchase_id}",
            metadata={"purchase_id": purchase_id, "boxes": boxes},
        )
    except Exception:
        pass


def handle_prime_150_units(task: BackgroundTask) -> None:
    """
    Payload: {
      "user_id": int,
      "purchase_id": int,
      "units": 5,                       # default 5 for PRIME 750 = 5 x 150
      "trigger": "PRIME_750"            # optional
    }
    Runs activate_150_active N times with unique source ids so direct/self + 3/5 matrix payouts fire per unit.
    """
    payload = task.payload or {}
    user_id = payload.get("user_id")
    purchase_id = payload.get("purchase_id")
    try:
        units = int(payload.get("units") or 5)
    except Exception:
        units = 5
    trigger = str(payload.get("trigger") or "PRIME_750")

    if not user_id or units <= 0:
        return

    from accounts.models import CustomUser
    from business.services.activation import activate_150_active

    user = CustomUser.objects.filter(pk=int(user_id)).first()
    if not user:
        return

    for i in range(1, units + 1):
        try:
            activate_150_active(user, {"type": trigger, "id": f"{purchase_id}:{i}"})
        except Exception:
            # continue best-effort
            continue

    # Optional audit for visibility (best-effort)
    try:
        from coupons.models import AuditTrail
        AuditTrail.objects.create(
            action="task_prime_units_done",
            actor=user,
            notes=f"Processed {units} unit(s) for purchase {purchase_id}",
            metadata={"purchase_id": purchase_id, "units": units, "trigger": trigger},
        )
    except Exception:
        pass


def handle_coupon_activate(task: BackgroundTask) -> None:
    """
    Run coupon activation outside HTTP request.

    Payload:
      {
        "user_id": int,
        "type": "150" | "50" | "750" | "759",
        "source": { "channel": "e_coupon", "code": "ABC...", "id": 123, ... }  # optional
      }
    Effects mirror the original /coupon/activate/ endpoint, including:
      - activate_150_active / activate_50 (heavy)
      - ensure_first_purchase_activation
      - e-coupon activation audit
      - monthly 759 or default e-coupon commission distribution (idempotent)
    """
    payload = task.payload or {}
    t = str(payload.get("type") or "").strip()
    source = dict(payload.get("source") or {})
    user_id = payload.get("user_id")
    if not user_id or t not in ("150", "50", "750", "759"):
        return

    from accounts.models import CustomUser, Wallet
    from coupons.models import CouponCode, AuditTrail
    from decimal import Decimal as D
    from business.services.activation import activate_150_active, activate_50, ensure_first_purchase_activation

    user = CustomUser.objects.filter(pk=int(user_id)).first()
    if not user:
        return

    # Normalize source for e-coupon activations: attach CouponCode.id for traceability
    try:
        code_str = str(source.get("code") or "").strip()
        ch = str(source.get("channel") or "").replace("-", "_").lower()
        if code_str and ch == "e_coupon":
            code_obj = CouponCode.objects.filter(code=code_str).first()
            if code_obj and code_obj.assigned_consumer_id == user.id:
                source["id"] = code_obj.id
    except Exception:
        code_str = str(source.get("code") or "").strip()

    # Core activation
    if t == "150":
        ok = activate_150_active(user, {"type": "coupon_150_activate", **source})
    elif t == "50":
        ok = activate_50(user, {"type": "coupon_50_activate", **source})
    else:
        ok = True  # 750/759: treat as activation event for account flags only

    # Mark first purchase flags (safe idempotent)
    try:
        ensure_first_purchase_activation(user, {"type": "coupon_first_purchase", **source})
    except Exception:
        pass

    # Record activation audit for e-coupons (no approval flow) - idempotent per user+code
    try:
        code_str = str(source.get("code") or "").strip()
        ch = str(source.get("channel") or "").replace("-", "_").lower()
        if code_str and ch == "e_coupon":
            code_obj = CouponCode.objects.filter(code=code_str).first()
            if code_obj and code_obj.assigned_consumer_id == user.id:
                if not AuditTrail.objects.filter(action="coupon_activated", actor=user, coupon_code=code_obj).exists():
                    AuditTrail.objects.create(
                        action="coupon_activated",
                        actor=user,
                        coupon_code=code_obj,
                        notes="",
                        metadata={"type": t},
                    )
    except Exception:
        pass

    # E-coupon activation commission distribution
    try:
        code_str = str(source.get("code") or "").strip()
        ch = str(source.get("channel") or "").replace("-", "_").lower()
        if code_str and ch == "e_coupon":
            code_obj = CouponCode.objects.filter(code=code_str).select_related("assigned_employee", "assigned_agency").first()
            if code_obj and code_obj.assigned_consumer_id == user.id:
                # Monthly 759 special handling
                try:
                    val = D(str(getattr(code_obj, "value", "0") or 0))
                except Exception:
                    val = None
                if val == D("759"):
                    if not AuditTrail.objects.filter(action="monthly_759_distributed", coupon_code=code_obj).exists():
                        prev_exists = AuditTrail.objects.filter(
                            action="coupon_activated",
                            actor=user,
                            coupon_code__value=D("759")
                        ).exclude(coupon_code_id=code_obj.id).exists()
                        try:
                            from business.services.monthly import distribute_monthly_759_payouts
                            distribute_monthly_759_payouts(
                                user,
                                is_first_month=(not prev_exists),
                                source={"type": "ECOUPON_759", "id": code_obj.id, "code": code_obj.code},
                            )
                        except Exception:
                            pass
                        try:
                            AuditTrail.objects.create(
                                action="monthly_759_distributed",
                                actor=user,
                                coupon_code=code_obj,
                                notes="Monthly 759 commission distribution applied",
                                metadata={"first_month": bool(not prev_exists)},
                            )
                        except Exception:
                            pass
                else:
                    # Default commission split for e-coupon activation (once per code)
                    if not AuditTrail.objects.filter(action="ecoupon_commission_awarded", coupon_code=code_obj).exists():
                        from decimal import Decimal
                        awards = []
                        if code_obj.assigned_employee_id:
                            if code_obj.assigned_employee:
                                awards.append(("employee", code_obj.assigned_employee, Decimal("15.00")))
                            if code_obj.assigned_agency:
                                awards.append(("agency", code_obj.assigned_agency, Decimal("15.00")))
                        elif code_obj.assigned_agency_id:
                            if code_obj.assigned_agency:
                                awards.append(("agency", code_obj.assigned_agency, Decimal("30.00")))
                        for role, uobj, amt in awards:
                            try:
                                w = Wallet.get_or_create_for_user(uobj)
                                w.credit(
                                    amt,
                                    tx_type="COMMISSION_CREDIT",
                                    meta={"role": role, "source": "ECOUPON_ACTIVATION", "code": code_obj.code},
                                    source_type="ECOUPON_COMMISSION",
                                    source_id=str(code_obj.id),
                                )
                            except Exception:
                                pass
                        try:
                            AuditTrail.objects.create(
                                action="ecoupon_commission_awarded",
                                actor=user,
                                coupon_code=code_obj,
                                notes="Activation commission split",
                                metadata={"awards": [{"role": r, "user": getattr(u, "username", None), "amount": str(a)} for (r, u, a) in awards]},
                            )
                        except Exception:
                            pass
    except Exception:
        pass

def handle_ecoupon_order_approve(task: BackgroundTask) -> None:
    """
    Background approval for ECouponOrder to offload heavy DB work.

    Payload:
      {
        "order_id": int,
        "reviewer_id": int | null,
        "review_note": str
      }
    Steps:
      - Allocate codes (product-specific pool, fallback to global by denomination) with select_for_update(skip_locked)
      - Update assignment fields/status based on role_at_purchase
      - For consumer orders: per-code eligibility + matrix/opening per denomination
      - Mark order APPROVED, set reviewer and audit
    """
    payload = task.payload or {}
    order_id = payload.get("order_id")
    reviewer_id = payload.get("reviewer_id")
    review_note = (payload.get("review_note") or "").strip()
    if not order_id:
        return

    from django.db import transaction
    from django.utils import timezone
    from decimal import Decimal as D
    from accounts.models import CustomUser, Wallet  # Wallet may be used by downstream calls
    from coupons.models import ECouponOrder, CouponCode, AuditTrail, record_lucky_draw_eligibility_for_code

    order = ECouponOrder.objects.select_related("buyer", "product").filter(id=int(order_id)).first()
    if not order:
        return
    if order.status == "APPROVED":
        return

    role = order.role_at_purchase
    if role not in ("consumer", "agency", "employee"):
        return

    reviewer = CustomUser.objects.filter(id=int(reviewer_id)).first() if reviewer_id else None

    with transaction.atomic():
        # Try product-scoped pool first
        specific_qs = CouponCode.objects.filter(
            issued_channel="e_coupon",
            coupon=order.product.coupon,
            value=order.denomination_snapshot,
            status="AVAILABLE",
            assigned_agency__isnull=True,
            assigned_employee__isnull=True,
            assigned_consumer__isnull=True,
        )
        available_before = specific_qs.count()
        try:
            specific_locking = specific_qs.select_for_update(skip_locked=True)
        except Exception:
            specific_locking = specific_qs

        need = int(order.quantity or 0)
        pick_ids = list(specific_locking.order_by("serial", "id").values_list("id", flat=True)[:need])

        # Fallback to global pool by denomination
        if len(pick_ids) < need:
            missing = need - len(pick_ids)
            global_qs = CouponCode.objects.filter(
                issued_channel="e_coupon",
                value=order.denomination_snapshot,
                status="AVAILABLE",
                assigned_agency__isnull=True,
                assigned_employee__isnull=True,
                assigned_consumer__isnull=True,
            ).exclude(id__in=pick_ids)
            try:
                global_locking = global_qs.select_for_update(skip_locked=True)
            except Exception:
                global_locking = global_qs
            fallback_ids = list(global_locking.order_by("serial", "id").values_list("id", flat=True)[:missing])
            pick_ids.extend(fallback_ids)

        if len(pick_ids) < need:
            # Insufficient stock; record and exit gracefully
            try:
                AuditTrail.objects.create(
                    action="store_order_approve_insufficient",
                    actor=reviewer,
                    notes=f"Insufficient e-coupon inventory for order #{order.id}",
                    metadata={"order_id": order.id, "needed": need, "allocated": len(pick_ids), "available_before": int(available_before or 0)},
                )
            except Exception:
                pass
            return

        # Assign based on purchaser role
        if role == "consumer":
            update_kwargs = {"assigned_consumer_id": order.buyer_id, "status": "SOLD"}
        elif role == "agency":
            update_kwargs = {"assigned_agency_id": order.buyer_id, "status": "ASSIGNED_AGENCY"}
        else:  # employee
            update_kwargs = {"assigned_employee_id": order.buyer_id, "status": "ASSIGNED_EMPLOYEE"}

        write_qs = CouponCode.objects.filter(id__in=pick_ids).filter(
            issued_channel="e_coupon",
            status="AVAILABLE",
            assigned_agency__isnull=True,
            assigned_employee__isnull=True,
            assigned_consumer__isnull=True,
        )
        affected = write_qs.update(**update_kwargs)
        sample_codes = list(CouponCode.objects.filter(id__in=pick_ids).values_list("code", flat=True)[:5])

        # For consumer allocations: eligibility and per-code activation/distribution
        if role == "consumer" and affected:
            assigned_codes = list(
                CouponCode.objects
                .filter(id__in=pick_ids, assigned_consumer=order.buyer)
                .only("id", "value", "code")
                .order_by("id")
            )
            for c in assigned_codes:
                try:
                    val = D(str(getattr(c, "value", "0") or 0))
                except Exception:
                    continue
                # Lucky draw eligibility (idempotent)
                try:
                    record_lucky_draw_eligibility_for_code(c)
                except Exception:
                    pass
                # Per-denomination post-allocation actions
                try:
                    if val == D("150"):
                        from business.services.activation import open_matrix_accounts_for_coupon
                        open_matrix_accounts_for_coupon(order.buyer, c.id, amount_150=D("150.00"), distribute=True, trigger="ecoupon_order")
                    elif val == D("50"):
                        from business.services.activation import activate_50
                        activate_50(
                            order.buyer,
                            {"type": "ECOUPON_ORDER_50", "id": c.id, "code": getattr(c, "code", ""), "channel": "e_coupon"},
                            package_code="ECOUPON_ORDER_50",
                        )
                except Exception:
                    # continue best-effort per code
                    continue

        # Finalize order
        order.status = "APPROVED"
        order.reviewer = reviewer
        order.reviewed_at = timezone.now()
        order.review_note = review_note
        order.allocated_count = int(affected or 0)
        order.allocated_sample_codes = sample_codes
        order.save(update_fields=["status", "reviewer", "reviewed_at", "review_note", "allocated_count", "allocated_sample_codes"])

        try:
            AuditTrail.objects.create(
                action="store_order_approved",
                actor=reviewer,
                notes=f"Approved order #{order.id}",
                metadata={"order_id": order.id, "allocated": int(affected or 0), "role": role},
            )
        except Exception:
            pass

def handle_assign_consumer_count(task: BackgroundTask) -> None:
    """
    Background bulk-assign e-coupon codes to a consumer from caller's pool.

    Payload:
      {
        "actor_id": int,                 # employee or agency performing the action
        "consumer_username": str,
        "count": int,
        "batch_id": int | null,
        "value": str | number | null,    # denomination filter e.g. "150", "759"
        "notes": str,
        "attribute_employee_id": int | null  # for agency attribution to an employee
      }
    Mirrors the logic in CouponCodeViewSet.assign_consumer_count but runs in background.
    """
    payload = task.payload or {}
    actor_id = payload.get("actor_id")
    consumer_username = (payload.get("consumer_username") or "").strip()
    try:
        count = int(payload.get("count") or 0)
    except Exception:
        count = 0
    batch_id = payload.get("batch_id")
    review_notes = (payload.get("notes") or "").strip()
    attr_emp_id = payload.get("attribute_employee_id")

    if not actor_id or not consumer_username or count <= 0:
        return

    from decimal import Decimal, InvalidOperation
    from accounts.models import CustomUser
    from coupons.models import CouponCode, AuditTrail, record_lucky_draw_eligibility_for_code

    # Load users
    actor = CustomUser.objects.filter(id=int(actor_id)).first()
    if not actor:
        return
    consumer = CustomUser.objects.filter(username__iexact=consumer_username).first()
    if not consumer:
        return

    # Role sniffing (match views' helpers)
    def _is_agency(u) -> bool:
        return (getattr(u, "role", None) == "agency") or str(getattr(u, "category", "")).startswith("agency")
    def _is_employee(u) -> bool:
        return (getattr(u, "role", None) == "employee") or (getattr(u, "category", None) == "employee")
    def _is_consumer(u) -> bool:
        return (getattr(u, "role", None) == "user") and (getattr(u, "category", None) == "consumer")

    if not _is_consumer(consumer):
        return

    # Optional denomination filter
    code_value = None
    if payload.get("value") is not None:
        try:
            code_value = Decimal(str(payload.get("value")))
        except (InvalidOperation, TypeError, ValueError):
            code_value = None

    # Build eligibility filter
    base_qs = CouponCode.objects.all()
    if _is_employee(actor):
        base_qs = base_qs.filter(
            assigned_employee=actor,
            status="ASSIGNED_EMPLOYEE",
            assigned_consumer__isnull=True,
        )
    elif _is_agency(actor):
        base_qs = base_qs.filter(
            assigned_agency=actor,
            assigned_employee__isnull=True,
            status="ASSIGNED_AGENCY",
            assigned_consumer__isnull=True,
        )
    else:
        # Only employee or agency are supported
        return

    if batch_id:
        base_qs = base_qs.filter(batch_id=batch_id)
    if code_value is not None:
        base_qs = base_qs.filter(value=code_value)

    available_before = base_qs.count()
    if available_before <= 0:
        try:
            AuditTrail.objects.create(
                action="assign_consumer_count_skipped",
                actor=actor,
                notes="No eligible codes in pool",
                metadata={"consumer_username": consumer.username, "requested": count, "available_before": 0},
            )
        except Exception:
            pass
        return

    # Choose and update rows under lock
    with transaction.atomic():
        try:
            locking_qs = base_qs.select_for_update(skip_locked=True)
        except Exception:
            locking_qs = base_qs

        pick_ids = list(locking_qs.order_by("serial", "id").values_list("id", flat=True)[:count])
        if not pick_ids:
            available_after = base_qs.count()
            try:
                AuditTrail.objects.create(
                    action="assign_consumer_count_skipped",
                    actor=actor,
                    notes="No eligible codes available at lock time",
                    metadata={"consumer_username": consumer.username, "requested": count, "available_before": available_before, "available_after": available_after},
                )
            except Exception:
                pass
            return

        update_kwargs = {"assigned_consumer_id": consumer.id, "status": "SOLD"}
        # Agency can attribute to an employee
        if _is_agency(actor) and attr_emp_id:
            update_kwargs["assigned_employee_id"] = int(attr_emp_id)

        write_qs = CouponCode.objects.filter(id__in=pick_ids)
        if _is_employee(actor):
            write_qs = write_qs.filter(
                assigned_employee=actor,
                status="ASSIGNED_EMPLOYEE",
                assigned_consumer__isnull=True,
            )
        else:
            write_qs = write_qs.filter(
                assigned_agency=actor,
                assigned_employee__isnull=True,
                status="ASSIGNED_AGENCY",
                assigned_consumer__isnull=True,
            )

        affected = write_qs.update(**update_kwargs)

        # Audit
        try:
            AuditTrail.objects.create(
                action="employee_assigned_consumer_by_count" if _is_employee(actor) else "agency_assigned_consumer_by_count",
                actor=actor,
                batch_id=(int(batch_id) if batch_id else None),
                notes=review_notes,
                metadata={
                    "consumer_id": consumer.id,
                    "consumer_username": consumer.username,
                    "count": int(affected or 0),
                    "employee_id": (int(attr_emp_id) if attr_emp_id else None),
                },
            )
        except Exception:
            pass

    # Lucky draw eligibility for actually assigned codes
    try:
        for c in CouponCode.objects.filter(id__in=pick_ids, assigned_consumer=consumer).only("id", "value", "assigned_consumer", "coupon"):
            try:
                record_lucky_draw_eligibility_for_code(c)
            except Exception:
                continue
    except Exception:
        pass


def handle_assign_employee_count(task: BackgroundTask) -> None:
    """
    Background bulk-assign e-coupon codes by count to an employee from agency's pool.

    Payload:
      {
        "actor_id": int,         # agency user performing the action
        "employee_id": int,
        "count": int,
        "batch_id": int | null,
        "value": str | number | null,
        "notes": str
      }
    Mirrors CouponCodeViewSet.assign_employee_count logic.
    """
    payload = task.payload or {}
    actor_id = payload.get("actor_id")
    employee_id = payload.get("employee_id")
    try:
        count = int(payload.get("count") or 0)
    except Exception:
        count = 0
    batch_id = payload.get("batch_id")
    review_notes = (payload.get("notes") or "").strip()

    if not actor_id or not employee_id or count <= 0:
        return

    from decimal import Decimal, InvalidOperation
    from accounts.models import CustomUser
    from coupons.models import CouponCode, AuditTrail

    actor = CustomUser.objects.filter(id=int(actor_id)).first()
    employee = CustomUser.objects.filter(id=int(employee_id)).first()
    if not actor or not employee:
        return

    def _is_agency(u) -> bool:
        return (getattr(u, "role", None) == "agency") or str(getattr(u, "category", "")).startswith("agency")
    def _is_employee(u) -> bool:
        return (getattr(u, "role", None) == "employee") or (getattr(u, "category", None) == "employee")

    if not _is_agency(actor) or not _is_employee(employee):
        return

    code_value = None
    if payload.get("value") is not None:
        try:
            code_value = Decimal(str(payload.get("value")))
        except (InvalidOperation, TypeError, ValueError):
            code_value = None

    base_qs = CouponCode.objects.filter(
        assigned_agency=actor,
        assigned_employee__isnull=True,
        assigned_consumer__isnull=True,
        status="ASSIGNED_AGENCY",
    )
    if batch_id:
        base_qs = base_qs.filter(batch_id=batch_id)
    if code_value is not None:
        base_qs = base_qs.filter(value=code_value)

    available_before = base_qs.count()
    if available_before <= 0:
        try:
            AuditTrail.objects.create(
                action="assign_employee_count_skipped",
                actor=actor,
                notes="No eligible codes in agency pool",
                metadata={"employee_id": employee.id, "requested": count, "available_before": 0},
            )
        except Exception:
            pass
        return

    with transaction.atomic():
        try:
            locking_qs = base_qs.select_for_update(skip_locked=True)
        except Exception:
            locking_qs = base_qs

        pick_ids = list(locking_qs.order_by("serial", "id").values_list("id", flat=True)[:count])
        if not pick_ids:
            available_after = base_qs.count()
            try:
                AuditTrail.objects.create(
                    action="assign_employee_count_skipped",
                    actor=actor,
                    notes="No eligible codes available at lock time",
                    metadata={"employee_id": employee.id, "requested": count, "available_before": available_before, "available_after": available_after},
                )
            except Exception:
                pass
            return

        write_qs = CouponCode.objects.filter(id__in=pick_ids).filter(
            assigned_agency=actor,
            assigned_employee__isnull=True,
            assigned_consumer__isnull=True,
            status="ASSIGNED_AGENCY",
        )
        affected = write_qs.update(assigned_employee_id=employee.id, status="ASSIGNED_EMPLOYEE")

        try:
            AuditTrail.objects.create(
                action="agency_assigned_to_employee_by_count",
                actor=actor,
                batch_id=(int(batch_id) if batch_id else None),
                notes=review_notes,
                metadata={
                    "employee_id": employee.id,
                    "count": int(affected or 0),
                },
            )
        except Exception:
            pass

def handle_assign_agency_count(task: BackgroundTask) -> None:
    """
    Background: Admin assigns next N AVAILABLE codes from a batch to a specific agency.

    Payload:
      {
        "actor_id": int,       # admin user performing the action
        "batch_id": int,
        "agency_id": int,
        "count": int
      }
    """
    payload = task.payload or {}
    actor_id = payload.get("actor_id")
    batch_id = payload.get("batch_id")
    agency_id = payload.get("agency_id")
    try:
        count = int(payload.get("count") or 0)
    except Exception:
        count = 0
    if not actor_id or not batch_id or not agency_id or count <= 0:
        return

    from accounts.models import CustomUser
    from coupons.models import CouponBatch, CouponCode, AuditTrail

    actor = CustomUser.objects.filter(id=int(actor_id)).first()
    if not actor:
        return
    batch = CouponBatch.objects.filter(id=int(batch_id)).first()
    if not batch:
        return
    agency = CustomUser.objects.filter(id=int(agency_id)).first()
    if not agency:
        return

    with transaction.atomic():
        base_qs = CouponCode.objects.filter(batch=batch, status="AVAILABLE")
        try:
            locking_qs = base_qs.select_for_update(skip_locked=True)
        except Exception:
            locking_qs = base_qs
        code_ids = list(
            locking_qs.order_by("serial", "id").values_list("id", flat=True)[:count]
        )
        if not code_ids:
            try:
                AuditTrail.objects.create(
                    action="assigned_to_agency_by_count_skipped",
                    actor=actor,
                    batch=batch,
                    notes="No available codes in batch during assign_agency_count",
                    metadata={"agency_id": agency.id, "requested": count},
                )
            except Exception:
                pass
            return

        updated = CouponCode.objects.filter(id__in=code_ids).update(
            assigned_agency_id=agency.id, status="ASSIGNED_AGENCY"
        )
        try:
            AuditTrail.objects.create(
                action="assigned_to_agency_by_count",
                actor=actor,
                batch=batch,
                notes=f"Assigned {int(updated or 0)} by count to {getattr(agency, 'username', agency.id)}",
                metadata={"agency_id": agency.id, "count": int(updated or 0)},
            )
        except Exception:
            pass


def handle_admin_assign_employee_count(task: BackgroundTask) -> None:
    """
    Background: Admin assigns next N AVAILABLE codes (with no agency/employee) to an employee.

    Payload:
      {
        "actor_id": int,       # admin user performing the action
        "batch_id": int,
        "employee_id": int,
        "count": int
      }
    """
    payload = task.payload or {}
    actor_id = payload.get("actor_id")
    batch_id = payload.get("batch_id")
    employee_id = payload.get("employee_id")
    try:
        count = int(payload.get("count") or 0)
    except Exception:
        count = 0
    if not actor_id or not batch_id or not employee_id or count <= 0:
        return

    from accounts.models import CustomUser
    from coupons.models import CouponBatch, CouponCode, AuditTrail

    actor = CustomUser.objects.filter(id=int(actor_id)).first()
    employee = CustomUser.objects.filter(id=int(employee_id)).first()
    if not actor or not employee:
        return
    batch = CouponBatch.objects.filter(id=int(batch_id)).first()
    if not batch:
        return

    with transaction.atomic():
        base_qs = CouponCode.objects.filter(
            batch=batch,
            status="AVAILABLE",
            assigned_agency__isnull=True,
            assigned_employee__isnull=True,
        )
        try:
            locking_qs = base_qs.select_for_update(skip_locked=True)
        except Exception:
            locking_qs = base_qs
        code_ids = list(
            locking_qs.order_by("serial", "id").values_list("id", flat=True)[:count]
        )
        if not code_ids:
            try:
                AuditTrail.objects.create(
                    action="admin_assigned_to_employee_by_count_skipped",
                    actor=actor,
                    batch=batch,
                    notes="No available unowned codes during admin_assign_employee_count",
                    metadata={"employee_id": employee.id, "requested": count},
                )
            except Exception:
                pass
            return

        updated = CouponCode.objects.filter(id__in=code_ids).update(
            assigned_employee_id=employee.id, status="ASSIGNED_EMPLOYEE"
        )
        try:
            AuditTrail.objects.create(
                action="admin_assigned_to_employee_by_count",
                actor=actor,
                batch=batch,
                notes=f"Assigned {int(updated or 0)} by count to {getattr(employee, 'username', employee.id)}",
                metadata={"employee_id": employee.id, "count": int(updated or 0)},
            )
        except Exception:
            pass


def handle_bulk_assign_agencies(task: BackgroundTask) -> None:
    """
    Background: Admin bulk-assign AVAILABLE codes to a list of agencies with fixed per-agency count.

    Payload:
      {
        "actor_id": int,
        "batch_id": int,
        "per_agency": int,
        "agency_ids": [int, ...]   # if empty/missing, assign to all agencies (role/category starting with agency)
      }
    """
    payload = task.payload or {}
    actor_id = payload.get("actor_id")
    batch_id = payload.get("batch_id")
    try:
        per_agency = int(payload.get("per_agency") or 0)
    except Exception:
        per_agency = 0
    agency_ids = payload.get("agency_ids") or []

    if not actor_id or not batch_id or per_agency <= 0:
        return

    from accounts.models import CustomUser
    from coupons.models import CouponBatch, CouponCode, AuditTrail
    from django.db.models import Q

    actor = CustomUser.objects.filter(id=int(actor_id)).first()
    batch = CouponBatch.objects.filter(id=int(batch_id)).first()
    if not actor or not batch:
        return

    qs_agencies = CustomUser.objects.filter(Q(role="agency") | Q(category__startswith="agency"))
    if agency_ids:
        qs_agencies = qs_agencies.filter(id__in=[int(a) for a in agency_ids])

    agency_list = list(qs_agencies.values_list("id", flat=True))
    if not agency_list:
        try:
            AuditTrail.objects.create(
                action="bulk_assigned_to_agencies_skipped",
                actor=actor,
                batch=batch,
                notes="No agencies found to assign",
                metadata={"per_agency": per_agency},
            )
        except Exception:
            pass
        return

    # Fetch all available ids once and then distribute
    base_qs = CouponCode.objects.filter(batch=batch, status="AVAILABLE")
    code_ids = list(base_qs.order_by("serial", "id").values_list("id", flat=True))
    if not code_ids:
        try:
            AuditTrail.objects.create(
                action="bulk_assigned_to_agencies_skipped",
                actor=actor,
                batch=batch,
                notes="No available codes in batch",
                metadata={"per_agency": per_agency, "agency_count": len(agency_list)},
            )
        except Exception:
            pass
        return

    result = {}
    idx = 0
    with transaction.atomic():
        for aid in agency_list:
            chunk = code_ids[idx: idx + per_agency]
            if not chunk:
                break
            updated = CouponCode.objects.filter(id__in=chunk).update(
                assigned_agency_id=int(aid), status="ASSIGNED_AGENCY"
            )
            result[str(aid)] = updated
            idx += per_agency

        try:
            AuditTrail.objects.create(
                action="bulk_assigned_to_agencies",
                actor=actor,
                batch=batch,
                notes=f"Per agency {per_agency}",
                metadata={"agency_ids": agency_list, "total_assigned": sum(result.values()) if result else 0},
            )
        except Exception:
            pass

# Register built-in handlers
register_handler("coupon_dist", handle_coupon_dist)
register_handler("monthly_759", handle_monthly_759)
register_handler("prime_150_units", handle_prime_150_units)
register_handler("coupon_activate", handle_coupon_activate)
register_handler("ecoupon_order_approve", handle_ecoupon_order_approve)
register_handler("assign_consumer_count", handle_assign_consumer_count)
register_handler("assign_employee_count", handle_assign_employee_count)
register_handler("assign_agency_count", handle_assign_agency_count)
register_handler("admin_assign_employee_count", handle_admin_assign_employee_count)
register_handler("bulk_assign_agencies", handle_bulk_assign_agencies)


# -----------------------
# Helper enqueue functions
# -----------------------

def enqueue_coupon_distribution(user_id: int, purchase_id: int, coupon_ids: Sequence[int], *, batch_index: int = 0, amount_150: Decimal | str = "150.00", trigger: str = "promo_purchase") -> BackgroundTask:
    """
    Enqueue a batch of per-coupon 150 distribution. Idempotent via idempotency_key.
    """
    key = f"coupon_dist:{purchase_id}:{batch_index}"
    return BackgroundTask.enqueue(
        task_type="coupon_dist",
        payload={
            "user_id": int(user_id),
            "purchase_id": int(purchase_id),
            "coupon_ids": [int(c) for c in coupon_ids],
            "amount_150": str(amount_150),
            "trigger": str(trigger),
        },
        idempotency_key=key,
    )


def enqueue_monthly_759(user_id: int, purchase_id: int, boxes: Sequence[Dict[str, Any]], *, batch_index: int = 0) -> BackgroundTask:
    """
    Enqueue a batch of monthly 759 payouts. Idempotent via idempotency_key.
    Each box item: {"package_number": int, "box_number": int, "is_first": bool}
    """
    key = f"monthly_759:{purchase_id}:{batch_index}"
    safe_boxes = []
    for b in boxes:
        try:
            safe_boxes.append({
                "package_number": int(b.get("package_number")),
                "box_number": int(b.get("box_number")),
                "is_first": bool(b.get("is_first", False)),
            })
        except Exception:
            continue
    return BackgroundTask.enqueue(
        task_type="monthly_759",
        payload={
            "user_id": int(user_id),
            "purchase_id": int(purchase_id),
            "boxes": safe_boxes,
        },
        idempotency_key=key,
    )


def enqueue_prime_150_units(user_id: int, purchase_id: int, units: int = 5, *, trigger: str = "PRIME_750") -> BackgroundTask:
    """
    Enqueue PRIME 150 unit activations N times (e.g., 5 for PRIME 750). Idempotent via idempotency_key.
    """
    key = f"prime_150_units:{purchase_id}:{int(units)}"
    return BackgroundTask.enqueue(
        task_type="prime_150_units",
        payload={
            "user_id": int(user_id),
            "purchase_id": int(purchase_id),
            "units": int(units),
            "trigger": str(trigger),
        },
        idempotency_key=key,
    )
