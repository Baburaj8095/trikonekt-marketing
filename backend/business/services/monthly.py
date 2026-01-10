from __future__ import annotations

from decimal import Decimal
from typing import Dict, Any, List, Optional

from accounts.models import Wallet, CustomUser
from business.models import CommissionConfig
from .commission_policy import CommissionPolicy, ConfigurationError


def _q2(x) -> Decimal:
    return Decimal(str(x)).quantize(Decimal("0.01"))


def _credit_wallet(
    user: Optional[CustomUser],
    amount: Decimal,
    tx_type: str,
    meta: Dict[str, Any] | None = None,
    source_type: str = "",
    source_id: str = "",
):
    """
    Best-effort wallet credit. Business rules about whether to credit and how much
    must be decided by the caller/policy before invoking this helper.
    """
    if not user or _q2(amount) <= 0:
        return
    w = Wallet.get_or_create_for_user(user)
    w.credit(
        _q2(amount),
        tx_type=tx_type,
        meta=meta or {},
        source_type=source_type or "",
        source_id=str(source_id or ""),
    )


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


def _load_monthly_759_runtime_cfg(cfg: CommissionConfig) -> Dict[str, Any]:
    """
    Strict loader for CommissionConfig.master_commission_json['monthly_759'] without defaults.
    Raises ConfigurationError if any required field is missing/invalid.
    Required keys (all absolute; NO DEFAULTS):
      - base_amount: number
      - agency_enabled: bool
      - levels_fixed: list[number] (L1..L5 fixed amounts)
    """
    master = dict(getattr(cfg, "master_commission_json", {}) or {})
    block = master.get("monthly_759", None)
    if not isinstance(block, dict):
        raise ConfigurationError("Missing config path: commissions.monthly_759")

    if "base_amount" not in block:
        raise ConfigurationError("Missing config path: commissions.monthly_759.base_amount")
    try:
        base_amount = _q2(block["base_amount"])
    except Exception:
        raise ConfigurationError("Invalid decimal at commissions.monthly_759.base_amount")

    if "agency_enabled" not in block:
        raise ConfigurationError("Missing config path: commissions.monthly_759.agency_enabled")
    agency_enabled_raw = block["agency_enabled"]
    if isinstance(agency_enabled_raw, bool):
        agency_enabled = agency_enabled_raw
    else:
        s = str(agency_enabled_raw).strip().lower()
        if s in ("1", "true", "yes", "on"):
            agency_enabled = True
        elif s in ("0", "false", "no", "off"):
            agency_enabled = False
        else:
            raise ConfigurationError("Invalid boolean at commissions.monthly_759.agency_enabled")

    if "levels_fixed" not in block or not isinstance(block["levels_fixed"], list) or len(block["levels_fixed"]) == 0:
        raise ConfigurationError("Missing or invalid commissions.monthly_759.levels_fixed (expect non-empty list)")

    levels_src = block["levels_fixed"]
    levels_q: List[Decimal] = []
    try:
        for x in levels_src:
            levels_q.append(_q2(x))
    except Exception:
        raise ConfigurationError("Invalid number in commissions.monthly_759.levels_fixed")

    # Only first 5 are used (L1..L5)
    levels_q = levels_q[:5]

    return {
        "base_amount": base_amount,
        "agency_enabled": agency_enabled,
        "levels_fixed": levels_q,
    }


