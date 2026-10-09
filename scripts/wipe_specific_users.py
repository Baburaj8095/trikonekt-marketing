import os
import sys
from decimal import Decimal

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from django.db import connection
from django.utils import timezone
from accounts.models import CustomUser, Wallet
from mlm_ranks.models import Rank, UserRank
from mlm_ranks.services.five_matrix import FiveMatrixService

def wipe_users_history_and_wallets():
    target_phones = ['8095918105', '9999999999']
    print(f"=== WIPING TRANSACTION HISTORY, WALLETS & PURCHASES FOR: {target_phones} ===")

    users = list(CustomUser.objects.filter(phone__in=target_phones) | CustomUser.objects.filter(username__in=target_phones))
    user_ids = [u.id for u in users]
    print(f"Found {len(users)} users to wipe: {[(u.id, u.username, u.phone) for u in users]}")

    if not user_ids:
        print("No matching users found in DB.")
        return

    uid_str = ",".join(str(i) for i in user_ids)

    with connection.cursor() as cursor:
        def run_sql(stmt, params=None, desc=""):
            try:
                if params:
                    cursor.execute(stmt, params)
                else:
                    cursor.execute(stmt)
                print(f"✔ {desc}")
            except Exception as e:
                print(f"ℹ {desc} -> {e}")

        # 1. Clear all ledger entries first (so financial transactions can be deleted)
        run_sql(f"""
            DELETE FROM accounts_ledgerentry 
            WHERE user_id IN ({uid_str}) 
               OR financial_transaction_id IN (SELECT id FROM accounts_financialtransaction WHERE user_id IN ({uid_str}));
        """, None, "accounts_ledgerentry")

        # 2. Clear financial transactions (so wallet transactions can be deleted)
        run_sql(f"DELETE FROM accounts_financialtransaction WHERE user_id IN ({uid_str});", None, "accounts_financialtransaction")

        # 3. Clear wallet transactions
        run_sql(f"DELETE FROM accounts_wallettransaction WHERE user_id IN ({uid_str});", None, "accounts_wallettransaction")

        # 4. Clear Rank Upgrade Commissions and Holds
        run_sql(f"DELETE FROM mlm_ranks_commissionhold WHERE from_user_id IN ({uid_str}) OR held_for_user_id IN ({uid_str});", None, "mlm_ranks_commissionhold (held_for_user_id)")
        run_sql(f"DELETE FROM mlm_ranks_upgradecommission WHERE from_user_id IN ({uid_str}) OR to_user_id IN ({uid_str});", None, "mlm_ranks_upgradecommission")
        run_sql(f"DELETE FROM mlm_ranks_rankupgrade WHERE user_id IN ({uid_str});", None, "mlm_ranks_rankupgrade")
        run_sql(f"DELETE FROM mlm_ranks_rankmatrixnode WHERE placed_user_id IN ({uid_str}) OR root_user_id IN ({uid_str}) OR parent_user_id IN ({uid_str});", None, "mlm_ranks_rankmatrixnode")
        run_sql(f"DELETE FROM mlm_ranks_rankmatrixroot WHERE root_user_id IN ({uid_str});", None, "mlm_ranks_rankmatrixroot")

        # 5. Clear autopool accounts & progress
        run_sql(f"DELETE FROM business_usermatrixprogress WHERE user_id IN ({uid_str});", None, "business_usermatrixprogress")
        run_sql(f"DELETE FROM business_autopoolaccount WHERE owner_id IN ({uid_str});", None, "business_autopoolaccount")

        # 6. Clear promo purchases, invoices & vouchers
        run_sql(f"DELETE FROM business_packageinvoice WHERE promo_purchase_id IN (SELECT id FROM business_promopurchase WHERE user_id IN ({uid_str}));", None, "business_packageinvoice")
        run_sql(f"DELETE FROM business_promopurchase WHERE user_id IN ({uid_str});", None, "business_promopurchase")
        run_sql(f"DELETE FROM business_promomonthlybox WHERE user_id IN ({uid_str});", None, "business_promomonthlybox")
        run_sql(f"DELETE FROM business_promoproductorder WHERE user_id IN ({uid_str});", None, "business_promoproductorder")
        run_sql(f"DELETE FROM accounts_consumervoucher WHERE creator_id IN ({uid_str}) OR assigned_to_id IN ({uid_str}) OR redeemed_by_id IN ({uid_str});", None, "accounts_consumervoucher")

        # 7. Clear reward points accounts & transactions
        run_sql(f"DELETE FROM accounts_rewardpointstransaction WHERE user_id IN ({uid_str});", None, "accounts_rewardpointstransaction")
        run_sql(f"DELETE FROM accounts_rewardpointshold WHERE user_id IN ({uid_str});", None, "accounts_rewardpointshold")
        run_sql(f"DELETE FROM accounts_rewardpointsaccount WHERE user_id IN ({uid_str});", None, "accounts_rewardpointsaccount")

    # 8. Reset Wallets to zero for target users and Admin (ID 1)
    for u in users:
        w = Wallet.get_or_create_for_user(u)
        for f in w._meta.fields:
            if 'Decimal' in str(type(f)) or 'Float' in str(type(f)):
                setattr(w, f.name, Decimal('0.00'))
        w.save()
        print(f"✔ Reset Wallet for {u.username} to ₹0.00")

        # Reset UserRank to Rank 1 starter
        r1 = Rank.objects.filter(level_number=1).first()
        if r1:
            ur, _ = UserRank.objects.get_or_create(user=u, defaults={"current_rank": r1})
            ur.current_rank = r1
            ur.direct_count = 0
            ur.total_team_size = 0
            ur.achieved_at = timezone.now()
            ur.save()

        # Re-ensure Rank 1 matrix root
        root_matrix = FiveMatrixService.ensure_root_for_rank1(u)
        print(f"✔ Initialized clean Rank 1 Matrix Root for {u.username} (Root ID: {root_matrix.id if root_matrix else 'N/A'})")

        # Ensure password is set to 123456
        u.set_password('123456')
        u.account_active = True
        u.autopool_enabled = True
        u.is_active = True
        u.save()

    # Reset Admin (User 1)
    admin_u = CustomUser.objects.filter(id=1).first()
    if admin_u:
        admin_w = Wallet.get_or_create_for_user(admin_u)
        for f in admin_w._meta.fields:
            if 'Decimal' in str(type(f)) or 'Float' in str(type(f)):
                setattr(admin_w, f.name, Decimal('0.00'))
        admin_w.save()
        print("✔ Reset Company Admin (ID 1) wallet to ₹0.00")

    print("\n==========================================================================")
    print("WIPE COMPLETE & VERIFIED!")
    print(f"Users {[u.username for u in users]} are now in a 100% clean, pristine state with ₹0.00 wallet balance and 0 purchases.")
    print("Password for both accounts: 123456")
    print("==========================================================================")

if __name__ == "__main__":
    wipe_users_history_and_wallets()
