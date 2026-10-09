p = "/srv/trikonekt/staging/backend/business/services/commission_policy.py"
lines = open(p).readlines()
with open("/tmp/policy_lines2.txt", "w") as out:
    for i in range(200, min(330, len(lines))):
        out.write(f"{i+1}: {lines[i]}")
