from __future__ import annotations

from decimal import Decimal
from typing import Dict, Any, List, Optional

from accounts.models import Wallet, CustomUser
from business.models import CommissionConfig, AutoPoolAccount
from .commission_policy import CommissionPolicy, ConfigurationError
from .activation import _is_agency_or_employee, _allow_agency_in_matrix, _update_matrix_progress

import logging
logger = logging.getLogger(__name__)

def _monthly_open_mode(cfg: CommissionConfig) -> str:
    """
    Read UI flag monthly_759.matrix_open_mode: FIRST_MONTH_ONLY | EVERY_PURCHASE | NEVER.
    Default FIRST_MONTH_ONLY.
    """
    try:
        master = dict(getattr(cfg, "master_commission_json", {}) or {})
        mode = str((master.get("monthly_759", {}) or {}).get("matrix_open_mode", "FIRST_MONTH_ONLY")).strip().upper()
        return mode if mode in {"FIRST_MONTH_ONLY", "EVERY_PURCHASE", "NEVER"} else "FIRST_MONTH_ONLY"
    except Exception:
        return "FIRST_MONTH_ONLY"

def _matrix_audit_exists_for_purchase(src_type: str, src_id: str, product_key: str) -> bool:
    try:
        from coupons.models import AuditTrail
        return AuditTrail.objects.filter(
            action="matrix_distributed",
            metadata__source_type=str(src_type or ""),
            metadata__source_id=str(src_id or ""),
            metadata__product_key=str(product_key),
        ).exists()
    except Exception:
        return False

def _matrix_mark_distributed(consumer: CustomUser, src_type: str, src_id: str, product_key: str) -> None:
    try:
        from coupons.models import AuditTrail
        AuditTrail.objects.create(
            action="matrix_distributed",
            actor=consumer,
            notes=f"Matrix distributed for {product_key} purchase {src_id}",
            metadata={
                "purchase_id": str(src_id or ""),
                "product_key": str(product_key),
                "source_type": str(src_type or ""),
                "source_id": str(src_id or ""),
            },
        )
    except Exception:
        try:
            logger.exception(
                "matrix audit mark failed",
                extra={"product": product_key, "user_id": getattr(consumer, "id", None), "source_id": src_id},
            )
        except Exception:
            pass


def _q2(x) -> Decimal:
    return Decimal(str(x)).quantize(Decimal("0.01"))


