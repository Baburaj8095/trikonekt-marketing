import json
from datetime import timedelta
from decimal import Decimal as D

from django.core.management.base import BaseCommand
from django.utils import timezone

from business.models import PromoPurchase, SubscriptionActivation
from accounts.models import WalletTransaction
from coupons.models import AuditTrail, CouponCode


class Command(BaseCommand):
    help = "Prints detailed debug info for PromoPurchase approvals (wallet, audits, activations, allocations). Usage: python manage.py debug_promo_approve 41 45"

    def add_arguments(self, parser):
        parser.add_argument("purchase_ids", nargs="+", type=int, help="PromoPurchase IDs to inspect")

    def handle(self, *args, **options):
        pids = options["purchase_ids"]
        now = timezone.now()
        window_hours = 48  # search window for related audit/tx entries
        since = now - timedelta(hours=window_hours)

        out = []
        for pid in pids:
            item = {"purchase_id": pid, "exists": False}
            try:
                p = (
                    PromoPurchase.objects.select_related("user", "package")
                    .filter(id=pid)
                    .first()
                )
                if not p:
                    out.append(item)
                    continue

                u = p.user
                pkg = p.package
                item["exists"] = True
                item["status"] = p.status
                item["user_id"] = u.id
                item["username"] = u.username
                item["pkg_type"] = getattr(pkg, "type", None)
                item["pkg_code"] = getattr(pkg, "code", None)
                item["pkg_price"] = str(getattr(pkg, "price", None))
                item["quantity"] = int(getattr(p, "quantity", 1) or 1)
                item["prime150_choice"] = getattr(p, "prime150_choice", None)
                item["prime750_choice"] = getattr(p, "prime750_choice", None)
                item["approved_at"] = getattr(p, "approved_at", None)
                item["approved_by"] = getattr(getattr(p, "approved_by", None), "username", None)

                # Allocations snapshot
                try:
                    item["assigned_150_count"] = int(
                        CouponCode.objects.filter(
                            assigned_consumer=u, value=D("150.00")
                        ).count()
                    )
                    item["assigned_759_count"] = int(
                        CouponCode.objects.filter(
                            assigned_consumer=u, value=D("759.00")
                        ).count()
                    )
                    # Recent sample codes (for visibility only)
                    item["assigned_150_sample"] = list(
                        CouponCode.objects.filter(assigned_consumer=u, value=D("150.00"))
                        .order_by("-id")
                        .values_list("code", flat=True)[:5]
                    )
                    item["assigned_759_sample"] = list(
                        CouponCode.objects.filter(assigned_consumer=u, value=D("759.00"))
                        .order_by("-id")
                        .values_list("code", flat=True)[:5]
                    )
                except Exception:
                    item["assigned_150_count"] = None
                    item["assigned_759_count"] = None

                # Wallet transactions (recent)
                try:
                    wtx = list(
                        WalletTransaction.objects.filter(user=u, created_at__gte=since)
                        .order_by("-created_at")
                        .values("type", "amount", "created_at", "meta")[:50]
                    )
                    item["wallet_recent"] = wtx
                except Exception:
                    item["wallet_recent"] = []

                # Subscription activations (recent)
                try:
                    subs = list(
                        SubscriptionActivation.objects.filter(user=u, created_at__gte=since)
                        .order_by("-created_at")
                        .values("package", "source_type", "source_id", "amount", "created_at", "metadata")[:50]
                    )
                    item["subscriptions_recent"] = subs
                except Exception:
                    item["subscriptions_recent"] = []

                # Approval/audit trail
                try:
                    # Purchase-scoped audits (by metadata.purchase_id)
                    audits_purchase = list(
                        AuditTrail.objects.filter(metadata__purchase_id=pid)
                        .order_by("created_at")
                        .values("action", "created_at", "notes", "metadata")[:100]
                    )

                    # User-scoped debug audits around the time window (debug_* actions)
                    audits_debug_user = list(
                        AuditTrail.objects.filter(
                            actor=u,
                            action__istartswith="debug_",
                            created_at__gte=since,
                        )
                        .order_by("created_at")
                        .values("action", "created_at", "notes", "metadata")[:100]
                    )

                    item["audits_by_purchase"] = audits_purchase
                    item["audits_debug_user"] = audits_debug_user
                except Exception:
                    item["audits_by_purchase"] = []
                    item["audits_debug_user"] = []

                # Quick flags from latest approval audit, if any
                try:
                    latest_alloc = (
                        AuditTrail.objects.filter(
                            action="promo_purchase_approved_allocated",
                            metadata__purchase_id=pid,
                        )
                        .order_by("-created_at")
                        .first()
                    )
                    if latest_alloc:
                        md = latest_alloc.metadata or {}
                        item["approval_flags"] = {
                            "ebooks_granted": md.get("ebooks_granted"),
                            "allocated": md.get("allocated"),
                            "allocated_759": md.get("allocated_759"),
                            "heavy_skipped": md.get("heavy_skipped"),
                            "credited_750": md.get("credited_750"),
                            "credited_150_redeem": md.get("credited_150_redeem"),
                            "activated150_active": md.get("activated150_active"),
                            "activated50": md.get("activated50"),
                            "skip_allocation": md.get("skip_allocation"),
                            "is_prime_150": md.get("is_prime_150"),
                            "is_prime_750": md.get("is_prime_750"),
                            "duration_ms": md.get("duration_ms"),
                            "sample_codes": md.get("sample_codes"),
                        }
                except Exception:
                    pass

            except Exception as e:
                item["error"] = str(e)

            out.append(item)

        self.stdout.write(json.dumps(out, default=str, indent=2))
