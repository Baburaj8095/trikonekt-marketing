from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from accounts.models import CustomUser
from business.models import (
    PromoPurchase,
    Promo759Subscription,
    SubscriptionActivation,
    is_matrix_eligible,
)


def _pp_ts(pp: PromoPurchase) -> Optional[datetime]:
    """
    Best-effort event timestamp for a PromoPurchase row (approved_at preferred, else requested_at).
    """
    t = getattr(pp, "approved_at", None) or getattr(pp, "requested_at", None)
    return t


def _is_prime_code(pp: PromoPurchase, code: str) -> bool:
    try:
        c = str(getattr(getattr(pp, "package", None), "code", "") or "").upper()
        return c == code.upper()
    except Exception:
        return False


def _is_prime_150(pp: PromoPurchase) -> bool:
    # By code
    if _is_prime_code(pp, "PRIME150"):
        return True
    # Fallback: type=PRIME and price≈150
    try:
        typ = str(getattr(pp.package, "type", "") or "").upper()
        if typ != "PRIME":
            return False
        from decimal import Decimal as D
        price = D(str(getattr(pp.package, "price", "0") or "0"))
        return abs(price - D("150")) <= D("0.5")
    except Exception:
        return False


def _is_prime_750(pp: PromoPurchase) -> bool:
    if _is_prime_code(pp, "PRIME750"):
        return True
    try:
        typ = str(getattr(pp.package, "type", "") or "").upper()
        if typ != "PRIME":
            return False
        from decimal import Decimal as D
        price = D(str(getattr(pp.package, "price", "0") or "0"))
        return abs(price - D("750")) <= D("0.5")
    except Exception:
        return False


def _is_prime_759(pp: PromoPurchase) -> bool:
    if _is_prime_code(pp, "PRIME759"):
        return True
    try:
        typ = str(getattr(pp.package, "type", "") or "").upper()
        if typ != "PRIME":
            return False
        from decimal import Decimal as D
        price = D(str(getattr(pp.package, "price", "0") or "0"))
        return abs(price - D("759")) <= D("0.75")
    except Exception:
        return False


def _pkg_type(pp: PromoPurchase) -> str:
    try:
        return str(getattr(pp.package, "type", "") or "").upper()
    except Exception:
        return ""


