from __future__ import annotations

from decimal import Decimal, ROUND_DOWN
from typing import Iterable, Optional, Dict, Any

from django.db import transaction, IntegrityError
from django.utils import timezone
import time
import logging
logger = logging.getLogger(__name__)

from accounts.models import Wallet, CustomUser
from business.models import (
    CommissionConfig,
    AutoPoolAccount,
    SubscriptionActivation,
)


def _resolve_upline(user: CustomUser, depth: int) -> list[CustomUser]:
    chain: list[CustomUser] = []
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


def _as_percents(lst: Any, length: int) -> list[Decimal]:
    out: list[Decimal] = []
    try:
        for i in range(length):
            v = Decimal(str((lst or [])[i])) if (lst and i < len(lst)) else Decimal("0")
            out.append(v)
    except Exception:
        out = [Decimal("0") for _ in range(length)]
    return out


def _q2(val: Decimal | int | float | str) -> Decimal:
    try:
        return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
    except Exception:
        return Decimal("0.00")


def _credit_wallet(user: CustomUser, amount: Decimal, tx_type: str, meta: Optional[dict] = None, source_type: str = "", source_id: str = ""):
    if not user or _q2(amount) <= 0:
        return
    try:
        w = Wallet.get_or_create_for_user(user)
        w.credit(_q2(amount), tx_type=tx_type, meta=meta or {}, source_type=source_type or "", source_id=source_id or "")
    except Exception:
        # best-effort
        pass


def _is_agency_or_employee(u: CustomUser) -> bool:
    """
    True if the user is an agency or employee account.
    Agency detection: role == 'agency' or category startswith 'agency'
    Employee detection: role == 'employee' or category == 'employee'
    """
    try:
        role = (getattr(u, "role", "") or "")
        cat = (getattr(u, "category", "") or "")
        return (role in ("agency", "employee")) or (cat == "employee") or str(cat).startswith("agency")
    except Exception:
        return False


def _allow_agency_in_matrix() -> bool:
    """
    Feature toggle from master_commission_json.general.allow_agency_in_matrix.
    When True, do not skip matrix payouts to agency/employee recipients.
    Default behavior when not configured: ALLOW payouts (True).
    """
    try:
        cfg = CommissionConfig.get_solo()
        master = dict(getattr(cfg, "master_commission_json", {}) or {})
        general = dict(master.get("general", {}) or {})
        if "allow_agency_in_matrix" in general:
            return bool(general.get("allow_agency_in_matrix"))
        # If not explicitly set, allow agencies/employees to receive matrix payouts
        return True
    except Exception:
        return True


def _update_matrix_progress(user: CustomUser, pool_type: str, level: int, amount: Decimal):
    """
    Best-effort rollup for matrix progress and totals.
    """
    try:
        from business.models import UserMatrixProgress  # local import to avoid cycles
        mp, _ = UserMatrixProgress.objects.get_or_create(user=user, pool_type=pool_type)
        amt_q = _q2(amount)
        mp.total_earned = _q2((mp.total_earned or Decimal("0.00")) + amt_q)
        try:
            lvl = int(level or 0)
        except Exception:
            lvl = 0
        mp.level_reached = max(int(mp.level_reached or 0), lvl)
        plc = dict(mp.per_level_counts or {})
        ple = dict(mp.per_level_earned or {})
        key = str(lvl)
        plc[key] = int(plc.get(key, 0) or 0) + 1
        prev = Decimal(str(ple.get(key, "0") or "0"))
        ple[key] = str(_q2(prev + amt_q))
        mp.per_level_counts = plc
        mp.per_level_earned = ple
        mp.save(update_fields=["total_earned", "level_reached", "per_level_counts", "per_level_earned", "updated_at"])
    except Exception:
        # non-critical
        pass


def _distribute_levels(upline: Iterable[CustomUser], base_amount: Decimal, percents: list[Decimal], tx_type: str, meta: dict[str, Any], pool_type: Optional[str] = None):
    base_q = _q2(base_amount)
    for idx, user in enumerate(upline):
        if idx >= len(percents):
            break
        pct = percents[idx] or Decimal("0")
        amt = _q2(base_q * pct / Decimal("100"))
        if amt <= 0:
            continue
        # Skip matrix payouts to agency/employee recipients
        if tx_type in ("AUTOPOOL_BONUS_THREE", "AUTOPOOL_BONUS_FIVE") and _is_agency_or_employee(user) and not _allow_agency_in_matrix():
            continue
        meta2 = dict(meta or {})
        meta2.update({"level_index": idx + 1, "percent": str(pct)})
        _credit_wallet(user, amt, tx_type=tx_type, meta=meta2, source_type=meta2.get("source_type", ""), source_id=meta2.get("source_id", ""))
        if pool_type:
            _update_matrix_progress(user, pool_type=pool_type, level=idx + 1, amount=amt)


