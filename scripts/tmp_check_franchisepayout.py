import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

script_content = """
from business.models import FranchisePayout
for f in FranchisePayout._meta.fields:
    print(f.name, f.get_internal_type(), getattr(f, 'max_length', None))
"""

if __name__ == "__main__":
    run_remote(script_content)
