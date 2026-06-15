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
    print("=== STARTING GENEALOGY AND MATRIX DIAGNOSTICS ===")
    
    # 1. Inspect user 9999999999
    username = "9999999999"
    user = CustomUser.objects.filter(username=username).first()
    if not user:
        print(f"[-] User {username} not found in database.")
    else:
        print(f"[+] User: {user.username} (ID: {user.id})")
        
        # SELF_250_PACK transactions
        txs = WalletTransaction.objects.filter(user=user, source_type="SELF_250_PACK")
        print(f"[+] Total SELF_250_PACK purchases: {txs.count()}")
        missing_count = 0
        for tx in txs:
            has_5 = AutoPoolAccount.objects.filter(
                owner=user, pool_type="FIVE_150", source_type="SELF_250_PACK", source_id=str(tx.source_id)
            ).exists()
            has_3 = AutoPoolAccount.objects.filter(
                owner=user, pool_type="THREE_150", source_type="SELF_250_PACK", source_id=str(tx.source_id)
            ).exists()
            
            status = "OK"
            if not has_5 or not has_3:
                status = "MISSING SEATS"
                missing_count += 1
            print(f"  - Purchase Date: {tx.created_at} | Index: {tx.source_id} | Status: {status} (5m={has_5}, 3m={has_3})")
            
        print(f"[+] User {username} has {missing_count} purchases missing matrices.")
        
        # Matrix Entries Owned
        ap_5 = AutoPoolAccount.objects.filter(owner=user, pool_type="FIVE_150", status="ACTIVE")
        print(f"\n[+] FIVE_150 entries owned by {username}: {ap_5.count()}")
        for ap in ap_5.order_by("user_entry_index"):
            desc_count = count_descendants(ap.id, "FIVE_150")
            print(f"  - Entry #{ap.id} (index {ap.user_entry_index}): parent_id={ap.parent_account_id}, source_type={ap.source_type}, source_id={ap.source_id}, actual_descendants={desc_count}")
            
        ap_3 = AutoPoolAccount.objects.filter(owner=user, pool_type="THREE_150", status="ACTIVE")
        print(f"\n[+] THREE_150 entries owned by {username}: {ap_3.count()}")
        for ap in ap_3.order_by("user_entry_index"):
            desc_count = count_descendants(ap.id, "THREE_150")
            print(f"  - Entry #{ap.id} (index {ap.user_entry_index}): parent_id={ap.parent_account_id}, source_type={ap.source_type}, source_id={ap.source_id}, actual_descendants={desc_count}")

    # 2. Database-wide counts
    tot_5 = AutoPoolAccount.objects.filter(pool_type="FIVE_150", status="ACTIVE", parent_account__isnull=False).count()
    tot_3 = AutoPoolAccount.objects.filter(pool_type="THREE_150", status="ACTIVE", parent_account__isnull=False).count()
    print(f"\n[+] Total Active non-sentinel FIVE_150 in DB: {tot_5}")
    print(f"[+] Total Active non-sentinel THREE_150 in DB: {tot_3}")

    # 3. Check for any other users with missing matrix seats in the system
    print("\n=== SYSTEM-WIDE SCAN FOR MISSING MATRIX SEATS ===")
    all_250_txs = WalletTransaction.objects.filter(type="AUTO_PURCHASE_DEBIT", source_type="SELF_250_PACK").order_by("created_at")
    print(f"[+] Total SELF_250_PACK transactions in DB: {all_250_txs.count()}")
    
    system_missing_5 = 0
    system_missing_3 = 0
    users_with_missing = {}
    
    for tx in all_250_txs:
        u = tx.user
        idx = str(tx.source_id)
        has_5 = AutoPoolAccount.objects.filter(owner=u, pool_type="FIVE_150", source_type="SELF_250_PACK", source_id=idx).exists()
        has_3 = AutoPoolAccount.objects.filter(owner=u, pool_type="THREE_150", source_type="SELF_250_PACK", source_id=idx).exists()
        
        if not has_5 or not has_3:
            u_key = f"{u.username} (ID: {u.id})"
            users_with_missing.setdefault(u_key, []).append({
                "date": str(tx.created_at),
                "index": idx,
                "missing_5": not has_5,
                "missing_3": not has_3
            })
            if not has_5:
                system_missing_5 += 1
            if not has_3:
                system_missing_3 += 1
                
    if not users_with_missing:
        print("[+] System is clean! No missing matrix seats found.")
    else:
        print(f"[-] Found {len(users_with_missing)} users with missing matrix seats:")
        for u_key, items in users_with_missing.items():
            print(f"  * User {u_key}: {len(items)} missing instances:")
            for item in items:
                print(f"    - Index {item['index']} ({item['date']}): missing_5={item['missing_5']}, missing_3={item['missing_3']}")
                
    print(f"\n[+] Total missing 5m seats: {system_missing_5}")
    print(f"[+] Total missing 3m seats: {system_missing_3}")

if __name__ == "__main__":
    run_diagnostics()
