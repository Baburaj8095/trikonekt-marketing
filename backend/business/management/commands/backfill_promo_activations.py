from __future__ import annotations

from decimal import Decimal
from typing import Optional

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import CustomUser
from business.models import PromoPurchase
from business.services.activation import (
    activate_150_active,
    activate_50,
    ensure_first_purchase_activation,
)


class Command(BaseCommand):
    help = "Backfill account activation and pools for users with APPROVED Promo Purchases (e.g., 150/750/759). Idempotent."

    def add_arguments(self, parser):
        parser.add_argument(
            "--user-id",
            type=int,
            help="Limit to a specific user id",
        )
        parser.add_argument(
            "--purchase-id",
            type=int,
            help="Limit to a specific PromoPurchase id",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate without writing changes",
        )
        parser.add_argument(
            "--min-price",
            type=str,
            default="0",
            help="Only process purchases with package price >= min-price (default 0)",
        )

    def handle(self, *args, **options):
        user_id: Optional[int] = options.get("user_id")
        purchase_id: Optional[int] = options.get("purchase_id")
        dry_run: bool = bool(options.get("dry_run"))
        try:
            min_price = Decimal(str(options.get("min_price") or "0"))
        except Exception:
            min_price = Decimal("0")

        qs = PromoPurchase.objects.select_related("user", "package").filter(status="APPROVED")
        if user_id:
            qs = qs.filter(user_id=user_id)
        if purchase_id:
            qs = qs.filter(id=purchase_id)

        processed = 0
        activated_any = 0
        stamped_any = 0

        for p in qs.iterator():
            try:
                price = Decimal(str(getattr(p.package, "price", "0") or "0"))
            except Exception:
                price = Decimal("0")

            if price < min_price:
                continue

            u: CustomUser = p.user
            src = {"type": "promo_purchase_backfill", "id": p.id}

            processed += 1
            did_activate = False

            if dry_run:
                # Only report what would be done
                self.stdout.write(
                    f"[DRY] PP#{p.id} user={u.id} {getattr(u,'username',None)} price={price} "
                    f"account_active={getattr(u,'account_active',None)} first={getattr(u,'first_purchase_activated_at',None)}"
                )
                continue

            try:
                with transaction.atomic():
                    # Activate 150 Active path if price >= 150
                    if price >= Decimal("150"):
                        try:
                            if activate_150_active(u, src):
                                did_activate = True
                        except Exception:
                            # keep going
                            pass
                    # Also ensure 50 pool if price >= 50
                    if price >= Decimal("50"):
                        try:
                            if activate_50(u, src, package_code="GLOBAL_50"):
                                did_activate = True
                        except Exception:
                            pass

                    # Ensure first activation stamp + account_active flag
                    try:
                        ensure_first_purchase_activation(u, src)
                    except Exception:
                        pass

                    # Force account_active True if still false (best-effort)
                    try:
                        if not getattr(u, "account_active", False):
                            u.account_active = True
                            u.save(update_fields=["account_active"])
                            stamped_any += 1
                    except Exception:
                        pass

                if did_activate:
                    activated_any += 1

                self.stdout.write(
                    f"[OK] PP#{p.id} user={u.id} {getattr(u,'username',None)} price={price} active={getattr(u,'account_active',None)}"
                )
            except Exception as e:
                self.stderr.write(f"[ERR] PP#{p.id} user={getattr(p,'user_id',None)}: {e}")

        self.stdout.write(
            f"Processed={processed}, newly_activated={activated_any}, stamped_active={stamped_any}, dry_run={dry_run}"
        )
