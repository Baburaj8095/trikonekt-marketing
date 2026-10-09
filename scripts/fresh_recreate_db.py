import os, sys, django
from decimal import Decimal

# 1. Setup environment and Django
sys.path.append("/srv/trikonekt/staging/backend")
if os.path.exists("/etc/trikonekt/staging-backend.env"):
    with open("/etc/trikonekt/staging-backend.env") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.db import connection, transaction
from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from business.models import PromoPackage, CommissionConfig, AutoPoolAccount, RootConsumerConfig
from mlm_ranks.models import Rank as MlmRank
from accounts.models import Wallet, WalletAccount, RewardPointsAccount, ensure_consumer_clone_for_new_superuser

User = get_user_model()

print("=" * 60)
print("TRIKONEKT STAGING: FRESH DATABASE RECREATION SCRIPT")
print("=" * 60)

# STEP 1: DROP ALL TABLES IN PUBLIC SCHEMA SAFELY
print("\n[STEP 1] Dropping all tables in public schema...")
with connection.cursor() as cursor:
    cursor.execute("""
        DO $$ DECLARE
            r RECORD;
        BEGIN
            FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
            END LOOP;
        END $$;
    """)
print("--> All public schema tables dropped successfully.")

# STEP 2: RUN DJANGO MIGRATIONS FRESH
print("\n[STEP 2] Running Django migrations from scratch...")
call_command("migrate", interactive=False)
print("--> Django migrations completed successfully.")

# STEP 3: CREATE ADMIN USER (ID=1) AND ROOT SPONSOR USER (ID=2)
print("\n[STEP 3] Creating Admin User (ID=1) and Root Sponsor User (ID=2)...")

# Temporarily disconnect superuser consumer clone so 9999999999 gets ID=2 strictly
post_save.disconnect(ensure_consumer_clone_for_new_superuser, sender=User)

with transaction.atomic():
    # Admin Superuser -> will get ID=1
    admin_user = User.objects.create(
        username="admin",
        phone="9999900000",
        is_staff=True,
        is_superuser=True,
        is_active=True,
        role="admin",
        category="admin",
    )
    admin_user.set_password("Admin@123")
    admin_user.save()
    print(f"--> Admin User created: ID={admin_user.id}, Username={admin_user.username}")

    # Root Sponsor User -> will get ID=2
    root_user = User.objects.create(
        username="9999999999",
        phone="9999999999",
        is_staff=False,
        is_superuser=False,
        is_active=True,
        role="user",
        category="consumer",
        registered_by=admin_user,
        account_active=True,
    )
    root_user.set_password("User@123")
    if hasattr(root_user, "sponsor"):
        root_user.sponsor = admin_user
    root_user.save()
    print(f"--> Root Sponsor User created: ID={root_user.id}, Username={root_user.username}")

    # Set RootConsumerConfig root_user to 9999999999
    root_cfg = RootConsumerConfig.get_solo()
    root_cfg.root_user = root_user
    root_cfg.save()
    print(f"--> RootConsumerConfig configured with root_user={root_user.username}")

    # Ensure Wallets exist for both
    for u in [admin_user, root_user]:
        Wallet.objects.get_or_create(user=u)
        WalletAccount.objects.get_or_create(user=u, wallet_type="MAIN_WALLET", defaults={"current_balance": Decimal("0.00")})
        WalletAccount.objects.get_or_create(user=u, wallet_type="SELF_ACCOUNT", defaults={"current_balance": Decimal("0.00")})
        WalletAccount.objects.get_or_create(user=u, wallet_type="REPURCHASE_WALLET", defaults={"current_balance": Decimal("0.00")})
        RewardPointsAccount.objects.get_or_create(user=u)

# Reconnect signal
post_save.connect(ensure_consumer_clone_for_new_superuser, sender=User)

# Verify sequence
with connection.cursor() as cursor:
    cursor.execute("SELECT setval('accounts_customuser_id_seq', (SELECT MAX(id) FROM accounts_customuser));")
    curr_user_seq = cursor.fetchone()[0]
    print(f"--> accounts_customuser_id_seq set to: {curr_user_seq}")

# STEP 4: SEED PACKAGES (INCLUDING 1K PRIME & SPP 1000)
print("\n[STEP 4] Seeding PromoPackages...")
packages_spec = [
    ("PRIME150", "Prime Promo 150", Decimal("150.00"), "PRIME"),
    ("PRIME750", "Prime Promo 1000", Decimal("1000.00"), "PRIME"),
    ("PRIME1000", "Prime Promo 1000", Decimal("1000.00"), "PRIME"),
    ("MONTHLY759", "Monthly Promo 1000", Decimal("1000.00"), "MONTHLY"),
    ("MONTHLY1000", "Smart Product Purchase (SPP)", Decimal("1000.00"), "MONTHLY"),
    ("SPP1000", "Smart Product Purchase 1000", Decimal("1000.00"), "MONTHLY"),
    ("TRI_HOLIDAYS", "Tri Tour", Decimal("1.00"), "PRIME"),
]
for code, name, price, ptype in packages_spec:
    p, _ = PromoPackage.objects.update_or_create(
        code=code,
        defaults={"name": name, "price": price, "type": ptype, "is_active": True}
    )
    print(f"--> PromoPackage: {p.code} | {p.name} | Rs.{p.price}")

