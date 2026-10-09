import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

code = """
from business.models import CommissionConfig
import json

cfg = CommissionConfig.get_solo()
master = dict(getattr(cfg, 'master_commission_json', {}) or {})

print('=== PRODUCT 750 CONFIG ===')
print(json.dumps(master.get('products', {}).get('750', {}), indent=2))

print('\\n=== PRODUCT 759 (SPP 1000) CONFIG ===')
print(json.dumps(master.get('products', {}).get('759', {}), indent=2))
"""

run_remote(code)
