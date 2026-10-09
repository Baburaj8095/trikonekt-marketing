import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

script_content = """
from adminapi.views import AdminUsersList
print('AdminUsersList methods:', [m for m in dir(AdminUsersList) if not m.startswith('__')])
"""

if __name__ == "__main__":
    run_remote(script_content)
