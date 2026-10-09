import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

code = """
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.services.self_rebirth import distribute_self_rebirth_250


print('=== WALLETS & SELF ACCOUNT POCKET BALANCES ===')
users = CustomUser.objects.filter(id__in=[1, 1046, 1047, 1048]).select_related('wallet')
for u in CustomUser.objects.filter(account_active=True).exclude(role='admin'):
    w = getattr(u, 'wallet', None)
    if w:
        print(f"User: {u.username} ({u.phone}) | Main Balance: {w.balance} | Self Account: {w.self_account_balance} | Total Earned: {getattr(w, 'total_earned', None)}")


print('\\n=== RECENT REBIRTH TRANSACTIONS (SELF_ACCOUNT_DEBIT) ===')
rebirths = WalletTransaction.objects.filter(type='SELF_ACCOUNT_DEBIT', source_type='SELF_250_PACK').order_by('-created_at')[:10]
for r in rebirths:
    print(f"{r.created_at} | User: {r.user.username} | Amount: {r.amount} | Meta: {r.meta}")
"""

run_remote(code)
