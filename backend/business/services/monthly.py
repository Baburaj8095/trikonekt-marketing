from __future__ import annotations

from decimal import Decimal
from typing import Dict, Any, List, Optional

from accounts.models import Wallet, CustomUser
from business.models import CommissionConfig


def _q2(x) -> Decimal:
    try:
        return Decimal(str(x)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def _credit_wallet(user: Optional[CustomUser], amount: Decimal, tx_type: str, meta: Dict[str, Any] | None = None, source_type: str = "", source_id: str = ""):
    if not user or _q2(amount) <= 0:
        return
    try:
        w = Wallet.get_or_create_for_user(user)
        w.credit(_q2(amount), tx_type=tx_type, meta=meta or {}, source_type=source_type or "", source_id=str(source_id or ""))
    except Exception:
        # best-effort
        pass


def _resolve_upline(user: CustomUser, depth: int) -> List[CustomUser]:
    """
    registered_by chain: returns [sponsor (L1), L2, ..., up to depth]
    """
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


def distribute_monthly_759_payouts(
    consumer: CustomUser,
    *,
    is_first_month: bool,
    source: Dict[str, Any],
) -> None:
    """
    Distribute commissions for MONTHLY 759 package on a per-box basis.
    Defaults (admin-overridable via CommissionConfig.master_commission_json["monthly_759"]):
      - direct_first_month: 250
      - direct_monthly: 50 (applied on months after the first)
      - levels_fixed: [50, 10, 5, 5, 10]  -> L1..L5 every month
      - agency_enabled: True (triggers franchise fixed ₹25 distribution)

    Credits:
      - MONTHLY_759_DIRECT (to sponsor)
      - MONTHLY_759_LEVEL  (to L1..L5)
      - Agency split handled by business.services.franchise.distribute_franchise_benefit()
    """
    if not consumer:
        return

    cfg = CommissionConfig.get_solo()
    master = dict(getattr(cfg, "master_commission_json", {}) or {})
    m759 = dict(master.get("monthly_759", {}) or {})

    direct_first = _q2(m759.get("direct_first_month", 250))
    direct_monthly = _q2(m759.get("direct_monthly", 50))
    levels = m759.get("levels_fixed") or [50, 10, 5, 5, 10]
    levels_q = [_q2(x) for x in levels][:5]
    agency_enabled = bool(m759.get("agency_enabled", True))

    src_type = str(source.get("type") or "MONTHLY_759")
    src_id = str(source.get("id") or "")

    # Direct to sponsor
    sponsor = getattr(consumer, "registered_by", None)
    direct_amt = direct_first if is_first_month else direct_monthly
    if sponsor and direct_amt > 0:
        _credit_wallet(
            sponsor,
            direct_amt,
            tx_type="MONTHLY_759_DIRECT",
            meta={"source": "MONTHLY_759", "is_first_month": bool(is_first_month)},
            source_type=src_type,
            source_id=src_id,
        )

    # Level fixed (L1..L5) every month
    upline = _resolve_upline(consumer, depth=5)
    for idx, recipient in enumerate(upline):
        if idx >= len(levels_q):
            break
        amt = _q2(levels_q[idx])
        if amt <= 0:
            continue
        _credit_wallet(
            recipient,
            amt,
            tx_type="MONTHLY_759_LEVEL",
            meta={"source": "MONTHLY_759", "level": idx + 1, "is_first_month": bool(is_first_month), "fixed": True},
            source_type=src_type,
            source_id=src_id,
        )

    # Agency distribution (₹25 default via franchise service). Best-effort.
    if agency_enabled:
        try:
            from business.services.franchise import distribute_franchise_benefit
            distribute_franchise_benefit(consumer, trigger="purchase", source={"type": src_type, "id": src_id})
        except Exception:
            pass