class Command(BaseCommand):
    help = (
        "Explain why some approved PromoPurchase rows are excluded from rebuild_prime_matrices events.\n"
        "Outputs a JSON report mapping included first-time events and excluded approved purchases with reasons.\n"
        "\n"
        "Usage:\n"
        "  python manage.py explain_prime_rebuild_selection --out=backend/logs/explain_prime_rebuild.json\n"
        "Options:\n"
        "  --only-user-ids=CSV  Limit to specific user IDs (e.g., 101,102)\n"
        "  --status=APPROVED    Filter PromoPurchase by status (default APPROVED)\n"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--only-user-ids",
            type=str,
            default="",
            help="Optional CSV of user IDs to limit scope (e.g., 136,101,125)",
        )
        parser.add_argument(
            "--status",
            type=str,
            default="APPROVED",
            help="PromoPurchase.status filter (default APPROVED)",
        )
        parser.add_argument(
            "--out",
            type=str,
            default="",
            help="Write JSON report to this path. Defaults to backend/logs/explain_prime_rebuild.json",
        )

    def handle(self, *args, **options):
        status_in = str(options.get("status") or "APPROVED").strip().upper()
        only_ids_raw = str(options.get("only_user_ids") or "").strip()
        only_ids: Optional[List[int]] = None
        if only_ids_raw:
            try:
                only_ids = [int(tok.strip()) for tok in only_ids_raw.split(",") if tok.strip()]
            except Exception:
                only_ids = None

        # Load approved promo purchases as shown in admin
        qs = PromoPurchase.objects.select_related("user", "package")
        if status_in:
            qs = qs.filter(status=status_in)
        if only_ids:
            qs = qs.filter(user_id__in=only_ids)
        pp_rows: List[PromoPurchase] = list(qs.order_by("user_id", "approved_at", "requested_at", "id"))

        total_pp = len(pp_rows)

        # Pre-compute earliest per-user first-time timestamps for 150/750/759
        first150: Dict[int, datetime] = {}
        first750: Dict[int, datetime] = {}
        first759: Dict[int, datetime] = {}

        # Collect candidate timestamps from both PromoPurchase and SubscriptionActivation/Promo759Subscription
        # 150: earliest of PRIME150 PromoPurchase (approved/requested) and SubscriptionActivation packages: PRIME_150_ACTIVE, PRIME_150_REDEEM, PRODUCT_PRIME
        for u_id in sorted({int(getattr(pp, "user_id", 0) or 0) for pp in pp_rows}):
            if not u_id:
                continue
            # 150
            t_list_150: List[datetime] = []
            try:
                # PP PRIME150
                for pp in PromoPurchase.objects.select_related("package").filter(user_id=u_id, status=status_in):
                    if _is_prime_150(pp):
                        t = _pp_ts(pp)
                        if t:
                            t_list_150.append(t)
            except Exception:
                pass
            try:
                # SubscriptionActivation
                acts = (
                    SubscriptionActivation.objects.filter(
                        user_id=u_id,
                        package__in=("PRIME_150_ACTIVE", "PRIME_150_REDEEM", "PRODUCT_PRIME"),
                    )
                    .order_by("created_at")
                    .values_list("created_at", flat=True)
                )
                for t in acts:
                    if t:
                        t_list_150.append(t)
            except Exception:
                pass
            if t_list_150:
                t_list_150.sort()
                first150[u_id] = t_list_150[0]

            # 750
            t_list_750: List[datetime] = []
            try:
                for pp in PromoPurchase.objects.select_related("package").filter(user_id=u_id, status=status_in):
                    if _is_prime_750(pp):
                        t = _pp_ts(pp)
                        if t:
                            t_list_750.append(t)
            except Exception:
                pass
            if t_list_750:
                t_list_750.sort()
                first750[u_id] = t_list_750[0]

            # 759: prefer Promo759Subscription.active_from, else PRIME759 PromoPurchase
            t_list_759: List[datetime] = []
            try:
                sub = (
                    Promo759Subscription.objects.filter(user_id=u_id)
                    .order_by("active_from", "id")
                    .values_list("active_from", flat=True)
                    .first()
                )
                if sub:
                    t_list_759.append(sub)
            except Exception:
                pass
            try:
                for pp in PromoPurchase.objects.select_related("package").filter(user_id=u_id, status=status_in):
                    if _is_prime_759(pp):
                        t = _pp_ts(pp)
                        if t:
                            t_list_759.append(t)
            except Exception:
                pass
            if t_list_759:
                t_list_759.sort()
                first759[u_id] = t_list_759[0]

        # Helper: check eligibility
        def _eligible(uid: int) -> bool:
            try:
                u = CustomUser.objects.only("id", "category", "is_staff", "is_superuser").get(pk=uid)
            except Exception:
                return False
            try:
                return bool(is_matrix_eligible(u))
            except Exception:
                return False

        # Summaries
        included_events: Dict[str, List[Dict[str, Any]]] = {"150": [], "750": [], "759": []}
        excluded_pp: List[Dict[str, Any]] = []

        # Track which (user, product) got included (to avoid double counting)
        seen_included: set[Tuple[int, str]] = set()

        # Iterate all approved PromoPurchase rows and label as included/excluded
        for pp in pp_rows:
            uid = int(getattr(pp, "user_id", 0) or 0)
            pid = int(getattr(pp, "id", 0) or 0)
            pkg_type = _pkg_type(pp)
            ts = _pp_ts(pp)
            code = str(getattr(getattr(pp, "package", None), "code", "") or "")

            # Monthly purchases handling:
            # - MONTHLY759: include ONLY the first month (first activation) as a 759 seat
            # - Other MONTHLY packages: excluded from prime matrices
            if pkg_type == "MONTHLY":
                # Flag monthly box >= 2 if detectable
                monthly_detail = {}
                try:
                    number = int(getattr(pp, "package_number", 1) or 1)
                except Exception:
                    number = 1
                try:
                    boxes = list(getattr(pp, "boxes_json", []) or [])
                except Exception:
                    boxes = []
                has_box_2plus = False
                for b in boxes:
                    try:
                        if int(b) >= 2:
                            has_box_2plus = True
                            break
                    except Exception:
                        continue
                monthly_detail = {
                    "package_number": number,
                    "boxes_len": len(boxes),
                    "boxes_has_2plus": bool(has_box_2plus),
                }
                # Special rule: MONTHLY759 — include ONLY the first month (first activation) as a 759 seat
                if str(code or "").upper() == "MONTHLY759":
                    ft = first759.get(uid)
                    if ts and ft and ts == ft and (uid, "759") not in seen_included and _eligible(uid):
                        included_events["759"].append(
                            {
                                "user_id": uid,
                                "product": "759",
                                "purchase_id": pid,
                                "ts": ts.isoformat(),
                                "via": "promopurchase_monthly",
                            }
                        )
                        seen_included.add((uid, "759"))
                    else:
                        excluded_pp.append(
                            {
                                "purchase_id": pid,
                                "user_id": uid,
                                "package_code": code,
                                "type": "MONTHLY",
                                "product": "759",
                                "ts": (ts.isoformat() if ts else None),
                                "reason": "monthly_759_not_first",
                                "first_event_ts": ft.isoformat() if (ft is not None and hasattr(ft, "isoformat")) else (str(ft) if ft else None),
                                "detail": monthly_detail,
                            }
                        )
                else:
                    excluded_pp.append(
                        {
                            "purchase_id": pid,
                            "user_id": uid,
                            "package_code": code,
                            "type": "MONTHLY",
                            "ts": (ts.isoformat() if ts else None),
                            "reason": "monthly_package_excluded",
                            "detail": monthly_detail,
                        }
                    )
                continue

            if pkg_type != "PRIME":
                excluded_pp.append(
                    {
                        "purchase_id": pid,
                        "user_id": uid,
                        "package_code": code,
                        "type": pkg_type or "",
                        "ts": (ts.isoformat() if ts else None),
                        "reason": "non_prime_package",
                    }
                )
                continue

            # Map to product key among {"150","750","759"}; otherwise exclude as other prime
            prod: Optional[str] = None
            if _is_prime_150(pp):
                prod = "150"
            elif _is_prime_750(pp):
                prod = "750"
            elif _is_prime_759(pp):
                prod = "759"

            if prod is None:
                excluded_pp.append(
                    {
                        "purchase_id": pid,
                        "user_id": uid,
                        "package_code": code,
                        "type": pkg_type or "",
                        "ts": (ts.isoformat() if ts else None),
                        "reason": "prime_other_excluded",
                    }
                )
                continue

            # Eligibility filter
            if not _eligible(uid):
                excluded_pp.append(
                    {
                        "purchase_id": pid,
                        "user_id": uid,
                        "package_code": code,
                        "type": pkg_type or "",
                        "product": prod,
                        "ts": (ts.isoformat() if ts else None),
                        "reason": "user_ineligible",
                    }
                )
                continue

            # NEW: include all PRIME150/PRIME750 purchases (each purchase seats)
            if prod in ("150", "750"):
                included_events[prod].append(
                    {
                        "user_id": uid,
                        "product": prod,
                        "purchase_id": pid,
                        "ts": (ts.isoformat() if ts else None),
                        "via": "promopurchase",
                    }
                )
                continue
            # Compare with earliest first-time event per product
            ft: Optional[datetime] = None
            if prod == "150":
                ft = first150.get(uid)
            elif prod == "750":
                ft = first750.get(uid)
            elif prod == "759":
                ft = first759.get(uid)

            if not ft:
                # No first-time event detected for this user/product; this PP does not drive a seat
                excluded_pp.append(
                    {
                        "purchase_id": pid,
                        "user_id": uid,
                        "package_code": code,
                        "type": pkg_type or "",
                        "product": prod,
                        "ts": (ts.isoformat() if ts else None),
                        "reason": "no_first_event_detected",
                    }
                )
                continue

            # If this PP timestamp equals the earliest timestamp, mark included only once per (user,product)
            # Allow exact equality; if another source (SubscriptionActivation/Promo759Subscription) is earlier,
            # this PP is excluded as not-first.
            same = (ts == ft) if (ts and ft) else False
            if same and (uid, prod) not in seen_included:
                included_events[prod].append(
                    {
                        "user_id": uid,
                        "product": prod,
                        "purchase_id": pid,
                        "ts": ts.isoformat(),
                        "via": "promopurchase",
                    }
                )
                seen_included.add((uid, prod))
            else:
                # Distinguish if first event comes from activation/subscription vs another PromoPurchase
                first_via = "unknown"
                if prod == "150":
                    # If earliest FT does not match any PRIME150 PP ts, assume via SubscriptionActivation
                    has_match = PromoPurchase.objects.select_related("package").filter(
                        user_id=uid, status=status_in
                    ).filter(
                        Q(package__code__iexact="PRIME150") |
                        (Q(package__type="PRIME") & Q(package__price__gte=149.5) & Q(package__price__lte=150.5))
                    ).filter(
                        Q(approved_at=ft) | Q(requested_at=ft)
                    ).exists()
                    first_via = "promopurchase" if has_match else "activation"
                elif prod == "759":
                    # Prefer subscription
                    sub_match = Promo759Subscription.objects.filter(user_id=uid, active_from=ft).exists()
                    if sub_match:
                        first_via = "subscription_759"
                    else:
                        has_match = PromoPurchase.objects.select_related("package").filter(
                            user_id=uid, status=status_in
                        ).filter(
                            Q(package__code__iexact="PRIME759") |
                            (Q(package__type="PRIME") & Q(package__price__gte=758.25) & Q(package__price__lte=759.75))
                        ).filter(
                            Q(approved_at=ft) | Q(requested_at=ft)
                        ).exists()
                        first_via = "promopurchase" if has_match else "subscription_759"
                else:
                    # 750: earliest is always from PP
                    first_via = "promopurchase"

                excluded_pp.append(
                    {
                        "purchase_id": pid,
                        "user_id": uid,
                        "package_code": code,
                        "type": pkg_type or "",
                        "product": prod,
                        "ts": (ts.isoformat() if ts else None),
                        "reason": "not_first_event",
                        "first_event_ts": ft.isoformat() if ft else None,
                        "first_event_via": first_via,
                    }
                )

        # Build a compact summary
        included_count = sum(len(v) for v in included_events.values())
        out = {
            "filters": {
                "status": status_in,
                "only_user_ids": only_ids or [],
            },
            "totals": {
                "approved_promopurchases": int(total_pp),
                "included_first_time_events": int(included_count),
                "by_product_included": {k: len(v) for k, v in included_events.items()},
                "excluded_rows": int(len(excluded_pp)),
            },
            "included_events": included_events,
            "excluded_purchases": excluded_pp[:1000],  # cap to keep file reasonable
        }

        # Decide output path
        out_opt = str(options.get("out") or "").strip()
        if out_opt:
            out_path = Path(out_opt)
            out_path.parent.mkdir(parents=True, exist_ok=True)
        else:
            # default: backend/logs/explain_prime_rebuild.json (best-effort)
            try:
                base_dir = None
                for p in Path(__file__).resolve().parents:
                    if p.name == "backend":
                        base_dir = p
                        break
                if base_dir is None:
                    base_dir = Path.cwd()
                logs = base_dir / "logs"
                logs.mkdir(parents=True, exist_ok=True)
                out_path = logs / "explain_prime_rebuild.json"
            except Exception:
                out_path = Path("explain_prime_rebuild.json")

        try:
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(out, f, ensure_ascii=False, indent=2, default=str)
            self.stdout.write(self.style.SUCCESS(f"Wrote report -> {out_path}"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Failed to write report: {e}"))

        # Also print a short console summary
        self.stdout.write(self.style.NOTICE("Summary:"))
        self.stdout.write(f"  Approved PromoPurchases: {total_pp}")
        self.stdout.write(f"  Included first-time events (unique user×product): {included_count} (150={len(included_events['150'])}, 750={len(included_events['750'])}, 759={len(included_events['759'])})")
        self.stdout.write(f"  Excluded purchase rows (see JSON for reasons): {len(excluded_pp)}")
