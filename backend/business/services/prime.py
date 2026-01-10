from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Optional

from accounts.models import Wallet, CustomUser
from business.models import CommissionConfig, AutoPoolAccount
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


def _load_products_block(cfg: CommissionConfig) -> Dict[str, Any]:
    """
    Return a 'products' block that supports both nested and flattened admin JSON:
      - Nested: {"products": {"150": {"base_amount": 150.00}, "750": {...}}}
      - Flattened: {"products.150.base_amount": 150.00, "products.750.base_amount": ...}
    Flattened keys are merged into the nested map for compatibility.
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
    if sponsor and direct_amt > 0:
        _credit_wallet(
            sponsor,
            direct_amt,
            tx_type="PRIME_150_DIRECT",
            meta={"source": "PRIME_150"},
            source_type=src_type,
            source_id=src_id,
        )

    self_amt = _q2(p150.direct_self)
    if self_amt > 0:
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

    # 3) Matrix opening (config-driven; no rupee defaults)
    # Open N accounts per matrix equal to coupon_activation_count
    count = int(p150.coupon_activation_count)
    if count < 0:
        raise ConfigurationError("commissions.prime_150.coupons.activation_count must be >= 0")
    if count > 0 and base150 is not None:
        # 5-matrix
        if bool(p150.enable_5_matrix):
            for _ in range(count):
                try:
                    AutoPoolAccount.create_five_150_for_user(
                        consumer,
                        amount=_q2(base150),
                        source_type=src_type,
                        source_id=src_id,
                    )
                except Exception:
                    # best-effort placement; do not stop payout credits
                    pass
        # 3-matrix (150)
        if bool(p150.enable_3_matrix):
            for _ in range(count):
                try:
                    AutoPoolAccount.create_three_150_for_user(
                        consumer,
                        amount=_q2(base150),
                    )
                except Exception:
                    pass

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
    BRAND-NEW payout engine for Prime 750 activation (package or coupon).
    750 is policy-driven as a strict multiplier over Prime 150 (no independent hidden defaults).
    Effects:
      - DIRECT_REF and SELF bonuses scaled by multiplier
      - Agency distribution with base_amount = products.750.base_amount OR (products.150.base_amount * multiplier)
      - Matrix openings (count = prime_150.coupon_activation_count * multiplier)
      - Reward points scaled by multiplier
    """
    if not consumer:
        return

    policy = CommissionPolicy.load()
    p150 = policy.prime150()     # source values
    p750 = policy.prime750()     # validates base_package and multiplier

    sponsor = getattr(consumer, "registered_by", None)
    src_type = str(source.get("type") or "PRIME_750")
    src_id = str(source.get("id") or "")

    mul = int(p750.multiplier)
    if mul <= 0:
        raise ConfigurationError("prime_750.multiplier must be a positive integer")

    # 1) Direct + Self (scaled from 150, but allow product-750 override from admin config)
    default_direct = _q2(p150.direct_sponsor) * mul
    default_self = _q2(p150.direct_self) * mul
    override_direct = None
    override_self = None
    try:
        cfg2 = CommissionConfig.get_solo()
        master = dict(getattr(cfg2, "master_commission_json", {}) or {})
        row750 = dict(master.get("direct_bonus", {}).get("750", {}) or {})
        if "sponsor" in row750:
            override_direct = _q2(row750.get("sponsor"))
        if "self" in row750:
            override_self = _q2(row750.get("self"))
    except Exception:
        # ignore override issues; fall back to defaults
        pass

    pay_direct = override_direct if override_direct is not None else default_direct
    pay_self = override_self if override_self is not None else default_self

    if sponsor and pay_direct > 0:
        _credit_wallet(
            sponsor,
            pay_direct,
            tx_type="PRIME_750_DIRECT",
            meta={"source": "PRIME_750", "multiplier": mul},
            source_type=src_type,
            source_id=src_id,
        )

    if pay_self > 0:
        _credit_wallet(
            consumer,
            pay_self,
            tx_type="PRIME_750_SELF",
            meta={"source": "PRIME_750", "multiplier": mul},
            source_type=src_type,
            source_id=src_id,
        )

    # 2) Agency distribution (best-effort base)
    cfg = CommissionConfig.get_solo()
    base750: Optional[Decimal] = None
    try:
        v = _resolve_base_amount(cfg, "750", multiplier=mul)
        if v > 0:
            base750 = v
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
            extra_meta={"trigger": "PRIME_750", "multiplier": mul},
        )

    # 3) Matrix opening scaled by multiplier
    count = int(p150.coupon_activation_count) * mul
    if count < 0:
        raise ConfigurationError("commissions.prime_150.coupons.activation_count must be >= 0")
    if count > 0 and base750 is not None:
        if bool(p150.enable_5_matrix):
            for _ in range(count):
                try:
                    AutoPoolAccount.create_five_150_for_user(
                        consumer,
                        amount=_q2(base750),  # store scaled entry amount for traceability
                        source_type=src_type,
                        source_id=src_id,
                    )
                except Exception:
                    pass
        if bool(p150.enable_3_matrix):
            for _ in range(count):
                try:
                    AutoPoolAccount.create_three_150_for_user(
                        consumer,
                        amount=_q2(base750),
                    )
                except Exception:
                    pass

    # 4) Reward points scaled by multiplier (optional)
    try:
        from accounts.models import RewardPointsAccount
        pts = _q2(p150.reward_points_amount) * mul
        if pts > 0:
            RewardPointsAccount.credit_points(
                consumer,
                pts,
                reason="PRIME_750",
                meta={"source_type": src_type, "source_id": src_id, "multiplier": mul},
            )
    except Exception:
        pass
