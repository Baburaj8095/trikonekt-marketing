from django.core.management.base import BaseCommand
from django.db import transaction

from business.models import TriApp, TriAppProduct


SEED_APPS = [
    {
        "slug": "tri-holidays",
        "name": "TRI Holidays",
        "description": "Explore curated holiday packages. Admin controls price visibility, add-to-cart and payment.",
    },
    {
        "slug": "tri-ev",
        "name": "TRI EV Vehicles",
        "description": "Electric vehicles and accessories. Admin-managed catalog with uploadable images.",
    },
    {
        "slug": "tri-furniture",
        "name": "TRI Furniture",
        "description": "Home and office furniture collections.",
    },
    {
        "slug": "tri-electronics",
        "name": "TRI Electronics & Home Appliances",
        "description": "Electronics and home appliances.",
    },
    {
        "slug": "tri-properties",
        "name": "TRI Properties",
        "description": "Real estate listings.",
    },
    {
        "slug": "tri-saving",
        "name": "TRI Saving App",
        "description": "Savings and finance products.",
    },
    {
        "slug": "tri-local-store",
        "name": "Local Store",
        "description": "Nearby curated products from local partners.",
    },
]


class Command(BaseCommand):
    help = "Seed default TRI Apps (admin-managed catalogs) so that frontend /user/tri/<slug> routes resolve. Does not overwrite existing records."

    def add_arguments(self, parser):
        parser.add_argument(
            "--with-samples",
            action="store_true",
            help="Also seed minimal sample products for tri-holidays if none exist (images left blank).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        created_count = 0
        for item in SEED_APPS:
            slug = item["slug"]
            defaults = {
                "name": item["name"],
                "description": item.get("description", ""),
                "is_active": True,
                # Capability flags remain disabled by default; admin can enable later
                "allow_price": False,
                "allow_add_to_cart": False,
                "allow_payment": False,
            }
            obj, created = TriApp.objects.get_or_create(slug=slug, defaults=defaults)
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"Created TriApp: {slug}"))
            else:
                self.stdout.write(f"Exists TriApp: {slug}")

        self.stdout.write(self.style.SUCCESS(f"Seeding complete. Created {created_count}, ensured {len(SEED_APPS)}."))

        if options.get("with_samples", False):
            # Add a few sample products under tri-holidays if none exist yet.
            app = TriApp.objects.filter(slug="tri-holidays").first()
            if app:
                if not app.products.exists():
                    samples = [
                        {
                            "name": "Goa Beach Escape (3N/4D)",
                            "description": "A short getaway including hotel, breakfast and local sightseeing.",
                            "price": 12999,
                            "currency": "INR",
                            "display_order": 1,
                        },
                        {
                            "name": "Kerala Backwaters (4N/5D)",
                            "description": "Houseboat experience with scenic backwaters and curated meals.",
                            "price": 18999,
                            "currency": "INR",
                            "display_order": 2,
                        },
                        {
                            "name": "Himachal Hills (5N/6D)",
                            "description": "Shimla & Manali tour with transfers and stays.",
                            "price": 23999,
                            "currency": "INR",
                            "display_order": 3,
                        },
                    ]
                    for s in samples:
                        TriAppProduct.objects.create(
                            app=app,
                            name=s["name"],
                            description=s.get("description", ""),
                            price=s.get("price", 0),
                            currency=s.get("currency", "INR"),
                            is_active=True,
                            display_order=s.get("display_order", 0),
                        )
                    self.stdout.write(self.style.SUCCESS("Seeded sample products under tri-holidays (no images)."))
                else:
                    self.stdout.write("tri-holidays already has products; skipping sample seeding.")
            else:
                self.stdout.write("tri-holidays app not found; skipping sample products.")
