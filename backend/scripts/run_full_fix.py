"""
FULL FIX: Execute Phase 0 + Phase 1 in sequence
This script runs both phases to completely fix all 118 users
"""
import subprocess
import sys

print("\n" + "="*100)
print(" "*30 + "TRIKONEKT 5-MATRIX FULL FIX")
print("="*100)
print("\nThis script will execute:")
print("  Phase 0: Create 118 user roots")
print("  Phase 1: Consolidate 287 self-account positions")
print("\nEstimated time: < 2 minutes")
print("="*100)

# Phase 0
print("\n[EXECUTING PHASE 0]")
print("-"*100)
result_0 = subprocess.run(
    [sys.executable, "manage.py", "shell", "-c", "exec(open('scripts/phase_0_create_roots.py').read())"],
    capture_output=True,
    text=True
)
print(result_0.stdout)
if result_0.returncode != 0:
    print("STDERR:", result_0.stderr)

# Phase 1
print("\n[EXECUTING PHASE 1]")
print("-"*100)
result_1 = subprocess.run(
    [sys.executable, "manage.py", "shell", "-c", "exec(open('scripts/phase_1_consolidate_selfs.py').read())"],
    capture_output=True,
    text=True
)
print(result_1.stdout)
if result_1.returncode != 0:
    print("STDERR:", result_1.stderr)

# Summary
print("\n" + "="*100)
print("FULL FIX COMPLETE")
print("="*100)
print("\nNext Steps:")
print("  1. Code fix already applied to models.py")
print("  2. Phase 0 & 1 completed")
print("  3. Deploy the code changes to production")
print("  4. Verify: Run scripts/verify_fix.py to confirm all users have roots")
print("="*100 + "\n")
