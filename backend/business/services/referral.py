from __future__ import annotations

from decimal import Decimal
from typing import Dict, Any, List

from django.db import transaction, IntegrityError

from accounts.models import Wallet, CustomUser
from business.models import (
    CommissionConfig,
    AutoPoolAccount,
    ReferralJoinPayout,
    UserMatrixProgress,
)


def _q2(x) -> Decimal:
    try:
        return Decimal(str(x)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def _resolve_upline(user: CustomUser, depth: int) -> List[CustomUser]:
    chain: List[CustomUser] = []
    cur = user
    seen = set()
    for _ in range(max(0, depth)):
        parent = getattr(cur, "registered_by", None)
        if not parent or parent.id in seen:
            break
        chain.append(parent)
        seen.add(parent.id)
        cur = parent
    return chain


def _credit_wallet(user: CustomUser, amount: Decimal, tx_type: str, meta: dict | None = None, source_type: str = "", source_id: str = ""):
    if not user or _q2(amount) <= 0:
        return
    try:
        w = Wallet.get_or_create_for_user(user)
        w.credit(_q2(amount), tx_type=tx_type, meta=meta or {}, source_type=source_type or "", source_id=str(source_id or ""))
    except Exception:
        # best-effort
        pass


def _is_agency_or_employee(u: CustomUser) -> bool:
    """
    Return True if the user is an agency or employee account.
    Agency detection: role == 'agency' or category startswith 'agency'
    Employee detection: role == 'employee' or category == 'employee'
    """
    try:
        role = (getattr(u, "role", "") or "")
        cat = (getattr(u, "category", "") or "")
        return (role in ("agency", "employee")) or (cat == "employee") or str(cat).startswith("agency")
    except Exception:
        return False


def _distribute_three_matrix(user: CustomUser, base_amount: Decimal, source: Dict[str, Any]):
    """
    Distribute 15-level autopool income for THREE_50 using fixed amounts if configured,
    else fall back to percent-based distribution from CommissionConfig.
    """
    cfg = CommissionConfig.get_solo()
    src_type = str(source.get("type") or "")
    src_id = str(source.get("id") or source.get("code") or "")

    # Ensure an autopool account exists for the user (simple placement)
    try:
        AutoPoolAccount.create_three_50_for_user(user, amount=_q2(base_amount or cfg.global_activation_amount or 50))
    except Exception:
        pass

    levels = int(getattr(cfg, "three_matrix_levels", 15) or 15)
    upline = _resolve_upline(user, depth=levels)
    # Prefer fixed-amount override
    fixed: list = getattr(cfg, "three_matrix_amounts_json", []) or []
    if fixed:
        for idx, recipient in enumerate(upline):
            if idx >= len(fixed):
                break
            amt = _q2(fixed[idx] or 0)
            if amt <= 0:
                continue
            # Skip matrix payout for agency/employee recipients
            if _is_agency_or_employee(recipient):
                continue
            meta = {
                "source": "THREE_MATRIX_FIXED",
                "source_type": src_type,
                "source_id": src_id,
                "level_index": idx + 1,
                "pool_type": "THREE_50",
                "fixed": True,
            }
            _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_THREE", meta=meta, source_type=src_type, source_id=src_id)
            _update_matrix_progress(recipient, "THREE_50", level=idx + 1, amount=amt)
        return

    # Percent fallback on base=50
    try:
        percents: list = getattr(cfg, "three_matrix_percents_json", []) or []
    except Exception:
        percents = []
    base_q = _q2(base_amount or cfg.global_activation_amount or 50)
    for idx, recipient in enumerate(upline):
        if idx >= len(percents):
            break
        pct = Decimal(str(percents[idx] or 0))
        amt = _q2(base_q * pct / Decimal("100"))
        if amt <= 0:
            continue
        # Skip matrix payout for agency/employee recipients
        if _is_agency_or_employee(recipient):
            continue
        meta = {
            "source": "THREE_MATRIX_PERCENT",
            "source_type": src_type,
            "source_id": src_id,
            "level_index": idx + 1,
            "pool_type": "THREE_50",
            "percent": str(pct),
        }
        _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_THREE", meta=meta, source_type=src_type, source_id=src_id)
        _update_matrix_progress(recipient, "THREE_50", level=idx + 1, amount=amt)


def _update_matrix_progress(user: CustomUser, pool_type: str, level: int, amount: Decimal):
    try:
        mp, _ = UserMatrixProgress.objects.get_or_create(user=user, pool_type=pool_type)
        mp.total_earned = _q2((mp.total_earned or Decimal("0")) + _q2(amount))
        mp.level_reached = max(int(mp.level_reached or 0), int(level or 0))
        plc = dict(mp.per_level_counts or {})
        ple = dict(mp.per_level_earned or {})
        key = str(level)
        plc[key] = int(plc.get(key, 0)) + 1
        ple[key] = str(_q2(Decimal(str(ple.get(key, "0"))) + _q2(amount)))
        mp.per_level_counts = plc
        mp.per_level_earned = ple
        mp.save(update_fields=["total_earned", "level_reached", "per_level_counts", "per_level_earned", "updated_at"])
    except Exception:
        # non-critical
        pass


def _resolve_upline_matrix(user: CustomUser, depth: int) -> List[CustomUser]:
    """
    Traverse genealogy chain via `parent` up to `depth` levels (L1..depth).
    """
    chain: List[CustomUser] = []
    cur = getattr(user, "parent", None)
    seen = set()
    for _ in range(max(0, depth)):
        if not cur or getattr(cur, "id", None) in seen:
            break
        chain.append(cur)
        seen.add(cur.id)
        cur = getattr(cur, "parent", None)
    return chain


def _first_missing_position(children_qs) -> int | None:
    taken = set(children_qs.values_list("matrix_position", flat=True))
    for pos in range(1, 6):
        if pos not in taken:
            return pos
    return None


def place_user_in_five_matrix(new_user: CustomUser) -> CustomUser | None:
    """
    Spillover BFS placement under the sponsor (registered_by) ensuring max 5 direct children.
    Idempotent: if new_user.parent already set, returns existing parent.
    """
    sponsor = getattr(new_user, "registered_by", None)
    if not sponsor or getattr(new_user, "parent_id", None):
        return getattr(new_user, "parent", None)

    # BFS to find first node with available child slot
    from collections import deque

    q = deque([sponsor])
    while q:
        node = q.popleft()
        children = node.children.order_by("matrix_position", "id")
        if children.count() < 5:
            pos = _first_missing_position(children)
            if pos is None:
                pos = min(children.count() + 1, 5)
            new_user.parent = node
            new_user.matrix_position = pos
            new_user.depth = (getattr(node, "depth", 0) or 0) + 1
            new_user.save(update_fields=["parent", "matrix_position", "depth"])
            return node
        # push to queue for spillover
        for ch in children:
            q.append(ch)
    return None


def _distribute_five_matrix(new_user: CustomUser, source: Dict[str, Any]):
    """
    Distribute fixed 5-matrix level amounts to genealogy upline via `parent` chain.
    Uses CommissionConfig.five_matrix_amounts_json if present, else defaults:
      [15, 2, 2.5, 0.5, 0.05, 0.1]
    """
    if not getattr(new_user, "parent_id", None):
        return
    cfg = CommissionConfig.get_solo()
    try:
        levels = int(getattr(cfg, "five_matrix_levels", 6) or 6)
    except Exception:
        levels = 6
    fixed: list = getattr(cfg, "five_matrix_amounts_json", []) or []
    if not fixed:
        fixed = [15, 2, 2.5, 0.5, 0.05, 0.1]

    src_type = str(source.get("type") or "")
    src_id = str(source.get("id") or "")

    upline = _resolve_upline_matrix(new_user, depth=levels)
    for idx, recipient in enumerate(upline):
        if idx >= len(fixed):
            break
        amt = _q2(fixed[idx] or 0)
        if amt <= 0:
            continue
        # Skip matrix payout for agency/employee recipients
        if _is_agency_or_employee(recipient):
            continue
        meta = {
            "source": "FIVE_MATRIX_FIXED",
            "source_type": src_type,
            "source_id": src_id,
            "level_index": idx + 1,
            "pool_type": "FIVE_150",
            "fixed": True,
        }
        _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_FIVE", meta=meta, source_type=src_type, source_id=src_id)
        _update_matrix_progress(recipient, "FIVE_150", level=idx + 1, amount=amt)


@transaction.atomic
def on_user_join(new_user: CustomUser, source: Dict[str, Any] | None = None) -> bool:
    """
    Trigger referral join benefits:
  - Direct ₹15 to registered_by (DIRECT_REF_BONUS)
      - Levels 1..5 fixed: 2,1,1,0.5,0.5 (LEVEL_BONUS)
      - Optional autopool trigger for THREE_50 with 15-level distribution
    Idempotent via ReferralJoinPayout (unique per new user).
    Returns True if payouts executed (new), False if already processed.
    """
    if not new_user or not getattr(new_user, "id", None):
        return False
    src = source or {"type": "user", "id": getattr(new_user, "id", "")}
    src_type = str(src.get("type") or "user")
    src_id = str(src.get("id") or "")
    # Gate payouts until first activation is stamped
    if not getattr(new_user, "first_purchase_activated_at", None):
        return False

    try:
        ReferralJoinPayout.objects.create(user_new=new_user, source_type=src_type, source_id=src_id)
        created = True
    except IntegrityError:
        return False

    # 5-matrix placement under sponsor with spillover
    try:
        place_user_in_five_matrix(new_user)
    except Exception:
        # best-effort
        pass

    cfg = CommissionConfig.get_solo()
    fixed = getattr(cfg, "referral_join_fixed_json", {}) or {}
    # Defaults if not configured (universal ₹15 unless admin overrides in config)
    direct_amt = _q2(fixed.get("direct", 15))
    arr = [
        _q2(fixed.get("l1", 2)),
        _q2(fixed.get("l2", 1)),
        _q2(fixed.get("l3", 1)),
        _q2(fixed.get("l4", 0.5)),
        _q2(fixed.get("l5", 0.5)),
    ]

    # Direct sponsor bonus
    sponsor = getattr(new_user, "registered_by", None)
    if sponsor and direct_amt > 0:
        _credit_wallet(
            sponsor,
            direct_amt,
            tx_type="DIRECT_REF_BONUS",
            meta={
                "source": "JOIN_REFERRAL",
                "from_user_id": getattr(new_user, "id", None),
                "from_user": getattr(new_user, "username", None),
                "level": 0,
            },
            source_type="JOIN_REFERRAL",
            source_id=str(getattr(new_user, "id", "")),
        )

    # Upline L1..L5
    upline = _resolve_upline(new_user, depth=5)
    for idx, recipient in enumerate(upline):
        if idx >= len(arr):
            break
        amt = _q2(arr[idx])
        if amt <= 0:
            continue
        _credit_wallet(
            recipient,
            amt,
            tx_type="LEVEL_BONUS",
            meta={"source": "JOIN_REFERRAL", "new_user": getattr(new_user, "username", None), "level": idx + 1, "fixed": True},
            source_type="JOIN_REFERRAL",
            source_id=str(getattr(new_user, "id", "")),
        )

    # 5-matrix genealogy benefit distribution (up to configured 6 levels)
    try:
        _distribute_five_matrix(new_user, {"type": "JOIN_REFERRAL", "id": getattr(new_user, "id", "")})
    except Exception:
        pass

    # Optional autopool trigger on direct referral
    if getattr(cfg, "autopool_trigger_on_direct_referral", True):
        try:
            st = (src_type or "").lower()
            # Skip autopool here when join is executed as part of an activation flow to avoid double payouts
            if not (st.startswith("coupon_") or st.startswith("product_")):
                # Use 50 as base for THREE_50
                base50 = _q2(getattr(cfg, "global_activation_amount", 50) or 50)
                _distribute_three_matrix(new_user, base50, {"type": "JOIN_REFERRAL", "id": getattr(new_user, "id", "")})
                # Enable flags on new user
                try:
                    new_user.autopool_enabled = True
                    new_user.rewards_enabled = True
                    new_user.save(update_fields=["autopool_enabled", "rewards_enabled"])
                except Exception:
                    pass
        except Exception:
            pass

    return created
