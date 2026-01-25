import os
import json
from decimal import Decimal as D

# Ensure Django settings
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402
django.setup()

from django.utils import timezone  # noqa: E402
from django.db import transaction  # noqa: E402
from rest_framework.test import APIRequestFactory, force_authenticate  # noqa: E402

from accounts.models import CustomUser  # noqa: E402
from accounts.models import WalletTransaction  # noqa: E402
from business.models import CommissionConfig, PromoPackage, PromoPurchase, PromoProductOrder, Promo759Subscription, AutoPoolAccount  # noqa: E402
from coupons.models import Coupon, CouponBatch, CouponCode, AuditTrail  # noqa: E402
from business.views import AdminPromoPurchaseApproveView  # noqa: E402
from coupons.views import ECouponOrderViewSet, CouponActivateView  # noqa: E402


def ensure_admin():
    admin = CustomUser.objects.filter(username="admin_test", is_staff=True, is_superuser=True).first()
    if not admin:
        admin = CustomUser.objects.create_user(
            username="admin_test",
            password="admin_test",
            role="admin",
            category="staff",
            is_staff=True,
            is_superuser=True,
            account_active=True,
        )
    return admin


def ensure_consumer(username: str, sponsor=None):
    u = CustomUser.objects.filter(username=username).first()
    if not u:
        u = CustomUser.objects.create_user(
            username=username,
            password=username,
            role="user",
            category="consumer",
            registered_by=sponsor,
            account_active=True,
            pincode="110001",
        )
    else:
        # Make sure category/role align to consumer for matrix eligibility
        changed = False
        if getattr(u, "category", "") != "consumer":
            u.category = "consumer"; changed = True
        if getattr(u, "role", "") != "user":
            u.role = "user"; changed = True
        if not getattr(u, "account_active", False):
            u.account_active = True; changed = True
        if sponsor and getattr(u, "registered_by_id", None) != sponsor.id:
            u.registered_by = sponsor; changed = True
        if changed:
            u.save(update_fields=["category", "role", "account_active", "registered_by"])
    return u


def ensure_packages():
    p150, _ = PromoPackage.objects.get_or_create(
        code="PRIME150",
        defaults={"name": "PRIME 150", "type": "PRIME", "price": D("150.00"), "is_active": True},
    )
    if p150.type != "PRIME" or p150.price != D("150.00") or not p150.is_active:
        p150.type = "PRIME"; p150.price = D("150.00"); p150.is_active = True; p150.save(update_fields=["type", "price", "is_active"])
    p750, _ = PromoPackage.objects.get_or_create(
        code="PRIME750",
        defaults={"name": "PRIME 750", "type": "PRIME", "price": D("750.00"), "is_active": True},
    )
    if p750.type != "PRIME" or p750.price != D("750.00") or not p750.is_active:
        p750.type = "PRIME"; p750.price = D("750.00"); p750.is_active = True; p750.save(update_fields=["type", "price", "is_active"])
    p759, _ = PromoPackage.objects.get_or_create(
        code="PRIME759",
        defaults={"name": "PRIME 759", "type": "PRIME", "price": D("759.00"), "is_active": True},
    )
    if p759.type != "PRIME" or p759.price != D("759.00") or not p759.is_active:
        p759.type = "PRIME"; p759.price = D("759.00"); p759.is_active = True; p759.save(update_fields=["type", "price", "is_active"])
    return p150, p750, p759


def ensure_ecoupon_inventory():
    # Create a Season/Coupon master for store products
    season, _ = Coupon.objects.get_or_create(
        code="SEASON-TEST",
        defaults={"title": "Season Test", "description": "Test season", "issuer_id": CustomUser.objects.filter(is_superuser=True).first().id if CustomUser.objects.filter(is_superuser=True).exists() else CustomUser.objects.first().id}
    )
    # Create a dummy batch to group codes
    batch = CouponBatch.objects.filter(coupon=season).order_by("-id").first()
    if not batch:
        batch = CouponBatch.objects.create(
            coupon=season, prefix="TST", serial_start=1, serial_end=1, serial_width=0
        )

    # Create few AVAILABLE e-coupon codes for 150 and 759 if pool is low
    def make_codes(denom: D, count: int, prefix: str):
        existing = CouponCode.objects.filter(issued_channel="e_coupon", value=denom, status="AVAILABLE").count()
        to_make = max(0, count - existing)
        created = []
        if to_make <= 0:
            return []
        for i in range(to_make):
            code = f"{prefix}{timezone.now().strftime('%H%M%S')}{i}"
            created.append(CouponCode(
                code=code,
                coupon=season,
                issued_channel="e_coupon",
                assigned_employee=None,
                assigned_agency=None,
                assigned_consumer=None,
                batch=batch,
                serial=None,
                value=denom,
                issued_by=CustomUser.objects.filter(is_superuser=True).first() or CustomUser.objects.first(),
                status="AVAILABLE",
            ))
        if created:
            CouponCode.objects.bulk_create(created, batch_size=100)
        return [c.code for c in created]

    # Ensure ECoupon store products for 150 and 759
    from coupons.models import ECouponProduct
    prod150 = ECouponProduct.objects.filter(coupon=season, denomination=D("150.00")).order_by("-id").first()
    if not prod150:
        prod150 = ECouponProduct.objects.create(
            coupon=season,
            denomination=D("150.00"),
            price_per_unit=D("150.00"),
            enable_consumer=True,
            enable_agency=True,
            enable_employee=True,
            is_active=True,
            max_per_order=5,
            display_title="E-Coupon 150",
            display_desc="Test 150 denomination",
        )
    prod759 = ECouponProduct.objects.filter(coupon=season, denomination=D("759.00")).order_by("-id").first()
    if not prod759:
        prod759 = ECouponProduct.objects.create(
            coupon=season,
            denomination=D("759.00"),
            price_per_unit=D("759.00"),
            enable_consumer=True,
            enable_agency=True,
            enable_employee=True,
            is_active=True,
            max_per_order=5,
            display_title="E-Coupon 759",
            display_desc="Test 759 denomination",
        )

    new150 = make_codes(D("150.00"), 3, "EC150_")
    new759 = make_codes(D("759.00"), 3, "EC759_")
    return {"season_id": season.id, "product150_id": prod150.id if prod150 else None, "product759_id": prod759.id if prod759 else None, "new150": new150, "new759": new759}


