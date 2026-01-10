import os
import sys
import json
from decimal import Decimal

# Ensure backend/ is on sys.path so 'core' package is importable
_CUR = os.path.dirname(__file__)
_BACKEND_DIR = os.path.abspath(os.path.join(_CUR, ".."))
_PROJECT_ROOT = os.path.abspath(os.path.join(_CUR, "..", ".."))
for p in (_BACKEND_DIR, _PROJECT_ROOT):
    if p not in sys.path:
        sys.path.append(p)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402
django.setup()

from django.utils import timezone  # noqa: E402
from accounts.models import CustomUser, AgencyRegionAssignment, WalletTransaction  # noqa: E402
from coupons.models import CouponCode, AuditTrail  # noqa: E402
from jobs.models import BackgroundTask  # noqa: E402


REQUIRED_LAYERS = [
    "Sub Franchise",
    "Pincode",
    "Pincode Coord",
    "District",
    "District Coord",
    "State",
    "State Coord",
]


def _brief_tx(tx):
    meta = tx.meta or {}
    return {
        "id": tx.id,
        "user_id": tx.user_id,
        "amount": str(tx.amount),
        "type": tx.type,
        "source_type": tx.source_type,
        "source_id": tx.source_id,
        "meta_layer": meta.get("layer"),
        "meta_source": meta.get("source"),
        "created_at": tx.created_at.isoformat(),
    }


def find_latest_ecoupon(value_str: str):
    try:
        return (
            CouponCode.objects.filter(
                issued_channel="e_coupon",
                value=Decimal(value_str),
                assigned_consumer__isnull=False,
            )
            .order_by("-created_at", "-id")
            .first()
        )
    except Exception:
        return None


def seed_pincode_assignments_for_user(user: CustomUser):
    """
    Ensure pincode-level agency role assignments exist for the user's pincode:
      - agency_sub_franchise
      - agency_pincode
      - agency_pincode_coordinator
    Picks the first available in same state (preferred) or any if none.
    Idempotent via unique constraints on AgencyRegionAssignment.
    """
    if not user:
        return {"ok": False, "error": "no_user"}
    pin = (user.pincode or "").strip()
    if not pin:
        return {"ok": False, "error": "user_missing_pincode"}
    state = getattr(user, "state", None)

    roles = [
        ("Sub Franchise", "agency_sub_franchise"),
        ("Pincode", "agency_pincode"),
        ("Pincode Coord", "agency_pincode_coordinator"),
    ]
    created = []
    resolved = {}

    for label, cat in roles:
        qs = CustomUser.objects.filter(category=cat).order_by("id")
        agency = None
        if state:
            agency = qs.filter(state=state).first() or qs.first()
        else:
            agency = qs.first()
        resolved[label] = agency.id if agency else None
        if not agency:
            continue
        obj, was_created = AgencyRegionAssignment.objects.get_or_create(
            user=agency,
            level="pincode",
            pincode=pin,
            defaults={"state": state},
        )
        if was_created:
            created.append({"label": label, "agency_id": agency.id, "assignment_id": obj.id, "pin": pin})
    return {"ok": True, "created": created, "resolved": resolved}


def run_activation_for_code(code: CouponCode, product: str):
    """
    Enqueue and run coupon_activate task for the given code and product ('150' or '759').
    """
    uid = code.assigned_consumer_id
    try:
        task = BackgroundTask.enqueue(
            task_type="coupon_activate",
            payload={"user_id": int(uid), "type": product, "source": {"id": code.id, "channel": "e_coupon"}},
            idempotency_key=f"coupon_activate:{uid}:{product}:{code.id}",
        )
        t = BackgroundTask.objects.get(id=task.id)
        t.run()
        return {
            "id": t.id,
            "type": t.type,
            "status": t.status,
            "attempts": t.attempts,
            "max_attempts": t.max_attempts,
            "last_error": t.last_error,
            "payload": t.payload,
        }
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}


def verify_150(code: CouponCode):
    sid = str(code.id)
    out = {"product": "150", "coupon_id": code.id}

    # Direct and Self bonuses (ECOUPON)
    direct = WalletTransaction.objects.filter(type="DIRECT_REF_BONUS", source_type="ECOUPON", source_id=sid).order_by("-created_at")
    selfb = WalletTransaction.objects.filter(type="SELF_BONUS_ACTIVE", source_type="ECOUPON", source_id=sid).order_by("-created_at")
    out["direct_present"] = direct.exists()
    out["self_present"] = selfb.exists()
    out["direct_rows"] = [_brief_tx(tx) for tx in direct[:10]]
    out["self_rows"] = [_brief_tx(tx) for tx in selfb[:10]]

    # Matrix payouts (ECOUPON)
    five = WalletTransaction.objects.filter(type="AUTOPOOL_BONUS_FIVE", source_type="ECOUPON", source_id=sid).order_by("-created_at")
    three = WalletTransaction.objects.filter(type="AUTOPOOL_BONUS_THREE", source_type="ECOUPON", source_id=sid).order_by("-created_at")
    out["matrix_five_count"] = five.count()
    out["matrix_three_count"] = three.count()
    out["matrix_five_rows"] = [_brief_tx(tx) for tx in five[:10]]
    out["matrix_three_rows"] = [_brief_tx(tx) for tx in three[:10]]

    # Geo payouts (ECOUPON_150) with layer coverage
    geo = WalletTransaction.objects.filter(type="COMMISSION_CREDIT", source_type="ECOUPON_150", source_id=sid).order_by("-created_at")
    rows = [_brief_tx(tx) for tx in geo[:50]]
    out["geo_rows"] = [r for r in rows if str(r.get("meta_source") or "").startswith("AUTO_POOL_GEO")]
    present = {layer: any(r.get("meta_layer") == layer for r in out["geo_rows"]) for layer in REQUIRED_LAYERS}
    out["geo_layer_presence"] = present
    out["geo_count"] = len(out["geo_rows"])
    return out


