import os
import sys
from decimal import Decimal

# Setup Django environment
import django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.db import transaction
from accounts.models import CustomUser, Wallet, WalletTransaction
from mlm_ranks.models import RankUpgrade, UpgradeCommission
from mlm_ranks.services.eligibility import RankEligibilityService
from mlm_ranks.services.config import COMPANY_ROOT_USER_ID, Prime750StatusAdapter

def get_matrix_ancestors(user, depth: int) -> list:
    from mlm_ranks.models import RankMatrixNode
    ancestors = []
    curr = user
    for _ in range(depth):
        node = RankMatrixNode.objects.filter(placed_user=curr).first()
        if not node:
            break
        curr = node.parent_user
        ancestors.append(curr)
    return ancestors

def recalculate(write_mode=False):
    print(f"Starting Rank Upgrade Level Income Recalculation (WRITE_MODE={write_mode})...")
    
    # Fetch company root
    company_root = CustomUser.objects.filter(id=int(COMPANY_ROOT_USER_ID)).first()
    if not company_root:
        print("Error: Company Root user not found.")
        return

    # Find all Level commissions
    comms = UpgradeCommission.objects.filter(commission_type="LEVEL").select_related('upgrade', 'from_user', 'to_user', 'upgrade__to_rank')
    
    mismatches = []
    
    for c in comms:
        upgrade = c.upgrade
        payer = c.from_user
        target_level = c.level
        
        # Traverse matrix parent chain to find the correct recipient
        ancestors = get_matrix_ancestors(payer, target_level)
        cand = ancestors[target_level - 1] if len(ancestors) >= target_level else None
        
        # Check eligibility
        eligible = False
        if cand:
            is_prime = Prime750StatusAdapter.is_user_prime750_active(cand)
            _, urank = RankEligibilityService.get_or_bootstrap_user_rank(cand)
            rank_ok = int(getattr(urank, "level_number", 0) or 0) >= int(target_level)
            eligible = is_prime and rank_ok
            
        correct_to_user = cand if eligible else company_root
        
        if c.to_user != correct_to_user:
            mismatches.append({
                'commission_id': c.id,
                'upgrade_id': upgrade.id,
                'payer': payer.username,
                'target_level': target_level,
                'actual_receiver': c.to_user.username,
                'correct_receiver': correct_to_user.username,
                'amount': c.commission_amount,
                'commission_object': c,
                'correct_user_object': correct_to_user
            })

    print(f"Found {len(mismatches)} incorrect payouts out of {comms.count()} level commission records.")
    
    if not mismatches:
        print("Everything is correct! No adjustments needed.")
        return

    total_amount = Decimal("0.00")
    for m in mismatches:
        print(f"Mismatch: Upgrade #{m['upgrade_id']} (Payer: {m['payer']}, L{m['target_level']}) paid to {m['actual_receiver']} instead of {m['correct_receiver']} (Amt: {m['amount']})")
        total_amount += m['amount']
    print(f"Total mismatch volume: ₹{total_amount}")

    if not write_mode:
        print("\nDry-run complete. No database changes were applied.")
        return

    print("\nApplying database adjustments inside an atomic transaction...")
    
    with transaction.atomic():
        for m in mismatches:
            c = m['commission_object']
            wrong_user = c.to_user
            correct_user = m['correct_user_object']
            amt = m['amount']
            upgrade_id = m['upgrade_id']
            payer_id = c.from_user.id
            payer_uname = m['payer']
            
            print(f"Clawing back ₹{amt} from {wrong_user.username} and crediting to {correct_user.username} for Upgrade #{upgrade_id}...")
            
            # 1. Claw back from wrong_user (Deduct from wallet balance directly to avoid insufficient checks)
            w_wrong = Wallet.objects.select_for_update().get(user=wrong_user)
            income_part = (amt * Decimal("0.75")).quantize(Decimal("0.01"))
            self_part = (amt - income_part).quantize(Decimal("0.01"))
            
            w_wrong.main_balance -= income_part
            w_wrong.self_account_balance -= self_part
            w_wrong.balance -= amt
            w_wrong.save()
            
            # Record negative transactions for clawback
            WalletTransaction.objects.create(
                user=wrong_user,
                amount=income_part * Decimal("-1"),
                balance_after=w_wrong.balance,
                type="RECALCULATION_DEBIT",
                source_type="RANK_UPGRADE_CORRECTION",
                source_id=str(upgrade_id),
                meta={
                    "ledger": "MAIN",
                    "reason": "Clawback of incorrect Level Income",
                    "original_payer": payer_uname,
                    "target_level": c.level,
                    "original_receiver": wrong_user.username,
                    "correct_receiver": correct_user.username
                }
            )
            
            if self_part > 0:
                WalletTransaction.objects.create(
                    user=wrong_user,
                    amount=self_part * Decimal("-1"),
                    balance_after=w_wrong.balance,
                    type="RECALCULATION_DEBIT",
                    source_type="RANK_UPGRADE_CORRECTION",
                    source_id=str(upgrade_id),
                    meta={
                        "ledger": "SELF_ACCOUNT",
                        "reason": "Clawback of incorrect Level Income self portion",
                        "original_payer": payer_uname,
                        "target_level": c.level,
                        "original_receiver": wrong_user.username,
                        "correct_receiver": correct_user.username
                    }
                )

            # 2. Credit correct_user
            w_correct = Wallet.objects.get(user=correct_user)
            w_correct.credit(
                amt,
                tx_type="LEVEL_BONUS",
                source_type="RANK_UPGRADE",
                source_id=str(upgrade_id),
                meta={
                    "from_user_id": payer_id,
                    "upgrade_id": upgrade_id,
                    "level": c.level,
                    "kind": "RANK_UPGRADE_LEVEL_RECALCULATION",
                    "recalculation_note": f"Redirected from {wrong_user.username} to {correct_user.username}"
                }
            )

            # 3. Update the UpgradeCommission record
            c.to_user = correct_user
            c.save(update_fields=['to_user'])
            
    print("Database adjustments successfully applied!")

if __name__ == "__main__":
    write = "--write" in sys.argv
    recalculate(write_mode=write)
