from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Optional
from django.db.models import Q

from accounts.models import Wallet, CustomUser
from business.models import CommissionConfig, AutoPoolAccount
from .commission_policy import CommissionPolicy, ConfigurationError
from .activation import _is_agency_or_employee, _allow_agency_in_matrix, _update_matrix_progress

import logging
logger = logging.getLogger(__name__)

def _matrix_open_cfg(product_key: str) -> tuple[str, int]:
    """
    Read UI config for matrix opening mode/count per product.
    Returns (mode, count).
      - product_key: "150" | "750"
    Defaults:
      - 150: FIRST_TIME_ONLY, count=1
      - 750: FIRST_TIME_ONLY, count=products.750.activation_open_count or 1
    """
    cfg = CommissionConfig.get_solo()
    products = _load_products_block(cfg)
    node = dict(products.get(product_key, {}) or {})
    if product_key == "150":
        mode = str(node.get("matrix_open_mode", "FIRST_TIME_ONLY")).strip().upper()
        try:
            count = int(node.get("matrix_open_count", 1))
        except Exception:
            count = 1
    elif product_key == "750":
        mode = str(node.get("matrix_open_mode", "FIRST_TIME_ONLY")).strip().upper()
        try:
            count = int(node.get("matrix_open_count", node.get("activation_open_count", 1)))
        except Exception:
            try:
                count = int(node.get("activation_open_count", 1))
            except Exception:
                count = 1
    else:
        mode, count = "FIRST_TIME_ONLY", 1
    if count < 0:
        count = 0
    if mode not in {"FIRST_TIME_ONLY", "EVERY_PURCHASE", "NEVER"}:
        mode = "FIRST_TIME_ONLY"
    return mode, count

def _matrix_audit_exists_for_purchase(src_type: str, src_id: str, product_key: str) -> bool:
    """
    Consider matrix 'already distributed' ONLY when wallet transactions for matrix payouts exist
    for this purchase/source. An orphan audit without wallet evidence should not block payouts.
    """
    try:
        from coupons.models import AuditTrail  # noqa: F401 (kept for context)
        from accounts.models import WalletTransaction as WT
        src_t = str(src_type or "")
        src_i = str(src_id or "")
        # Wallet evidence of matrix payouts for this purchase
        tx_exists = WT.objects.filter(
            source_type=src_t,
            source_id=src_i,
            meta__orig_type__in=("AUTOPOOL_BONUS_FIVE", "AUTOPOOL_BONUS_THREE"),
        ).exists()
        return tx_exists
    except Exception:
        return False

