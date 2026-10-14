import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

FRONTEND_DIRS = [
    r"frontend\src",
    r"tri-business\tri-business\src",
    r"tri-consumer\tri-consumer\src",
    r"tri-academy\frontend\src",
]

PATTERNS = [
    (re.compile(r"\b(wallet|balance|amount|total|credit|debit)\s*[\+\-]\s*(wallet|balance|amount|total|credit|debit)", re.IGNORECASE), "Client-Side Balance/Amount Arithmetic"),
    (re.compile(r"\b(cart|items|order)\s*\.\s*(reduce|map|forEach)\s*\(", re.IGNORECASE), "Client-Side Cart/Order Aggregation"),
    (re.compile(r"(available_balance|wallet_balance|balance)\s*<\s*(amount|withdraw|req)", re.IGNORECASE), "Client-Side Withdrawal Eligibility Check"),
    (re.compile(r"(total|amount|balance)\s*=\s*.*(reduce|filter|map)", re.IGNORECASE), "Derived Financial Total from Array"),
    (re.compile(r"(commission|cashback|royalty|bonus)\s*=\s*.*\*.*0\.", re.IGNORECASE), "Derived Commission/Bonus Percentage"),
]

findings = []

for fdir in FRONTEND_DIRS:
    if not os.path.exists(fdir):
        continue
    for root, dirs, files in os.walk(fdir):
        if any(skip in root for skip in ["node_modules", ".git", "build", "dist"]):
            continue
        for file in files:
            if not file.endswith((".js", ".jsx", ".ts", ".tsx")):
                continue
            fpath = os.path.join(root, file)
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
                for idx, line in enumerate(lines, 1):
                    for pat, desc in PATTERNS:
                        if pat.search(line):
                            findings.append({
                                "file": fpath,
                                "line": idx,
                                "content": line.strip(),
                                "type": desc
                            })
            except Exception:
                pass

print(f"Total arithmetic/eligibility findings: {len(findings)}")
for f in findings[:40]:
    print(f"[{f['type']}] {f['file']}:{f['line']}: {f['content']}")
if len(findings) > 40:
    print(f"... and {len(findings) - 40} more")