def _matrix_ancestors(acc, depth: int):
    """
    Walk AutoPoolAccount parent chain to collect ancestor owners up to `depth`.
    Returns list of CustomUser recipients in order [L1..Ldepth] for matrix payouts.
    """
    chain: list[CustomUser] = []
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


def ensure_first_purchase_activation(user: CustomUser, source: Dict[str, Any]) -> None:
    """
    On user's first approved purchase/activation:
      - Stamp first_purchase_activated_at
      - Enable autopool/rewards
      - Unlock agency benefits and allow self-account creation
      - Mark account_active=True so Admin Users table and Dashboard stay in sync
    Idempotent: only applies once per user.
    """
    try:
        if getattr(user, "first_purchase_activated_at", None):
            # Even if already stamped earlier, ensure admin-visible account flag is on
            try:
                if not getattr(user, "account_active", False):
                    user.account_active = True
                    user.save(update_fields=["account_active"])
            except Exception:
                pass
            return
        user.first_purchase_activated_at = timezone.now()
        user.autopool_enabled = True
        user.rewards_enabled = True
        user.is_agency_unlocked = True
        user.can_create_self_accounts = True
        user.account_active = True
        user.save(update_fields=[
            "first_purchase_activated_at",
            "autopool_enabled",
            "rewards_enabled",
            "is_agency_unlocked",
            "can_create_self_accounts",
            "account_active",
        ])
        # Release any pending ledger for this user now that account is active (idempotent)
        try:
            from accounts.models import Wallet
            Wallet.release_pending_for_user(user)
        except Exception:
            pass

        # Free lucky draw coupon equivalent: increment rewards coupon progress by 1 (best-effort)
        try:
            from business.models import RewardProgress
            rp, _ = RewardProgress.objects.get_or_create(user=user)
            rp.coupon_count = int(getattr(rp, "coupon_count", 0) or 0) + 1
            rp.save(update_fields=["coupon_count", "updated_at"])
        except Exception:
            pass

        # Trigger deferred referral + franchise payouts only after first activation is stamped
        try:
            from business.services.referral import on_user_join
            on_user_join(user, source or {"type": "coupon_first_purchase", "id": getattr(user, "id", "")})
        except Exception:
            pass
        try:
            from business.models import CommissionConfig
            cfg = CommissionConfig.get_solo()
            if getattr(cfg, "enable_franchise_on_join", True):
                from business.services.franchise import distribute_franchise_benefit
                distribute_franchise_benefit(
                    user,
                    trigger="registration",
                    source=source or {"type": "coupon_first_purchase", "id": getattr(user, "id", "")},
                )
        except Exception:
            pass
    except Exception:
        # best-effort; do not block
        pass


