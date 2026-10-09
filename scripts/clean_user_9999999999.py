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

def clean_all_test_data():
    print("=== FINAL CLEANUP FOR USER 9999999999 & TEST DOWNLINES ===")
    
    with connection.cursor() as cursor:
        # Delete holds & commissions first across all test upgrades
        cursor.execute("DELETE FROM mlm_ranks_commissionhold;")
        cursor.execute("DELETE FROM mlm_ranks_upgradecommission;")
        cursor.execute("DELETE FROM mlm_ranks_rankupgrade;")
        cursor.execute("DELETE FROM mlm_ranks_rankmatrixnode;")
        cursor.execute("DELETE FROM mlm_ranks_rankmatrixroot;")
        print("1. Deleted all rank matrix nodes, roots, upgrades, commissions & holds")

        # Delete test_downline_1 user
        d1 = CustomUser.objects.filter(username="test_downline_1").first()
        if d1:
            cursor.execute("DELETE FROM accounts_wallettransaction WHERE user_id = %s;", [d1.id])
            d1.delete()
            print("2. Deleted test_downline_1 user")

        # Reset user 9999999999 (ID 2)
        user = CustomUser.objects.filter(phone="9999999999").first() or CustomUser.objects.filter(username="9999999999").first()
        if user:
            user_id = user.id
            r1 = Rank.objects.filter(level_number=1).first()
            if r1:
                ur, _ = UserRank.objects.get_or_create(user=user, defaults={"current_rank": r1})
                ur.current_rank = r1
                ur.direct_count = 0
                ur.total_team_size = 0
                ur.achieved_at = timezone.now()
                ur.save()

            for uid in [user_id, 1]:
                cursor.execute("""
                    DELETE FROM accounts_ledgerentry 
                    WHERE financial_transaction_id IN (
                        SELECT id FROM accounts_financialtransaction 
                        WHERE user_id = %s OR legacy_wallet_transaction_id IN (SELECT id FROM accounts_wallettransaction WHERE user_id = %s)
                    );
                """, [uid, uid])
                cursor.execute("""
                    DELETE FROM accounts_financialtransaction 
                    WHERE user_id = %s OR legacy_wallet_transaction_id IN (SELECT id FROM accounts_wallettransaction WHERE user_id = %s);
                """, [uid, uid])
                cursor.execute("DELETE FROM accounts_wallettransaction WHERE user_id = %s;", [uid])

            w = Wallet.objects.filter(user=user).first()
            if w:
                w.balance = Decimal("0.00")
                w.franchise_total_earning = Decimal("0.00")
                w.franchise_active_work = Decimal("0.00")
                w.franchise_inactive_work = Decimal("0.00")
                w.franchise_self_rebirth = Decimal("0.00")
                w.franchise_company_marketing = Decimal("0.00")
                w.franchise_reward_points = Decimal("0.00")
                w.franchise_shopping_scanner = Decimal("0.00")
                w.save()

            admin_w = Wallet.objects.filter(user_id=1).first()
            if admin_w:
                admin_w.balance = Decimal("0.00")
                admin_w.franchise_total_earning = Decimal("0.00")
                admin_w.franchise_active_work = Decimal("0.00")
                admin_w.franchise_inactive_work = Decimal("0.00")
                admin_w.franchise_self_rebirth = Decimal("0.00")
                admin_w.franchise_company_marketing = Decimal("0.00")
                admin_w.franchise_reward_points = Decimal("0.00")
                admin_w.franchise_shopping_scanner = Decimal("0.00")
                admin_w.save()

            print("3. User 9999999999 and Admin / Overflow Box are pristine and reset to 0.00")

    print("\n=== SYSTEM IS PRISTINE AND READY FOR LIVE PRODUCTION ===")

if __name__ == "__main__":
    clean_all_test_data()
