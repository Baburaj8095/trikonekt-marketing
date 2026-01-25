from django.core.management.base import BaseCommand
from django.db import transaction
from business.models import MerchantCategory, MerchantSubCategory


SEED_DATA = [
    {
        "category": "Food & Beverage",
        "subcategories": [
            "Restaurant",
            "Cafe",
            "Bakery",
            "Sweet Shop",
            "Juice Center",
            "Fast Food",
            "Cloud Kitchen",
            "Ice Cream Parlour",
            "Catering Services",
            "Tiffin Service",
            "Tea Stall",
            "Bar & Pub",
        ],
    },
    {
        "category": "Grocery & Daily Needs",
        "subcategories": [
            "Supermarket",
            "Kirana Store",
            "Fruits & Vegetables",
            "Dairy & Milk Products",
            "Meat & Fish Shop",
            "Organic Store",
            "Water Can Supplier",
            "Ration Shop",
        ],
    },
    {
        "category": "Retail & Shopping",
        "subcategories": [
            "Clothing Store",
            "Footwear Store",
            "Mobile Shop",
            "Electronics Store",
            "Home Appliances",
            "Gift Shop",
            "Book Store",
            "Stationery Shop",
            "Toy Store",
            "Watch Store",
            "Jewellery Shop",
            "Sports Store",
        ],
    },
    {
        "category": "Beauty & Wellness",
        "subcategories": [
            "Salon (Men)",
            "Salon (Women)",
            "Unisex Salon",
            "Spa & Massage",
            "Makeup Studio",
            "Nail Studio",
            "Skin Clinic",
            "Yoga Center",
            "Gym & Fitness",
            "Zumba / Dance Fitness",
            "Ayurveda Center",
        ],
    },
    {
        "category": "Health & Medical",
        "subcategories": [
            "Pharmacy / Medical Store",
            "Clinic / Doctor",
            "Dental Clinic",
            "Eye Clinic / Opticals",
            "Diagnostic Lab",
            "Physiotherapy Center",
            "Home Nursing",
            "Medical Equipment Store",
            "Veterinary Clinic",
        ],
    },
    {
        "category": "Education & Training",
        "subcategories": [
            "Tuition Center",
            "Coaching Institute",
            "Computer Training",
            "Spoken English",
            "Music Classes",
            "Dance Classes",
            "Art & Craft Classes",
            "Driving School",
            "Skill Development Center",
            "Competitive Exam Coaching",
        ],
    },
    {
        "category": "Home Services",
        "subcategories": [
            "Electrician",
            "Plumber",
            "Carpenter",
            "Painter",
            "AC Repair & Service",
            "Refrigerator Repair",
            "Washing Machine Repair",
            "RO Water Purifier Service",
            "Pest Control",
            "Home Cleaning",
            "Sofa / Carpet Cleaning",
            "Interior Designer",
        ],
    },
    {
        "category": "Automobile",
        "subcategories": [
            "Car Service Center",
            "Bike Service Center",
            "Car Wash",
            "Tyre Shop",
            "Battery Shop",
            "Auto Spare Parts",
            "Accessories Shop",
            "Towing Service",
            "Driving Accessories",
        ],
    },
    {
        "category": "Travel & Transport",
        "subcategories": [
            "Travel Agency",
            "Taxi Service",
            "Auto / Cab Booking",
            "Bus Ticketing",
            "Flight Ticketing",
            "Hotel Booking",
            "Tour Packages",
            "Courier & Logistics",
            "Packers & Movers",
        ],
    },
    {
        "category": "Finance & Insurance",
        "subcategories": [
            "Insurance Agent",
            "Loan Consultant",
            "CA / Tax Consultant",
            "Investment Advisor",
            "Money Transfer",
            "ATM / Banking Point",
            "Micro Finance",
        ],
    },
    {
        "category": "Professional Services",
        "subcategories": [
            "IT Services",
            "Web Design Agency",
            "Digital Marketing",
            "Photography Studio",
            "Videography",
            "Printing & Flex",
            "Event Management",
            "Legal Services",
            "Real Estate Agent",
            "Architecture Firm",
        ],
    },
    {
        "category": "Construction & Hardware",
        "subcategories": [
            "Hardware Store",
            "Cement & Bricks Supplier",
            "Steel Supplier",
            "Electricals & Lighting",
            "Paint Store",
            "Sanitary & Plumbing Store",
            "Tiles & Marble",
            "Glass & Aluminium Works",
            "Modular Kitchen",
            "Building Contractor",
        ],
    },
    {
        "category": "Electronics & Repairs",
        "subcategories": [
            "Mobile Repair",
            "Laptop Repair",
            "Computer Repair",
            "CCTV Installation",
            "TV Repair",
            "Speaker / Sound System Repair",
            "Printer Repair",
            "Networking Services",
        ],
    },
    {
        "category": "Entertainment & Lifestyle",
        "subcategories": [
            "Gaming Zone",
            "Movie / Ticket Booking",
            "Club / Lounge",
            "Sports Academy",
            "Hobby Store",
            "Party Supplies",
        ],
    },
    {
        "category": "Agriculture & Farming",
        "subcategories": [
            "Fertilizer Shop",
            "Seeds Store",
            "Pesticides Shop",
            "Farm Equipment",
            "Tractor Services",
            "Dairy Farm Supplies",
        ],
    },
    {
        "category": "Wholesale & Distribution",
        "subcategories": [
            "FMCG Wholesale",
            "Medical Wholesale",
            "Electrical Wholesale",
            "Hardware Wholesale",
            "Garments Wholesale",
            "Food Ingredients Wholesale",
        ],
    },
    {
        "category": "Pets & Animals",
        "subcategories": [
            "Pet Shop",
            "Pet Grooming",
            "Pet Boarding",
            "Aquarium Shop",
            "Animal Feed Store",
        ],
    },
    {
        "category": "Kids & Baby Care",
        "subcategories": [
            "Baby Store",
            "Kids Clothing",
            "Toy Shop",
            "Day Care / Play School",
            "Kids Salon",
        ],
    },
    {
        "category": "Religious & Cultural",
        "subcategories": [
            "Pooja Store",
            "Flower Shop",
            "Temple Services",
            "Astrology / Horoscope",
        ],
    },
    {
        "category": "Other",
        "subcategories": [
            "General Store",
            "Multi Service Center",
            "Miscellaneous",
        ],
    },
]


