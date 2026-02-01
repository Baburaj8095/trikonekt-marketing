import os
import sys
import json
from decimal import Decimal

# Ensure backend/ on sys.path and Django setup
_CUR = os.path.dirname(__file__)
_BACKEND = os.path.abspath(os.path.join(_CUR, ".."))
_PROJECT = os.path.abspath(os.path.join(_CUR, "..", ".."))
for p in (_BACKEND, _PROJECT):
    if p not in sys.path:
        sys.path.append(p)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402
django.setup()

from django.utils import timezone  # noqa: E402
from django.db.models import Q  # noqa: E402
from accounts.models import CustomUser, WalletTransaction  # noqa: E402
from business.models import CommissionConfig, AutoPoolAccount  # noqa: E402
from business.services.commission_policy import CommissionPolicy  # noqa: E402

def _q(s):
    try:
        return Decimal(str(s))
    except Exception:
        return None

def _load_products_block(cfg):
    master = dict(getattr(cfg, "master_commission_json", {}) or {})
    products = dict(master.get("products", {}) or {})
    # merge flattened keys
    try:
        for k, v in list(master.items()):
            if isinstance(k, str) and k.startswith("products."):
                _, rest = k.split("products.", 1)
                parts = rest.split(".")
                if not parts:
                    continue
                pkey = parts[0]
                node = products.setdefault(pkey, {})
                if len(parts) == 1:
                    if isinstance(v, dict):
                        node.update(dict(v))
                else:
                    node[parts[1]] = v
    except Exception:
        pass
    # alias overlay
    try:
        alias_map = {
            "150": ["coupon150", "coupon_150", "prime150", "prime_150"],
            "750": ["rs750", "prime750", "prime_750"],
            "759": ["rs759", "prime759", "prime_759"],
        }
        canonical = dict(products)
        for canon, aliases in alias_map.items():
            base = dict(products.get(canon, {}) or {})
            for a in aliases:
                node = products.get(a)
                if isinstance(node, dict) and node:
                    try:
                        base.update(dict(node))
                    except Exception:
                        pass
            if base:
                canonical[canon] = base
        products = canonical
    except Exception:
        pass
    return products, master

def resolve_user(uin: str):
    uin = str(uin or "").strip()
    if not uin:
        return None
    # Try username exact, then phone
    u = CustomUser.objects.filter(username__iexact=uin).first()
    if u:
        return u
    return CustomUser.objects.filter(phone__iexact=uin).first()

