import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

code = """
import os
from business.services.daily_pool_distributor import execute_daily_pool_distribution
from accounts.models import CustomUser, WalletTransaction
from mlm_ranks.models import RankUpgrade

print('=== TESTING DRY-RUN DISTRIBUTION ===')
res = execute_daily_pool_distribution(target_date='2026-10-09', dry_run=True, force=True)
print('Dry Run Result:', res)
"""

run_remote(code)
