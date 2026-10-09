
import re

with open("/srv/trikonekt/staging/backend/accounts/views.py", "r", encoding="utf-8") as f:
    text = f.read()

# search for history or main_income_balance
matches = [m.start() for m in re.finditer(r'main_income_balance', text)]
for idx in matches:
    start = max(0, idx - 400)
    end = min(len(text), idx + 800)
    print("=== MATCH FOR main_income_balance ===")
    print(text[start:end])
