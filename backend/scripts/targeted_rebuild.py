import os
import sys
from pathlib import Path
from datetime import datetime

# Ensure backend on path and init Django
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402
django.setup()

from decimal import Decimal as D  # noqa: E402
from django.db import transaction  # noqa: E402
from django.db.models import Q  # noqa: E402
from accounts.models import CustomUser  # noqa: E402
from business.models import (  # noqa: E402
    AutoPoolAccount,
    SubscriptionActivation,
    PromoPurchase,
    PromoMonthlyBox,
    is_matrix_eligible,
)


def _events_150(user: CustomUser):
    out = []
    try:
        rows = (
            SubscriptionActivation.objects.filter(
                user=user, package__in=("PRIME_150_ACTIVE", "PRIME_150_REDEEM", "PRODUCT_PRIME")
            )
            .only("id", "created_at", "source_type", "source_id")
            .order_by("created_at", "id")
        )
        for r in rows:
            ts = getattr(r, "created_at", None)
            if ts:
                out.append(
                    (
                        ts,
                        "P150",
                        str(getattr(r, "source_type", "") or "SUB_ACT"),
                        f"SUB_ACT:{getattr(r, 'id', None)}:{getattr(r, 'source_id', '')}",
                    )
                )
    except Exception:
        pass
    return out


def _events_750(user: CustomUser):
    out = []
    try:
        rows = (
            PromoPurchase.objects.filter(user=user, status="APPROVED")
            .filter(
                Q(package__code__iexact="PRIME750")
                | Q(package__code__iexact="RS750")
                | Q(package__code__iexact="PRIME_750")
            )
            .only("id", "requested_at", "approved_at")
            .order_by("approved_at", "requested_at", "id")
        )
        for r in rows:
            ts = getattr(r, "approved_at", None) or getattr(r, "requested_at", None)
            if ts:
                out.append((ts, "P750", "PROMO_PURCHASE", f"PP:{getattr(r, 'id', None)}"))
    except Exception:
        pass
    return out


def _event_759_first(user: CustomUser):
    try:
        r = (
            PromoMonthlyBox.objects.filter(user=user)
            .only("id", "created_at")
            .order_by("created_at", "id")
            .first()
        )
        if r and getattr(r, "created_at", None):
            return (r.created_at, "P759", "MONTHLY_BOX", f"PMB:{getattr(r, 'id', None)}")
    except Exception:
        pass
    return None


def _gather_events(user: CustomUser):
    evs = []
    evs.extend(_events_150(user))
    evs.extend(_events_750(user))
    e759 = _event_759_first(user)
    if e759:
        evs.append(e759)
    cleaned = []
    for (ts, kind, st, sid) in evs:
        if ts is None:
            continue
        cleaned.append((ts, str(kind or ""), str(st or ""), str(sid or "")))
    cleaned.sort(key=lambda x: (x[0], x[1], x[3]))
    return cleaned


def _amounts_for(kind: str):
    if kind == "P150":
        return D("150.00"), D("150.00")
    if kind == "P750":
        return D("750.00"), D("750.00")
    if kind == "P759":
        return D("759.00"), D("759.00")
    return D("150.00"), D("150.00")


def _counts_for(user: CustomUser):
    out = {}
    for pool in ("FIVE_150", "THREE_150"):
        c = {
            "ACTIVE": AutoPoolAccount.objects.filter(owner=user, pool_type=pool, status="ACTIVE").count(),
            "CLOSED": AutoPoolAccount.objects.filter(owner=user, pool_type=pool, status="CLOSED").count(),
            "PENDING": AutoPoolAccount.objects.filter(owner=user, pool_type=pool, status="PENDING").count(),
        }
        c["TOTAL"] = sum(c.values())
        out[pool] = c
    return out


def targeted_rebuild_user(user: CustomUser, create_three=True, create_five=True, dry_run=False):
    if not is_matrix_eligible(user):
        return {"username": user.username, "user_id": user.id, "skipped": "not_eligible"}

    evs = _gather_events(user)
    if not evs:
        return {"username": user.username, "user_id": user.id, "skipped": "no_events"}

    result = {
        "username": user.username,
        "user_id": user.id,
        "events": [{"ts": str(ts), "kind": k, "src": sid} for (ts, k, _, sid) in evs],
        "pre_counts": _counts_for(user),
        "post_counts": None,
        "created": {"THREE_150": 0, "FIVE_150": 0},
    }
    result["errors"] = []

    if dry_run:
        return result

    with transaction.atomic():
        # Close only this user's non-sentinel ACTIVE entries in selected pools
        pools = []
        if create_three:
            pools.append("THREE_150")
        if create_five:
            pools.append("FIVE_150")
        if pools:
            AutoPoolAccount.objects.filter(
                owner=user, pool_type__in=pools, status="ACTIVE"
            ).exclude(parent_account__isnull=True).update(status="CLOSED")

        # Re-create per ordered events
        for idx, (ts, kind, stype, sid) in enumerate(evs, start=1):
            amt3, amt5 = _amounts_for(kind)
            src_type = f"TGT_REBUILD_{kind}"
            src_id = f"{sid}|user:{user.id}|seq:{idx}"
            if create_three:
                try:
                    AutoPoolAccount.place_in_three_pool(
                        user,
                        "THREE_150",
                        amt3,
                        source_type=src_type,
                        source_id=src_id,
                    )
                    result["created"]["THREE_150"] += 1
                except Exception as e:
                    result.setdefault("errors", []).append(f"THREE_150:{e}")
            if create_five:
                try:
                    AutoPoolAccount.place_in_five_pool(
                        user,
                        "FIVE_150",
                        amt5,
                        source_type=src_type,
                        source_id=src_id,
                    )
                    result["created"]["FIVE_150"] += 1
                except Exception as e:
                    result.setdefault("errors", []).append(f"FIVE_150:{e}")

    result["post_counts"] = _counts_for(user)
    return result


def main():
    # parse flags and usernames from argv
    args = [x for x in sys.argv[1:] if x.strip()]
    flags = {a for a in args if a.startswith("--")}
    names = [a for a in args if not a.startswith("--")]

    if not names:
        names = ["9880125300", "9945846318"]

    # options
    create_three = "--five-only" not in flags
    create_five = "--three-only" not in flags
    dry_run = "--dry-run" in flags

    out = []
    for uname in names:
        u = CustomUser.objects.filter(username=uname).first()
        if not u:
            out.append({"username": uname, "found": False})
            continue
        res = targeted_rebuild_user(u, create_three=create_three, create_five=create_five, dry_run=dry_run)
        out.append(res)

    logs_root = Path(__file__).resolve().parents[2] / "logs"
    logs_root.mkdir(parents=True, exist_ok=True)
    p = logs_root / f"targeted_rebuild_{int(datetime.now().timestamp())}.json"
    try:
        import json

        p.write_text(json.dumps(out, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        print(f"WROTE {p}")
    except Exception:
        print(out)


if __name__ == "__main__":
    main()