def main():
    uname = (os.environ.get("DIAG_USERNAME") or "").strip()
    pid_raw = (os.environ.get("DIAG_PURCHASE_ID") or "").strip()
    try:
        pid = str(int(pid_raw)) if pid_raw else ""
    except Exception:
        pid = str(pid_raw or "")

    now = timezone.now().isoformat()
    out = {"ok": True, "now": now, "input": {"username": uname, "purchase_id": pid}}

    user = resolve_user(uname)
    if not user:
        out["ok"] = False
        out["error"] = "user_not_found"
    else:
        sponsor = getattr(user, "registered_by", None)
        out["user"] = {
            "id": user.id,
            "username": user.username,
            "role": getattr(user, "role", None),
            "category": getattr(user, "category", None),
            "sponsor_id": getattr(sponsor, "id", None),
            "sponsor_username": getattr(sponsor, "username", None),
        }

        # Commission policy snapshot
        pol = None
        pol_err = None
        try:
            pol = CommissionPolicy.load()
            p150 = pol.prime150()
            out["policy_prime150"] = {
                "direct_sponsor": str(p150.direct_sponsor),
                "direct_self": str(p150.direct_self),
                "enable_3_matrix": bool(p150.enable_3_matrix),
                "enable_5_matrix": bool(p150.enable_5_matrix),
                "reward_points_amount": str(p150.reward_points_amount),
            }
        except Exception as e:
            pol_err = f"{type(e).__name__}: {e}"
            out["policy_prime150_error"] = pol_err

        cfg = CommissionConfig.get_solo()
        products, master = _load_products_block(cfg)
        prod150 = dict(products.get("150", {}) or {})
        general = dict(master.get("general", {}) or {})
        cm3 = dict(master.get("consumer_matrix_3", {}) or {})
        cm3_150 = dict(cm3.get("150", {}) or {})

        out["config"] = {
            "products.150.matrix_open_mode": prod150.get("matrix_open_mode"),
            "products.150.matrix_open_count": prod150.get("matrix_open_count"),
            "consumer_matrix_3.150.fixed_amounts_len": len(list(cm3_150.get("fixed_amounts") or [])),
            "consumer_matrix_3.150.percents_len": len(list(cm3_150.get("percents") or [])),
            "general.allow_agency_in_matrix": bool(general.get("allow_agency_in_matrix", False)),
        }

        # Matrix account presence for this purchase id (prime engine tags src_type= PROMO_PURCHASE_APPROVAL)
        def _acc_count(pool):
            return AutoPoolAccount.objects.filter(
                owner=user, pool_type=pool, status="ACTIVE",
                source_type="PROMO_PURCHASE_APPROVAL", source_id=pid
            ).count()

        out["matrix_accounts_for_purchase"] = {
            "five_150_count": _acc_count("FIVE_150") if pid else None,
            "three_150_count": _acc_count("THREE_150") if pid else None,
        }

        # Wallet transactions tied to this purchase id (system-wide recipients)
        def brief_qs(qs, limit=25):
            rows = []
            for tx in qs[:limit]:
                m = tx.meta or {}
                rows.append({
                    "id": tx.id,
                    "user_id": tx.user_id,
                    "amount": str(tx.amount),
                    "type": tx.type,
                    "source_type": tx.source_type,
                    "source_id": tx.source_id,
                    "meta_source": m.get("source"),
                    "meta_level": m.get("level_index"),
                    "meta_fixed": m.get("fixed"),
                    "meta_percent": m.get("percent"),
                    "orig_type": m.get("orig_type"),
                    "created_at": tx.created_at.isoformat(),
                })
            return rows

        auto3 = WalletTransaction.objects.filter(
            type="AUTOPOOL_BONUS_THREE",
            source_type="PROMO_PURCHASE_APPROVAL",
            source_id=pid
        ).order_by("-created_at") if pid else WalletTransaction.objects.none()
        auto5 = WalletTransaction.objects.filter(
            type="AUTOPOOL_BONUS_FIVE",
            source_type="PROMO_PURCHASE_APPROVAL",
            source_id=pid
        ).order_by("-created_at") if pid else WalletTransaction.objects.none()

        out["payouts_for_purchase"] = {
            "three_count": auto3.count() if pid else None,
            "five_count": auto5.count() if pid else None,
            "three_rows": brief_qs(auto3, 50) if pid else [],
            "five_rows": brief_qs(auto5, 25) if pid else [],
        }

        # Sponsor wallet evidence for this purchase
        if sponsor and pid:
            sp_qs = WalletTransaction.objects.filter(
                user_id=sponsor.id, source_type="PROMO_PURCHASE_APPROVAL", source_id=pid
            ).order_by("-created_at")
            out["sponsor_tx_for_purchase"] = brief_qs(sp_qs, 50)

        # Referral join bonuses for this user (sponsor side)
        if sponsor:
            join_qs = WalletTransaction.objects.filter(
                user_id=sponsor.id, source_type="JOIN_REFERRAL", source_id=str(user.id)
            ).order_by("-created_at")
            out["sponsor_join_bonus"] = brief_qs(join_qs, 10)

        # Audits
        try:
            from coupons.models import AuditTrail
            aud = {}
            aud["matrix_distributed_for_purchase"] = AuditTrail.objects.filter(
                action="matrix_distributed",
                metadata__source_type="PROMO_PURCHASE_APPROVAL",
                metadata__source_id=pid,
                metadata__product_key="150",
                actor=user
            ).exists() if pid else None
            aud["promo_purchase_distributed"] = AuditTrail.objects.filter(
                action="promo_purchase_distributed",
                metadata__purchase_id=int(pid or 0)
            ).exists() if pid else None
            out["audits"] = aud
        except Exception:
            out["audits"] = {}

    # Write diagnostics file
    os.makedirs(os.path.join(_BACKEND, "tmp"), exist_ok=True)
    out_path = os.path.join(_BACKEND, "tmp", f"diag_prime_case_{(uname or 'user')}_{(pid or 'na')}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, default=str, indent=2)
    print(out_path)

if __name__ == "__main__":
    main()