# STEP 5: SEED COMMISSION CONFIG & RANK UPGRADE SPEC (WITH 18% GST)
print("\n[STEP 5] Initializing CommissionConfig & Rank Tiers (18% GST)...")
ranks_spec = [
    (1, "Layer 1", 5, Decimal("250.00")),
    (2, "Layer 2", 25, Decimal("500.00")),
    (3, "Layer 3", 125, Decimal("1000.00")),
    (4, "Layer 4", 625, Decimal("1250.00")),
    (5, "Layer 5", 3125, Decimal("1500.00")),
    (6, "Layer 6", 15625, Decimal("1750.00")),
    (7, "Layer 7", 78125, Decimal("2000.00")),
    (8, "Layer 8", 390625, Decimal("5000.00")),
    (9, "Layer 9", 1953125, Decimal("10000.00")),
    (10, "Layer 10", 9765625, Decimal("25000.00")),
]
for lvl, rname, team, amt in ranks_spec:
    r, _ = MlmRank.objects.update_or_create(
        level_number=lvl,
        defaults={
            "rank_name": f"L{lvl} {rname}",
            "team_size_required": team,
            "upgrade_amount": amt,
        }
    )
    print(f"--> MLM Rank L{lvl}: {r.rank_name} | Fee=Rs.{r.upgrade_amount}")

cfg = CommissionConfig.get_solo()
cfg.tax_percent = Decimal("18.00")

# Rank upgrade config structure in master_commission_json
master = dict(cfg.master_commission_json or {})
master["rank_upgrade_config"] = {
    "upgrade_window_l1_l7": 7,
    "upgrade_window_l8_l10": 15,
    "rebirth_allocation": {
        "total_amount": 250,
        "direct_sponsor": 40,
        "matrix_5": 80,
        "matrix_3": 20,
        "district_pool": 50,
        "company_gross": 60,
    },
    "levels": [
        {"level": lvl, "name": f"Layer {lvl}", "upgrade_amount": float(amt), "earning_limit": 100000 if lvl==10 else lvl*2000, "team_count": str(team)}
        for lvl, _, team, amt in ranks_spec
    ]
}
# SPP 1000 config
master["spp_1000_config"] = {
    "total_inflow": 1000,
    "tax_percent": 18,
    "direct_sponsor": 200,
    "matrix_5_total": 120,
    "matrix_3_total": 40,
    "self_cashback": 50,
}
cfg.master_commission_json = master
cfg.save()
print("--> CommissionConfig initialized with 18% GST and 1k packages.")

# STEP 6: CREATE SENTINEL ROOT ACCOUNTS FOR 5-BLOCK & 3-BLOCK MATRICES
print("\n[STEP 6] Creating Sentinel Matrix Roots...")
sentinel_5 = AutoPoolAccount.objects.create(
    owner=admin_user,
    username_key=admin_user.username,
    entry_amount=Decimal("150.00"),
    pool_type="FIVE_150",
    status="ACTIVE",
    user_entry_index=0,
    position=None,
    source_type="SENTINEL",
    source_id="SENTINEL_ROOT_5",
    parent_account=None,
    level=1
)
sentinel_3 = AutoPoolAccount.objects.create(
    owner=admin_user,
    username_key=admin_user.username,
    entry_amount=Decimal("150.00"),
    pool_type="THREE_150",
    status="ACTIVE",
    user_entry_index=0,
    position=None,
    source_type="SENTINEL",
    source_id="SENTINEL_ROOT_3",
    parent_account=None,
    level=1
)
print(f"--> Sentinel 5-Block Matrix Root Created: ID={sentinel_5.id}")
print(f"--> Sentinel 3-Block Matrix Root Created: ID={sentinel_3.id}")

# Verify AutoPool sequence
with connection.cursor() as cursor:
    cursor.execute("SELECT setval('business_autopoolaccount_id_seq', (SELECT MAX(id) FROM business_autopoolaccount));")
    curr_pool_seq = cursor.fetchone()[0]
    print(f"--> business_autopoolaccount_id_seq set to: {curr_pool_seq}")

print("\n" + "=" * 60)
print("SUCCESS: FRESH DATABASE RECREATION EXECUTED CLEANLY")
print("=" * 60)
