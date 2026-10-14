import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from django.db import transaction, connection
from decimal import Decimal
from accounts.models import CustomUser, Wallet, WalletAccount, WalletTransaction, RewardPointsAccount, RewardPointsTransaction
from business.models import AutoPoolAccount, PromoPurchase, PromoMonthlyBox, UserMatrixProgress, SSVVoucher, StateSSVPool
from mlm_ranks.models import RankUpgrade, UpgradeCommission, RankMatrixNode, RankUpgradePayment
from coupons.models import AuditTrail

print("=== STARTING FULL ACTIVE USERS & SYSTEM RESET ===")

with transaction.atomic():
    cursor = connection.cursor()

    # 1. Non-sentinel AutoPoolAccount (5-Matrix and 3-Matrix) via direct SQL to avoid Django SET_NULL collector
    cursor.execute("DELETE FROM business_autopoolaccount WHERE id NOT IN (1, 2);")
    print(f"1. Deleted non-sentinel AutoPoolAccounts (kept sentinels 1 and 2).")

    # 1b. UserMatrixProgress
    d_prog = UserMatrixProgress.objects.all().delete()
    print(f"1b. Deleted UserMatrixProgress: {d_prog}")

    # 2. PromoMonthlyBox
    d_boxes = PromoMonthlyBox.objects.all().delete()
    print(f"2. Deleted PromoMonthlyBoxes: {d_boxes}")

    # 3. PromoPurchase
    d_purchases = PromoPurchase.objects.all().delete()
    print(f"3. Deleted PromoPurchases: {d_purchases}")

    # 4. MLM Ranks, Commissions, RankMatrixNode, RankUpgradePayment
    d_comm = UpgradeCommission.objects.all().delete()
    d_ranks = RankUpgrade.objects.all().delete()
    d_rnodes = RankMatrixNode.objects.all().delete()
    try:
        d_rpay = RankUpgradePayment.objects.all().delete()
    except Exception:
        d_rpay = (0, {})
    print(f"4. Deleted MLM Ranks & Commissions: comm={d_comm}, ranks={d_ranks}, nodes={d_rnodes}, pay={d_rpay}")

    # 5. SSV Vouchers & Pools
    d_vouchers = SSVVoucher.objects.all().delete()
    StateSSVPool.objects.all().update(accumulated_amount=Decimal('0.00'), seed_amount=Decimal('0.00'))
    print(f"5. Deleted SSVVouchers: {d_vouchers}, reset StateSSVPool accumulated amounts to 0.00")

    # 6. Wallet Transactions & Audits
    d_tx = WalletTransaction.objects.exclude(user__is_superuser=True).delete()
    d_audits = AuditTrail.objects.exclude(actor__is_superuser=True).delete()
    print(f"6. Deleted non-admin WalletTransactions: {d_tx}, AuditTrails: {d_audits}")

    # 7. Wallet & Pocket Balances for non-admin users
    non_admin_users = CustomUser.objects.exclude(role='admin').exclude(is_superuser=True)
    for u in non_admin_users:
        w = Wallet.objects.filter(user=u).first()
        if w:
            w.main_balance = Decimal('0.00')
            w.balance = Decimal('0.00')
            w.withdrawable_balance = Decimal('0.00')
            w.total_earnings = Decimal('0.00')
            w.total_withdrawn = Decimal('0.00')
            w.self_account_balance = Decimal('0.00')
            w.bonus_wallet = Decimal('0.00')
            for field in [
                'franchise_total_earning', 'franchise_active_work', 'franchise_inactive_work',
                'franchise_self_rebirth', 'franchise_company_marketing', 'franchise_reward_points',
                'franchise_shopping_scanner'
            ]:
                if hasattr(w, field):
                    setattr(w, field, Decimal('0.00'))
            w.save()

    WalletAccount.objects.filter(user__in=non_admin_users).update(
        current_balance=Decimal('0.00'),
        available_balance=Decimal('0.00'),
        pending_balance=Decimal('0.00'),
        locked_balance=Decimal('0.00')
    )

    RewardPointsTransaction.objects.filter(user__in=non_admin_users).delete()
    RewardPointsAccount.objects.filter(user__in=non_admin_users).update(
        balance_points=Decimal('0.00')
    )
    print("7. Reset Wallets, WalletAccounts, and RewardPoints to 0.00")

    from django.db.models import Q
    # 8. Reset CustomUser Status & Password for test users
    for phone in ['9999999999', '8095918105', '1000000101']:
        tu = CustomUser.objects.filter(Q(username=phone) | Q(phone=phone)).first()
        if tu:
            tu.account_active = False
            tu.is_active = True
            if hasattr(tu, 'current_rank'):
                tu.current_rank = None
            if hasattr(tu, 'current_rank_id'):
                tu.current_rank_id = None
            tu.set_password('123456')
            tu.save()
            print(f"8. Reset test user {phone} (ID {tu.id}): account_active=False, password=123456")

    # 9. Reset AutoPoolAccount database sequence to 3 (after Sentinels 1 and 2)
    cursor.execute("SELECT setval('business_autopoolaccount_id_seq', 2, true);")
    print("9. Reset business_autopoolaccount_id_seq to 2 (next ID will be 3)")

print("\n=== VERIFICATION AFTER RESET ===")
print("AutoPoolAccount count (should be 2 sentinels):", AutoPoolAccount.objects.count())
for s in AutoPoolAccount.objects.all():
    print(f"  Sentinel ID {s.id}: pool={s.pool_type}, owner={s.owner_id}")
print("PromoMonthlyBox count (should be 0):", PromoMonthlyBox.objects.count())
print("PromoPurchase count (should be 0):", PromoPurchase.objects.count())
print("SSVVoucher count (should be 0):", SSVVoucher.objects.count())
print("StateSSVPool total accumulated for Karnataka:", sum(p.total_accumulated() for p in StateSSVPool.objects.filter(state__name__icontains='Karnataka')))
print("=== RESET COMPLETED SUCCESSFULLY ===")