def approvals_with_admin(factory, admin_user, purchase_id: int):
    view = AdminPromoPurchaseApproveView.as_view()
    req = factory.post(f"/api/business/admin/promo/purchases/{purchase_id}/approve/", data={}, format="json")
    force_authenticate(req, user=admin_user)
    resp = view(req, pk=purchase_id)
    return resp


def approve_store_order(factory, admin_user, order_id: int, review_note: str = ""):
    view = ECouponOrderViewSet.as_view({"post": "approve"})
    req = factory.post(f"/api/v1/ecoupon/orders/{order_id}/approve/", data={"review_note": review_note}, format="json")
    force_authenticate(req, user=admin_user)
    resp = view(req, pk=order_id)
    return resp


def activate_ecoupon(factory, user, t_type: str, code: str):
    view = CouponActivateView.as_view()
    payload = {"type": t_type, "source": {"code": code, "channel": "e_coupon"}}
    req = factory.post("/api/v1/coupon/activate/?sync=1", data=payload, format="json")
    force_authenticate(req, user=user)
    resp = view(req)
    return resp


def wallet_summary_for(user_id: int):
    qs = WalletTransaction.objects.filter(user_id=user_id)
    total = D("0.00")
    by_type = {}
    for w in qs.only("amount", "type"):
        try:
            amt = D(str(getattr(w, "amount", "0") or "0"))
        except Exception:
            amt = D("0.00")
        total += amt
        tt = getattr(w, "type", "") or ""
        by_type[tt] = str(D(str(by_type.get(tt, "0"))) + amt)
    return {"count": qs.count(), "total": f"{total:.2f}", "by_type": by_type}


