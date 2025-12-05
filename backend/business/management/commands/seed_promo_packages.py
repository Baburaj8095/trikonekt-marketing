from django.core.management.base import BaseCommand
from decimal import Decimal
from business.models import PromoPackage


class Command(BaseCommand):
    help = "Seed default consumer Promo Packages: PRIME (₹150, ₹750) and MONTHLY (₹759). Admin can later set QR/UPI."

    def add_arguments(self, parser):
        parser.add_argument(
            "--active",
            action="store_true",
            help="Mark all seeded packages as active (default True).",
        )
        parser.add_argument(
            "--deactivate-others",
            action="store_true",
            help="Deactivate any other promo packages not in the seeded set.",
        )

    def handle(self, *args, **options):
        make_active = True if options.get("active") else True
        deactivate_others = bool(options.get("deactivate_others"))

        desired = [
            dict(
                code="PRIME150",
                name="Prime Promo 150",
                description="Prime Promo Package ₹150",
                type="PRIME",
                price=Decimal("150.00"),
                is_active=make_active,
            ),
            dict(
                code="PRIME750",
                name="Prime Promo 750",
                description="Prime Promo Package ₹750",
                type="PRIME",
                price=Decimal("750.00"),
                is_active=make_active,
            ),
            dict(
                code="MONTHLY759",
                name="Monthly Promo 759",
                description="Monthly Promo Package ₹759 (current month only)",
                type="MONTHLY",
                price=Decimal("759.00"),
                is_active=make_active,
            ),
        ]

        created = 0
        updated = 0
        for d in desired:
            obj, is_created = PromoPackage.objects.get_or_create(
                code=d["code"],
                defaults={
                    "name": d["name"],
                    "description": d["description"],
                    "type": d["type"],
                    "price": d["price"],
                    "is_active": d["is_active"],
                },
            )
            if is_created:
                created += 1
                self.stdout.write(self.style.SUCCESS(f"Created {obj.code}"))
            else:
                # Update fields if drifted
                changed = False
                for f in ("name", "description", "type", "price", "is_active"):
                    new_val = d[f]
                    cur_val = getattr(obj, f)
                    if cur_val != new_val:
                        setattr(obj, f, new_val)
                        changed = True
                if changed:
                    obj.save()
                    updated += 1
                    self.stdout.write(self.style.WARNING(f"Updated {obj.code}"))

        if deactivate_others:
            codes = [d["code"] for d in desired]
            qs = PromoPackage.objects.exclude(code__in=codes).filter(is_active=True)
            count = qs.update(is_active=False)
            if count:
                self.stdout.write(self.style.WARNING(f"Deactivated {count} other package(s)."))

        self.stdout.write(self.style.SUCCESS(f"Done. Created={created}, Updated={updated}."))
