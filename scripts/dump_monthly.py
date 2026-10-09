p = "/srv/trikonekt/staging/backend/business/services/monthly.py"
with open(p, "r", encoding="utf-8") as f:
    lines = f.readlines()

with open("/tmp/monthly_lines.txt", "w", encoding="utf-8") as out:
    for i in range(min(120, len(lines))):
        out.write(f"{i+1}: {lines[i]}")
