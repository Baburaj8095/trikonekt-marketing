import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.db.models import Q
from accounts.models import CustomUser, WalletTransaction
from business.models import AutoPoolAccount

def count_descendants(node_id, pool_type):
    visited = set()
    frontier = [node_id]
    while frontier:
        next_frontier = []
        children = AutoPoolAccount.objects.filter(
            pool_type=pool_type,
            status="ACTIVE",
            parent_account_id__in=frontier
        ).values_list('id', flat=True)
        for cid in children:
            if cid not in visited:
                visited.add(cid)
                next_frontier.append(cid)
        frontier = next_frontier
    return len(visited)

def run_diagnostics():
    username = "7975657678"
    print(f"=== DIAGNOSTICS FOR USER {username} ===")
    user = CustomUser.objects.filter(username=username).first()
    if not user:
        print(f"[-] User {username} not found.")
        return
        
    print(f"[+] User: {user.username} (ID: {user.id})")
    
    # 1. Check all SELF_250_PACK transactions for this user
    txs = WalletTransaction.objects.filter(user=user, source_type="SELF_250_PACK").order_by("created_at")
    print(f"\n[+] SELF_250_PACK Transactions count: {txs.count()}")
    for tx in txs:
        # Check if 5m/3m exist in database
        has_5 = AutoPoolAccount.objects.filter(owner=user, pool_type="FIVE_150", source_type="SELF_250_PACK", source_id=str(tx.source_id)).exists()
        has_3 = AutoPoolAccount.objects.filter(owner=user, pool_type="THREE_150", source_type="SELF_250_PACK", source_id=str(tx.source_id)).exists()
        print(f"  - TX Date: {tx.created_at} | type: {tx.type} | Index (source_id): {tx.source_id} | meta: {tx.meta}")
        print(f"    -> 5-matrix exists: {has_5} | 3-matrix exists: {has_3}")

    # 2. Check all active FIVE_150 accounts owned by this user
    ap_5 = AutoPoolAccount.objects.filter(owner=user, pool_type="FIVE_150").order_by("created_at")
    print(f"\n[+] FIVE_150 accounts in DB owned by {username}: {ap_5.count()}")
    for ap in ap_5:
        from accounts.views_tree import _infer_root_category
        inferred = _infer_root_category(ap.source_type, ap.source_id)
        desc = count_descendants(ap.id, "FIVE_150")
        print(f"  - Entry #{ap.id}: idx={ap.user_entry_index}, status={ap.status}, source_type={ap.source_type}, source_id={ap.source_id}, inferred_category={inferred}, descendants={desc}")

    # 3. Check all active THREE_150 accounts owned by this user
    ap_3 = AutoPoolAccount.objects.filter(owner=user, pool_type="THREE_150").order_by("created_at")
    print(f"\n[+] THREE_150 accounts in DB owned by {username}: {ap_3.count()}")
    for ap in ap_3:
        from accounts.views_tree import _infer_root_category
        inferred = _infer_root_category(ap.source_type, ap.source_id)
        desc = count_descendants(ap.id, "THREE_150")
        print(f"  - Entry #{ap.id}: idx={ap.user_entry_index}, status={ap.status}, source_type={ap.source_type}, source_id={ap.source_id}, inferred_category={inferred}, descendants={desc}")

if __name__ == "__main__":
    run_diagnostics()
