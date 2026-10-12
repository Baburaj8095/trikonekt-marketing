import sys, os
env_path = "/etc/trikonekt/staging-backend.env"
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from decimal import Decimal
from django.db import transaction, connection
from django.utils import timezone
from accounts.models import CustomUser, Wallet, WalletAccount, WalletTransaction, RewardPointsAccount, RewardPointsTransaction
from business.models import AutoPoolAccount, RootConsumerConfig, CommissionConfig, PromoPurchase, PromoMonthlyBox, UserMatrixProgress, SSVVoucher, StateSSVPool
from mlm_ranks.models import RankUpgrade, UpgradeCommission, RankMatrixNode, RankUpgradePayment
from coupons.models import AuditTrail

print("=== SETTING 9999999999 AS THE ONLY ROOT ID & PURGING SYSTEM ===")

with transaction.atomic():
    cursor = connection.cursor()

    # 1. Fetch Root User 9999999999
    u_root = CustomUser.objects.filter(username="9999999999").first()
    if not u_root:
        raise RuntimeError("User 9999999999 not found!")

    u_root.account_active = True
    u_root.is_active = True
    u_root.registered_by = None
    u_root.set_password("123456")
    u_root.save()
    print(f"1. Verified Root User 9999999999 (ID {u_root.id}): registered_by=None, account_active=True")

    # 2. Configure RootConsumerConfig
    rc = RootConsumerConfig.get_solo()
    rc.root_user = u_root
    rc.save()
    print(f"2. Set RootConsumerConfig root_user to {u_root.username} (ID {u_root.id})")

    # 3. Purge all non-sentinel AutoPoolAccounts
    cursor.execute("DELETE FROM business_autopoolaccount WHERE id NOT IN (1, 2);")
    print("3. Deleted all non-sentinel AutoPoolAccounts.")

    # 4. Configure Sentinel Root #1 (FIVE_150) owned exclusively by 9999999999
    acc1 = AutoPoolAccount.objects.filter(id=1).first()
    if not acc1:
        acc1 = AutoPoolAccount(id=1)
    acc1.owner = u_root
    acc1.username_key = "9999999999"
    acc1.entry_amount = Decimal("750.00")
    acc1.pool_type = "FIVE_150"
    acc1.status = "ACTIVE"
    acc1.user_entry_index = 1
    acc1.position = None
    acc1.parent_account = None
    acc1.level = 0
    acc1.source_type = "PRIME_750"
    acc1.source_id = "ROOT"
    acc1.save()
    print("4. Sentinel #1 (FIVE_150) updated: owner=9999999999, user_entry_index=1, parent=None, status=ACTIVE")

    # 5. Configure Sentinel Root #2 (THREE_150) owned exclusively by 9999999999
    acc2 = AutoPoolAccount.objects.filter(id=2).first()
    if not acc2:
        acc2 = AutoPoolAccount(id=2)
    acc2.owner = u_root
    acc2.username_key = "9999999999"
    acc2.entry_amount = Decimal("750.00")
    acc2.pool_type = "THREE_150"
    acc2.status = "ACTIVE"
    acc2.user_entry_index = 1
    acc2.position = None
    acc2.parent_account = None
    acc2.level = 0
    acc2.source_type = "PRIME_750"
    acc2.source_id = "ROOT"
    acc2.save()
    print("5. Sentinel #2 (THREE_150) updated: owner=9999999999, user_entry_index=1, parent=None, status=ACTIVE")

    # 6. Reset database sequence to 2 (next created account will be ID 3)
    cursor.execute("SELECT setval('business_autopoolaccount_id_seq', 2, true);")
    print("6. Reset business_autopoolaccount_id_seq to 2.")

    # 7. Clean up matrix progress, promo purchases, monthly boxes, rank nodes
    UserMatrixProgress.objects.all().delete()
    PromoMonthlyBox.objects.all().delete()
    PromoPurchase.objects.all().delete()
    UpgradeCommission.objects.all().delete()
    RankUpgrade.objects.all().delete()
    RankMatrixNode.objects.all().delete()
    try:
        RankUpgradePayment.objects.all().delete()
    except Exception:
        pass
    SSVVoucher.objects.all().delete()
    StateSSVPool.objects.all().update(accumulated_amount=Decimal('0.00'), seed_amount=Decimal('0.00'))
    print("7. Cleaned UserMatrixProgress, PromoMonthlyBoxes, PromoPurchases, MLM Ranks, and SSVVouchers.")

    # 8. Reset Wallets & Balances
    WalletTransaction.objects.exclude(user__is_superuser=True).delete()
    AuditTrail.objects.exclude(actor__is_superuser=True).delete()

    WalletAccount.objects.all().update(
        current_balance=Decimal('0.00'),
        available_balance=Decimal('0.00'),
        pending_balance=Decimal('0.00'),
        locked_balance=Decimal('0.00')
    )
    for w in Wallet.objects.all():
        w.main_balance = Decimal('0.00')
        w.balance = Decimal('0.00')
        w.withdrawable_balance = Decimal('0.00')
        w.total_earnings = Decimal('0.00')
        w.total_withdrawn = Decimal('0.00')
        w.self_account_balance = Decimal('0.00')
        w.bonus_wallet = Decimal('0.00')
        w.save()
    print("8. Reset all user wallet balances to 0.00.")

    # 9. Reset test candidate 8095918105
    u_cand = CustomUser.objects.filter(username="8095918105").first()
    if u_cand:
        u_cand.account_active = False
        u_cand.is_active = True
        u_cand.registered_by = u_root
        u_cand.set_password("123456")
        u_cand.save()
        print("9. Reset test user 8095918105: account_active=False, registered_by=9999999999, password=123456")

    # 10. Execute 24-hour Washout on Company Overhead Wallet
    cfg = CommissionConfig.get_solo()
    company_user = cfg.get_company_user() or CustomUser.objects.filter(category="company").first()
    if company_user:
        cutoff = timezone.now() - timezone.timedelta(hours=24)
        d_tx = WalletTransaction.objects.filter(user=company_user, created_at__lt=cutoff).delete()
        print(f"10. 24-Hour Overhead Washout executed for {company_user.username}: deleted {d_tx} transactions older than 24h.")

print("\n=== VERIFICATION ===")
print("RootConsumerConfig:", RootConsumerConfig.get_solo().get_root_user())
roots = list(AutoPoolAccount.objects.filter(parent_account__isnull=True))
print(f"Total Roots in AutoPoolAccount: {len(roots)}")
for r in roots:
    print(f"  Root ID {r.id}: pool={r.pool_type}, owner={r.owner.username}, key={r.username_key}, source={r.source_type}")
admin_accounts = AutoPoolAccount.objects.filter(owner__username="admin").count()
print(f"Admin accounts in AutoPoolAccount: {admin_accounts} (MUST BE 0)")
print("=== SETUP COMPLETED SUCCESSFULLY ===")
