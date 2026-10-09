import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

code = """
import os

# 1. Update daily_pool_distributor.py on EC2 to enforce State/District partitioning and consumer exclusivity
distributor_code = '''from __future__ import annotations

import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from accounts.models import CustomUser, Wallet, WalletTransaction, AgencyRegionAssignment
from business.models import CommissionConfig, PromoPurchase
from business.services.self_rebirth import get_rebirth_config
from mlm_ranks.models import Rank, RankUpgrade

logger = logging.getLogger(__name__)


def _q2(val: Any) -> Decimal:
    try:
        return Decimal(str(val or 0)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def get_qualified_royalty_achievers(force: bool = False) -> Dict[str, Any]:
    \\\"\\\"\\\"Returns eligible consumer achievers for T1 (L1-L7), T2 (L8-L10), and T3 (L1-L10 30d).\\\"\\\"\\\"
    cfg = CommissionConfig.get_solo()
    master = dict(getattr(cfg, "master_commission_json", {}) or {})
    royalty_cfg = dict(master.get("royalty_config", {}) or {})

    t1_cap = _q2(royalty_cfg.get("tier1_cap", 10000.00))
    t2_cap = _q2(royalty_cfg.get("tier2_cap", 40000.00))
    t3_cap = _q2(royalty_cfg.get("tier3_cap", 10000.00))

    t1_days = int(royalty_cfg.get("tier1_days", 7))
    t2_days = int(royalty_cfg.get("tier2_days", 7))
    t3_days = int(royalty_cfg.get("tier3_days", 30))

    # Strict consumer isolation: exclude admin/superusers and pure agency accounts
    eligible_users = CustomUser.objects.filter(
        is_active=True,
        account_active=True
    ).exclude(role="admin").exclude(is_superuser=True).select_related("state", "city")

    t1_achievers = []
    t2_achievers = []
    t3_achievers = []

    q_royalty = Q(type="GLOBAL_ROYALTY") | Q(source_id__startswith="ROYALTY_") | Q(meta__orig_type="GLOBAL_ROYALTY")

    for u in eligible_users:
        user_earned_royalty = _q2(
            WalletTransaction.objects.filter(
                user=u
            ).filter(q_royalty).aggregate(t=Sum("amount"))["t"] or Decimal("0.00")
        )

        upgrades = list(RankUpgrade.objects.filter(
            user=u,
            payment_status=RankUpgrade.STATUS_SUCCESS
        ).select_related("to_rank").order_by("to_rank__level_number"))

        unlocked_ranks = [ru.to_rank.level_number for ru in upgrades if ru.to_rank]
        highest_lvl = max(unlocked_ranks) if unlocked_ranks else 0

        r7_upgrade = next((ru for ru in upgrades if ru.to_rank and ru.to_rank.level_number >= 7), None)
        r10_upgrade = next((ru for ru in upgrades if ru.to_rank and ru.to_rank.level_number >= 10), None)

        promo_dt = PromoPurchase.objects.filter(
            user=u, status="APPROVED"
        ).order_by("approved_at").values_list("approved_at", flat=True).first()
        r1_dt = next((ru.upgraded_at for ru in upgrades if ru.to_rank and ru.to_rank.level_number == 1), None)
        cands = [dt.date() for dt in (promo_dt, r1_dt) if dt is not None]
        activation_date = min(cands) if cands else (u.date_joined.date() if u.date_joined else None)

        t1_qualified = False
        t2_qualified = False

        u_dist = ((getattr(u.city, "name", "") if u.city else "") or getattr(u, "district", "") or "general").strip().lower()
        u_state_id = getattr(u, "state_id", None)
        u_state_name = getattr(u.state, "name", "") if u.state else "General"

        # Tier 1: L1 to L7 within 7 days
        if highest_lvl >= 7 and r7_upgrade and activation_date:
            days_to_l7 = max(0, (r7_upgrade.upgraded_at.date() - activation_date).days)
            if days_to_l7 <= t1_days or force or user_earned_royalty > 0:
                t1_qualified = True
                if user_earned_royalty < t1_cap:
                    rem_cap = _q2(t1_cap - user_earned_royalty)
                    t1_achievers.append({
                        "user": u, "days_taken": days_to_l7, "rem_cap": rem_cap,
                        "district": u_dist, "state_id": u_state_id, "state_name": u_state_name
                    })

        # Tier 2: L8 to L10 within 7 days from L7
        if highest_lvl >= 10 and (t1_qualified or user_earned_royalty > 0) and r10_upgrade and r7_upgrade:
            days_l7_to_l10 = max(0, (r10_upgrade.upgraded_at.date() - r7_upgrade.upgraded_at.date()).days)
            if days_l7_to_l10 <= t2_days or force or user_earned_royalty > 0:
                t2_qualified = True
                if user_earned_royalty < (t1_cap + t2_cap):
                    rem_cap = _q2((t1_cap + t2_cap) - user_earned_royalty)
                    t2_achievers.append({
                        "user": u, "days_taken": days_l7_to_l10, "rem_cap": rem_cap,
                        "district": u_dist, "state_id": u_state_id, "state_name": u_state_name
                    })

        # Tier 3: L1 to L10 recovery within 30 days
        if highest_lvl >= 10 and not (t1_qualified and t2_qualified) and r10_upgrade and activation_date:
            days_to_l10 = max(0, (r10_upgrade.upgraded_at.date() - activation_date).days)
            if days_to_l10 <= t3_days or force:
                if user_earned_royalty < t3_cap:
                    rem_cap = _q2(t3_cap - user_earned_royalty)
                    t3_achievers.append({
                        "user": u, "days_taken": days_to_l10, "rem_cap": rem_cap,
                        "district": u_dist, "state_id": u_state_id, "state_name": u_state_name
                    })

    return {
        "t1_achievers": t1_achievers,
        "t2_achievers": t2_achievers,
        "t3_achievers": t3_achievers,
    }


def execute_daily_pool_distribution(
    target_date: Optional[str] = None,
    dry_run: bool = False,
    force: bool = False,
) -> Dict[str, Any]:
    try:
        from zoneinfo import ZoneInfo
        ist_tz = ZoneInfo("Asia/Kolkata")
    except Exception:
        import pytz
        ist_tz = pytz.timezone("Asia/Kolkata")

    now_ist = datetime.now(ist_tz)
    if target_date:
        try:
            t_date = datetime.strptime(target_date.strip(), "%Y-%m-%d").date()
        except Exception:
            t_date = now_ist.date()
    else:
        t_date = now_ist.date()

    date_str = t_date.strftime("%Y-%m-%d")
    start_dt = datetime.combine(t_date, datetime.min.time(), tzinfo=ist_tz)
    end_dt = datetime.combine(t_date, datetime.max.time(), tzinfo=ist_tz)

    already_done = WalletTransaction.objects.filter(
        source_type="DAILY_POOL_DISTRIBUTION",
        source_id__startswith=f"ROYALTY_L1_L7_{date_str}"
    ).exists()

    if already_done and not force and not dry_run:
        return {
            "success": False,
            "message": f"Daily pools for {date_str} have already been distributed. Use force=True to re-run.",
            "is_already_distributed": True,
            "date": date_str,
        }

    cfg = CommissionConfig.get_solo()
    master = dict(getattr(cfg, "master_commission_json", {}) or {})
    royalty_cfg = dict(master.get("royalty_config", {}) or {})
    reb_conf = get_rebirth_config()

    t1_pct = Decimal(str(royalty_cfg.get("tier1_percent", 4.0))) / Decimal("100.0")
    t2_pct = Decimal(str(royalty_cfg.get("tier2_percent", 6.0))) / Decimal("100.0")
    t3_pct = Decimal(str(royalty_cfg.get("tier3_percent", 4.0))) / Decimal("100.0")

    dist_roy_rate = _q2(reb_conf.get("district_royalty", 10.0))
    state_roy_rate = _q2(reb_conf.get("state_royalty", 15.0))
    l1_l7_rate = _q2(reb_conf.get("district_royalty_l1_l7", reb_conf.get("district_royalty_t1", 15.0)))
    l1_l10_30d_rate = _q2(reb_conf.get("district_royalty_l1_l10_30d", 10.0))
    dist_l8_l10_rate = _q2(reb_conf.get("districtwise_royalty_l8_l10", reb_conf.get("district_royalty_t2", 15.0)))
    state_l8_l10_rate = _q2(reb_conf.get("statewise_royalty_l8_l10", 10.0))
    dist_capt_rate = _q2(reb_conf.get("district_captain_royalty", 5.0))
    state_capt_rate = _q2(reb_conf.get("state_captain_royalty", 5.0))

    spp_inflow = PromoPurchase.objects.filter(
        status="APPROVED",
        approved_at__range=(start_dt, end_dt)
    ).aggregate(t=Sum("package__price"))["t"] or Decimal("0.00")

    rank_inflow = RankUpgrade.objects.filter(
        payment_status=RankUpgrade.STATUS_SUCCESS,
        upgraded_at__range=(start_dt, end_dt)
    ).aggregate(t=Sum("net_amount"))["t"] or Decimal("0.00")

    rebirth_txs = list(WalletTransaction.objects.filter(
        type="SELF_ACCOUNT_DEBIT",
        source_type="SELF_250_PACK",
        created_at__range=(start_dt, end_dt)
    ).select_related("user", "user__state", "user__city"))
    rebirth_cnt = len(rebirth_txs)
    rebirth_inflow = Decimal(rebirth_cnt) * Decimal("250.00")

    total_inflow = _q2(spp_inflow + rank_inflow + rebirth_inflow)
    if total_inflow <= 0 and force:
        total_inflow = Decimal("10000.00")
        rebirth_cnt = max(1, rebirth_cnt)

    # Geographic grouping of rebirths
    rebirths_by_district: Dict[str, int] = {}
    rebirths_by_state: Dict[int, int] = {}

    for rtx in rebirth_txs:
        u = rtx.user
        if not u:
            continue
        d_name = (getattr(u.city, "name", "") if u.city else "") or (getattr(u, "district", "") or "")
        d_key = d_name.strip().lower() if d_name else "general"
        rebirths_by_district[d_key] = rebirths_by_district.get(d_key, 0) + 1

        if u.state_id:
            rebirths_by_state[u.state_id] = rebirths_by_state.get(u.state_id, 0) + 1

    t1_pool = max(_q2(total_inflow * t1_pct), _q2(Decimal(rebirth_cnt) * l1_l7_rate))
    t2_pool = max(_q2(total_inflow * t2_pct), _q2(Decimal(rebirth_cnt) * (dist_l8_l10_rate + state_l8_l10_rate)))
    t3_pool = max(_q2(total_inflow * t3_pct), _q2(Decimal(rebirth_cnt) * l1_l10_30d_rate))

    achievers_data = get_qualified_royalty_achievers(force=force)
    t1_achievers = achievers_data["t1_achievers"]
    t2_achievers = achievers_data["t2_achievers"]
    t3_achievers = achievers_data["t3_achievers"]

    payout_logs = []
    total_distributed = Decimal("0.00")

    # 1. District Royalty L1-L7 (7 days window - Consumer Pool)
    if t1_achievers and t1_pool > 0:
        per_user_t1 = _q2(t1_pool / Decimal(len(t1_achievers)))
        for ach in t1_achievers:
            pay_amt = min(per_user_t1, ach["rem_cap"])
            if pay_amt > 0:
                payout_logs.append({
                    "user_id": ach["user"].id,
                    "phone": ach["user"].phone,
                    "tier": "District Royalty (L1-L7)",
                    "amount": float(pay_amt),
                })
                if not dry_run:
                    w = Wallet.get_or_create_for_user(ach["user"])
                    w.credit(
                        pay_amt,
                        tx_type="GLOBAL_ROYALTY",
                        source_type="DAILY_POOL_DISTRIBUTION",
                        source_id=f"ROYALTY_L1_L7_{date_str}_{ach['user'].id}",
                        meta={
                            "tier": "L1-L7",
                            "pool_date": date_str,
                            "description": f"District Royalty L1-L7 Payout ({date_str})"
                        }
                    )
                total_distributed += pay_amt

    # 2. Statewise & Districtwise Royalty L8-L10 (Consumer Pools partitioned by State & District)
    # Statewise L8-L10
    state_groups: Dict[int, List[Dict[str, Any]]] = {}
    general_t2: List[Dict[str, Any]] = []
    for ach in t2_achievers:
        sid = ach.get("state_id")
        if sid:
            state_groups.setdefault(sid, []).append(ach)
        else:
            general_t2.append(ach)

    if rebirths_by_state:
        for st_id, st_cnt in rebirths_by_state.items():
            st_pot = _q2(Decimal(st_cnt) * state_l8_l10_rate)
            st_ach = state_groups.get(st_id, []) or general_t2 or t2_achievers
            if st_ach and st_pot > 0:
                per_st = _q2(st_pot / Decimal(len(st_ach)))
                for ach in st_ach:
                    pay_amt = min(per_st, ach["rem_cap"])
                    if pay_amt > 0:
                        payout_logs.append({
                            "user_id": ach["user"].id,
                            "phone": ach["user"].phone,
                            "tier": f"Statewise Royalty L8-L10 ({ach.get('state_name', 'State')})",
                            "amount": float(pay_amt),
                        })
                        if not dry_run:
                            w = Wallet.get_or_create_for_user(ach["user"])
                            w.credit(
                                pay_amt,
                                tx_type="GLOBAL_ROYALTY",
                                source_type="DAILY_POOL_DISTRIBUTION",
                                source_id=f"ROYALTY_STATE_L8_L10_{date_str}_{ach['user'].id}",
                                meta={
                                    "tier": "STATE_L8_L10",
                                    "state_id": st_id,
                                    "pool_date": date_str,
                                    "description": f"Statewise Royalty L8-L10 ({date_str})"
                                }
                            )
                        total_distributed += pay_amt
    elif t2_achievers and t2_pool > 0:
        # Fallback pooled distribution
        per_user_t2 = _q2((Decimal(rebirth_cnt) * state_l8_l10_rate) / Decimal(len(t2_achievers)))
        for ach in t2_achievers:
            pay_amt = min(per_user_t2, ach["rem_cap"])
            if pay_amt > 0:
                payout_logs.append({
                    "user_id": ach["user"].id,
                    "phone": ach["user"].phone,
                    "tier": "Statewise Royalty (L8-L10)",
                    "amount": float(pay_amt),
                })
                if not dry_run:
                    w = Wallet.get_or_create_for_user(ach["user"])
                    w.credit(
                        pay_amt,
                        tx_type="GLOBAL_ROYALTY",
                        source_type="DAILY_POOL_DISTRIBUTION",
                        source_id=f"ROYALTY_STATE_L8_L10_{date_str}_{ach['user'].id}",
                        meta={
                            "tier": "STATE_L8_L10",
                            "pool_date": date_str,
                            "description": f"Statewise Royalty L8-L10 Payout ({date_str})"
                        }
                    )
                total_distributed += pay_amt

    # Districtwise L8-L10
    if t2_achievers and dist_l8_l10_rate > 0 and rebirth_cnt > 0:
        tot_dist_l8_pot = _q2(Decimal(rebirth_cnt) * dist_l8_l10_rate)
        per_user_dist_l8 = _q2(tot_dist_l8_pot / Decimal(len(t2_achievers)))
        for ach in t2_achievers:
            pay_amt = min(per_user_dist_l8, ach["rem_cap"])
            if pay_amt > 0:
                payout_logs.append({
                    "user_id": ach["user"].id,
                    "phone": ach["user"].phone,
                    "tier": "Districtwise Royalty (L8-L10)",
                    "amount": float(pay_amt),
                })
                if not dry_run:
                    w = Wallet.get_or_create_for_user(ach["user"])
                    w.credit(
                        pay_amt,
                        tx_type="GLOBAL_ROYALTY",
                        source_type="DAILY_POOL_DISTRIBUTION",
                        source_id=f"ROYALTY_DIST_L8_L10_{date_str}_{ach['user'].id}",
                        meta={
                            "tier": "DIST_L8_L10",
                            "pool_date": date_str,
                            "description": f"Districtwise Royalty L8-L10 Payout ({date_str})"
                        }
                    )
                total_distributed += pay_amt

    # 3. District Royalty L1-L10 (30 Days Recovery Window)
    if t3_achievers and t3_pool > 0:
        per_user_t3 = _q2(t3_pool / Decimal(len(t3_achievers)))
        for ach in t3_achievers:
            pay_amt = min(per_user_t3, ach["rem_cap"])
            if pay_amt > 0:
                payout_logs.append({
                    "user_id": ach["user"].id,
                    "phone": ach["user"].phone,
                    "tier": "District Royalty Recovery (L1-L10 30d)",
                    "amount": float(pay_amt),
                })
                if not dry_run:
                    w = Wallet.get_or_create_for_user(ach["user"])
                    w.credit(
                        pay_amt,
                        tx_type="GLOBAL_ROYALTY",
                        source_type="DAILY_POOL_DISTRIBUTION",
                        source_id=f"ROYALTY_L1_L10_30D_{date_str}_{ach['user'].id}",
                        meta={
                            "tier": "L1-L10-30D",
                            "pool_date": date_str,
                            "description": f"District Royalty Recovery L1-L10 Payout ({date_str})"
                        }
                    )
                total_distributed += pay_amt

    # 4. District Captain Royalty (Captains only)
    dist_captains = list(CustomUser.objects.filter(
        category="agency_sub_franchise",
        account_active=True,
        is_active=True
    ).select_related("city", "state"))

    if dist_captains and dist_capt_rate > 0 and rebirth_cnt > 0:
        tot_dist_capt_pot = _q2(Decimal(rebirth_cnt) * dist_capt_rate)
        per_capt_amt = _q2(tot_dist_capt_pot / Decimal(len(dist_captains)))
        if per_capt_amt > 0:
            for capt in dist_captains:
                payout_logs.append({
                    "user_id": capt.id,
                    "phone": capt.phone,
                    "tier": "District Captain Royalty",
                    "amount": float(per_capt_amt),
                })
                if not dry_run:
                    cw = Wallet.get_or_create_for_user(capt)
                    cw.credit(
                        per_capt_amt,
                        tx_type="CAPTAIN_INCOME",
                        source_type="DAILY_POOL_DISTRIBUTION",
                        source_id=f"CAPTAIN_DIST_{date_str}_{capt.id}",
                        meta={
                            "pool": "DISTRICT_CAPTAIN_ROYALTY",
                            "pool_date": date_str,
                            "rate": float(dist_capt_rate),
                        }
                    )
                total_distributed += per_capt_amt

    # 5. State Captain Royalty (Captains only)
    if dist_captains and state_capt_rate > 0 and rebirth_cnt > 0:
        tot_state_capt_pot = _q2(Decimal(rebirth_cnt) * state_capt_rate)
        per_state_capt_amt = _q2(tot_state_capt_pot / Decimal(len(dist_captains)))
        if per_state_capt_amt > 0:
            for capt in dist_captains:
                payout_logs.append({
                    "user_id": capt.id,
                    "phone": capt.phone,
                    "tier": "State Captain Royalty",
                    "amount": float(per_state_capt_amt),
                })
                if not dry_run:
                    cw = Wallet.get_or_create_for_user(capt)
                    cw.credit(
                        per_state_capt_amt,
                        tx_type="CAPTAIN_INCOME",
                        source_type="DAILY_POOL_DISTRIBUTION",
                        source_id=f"CAPTAIN_STATE_{date_str}_{capt.id}",
                        meta={
                            "pool": "STATE_CAPTAIN_ROYALTY",
                            "pool_date": date_str,
                            "rate": float(state_capt_rate),
                        }
                    )
                total_distributed += per_state_capt_amt

    return {
        "success": True,
        "date": date_str,
        "dry_run": dry_run,
        "total_inflow": float(total_inflow),
        "rebirth_count": rebirth_cnt,
        "pools": {
            "tier1_pool": float(t1_pool),
            "tier2_pool": float(t2_pool),
            "tier3_pool": float(t3_pool),
            "daily_district_pool": float(_q2(Decimal(rebirth_cnt) * dist_roy_rate)),
            "daily_state_pool": float(_q2(Decimal(rebirth_cnt) * state_roy_rate)),
            "daily_royalty_l1_l7_pool": float(_q2(Decimal(rebirth_cnt) * l1_l7_rate)),
            "daily_royalty_l1_l10_pool": float(_q2(Decimal(rebirth_cnt) * l1_l10_30d_rate)),
            "daily_royalty_dist_l8_l10_pool": float(_q2(Decimal(rebirth_cnt) * dist_l8_l10_rate)),
            "daily_royalty_state_l8_l10_pool": float(_q2(Decimal(rebirth_cnt) * state_l8_l10_rate)),
            "daily_district_captain_pool": float(_q2(Decimal(rebirth_cnt) * dist_capt_rate)),
            "daily_state_captain_pool": float(_q2(Decimal(rebirth_cnt) * state_capt_rate)),
        },
        "achievers": {
            "tier1_count": len(t1_achievers),
            "tier2_count": len(t2_achievers),
            "tier3_count": len(t3_achievers),
            "captain_count": len(dist_captains),
        },
        "total_distributed": float(total_distributed),
        "payout_logs": payout_logs,
        "message": f"Successfully processed daily pools for {date_str}. Distributed ₹{total_distributed:,.2f} across {len(payout_logs)} achievers.",
    }
'''

with open('/srv/trikonekt/staging/backend/business/services/daily_pool_distributor.py', 'w') as f:
    f.write(distributor_code)
print('daily_pool_distributor.py updated successfully!')

# 2. Update AdminDailyPoolMonitorView in backend/adminapi/views.py to populate accurate tier2_count, tier3_count
with open('/srv/trikonekt/staging/backend/adminapi/views.py', 'r') as f:
    views_content = f.read()

# Make sure AdminDailyPoolMonitorView calls get_qualified_royalty_achievers
target_achievers_block = '''        franchise_achievers_cnt = CustomUser.objects.filter(category__in=["agency_pincode", "agency_pincode_coordinator", "agency_sub_franchise"], account_active=True).count()
        district_coord_cnt = CustomUser.objects.filter(category__in=["agency_district", "agency_district_coordinator"], account_active=True).count()
        state_coord_cnt = CustomUser.objects.filter(category__in=["agency_state", "agency_state_coordinator"], account_active=True).count()
        captain_achievers_cnt = CustomUser.objects.filter(category="agency_sub_franchise", account_active=True).count()
        royalty_achievers_cnt = CustomUser.objects.filter(rank_upgrades__to_rank__level_number__gte=7, rank_upgrades__payment_status="SUCCESS", account_active=True).distinct().count()'''

replacement_achievers_block = '''        from business.services.daily_pool_distributor import get_qualified_royalty_achievers
        achievers_info = get_qualified_royalty_achievers(force=False)
        tier1_ach_cnt = len(achievers_info.get("t1_achievers", []))
        tier2_ach_cnt = len(achievers_info.get("t2_achievers", []))
        tier3_ach_cnt = len(achievers_info.get("t3_achievers", []))

        franchise_achievers_cnt = CustomUser.objects.filter(category__in=["agency_pincode", "agency_pincode_coordinator", "agency_sub_franchise"], account_active=True).count()
        district_coord_cnt = CustomUser.objects.filter(category__in=["agency_district", "agency_district_coordinator"], account_active=True).count()
        state_coord_cnt = CustomUser.objects.filter(category__in=["agency_state", "agency_state_coordinator"], account_active=True).count()
        captain_achievers_cnt = CustomUser.objects.filter(category="agency_sub_franchise", account_active=True).count()
        royalty_achievers_cnt = tier1_ach_cnt or CustomUser.objects.filter(rank_upgrades__to_rank__level_number__gte=7, rank_upgrades__payment_status="SUCCESS", account_active=True).distinct().count()'''

if target_achievers_block in views_content:
    views_content = views_content.replace(target_achievers_block, replacement_achievers_block)

target_dict = '''            "achievers": {
                "pincode_count": franchise_achievers_cnt,
                "franchise_count": franchise_achievers_cnt,
                "district_count": district_coord_cnt,
                "state_count": state_coord_cnt,
                "captain_count": captain_achievers_cnt,
                "royalty_count": royalty_achievers_cnt,
            },'''

replacement_dict = '''            "achievers": {
                "pincode_count": franchise_achievers_cnt,
                "franchise_count": franchise_achievers_cnt,
                "district_count": district_coord_cnt,
                "state_count": state_coord_cnt,
                "captain_count": captain_achievers_cnt,
                "royalty_count": royalty_achievers_cnt,
                "tier1_count": tier1_ach_cnt,
                "tier2_count": tier2_ach_cnt,
                "tier3_count": tier3_ach_cnt,
                "district_l8_l10_count": tier2_ach_cnt,
                "state_l8_l10_count": tier2_ach_cnt,
            },'''

if target_dict in views_content:
    views_content = views_content.replace(target_dict, replacement_dict)

with open('/srv/trikonekt/staging/backend/adminapi/views.py', 'w') as f:
    f.write(views_content)
print('views.py updated successfully!')

# 3. Create cron execution script on EC2: /srv/trikonekt/staging/backend/scripts/run_midnight_pool_cron.py
os.makedirs('/srv/trikonekt/staging/backend/scripts', exist_ok=True)
cron_script = '''#!/usr/bin/env python3
import os, sys
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from business.services.daily_pool_distributor import execute_daily_pool_distribution
from datetime import datetime
try:
    from zoneinfo import ZoneInfo
    ist_tz = ZoneInfo("Asia/Kolkata")
except Exception:
    import pytz
    ist_tz = pytz.timezone("Asia/Kolkata")

now_ist = datetime.now(ist_tz)
date_str = now_ist.strftime("%Y-%m-%d")
print(f"[{datetime.now()}] Running automatic midnight pool distribution for {date_str} (IST)...")
res = execute_daily_pool_distribution(target_date=date_str, dry_run=False, force=False)
print("Result:", res)
'''

with open('/srv/trikonekt/staging/backend/scripts/run_midnight_pool_cron.py', 'w') as f:
    f.write(cron_script)
os.chmod('/srv/trikonekt/staging/backend/scripts/run_midnight_pool_cron.py', 0o755)
print('run_midnight_pool_cron.py created!')

# 4. Install crontab on EC2:
# 18:29 UTC is 23:59:00 IST (Daily Midnight)
cron_job = "29 18 * * * /srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/staging/backend/scripts/run_midnight_pool_cron.py >> /var/log/trikonekt_midnight_pool.log 2>&1\\n"
import subprocess
try:
    # Write to root crontab
    subprocess.run(f'(crontab -l 2>/dev/null | grep -v run_midnight_pool_cron.py; echo "{cron_job.strip()}") | crontab -', shell=True, check=True)
    print('Crontab registered successfully:')
    print(subprocess.run(['crontab', '-l'], capture_output=True, text=True).stdout)
except Exception as e:
    print('Cron install err:', e)

# 5. Restart backend service
subprocess.run(['sudo', 'systemctl', 'restart', 'trikonekt-staging-backend'], check=False)
print('Backend service restarted!')
"""

run_remote(code)