class Command(BaseCommand):
    help = "Seed Merchant Categories and Subcategories (idempotent upsert)."

    def add_arguments(self, parser):
        parser.add_argument("--deactivate-missing", action="store_true", help="Deactivate categories/subcategories not present in the seed list.")
        parser.add_argument("--dry-run", action="store_true", help="Show planned changes without writing.")

    @transaction.atomic
    def handle(self, *args, **options):
        deactivate_missing = bool(options.get("deactivate_missing"))
        dry_run = bool(options.get("dry_run"))

        created_c = 0
        updated_c = 0
        created_s = 0
        updated_s = 0

        seen_cat_ids = set()
        seen_sub_ids = set()

        # Upsert categories and subcategories
        for ci, item in enumerate(SEED_DATA, start=1):
            cat_name = str(item.get("category", "")).strip()
            if not cat_name:
                continue
            sort_order = ci * 10

            cat, was_created = MerchantCategory.objects.get_or_create(name=cat_name, defaults={"is_active": True, "sort_order": sort_order})
            if was_created:
                created_c += 1
            else:
                changed = False
                if cat.sort_order != sort_order:
                    cat.sort_order = sort_order
                    changed = True
                if cat.is_active is False:
                    cat.is_active = True
                    changed = True
                if changed and not dry_run:
                    cat.save(update_fields=["sort_order", "is_active"])
                    updated_c += 1
                elif changed and dry_run:
                    updated_c += 1
            seen_cat_ids.add(cat.id)

            subs = item.get("subcategories") or []
            for si, sub_name in enumerate(subs, start=1):
                sub_name = str(sub_name).strip()
                if not sub_name:
                    continue
                sub_sort = si * 10
                sub, s_created = MerchantSubCategory.objects.get_or_create(category=cat, name=sub_name, defaults={"is_active": True, "sort_order": sub_sort})
                if s_created:
                    created_s += 1
                else:
                    schanged = False
                    if sub.sort_order != sub_sort:
                        sub.sort_order = sub_sort
                        schanged = True
                    if sub.is_active is False:
                        sub.is_active = True
                        schanged = True
                    if schanged and not dry_run:
                        sub.save(update_fields=["sort_order", "is_active"])
                        updated_s += 1
                    elif schanged and dry_run:
                        updated_s += 1
                seen_sub_ids.add(sub.id)

        # Optionally deactivate anything not in the seed list (soft synchronization)
        deactivated_c = 0
        deactivated_s = 0
        if deactivate_missing:
            for c in MerchantCategory.objects.exclude(id__in=list(seen_cat_ids)):
                if c.is_active:
                    if not dry_run:
                        c.is_active = False
                        c.save(update_fields=["is_active"])
                    deactivated_c += 1
            for s in MerchantSubCategory.objects.exclude(id__in=list(seen_sub_ids)):
                if s.is_active:
                    if not dry_run:
                        s.is_active = False
                        s.save(update_fields=["is_active"])
                    deactivated_s += 1

        summary = {
            "categories": {"created": created_c, "updated": updated_c, "deactivated": deactivated_c},
            "subcategories": {"created": created_s, "updated": updated_s, "deactivated": deactivated_s},
            "dry_run": dry_run,
        }
        self.stdout.write(self.style.SUCCESS(f"Seed complete: {summary}"))
