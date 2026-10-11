import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_patch_code = r'''
import sys

models_path = "/srv/trikonekt/staging/backend/business/models.py"

with open(models_path, "r", encoding="utf-8") as f:
    content = f.read()

# Backup
with open(models_path + ".bak_3matrix", "w", encoding="utf-8") as f:
    f.write(content)
print("Backup created at", models_path + ".bak_3matrix")

# 1. Target block for create_three_150_for_user
target_1 = """        # Global pool placement: ignore sponsor anchor
        return GenericPlacement.place_account(
            owner=user,
            pool_type="THREE_150",
            amount=amt,
            source_type=source_type or "SYSTEM",
            source_id=source_id or "",
            start_entry_id=None,
        )"""

replacement_1 = """        # 1st entry anchors to sponsor's subtree; 2nd+ entries cluster under own base
        own_base = cls._base_self_account(user, "THREE_150")
        if own_base:
            start_id = int(own_base.id)
        else:
            start_id = cls._sponsor_start_entry_id_for(user, "THREE_150")

        if start_id is None:
            root = cls.objects.filter(parent_account__isnull=True, pool_type="THREE_150").first()
            start_id = root.id if root else None

        res = GenericPlacement.place_account(
            owner=user,
            pool_type="THREE_150",
            amount=amt,
            source_type=source_type or "SYSTEM",
            source_id=source_id or "",
            start_entry_id=start_id,
        )
        if res and getattr(res, "user_entry_index", 0) == 1:
            try:
                cls.reanchor_sponsored_downlines(user, "THREE_150")
            except Exception:
                pass
        return res"""

if target_1 not in content:
    print("[ERROR] target_1 not found in models.py!")
    sys.exit(1)

content = content.replace(target_1, replacement_1)
print("[SUCCESS] Replaced target_1 in create_three_150_for_user")

# 2. Target block for place_in_three_pool
target_2 = """        amt = D(amount or 0)
        start_id = None if str(pool_type) == "THREE_150" else cls._sponsor_start_entry_id_for(user, pool_type)
        return GenericPlacement.place_account(
            owner=user,
            pool_type=pool_type,
            amount=amt,
            source_type=source_type or "",
            source_id=source_id or "",
            start_entry_id=start_id,
        )"""

replacement_2 = """        amt = D(amount or 0)
        own_base = cls._base_self_account(user, pool_type)
        if own_base:
            start_id = int(own_base.id)
        else:
            start_id = cls._sponsor_start_entry_id_for(user, pool_type)
        return GenericPlacement.place_account(
            owner=user,
            pool_type=pool_type,
            amount=amt,
            source_type=source_type or "",
            source_id=source_id or "",
            start_entry_id=start_id,
        )"""

if target_2 not in content:
    print("[ERROR] target_2 not found in models.py!")
    sys.exit(1)

content = content.replace(target_2, replacement_2)
print("[SUCCESS] Replaced target_2 in place_in_three_pool")

with open(models_path, "w", encoding="utf-8") as f:
    f.write(content)
print("[SUCCESS] models.py updated successfully!")
'''

local_tmp = r"C:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\scripts\_tmp_patch.py"
with open(local_tmp, "w", encoding="utf-8") as f:
    f.write(remote_patch_code)

scp_cmd = [
    "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    local_tmp, f"ubuntu@{ec2_ip}:/tmp/patch_models.py"
]
subprocess.run(scp_cmd, check=True)

ssh_cmd = [
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"ubuntu@{ec2_ip}",
    "sudo python3 /tmp/patch_models.py && sudo /srv/trikonekt/staging/backend/.venv/bin/python -m py_compile /srv/trikonekt/staging/backend/business/models.py && sudo systemctl restart trikonekt-staging-web.service && sudo systemctl is-active trikonekt-staging-web.service"
]
res = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=30)
print("STDOUT:\n", res.stdout)
if res.stderr:
    print("STDERR:\n", res.stderr)
