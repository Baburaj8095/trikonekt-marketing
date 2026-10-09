import subprocess
import base64

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

DJANGO_PREAMBLE = """import os, sys
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()
"""

def run_remote(code, use_django=True):
    full_code = (DJANGO_PREAMBLE + code) if use_django and "django.setup()" not in code else code
    remote_cmd = "sudo tee /tmp/exec_tmp.py > /dev/null && sudo env $(sudo cat /etc/trikonekt/staging-backend.env | xargs) /srv/trikonekt/staging/backend/.venv/bin/python /tmp/exec_tmp.py"
    cmd = [
        "ssh",
        "-i", ssh_key,
        "-o", "StrictHostKeyChecking=no",
        f"{ec2_user}@{ec2_ip}",
        remote_cmd
    ]
    res = subprocess.run(cmd, input=full_code, capture_output=True, text=True, encoding="utf-8")

    safe_stdout = res.stdout.encode("ascii", errors="replace").decode("ascii") if res.stdout else ""
    safe_stderr = res.stderr.encode("ascii", errors="replace").decode("ascii") if res.stderr else ""
    print("STDOUT:\n", safe_stdout)
    if safe_stderr:
        print("STDERR:\n", safe_stderr)
    return res




if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        run_remote(sys.argv[1], use_django=True)
    else:
        run_remote("print('Remote helper working!')", use_django=False)
