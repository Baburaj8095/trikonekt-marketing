import os
import sys
import subprocess

target_script = sys.argv[1] if len(sys.argv) > 1 else "/tmp/inspect_user_earnings.py"

env = os.environ.copy()
with open("/etc/trikonekt/staging-backend.env") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()

p = subprocess.run(
    ["/srv/trikonekt/staging/backend/.venv/bin/python", "manage.py", "shell"],
    cwd="/srv/trikonekt/staging/backend",
    input=open(target_script).read(),
    text=True,
    capture_output=True,
    env=env,
)
print("STDOUT:\n", p.stdout)
if p.stderr:
    print("STDERR:\n", p.stderr)