def verify_759(code: CouponCode):
    sid = str(code.id)
    out = {"product": "759", "coupon_id": code.id}

    # Direct and optional Self (ECOUPON_759)
    direct = WalletTransaction.objects.filter(type="MONTHLY_759_DIRECT", source_type="ECOUPON_759", source_id=sid).order_by("-created_at")
    selfb = WalletTransaction.objects.filter(type="MONTHLY_759_SELF", source_type="ECOUPON_759", source_id=sid).order_by("-created_at")
    out["direct_present"] = direct.exists()
    out["self_present"] = selfb.exists()
    out["direct_rows"] = [_brief_tx(tx) for tx in direct[:10]]
    out["self_rows"] = [_brief_tx(tx) for tx in selfb[:10]]

    # L1..L5 fixed levels (ECOUPON_759)
    level = WalletTransaction.objects.filter(type="MONTHLY_759_LEVEL", source_type="ECOUPON_759", source_id=sid).order_by("-created_at")
    out["levels_count"] = level.count()
    out["levels_rows"] = [_brief_tx(tx) for tx in level[:20]]

    # Geo payouts (ECOUPON_759) with layer coverage
    geo = WalletTransaction.objects.filter(type="COMMISSION_CREDIT", source_type="ECOUPON_759", source_id=sid).order_by("-created_at")
    rows = [_brief_tx(tx) for tx in geo[:50]]
    out["geo_rows"] = [r for r in rows if str(r.get("meta_source") or "").startswith("AUTO_POOL_GEO")]
    present = {layer: any(r.get("meta_layer") == layer for r in out["geo_rows"]) for layer in REQUIRED_LAYERS}
    out["geo_layer_presence"] = present
    out["geo_count"] = len(out["geo_rows"])
    return out


def main():
    out = {"ok": True, "now": timezone.now().isoformat()}
    product = None
    if len(sys.argv) >= 2:
        product = str(sys.argv[1]).strip()
    if product not in ("150", "759"):
        out["ok"] = False
        out["error"] = "usage: verify_coupon_activation_full.py [150|759]"
        print(json.dumps(out))
        return

    code = find_latest_ecoupon(product)
    if not code:
        out["ok"] = False
        out["error"] = f"no_ecoupon_{product}_found"
        print(json.dumps(out))
        return

    out["code"] = {
        "id": code.id,
        "code": code.code,
        "value": str(code.value),
        "status": code.status,
        "owner_id": code.assigned_consumer_id,
        "issued_channel": getattr(code, "issued_channel", None),
    }

    # Ensure pincode-level agency assignments for the test user (idempotent)
    try:
        consumer = code.assigned_consumer
        out["seed_assignments"] = seed_pincode_assignments_for_user(consumer)
    except Exception as e:
        out["seed_assignments_error"] = f"{type(e).__name__}: {e}"

    # Trigger activation for this coupon/value
    out["task"] = run_activation_for_code(code, product)

    # Record audits presence for reference
    key_map = {
        "150": ["prime_150_distributed", "prime_150_distribution_failed", "coupon_matrix_distributed", "monthly_759_distributed"],
        "759": ["monthly_759_distributed", "prime_150_distributed", "coupon_activated"],
    }
    keys = key_map.get(product, [])
    try:
        out["audits_presence"] = {k: AuditTrail.objects.filter(action=k, coupon_code_id=code.id).exists() for k in keys}
        out["audits_rows"] = list(
            AuditTrail.objects.filter(coupon_code_id=code.id).order_by("-created_at").values("action", "created_at", "notes", "metadata")[:50]
        )
    except Exception as e:
        out["audits_error"] = f"{type(e).__name__}: {e}"

    # Verification by product
    try:
        if product == "150":
            out["verify"] = verify_150(code)
        else:
            out["verify"] = verify_759(code)
    except Exception as e:
        out["verify_error"] = f"{type(e).__name__}: {e}"

    # Write diagnostics file
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tmp"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"verify_activation_full_{product}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, default=str, indent=2)
    print(out_path)


if __name__ == "__main__":
    main()