def distribute_monthly_759_payouts(
    consumer: CustomUser,
    *,
    is_first_month: bool,
    source: Dict[str, Any],
) -> None:
    """
    BRAND-NEW payout engine for Monthly 759 (per-box).
    Global Rules (non-negotiable) enforced:
      1. No hardcoded rupee values — all amounts come from Admin config.
      2. All payouts come from AdminCommissionDistribute-backed config (CommissionConfig.master_commission_json).
      3. If config missing/invalid -> raise ConfigurationError (STOP payout).
      4. Same engine semantics used across packages/coupons (policy-based).
      5. Code is readable and auditable (no magic branching).

    Inputs:
      - consumer: target user
      - is_first_month: whether this is the first month box for this consumer
      - source: { type: str, id: str } idempotency/audit fields

    Effects:
      - Direct sponsor bonus (MONTHLY_759_DIRECT)
      - Optional self bonus if configured at policy level (MONTHLY_759_SELF)
      - L1..L5 fixed amounts (MONTHLY_759_LEVEL)
      - Agency distribution via distribute_auto_pool_commissions using configured base_amount
      - Reward points credited equal to configured base_amount (no defaults)
    """
    if not consumer:
        return

    # Load strict commission policy (throws on missing/invalid)
    policy = CommissionPolicy.load()

    # Select box config from policy (strict, no defaults inside)
    box_cfg = policy.monthly759_first() if is_first_month else policy.monthly759_recurring()

    # Resolve direct sponsor from genealogy
    sponsor = getattr(consumer, "registered_by", None)

    src_type = str(source.get("type") or "MONTHLY_759")
    src_id = str(source.get("id") or "")

    # 1) Direct sponsor and optional self from policy
    direct_amt = _q2(box_cfg.direct_sponsor)
    if sponsor and direct_amt > 0:
        _credit_wallet(
            sponsor,
            direct_amt,
            tx_type="MONTHLY_759_DIRECT",
            meta={"source": "MONTHLY_759", "is_first_month": bool(is_first_month)},
            source_type=src_type,
            source_id=src_id,
        )

    # If admin configured self bonus for monthly in policy via first/recurring boxes (not required).
    # We model this by allowing monthly_759.first_box/recurring_box.direct.self in the future policy.
    # For now, self is derived only if present in policy raw payload to avoid hardcoding.
    # This keeps engine future-proof without adding defaults here.
    try:
        # Not required; safe lookup
        raw = policy.raw_policy()
        fb = (raw.get("commissions", {}).get("monthly_759", {}) or {})
        dnode = (fb.get("first_box", {}) if is_first_month else fb.get("recurring_box", {})).get("direct", {}) or {}
        if "self" in dnode:
            self_amt = _q2(dnode.get("self"))
            if self_amt > 0:
                _credit_wallet(
                    consumer,
                    self_amt,
                    tx_type="MONTHLY_759_SELF",
                    meta={"source": "MONTHLY_759", "is_first_month": bool(is_first_month)},
                    source_type=src_type,
                    source_id=src_id,
                )
    except Exception:
        # ignore optional self if not configured
        pass

    # 2) L1..L5 fixed amounts from master.monthly_759.levels_fixed (strict, no defaults)
    cfg = CommissionConfig.get_solo()
    runtime = _load_monthly_759_runtime_cfg(cfg)
    levels_q: List[Decimal] = runtime["levels_fixed"]

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
            meta={
                "source": "MONTHLY_759",
                "level": idx + 1,
                "is_first_month": bool(is_first_month),
                "fixed": True,
            },
            source_type=src_type,
            source_id=src_id,
        )

    # 3) Agency distribution via auto-pool (STRICT: must be configured)
    if runtime["agency_enabled"]:
        from business.models import distribute_auto_pool_commissions  # local import to avoid cycles
        base_amt = _q2(runtime["base_amount"])
        if base_amt <= 0:
            raise ConfigurationError("commissions.monthly_759.base_amount must be > 0 for agency distribution")
        distribute_auto_pool_commissions(
            consumer,
            base_amount=base_amt,
            fixed_key="759",
            source_type=src_type,
            source_id=src_id,
            extra_meta={"trigger": "MONTHLY_759", "is_first_month": bool(is_first_month)},
        )

    # 4) Reward points equal to configured base amount (STRICT: requires base_amount)
    try:
        from accounts.models import RewardPointsAccount
        base_amt_points = _q2(runtime["base_amount"])
        if base_amt_points <= 0:
            raise ConfigurationError("commissions.monthly_759.base_amount must be > 0 for reward points")
        RewardPointsAccount.credit_points(
            consumer,
            base_amt_points,
            reason="MONTHLY_759",
            meta={"source_type": src_type, "source_id": src_id, "is_first_month": bool(is_first_month)},
        )
    except ConfigurationError:
        # propagate configuration errors (stop payout)
        raise
    except Exception:
        # non-config operational errors are best-effort
        pass
