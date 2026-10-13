from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from django.db import models, transaction
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import CommissionConfig, AutoPoolAccount
from .activation import _is_agency_or_employee, _allow_agency_in_matrix, _update_matrix_progress

logger = logging.getLogger(__name__)


def _q2(val: Any) -> Decimal:
    try:
        return Decimal(str(val or 0)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def _matrix_ancestor_accounts(acc: AutoPoolAccount, depth: int = 15) -> List[AutoPoolAccount]:
    chain: List[AutoPoolAccount] = []
    try:
        seen = set()
        node = getattr(acc, "parent_account", None)
        while node and len(chain) < max(0, depth):
            if node.id in seen:
                break
            seen.add(node.id)
            chain.append(node)
            node = getattr(node, "parent_account", None)
    except Exception:
        pass
    return chain


def check_consumer_2k_package_eligibility(consumer: CustomUser) -> bool:
    """
    Checks if consumer has purchased at least the ₹2,000 package.
    Eligible if:
      - Has AutoPoolAccount in FIVE_150 or THREE_150, OR
      - Has approved/completed PromoPurchase >= 2000, OR
      - Has first_purchase_activated_at set and account_active=True.
    """
    if not consumer:
        return False
    try:
        if AutoPoolAccount.objects.filter(owner=consumer, pool_type__in=["FIVE_150", "THREE_150"]).exists():
            return True
    except Exception:
        pass

    try:
        from business.models import PromoPurchase
        paid = PromoPurchase.objects.filter(
            user=consumer,
            status__in=["APPROVED", "COMPLETED", "SUCCESS", "ACTIVE"]
        ).aggregate(total=models.Sum("amount_paid"))["total"] or Decimal("0.00")
        if paid >= Decimal("2000.00"):
            return True
    except Exception:
        pass

    if getattr(consumer, "first_purchase_activated_at", None) and getattr(consumer, "account_active", False):
        return True

    return False


def _resolve_consumer_sponsor(consumer: CustomUser, company_user: Optional[CustomUser] = None) -> Optional[CustomUser]:
    """
    Resolves the consumer's sponsor. Can be root consumer id (9999999999) or any onboarded consumer.
    """
    if not consumer:
        return company_user
    sponsor = getattr(consumer, "registered_by", None)
    if sponsor:
        return sponsor
    sid = str(getattr(consumer, "sponsor_id", "") or "").strip()
    if sid:
        sponsor = CustomUser.objects.filter(
            models.Q(username__iexact=sid) |
            models.Q(phone=sid) |
            models.Q(prefixed_id__iexact=sid)
        ).first()
        if sponsor:
            return sponsor
    return company_user


def _resolve_rebirth_target_user(
    funding_user: CustomUser,
    company_user: Optional[CustomUser] = None
) -> Tuple[CustomUser, Optional[CustomUser], bool]:
    """
    Resolves:
      (target_matrix_user, sponsor, is_franchise_flow)
    Rules:
      1. If funding_user is Consumer:
         - target_matrix_user = funding_user
         - sponsor = _resolve_consumer_sponsor(funding_user, company_user)
         - is_franchise_flow = False
      2. If funding_user is Franchise Agency / Employee:
         - Match consumer via mobile number (`phone`)
         - Consumer must have purchased at least ₹2,000 package
         - If eligible:
             * target_matrix_user = consumer
             * sponsor = _resolve_consumer_sponsor(consumer, company_user)
             * is_franchise_flow = True
         - Fallback (sad case: no consumer account or <2k purchase):
             * target_matrix_user = company_user or funding_user
             * sponsor = company_user
             * is_franchise_flow = True
    """
    is_franchise = _is_agency_or_employee(funding_user)
    if not is_franchise:
        sponsor = _resolve_consumer_sponsor(funding_user, company_user)
        return funding_user, sponsor, False

    phone = (getattr(funding_user, "phone", "") or "").strip()
    consumer_user = None
    if phone:
        consumer_user = CustomUser.objects.filter(
            phone=phone,
            category="consumer"
        ).order_by("id").first()
        if not consumer_user:
            consumer_user = CustomUser.objects.filter(
                phone=phone
            ).exclude(category__startswith="agency").exclude(role="agency").order_by("id").first()

    if consumer_user and check_consumer_2k_package_eligibility(consumer_user):
        sponsor = _resolve_consumer_sponsor(consumer_user, company_user)
        return consumer_user, sponsor, True

    logger.warning(
        "Franchise rebirth: Agency %s (phone %s) has no active 2k consumer account. Routing matrix placement to company apex root.",
        getattr(funding_user, "username", "unknown"),
        phone
    )
    fallback_user = company_user or funding_user
    return fallback_user, fallback_user, True


def get_rebirth_config(is_franchise: bool = False) -> Dict[str, Any]:
    """Load admin-configured Self Rebirth ID (₹250) Allocation or balanced defaults."""
    cfg = CommissionConfig.get_solo()
    master = dict(getattr(cfg, "master_commission_json", {}) or {})
    rank_cfg = dict(master.get("rank_upgrade_config", {}) or {})
    if is_franchise:
        reb = dict(rank_cfg.get("franchise_rebirth_allocation") or rank_cfg.get("rebirth_allocation", {}) or {})
    else:
        reb = dict(rank_cfg.get("consumer_rebirth_allocation") or rank_cfg.get("rebirth_allocation", {}) or {})

    # Defaults matching admin screen with 0 imbalance (total ₹250)
    defaults = {
        "total_amount": 250.0,
        "direct_sponsor": 25.0 if is_franchise else 40.0,
        "matrix_5": 80.0,
        "matrix_3": 20.0,
        "pincode_royalty": 15.0,
        "district_royalty": 10.0,
        "state_royalty": 15.0,
        "district_royalty_l1_l7": 15.0,
        "district_royalty_l1_l10_30d": 10.0,
        "districtwise_royalty_l8_l10": 15.0,
        "statewise_royalty_l8_l10": 10.0,
        "district_captain_royalty": 5.0,
        "state_captain_royalty": 5.0,
        "statewise_ssv_voucher": 1.0,
        "statewise_zonal_head": 1.0,
        "statewise_rewards": 1.0,
        "company_admin": 22.0 if is_franchise else 7.0,
        # legacy fallback aliases
        "franchise_pool": 15.0,
        "district_pool": 10.0,
        "state_pool": 15.0,
        "district_royalty_t1": 15.0,
        "district_royalty_t2": 15.0,
        "company_gross": 22.0 if is_franchise else 7.0,
        "matrix_5_levels": [{"level": i + 1, "amount": 8.0} for i in range(10)],
        "matrix_3_levels": [{"level": i + 1, "amount": 1.38 if i == 14 else 1.33} for i in range(15)],
        "pincode_roles_pct": {
            "pincode": 45,
            "pincode_coord": 15,
            "district": 15,
            "district_coord": 10,
            "state": 10,
            "state_coord": 5,
        },
        "franchise_roles_pct": {
            "pincode": 45,
            "pincode_coord": 15,
            "district": 15,
            "district_coord": 10,
            "state": 10,
            "state_coord": 5,
        },
        "district_roles_pct": {
            "pincode": 15,
            "pincode_coord": 10,
            "district": 35,
            "district_coord": 20,
            "state": 12,
            "state_coord": 8,
        },
        "state_roles_pct": {
            "pincode": 10,
            "pincode_coord": 5,
            "district": 15,
            "district_coord": 10,
            "state": 40,
            "state_coord": 20,
        },
    }

    merged = {**defaults, **reb}

    # Bidirectional alias synchronization
    if "pincode_royalty" in reb:
        merged["franchise_pool"] = reb["pincode_royalty"]
    elif "franchise_pool" in reb:
        merged["pincode_royalty"] = reb["franchise_pool"]

    if "district_royalty" in reb:
        merged["district_pool"] = reb["district_royalty"]
    elif "district_pool" in reb:
        merged["district_royalty"] = reb["district_pool"]

    if "state_royalty" in reb:
        merged["state_pool"] = reb["state_royalty"]
    elif "state_pool" in reb:
        merged["state_royalty"] = reb["state_pool"]

    if "district_royalty_l1_l7" in reb:
        merged["district_royalty_t1"] = reb["district_royalty_l1_l7"]
    elif "district_royalty_t1" in reb:
        merged["district_royalty_l1_l7"] = reb["district_royalty_t1"]

    if "districtwise_royalty_l8_l10" in reb:
        merged["district_royalty_t2"] = reb["districtwise_royalty_l8_l10"]
    elif "district_royalty_t2" in reb:
        merged["districtwise_royalty_l8_l10"] = reb["district_royalty_t2"]

    if "company_admin" in reb:
        merged["company_gross"] = reb["company_admin"]
    elif "company_gross" in reb:
        merged["company_admin"] = reb["company_gross"]

    if "pincode_roles_pct" in reb:
        merged["franchise_roles_pct"] = reb["pincode_roles_pct"]
    elif "franchise_roles_pct" in reb:
        merged["pincode_roles_pct"] = reb["franchise_roles_pct"]

    return merged


def _distribute_pincode_royalty(user: CustomUser, pack_index: Optional[int], conf: Dict[str, Any]) -> Dict[str, Any]:
    """
    Distributes Pincode Royalty (default ₹15.00) across geographic uplines:
    Pincode Owner, Pincode Coordinator, District Owner, District Coordinator,
    State Owner, and State Coordinator per admin configured percentage split.
    """
    gross_amt = _q2(conf.get("pincode_royalty", conf.get("franchise_pool", 15.0)))
    if gross_amt <= 0:
        return {}

    p_roles = dict(conf.get("pincode_roles_pct") or conf.get("franchise_roles_pct") or {})
    pct_map = {
        "pincode": Decimal(str(p_roles.get("pincode", 45))),
        "pincode_coord": Decimal(str(p_roles.get("pincode_coord", 15))),
        "district": Decimal(str(p_roles.get("district", 15))),
        "district_coord": Decimal(str(p_roles.get("district_coord", 10))),
        "state": Decimal(str(p_roles.get("state", 10))),
        "state_coord": Decimal(str(p_roles.get("state_coord", 5))),
    }

    pin = (getattr(user, "pincode", "") or "").strip()
    user_state = getattr(user, "state", None)
    user_city = getattr(user, "city", None)
    dist_name = getattr(user_city, "name", "") if user_city else ""

    recipients: Dict[str, Optional[CustomUser]] = {
        "pincode": None,
        "pincode_coord": None,
        "district": None,
        "district_coord": None,
        "state": None,
        "state_coord": None,
    }

    if pin:
        recipients["pincode"] = CustomUser.objects.filter(
            category="agency_pincode",
            region_assignments__level="pincode",
            region_assignments__pincode=pin,
            account_active=True,
        ).distinct().first()
        recipients["pincode_coord"] = CustomUser.objects.filter(
            category="agency_pincode_coordinator",
            region_assignments__level="pincode",
            region_assignments__pincode=pin,
            account_active=True,
        ).distinct().first()

    if user_state:
        d_qs = CustomUser.objects.filter(
            category="agency_district",
            region_assignments__level="district",
            region_assignments__state=user_state,
            account_active=True,
        )
        if dist_name:
            recipients["district"] = d_qs.filter(region_assignments__district__iexact=dist_name).distinct().first() or d_qs.distinct().first()
        else:
            recipients["district"] = d_qs.distinct().first()

        dc_qs = CustomUser.objects.filter(
            category="agency_district_coordinator",
            region_assignments__level="district",
            region_assignments__state=user_state,
            account_active=True,
        )
        if dist_name:
            recipients["district_coord"] = dc_qs.filter(region_assignments__district__iexact=dist_name).distinct().first() or dc_qs.distinct().first()
        else:
            recipients["district_coord"] = dc_qs.distinct().first()

        recipients["state"] = CustomUser.objects.filter(
            category="agency_state",
            region_assignments__level="state",
            region_assignments__state=user_state,
            account_active=True,
        ).distinct().first()

        recipients["state_coord"] = CustomUser.objects.filter(
            category="agency_state_coordinator",
            region_assignments__level="state",
            region_assignments__state=user_state,
            account_active=True,
        ).distinct().first()

    paid = {}
    src_type = "SELF_REBIRTH_250"
    src_id_base = str(pack_index) if pack_index is not None else ""

    for role_key, pct in pct_map.items():
        if pct <= 0:
            continue
        amt = _q2(gross_amt * pct / Decimal("100.0"))
        if amt <= 0:
            continue
        target = recipients.get(role_key)
        if target:
            try:
                tw = Wallet.get_or_create_for_user(target)
                tw.credit(
                    amt,
                    tx_type="FRANCHISE_INCOME",
                    meta={
                        "source": "PINCODE_ROYALTY_REBIRTH_250",
                        "role": role_key,
                        "pincode": pin,
                        "percent": float(pct),
                        "from_user_id": user.id,
                        "from_user": getattr(user, "username", None),
                        "pack_index": pack_index,
                    },
                    source_type=src_type,
                    source_id=f"PINCODE_ROY_{src_id_base}_{role_key}_{target.id}",
                )
                paid[role_key] = {"user_id": target.id, "amount": float(amt)}
            except Exception as e:
                logger.warning(f"Pincode royalty credit failed for {role_key}: {e}")

    return paid


def distribute_self_rebirth_250(user: CustomUser, pack_index: Optional[int] = None) -> Dict[str, Any]:
    """
    Executes a 100% Admin-Controlled ₹250 Self Rebirth:
      1. Resolves target matrix user:
         - Consumer Rebirth: places in consumer's own tree, sponsor bonus to consumer's sponsor (₹40 default).
         - Franchise Rebirth: maps via mobile number to Consumer (requires active ₹2k package),
           places seats under Consumer user (clusters in 5-matrix, global BFS in 3-matrix),
           and credits Direct Sponsor Bonus to Consumer's Referrer (₹25 default).
      2. Places 1 seat in 5-Matrix (5-Block tree)
      3. Places 1 seat in 3-Matrix (3-Block tree)
      4. Distributes 5-Matrix upline earnings (10 levels, ₹8/level default)
      5. Distributes 3-Matrix upline earnings (15 levels, ₹1.33/level default)
      6. Credits Direct Sponsor Bonus
      7. Credits Geo/Franchise, District, State, and Royalty pools
      8. Credits Company Gross Retention (₹7 default for consumer, ₹22 default for franchise)
    """
    if not user:
        return {"success": False, "error": "User required"}

    cfg = CommissionConfig.get_solo()
    company_user = cfg.get_company_user()

    # Resolve target matrix user and sponsor
    target_matrix_user, sponsor, is_franchise_flow = _resolve_rebirth_target_user(user, company_user)

    conf = get_rebirth_config(is_franchise=is_franchise_flow)
    src_type = "SELF_REBIRTH_250"
    src_id = str(pack_index) if pack_index is not None else ""

    # Open matrix seats in both pools under the target matrix user
    acc5 = AutoPoolAccount.place_in_five_pool(
        target_matrix_user,
        pool_type="FIVE_150",
        amount=_q2(conf.get("total_amount", 250)),
        source_type=src_type,
        source_id=src_id,
    )

    acc3 = AutoPoolAccount.place_in_three_pool(
        target_matrix_user,
        pool_type="THREE_150",
        amount=_q2(conf.get("total_amount", 250)),
        source_type=src_type,
        source_id=src_id,
    )

    # 1. Distribute 5-Matrix Payouts
    m5_levels = conf.get("matrix_5_levels") or [{"level": i + 1, "amount": 8.0} for i in range(10)]
    if acc5:
        upline5 = _matrix_ancestor_accounts(acc5, depth=len(m5_levels))
        for idx, node in enumerate(upline5):
            if idx >= len(m5_levels):
                break
            recipient = getattr(node, "owner", None)
            if not recipient:
                continue
            amt = _q2(m5_levels[idx].get("amount", 8.0))
            if amt <= 0:
                continue
            try:
                rw = Wallet.get_or_create_for_user(recipient)
                rw.credit(
                    amt,
                    tx_type="AUTOPOOL_BONUS_FIVE",
                    meta={
                        "source": "FIVE_MATRIX_REBIRTH_250",
                        "level_index": idx + 1,
                        "fixed": True,
                        "from_user_id": target_matrix_user.id,
                        "from_user": getattr(target_matrix_user, "username", None),
                        "funding_agency_id": user.id if is_franchise_flow else None,
                        "funding_agency_username": getattr(user, "username", None) if is_franchise_flow else None,
                        "trigger": "SELF_REBIRTH_250",
                        "matrix_root": {"account_id": node.id},
                    },
                    source_type=src_type,
                    source_id=src_id,
                    matrix_account_id=node.id,
                )
                _update_matrix_progress(recipient, pool_type="FIVE_150", level=idx + 1, amount=amt)
            except Exception as e:
                logger.warning(f"5-Matrix credit failed for node {node.id}: {e}")

    # 2. Distribute 3-Matrix Payouts
    m3_levels = conf.get("matrix_3_levels") or [{"level": i + 1, "amount": 1.38 if i == 14 else 1.33} for i in range(15)]
    if acc3:
        upline3 = _matrix_ancestor_accounts(acc3, depth=len(m3_levels))
        for idx, node in enumerate(upline3):
            if idx >= len(m3_levels):
                break
            recipient = getattr(node, "owner", None)
            if not recipient:
                continue
            amt = _q2(m3_levels[idx].get("amount", 1.33))
            if amt <= 0:
                continue
            try:
                rw = Wallet.get_or_create_for_user(recipient)
                rw.credit(
                    amt,
                    tx_type="AUTOPOOL_BONUS_THREE",
                    meta={
                        "source": "THREE_MATRIX_REBIRTH_250",
                        "level_index": idx + 1,
                        "fixed": True,
                        "from_user_id": target_matrix_user.id,
                        "from_user": getattr(target_matrix_user, "username", None),
                        "funding_agency_id": user.id if is_franchise_flow else None,
                        "funding_agency_username": getattr(user, "username", None) if is_franchise_flow else None,
                        "trigger": "SELF_REBIRTH_250",
                        "matrix_root": {"account_id": node.id},
                    },
                    source_type=src_type,
                    source_id=src_id,
                    matrix_account_id=node.id,
                )
                _update_matrix_progress(recipient, pool_type="THREE_150", level=idx + 1, amount=amt)
            except Exception as e:
                logger.warning(f"3-Matrix credit failed for node {node.id}: {e}")

    # 3. Direct Sponsor Bonus (Dynamic: ₹25 default for franchise, ₹40 for consumer)
    sponsor_amt = _q2(conf.get("direct_sponsor", 25.0 if is_franchise_flow else 40.0))
    if sponsor and sponsor_amt > 0:
        try:
            sw = Wallet.get_or_create_for_user(sponsor)
            sw.credit(
                sponsor_amt,
                tx_type="DIRECT_REF_BONUS",
                meta={
                    "from_user_id": target_matrix_user.id,
                    "from_user": getattr(target_matrix_user, "username", None),
                    "funding_agency_id": user.id if is_franchise_flow else None,
                    "funding_agency_username": getattr(user, "username", None) if is_franchise_flow else None,
                    "auto_rule": "FRANCHISE_SELF_REBIRTH_250" if is_franchise_flow else "SELF_REBIRTH_250",
                    "pack_index": pack_index,
                    "is_franchise": is_franchise_flow,
                },
                source_type=src_type,
                source_id=src_id,
            )
        except Exception as e:
            logger.warning(f"Sponsor bonus credit failed: {e}")

    # 4. Pincode Royalty (default ₹15.00) to 6-role geo upline
    geo_target = target_matrix_user if getattr(target_matrix_user, "pincode", None) else user
    pincode_paid = {}
    try:
        pincode_paid = _distribute_pincode_royalty(geo_target, pack_index, conf)
    except Exception as e:
        logger.warning(f"Pincode royalty distribution failed for rebirth pack #{pack_index}: {e}")

    # 5. Company Admin Gross Retention (Dynamic: ₹22 default for franchise, ₹7 for consumer)
    company_amt = _q2(conf.get("company_admin", conf.get("company_gross", 22.0 if is_franchise_flow else 7.0)))
    if company_user and company_amt > 0:
        try:
            cw = Wallet.get_or_create_for_user(company_user)
            cw.credit(
                company_amt,
                tx_type="TAX_POOL_CREDIT",
                meta={
                    "from_user_id": target_matrix_user.id,
                    "from_user": getattr(target_matrix_user, "username", None),
                    "funding_agency_id": user.id if is_franchise_flow else None,
                    "funding_agency_username": getattr(user, "username", None) if is_franchise_flow else None,
                    "no_withhold": True,
                    "auto_rule": "FRANCHISE_SELF_REBIRTH_250" if is_franchise_flow else "SELF_REBIRTH_250",
                    "pack_index": pack_index,
                    "pool_name": "COMPANY_ADMIN_RETENTION",
                },
                source_type=src_type,
                source_id=src_id,
            )
        except Exception as e:
            logger.warning(f"Company retention credit failed: {e}")

    # 5b. Statewise SSV Voucher Contribution (Dynamic ₹1.00 from Rebirth into State Pool)
    ssv_rate = _q2(conf.get("statewise_ssv_voucher", 1.0))
    user_state = getattr(geo_target, "state", None) or getattr(user, "state", None)
    if not user_state:
        from locations.models import State
        user_state = State.objects.filter(name__icontains="Karnataka").first()
    if user_state and ssv_rate > 0:
        try:
            from business.models import StateSSVPool
            pool, _ = StateSSVPool.objects.get_or_create(state=user_state)
            pool.accumulated_amount = (pool.accumulated_amount or Decimal("0.00")) + ssv_rate
            pool.save(update_fields=["accumulated_amount", "last_updated_at"])
        except Exception as e:
            logger.warning(f"State SSV pool contribution failed for state {getattr(user_state, 'name', '')}: {e}")

    # 6. Audit Trail
    try:
        from coupons.models import AuditTrail
        geo_pin = (getattr(geo_target, "pincode", "") or "").strip()
        geo_state_name = getattr(getattr(geo_target, "state", None), "name", "")
        geo_city_name = getattr(getattr(geo_target, "city", None), "name", "")

        AuditTrail.objects.create(
            action="self_rebirth_250_distributed",
            actor=user,
            notes=f"Self Rebirth 250 (pack #{pack_index}, is_franchise={is_franchise_flow}) executed successfully",
            metadata={
                "pack_index": pack_index,
                "is_franchise": is_franchise_flow,
                "funding_user_id": user.id,
                "target_matrix_user_id": target_matrix_user.id,
                "acc5_id": getattr(acc5, "id", None),
                "acc3_id": getattr(acc3, "id", None),
                "sponsor_id": getattr(sponsor, "id", None),
                "pincode": geo_pin,
                "city": geo_city_name,
                "state": geo_state_name,
                "pincode_royalty_paid": pincode_paid,
                "company_admin_amt": float(company_amt),
            },
        )
    except Exception:
        pass

    return {
        "success": True,
        "is_franchise": is_franchise_flow,
        "target_matrix_user_id": target_matrix_user.id,
        "acc5_id": getattr(acc5, "id", None),
        "acc3_id": getattr(acc3, "id", None),
        "pack_index": pack_index,
        "pincode_royalty_paid": pincode_paid,
    }