@transaction.atomic
def activate_150_active(user: CustomUser, source: Dict[str, Any]) -> bool:
    """
    150 'Active' path:
      - Direct sponsor bonus ₹2 (DIRECT_REF_BONUS)
      - Self bonus ₹1 (SELF_BONUS_ACTIVE)
      - Open 5-matrix (L6) and 3-matrix (L15) pools and distribute per config percents / fixed amounts
      - Idempotent via SubscriptionActivation
    Returns True if newly activated, False if already existed.
    """
    t0 = time.time()
    timings: Dict[str, Any] = {}

    cfg = CommissionConfig.get_solo()
    src_type = str(source.get("type") or "")
    src_id = str(source.get("id") or source.get("code") or "")

    t_create_start = time.time()
    try:
        SubscriptionActivation.objects.create(
            user=user,
            package="PRIME_150_ACTIVE",
            source_type=src_type,
            source_id=src_id,
            amount=_q2(cfg.prime_activation_amount or 150),
            metadata=source,
        )
        created = True
        try:
            from coupons.models import AuditTrail
            AuditTrail.objects.create(
                action="debug_activate_150_active_created",
                actor=user,
                metadata={"source_type": src_type, "source_id": src_id},
            )
        except Exception:
            pass
    except IntegrityError:
        try:
            from coupons.models import AuditTrail
            AuditTrail.objects.create(
                action="debug_activate_150_active_exists",
                actor=user,
                metadata={"source_type": src_type, "source_id": src_id},
            )
        except Exception:
            pass
        return False
    timings["create_activation"] = time.time() - t_create_start

    # Bonuses
    base150 = _q2(cfg.prime_activation_amount or 150)
    # Determine base amount for percent-based distributions and reward points
    src_type_upper = (src_type or "").upper()
    is_prime_750 = ("PRIME_750" in src_type_upper) and ("UNIT" not in src_type_upper)
    base_product = _q2(750) if is_prime_750 else base150
    # Resolve direct/self bonus amounts from config + product overrides
    direct_amt = _q2(cfg.get_active_150_direct_bonus())
    self_amt = _q2(cfg.get_active_150_self_bonus())
    try:
        master = dict(getattr(cfg, "master_commission_json", {}) or {})
        # Preferred per-product mapping under master.direct_bonus, key derived from source
        direct_all = dict(master.get("direct_bonus", {}) or {})
        key = "750" if is_prime_750 else "150"
        row = dict(direct_all.get(key, {}) or {})
        product_set = False
        if "sponsor" in row:
            direct_amt = _q2(row.get("sponsor"))
            product_set = True
        if "self" in row:
            self_amt = _q2(row.get("self"))
            product_set = True
        # Legacy/alternate: master.products.coupon150.direct_bonus (apply only for 150 flows)
        if not product_set and key == "150":
            products = dict(master.get("products", {}) or {})
            coupon150 = dict(products.get("coupon150", {}) or {})
            db = dict(coupon150.get("direct_bonus", {}) or {})
            if "sponsor" in db:
                direct_amt = _q2(db.get("sponsor"))
                product_set = True
            if "self" in db:
                self_amt = _q2(db.get("self"))
                product_set = True
        # Fallback to legacy keys under active_150 when product override not set
        if not product_set:
            a150 = dict(master.get("active_150", {}) or {})
            if isinstance(a150.get("direct_bonus", None), dict) and "sponsor" in a150.get("direct_bonus", {}):
                direct_amt = _q2(a150.get("direct_bonus", {}).get("sponsor"))
            if "self_bonus" in a150:
                self_amt = _q2(a150.get("self_bonus"))
    except Exception:
        # best-effort: ignore bad master json
        pass
    if base150 <= 0:
        timings["total"] = time.time() - t0
        try:
            logger.info("activate_150_active timings user=%s source_id=%s timings=%s", getattr(user, "id", None), src_id, timings)
        except Exception:
            pass
        return created

    # Direct sponsor bonus (configurable)
    sponsor = getattr(user, "registered_by", None)
    if sponsor and direct_amt > 0:
        _credit_wallet(
            sponsor,
            direct_amt,
            tx_type="DIRECT_REF_BONUS",
            meta={"source": "ACTIVE_150", "source_type": src_type, "source_id": src_id},
            source_type=src_type,
            source_id=src_id,
        )

    # Self bonus (configurable)
    if self_amt > 0:
        _credit_wallet(
            user,
            self_amt,
            tx_type="SELF_BONUS_ACTIVE",
            meta={"source": "ACTIVE_150", "source_type": src_type, "source_id": src_id},
            source_type=src_type,
            source_id=src_id,
        )

    # Skip matrix/account creation/distribution if already distributed for this source (e.g., per‑coupon)
    try:
        from coupons.models import AuditTrail, CouponCode
        skip_matrix_parts = False
        if src_id:
            code_obj = CouponCode.objects.filter(pk=str(src_id)).first()
            if (code_obj and AuditTrail.objects.filter(action="coupon_matrix_distributed", coupon_code=code_obj).exists()) or AuditTrail.objects.filter(action="coupon_matrix_distributed", metadata__source_id=str(src_id)).exists():
                skip_matrix_parts = True
    except Exception:
        skip_matrix_parts = False

    if skip_matrix_parts:
        t_first_start = time.time()
        try:
            ensure_first_purchase_activation(user, source)
        except Exception:
            pass
        timings["ensure_first"] = time.time() - t_first_start
        # Optional geo payout on activation per config toggle
        try:
            if getattr(cfg, "enable_geo_distribution_on_activation", False):
                from business.models import distribute_auto_pool_commissions
                distribute_auto_pool_commissions(
                    user,
                    base_amount=base_product,
                    fixed_key=("750" if is_prime_750 else "150"),
                    source_type=src_type,
                    source_id=src_id,
                    extra_meta={"trigger": "ACTIVE_150"},
                )
        except Exception:
            pass
        timings["total"] = time.time() - t0
        try:
            logger.info("activate_150_active timings user=%s source_id=%s timings=%s", getattr(user, "id", None), src_id, timings)
        except Exception:
            pass
        return created

    # Create 5-matrix and 3-matrix pool entries
    t_open_start = time.time()
    acc5 = None
    acc3 = None
    try:
        acc5 = AutoPoolAccount.create_five_150_for_user(user, amount=base_product, source_type=src_type, source_id=src_id)
    except Exception:
        acc5 = None
    try:
        acc3 = AutoPoolAccount.place_in_three_pool(user, "THREE_150", base_product, source_type=src_type, source_id=src_id)
    except Exception:
        acc3 = None
    timings["open_accounts"] = time.time() - t_open_start

    # Distribute 5-matrix (L6) with fixed-amount override support
    t5_start = time.time()
    five_levels = int(getattr(cfg, "five_matrix_levels", 6) or 6)
    upline6 = _matrix_ancestors(acc5, depth=five_levels) if 'acc5' in locals() and acc5 else []
    if not upline6:
        # Fallback to sponsor chain when genealogy has no ancestors yet
        upline6 = _resolve_upline(user, depth=five_levels)
    # Prefer admin master overrides: consumer_matrix_5["150"].fixed_amounts -> fallback to typed field
    master = dict(getattr(cfg, "master_commission_json", {}) or {})
    cm5 = dict(master.get("consumer_matrix_5", {}) or {})
    cm3 = dict(master.get("consumer_matrix_3", {}) or {})
    key = "750" if is_prime_750 else "150"
    fixed_amounts5 = list((cm5.get(key, {}) or {}).get("fixed_amounts") or getattr(cfg, "five_matrix_amounts_json", []) or [])
    if fixed_amounts5:
        for idx, recipient in enumerate(upline6):
            if idx >= len(fixed_amounts5):
                break
            amt = _q2(fixed_amounts5[idx] or 0)
            if amt <= 0:
                continue
            # Skip matrix payout for agency/employee recipients
            if _is_agency_or_employee(recipient) and not _allow_agency_in_matrix():
                continue
            meta = {
                "source": "FIVE_MATRIX_150_FIXED",
                "source_type": src_type,
                "source_id": src_id,
                "level_index": idx + 1,
                "fixed": True,
            }
            _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_FIVE", meta=meta, source_type=src_type, source_id=src_id)
            _update_matrix_progress(recipient, pool_type="FIVE_150", level=idx + 1, amount=amt)
    else:
        five_percents = _as_percents(((cm5.get(key, {}) or {}).get("percents") or getattr(cfg, "five_matrix_percents_json", []) or []), five_levels)
        _distribute_levels(
            upline6,
            base_amount=base_product,
            percents=five_percents,
            tx_type="AUTOPOOL_BONUS_FIVE",
            meta={"source": "FIVE_MATRIX_150", "source_type": src_type, "source_id": src_id},
            pool_type="FIVE_150",
        )
    timings["distribute_five"] = time.time() - t5_start

    # Distribute 3-matrix (L15)
    t3_start = time.time()
    three_levels = int(getattr(cfg, "three_matrix_levels", 15) or 15)
    upline15 = _matrix_ancestors(acc3, depth=three_levels) if 'acc3' in locals() and acc3 else []
    if not upline15:
        # Fallback to sponsor chain when genealogy has no ancestors yet
        upline15 = _resolve_upline(user, depth=three_levels)

    # Prefer fixed-amount overrides if configured, else fall back to percent distribution
    fixed_amounts = list((cm3.get(key, {}) or {}).get("fixed_amounts") or getattr(cfg, "three_matrix_amounts_json", []) or [])
    if fixed_amounts:
        for idx, recipient in enumerate(upline15):
            if idx >= len(fixed_amounts):
                break
            amt = _q2(fixed_amounts[idx] or 0)
            if amt <= 0:
                continue
            # Skip matrix payout for agency/employee recipients
            if _is_agency_or_employee(recipient) and not _allow_agency_in_matrix():
                continue
            meta = {
                "source": "THREE_MATRIX_150_FIXED",
                "source_type": src_type,
                "source_id": src_id,
                "level_index": idx + 1,
                "fixed": True,
            }
            _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_THREE", meta=meta, source_type=src_type, source_id=src_id)
            _update_matrix_progress(recipient, pool_type="THREE_150", level=idx + 1, amount=amt)
    else:
        three_percents = _as_percents(((cm3.get(key, {}) or {}).get("percents") or getattr(cfg, "three_matrix_percents_json", []) or []), three_levels)
        _distribute_levels(
            upline15,
            base_amount=base_product,
            percents=three_percents,
            tx_type="AUTOPOOL_BONUS_THREE",
            meta={"source": "THREE_MATRIX_150", "source_type": src_type, "source_id": src_id},
            pool_type="THREE_150",
        )
    timings["distribute_three"] = time.time() - t3_start

    # Geo (Agency) configurable payout for 150 Active
    t_geo_start = time.time()
    try:
        from business.models import distribute_auto_pool_commissions
        distribute_auto_pool_commissions(
            user,
            base_amount=base_product,
            fixed_key=("750" if is_prime_750 else "150"),
            source_type=src_type,
            source_id=src_id,
            extra_meta={"trigger": "ACTIVE_150"},
        )
    except Exception:
        pass
    timings["geo"] = time.time() - t_geo_start

    # Mark first purchase activation (idempotent)
    t_first_start = time.time()
    try:
        ensure_first_purchase_activation(user, source)
    except Exception:
        pass
    # Reward points for PRIME 150/750 activation (non-ECOUPON sources): add denomination as points
    # Allow suppression via source flag or for PRODUCT flows.
    try:
        suppress_points = ("PRODUCT" in (src_type_upper or "")) or bool((source or {}).get("suppress_reward_points"))
        if (str(src_type or "").upper() != "ECOUPON") and (base_product > 0) and not suppress_points:
            from accounts.models import RewardPointsAccount
            reason_name = "PRIME_750" if is_prime_750 else "PRIME_150"
            RewardPointsAccount.credit_points(
                user,
                base_product,
                reason=reason_name,
                meta={"source_type": src_type, "source_id": src_id},
            )
    except Exception:
        # best-effort
        pass
    timings["ensure_first"] = time.time() - t_first_start
    timings["total"] = time.time() - t0
    try:
        logger.info("activate_150_active timings user=%s source_id=%s timings=%s", getattr(user, "id", None), src_id, timings)
    except Exception:
        pass

    return created


