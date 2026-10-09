import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

script_content = """
with open('/srv/trikonekt/staging/backend/business/models.py') as f:
    lines = f.readlines()
for i in range(1568, min(1620, len(lines))):
    print(f"{i+1}: {lines[i]}", end='')
"""

if __name__ == "__main__":
    run_remote(script_content)
