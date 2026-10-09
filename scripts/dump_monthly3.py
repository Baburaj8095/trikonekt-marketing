p = "/srv/trikonekt/staging/backend/business/services/monthly.py"
lines = open(p).readlines()
with open("/tmp/monthly_lines3.txt", "w") as out:
    for i in range(410, min(530, len(lines))):
        out.write(f"{i+1}: {lines[i]}")
