import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_code = """
set -a
source /etc/trikonekt/staging-backend.env
set +a
cd /srv/trikonekt/staging/backend
/srv/trikonekt/staging/backend/.venv/bin/python << 'EOF'
import sys, os
sys.path.insert(0, "/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django
django.setup()

from decimal import Decimal
from accounts.models import CustomUser, Wallet, WalletTransaction

user = CustomUser.objects.filter(username="8095918103").first()
if user:
    w = Wallet.get_or_create_for_user(user)
    print("Old Balance:", w.balance, "Main Balance:", getattr(w, "main_balance", 0))
    # Add 2130 (1200 admin voucher + 930 p2p voucher)
    w.balance = (w.balance + Decimal("2130.00")).quantize(Decimal("0.01"))
    if hasattr(w, "main_balance"):
        w.main_balance = (w.main_balance + Decimal("2130.00")).quantize(Decimal("0.01"))
    w.save()
    print("New Balance:", w.balance, "Main Balance:", getattr(w, "main_balance", 0))

    WalletTransaction.objects.create(
        user=user,
        amount=Decimal("2130.00"),
        balance_after=w.balance,
        type="VOUCHER_REDEEM_CREDIT",
        source_type="CONSUMER_VOUCHER",
        meta={
            "description": "Retroactive Main Wallet Credit for Redeemed Vouchers (PKG-53BF758F ₹930 + PKG380019 ₹1200)",
            "destination_wallet": "MAIN"
        }
    )
    print("Successfully credited 2130.00 to 8095918103!")
EOF
"""

ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    remote_code
]
subprocess.run(ssh_cmd, check=True)
