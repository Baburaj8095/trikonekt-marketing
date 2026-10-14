import time
import os
import sys

sys.path.insert(0, '/srv/trikonekt/tri-academy/backend/src/scripts')
import growth_bridge_exec

t0 = time.time()
res = growth_bridge_exec.get_user_overview('9999999999')
print(f"get_user_overview time: {time.time() - t0:.4f}s")

t0 = time.time()
res = growth_bridge_exec.execute_stage_upgrade('9999999999', 3, 1, 5000)
print(f"execute_stage_upgrade time: {time.time() - t0:.4f}s, success: {res.get('success')}")