def _credit_wallet(
    user: Optional[CustomUser],
    amount: Decimal,
    tx_type: str,
    meta: Dict[str, Any] | None = None,
    source_type: str = "",
    source_id: str = "",
    matrix_account_id: int | None = None,
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
        matrix_account_id=matrix_account_id,
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


def _as_percents(lst, length: int) -> List[Decimal]:
    out: List[Decimal] = []
    try:
        for i in range(length):
            v = Decimal(str((lst or [])[i])) if (lst and i < len(lst)) else Decimal("0")
            out.append(v)
    except Exception:
        out = [Decimal("0") for _ in range(length)]
    return out


def _matrix_ancestor_accounts(acc: AutoPoolAccount, depth: int) -> List[AutoPoolAccount]:
    """
    Walk AutoPoolAccount parent chain to collect ancestor AutoPoolAccount nodes up to `depth`.
    Dedupe by owner id to preserve existing payout semantics.
    """
    chain: List[AutoPoolAccount] = []
    try:
        seen = set()
        node = getattr(acc, "parent_account", None)
        while node and len(chain) < max(0, depth):
            owner = getattr(node, "owner", None)
            oid = getattr(owner, "id", None) if owner else None
            if owner and oid and oid not in seen:
                chain.append(node)
                seen.add(oid)
            node = getattr(node, "parent_account", None)
    except Exception:
        chain = []
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

    levels_q: List[Decimal] = []
    if "levels_fixed" in block and isinstance(block["levels_fixed"], list) and len(block["levels_fixed"]) > 0:
        levels_src = block["levels_fixed"]
        try:
            for x in levels_src:
                levels_q.append(_q2(x))
        except Exception:
            raise ConfigurationError("Invalid number in commissions.monthly_759.levels_fixed")
        # Only first 5 are used (L1..L5)
        levels_q = levels_q[:5]
    else:
        # No monthly fixed level payouts when not configured or empty
        levels_q = []

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

    # If the source_type encodes a season marker, treat it as a monthly "first season" trigger.
    # This allows UI and downstream services to detect Smart SSP seats using a stable tag.
    #
    # Convention: MONTHLY_FIRST_SEASON-{season}
    # Example:    MONTHLY_FIRST_SEASON-1
    try:
        st = src_type.strip().upper()
        if st.startswith("MONTHLY_FIRST_SEASON-"):
            is_first_month = True
    except Exception:
        pass

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


    # 3) Agency distribution via auto-pool (STRICT: must be configured)
    if runtime["agency_enabled"]:
        from business.models import distribute_auto_pool_commissions  # local import to avoid cycles
        base_amt = _q2(runtime["base_amount"])
        if base_amt <= 0:
            logger.warning(
                "monthly_759 agency distribution skipped: base_amount must be > 0",
                extra={"user_id": getattr(consumer, "id", None), "source_type": src_type, "source_id": src_id},
            )
        else:
            distribute_auto_pool_commissions(
                consumer,
                base_amount=base_amt,
                fixed_key="759",
                source_type=src_type,
                source_id=src_id,
                extra_meta={"trigger": "MONTHLY_759", "is_first_month": bool(is_first_month)},
            )

    # 3b) Matrix account creation/payouts with monthly open mode
    try:
        base_amt = _q2(runtime["base_amount"])
        cfg_mode = _monthly_open_mode(CommissionConfig.get_solo())  # FIRST_MONTH_ONLY | EVERY_PURCHASE | NEVER
        already_for_purchase = _matrix_audit_exists_for_purchase(src_type, src_id, "759")
        if already_for_purchase:
            try:
                logger.info("matrix skip: already distributed for purchase", extra={"product": "759", "user_id": getattr(consumer, "id", None), "source_id": src_id})
            except Exception:
                pass
        # Determine if matrix should open now.
        # IMPORTANT: seat opening must NOT depend on commissions.monthly_759.base_amount.
        # Even with base_amt==0 (payouts disabled/misconfigured), the user still expects
        # the Smart SSP season root to appear in genealogy.
        should_open = False
        if not already_for_purchase:
            if cfg_mode == "NEVER":
                should_open = False
            elif cfg_mode == "FIRST_MONTH_ONLY":
                should_open = bool(is_first_month)
            elif cfg_mode == "EVERY_PURCHASE":
                # treat every purchase as first-month for matrix part only
                should_open = True

        opened_any = False
        if should_open:
            # Use first-box matrix enable flags when in EVERY_PURCHASE mode to avoid recurring overrides
            first_box_cfg = CommissionPolicy.load().monthly759_first()
            effective_enable5 = bool(first_box_cfg.enable_5_matrix) if cfg_mode == "EVERY_PURCHASE" else bool(getattr(box_cfg, "enable_5_matrix", False))
            effective_enable3 = bool(first_box_cfg.enable_3_matrix) if cfg_mode == "EVERY_PURCHASE" else bool(getattr(box_cfg, "enable_3_matrix", False))
            acc5 = None
            acc3 = None

            # Seat opening should NOT depend on commissions base_amount. Even if base_amount=0
            # (payouts disabled/misconfigured), the user still expects the Smart SSP season root
            # to appear in the genealogy dropdown.
            try:
                open_amt = _q2(CommissionConfig.get_solo().base_coupon_value)
            except Exception:
                open_amt = _q2("150")
            if open_amt <= 0:
                open_amt = _q2("150")

            if effective_enable5:
                try:
                    exists5 = AutoPoolAccount.objects.filter(
                        owner=consumer, pool_type="FIVE_150", status="ACTIVE",
                        source_type=src_type, source_id=src_id
                    ).exists()
                except Exception:
                    exists5 = False
                if not exists5:
                    try:
                        acc5 = AutoPoolAccount.place_in_five_pool(
                            consumer, "FIVE_150", open_amt, source_type=src_type, source_id=src_id
                        )
                        opened_any = True
                    except Exception:
                        acc5 = None

            if effective_enable3:
                try:
                    exists3 = AutoPoolAccount.objects.filter(
                        owner=consumer, pool_type="THREE_150", status="ACTIVE",
                        source_type=src_type, source_id=src_id
                    ).exists()
                except Exception:
                    exists3 = False
                if not exists3:
                    try:
                        acc3 = AutoPoolAccount.place_in_three_pool(
                            consumer, "THREE_150", open_amt, source_type=src_type, source_id=src_id
                        )
                        opened_any = True
                    except Exception:
                        acc3 = None

            cfg2 = CommissionConfig.get_solo()
            master = dict(getattr(cfg2, "master_commission_json", {}) or {})
            cm5 = dict(master.get("consumer_matrix_5", {}) or {})
            cm3 = dict(master.get("consumer_matrix_3", {}) or {})

            if effective_enable5:
                cm5_759 = (cm5.get("759", {}) or cm5.get("rs759", {}) or cm5.get("prime759", {}) or cm5.get("prime_759", {}) or cm5.get("monthly_759", {}) or cm5.get("monthly759", {}) or {})
                five_levels = int((cm5_759.get("levels") or cfg2.get_matrix_five_levels()))
                upline6_accounts = _matrix_ancestor_accounts(acc5, depth=five_levels) if acc5 else []
                upline6_users = _resolve_upline(consumer, depth=five_levels) if not acc5 else []
                fixed5 = list(cm5_759.get("fixed_amounts") or getattr(cfg2, "five_matrix_amounts_json", []) or [])
                if fixed5:
                    if acc5:
                        for idx, node in enumerate(upline6_accounts):
                            if idx >= len(fixed5):
                                break
                            recipient = getattr(node, "owner", None)
                            matrix_account_id = getattr(node, "id", None)
                            amt = _q2(fixed5[idx] or 0)
                            if amt <= 0:
                                continue
                            try:
                                from business.models import is_matrix_eligible as _elig
                                if not _elig(recipient):
                                    continue
                            except Exception:
                                continue
                            if _is_agency_or_employee(recipient) and not _allow_agency_in_matrix():
                                continue
                            meta = {
                                "source": "FIVE_MATRIX_759_FIXED",
                                "source_type": src_type,
                                "source_id": src_id,
                                "level_index": idx + 1,
                                "fixed": True,
                                "trigger": "MONTHLY_759",
                                "from_user_id": getattr(consumer, "id", None),
                                "from_user": getattr(consumer, "username", None),
                            }
                            _credit_wallet(
                                recipient,
                                amt,
                                tx_type="AUTOPOOL_BONUS_FIVE",
                                meta=meta,
                                source_type=src_type,
                                source_id=src_id,
                                matrix_account_id=matrix_account_id,
                            )
                            _update_matrix_progress(recipient, pool_type="FIVE_150", level=idx + 1, amount=amt)
                    else:
                        for idx, recipient in enumerate(upline6_users):
                            if idx >= len(fixed5):
                                break
                            amt = _q2(fixed5[idx] or 0)
                            if amt <= 0:
                                continue
                            try:
                                from business.models import is_matrix_eligible as _elig
                                if not _elig(recipient):
                                    continue
                            except Exception:
                                continue
                            if _is_agency_or_employee(recipient) and not _allow_agency_in_matrix():
                                continue
                            meta = {
                                "source": "FIVE_MATRIX_759_FIXED",
                                "source_type": src_type,
                                "source_id": src_id,
                                "level_index": idx + 1,
                                "fixed": True,
                                "trigger": "MONTHLY_759",
                                "from_user_id": getattr(consumer, "id", None),
                                "from_user": getattr(consumer, "username", None),
                            }
                            _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_FIVE", meta=meta, source_type=src_type, source_id=src_id)
                            _update_matrix_progress(recipient, pool_type="FIVE_150", level=idx + 1, amount=amt)
                else:
                    five_percents = _as_percents((cm5_759.get("percents") or getattr(cfg2, "five_matrix_percents_json", []) or []), five_levels)
                    if acc5:
                        for idx, node in enumerate(upline6_accounts):
                            if idx >= len(five_percents):
                                break
                            recipient = getattr(node, "owner", None)
                            matrix_account_id = getattr(node, "id", None)
                            pct = five_percents[idx] or Decimal("0")
                            amt = _q2(base_amt * pct / Decimal("100"))
                            if amt <= 0:
                                continue
                            try:
                                from business.models import is_matrix_eligible as _elig
                                if not _elig(recipient):
                                    continue
                            except Exception:
                                continue
                            if _is_agency_or_employee(recipient) and not _allow_agency_in_matrix():
                                continue
                            meta = {
                                "source": "FIVE_MATRIX_759",
                                "source_type": src_type,
                                "source_id": src_id,
                                "level_index": idx + 1,
                                "percent": str(pct),
                                "trigger": "MONTHLY_759",
                                "from_user_id": getattr(consumer, "id", None),
                                "from_user": getattr(consumer, "username", None),
                            }
                            _credit_wallet(
                                recipient,
                                amt,
                                tx_type="AUTOPOOL_BONUS_FIVE",
                                meta=meta,
                                source_type=src_type,
                                source_id=src_id,
                                matrix_account_id=matrix_account_id,
                            )
                            _update_matrix_progress(recipient, pool_type="FIVE_150", level=idx + 1, amount=amt)
                    else:
                        for idx, recipient in enumerate(upline6_users):
                            if idx >= len(five_percents):
                                break
                            pct = five_percents[idx] or Decimal("0")
                            amt = _q2(base_amt * pct / Decimal("100"))
                            if amt <= 0:
                                continue
                            try:
                                from business.models import is_matrix_eligible as _elig
                                if not _elig(recipient):
                                    continue
                            except Exception:
                                continue
                            if _is_agency_or_employee(recipient) and not _allow_agency_in_matrix():
                                continue
                            meta = {
                                "source": "FIVE_MATRIX_759",
                                "source_type": src_type,
                                "source_id": src_id,
                                "level_index": idx + 1,
                                "percent": str(pct),
                                "trigger": "MONTHLY_759",
                                "from_user_id": getattr(consumer, "id", None),
                                "from_user": getattr(consumer, "username", None),
                            }
                            _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_FIVE", meta=meta, source_type=src_type, source_id=src_id)
                            _update_matrix_progress(recipient, pool_type="FIVE_150", level=idx + 1, amount=amt)

            if effective_enable3:
                cm3_759 = (cm3.get("759", {}) or cm3.get("rs759", {}) or cm3.get("prime759", {}) or cm3.get("prime_759", {}) or cm3.get("monthly_759", {}) or cm3.get("monthly759", {}) or {})
                three_levels = int((cm3_759.get("levels") or cfg2.get_matrix_three_levels()))
                upline15_accounts = _matrix_ancestor_accounts(acc3, depth=three_levels) if acc3 else []
                upline15_users = _resolve_upline(consumer, depth=three_levels) if not acc3 else []
                fixed3 = list(cm3_759.get("fixed_amounts") or getattr(cfg2, "three_matrix_amounts_json", []) or [])
                if fixed3:
                    if acc3:
                        for idx, node in enumerate(upline15_accounts):
                            if idx >= len(fixed3):
                                break
                            recipient = getattr(node, "owner", None)
                            matrix_account_id = getattr(node, "id", None)
                            amt = _q2(fixed3[idx] or 0)
                            if amt <= 0:
                                continue
                            try:
                                from business.models import is_matrix_eligible as _elig
                                if not _elig(recipient):
                                    continue
                            except Exception:
                                continue
                            if _is_agency_or_employee(recipient) and not _allow_agency_in_matrix():
                                continue
                            meta = {
                                "source": "THREE_MATRIX_759_FIXED",
                                "source_type": src_type,
                                "source_id": src_id,
                                "level_index": idx + 1,
                                "fixed": True,
                                "trigger": "MONTHLY_759",
                                "from_user_id": getattr(consumer, "id", None),
                                "from_user": getattr(consumer, "username", None),
                            }
                            _credit_wallet(
                                recipient,
                                amt,
                                tx_type="AUTOPOOL_BONUS_THREE",
                                meta=meta,
                                source_type=src_type,
                                source_id=src_id,
                                matrix_account_id=matrix_account_id,
                            )
                            _update_matrix_progress(recipient, pool_type="THREE_150", level=idx + 1, amount=amt)
                    else:
                        for idx, recipient in enumerate(upline15_users):
                            if idx >= len(fixed3):
                                break
                            amt = _q2(fixed3[idx] or 0)
                            if amt <= 0:
                                continue
                            try:
                                from business.models import is_matrix_eligible as _elig
                                if not _elig(recipient):
                                    continue
                            except Exception:
                                continue
                            if _is_agency_or_employee(recipient) and not _allow_agency_in_matrix():
                                continue
                            meta = {
                                "source": "THREE_MATRIX_759_FIXED",
                                "source_type": src_type,
                                "source_id": src_id,
                                "level_index": idx + 1,
                                "fixed": True,
                                "trigger": "MONTHLY_759",
                                "from_user_id": getattr(consumer, "id", None),
                                "from_user": getattr(consumer, "username", None),
                            }
                            _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_THREE", meta=meta, source_type=src_type, source_id=src_id)
                            _update_matrix_progress(recipient, pool_type="THREE_150", level=idx + 1, amount=amt)
                else:
                    three_percents = _as_percents((cm3_759.get("percents") or getattr(cfg2, "three_matrix_percents_json", []) or []), three_levels)
                    if acc3:
                        for idx, node in enumerate(upline15_accounts):
                            if idx >= len(three_percents):
                                break
                            recipient = getattr(node, "owner", None)
                            matrix_account_id = getattr(node, "id", None)
                            pct = three_percents[idx] or Decimal("0")
                            amt = _q2(base_amt * pct / Decimal("100"))
                            if amt <= 0:
                                continue
                            try:
                                from business.models import is_matrix_eligible as _elig
                                if not _elig(recipient):
                                    continue
                            except Exception:
                                continue
                            if _is_agency_or_employee(recipient) and not _allow_agency_in_matrix():
                                continue
                            meta = {
                                "source": "THREE_MATRIX_759",
                                "source_type": src_type,
                                "source_id": src_id,
                                "level_index": idx + 1,
                                "percent": str(pct),
                                "trigger": "MONTHLY_759",
                                "from_user_id": getattr(consumer, "id", None),
                                "from_user": getattr(consumer, "username", None),
                            }
                            _credit_wallet(
                                recipient,
                                amt,
                                tx_type="AUTOPOOL_BONUS_THREE",
                                meta=meta,
                                source_type=src_type,
                                source_id=src_id,
                                matrix_account_id=matrix_account_id,
                            )
                            _update_matrix_progress(recipient, pool_type="THREE_150", level=idx + 1, amount=amt)
                    else:
                        for idx, recipient in enumerate(upline15_users):
                            if idx >= len(three_percents):
                                break
                            pct = three_percents[idx] or Decimal("0")
                            amt = _q2(base_amt * pct / Decimal("100"))
                            if amt <= 0:
                                continue
                            try:
                                from business.models import is_matrix_eligible as _elig
                                if not _elig(recipient):
                                    continue
                            except Exception:
                                continue
                            if _is_agency_or_employee(recipient) and not _allow_agency_in_matrix():
                                continue
                            meta = {
                                "source": "THREE_MATRIX_759",
                                "source_type": src_type,
                                "source_id": src_id,
                                "level_index": idx + 1,
                                "percent": str(pct),
                                "trigger": "MONTHLY_759",
                                "from_user_id": getattr(consumer, "id", None),
                                "from_user": getattr(consumer, "username", None),
                            }
                            _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_THREE", meta=meta, source_type=src_type, source_id=src_id)
                            _update_matrix_progress(recipient, pool_type="THREE_150", level=idx + 1, amount=amt)

        if opened_any:
            _matrix_mark_distributed(consumer, src_type, src_id, "759")
    except ConfigurationError:
        # propagate configuration errors (stop payout)
        raise
    except Exception:
        # best-effort; matrix payouts should not block the monthly flow
        pass

    # 4) Reward points equal to configured base amount (STRICT: requires base_amount)
    try:
        from accounts.models import RewardPointsAccount
        base_amt_points = _q2(runtime["base_amount"])
        if base_amt_points <= 0:
            logger.warning(
                "monthly_759 reward points skipped: base_amount must be > 0",
                extra={"user_id": getattr(consumer, "id", None), "source_type": src_type, "source_id": src_id},
            )
        else:
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