@transaction.atomic
def redeem_150(user: CustomUser, source: Dict[str, Any]) -> bool:
    """
    150 'Redeem' path:
      - Credit 150 reward points (1pt = ₹1) to user's Reward Points account
      - No pools opened
      - Idempotent via SubscriptionActivation(PRIME_150_REDEEM)
    """
    cfg = CommissionConfig.get_solo()
    src_type = str(source.get("type") or "")
    src_id = str(source.get("id") or source.get("code") or "")
    try:
        SubscriptionActivation.objects.create(
            user=user,
            package="PRIME_150_REDEEM",
            source_type=src_type,
            source_id=src_id,
            amount=_q2(cfg.redeem_credit_amount_150 or 150),
            metadata=source,
        )
        created = True
        try:
            from coupons.models import AuditTrail
            AuditTrail.objects.create(
                action="debug_redeem_150_created",
                actor=user,
                metadata={"source_type": src_type, "source_id": src_id},
            )
        except Exception:
            pass
    except IntegrityError:
        try:
            from coupons.models import AuditTrail
            AuditTrail.objects.create(
                action="debug_redeem_150_exists",
                actor=user,
                metadata={"source_type": src_type, "source_id": src_id},
            )
        except Exception:
            pass
        return False

    credit = _q2(cfg.redeem_credit_amount_150 or 150)
    if credit > 0:
        # Credit reward points instead of money wallet
        try:
            from accounts.models import RewardPointsAccount
            RewardPointsAccount.credit_points(
                user,
                credit,
                reason="REDEEM_150",
                meta={"source_type": src_type, "source_id": src_id, "note": "Redeem 150 credited as reward points"},
            )
        except Exception:
            # best-effort: do not block redeem flow if points credit fails
            pass
        try:
            from coupons.models import AuditTrail
            AuditTrail.objects.create(
                action="debug_redeem_150_points_credit",
                actor=user,
                metadata={"points": str(credit), "source_type": src_type, "source_id": src_id},
            )
        except Exception:
            pass
    return created


