import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from decimal import Decimal
from django.contrib.auth import get_user_model
from accounts.models import WalletTransaction, WalletAccount, Wallet

User = get_user_model()
u78 = User.objects.get(id=78)
w78_legacy = Wallet.objects.get(user=u78)
w78_acc_main = WalletAccount.objects.filter(user=u78, wallet_type='MAIN').first()
w78_acc_self = WalletAccount.objects.filter(user=u78, wallet_type='SELF_PACKAGE_POCKET').first()

print(f"Legacy Wallet: balance={w78_legacy.balance}, main_balance={w78_legacy.main_balance}, self_package={w78_legacy.self_account_balance}")
print(f"WalletAccount Main: {w78_acc_main.current_balance if w78_acc_main else None}")
print(f"WalletAccount Self: {w78_acc_self.current_balance if w78_acc_self else None}")

txs = WalletTransaction.objects.filter(user=u78).order_by('id')
print(f"Total transactions for 9999999999: {txs.count()}")

sim_main = Decimal('0.00')
sim_self = Decimal('0.00')
for tx in txs:
    amt = Decimal(str(tx.amount))
    tx_type = tx.type
    prev_m = sim_main
    prev_s = sim_self
    # calculate
    if tx_type in [
        'INCOME_CREDIT_75', 'DIRECT_REF_BONUS', 'WELCOME_BONUS', 'LEVEL_BONUS',
        'AUTOPOOL_BONUS_FIVE', 'AUTOPOOL_BONUS_THREE', 'GLOBAL_ROYALTY',
        'LIFETIME_WITHDRAWAL_BONUS', 'REWARD_CREDIT', 'FRANCHISE_INCOME',
        'COMMISSION_CREDIT', 'ADJUSTMENT_CREDIT', 'VOUCHER_REDEEM_CREDIT',
        'ADD_MONEY_CREDIT', 'PRIME_750_DIRECT', 'MONTHLY_759_DIRECT',
        'PRIME_750_SELF', 'MONTHLY_759_SELF', 'MONTHLY_759_LEVEL'
    ] and amt > 0:
        sim_main += amt
    elif tx_type in [
        'WITHDRAWAL_WALLET_TRANSFER_OUT', 'COUPON_WALLET_TRANSFER_OUT',
        'ADJUSTMENT_DEBIT', 'INTERNAL_WALLET_TRANSFER_OUT',
        'PACKAGE_COUPON_WALLET_DEBIT', 'PACKAGE_PURCHASE_DEBIT'
    ]:
        sim_main = max(Decimal('0.00'), sim_main - abs(amt))
    elif tx_type == 'INTERNAL_WALLET_DEBIT':
        wallet_source = (tx.meta or {}).get('wallet_source') or ''
        if wallet_source == 'internal':
            sim_main = max(Decimal('0.00'), sim_main - abs(amt))
            
    if tx_type == 'SELF_ACCOUNT_CREDIT':
        sim_self += amt
    elif tx_type in ['SELF_ACCOUNT_DEBIT', 'AUTO_PURCHASE_DEBIT']:
        sim_self = max(Decimal('0.00'), sim_self - abs(amt))
    
    print(f"TX #{tx.id} | {tx_type:24s} | {amt:8.2f} | main: {prev_m}->{sim_main} | self: {prev_s}->{sim_self} | meta: {tx.meta}")

print(f"\nSimulated Main: {sim_main}, Simulated Self: {sim_self}, Total Simulated: {sim_main + sim_self}")
print(f"Stored Legacy Balance: {w78_legacy.balance}")
print(f"Difference (Stored - Simulated): {w78_legacy.balance - (sim_main + sim_self)}")
