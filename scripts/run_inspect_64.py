import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"

remote_script = """import sys, os, traceback
sys.path.insert(0, '/srv/trikonekt/staging/backend')
if os.path.exists('/etc/trikonekt/staging-backend.env'):
    with open('/etc/trikonekt/staging-backend.env') as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                os.environ[k] = v

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from accounts.models import CustomUser, Wallet, WalletTransaction
from django.apps import apps

u = CustomUser.objects.filter(id=64).first()
if not u:
    print('User 64 not found')
    sys.exit(0)

print(f'User: id={u.id}, username={u.username}, phone={u.phone}, role={u.role}, is_active={u.is_active}')

w = Wallet.objects.filter(user=u).first()
if w:
    print(f'Wallet: main_balance={w.main_balance}, self={w.self_account_balance}, withdrawable={w.withdrawable_balance}')
    for f in w._meta.fields:
        val = getattr(w, f.name)
        if val is not None and val != 0 and val != '' and val is not False:
            print(f'   {f.name}: {val}')

print('--- Transactions for user 64 ---')
for wt in WalletTransaction.objects.filter(user=u).order_by('id'):
    print(f'WT {wt.id}: type={wt.type}, amount={wt.amount}, bal_after={wt.balance_after}, source_type={wt.source_type}, source_id={wt.source_id}, meta={wt.meta}, created={wt.created_at}')

for m in apps.get_models():
    if 'voucher' in m.__name__.lower():
        v = m.objects.filter(code__icontains='122115').first()
        if v:
            print(f'Voucher found in {m.__name__}:')
            for k, val in v.__dict__.items():
                if not k.startswith('_'):
                    print(f'   {k}: {val}')
"""

# Copy script to remote and execute
with open("scripts/tmp_inspect_64.py", "w", encoding="utf-8") as f:
    f.write(remote_script)

scp_cmd = ["scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", "scripts/tmp_inspect_64.py", "ubuntu@65.0.40.184:/tmp/inspect_64.py"]
subprocess.run(scp_cmd, check=True)

exec_cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", "ubuntu@65.0.40.184", "sudo /srv/trikonekt/staging/backend/.venv/bin/python /tmp/inspect_64.py"]
res = subprocess.run(exec_cmd, capture_output=True, text=True)
print("STDOUT:")
print(res.stdout)
if res.stderr:
    print("STDERR:")
    print(res.stderr)
