from scripts.run_remote_helper import run_remote

VERIFY_AGENCIES_SCRIPT = """
from accounts.models import CustomUser, Wallet, WalletTransaction

agency_phones = ['9800000001', '9800000002', '9800000003', '9800000004', '9800000005', '9800000006']
users = list(CustomUser.objects.filter(phone__in=agency_phones).order_by('id'))

print("=== AGENCY WALLET VERIFICATION ===")
for u in users:
    w = Wallet.objects.filter(user=u).first()
    tx_count = WalletTransaction.objects.filter(user=u).count()
    print(f"{u.username} ({u.phone}): Balance=₹{w.balance if w else 0.00}, Main=₹{w.main_balance if w else 0.00}, TxCount={tx_count}")
"""

if __name__ == "__main__":
    run_remote(VERIFY_AGENCIES_SCRIPT)
