import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

code = """
with open('/srv/trikonekt/staging/backend/mlm_ranks/views.py', 'r') as f:
    content = f.read()

target = '''            total_royalty_earned = float(user_royalty_txs.aggregate(t=Sum("amount"))["t"] or Decimal("0.00"))
            t1_earned = float(user_royalty_txs.filter(Q(source_id__startswith="ROYALTY_T1_") | Q(meta__tier=1)).aggregate(t=Sum("amount"))["t"] or Decimal("0.00"))
            t2_earned = float(user_royalty_txs.filter(Q(source_id__startswith="ROYALTY_T2_") | Q(meta__tier=2)).aggregate(t=Sum("amount"))["t"] or Decimal("0.00"))
            t3_earned = float(user_royalty_txs.filter(Q(source_id__startswith="ROYALTY_T3_") | Q(meta__tier=3)).aggregate(t=Sum("amount"))["t"] or Decimal("0.00"))'''

replacement = '''            total_royalty_earned = float(user_royalty_txs.aggregate(t=Sum("amount"))["t"] or Decimal("0.00"))
            t1_earned = float(user_royalty_txs.filter(Q(source_id__startswith="ROYALTY_T1_") | Q(source_id__startswith="ROYALTY_L1_L7_") | Q(meta__tier="L1-L7") | Q(meta__tier=1)).aggregate(t=Sum("amount"))["t"] or Decimal("0.00"))
            t2_dist_earned = float(user_royalty_txs.filter(Q(source_id__startswith="ROYALTY_DIST_L8_L10_") | Q(meta__tier="DIST_L8_L10")).aggregate(t=Sum("amount"))["t"] or Decimal("0.00"))
            t2_state_earned = float(user_royalty_txs.filter(Q(source_id__startswith="ROYALTY_STATE_L8_L10_") | Q(meta__tier="STATE_L8_L10")).aggregate(t=Sum("amount"))["t"] or Decimal("0.00"))
            t2_legacy_earned = float(user_royalty_txs.filter(Q(source_id__startswith="ROYALTY_T2_") | Q(source_id__startswith="ROYALTY_L8_L10_") | Q(meta__tier=2) | Q(meta__tier="L8-L10")).aggregate(t=Sum("amount"))["t"] or Decimal("0.00"))
            t2_earned = t2_dist_earned + t2_state_earned + t2_legacy_earned
            t3_earned = float(user_royalty_txs.filter(Q(source_id__startswith="ROYALTY_T3_") | Q(source_id__startswith="ROYALTY_L1_L10_30D_") | Q(meta__tier="L1-L10-30D") | Q(meta__tier=3)).aggregate(t=Sum("amount"))["t"] or Decimal("0.00"))'''

if target in content:
    content = content.replace(target, replacement)

target_ret = '''                "total_earned": round(total_royalty_earned, 2),
                "tier1_earned": round(t1_earned, 2),
                "tier2_earned": round(t2_earned, 2),
                "tier3_earned": round(t3_earned, 2),'''

replacement_ret = '''                "total_earned": round(total_royalty_earned, 2),
                "tier1_earned": round(t1_earned, 2),
                "tier2_earned": round(t2_earned, 2),
                "tier2_district_earned": round(t2_dist_earned + (t2_legacy_earned * 0.6), 2),
                "tier2_state_earned": round(t2_state_earned + (t2_legacy_earned * 0.4), 2),
                "tier3_earned": round(t3_earned, 2),'''

if target_ret in content:
    content = content.replace(target_ret, replacement_ret)

with open('/srv/trikonekt/staging/backend/mlm_ranks/views.py', 'w') as f:
    f.write(content)

import subprocess
subprocess.run(['sudo', 'systemctl', 'restart', 'trikonekt-staging-web'], check=True)
print('mlm_ranks/views.py patched and staging web restarted!')
"""

run_remote(code)
