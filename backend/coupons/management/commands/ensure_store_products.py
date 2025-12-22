from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from decimal import Decimal, InvalidOperation

from coupons.models import Coupon, ECouponProduct


def _parse_denoms(s: str):
    out = []
    for part in (s or "").split(","):
        p = part.strip()
        if not p:
            continue
        try:
            out.append(Decimal(str(p)))
        except (InvalidOperation, ValueError):
            continue
    return out


class Command(BaseCommand):
    help = "Ensure standard E‑Coupon store products (e.g., 150/750/759) exist for a Season/Coupon."

    def add_arguments(self, parser):
        parser.add_argument(
            "--coupon-id",
            type=int,
            help="Coupon id (Season/Coupon master). If omitted, tries latest Season* coupon.",
        )
        parser.add_argument(
            "--season",
            type=str,
            help="Season label to match against code/title/campaign (e.g., 'Season 1'). Case-insensitive. Optional.",
        )
        parser.add_argument(
            "--denoms",
            type=str,
            default="150,750,759",
            help="Comma separated denominations to ensure. Defaults to '150,750,759'.",
        )
        parser.add_argument(
            "--max-per-order",
            type=int,
            default=10,
            help="Max per order for created/updated products. Default 10.",
        )
        parser.add_argument(
            "--enable-employee",
            action="store_true",
            default=False,
            help="Also enable employee purchases (default off).",
        )
        parser.add_argument(
            "--inactive",
            action="store_true",
            default=False,
            help="Create/update products as inactive (default active).",
        )

    def handle(self, *args, **opts):
        coupon_id = opts.get("coupon_id")
        season_label = (opts.get("season") or "").strip()
        denoms = _parse_denoms(opts.get("denoms") or "")
        max_per_order = int(opts.get("max_per_order") or 10)
        enable_employee = bool(opts.get("enable_employee"))
        make_inactive = bool(opts.get("inactive"))

        if not denoms:
            raise CommandError("No valid denominations parsed from --denoms")

        coupon = None
        if coupon_id:
            coupon = Coupon.objects.filter(id=coupon_id).first()
            if not coupon:
                raise CommandError(f"Coupon id {coupon_id} not found.")
        else:
            qs = Coupon.objects.all().order_by("-created_at")
            if season_label:
                season_q = (
                    ({"code__iexact": season_label}) |
                    ({"title__iexact": season_label}) |
                    ({"campaign__iexact": season_label})
                )
                # Django cannot OR dicts directly; do it explicitly
                coupon = (
                    Coupon.objects.filter(code__iexact=season_label).first()
                    or Coupon.objects.filter(title__iexact=season_label).first()
                    or Coupon.objects.filter(campaign__iexact=season_label).first()
                )
            if coupon is None:
                # Fallback to latest that looks like Season*
                coupon = (
                    qs.filter(code__istartswith="season").first()
                    or qs.filter(title__istartswith="season").first()
                    or qs.filter(campaign__istartswith="season").first()
                    or qs.first()
                )
        if not coupon:
            raise CommandError("Could not resolve a Coupon. Provide --coupon-id or --season.")

        self.stdout.write(self.style.NOTICE(f"Using coupon: #{coupon.id} {coupon.title}"))

        created = 0
        updated = 0
        with transaction.atomic():
            for d in denoms:
                try:
                    denom = Decimal(str(d))
                except (InvalidOperation, ValueError):
                    self.stderr.write(self.style.WARNING(f"Skip invalid denom: {d}"))
                    continue

                defaults = {
                    "price_per_unit": denom,
                    "enable_consumer": True,
                    "enable_agency": True,
                    "enable_employee": enable_employee,
                    "is_active": not make_inactive,
                    "max_per_order": max_per_order,
                    "display_title": f"E‑Coupon ₹{int(denom) if denom == denom.to_integral() else denom}",
                    "display_desc": "",
                }
                obj, was_created = ECouponProduct.objects.get_or_create(
                    coupon=coupon,
                    denomination=denom,
                    defaults=defaults,
                )
                if was_created:
                    created += 1
                    self.stdout.write(self.style.SUCCESS(f"Created product for ₹{denom}"))
                else:
                    changed = False
                    # Bring existing row to the desired state (idempotent upsert)
                    if obj.price_per_unit != denom:
                        obj.price_per_unit = denom
                        changed = True
                    if obj.enable_consumer is not True:
                        obj.enable_consumer = True
                        changed = True
                    if obj.enable_agency is not True:
                        obj.enable_agency = True
                        changed = True
                    if obj.enable_employee != enable_employee:
                        obj.enable_employee = enable_employee
                        changed = True
                    if obj.is_active != (not make_inactive):
                        obj.is_active = not make_inactive
                        changed = True
                    if (obj.max_per_order or 0) != max_per_order:
                        obj.max_per_order = max_per_order
                        changed = True
                    # Keep title/desc updated but do not overwrite admin customizations if present
                    desired_title = f"E‑Coupon ₹{int(denom) if denom == denom.to_integral() else denom}"
                    if not obj.display_title or obj.display_title.startswith("E‑Coupon ₹"):
                        if obj.display_title != desired_title:
                            obj.display_title = desired_title
                            changed = True
                    if obj.display_desc is None:
                        obj.display_desc = ""
                        changed = True

                    if changed:
                        obj.save()
                        updated += 1
                        self.stdout.write(self.style.SUCCESS(f"Updated product for ₹{denom}"))
                    else:
                        self.stdout.write(f"Exists and up-to-date for ₹{denom}")

        self.stdout.write(self.style.SUCCESS(f"Done. Created: {created}, Updated: {updated}. Coupon #{coupon.id}"))
