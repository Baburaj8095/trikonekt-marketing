import os
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

admin_dir = r'frontend/src/pages/admin'
found = []
for root, dirs, files in os.walk(admin_dir):
    for f in files:
        if f.endswith('.jsx'):
            p = os.path.join(root, f)
            with open(p, 'r', encoding='utf-8', errors='ignore') as fl:
                lines = fl.readlines()
            for idx, line in enumerate(lines):
                if re.search(r'\b(Matrix|Matrices)\b', line) or re.search(r'\b(Level|Levels)\b', line):
                    # check if visible
                    s = line.strip()
                    if any(k in s for k in ['<', 'title', 'label', 'placeholder', 'header', 'Header', 'name:', 'text', 'Card', 'Badge', 'Tab', 'Button', 'description', 'subtitle']):
                        if not '/api/' in s and not 'API.' in s and not 'navigate(' in s and not 'to="/' in s:
                            found.append((f, idx + 1, s))

print(f"Total visible candidate lines: {len(found)}")
for f, lno, txt in found[:40]:
    print(f"{f}:{lno} -> {txt[:120]}")
