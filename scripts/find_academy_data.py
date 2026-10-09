import subprocess

ssh_key_path = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

py_code = r"""
import json
import sqlite3
import os

print("--- Searching for academy db or data ---")
for root, dirs, files in os.walk("/srv/trikonekt/tri-academy"):
    for f in files:
        if f.endswith(".db") or f.endswith(".sqlite") or f.endswith(".sqlite3") or f.endswith(".json"):
            print("Found:", os.path.join(root, f))
"""

local_tmp_path = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\scripts\tmp_find_academy.py"
with open(local_tmp_path, "w", encoding="utf-8") as f:
    f.write(py_code)

subprocess.run([
    "scp", "-i", ssh_key_path, "-o", "StrictHostKeyChecking=no",
    local_tmp_path, f"{ec2_user}@{ec2_ip}:/tmp/tmp_find_academy.py"
], check=True)

remote_cmd = "python3 /tmp/tmp_find_academy.py"
res = subprocess.run([
    "ssh", "-i", ssh_key_path, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}", remote_cmd
], capture_output=True, text=True)

print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)
