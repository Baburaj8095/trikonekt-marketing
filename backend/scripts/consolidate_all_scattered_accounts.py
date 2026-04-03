"""
Consolidate all scattered self accounts for users with multiple parents.
Each user's self accounts (entry_idx >= 1) should be siblings under ONE parent.
"""
from business.models import AutoPoolAccount
from collections import defaultdict

def fix_scattered_users():
    """Fix all users with scattered self accounts."""
    
    # Find all self accounts
    all_self_entries = AutoPoolAccount.objects.filter(
        pool_type='FIVE_150',
        user_entry_index__gte=1
    ).select_related('owner').order_by('owner_id', 'user_entry_index')
    
    # Group by user and find those with multiple parents
    scattered_users = defaultdict(list)
    for entry in all_self_entries:
        scattered_users[entry.owner_id].append(entry)
    
    users_with_scatter = {
        uid: entries 
        for uid, entries in scattered_users.items() 
        if len(set(e.parent_account_id for e in entries)) > 1
    }
    
    print(f"\n{'='*60}")
    print(f"CONSOLIDATING {len(users_with_scatter)} SCATTERED USERS")
    print(f"{'='*60}\n")
    
    stats = {
        'total_fixed': 0,
        'total_moved': 0,
        'total_errors': 0,
        'errors': []
    }
    
    for user_id in sorted(users_with_scatter.keys()):
        entries = sorted(scattered_users[user_id], key=lambda e: e.user_entry_index)
        parents = set(e.parent_account_id for e in entries)
        
        # Primary entry (entry_idx=1) determines the target parent
        primary = entries[0]
        target_parent_id = primary.parent_account_id
        target_level = primary.level
        
        print(f"User {user_id}: {len(entries)} entries under {len(parents)} parents")
        print(f"  Primary entry (Idx=1): ID={primary.id}, Parent={target_parent_id}, Pos={primary.position}, Level={target_level}")
        
        # Get existing positions under target parent
        existing_positions = set(
            AutoPoolAccount.objects.filter(
                parent_account_id=target_parent_id,
                pool_type='FIVE_150'
            ).values_list('position', flat=True)
        )
        
        # Available positions for FIVE_150 (1-5)
        available_positions = [p for p in range(1, 6) if p not in existing_positions]
        
        print(f"  Target parent {target_parent_id}: positions {sorted(existing_positions)} taken, {available_positions} available")
        
        if len(available_positions) < len(entries) - 1:
            print(f"  ⚠️  ERROR: Need {len(entries)-1} positions but only {len(available_positions)} available!")
            stats['total_errors'] += 1
            stats['errors'].append({
                'user_id': user_id,
                'reason': f'insufficient_positions (have {len(available_positions)}, need {len(entries)-1})'
            })
            continue
        
        # Consolidate each entry (except primary which is already in place)
        moved_count = 0
        for idx, entry in enumerate(entries):
            if entry.user_entry_index == 1:
                continue  # Already in correct place
            
            old_parent = entry.parent_account_id
            old_pos = entry.position
            new_pos = available_positions[idx - 1]
            
            try:
                entry.parent_account_id = target_parent_id
                entry.position = new_pos
                entry.level = target_level
                entry.save()
                
                print(f"    Idx={entry.user_entry_index}: ID={entry.id}, moved {old_parent}:Pos{old_pos} → {target_parent_id}:Pos{new_pos}")
                moved_count += 1
                stats['total_moved'] += 1
                
            except Exception as e:
                print(f"    Idx={entry.user_entry_index}: ID={entry.id}, ❌ FAILED - {str(e)}")
                stats['total_errors'] += 1
                stats['errors'].append({
                    'user_id': user_id,
                    'entry_idx': entry.user_entry_index,
                    'error': str(e)
                })
        
        stats['total_fixed'] += 1
        print(f"  ✓ Consolidated: {moved_count} entries moved\n")
    
    # Print summary
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Users fixed: {stats['total_fixed']}")
    print(f"Entries moved: {stats['total_moved']}")
    print(f"Errors: {stats['total_errors']}")
    
    if stats['errors']:
        print(f"\nERROR DETAILS:")
        for err in stats['errors']:
            print(f"  {err}")
    
    print(f"\nVerifying consolidation...\n")
    
    # Verify the fix
    verify_result = verify_consolidation()
    print(f"Remaining scattered users: {verify_result['scattered']}")

def verify_consolidation():
    """Verify that all users have consolidated self accounts."""
    
    all_self_entries = AutoPoolAccount.objects.filter(
        pool_type='FIVE_150',
        user_entry_index__gte=1
    ).select_related('owner').order_by('owner_id', 'user_entry_index')
    
    scattered_users = defaultdict(list)
    for entry in all_self_entries:
        scattered_users[entry.owner_id].append(entry)
    
    users_with_scatter = {
        uid: entries 
        for uid, entries in scattered_users.items() 
        if len(set(e.parent_account_id for e in entries)) > 1
    }
    
    if users_with_scatter:
        print("❌ Still scattered:")
        for user_id, entries in sorted(users_with_scatter.items())[:5]:
            parents = set(e.parent_account_id for e in entries)
            print(f"  User {user_id}: {len(entries)} entries under {len(parents)} parents")
    else:
        print("✓ All users consolidated successfully!")
    
    return {'scattered': len(users_with_scatter)}

# Run the consolidation
if __name__ == '__main__':
    fix_scattered_users()
