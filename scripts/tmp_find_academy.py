
import json
import sqlite3
import os

print("--- Searching for academy db or data ---")
for root, dirs, files in os.walk("/srv/trikonekt/tri-academy"):
    for f in files:
        if f.endswith(".db") or f.endswith(".sqlite") or f.endswith(".sqlite3") or f.endswith(".json"):
            print("Found:", os.path.join(root, f))
