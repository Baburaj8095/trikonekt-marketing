p = "/srv/trikonekt/tri-academy/backend/src/scripts/growth_bridge_exec.py"
with open(p, "r", encoding="utf-8") as f:
    lines = f.readlines()

with open("/tmp/bridge_lines.txt", "w", encoding="utf-8") as out:
    for i in range(125, min(235, len(lines))):
        out.write(f"{i+1}: {lines[i]}")
