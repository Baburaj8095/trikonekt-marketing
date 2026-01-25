from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from decimal import Decimal
from typing import Optional

from accounts.models import CustomUser
from business.models import PromoPackage, PromoPurchase
from coupons.models import ECouponOrder, ECouponProduct, ECouponPaymentConfig
from notifications.models import Notification


class Command(BaseCommand):
    help = "Create a PRIME or E-COUPON purchase intent for a TR consumer and route approval to admin."

    def add_arguments(self, parser):
        parser.add_argument(
            "username",
            type=str,
            help="TR consumer username (e.g., TR1010000038)",
        )
        parser.add_argument(
            "product_key",
            type=str,
            help="One of: Prime150 | Prime750 | Season759 | Coupon150 | ECoupon759",
        )

    def handle(self, *args, **options):
        username = str(options["username"]).strip()
        raw_key = str(options["product_key"]).strip()
        key = self._normalize_key(raw_key)

        # Alias: accept season750 as season759
        if key == "season750":
            key = "season759"

        user = self._get_consumer_user(username)
        if not user:
            raise CommandError(f"User not found or not a valid consumer: {username}")

        # PRIME / MONTHLY purchase intent
        if key in ("prime150", "prime750", "season759"):
            obj = self._create_or_get_promo_purchase(user, key)
            path = f"/api/business/admin/promo/purchases/{obj.id}/approve/"
            self.stdout.write(self.style.SUCCESS(f"PromoPurchase id={obj.id} status={obj.status} for {user.username}"))
            self.stdout.write(f"Approval endpoint: {path}")
            self._notify_admin(
                f"Approval pending: {key} for {user.username}",
                f"Approve at {path}",
            )
            return

        # E-COUPON store order
        if key in ("coupon150", "ecoupon759"):
            obj = self._create_or_get_ecoupon_order(user, key)
            path = f"/api/v1/ecoupon/orders/{obj.id}/approve"
            self.stdout.write(self.style.SUCCESS(f"ECouponOrder id={obj.id} status={obj.status} for {user.username}"))
            self.stdout.write(f"Approval endpoint: {path}")
            self._notify_admin(
                f"Approval pending: {key} for {user.username}",
                f"Approve at {path}",
            )
            return

        raise CommandError("Unsupported product_key. Use: Prime150 | Prime750 | Season759 | Coupon150 | ECoupon759")

    # -------- Helpers --------
    def _normalize_key(self, s: str) -> str:
        k = s.lower().replace("_", "").replace("-", "").replace(" ", "")
        # common variants
        if k in ("prime150", "pr150", "p150"):
            return "prime150"
        if k in ("prime750", "pr750", "p750"):
            return "prime750"
        if k in ("season759", "prime759", "monthly759", "s759", "m759"):
            return "season759"
        if k in ("season750", "s750", "m750"):
            return "season750"  # alias; mapped to season759 above
        if k in ("coupon150", "ecoupon150", "e150", "c150"):
            return "coupon150"
        if k in ("ecoupon759", "coupon759", "e759", "c759"):
            return "ecoupon759"
        return k

    def _get_consumer_user(self, username: str) -> Optional[CustomUser]:
        u = CustomUser.objects.filter(username=username).first()
        if not u:
            return None
        # Keep permissive: downstream approval/activation enforce deeper rules
        if str(getattr(u, "category", "")).strip().lower() != "consumer":
            return None
        return u

    def _find_package(self, key: str) -> Optional[PromoPackage]:
        # Prefer code lookup; fallback to type+price (+/- 1 tolerance)
        code_variants = []
        if key == "prime150":
            code_variants = ["PRIME150", "PRIME-150", "PRIME_150", "PRIME 150"]
            target_price = Decimal("150")
            ptype = "PRIME"
        elif key == "prime750":
            code_variants = ["PRIME750", "PRIME-750", "PRIME_750", "PRIME 750"]
            target_price = Decimal("750")
            ptype = "PRIME"
        elif key == "season759":
            code_variants = ["PRIME759", "MONTHLY759", "SEASON759", "SEASON-759", "SEASON_759"]
            target_price = Decimal("759")
            ptype = "MONTHLY"
        else:
            return None

        for c in code_variants:
            pkg = PromoPackage.objects.filter(code__iexact=c, is_active=True).first()
            if pkg:
                return pkg

        pkg = PromoPackage.objects.filter(type=ptype, price=target_price, is_active=True).first()
        if pkg:
            return pkg

        lo = target_price - Decimal("1")
        hi = target_price + Decimal("1")
        return PromoPackage.objects.filter(type=ptype, price__gte=lo, price__lte=hi, is_active=True).order_by("id").first()

    def _create_or_get_promo_purchase(self, user: CustomUser, key: str) -> PromoPurchase:
        pkg = self._find_package(key)
        if not pkg:
            raise CommandError(f"PromoPackage not found for {key}. Please seed package code or expected price first.")

        qs = PromoPurchase.objects.filter(user=user, package=pkg, status="PENDING")
        prime150_choice = ""
        prime750_choice = ""
        year = None
        month = None

        if key == "prime150":
            prime150_choice = "REDEEM"
            qs = qs.filter(prime150_choice=prime150_choice)
        elif key == "prime750":
            prime750_choice = "REDEEM"
            qs = qs.filter(prime750_choice=prime750_choice)
        elif key == "season759":
            # Use legacy monthly path: current year/month to satisfy model.clean()
            today = timezone.localdate()
            year = today.year
            month = today.month
            qs = qs.filter(year=year, month=month)

        existing = qs.order_by("-id").first()
        if existing:
            return existing

        return PromoPurchase.objects.create(
            user=user,
            package=pkg,
            status="PENDING",
            quantity=1,
            prime150_choice=prime150_choice,
            prime750_choice=prime750_choice,
            year=year,
            month=month,
        )

    def _find_ecoupon_product(self, key: str) -> Optional[ECouponProduct]:
        if key == "coupon150":
            denom = Decimal("150")
        elif key == "ecoupon759":
            denom = Decimal("759")
        else:
            return None
        return (
            ECouponProduct.objects.filter(
                denomination=denom,
                enable_consumer=True,
                is_active=True,
            )
            .order_by("-id")
            .first()
        )

    def _create_or_get_ecoupon_order(self, user: CustomUser, key: str) -> ECouponOrder:
        product = self._find_ecoupon_product(key)
        if not product:
            raise CommandError(f"ECouponProduct not found or not active for {key}. Please seed the store product first.")

        qty = 1
        total = (product.price_per_unit or Decimal("0")) * Decimal(qty)
        pay_cfg = ECouponPaymentConfig.objects.filter(is_active=True).first()

        existing = ECouponOrder.objects.filter(
            buyer=user,
            product=product,
            status="SUBMITTED",
            quantity=qty,
            amount_total=total,
        ).order_by("-id").first()
        if existing:
            return existing

        return ECouponOrder.objects.create(
            buyer=user,
            role_at_purchase="consumer",
            product=product,
            denomination_snapshot=product.denomination,
            quantity=qty,
            amount_total=total,
            payment_config=pay_cfg,
            status="SUBMITTED",
        )

    def _notify_admin(self, title: str, body: str):
        try:
            admin = CustomUser.objects.filter(is_superuser=True).first()
            if not admin:
                return
            Notification.objects.create(
                user=admin,
                role_cached=getattr(admin, "role", "") or "",
                channel="in_app",
                is_broadcast=False,
                title=title,
                body=body,
                deep_link="",
                priority="normal",
            )
        except Exception:
            # best-effort notification
            pass
