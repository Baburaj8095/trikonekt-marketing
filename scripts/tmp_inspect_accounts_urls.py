import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

script_content = """
with open('/srv/trikonekt/staging/backend/accounts/urls.py') as f:
    print('accounts/urls.py:')
    print(f.read())
"""

if __name__ == "__main__":
    run_remote(script_content)
