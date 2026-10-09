import os
import sys
import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

script = """
set -e
cat << 'EOF' > /tmp/check_banners.py
import os, sys, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
django.setup()
from business.models import TeamConsumerWishingBanner
banners = TeamConsumerWishingBanner.objects.all()
print('COUNT:', banners.count())
for b in banners:
    url = None
    try:
        url = b.image.url if b.image else None
    except Exception as e:
        url = f'ERROR: {e}'
    print(b.id, b.title, b.is_active, 'RAW_STR:', repr(str(b.image)), 'URL:', url)
EOF

set -a
source /etc/trikonekt/staging-backend.env
set +a
/srv/trikonekt/staging/backend/.venv/bin/python /tmp/check_banners.py
rm -f /tmp/check_banners.py
"""

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"{ec2_user}@{ec2_ip}", f"sudo bash -c {repr(script)}"]
res = subprocess.run(cmd, capture_output=True, text=True)
print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)
