import sys, os
from dotenv import load_dotenv

load_dotenv("/etc/trikonekt/staging-backend.env")
sys.path.append("/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django
django.setup()

from django.db import connection
from accounts.models import CustomUser

u = CustomUser.objects.filter(username="xavier-consumer").first()
if not u:
    print("User xavier-consumer not found or already deleted.")
else:
    uid = u.id
    print(f"Target user found: {u.username} (ID {uid})")
    with connection.cursor() as cur:
        cur.execute("SET session_replication_role = 'replica';")
        
        # 1. Delete user's matrix seats
        cur.execute(f"DELETE FROM business_autopoolaccount WHERE owner_id = {uid};")
        print("Deleted AutoPoolAccounts")
        
        # 2. Delete monthly box & purchases
        cur.execute(f"DELETE FROM business_promomonthlybox WHERE user_id = {uid};")
        cur.execute(f"DELETE FROM business_promopurchase WHERE user_id = {uid};")
        cur.execute(f"DELETE FROM business_usermatrixprogress WHERE user_id = {uid};")
        print("Deleted Promo / Matrix Progress")
        
        # 3. Delete Rank upgrades, commissions & nodes
        cur.execute(f"DELETE FROM mlm_ranks_rankmatrixnode WHERE placed_user_id = {uid} OR root_user_id = {uid} OR parent_user_id = {uid};")
        cur.execute(f"DELETE FROM mlm_ranks_commissionhold WHERE commission_id IN (SELECT id FROM mlm_ranks_upgradecommission WHERE from_user_id = {uid} OR to_user_id = {uid});")
        cur.execute(f"DELETE FROM mlm_ranks_upgradecommission WHERE from_user_id = {uid} OR to_user_id = {uid};")
        try:
            cur.execute(f"DELETE FROM mlm_ranks_rankupgradepayment WHERE rank_upgrade_id IN (SELECT id FROM mlm_ranks_rankupgrade WHERE user_id = {uid});")
        except Exception:
            pass
        cur.execute(f"DELETE FROM mlm_ranks_rankupgrade WHERE user_id = {uid};")
        cur.execute(f"DELETE FROM mlm_ranks_userrank WHERE user_id = {uid};")
        print("Deleted Rank / Commissions")
        
        # 4. Delete Reward Points
        try:
            cur.execute(f"DELETE FROM accounts_rewardpointstransaction WHERE user_id = {uid};")
        except Exception:
            pass
        try:
            cur.execute(f"DELETE FROM accounts_rewardpointsaccount WHERE user_id = {uid};")
        except Exception:
            pass
        print("Deleted Reward Points")
        
        # 5. Delete Wallet Transactions & Wallet
        cur.execute(f"DELETE FROM accounts_wallettransaction WHERE user_id = {uid};")
        cur.execute(f"DELETE FROM accounts_wallet WHERE user_id = {uid};")
        print("Deleted Wallet & Transactions")
        
        # 6. Delete user
        cur.execute(f"DELETE FROM accounts_customuser WHERE id = {uid};")
        print(f"Deleted CustomUser {uid}")
        
        cur.execute("SET session_replication_role = 'origin';")

    print(f"User {uid} purged successfully!")
