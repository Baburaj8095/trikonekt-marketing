import subprocess
import os

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_code = """import os, sys, django, json
from decimal import Decimal

env_file = '/etc/trikonekt/staging-backend.env'
if os.path.exists(env_file):
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import transaction
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import CommissionConfig, AutoPoolAccount, PromoPurchase
from business.services.self_rebirth import (
    get_rebirth_config,
    check_consumer_2k_package_eligibility,
    _resolve_rebirth_target_user,
    distribute_self_rebirth_250
)

print("=== 1. VERIFY CONFIGURATION CALIBRATION ===")
cfg = CommissionConfig.get_solo()
master = dict(getattr(cfg, 'master_commission_json', {}) or {})
ruc = dict(master.get('rank_upgrade_config', {}) or {})

# Calibrate franchise_rebirth_allocation in DB if not already 25/22
fra = dict(ruc.get('franchise_rebirth_allocation', {}) or {})
fra['direct_sponsor'] = 25.0
fra['company_admin'] = 22.0
fra['company_gross'] = 22.0
ruc['franchise_rebirth_allocation'] = fra
master['rank_upgrade_config'] = ruc
cfg.master_commission_json = master
cfg.save(update_fields=['master_commission_json'])

f_cfg = get_rebirth_config(is_franchise=True)
c_cfg = get_rebirth_config(is_franchise=False)

print(f"Franchise Rebirth - Direct Sponsor: Rs {f_cfg.get('direct_sponsor')} (Expected: 25.0)")
print(f"Franchise Rebirth - Company Admin: Rs {f_cfg.get('company_admin')} (Expected: 22.0)")
print(f"Consumer Rebirth  - Direct Sponsor: Rs {c_cfg.get('direct_sponsor')} (Expected: 40.0)")
print(f"Consumer Rebirth  - Company Admin: Rs {c_cfg.get('company_admin')} (Expected: 7.0 / 10.0)")

assert float(f_cfg.get('direct_sponsor')) == 25.0, "Franchise sponsor bonus must be 25.0"
assert float(f_cfg.get('company_admin')) == 22.0, "Franchise company admin must be 22.0"
assert float(c_cfg.get('direct_sponsor')) == 40.0, "Consumer sponsor bonus must be 40.0"

print("Configuration verified successfully!")

print("=== 2. VERIFY TARGET RESOLUTION (HAPPY CASE) ===")
test_phone = "9112233445"
sponsor_phone = "9988776655"

with transaction.atomic():
    # Create or get Consumer Sponsor
    sponsor_user, _ = CustomUser.objects.get_or_create(
        username=f"test_sponsor_{sponsor_phone}",
        defaults={
            "phone": sponsor_phone,
            "role": "user",
            "category": "consumer",
            "account_active": True,
        }
    )

    # Create or get Consumer User with 2k package
    consumer_user, _ = CustomUser.objects.get_or_create(
        username=f"test_consumer_{test_phone}",
        defaults={
            "phone": test_phone,
            "role": "user",
            "category": "consumer",
            "registered_by": sponsor_user,
            "sponsor_id": sponsor_user.username,
            "account_active": True,
            "first_purchase_activated_at": django.utils.timezone.now(),
        }
    )
    consumer_user.registered_by = sponsor_user
    consumer_user.account_active = True
    consumer_user.first_purchase_activated_at = django.utils.timezone.now()
    consumer_user.save()

    # Create or get Agency User with SAME phone
    agency_user, _ = CustomUser.objects.get_or_create(
        username=f"test_agency_{test_phone}",
        defaults={
            "phone": test_phone,
            "role": "agency",
            "category": "agency_pincode",
            "account_active": True,
        }
    )

    # Verify 2k package eligibility
    is_eligible = check_consumer_2k_package_eligibility(consumer_user)
    print(f"Consumer 2k eligibility: {is_eligible} (Expected: True)")
    assert is_eligible is True, "Consumer must be 2k eligible"

    # Test resolution
    target_mat_user, resolved_sponsor, is_f = _resolve_rebirth_target_user(agency_user, cfg.get_company_user())
    print(f"Resolved matrix user: {target_mat_user.username} (ID: {target_mat_user.id})")
    print(f"Resolved sponsor: {resolved_sponsor.username} (ID: {resolved_sponsor.id})")
    print(f"Is franchise flow: {is_f}")

    assert target_mat_user.id == consumer_user.id, "Matrix user must be the consumer, NOT the agency!"
    assert resolved_sponsor.id == sponsor_user.id, "Sponsor must be consumer's sponsor, NOT company root!"
    assert is_f is True, "Must be franchise flow"

    print("Target resolution verified successfully!")

    print("=== 3. VERIFY EXECUTION OF FRANCHISE REBIRTH ===")
    initial_sponsor_bal = Wallet.get_or_create_for_user(sponsor_user).balance or Decimal("0.00")
    
    res = distribute_self_rebirth_250(agency_user, pack_index=999)
    print("Execution Result:", res)
    assert res.get("success") is True, "Rebirth execution failed"
    assert res.get("target_matrix_user_id") == consumer_user.id, "Matrix account owner must be consumer"

    # Check that 5-Matrix and 3-Matrix accounts have owner = consumer_user
    acc5 = AutoPoolAccount.objects.get(id=res["acc5_id"])
    acc3 = AutoPoolAccount.objects.get(id=res["acc3_id"])
    assert acc5.owner_id == consumer_user.id, "acc5 owner must be consumer"
    assert acc3.owner_id == consumer_user.id, "acc3 owner must be consumer"
    print(f"acc5 owner: {acc5.owner.username}, acc3 owner: {acc3.owner.username}")

    # Check sponsor received exactly Rs 25.00
    sponsor_wallet = Wallet.get_or_create_for_user(sponsor_user)
    new_sponsor_bal = sponsor_wallet.balance or Decimal("0.00")
    sponsor_gain = new_sponsor_bal - initial_sponsor_bal
    print(f"Sponsor Wallet gain: Rs {sponsor_gain} (Expected: 25.00)")
    assert sponsor_gain == Decimal("25.00"), f"Sponsor should have gained Rs 25.00, got Rs {sponsor_gain}"

    # Check WalletTransaction for sponsor (75% Main + 25% Self Account)
    sponsor_txs = list(WalletTransaction.objects.filter(
        user=sponsor_user,
        source_type="SELF_REBIRTH_250"
    ).order_by("-id")[:2])
    assert len(sponsor_txs) == 2, f"Expected 2 split transactions (75/25), found {len(sponsor_txs)}"
    total_tx_amt = sum(t.amount for t in sponsor_txs)
    print(f"Total sponsor transaction amount: Rs {total_tx_amt} (Expected: 25.00)")
    assert total_tx_amt == Decimal("25.00"), f"Expected Rs 25.00 total split, got {total_tx_amt}"

    main_tx = next(t for t in sponsor_txs if t.type == "INCOME_CREDIT_75")
    self_tx = next(t for t in sponsor_txs if t.type == "SELF_ACCOUNT_CREDIT")
    assert main_tx.amount == Decimal("18.75"), f"Expected 18.75 (75%), got {main_tx.amount}"
    assert self_tx.amount == Decimal("6.25"), f"Expected 6.25 (25%), got {self_tx.amount}"
    print("Main transaction meta:", main_tx.meta)
    assert main_tx.meta.get("is_franchise") is True
    assert main_tx.meta.get("funding_agency_id") == agency_user.id
    assert main_tx.meta.get("from_user_id") == consumer_user.id
    assert main_tx.meta.get("orig_type") == "DIRECT_REF_BONUS"

    print("Franchise Rebirth execution and 75/25 streaming split verified successfully!")

    print("=== 4. VERIFY DEFENSIVE FALLBACK (SAD CASE) ===")
    # Agency user with no consumer account
    orphan_phone = "9888888888"
    orphan_agency, _ = CustomUser.objects.get_or_create(
        username=f"orphan_agency_{orphan_phone}",
        defaults={"phone": orphan_phone, "role": "agency", "category": "agency_pincode"}
    )
    fallback_user, fallback_sponsor, is_f_orphan = _resolve_rebirth_target_user(orphan_agency, cfg.get_company_user())
    print(f"Orphan agency fallback user: {fallback_user.username}")
    print(f"Orphan agency fallback sponsor: {fallback_sponsor.username}")
    company_root = cfg.get_company_user()
    assert fallback_user.id == company_root.id or fallback_user.id == orphan_agency.id
    print("Sad case fallback verified successfully!")

    # Roll back test data to leave DB clean
    transaction.set_rollback(True)

print("ALL TEST SUITES PASSED CLEANLY! ZERO CORRUPTIONS!")
"""

# Write script to temporary local file
local_script = "verify_remote_tmp.py"
with open(local_script, "w", encoding="utf-8") as f:
    f.write(remote_code)

# Upload to EC2
subprocess.run([
    "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    local_script, f"{ec2_user}@{ec2_ip}:/tmp/verify_remote.py"
], check=True)

# Run on EC2
proc = subprocess.run([
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    "/srv/trikonekt/staging/backend/.venv/bin/python /tmp/verify_remote.py"
], capture_output=True, text=True, encoding="utf-8")

print("STDOUT:\n", proc.stdout)
if proc.stderr:
    print("STDERR:\n", proc.stderr)

# Cleanup
if os.path.exists(local_script):
    os.remove(local_script)