def main():
    out = {"ok": True, "errors": []}
    cfg = CommissionConfig.get_solo()  # ensure exists

    admin = ensure_admin()
    sponsor = ensure_consumer("CONS_SPONSOR")
    consumer = ensure_consumer("CONS_USER1", sponsor=sponsor)

    p150, p750, p759 = ensure_packages()
    inv = ensure_ecoupon_inventory()

    # Prepare DRF test factory
    factory = APIRequestFactory()

    # PRIME 150 approval (REDEEM)
    pp150 = PromoPurchase.objects.create(user=consumer, package=p150, quantity=1, prime150_choice="REDEEM", status="PENDING")
    resp150 = approvals_with_admin(factory, admin, pp150.id)
    out["prime150"] = {"approve_status": getattr(resp150, "status_code", None)}

    # PRIME 750 approval (PRODUCT) should create PromoProductOrder + immediate payout, no codes
    pp750_prod = PromoPurchase.objects.create(user=consumer, package=p750, quantity=1, prime750_choice="PRODUCT", status="PENDING", shipping_address="Addr Line 1")
    resp750p = approvals_with_admin(factory, admin, pp750_prod.id)
    po = PromoProductOrder.objects.filter(promo_purchase=pp750_prod).first()
    out["prime750_product"] = {
        "approve_status": getattr(resp750p, "status_code", None),
        "product_order_created": bool(po is not None),
        "allocated_count": int(getattr(PromoPurchase.objects.get(id=pp750_prod.id), "allocated_count", 0) or 0),
    }

    # PRIME 750 approval (REDEEM) immediate payout, no codes
    pp750_red = PromoPurchase.objects.create(user=consumer, package=p750, quantity=1, prime750_choice="REDEEM", status="PENDING")
    resp750r = approvals_with_admin(factory, admin, pp750_red.id)
    out["prime750_redeem"] = {"approve_status": getattr(resp750r, "status_code", None),
                              "allocated_count": int(getattr(PromoPurchase.objects.get(id=pp750_red.id), "allocated_count", 0) or 0)}

    # PRIME 759 approval should create subscription + trigger month-1 payouts
    pp759 = PromoPurchase.objects.create(user=consumer, package=p759, quantity=1, status="PENDING")
    resp759 = approvals_with_admin(factory, admin, pp759.id)
    sub759 = Promo759Subscription.objects.filter(promo_purchase=pp759).first()
    out["prime759"] = {"approve_status": getattr(resp759, "status_code", None), "subscription_created": bool(sub759 is not None)}

    # Store: create ECouponOrder -> approve -> activate for 150 and 759
    # Create ECouponProduct via ORM-less path: re-use inventory directly, we just need to allocate codes by admin approve on ECouponOrder
    # For simplicity we skip product creation and allocate from global pool by denomination (approve() already supports that).
    # Create orders by constructing direct model entries through viewset create would require payment config; bypass and focus on approval+activation.

    # To approve store orders we need actual ECouponOrder records; call viewset create? That demands active payment config.
    # Instead, build minimal ECouponOrder rows via ORM that mirror submitted state.
    from coupons.models import ECouponOrder, ECouponPaymentConfig, ECouponProduct  # noqa: E402

    paycfg = ECouponPaymentConfig.objects.filter(is_active=True).first()
    if not paycfg:
        paycfg = ECouponPaymentConfig.objects.create(title="Test Pay", upi_id="upi@test", payee_name="Tester", is_active=True, created_by=admin)

    prod150 = ECouponProduct.objects.filter(id=inv.get("product150_id")).first() or ECouponProduct.objects.filter(denomination=D("150.00"), is_active=True).first()
    order150 = ECouponOrder.objects.create(
        buyer=consumer, role_at_purchase="consumer",
        product=prod150,
        denomination_snapshot=D("150.00"), quantity=1, amount_total=D("150.00"),
        payment_config=paycfg, utr="TEST150", status="SUBMITTED",
    )
    r_ord150 = approve_store_order(factory, admin, order150.id, "ok")
    # Fetch an assigned code for the consumer by denomination 150
    code150 = CouponCode.objects.filter(assigned_consumer=consumer, value=D("150.00"), status__in=["SOLD", "REDEEMED"]).order_by("-id").first()
    if code150:
        r_act150 = activate_ecoupon(factory, consumer, "150", code150.code)
        out["ecoupon_150"] = {"approve_status": getattr(r_ord150, "status_code", None), "activate_status": getattr(r_act150, "status_code", None), "code": code150.code}
    else:
        out["ecoupon_150"] = {"approve_status": getattr(r_ord150, "status_code", None), "activate_status": None, "code": None, "error": "No code allocated"}

    prod759 = ECouponProduct.objects.filter(id=inv.get("product759_id")).first() or ECouponProduct.objects.filter(denomination=D("759.00"), is_active=True).first()
    order759 = ECouponOrder.objects.create(
        buyer=consumer, role_at_purchase="consumer",
        product=prod759,
        denomination_snapshot=D("759.00"), quantity=1, amount_total=D("759.00"),
        payment_config=paycfg, utr="TEST759", status="SUBMITTED",
    )
    r_ord759 = approve_store_order(factory, admin, order759.id, "ok")
    code759 = CouponCode.objects.filter(assigned_consumer=consumer, value=D("759.00"), status__in=["SOLD", "REDEEMED"]).order_by("-id").first()
    if code759:
        r_act759 = activate_ecoupon(factory, consumer, "759", code759.code)
        out["ecoupon_759"] = {"approve_status": getattr(r_ord759, "status_code", None), "activate_status": getattr(r_act759, "status_code", None), "code": code759.code}
    else:
        out["ecoupon_759"] = {"approve_status": getattr(r_ord759, "status_code", None), "activate_status": None, "code": None, "error": "No code allocated"}

    # Matrix placements summary (consumer only)
    out["matrix"] = {
        "five_active": AutoPoolAccount.objects.filter(owner=consumer, pool_type="FIVE_150", status="ACTIVE").count(),
        "three_active": AutoPoolAccount.objects.filter(owner=consumer, pool_type="THREE_150", status="ACTIVE").count(),
    }

    # Audit markers
    def audit_exists(action, code=None):
        qs = AuditTrail.objects.filter(action=action)
        if code is not None:
            cobj = CouponCode.objects.filter(code=code).first()
            if cobj:
                qs = qs.filter(coupon_code=cobj)
        return qs.exists()

    out["audits"] = {
        "prime_150_distributed": AuditTrail.objects.filter(action="prime_150_distributed").exists(),
        "prime_750_distributed": AuditTrail.objects.filter(action="prime_750_distributed").exists(),
        "monthly_759_distributed": AuditTrail.objects.filter(action="monthly_759_distributed").exists(),
        "coupon_matrix_distributed_any": AuditTrail.objects.filter(action="coupon_matrix_distributed").exists(),
    }

    # Wallet summaries
    out["wallets"] = {
        "consumer": wallet_summary_for(consumer.id),
        "sponsor": wallet_summary_for(sponsor.id) if sponsor else None,
    }

    # Persist JSON report
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tmp"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "run_prime_tests_report.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, default=str, indent=2)
    print(out_path)


if __name__ == "__main__":
    main()
