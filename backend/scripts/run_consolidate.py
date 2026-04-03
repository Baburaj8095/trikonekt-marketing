#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Wrapper script to run consolidation with proper encoding
"""
import os
import sys
import django

# Add parent directory to path so we can import Django apps
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from business.models import AutoPoolAccount
from collections import defaultdict

# Run consolidation directly
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
    
    print("\n" + "="*60)
    print("CONSOLIDATING {} SCATTERED USERS".format(len(users_with_scatter)))
    print("="*60 + "\n")
    
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
        
        print("User {}: {} entries under {} parents".format(user_id, len(entries), len(parents)))
        print("  Primary entry (Idx=1): ID={}, Parent={}, Pos={}, Level={}".format(
            primary.id, target_parent_id, primary.position, target_level))
        
        # Get existing positions under target parent
        existing_positions = set(
            AutoPoolAccount.objects.filter(
                parent_account_id=target_parent_id,
                pool_type='FIVE_150'
            ).values_list('position', flat=True)
        )
        
        # Available positions for FIVE_150 (1-5)
        available_positions = [p for p in range(1, 6) if p not in existing_positions]
        
        print("  Target parent {}: positions {} taken, {} available".format(
            target_parent_id, sorted(existing_positions), available_positions))
        
        if len(available_positions) < len(entries) - 1:
            print("  WARNING: Need {} positions but only {} available!".format(
                len(entries)-1, len(available_positions)))
            stats['total_errors'] += 1
            stats['errors'].append({
                'user_id': user_id,
                'reason': 'insufficient_positions'
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
                
                print("    Idx={}: ID={}, moved {}:Pos{} -> {}:Pos{}".format(
                    entry.user_entry_index, entry.id, old_parent, old_pos, 
                    target_parent_id, new_pos))
                moved_count += 1
                stats['total_moved'] += 1
                
            except Exception as e:
                print("    Idx={}: ID={}, FAILED - {}".format(
                    entry.user_entry_index, entry.id, str(e)))
                stats['total_errors'] += 1
                stats['errors'].append({
                    'user_id': user_id,
                    'entry_idx': entry.user_entry_index,
                    'error': str(e)
                })
        
        stats['total_fixed'] += 1
        print("  Consolidated: {} entries moved\n".format(moved_count))
    
    # Print summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print("Users fixed: {}".format(stats['total_fixed']))
    print("Entries moved: {}".format(stats['total_moved']))
    print("Errors: {}".format(stats['total_errors']))
    
    if stats['errors']:
        print("\nERROR DETAILS:")
        for err in stats['errors']:
            print("  {}".format(err))
    
    print("\nVerifying consolidation...\n")
    
    # Verify the fix
    verify_result = verify_consolidation()
    print("Remaining scattered users: {}".format(verify_result['scattered']))

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
        print("Still scattered:")
        for user_id, entries in sorted(users_with_scatter.items())[:5]:
            parents = set(e.parent_account_id for e in entries)
            print("  User {}: {} entries under {} parents".format(user_id, len(entries), len(parents)))
    else:
        print("All users consolidated successfully!")
    
    return {'scattered': len(users_with_scatter)}

if __name__ == '__main__':
    fix_scattered_users()