@transaction.atomic
def activate_50(user: CustomUser, source: Dict[str, Any], package_code: str = "GLOBAL_50") -> bool:
    """
    50 activation (coupon or self/product):
      - Open 3-matrix (L15) pool with base=50
      - Distribute per three_matrix_percents_json
      - Idempotent via SubscriptionActivation(GLOBAL_50 or SELF_50)
    """
    cfg = CommissionConfig.get_solo()
    src_type = str(source.get("type") or "")
    src_id = str(source.get("id") or source.get("code") or "")
    try:
        SubscriptionActivation.objects.create(
            user=user,
            package=package_code,
            source_type=src_type,
            source_id=src_id,
            amount=_q2(cfg.global_activation_amount or 50),
            metadata=source,
        )
        created = True
        try:
            from coupons.models import AuditTrail
            AuditTrail.objects.create(
                action="debug_activate_50_created",
                actor=user,
                metadata={"source_type": src_type, "source_id": src_id, "package": package_code},
            )
        except Exception:
            pass
    except IntegrityError:
        try:
            from coupons.models import AuditTrail
            AuditTrail.objects.create(
                action="debug_activate_50_exists",
                actor=user,
                metadata={"source_type": src_type, "source_id": src_id, "package": package_code},
            )
        except Exception:
            pass
        return False

    base50 = _q2(cfg.global_activation_amount or 50)
    try:
        AutoPoolAccount.place_three_50_for_user(user, amount=base50)
    except Exception:
        pass
    # Enable autopool and rewards eligibility upon 50 activation (best-effort)
    try:
        dirty = False
        if not getattr(user, "autopool_enabled", False):
            user.autopool_enabled = True
            dirty = True
        if not getattr(user, "rewards_enabled", False):
            user.rewards_enabled = True
            dirty = True
        if dirty:
            user.save(update_fields=["autopool_enabled", "rewards_enabled"])
    except Exception:
        pass

    three_levels = int(getattr(cfg, "three_matrix_levels", 15) or 15)
    upline15 = _resolve_upline(user, depth=three_levels)
    # Prefer admin master overrides for 50 path (consumer_matrix_3["50"])
    try:
        master = dict(getattr(cfg, "master_commission_json", {}) or {})
    except Exception:
        master = {}
    cm3 = dict(master.get("consumer_matrix_3", {}) or {})
    fixed_amounts50 = list((cm3.get("50", {}) or {}).get("fixed_amounts") or [])
    if fixed_amounts50:
        for idx, recipient in enumerate(upline15):
            if idx >= len(fixed_amounts50):
                break
            amt = _q2(fixed_amounts50[idx] or 0)
            if amt <= 0:
                continue
            # Skip matrix payout for agency/employee recipients
            if _is_agency_or_employee(recipient) and not _allow_agency_in_matrix():
                continue
            meta = {
                "source": "THREE_MATRIX_50_FIXED",
                "source_type": src_type,
                "source_id": src_id,
                "level_index": idx + 1,
                "fixed": True,
            }
            _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_THREE", meta=meta, source_type=src_type, source_id=src_id)
            _update_matrix_progress(recipient, pool_type="THREE_50", level=idx + 1, amount=amt)
    else:
        three_percents = _as_percents(((cm3.get("50", {}) or {}).get("percents") or getattr(cfg, "three_matrix_percents_json", []) or []), three_levels)
        _distribute_levels(
            upline15,
            base_amount=base50,
            percents=three_percents,
            tx_type="AUTOPOOL_BONUS_THREE",
            meta={"source": "THREE_MATRIX_50", "source_type": src_type, "source_id": src_id},
            pool_type="THREE_50",
        )

    # Mark first purchase activation (idempotent)
    try:
        ensure_first_purchase_activation(user, source)
    except Exception:
        pass

    return created


