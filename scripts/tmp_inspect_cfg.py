import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

code = """
from business.models import CommissionConfig
import json

cfg = CommissionConfig.get_solo()
master = dict(getattr(cfg, 'master_commission_json', {}) or {})

print('=== 1. CURRENT ₹750 PRIME ADMIN CONFIGURATION ===')
act750 = master.get('products', {}).get('rs750', {}) or master.get('products', {}).get('PRIME750', {}) or master.get('rs750', {})
print(json.dumps(act750, indent=2))

print('\\n=== 2. CURRENT ₹1,000 SPP ADMIN CONFIGURATION ===')
spp = master.get('products', {}).get('SPP1000', {}) or master.get('products', {}).get('monthly_1000', {}) or master.get('spp1000', {})
print(json.dumps(spp, indent=2))

print('\\n=== 3. ALL PRODUCTS KEYS IN MASTER CONFIG ===')
print(list(master.get('products', {}).keys()))
"""

run_remote(code)
