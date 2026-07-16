import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.db import connection
from market.models import Shop, ShopProduct
from accounts.models import CustomUser

print("=" * 80)
print("SHOP DIAGNOSTIC REPORT")
print("=" * 80)

shop_id = 39

try:
    with connection.cursor() as cursor:
        # 1. Fetch shop info from market_shop
        cursor.execute("SELECT id, shop_name, merchant_id, status, service_mode, home_delivery_enabled, delivery_radius_km FROM market_shop WHERE id = %s", [shop_id])
        shop_row = cursor.fetchone()
        
        if not shop_row:
            print(f"Shop ID {shop_id} not found in market_shop table!")
        else:
            print(f"Shop details (DB):")
            print(f"  ID: {shop_row[0]}")
            print(f"  Name: {shop_row[1]}")
            print(f"  Merchant ID: {shop_row[2]}")
            print(f"  Status: {shop_row[3]}")
            print(f"  Service Mode: {shop_row[4]}")
            print(f"  Home Delivery Enabled: {shop_row[5]}")
            print(f"  Delivery Radius KM: {shop_row[6]}")
            
            merchant_id = shop_row[2]
            
            # 2. Fetch merchant info from accounts_customuser
            cursor.execute("SELECT id, username, category, is_active FROM accounts_customuser WHERE id = %s", [merchant_id])
            user_row = cursor.fetchone()
            if user_row:
                print(f"Merchant user:")
                print(f"  ID: {user_row[0]}")
                print(f"  Username: {user_row[1]}")
                print(f"  Category: {user_row[2]}")
                print(f"  Is Active: {user_row[3]}")
            else:
                print(f"Merchant user ID {merchant_id} not found in accounts_customuser!")

            # 3. Fetch merchant profile info from market_merchantprofile
            cursor.execute("SELECT id, service_mode FROM market_merchantprofile WHERE user_id = %s", [merchant_id])
            profile_row = cursor.fetchone()
            if profile_row:
                print(f"Merchant profile:")
                print(f"  ID: {profile_row[0]}")
                print(f"  Service Mode: {profile_row[1]}")
            else:
                print(f"Merchant profile not found for user_id {merchant_id}!")

            # 4. Fetch products info from market_shopproduct
            cursor.execute("SELECT id, title, online_delivery, offline_delivery, stock_qty, is_active FROM market_shopproduct WHERE shop_id = %s", [shop_id])
            products = cursor.fetchall()
            print(f"\nProducts count: {len(products)}")
            for p in products:
                print(f"  Product ID: {p[0]}")
                print(f"    Title: {p[1]}")
                print(f"    Online Delivery: {p[2]} (type: {type(p[2])})")
                print(f"    Offline Delivery: {p[3]}")
                print(f"    Stock Qty: {p[4]}")
                print(f"    Is Active: {p[5]}")

except Exception as e:
    print("Database diagnostics failed:", e)

print("=" * 80)
