import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_code = '''
import os, sys
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "trikonekt.settings.staging")
sys.path.insert(0, "/srv/trikonekt/staging/backend")

import django
django.setup()

from django.urls import get_resolver
resolver = get_resolver()

def print_urls(urlpatterns, prefix=""):
    for pattern in urlpatterns:
        if hasattr(pattern, "url_patterns"):
            print_urls(pattern.url_patterns, prefix + str(pattern.pattern))
        else:
            p_str = prefix + str(pattern.pattern)
            if any(k in p_str for k in ["admin", "login", "2fa", "totp", "otp"]):
                print(p_str)

print_urls(resolver.url_patterns)
'''

# write remote_code to /tmp/inspect_urls.py on EC2 and run it
scp_cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/inspect_urls.py\n{remote_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/inspect_urls.py"]
res = subprocess.run(scp_cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)
