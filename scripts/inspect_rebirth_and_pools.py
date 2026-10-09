import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
remote_cmd = r"""
sudo /srv/trikonekt/staging/backend/.venv/bin/python - << 'EOF'
import sys, os, traceback
sys.path.insert(0, '/srv/trikonekt/staging/backend')

try:
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

    from accounts.models import WalletTransaction

    pts = list(WalletTransaction.objects.filter(source_type='DAILY_POOL_DISTRIBUTION').order_by('-id'))
    print(f"Total DAILY_POOL_DISTRIBUTION: {len(pts)}")
    for pt in pts:
        print(f"  ID: {pt.id}, type='{pt.type}', source_id='{pt.source_id}', amount={pt.amount}, date={pt.created_at}")

    # Check if any have type='GLOBAL_ROYALTY'
    grs = list(WalletTransaction.objects.filter(type='GLOBAL_ROYALTY'))
    print(f"\nTotal with type='GLOBAL_ROYALTY': {len(grs)}")

except Exception as e:
    traceback.print_exc()
EOF
"""

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", "ubuntu@65.0.40.184", remote_cmd]
res = subprocess.run(cmd, capture_output=True, text=True)
print("STDOUT:")
print(res.stdout)
if res.stderr:
    print("STDERR:")
    print(res.stderr)
