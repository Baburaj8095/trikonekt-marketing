import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

script_content = """
import inspect
from accounts.models import Wallet
print(inspect.getsource(Wallet.credit))
"""

if __name__ == "__main__":
    run_remote(script_content)
