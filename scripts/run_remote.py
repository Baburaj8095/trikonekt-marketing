import subprocess
import sys

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

def run_remote_command(bash_script):
    full_cmd = f"sudo bash -c 'set -a && source /etc/trikonekt/staging-backend.env && set +a && {bash_script}'"
    res = subprocess.run(
        ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", full_cmd],
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=60
    )
    return res.stdout, res.stderr

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "/srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/staging/backend/manage.py showmigrations"
    out, err = run_remote_command(cmd)
    print("STDOUT:\n", out[:1500])
    if err:
        print("STDERR:\n", err[:500])
