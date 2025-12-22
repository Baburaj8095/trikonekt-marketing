"""
Seed a test merchant user and one ACTIVE shop for pincode 560073 (Bengaluru).
- Creates user: username=merchant_560073, category=merchant, password=Test@12345
- Creates/updates MerchantProfile
- Creates one Shop with precise lat/lng near Varthur (within 560073 area)
- Attempts to attach a dummy image from placeholder service; continues without image if download fails.
"""

import os
import sys
from decimal import Decimal

# Django setup
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django  # noqa: E402
django.setup()

from django.core.files.base import ContentFile  # noqa: E402
from django.contrib.auth import get_user_model  # noqa: E402

from market.models import Shop, MerchantProfile  # noqa: E402


def download_dummy_image() -> tuple[str, bytes] | None:
    """
    Fetch a small placeholder image. Returns (filename, bytes) or None on failure.
    """
    try:
        import urllib.request
        url = "https://via.placeholder.com/800x500.png?text=Local+Shop+560073"
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = resp.read()
            return ("dummy_560073.png", data)
    except Exception:
        return None


def main():
    User = get_user_model()

    # 1) Create/Get merchant user
    username = "merchant_560073"
    password = "Test@12345"
    user, created = User.objects.get_or_create(username=username, defaults={"email": "merchant_560073@example.com"})
    if created:
        print(f"[+] Created user: {username}")
    else:
        print(f"[=] User already exists: {username}")

    # Set core merchant attributes
    user.full_name = "Test Merchant 560073"
    user.phone = "9000000000"
    user.category = "merchant"
    # Optional: basic location info on user
    user.pincode = "560073"
    user.address = "Varthur, Bengaluru, Karnataka 560073"
    # Set/Reset password
    user.set_password(password)
    user.save()
    print("[*] Saved user profile and password.")

    # 2) Ensure MerchantProfile
    mp, _ = MerchantProfile.objects.get_or_create(user=user)
    if not mp.business_name:
        mp.business_name = "Local Store 560073"
    if not mp.mobile_number:
        mp.mobile_number = "9000000000"
    # Leave is_verified=False (default); admin can verify if needed
    mp.save()
    print("[*] MerchantProfile ready.")

    # 3) Create one ACTIVE Shop for public listing
    # Approximate coords for Varthur, Bengaluru (within 560073 area)
    lat = Decimal("12.938300")
    lng = Decimal("77.747500")

    shop_name = "Test Local Store 560073"
    address = "Near Varthur Police Station, Varthur, Bengaluru, Karnataka 560073"
    city = "Bengaluru"
    contact = "080-1234567"

    shop = Shop.objects.filter(merchant=user, shop_name=shop_name).first()
    if not shop:
        shop = Shop(
            merchant=user,
            shop_name=shop_name,
            address=address,
            city=city,
            latitude=lat,
            longitude=lng,
            contact_number=contact,
            status=Shop.STATUS_ACTIVE,  # Make visible immediately
        )
        # Attach dummy image (best-effort)
        img = download_dummy_image()
        if img:
            fname, bytes_data = img
            try:
                shop.shop_image.save(fname, ContentFile(bytes_data), save=False)
                print("[*] Attached dummy image to shop.")
            except Exception as e:
                print(f"[!] Failed to attach image: {e}")

        shop.save()
        print(f"[+] Created shop: {shop.shop_name} (ACTIVE)")
    else:
        # Update location/contact/status to ensure it's visible and accurate
        shop.address = address
        shop.city = city
        shop.latitude = lat
        shop.longitude = lng
        shop.contact_number = contact
        shop.status = Shop.STATUS_ACTIVE
        # Attach/refresh dummy image if missing
        if not getattr(shop, "shop_image", None):
            img = download_dummy_image()
            if img:
                fname, bytes_data = img
                try:
                    shop.shop_image.save(fname, ContentFile(bytes_data), save=False)
                    print("[*] Attached dummy image to existing shop.")
                except Exception as e:
                    print(f"[!] Failed to attach image: {e}")
        shop.save()
        print(f"[=] Updated shop: {shop.shop_name} (ACTIVE)")

    print("\nDone.\n")
    print("Login credentials:")
    print(f"  Username: {username}")
    print(f"  Password: {password}")
    print("\nPublic testing:")
    print("  - List:   GET /api/shops/?q=560073 or use 'Use my location' near Varthur")
    print("  - Detail: GET /api/shops/{id}/")


if __name__ == "__main__":
    main()