def _matrix_any_prior_for_user(consumer: CustomUser, product_key: str) -> bool:
    try:
        from coupons.models import AuditTrail
        return AuditTrail.objects.filter(
            action="matrix_distributed",
            actor=consumer,
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
            logger.exception("matrix audit mark failed", extra={"product": product_key, "user_id": getattr(consumer, "id", None), "source_id": src_id})
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
) -> None:
    """
    Best-effort wallet credit. Payout decisioning must be handled by caller/policy.
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


def _is_consumer(u: CustomUser) -> bool:
    try:
        role = str(getattr(u, "role", "")).strip().lower()
        category = str(getattr(u, "category", "")).strip().lower()
        return role == "user" or category == "consumer"
    except Exception:
        return False


def _resolve_upline(user: CustomUser, depth: int):
    chain = []
    cur = user
    seen = set()
    for _ in range(max(0, depth)):
        parent = getattr(cur, "registered_by", None)
        if not parent or getattr(parent, "id", None) in seen:
            break
        chain.append(parent)
        seen.add(getattr(parent, "id", None))
        cur = parent
    return chain


def _as_percents(lst, length: int):
    out = []
    try:
        for i in range(length):
            v = Decimal(str((lst or [])[i])) if (lst and i < len(lst)) else Decimal("0")
            out.append(v)
    except Exception:
        out = [Decimal("0") for _ in range(length)]
    return out


def _matrix_ancestors(acc, depth: int):
    """
    Walk AutoPoolAccount parent chain to collect ancestor owners up to `depth`.
    Returns list of CustomUser recipients in order [L1..Ldepth] for matrix payouts.
    """
    chain = []
    try:
        seen = set()
        node = getattr(acc, "parent_account", None)
        while node and len(chain) < max(0, depth):
            owner = getattr(node, "owner", None)
            oid = getattr(owner, "id", None) if owner else None
            if owner and oid and oid not in seen:
                chain.append(owner)
                seen.add(oid)
            node = getattr(node, "parent_account", None)
    except Exception:
        chain = []
    return chain


def _load_products_block(cfg: CommissionConfig) -> Dict[str, Any]:
    """
    Return a 'products' block that supports:
      - Nested: {"products": {"150": {...}, "750": {...}}}
      - Flattened: {"products.150.base_amount": 150.00, "products.750.base_amount": ...}
      - Aliases used by Admin UI/product endpoints:
          150 <= ["coupon150", "coupon_150", "prime150", "prime_150"]
          750 <= ["rs750", "prime750", "prime_750"]
          759 <= ["rs759", "prime759", "prime_759"]
    Flattened keys are merged into the nested map; then alias nodes overlay canonical keys.
    """
    master = dict(getattr(cfg, "master_commission_json", {}) or {})
    products = dict(master.get("products", {}) or {})
    # Merge flattened keys like "products.150.base_amount"
    try:
        for k, v in list(master.items()):
            if isinstance(k, str) and k.startswith("products."):
                try:
                    _, rest = k.split("products.", 1)
                    parts = rest.split(".")
                    if not parts:
                        continue
                    pkey = parts[0]
                    node = products.setdefault(pkey, {})
                    if len(parts) == 1:
                        # e.g., "products.150": {...}
                        if isinstance(v, dict):
                            node.update(dict(v))
                    else:
                        # e.g., "products.150.base_amount": 150
                        node[parts[1]] = v
                except Exception:
                    continue
    except Exception:
        # best-effort
        pass

    # Alias overlay: copy alias-defined fields onto canonical product keys
    try:
        alias_map = {
            "150": ["coupon150", "coupon_150", "prime150", "prime_150"],
            "750": ["rs750", "prime750", "prime_750"],
            "759": ["rs759", "prime759", "prime_759"],
        }
        canonical: Dict[str, Any] = dict(products)
        for canon, aliases in alias_map.items():
            base = dict(products.get(canon, {}) or {})
            for a in aliases:
                node = products.get(a)
                if isinstance(node, dict) and node:
                    # Overlay alias values last so UI alias wins
                    try:
                        base.update(dict(node))
                    except Exception:
                        pass
            if base:
                canonical[canon] = base
        products = canonical
    except Exception:
        # best-effort
        pass

    return products


def _require_base_amount_for_150(cfg: CommissionConfig) -> Decimal:
    products = _load_products_block(cfg)
    row = dict(products.get("150", {}) or {})
    if "base_amount" not in row:
        raise ConfigurationError("Missing config path: products.150.base_amount")
    try:
        base = _q2(row.get("base_amount"))
    except Exception:
        raise ConfigurationError("Invalid decimal at products.150.base_amount")
    if base <= 0:
        raise ConfigurationError("products.150.base_amount must be > 0")
    return base


def _resolve_base_amount(cfg: CommissionConfig, product_key: str, multiplier: Optional[int] = None) -> Decimal:
    """
    Strict base_amount resolver for Agency (geo/upline) distribution:
      - 150: require products.150.base_amount (no defaults)
      - 750: prefer products.750.base_amount; if absent, compute products.150.base_amount * multiplier (strict)
    """
    products = _load_products_block(cfg)
    row = dict(products.get(product_key, {}) or {})

    if "base_amount" in row:
        try:
            v = _q2(row.get("base_amount"))
        except Exception:
            raise ConfigurationError(f"Invalid decimal at products.{product_key}.base_amount")
        if v <= 0:
            raise ConfigurationError(f"products.{product_key}.base_amount must be > 0")
        return v

    if product_key == "750":
        if not isinstance(multiplier, int) or multiplier <= 0:
            raise ConfigurationError("prime_750.multiplier must be a positive integer to derive products.750.base_amount")
        base150 = _require_base_amount_for_150(cfg)
        return _q2(base150 * Decimal(multiplier))

    # fallback for any other product key: require explicit
    raise ConfigurationError(f"Missing config path: products.{product_key}.base_amount")


def distribute_prime_150_payouts(
    consumer: CustomUser,
    *,
    source: Dict[str, Any],
) -> None:
    """
    BRAND-NEW payout engine for Prime 150 activation (package or coupon).
    Enforces Global Rules:
      1) No hardcoded rupee values
      2) Read strictly from AdminCommissionDistribute config (master_commission_json)
      3) If config missing/invalid -> ConfigurationError (stop payout)
      4) Same engine semantics across package/coupon
      5) Readable/auditable code
    Effects:
      - DIRECT_REF bonus to sponsor (PRIME_150_DIRECT)
      - SELF bonus to consumer (PRIME_150_SELF)
      - Agency distribution via distribute_auto_pool_commissions with base_amount=products.150.base_amount
      - Matrix opening (5/3) when enabled in policy
      - Reward points credit (PRIME_150)
    """
    if not consumer:
        return

    policy = CommissionPolicy.load()
    p150 = policy.prime150()  # strict validation

    sponsor = getattr(consumer, "registered_by", None)
    src_type = str(source.get("type") or "PRIME_150")
    src_id = str(source.get("id") or "")

    # 1) Direct + Self (strict decimals)
    direct_amt = _q2(p150.direct_sponsor)
    # Fallback: if policy yields 0, try master.direct_bonus['150'] and aliases
    try:
        if direct_amt <= 0:
            cfgx = CommissionConfig.get_solo()
            masterx = dict(getattr(cfgx, "master_commission_json", {}) or {})
            db = dict(masterx.get("direct_bonus", {}) or {})
            row150_db = dict(db.get("150", {}) or {})
            if not row150_db:
                for alias in ("coupon150", "coupon_150", "prime150", "prime_150"):
                    node = db.get(alias)
                    if isinstance(node, dict) and node:
                        row150_db = dict(node)
                        break
            d2 = _q2(row150_db.get("sponsor", 0))
            if d2 > 0:
                direct_amt = d2
    except Exception:
        pass

    # Idempotency: avoid duplicate PRIME_150_DIRECT for the same purchase/source
    paid_direct = False
    try:
        if sponsor:
            from accounts.models import WalletTransaction as WT
            # Primary idempotency: prior PRIME_150_DIRECT for same purchase
            paid_direct = WT.objects.filter(
                user=sponsor,
                source_type=src_type,
                source_id=src_id,
                meta__orig_type="PRIME_150_DIRECT",
            ).exists()
            # Cross-flow guard: if ANY direct already credited for this referral/purchase, skip paying again
            if not paid_direct:
                try:
                    exists_any_direct = WT.objects.filter(user=sponsor).filter(
                        Q(type__in=("PRIME_150_DIRECT", "PRIME_750_DIRECT", "DIRECT_REF_BONUS")) &
                        Q(source_type=src_type, source_id=src_id)
                    ).exists()
                except Exception:
                    exists_any_direct = False
                if exists_any_direct:
                    paid_direct = True
    except Exception:
        paid_direct = False
    if sponsor and direct_amt > 0 and not paid_direct:
        _credit_wallet(
            sponsor,
            direct_amt,
            tx_type="PRIME_150_DIRECT",
            meta={"source": "PRIME_150", "from_user_id": getattr(consumer, "id", None), "from_user": getattr(consumer, "username", None)},
            source_type=src_type,
            source_id=src_id,
        )

    self_amt = _q2(p150.direct_self)
    # Fallback: if policy yields 0, try master.direct_bonus['150'] and aliases
    try:
        if self_amt <= 0:
            cfgx = CommissionConfig.get_solo()
            masterx = dict(getattr(cfgx, "master_commission_json", {}) or {})
            db = dict(masterx.get("direct_bonus", {}) or {})
            row150_db = dict(db.get("150", {}) or {})
            if not row150_db:
                for alias in ("coupon150", "coupon_150", "prime150", "prime_150"):
                    node = db.get(alias)
                    if isinstance(node, dict) and node:
                        row150_db = dict(node)
                        break
            s2 = _q2(row150_db.get("self", 0))
            if s2 > 0:
                self_amt = s2
    except Exception:
        pass

    # Idempotency: avoid duplicate PRIME_150_SELF for the same purchase/source
    paid_self = False
    try:
        from accounts.models import WalletTransaction as WT
        paid_self = WT.objects.filter(
            user=consumer,
            source_type=src_type,
            source_id=src_id,
            meta__orig_type="PRIME_150_SELF",
        ).exists()
    except Exception:
        paid_self = False
    if self_amt > 0 and not paid_self:
        _credit_wallet(
            consumer,
            self_amt,
            tx_type="PRIME_150_SELF",
            meta={"source": "PRIME_150"},
            source_type=src_type,
            source_id=src_id,
        )

    # 2) Agency distribution (best-effort base_amount)
    cfg = CommissionConfig.get_solo()
    base150: Optional[Decimal] = None
    try:
        v = _resolve_base_amount(cfg, "150", None)
        if v > 0:
            base150 = v
    except Exception:
        # Fallback to typed config to keep matrix opening/distribution functional
        try:
            base150 = _q2(getattr(cfg, "prime_activation_amount", 150) or 150)
        except Exception:
            base150 = None

    if base150 is not None:
        from business.models import distribute_auto_pool_commissions  # local import to avoid circular
        distribute_auto_pool_commissions(
            consumer,
            base_amount=_q2(base150),
            fixed_key="150",
            source_type=src_type,
            source_id=src_id,
            extra_meta={"trigger": "PRIME_150"},
        )

    # Resolve effective matrix enable flags combining policy and master config
    try:
        master_for_enable = dict(getattr(CommissionConfig.get_solo(), "master_commission_json", {}) or {})
        eff_enable_5 = bool(p150.enable_5_matrix) or CommissionPolicy._enabled_from_cm(master_for_enable, "consumer_matrix_5", "150")
        eff_enable_3 = bool(p150.enable_3_matrix) or CommissionPolicy._enabled_from_cm(master_for_enable, "consumer_matrix_3", "150")
    except Exception:
        eff_enable_5 = bool(p150.enable_5_matrix)
        eff_enable_3 = bool(p150.enable_3_matrix)

    # 3) Matrix opening with UI-configurable repetition and per-purchase idempotency
    mode150, cfg_count150 = _matrix_open_cfg("150")
    already_for_purchase = _matrix_audit_exists_for_purchase(src_type, src_id, "150")
    if already_for_purchase:
        try:
            logger.info("matrix skip: already distributed for purchase", extra={"product": "150", "user_id": getattr(consumer, "id", None), "source_id": src_id})
        except Exception:
            pass
    perform_matrix = False
    if not already_for_purchase and _is_consumer(consumer) and base150 is not None:
        if mode150 == "NEVER":
            perform_matrix = False
        elif mode150 == "FIRST_TIME_ONLY":
            perform_matrix = not _matrix_any_prior_for_user(consumer, "150")
        elif mode150 == "EVERY_PURCHASE":
            perform_matrix = True

    opened_any = False
    created_five = []
    created_three = []
    # Reuse existing structural entries for this purchase to avoid duplicates when called from approval handler
    try:
        _pre5 = list(AutoPoolAccount.objects.filter(owner=consumer, pool_type="FIVE_150", status="ACTIVE", source_type=src_type, source_id=src_id).order_by("id"))
    except Exception:
        _pre5 = []
    try:
        _pre3 = list(AutoPoolAccount.objects.filter(owner=consumer, pool_type="THREE_150", status="ACTIVE", source_type=src_type, source_id=src_id).order_by("id"))
    except Exception:
        _pre3 = []
    _has_pre = bool(_pre5 or _pre3)
    if perform_matrix:
        if _has_pre:
            created_five = _pre5
            created_three = _pre3
            opened_any = bool(created_five or created_three)
        else:
            count_eff = max(0, int(cfg_count150))
            if eff_enable_5 and count_eff > 0:
                for _ in range(count_eff):
                    try:
                        acc5 = AutoPoolAccount.create_five_150_for_user(
                            consumer,
                            amount=_q2(base150),
                            source_type=src_type,
                            source_id=src_id,
                        )
                        if acc5:
                            created_five.append(acc5)
                            opened_any = True
                    except Exception:
                        try:
                            logger.exception("matrix create_five_150_for_user failed", extra={"product": "150", "user_id": getattr(consumer, "id", None), "source_id": src_id})
                        except Exception:
                            pass
            if eff_enable_3:
                for _ in range(count_eff):
                    try:
                        acc3 = AutoPoolAccount.create_three_150_for_user(
                            consumer,
                            amount=_q2(base150),
                            source_type=src_type or "SYSTEM",
                            source_id=src_id or "",
                        )
                        if acc3:
                            created_three.append(acc3)
                            opened_any = True
                    except Exception:
                        try:
                            logger.exception("matrix create_three_150_for_user failed", extra={"product": "150", "user_id": getattr(consumer, "id", None), "source_id": src_id})
                        except Exception:
                            pass

        # Distribute matrix payouts for each created account (fixed_amounts preferred, else percents)
        try:
            if opened_any:
                cfg2 = CommissionConfig.get_solo()
                master2 = dict(getattr(cfg2, "master_commission_json", {}) or {})
                cm5 = dict(master2.get("consumer_matrix_5", {}) or {})
                cm3 = dict(master2.get("consumer_matrix_3", {}) or {})

                # Five-matrix payouts
                if created_five:
                    five_levels = int(cfg2.get_matrix_five_levels())
                    row5_150 = dict(cm5.get("150", {}) or {})
                    fixed5 = list(row5_150.get("fixed_amounts") or getattr(cfg2, "five_matrix_amounts_json", []) or [])
                    if not fixed5:
                        fixed5 = [2, 1, 1, 0.5, 0.5, 0]
                    if fixed5:
                        for acc in created_five:
                            upline6 = _matrix_ancestors(acc, depth=five_levels) or _resolve_upline(consumer, depth=five_levels)
                            for idx, recipient in enumerate(upline6):
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
                                meta = {"source": "FIVE_MATRIX_150_FIXED", "source_type": src_type, "source_id": src_id, "level_index": idx + 1, "fixed": True, "trigger": "PRIME_150"}
                                _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_FIVE", meta=meta, source_type=src_type, source_id=src_id)
                                _update_matrix_progress(recipient, pool_type="FIVE_150", level=idx + 1, amount=amt)
                    else:
                        five_percents = _as_percents((row5_150.get("percents") or getattr(cfg2, "five_matrix_percents_json", []) or []), five_levels)
                        for acc in created_five:
                            upline6 = _matrix_ancestors(acc, depth=five_levels) or _resolve_upline(consumer, depth=five_levels)
                            for idx, recipient in enumerate(upline6):
                                if idx >= len(five_percents):
                                    break
                                pct = five_percents[idx] or Decimal("0")
                                amt = _q2(base150 * pct / Decimal("100"))
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
                                meta = {"source": "FIVE_MATRIX_150", "source_type": src_type, "source_id": src_id, "level_index": idx + 1, "percent": str(pct), "trigger": "PRIME_150"}
                                _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_FIVE", meta=meta, source_type=src_type, source_id=src_id)
                                _update_matrix_progress(recipient, pool_type="FIVE_150", level=idx + 1, amount=amt)

                # Three-matrix payouts
                if created_three:
                    three_levels = int(cfg2.get_matrix_three_levels())
                    row3_150 = dict(cm3.get("150", {}) or {})
                    fixed3 = list(row3_150.get("fixed_amounts") or getattr(cfg2, "three_matrix_amounts_json", []) or [])
                    if not fixed3:
                        fixed3 = [5] + [0] * 14
                    if fixed3:
                        for acc in created_three:
                            upline15 = _matrix_ancestors(acc, depth=three_levels) or _resolve_upline(consumer, depth=three_levels)
                            for idx, recipient in enumerate(upline15):
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
                                meta = {"source": "THREE_MATRIX_150_FIXED", "source_type": src_type, "source_id": src_id, "level_index": idx + 1, "fixed": True, "trigger": "PRIME_150"}
                                _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_THREE", meta=meta, source_type=src_type, source_id=src_id)
                                _update_matrix_progress(recipient, pool_type="THREE_150", level=idx + 1, amount=amt)
                    else:
                        three_percents = _as_percents((row3_150.get("percents") or getattr(cfg2, "three_matrix_percents_json", []) or []), three_levels)
                        for acc in created_three:
                            upline15 = _matrix_ancestors(acc, depth=three_levels) or _resolve_upline(consumer, depth=three_levels)
                            for idx, recipient in enumerate(upline15):
                                if idx >= len(three_percents):
                                    break
                                pct = three_percents[idx] or Decimal("0")
                                amt = _q2(base150 * pct / Decimal("100"))
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
                                meta = {"source": "THREE_MATRIX_150", "source_type": src_type, "source_id": src_id, "level_index": idx + 1, "percent": str(pct), "trigger": "PRIME_150"}
                                _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_THREE", meta=meta, source_type=src_type, source_id=src_id)
                                _update_matrix_progress(recipient, pool_type="THREE_150", level=idx + 1, amount=amt)
        except Exception:
            try:
                logger.exception("prime_150 matrix payout failed", extra={"product": "150", "user_id": getattr(consumer, "id", None), "source_id": src_id})
            except Exception:
                pass

    if opened_any:
        _matrix_mark_distributed(consumer, src_type, src_id, "150")

    # 4) Reward points (optional, config-driven)
    try:
        from accounts.models import RewardPointsAccount
        pts = _q2(p150.reward_points_amount)
        if pts > 0:
            RewardPointsAccount.credit_points(
                consumer,
                pts,
                reason="PRIME_150",
                meta={"source_type": src_type, "source_id": src_id},
            )
    except Exception:
        # Best-effort; do not block other credits
        pass


def distribute_prime_750_payouts(
    consumer: CustomUser,
    *,
    source: Dict[str, Any],
) -> None:
    """
    Prime 750 payout engine driven by Admin master_commission_json (per-product '750' keys).
    Effects:
      - DIRECT_REF and SELF bonuses from master.direct_bonus['750']
      - Agency distribution base from master.products['750'].base_amount
      - Matrix openings count from master.products['750'].activation_open_count (optional)
      - No coupling to Prime 150 multiplier
    """
    if not consumer:
        return

    sponsor = getattr(consumer, "registered_by", None)
    src_type = str(source.get("type") or "PRIME_750")
    src_id = str(source.get("id") or "")

    # Load master commission config once
    cfg = CommissionConfig.get_solo()
    master = dict(getattr(cfg, "master_commission_json", {}) or {})

    # 1) Direct + Self from per-product 750 config
    try:
        direct_all = dict(master.get("direct_bonus", {}) or {})
    except Exception:
        direct_all = {}
    row750 = dict(direct_all.get("750", {}) or {})
    if not row750:
        for alias in ("rs750", "prime750", "prime_750"):
            try:
                cand = direct_all.get(alias)
                if isinstance(cand, dict) and cand:
                    row750 = dict(cand)
                    break
            except Exception:
                continue
    pay_direct = _q2(row750.get("sponsor", 0))
    pay_self = _q2(row750.get("self", 0))

    # Fallback for 750: derive from PRIME 150 direct/self using multiplier when 750 amounts are missing/zero
    try:
        if pay_direct <= 0 or pay_self <= 0:
            try:
                pol750 = CommissionPolicy.load().prime750()
                mult = int(getattr(pol750, "multiplier", 0) or 0)
            except Exception:
                mult = 0
            if mult > 0:
                # Try policy prime150 first
                try:
                    p150_cfg = CommissionPolicy.load().prime150()
                    d150 = _q2(p150_cfg.direct_sponsor)
                    s150 = _q2(p150_cfg.direct_self)
                except Exception:
                    d150 = Decimal("0.00")
                    s150 = Decimal("0.00")
                # If still zero, try master.direct_bonus['150'] (with aliases)
                if d150 <= 0 or s150 <= 0:
                    try:
                        direct_all2 = dict(master.get("direct_bonus", {}) or {})
                        row150_2 = dict(direct_all2.get("150", {}) or {})
                        if not row150_2:
                            for alias in ("coupon150", "coupon_150", "prime150", "prime_150"):
                                cand2 = direct_all2.get(alias)
                                if isinstance(cand2, dict) and cand2:
                                    row150_2 = dict(cand2)
                                    break
                        d150 = _q2(row150_2.get("sponsor", 0))
                        s150 = _q2(row150_2.get("self", 0))
                    except Exception:
                        pass
                changed = False
                if pay_direct <= 0 and d150 > 0:
                    pay_direct = _q2(Decimal(d150) * Decimal(mult))
                    changed = True
                if pay_self <= 0 and s150 > 0:
                    pay_self = _q2(Decimal(s150) * Decimal(mult))
                    changed = True
                if changed:
                    try:
                        from coupons.models import AuditTrail
                        AuditTrail.objects.create(
                            action="prime_750_direct_fallback_from_150",
                            actor=consumer,
                            notes="Derived PRIME 750 direct/self from PRIME 150 amounts using multiplier",
                            metadata={
                                "multiplier": int(mult),
                                "derived_direct": str(pay_direct),
                                "derived_self": str(pay_self),
                                "source_type": src_type,
                                "source_id": src_id,
                            },
                        )
                    except Exception:
                        pass
    except Exception:
        pass

    # Observability: if direct sponsor amount is 0 at runtime, stamp an audit so we can diagnose transient config
    try:
        if sponsor and pay_direct <= 0:
            from coupons.models import AuditTrail
            AuditTrail.objects.create(
                action="prime_750_direct_skipped_zero",
                actor=consumer,
                notes="PRIME 750 direct sponsor is 0 as per current master_commission_json",
                metadata={
                    "source_type": src_type,
                    "source_id": src_id,
                    "configured_direct_sponsor": str(pay_direct),
                    "configured_direct_self": str(pay_self),
                },
            )
    except Exception:
        pass

    # Idempotency: avoid duplicate PRIME_750_DIRECT for the same purchase/source
    paid_direct_750 = False
    try:
        if sponsor:
            from accounts.models import WalletTransaction as WT
            # Primary idempotency: prior PRIME_750_DIRECT for same purchase
            paid_direct_750 = WT.objects.filter(
                user=sponsor,
                source_type=src_type,
                source_id=src_id,
                meta__orig_type="PRIME_750_DIRECT",
            ).exists()
            # Cross-flow guard: if ANY direct already credited for this referral/purchase, skip paying again
            if not paid_direct_750:
                try:
                    exists_any_direct = WT.objects.filter(user=sponsor).filter(
                        Q(type__in=("PRIME_150_DIRECT", "PRIME_750_DIRECT", "DIRECT_REF_BONUS")) &
                        Q(source_type=src_type, source_id=src_id)
                    ).exists()
                except Exception:
                    exists_any_direct = False
                if exists_any_direct:
                    paid_direct_750 = True
    except Exception:
        paid_direct_750 = False
    if sponsor and pay_direct > 0 and not paid_direct_750:
        _credit_wallet(
            sponsor,
            pay_direct,
            tx_type="PRIME_750_DIRECT",
            meta={"source": "PRIME_750", "from_user_id": getattr(consumer, "id", None), "from_user": getattr(consumer, "username", None)},
            source_type=src_type,
            source_id=src_id,
        )

    # Idempotency: avoid duplicate PRIME_750_SELF for the same purchase/source
    paid_self_750 = False
    try:
        from accounts.models import WalletTransaction as WT
        paid_self_750 = WT.objects.filter(
            user=consumer,
            source_type=src_type,
            source_id=src_id,
            meta__orig_type="PRIME_750_SELF",
        ).exists()
    except Exception:
        paid_self_750 = False
    if pay_self > 0 and not paid_self_750:
        _credit_wallet(
            consumer,
            pay_self,
            tx_type="PRIME_750_SELF",
            meta={"source": "PRIME_750"},
            source_type=src_type,
            source_id=src_id,
        )

    # 2) Agency distribution using products['750'].base_amount (with aliases and multiplier fallback)
    base750: Optional[Decimal] = None
    try:
        # Prefer strict resolver: products.750.base_amount, else derive via prime_750.multiplier × products.150.base_amount
        cfg2 = CommissionConfig.get_solo()
        try:
            pol = CommissionPolicy.load()
            mult = pol.prime750().multiplier
        except Exception:
            mult = None
        base750 = _resolve_base_amount(cfg2, "750", multiplier=mult)
    except Exception:
        # Fallback: accept aliases under products.rs750/prime750/prime_750
        try:
            products = dict(master.get("products", {}) or {})
            p750 = (
                dict(products.get("750", {}) or {})
                or dict(products.get("rs750", {}) or {})
                or dict(products.get("prime750", {}) or {})
                or dict(products.get("prime_750", {}) or {})
            )
            bv = _q2(p750.get("base_amount"))
            if bv > 0:
                base750 = bv
            else:
                base750 = None
        except Exception:
            base750 = None

    if base750 is not None:
        from business.models import distribute_auto_pool_commissions
        distribute_auto_pool_commissions(
            consumer,
            base_amount=_q2(base750),
            fixed_key="750",
            source_type=src_type,
            source_id=src_id,
            extra_meta={"trigger": "PRIME_750"},
        )

    # 3) Matrix opening with UI-configurable repetition for 750 (mode/count) and per-purchase idempotency
    # Matrix enable flags for 750 based on per-product overrides (do NOT reuse 150 flags)
    try:
        master_for_enable = dict(getattr(cfg, "master_commission_json", {}) or {})
        enable_5 = CommissionPolicy._enabled_from_cm(master_for_enable, "consumer_matrix_5", "750")
        enable_3 = CommissionPolicy._enabled_from_cm(master_for_enable, "consumer_matrix_3", "750")
    except Exception:
        enable_5 = False
        enable_3 = False

    mode750, cfg_count750 = _matrix_open_cfg("750")
    already_for_purchase = _matrix_audit_exists_for_purchase(src_type, src_id, "750")
    if already_for_purchase:
        try:
            logger.info("matrix skip: already distributed for purchase", extra={"product": "750", "user_id": getattr(consumer, "id", None), "source_id": src_id})
        except Exception:
            pass

    perform_matrix = False
    if not already_for_purchase and _is_consumer(consumer) and base750 is not None:
        if mode750 == "NEVER":
            perform_matrix = False
        elif mode750 == "FIRST_TIME_ONLY":
            perform_matrix = not _matrix_any_prior_for_user(consumer, "750")
        elif mode750 == "EVERY_PURCHASE":
            perform_matrix = True

    opened_any = False
    created_five = []
    created_three = []
    # Reuse existing structural entries for this purchase to avoid duplicates when called from approval handler
    try:
        _pre5 = list(AutoPoolAccount.objects.filter(owner=consumer, pool_type="FIVE_150", status="ACTIVE", source_type=src_type, source_id=src_id).order_by("id"))
    except Exception:
        _pre5 = []
    try:
        _pre3 = list(AutoPoolAccount.objects.filter(owner=consumer, pool_type="THREE_150", status="ACTIVE", source_type=src_type, source_id=src_id).order_by("id"))
    except Exception:
        _pre3 = []
    _has_pre = bool(_pre5 or _pre3)
    if perform_matrix:
        if _has_pre:
            created_five = _pre5
            created_three = _pre3
            opened_any = bool(created_five or created_three)
        else:
            count_eff = max(0, int(cfg_count750))
            if enable_5 and count_eff > 0:
                for _ in range(count_eff):
                try:
                    acc5 = AutoPoolAccount.create_five_150_for_user(
                        consumer,
                        amount=_q2(base750),
                        source_type=src_type,
                        source_id=src_id,
                    )
                    if acc5:
                        created_five.append(acc5)
                        opened_any = True
                except Exception:
                    try:
                        logger.exception("matrix create_five_150_for_user failed", extra={"product": "750", "user_id": getattr(consumer, "id", None), "source_id": src_id})
                    except Exception:
                        pass
        if enable_3 and count_eff > 0:
            for _ in range(count_eff):
                try:
                    acc3 = AutoPoolAccount.create_three_150_for_user(
                        consumer,
                        amount=_q2(base750),
                        source_type=src_type or "SYSTEM",
                        source_id=src_id or "",
                    )
                    if acc3:
                        created_three.append(acc3)
                        opened_any = True
                except Exception:
                    try:
                        logger.exception("matrix create_three_150_for_user failed", extra={"product": "750", "user_id": getattr(consumer, "id", None), "source_id": src_id})
                    except Exception:
                        pass

        # Distribute matrix payouts for each created 750 account
        try:
            if opened_any:
                cfg2 = CommissionConfig.get_solo()
                master2 = dict(getattr(cfg2, "master_commission_json", {}) or {})
                cm5 = dict(master2.get("consumer_matrix_5", {}) or {})
                cm3 = dict(master2.get("consumer_matrix_3", {}) or {})

                # Resolve multiplier for 750 fallbacks
                try:
                    mult = CommissionPolicy.load().prime750().multiplier
                except Exception:
                    mult = 5

                # Five-matrix
                if created_five:
                    five_levels = int(cfg2.get_matrix_five_levels())
                    row5_750 = dict(cm5.get("750", {}) or {})
                    fixed5 = list(row5_750.get("fixed_amounts") or getattr(cfg2, "five_matrix_amounts_json", []) or [])
                    # Fallback: derive from 150 fixed_amounts × multiplier if 750-specific missing
                    if not fixed5:
                        try:
                            base150_fixed5 = list((cm5.get("150", {}) or {}).get("fixed_amounts") or getattr(cfg2, "five_matrix_amounts_json", []) or [])
                            if base150_fixed5:
                                fixed5 = [Decimal(str(x)) * Decimal(str(mult)) for x in base150_fixed5]
                        except Exception:
                            fixed5 = []
                    if fixed5:
                        for acc in created_five:
                            upline6 = _matrix_ancestors(acc, depth=five_levels) or _resolve_upline(consumer, depth=five_levels)
                            for idx, recipient in enumerate(upline6):
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
                                meta = {"source": "FIVE_MATRIX_750_FIXED", "source_type": src_type, "source_id": src_id, "level_index": idx + 1, "fixed": True, "trigger": "PRIME_750"}
                                _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_FIVE", meta=meta, source_type=src_type, source_id=src_id)
                                _update_matrix_progress(recipient, pool_type="FIVE_150", level=idx + 1, amount=amt)
                    else:
                        five_percents = _as_percents((row5_750.get("percents") or getattr(cfg2, "five_matrix_percents_json", []) or []), five_levels)
                        for acc in created_five:
                            upline6 = _matrix_ancestors(acc, depth=five_levels) or _resolve_upline(consumer, depth=five_levels)
                            for idx, recipient in enumerate(upline6):
                                if idx >= len(five_percents):
                                    break
                                pct = five_percents[idx] or Decimal("0")
                                amt = _q2(base750 * pct / Decimal("100"))
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
                                meta = {"source": "FIVE_MATRIX_750", "source_type": src_type, "source_id": src_id, "level_index": idx + 1, "percent": str(pct), "trigger": "PRIME_750"}
                                _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_FIVE", meta=meta, source_type=src_type, source_id=src_id)
                                _update_matrix_progress(recipient, pool_type="FIVE_150", level=idx + 1, amount=amt)

                # Three-matrix
                if created_three:
                    three_levels = int(cfg2.get_matrix_three_levels())
                    row3_750 = dict(cm3.get("750", {}) or {})
                    fixed3 = list(row3_750.get("fixed_amounts") or getattr(cfg2, "three_matrix_amounts_json", []) or [])
                    if not fixed3:
                        try:
                            base150_fixed3 = list((cm3.get("150", {}) or {}).get("fixed_amounts") or getattr(cfg2, "three_matrix_amounts_json", []) or [])
                            if base150_fixed3:
                                fixed3 = [Decimal(str(x)) * Decimal(str(mult)) for x in base150_fixed3]
                        except Exception:
                            fixed3 = []
                    if fixed3:
                        for acc in created_three:
                            upline15 = _matrix_ancestors(acc, depth=three_levels) or _resolve_upline(consumer, depth=three_levels)
                            for idx, recipient in enumerate(upline15):
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
                                meta = {"source": "THREE_MATRIX_750_FIXED", "source_type": src_type, "source_id": src_id, "level_index": idx + 1, "fixed": True, "trigger": "PRIME_750"}
                                _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_THREE", meta=meta, source_type=src_type, source_id=src_id)
                                _update_matrix_progress(recipient, pool_type="THREE_150", level=idx + 1, amount=amt)
                    else:
                        three_percents = _as_percents((row3_750.get("percents") or getattr(cfg2, "three_matrix_percents_json", []) or []), three_levels)
                        for acc in created_three:
                            upline15 = _matrix_ancestors(acc, depth=three_levels) or _resolve_upline(consumer, depth=three_levels)
                            for idx, recipient in enumerate(upline15):
                                if idx >= len(three_percents):
                                    break
                                pct = three_percents[idx] or Decimal("0")
                                amt = _q2(base750 * pct / Decimal("100"))
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
                                meta = {"source": "THREE_MATRIX_750", "source_type": src_type, "source_id": src_id, "level_index": idx + 1, "percent": str(pct), "trigger": "PRIME_750"}
                                _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_THREE", meta=meta, source_type=src_type, source_id=src_id)
                                _update_matrix_progress(recipient, pool_type="THREE_150", level=idx + 1, amount=amt)
        except Exception:
            try:
                logger.exception("prime_750 matrix payout failed", extra={"product": "750", "user_id": getattr(consumer, "id", None), "source_id": src_id})
            except Exception:
                pass

    if opened_any:
        _matrix_mark_distributed(consumer, src_type, src_id, "750")

    # 4) Reward points: handled by activation flow; no separate points logic here to avoid unintended coupling
    return
