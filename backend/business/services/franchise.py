from __future__ import annotations

from decimal import Decimal
from typing import Dict, Any, Optional

from django.db import transaction, IntegrityError

from accounts.models import Wallet, CustomUser
from business.models import CommissionConfig, FranchisePayout


def _q2(x) -> Decimal:
    try:
        return Decimal(str(x)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def _first(qs):
    try:
        return qs.first()
    except Exception:
        return None


def _resolve_recipients(trigger_user: CustomUser) -> Dict[str, Optional[CustomUser]]:
    """
    Resolve agency recipients for each franchise layer using AgencyRegionAssignment and user geo.
    """
    from accounts.models import AgencyRegionAssignment  # local import to avoid circular refs
    recipients: Dict[str, Optional[CustomUser]] = {
        "sub_franchise": None,
        "pincode": None,
        "pincode_coord": None,
        "district": None,
        "district_coord": None,
        "state": None,
        "state_coord": None,
    }
    if not trigger_user:
        return recipients

    pin = (getattr(trigger_user, "pincode", "") or "").strip()
    state = getattr(trigger_user, "state", None)

    # Pincode layer (requires exact pincode)
    if pin:
        recipients["sub_franchise"] = _first(
            CustomUser.objects.filter(
                category="agency_sub_franchise",
                region_assignments__level="pincode",
                region_assignments__pincode=pin,
            ).distinct()
        )
        recipients["pincode"] = _first(
            CustomUser.objects.filter(
                category="agency_pincode",
                region_assignments__level="pincode",
                region_assignments__pincode=pin,
            ).distinct()
        )
        recipients["pincode_coord"] = _first(
            CustomUser.objects.filter(
                category="agency_pincode_coordinator",
                region_assignments__level="pincode",
                region_assignments__pincode=pin,
            ).distinct()
        )

    # District/State (best-effort; scoped by State if available)
    if state:
        recipients["district"] = _first(
            CustomUser.objects.filter(
                category="agency_district",
                region_assignments__level="district",
                region_assignments__state=state,
            ).distinct()
        )
        recipients["district_coord"] = _first(
            CustomUser.objects.filter(
                category="agency_district_coordinator",
                region_assignments__level="district",
                region_assignments__state=state,
            ).distinct()
        )
        recipients["state"] = _first(
            CustomUser.objects.filter(
                category="agency_state",
                region_assignments__level="state",
                region_assignments__state=state,
            ).distinct()
        )
        recipients["state_coord"] = _first(
            CustomUser.objects.filter(
                category="agency_state_coordinator",
                region_assignments__level="state",
                region_assignments__state=state,
            ).distinct()
        )

    return recipients


def _credit(user: Optional[CustomUser], amount: Decimal, role_label: str, trigger_user: CustomUser, source_type: str, source_id: str):
    if not user or _q2(amount) <= 0:
        return
    try:
        w = Wallet.get_or_create_for_user(user)
        w.credit(
            _q2(amount),
            tx_type="FRANCHISE_INCOME",
            meta={
                "layer": role_label,
                "trigger_user": getattr(trigger_user, "username", None),
                "trigger_user_id": getattr(trigger_user, "id", None),
            },
            source_type=source_type or "FRANCHISE",
            source_id=str(source_id or getattr(trigger_user, "id", "")),
        )
    except Exception:
        # best-effort, non-blocking
        pass


@transaction.atomic
def distribute_franchise_benefit(trigger_user: CustomUser, trigger: str, source: Dict[str, Any] | None = None) -> bool:
    """
    Distribute fixed franchise benefits totaling ₹25 across geo roles:
      - Sub Franchise: ₹15
      - Pincode: ₹4
      - Pincode Coordinator: ₹2
      - District: ₹1
      - District Coordinator: ₹1
      - State: ₹1
      - State Coordinator: ₹1

    Idempotent per (trigger_user, trigger, source_type, source_id).
    Returns True if processed now, False if already processed before.
    """
    if not trigger_user:
        return False

    src = source or {"type": trigger or "registration", "id": getattr(trigger_user, "id", "")}
    src_type = str(src.get("type") or "")
    src_id = str(src.get("id") or "")

    # Idempotency
    try:
        FranchisePayout.objects.create(
            user_new=trigger_user, trigger=str(trigger or "registration"), source_type=src_type, source_id=src_id
        )
        created = True
    except IntegrityError:
        return False

    cfg = CommissionConfig.get_solo()
    # Defaults as per spec
    defaults = {
        "sub_franchise": 15,
        "pincode": 4,
        "pincode_coord": 2,
        "district": 1,
        "district_coord": 1,
        "state": 1,
        "state_coord": 1,
    }
    fixed = dict(defaults)
    try:
        user_cfg = getattr(cfg, "franchise_fixed_json", {}) or {}
        fixed.update({k: user_cfg.get(k, v) for k, v in defaults.items()})
    except Exception:
        pass

    recipients = _resolve_recipients(trigger_user)
    # Payouts
    role_map = [
        ("Sub Franchise", "sub_franchise"),
        ("Pincode", "pincode"),
        ("Pincode Coord", "pincode_coord"),
        ("District", "district"),
        ("District Coord", "district_coord"),
        ("State", "state"),
        ("State Coord", "state_coord"),
    ]
    for label, key in role_map:
        amt = _q2(fixed.get(key, 0))
        _credit(recipients.get(key), amt, label, trigger_user, source_type="FRANCHISE", source_id=src_id)

    return created