def product_purchase_activations(user: CustomUser, source: Dict[str, Any]) -> None:
    """
    On product approval, open activations per config:
      - If product_opens_prime is False (default): open 3-matrix 50 only.
      - If True: also open 150 Active path.
    """
    cfg = CommissionConfig.get_solo()
    try:
        if getattr(cfg, "product_opens_prime", False):
            activate_150_active(user, source)
        activate_50(user, source, package_code="PRODUCT_GLOBAL_50")
    except Exception:
        # best-effort
        pass
    # Mark first purchase activation + unlocks (idempotent)
    try:
        ensure_first_purchase_activation(user, source)
    except Exception:
        pass


@transaction.atomic
def open_matrix_accounts_for_coupon(user: CustomUser, coupon_id: int | str, amount_150: Decimal | None = None, distribute: bool = True, trigger: str = "promo_purchase", include_direct_self: bool = True, include_agency: bool = True) -> None:
    """
    Ensure per-coupon AutoPoolAccount entries exist (FIVE_150 + THREE_150),
    tagged with source_type='ECOUPON' and source_id=str(coupon_id).
    If distribute=True, perform per-level commission payouts per pool with meta including coupon id and trigger.
    Idempotent per (user, pool, source).
    """
    cfg = CommissionConfig.get_solo()
    src_type = "ECOUPON"
    src_id = str(coupon_id or "")
    base150 = _q2(amount_150 if amount_150 is not None else (cfg.prime_activation_amount or 150))

    # Idempotent account creation: FIVE_150
    try:
        exists5 = AutoPoolAccount.objects.filter(
            owner=user, pool_type="FIVE_150", status="ACTIVE", source_type=src_type, source_id=src_id
        ).exists()
        if not exists5:
            AutoPoolAccount.place_in_five_pool(user, "FIVE_150", base150, source_type=src_type, source_id=src_id)
    except Exception:
        pass

    # Idempotent account creation: THREE_150
    try:
        exists3 = AutoPoolAccount.objects.filter(
            owner=user, pool_type="THREE_150", status="ACTIVE", source_type=src_type, source_id=src_id
        ).exists()
        if not exists3:
            AutoPoolAccount.place_in_three_pool(user, "THREE_150", base150, source_type=src_type, source_id=src_id)
    except Exception:
        pass

    # If distribution already recorded for this coupon, only audit creation and exit
    try:
        from coupons.models import AuditTrail, CouponCode
        cobj = CouponCode.objects.filter(pk=str(coupon_id)).first()
        already_distributed = False
        if cobj and AuditTrail.objects.filter(action="coupon_matrix_distributed", coupon_code=cobj).exists():
            already_distributed = True
        elif AuditTrail.objects.filter(action="coupon_matrix_distributed", metadata__source_id=src_id).exists():
            already_distributed = True
        if already_distributed:
            try:
                AuditTrail.objects.create(
                    action="coupon_matrix_created",
                    actor=user,
                    coupon_code=cobj if cobj else None,
                    notes=f"Matrix accounts already distributed earlier for coupon {src_id}",
                    metadata={"source_type": src_type, "source_id": src_id, "trigger": trigger},
                )
            except Exception:
                pass
            return
    except Exception:
        pass

    if not distribute or base150 <= 0:
        # Still audit creation best-effort
        try:
            from coupons.models import AuditTrail, CouponCode
            cobj = CouponCode.objects.filter(pk=str(coupon_id)).first()
            AuditTrail.objects.create(
                action="coupon_matrix_created",
                actor=user,
                coupon_code=cobj if cobj else None,
                notes=f"Matrix accounts created for coupon {src_id}",
                metadata={"source_type": src_type, "source_id": src_id, "trigger": trigger},
            )
        except Exception:
            pass
        return

    # Coupon-specific Direct/Self bonuses for 150 (prefer master.direct_bonus["150"], fallback to legacy products.coupon150)
    if include_direct_self:
        try:
            direct_amt = Decimal("0.00")
            self_amt = Decimal("0.00")
            master = dict(getattr(cfg, "master_commission_json", {}) or {})
            # Preferred per-product mapping
            direct_all = dict(master.get("direct_bonus", {}) or {})
            row150 = dict(direct_all.get("150", {}) or {})
            if "sponsor" in row150:
                direct_amt = _q2(row150.get("sponsor"))
            if "self" in row150:
                self_amt = _q2(row150.get("self"))
            # Fallback to legacy products.coupon150.direct_bonus if not provided above
            if direct_amt == Decimal("0.00") and self_amt == Decimal("0.00"):
                products = dict(master.get("products", {}) or {})
                coupon150 = dict(products.get("coupon150", {}) or {})
                db = dict(coupon150.get("direct_bonus", {}) or {})
                if "sponsor" in db:
                    direct_amt = _q2(db.get("sponsor"))
                if "self" in db:
                    self_amt = _q2(db.get("self"))
            sponsor = getattr(user, "registered_by", None)
            if sponsor and direct_amt > 0:
                _credit_wallet(
                    sponsor,
                    direct_amt,
                    tx_type="DIRECT_REF_BONUS",
                    meta={"source": "ECOUPON_150", "source_type": src_type, "source_id": src_id},
                    source_type=src_type,
                    source_id=src_id,
                )
            if self_amt > 0:
                _credit_wallet(
                    user,
                    self_amt,
                    tx_type="SELF_BONUS_ACTIVE",
                    meta={"source": "ECOUPON_150", "source_type": src_type, "source_id": src_id},
                    source_type=src_type,
                    source_id=src_id,
                )
        except Exception:
            # best-effort
            pass

    # Distribute 5-matrix (support fixed-amount overrides)
    try:
        five_levels = int(getattr(cfg, "five_matrix_levels", 6) or 6)
        # Use matrix genealogy: ancestors of the coupon-specific FIVE_150 account
        try:
            acc5 = AutoPoolAccount.objects.filter(
                owner=user, pool_type="FIVE_150", status="ACTIVE", source_type=src_type, source_id=src_id
            ).order_by("id").first()
        except Exception:
            acc5 = None
        upline6 = _matrix_ancestors(acc5, depth=five_levels) if acc5 else []
        if not upline6:
            # Fallback to sponsor chain when genealogy has no ancestors yet
            upline6 = _resolve_upline(user, depth=five_levels)
        # Prefer admin master overrides for 150 path
        master = dict(getattr(cfg, "master_commission_json", {}) or {})
        cm5 = dict(master.get("consumer_matrix_5", {}) or {})
        cm3 = dict(master.get("consumer_matrix_3", {}) or {})
        fixed5 = list((cm5.get("150", {}) or {}).get("fixed_amounts") or getattr(cfg, "five_matrix_amounts_json", []) or [])
        if fixed5:
            for idx, recipient in enumerate(upline6):
                if idx >= len(fixed5):
                    break
                amt = _q2(fixed5[idx] or 0)
                if amt <= 0:
                    continue
                if _is_agency_or_employee(recipient) and not _allow_agency_in_matrix():
                    continue
                meta = {"source": "FIVE_MATRIX_COUPON_FIXED", "source_type": src_type, "source_id": src_id, "level_index": idx + 1, "fixed": True, "trigger": trigger}
                _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_FIVE", meta=meta, source_type=src_type, source_id=src_id)
                _update_matrix_progress(recipient, pool_type="FIVE_150", level=idx + 1, amount=amt)
        else:
            five_percents = _as_percents(((cm5.get("150", {}) or {}).get("percents") or getattr(cfg, "five_matrix_percents_json", []) or []), five_levels)
            _distribute_levels(
                upline6,
                base_amount=base150,
                percents=five_percents,
                tx_type="AUTOPOOL_BONUS_FIVE",
                meta={"source": "FIVE_MATRIX_COUPON", "source_type": src_type, "source_id": src_id, "trigger": trigger},
                pool_type="FIVE_150",
            )
    except Exception:
        pass

    # Distribute 3-matrix (support fixed-amount overrides)
    try:
        three_levels = int(getattr(cfg, "three_matrix_levels", 15) or 15)
        # Use matrix genealogy: ancestors of the coupon-specific THREE_150 account
        try:
            acc3 = AutoPoolAccount.objects.filter(
                owner=user, pool_type="THREE_150", status="ACTIVE", source_type=src_type, source_id=src_id
            ).order_by("id").first()
        except Exception:
            acc3 = None
        upline15 = _matrix_ancestors(acc3, depth=three_levels) if acc3 else []
        if not upline15:
            # Fallback to sponsor chain when genealogy has no ancestors yet
            upline15 = _resolve_upline(user, depth=three_levels)
        fixed3 = list((cm3.get("150", {}) or {}).get("fixed_amounts") or getattr(cfg, "three_matrix_amounts_json", []) or [])
        if fixed3:
            for idx, recipient in enumerate(upline15):
                if idx >= len(fixed3):
                    break
                amt = _q2(fixed3[idx] or 0)
                if amt <= 0:
                    continue
                if _is_agency_or_employee(recipient) and not _allow_agency_in_matrix():
                    continue
                meta = {"source": "THREE_MATRIX_COUPON_FIXED", "source_type": src_type, "source_id": src_id, "level_index": idx + 1, "fixed": True, "trigger": trigger}
                _credit_wallet(recipient, amt, tx_type="AUTOPOOL_BONUS_THREE", meta=meta, source_type=src_type, source_id=src_id)
                _update_matrix_progress(recipient, pool_type="THREE_150", level=idx + 1, amount=amt)
        else:
            three_percents = _as_percents(((cm3.get("150", {}) or {}).get("percents") or getattr(cfg, "three_matrix_percents_json", []) or []), three_levels)
            _distribute_levels(
                upline15,
                base_amount=base150,
                percents=three_percents,
                tx_type="AUTOPOOL_BONUS_THREE",
                meta={"source": "THREE_MATRIX_COUPON", "source_type": src_type, "source_id": src_id, "trigger": trigger},
                pool_type="THREE_150",
            )
    except Exception:
        pass

    # Geo (Agency) configurable payout for per-coupon 150 (ECOUPON)
    if include_agency:
        try:
            from business.models import distribute_auto_pool_commissions
            distribute_auto_pool_commissions(
                user,
                base_amount=base150,
                fixed_key="150",
                source_type=src_type,
                source_id=src_id,
                extra_meta={"trigger": "ECOUPON_150"},
            )
        except Exception:
            pass

    # Reward points: credit base amount equal to 150 for this e‑coupon distribution
    # Do not credit reward points on e‑coupon activation; points are credited on purchase approval.
    try:
        pass
    except Exception:
        pass

    # Audit (best-effort)
    try:
        from coupons.models import AuditTrail, CouponCode
        cobj = CouponCode.objects.filter(pk=str(coupon_id)).first()
        AuditTrail.objects.create(
            action="coupon_matrix_distributed",
            actor=user,
            coupon_code=cobj if cobj else None,
            notes=f"Matrix accounts created and distributed for coupon {src_id}",
            metadata={"source_type": src_type, "source_id": src_id, "trigger": trigger},
        )
    except Exception:
        pass
