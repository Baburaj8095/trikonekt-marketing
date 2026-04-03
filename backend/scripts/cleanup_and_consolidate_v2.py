#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Clean up and consolidate self accounts in two phases:
Phase 1: Remove excessive entries (keep max 5 per user per parent)
Phase 2: Consolidate remaining entries under one parent
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from business.models import AutoPoolAccount
from collections import defaultdict

def cleanup_and_consolidate():
    """Remove excessive entries and consolidate scattered accounts."""
    
    print("\n" + "="*70)
    print("PHASE 1: IDENTIFY EXCESSIVE ENTRIES")
    print("="*70 + "\n")
    
    # Find all self accounts
    all_self_entries = AutoPoolAccount.objects.filter(
        pool_type='FIVE_150',
        user_entry_index__gte=1
    ).select_related('owner', 'parent_account__owner').order_by('owner_id', 'parent_account_id', 'user_entry_index')
    
    # Group entries by user and parent
    user_entries = defaultdict(lambda: defaultdict(list))
    for entry in all_self_entries:
        user_entries[entry.owner_id][entry.parent_account_id].append(entry)
    
    # Find entries to delete (keep only 5 per user per parent)
    entries_to_delete = []
    total_entries = 0
    
    for user_id in sorted(user_entries.keys()):
        user_parents = user_entries[user_id]
        
        for parent_id in user_parents:
            entries = sorted(user_parents[parent_id], key=lambda e: e.user_entry_index)
            total_entries += len(entries)
            
            # Keep only the first 5 (positions 1-5)
            if len(entries) > 5:
                to_del = entries[5:]
                entries_to_delete.extend(to_del)
                print("User {} has {} entries under parent {}, will delete {} excess entries".format(
                    user_id, len(entries), parent_id, len(to_del)))
    
    print("\nTotal self accounts: {}".format(total_entries))
    print("Entries marked for deletion: {}".format(len(entries_to_delete)))
    
    if entries_to_delete:
        print("\n" + "="*70)
        print("DELETING EXCESSIVE ENTRIES")
        print("="*70 + "\n")
        
        # Delete in batches with confirmation
        for entry in entries_to_delete[:10]:  # Show first 10
            print("DELETE: User {}, Idx={}, ID={}, Parent={}, Pos={}".format(
                entry.owner_id, entry.user_entry_index, entry.id, entry.parent_account_id, entry.position))
        
        if len(entries_to_delete) > 10:
            print("... and {} more entries".format(len(entries_to_delete) - 10))
        
        # Actually delete
        count = 0
        for entry in entries_to_delete:
            try:
                entry.delete()
                count += 1
            except Exception as e:
                print("Failed to delete entry {}: {}".format(entry.id, str(e)))
        
        print("\nDeleted {} entries".format(count))
        
        # Refresh user_entries dict
        print("\nRefreshing data after deletions...")
        all_self_entries = AutoPoolAccount.objects.filter(
            pool_type='FIVE_150',
            user_entry_index__gte=1
        ).order_by('owner_id', 'parent_account_id', 'user_entry_index')
        
        user_entries = defaultdict(lambda: defaultdict(list))
        for entry in all_self_entries:
            user_entries[entry.owner_id][entry.parent_account_id].append(entry)
    
    print("\n" + "="*70)
    print("PHASE 2: CONSOLIDATE REMAINING ENTRIES")
    print("="*70 + "\n")
    
    # Now consolidate remaining entries
    scattered_users = defaultdict(list)
    for entry in all_self_entries:
        scattered_users[entry.owner_id].append(entry)
    
    users_with_scatter = {
        uid: entries 
        for uid, entries in scattered_users.items() 
        if len(set(e.parent_account_id for e in entries)) > 1
    }
    
    print("Users still with scattered accounts: {}\n".format(len(users_with_scatter)))
    
    stats = {
        'total_fixed': 0,
        'total_moved': 0,
        'total_errors': 0,
        'errors': []
    }
    
    for user_id in sorted(users_with_scatter.keys()):
        entries = sorted(scattered_users[user_id], key=lambda e: e.user_entry_index)
        parents = set(e.parent_account_id for e in entries)
        
        if len(entries) > 5:
            print("User {}: {} entries under {} parents - TOO MANY!".format(user_id, len(entries), len(parents)))
            print("  This should not happen after Phase 1. Skipping.\n")
            continue
        
        # Primary entry determines target parent
        primary = entries[0]
        target_parent_id = primary.parent_account_id
        target_level = primary.level
        
        print("User {}: {} entries under {} parents".format(user_id, len(entries), len(parents)))
        print("  Primary (Idx=1): ID={}, Parent={}, Pos={}, Level={}".format(
            primary.id, target_parent_id, primary.position, target_level))
        
        # Get existing positions under target parent
        existing = AutoPoolAccount.objects.filter(
            parent_account_id=target_parent_id,
            pool_type='FIVE_150'
        ).values_list('position', flat=True)
        
        existing_positions = set(existing)
        available_positions = [p for p in range(1, 6) if p not in existing_positions]
        
        print("  Target parent {}: positions {} taken, {} available".format(
            target_parent_id, sorted(existing_positions), available_positions))
        
        if len(available_positions) < len(entries) - 1:
            print("  WARNING: Need {} positions but only {} available!".format(
                len(entries)-1, len(available_positions)))
            stats['total_errors'] += 1
            stats['errors'].append({'user_id': user_id, 'reason': 'insufficient_positions'})
            print()
            continue
        
        # Move entries
        moved_count = 0
        for idx, entry in enumerate(entries):
            if entry.user_entry_index == 1:
                continue
            
            old_parent = entry.parent_account_id
            old_pos = entry.position
            new_pos = available_positions[idx - 1]
            
            try:
                entry.parent_account_id = target_parent_id
                entry.position = new_pos
                entry.level = target_level
                entry.save()
                
                print("    Idx={}: moved {}:Pos{} -> {}:Pos{}".format(
                    entry.user_entry_index, old_parent, old_pos, target_parent_id, new_pos))
                moved_count += 1
                stats['total_moved'] += 1
                
            except Exception as e:
                print("    Idx={}: FAILED - {}".format(entry.user_entry_index, str(e)))
                stats['total_errors'] += 1
        
        stats['total_fixed'] += 1
        print("  Consolidated: {} entries moved\n".format(moved_count))
    
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print("Users fixed in Phase 2: {}".format(stats['total_fixed']))
    print("Entries moved in Phase 2: {}".format(stats['total_moved']))
    print("Consolidation errors: {}".format(stats['total_errors']))
    
    if stats['errors']:
        print("\nRemaining issues:")
        for err in stats['errors'][:5]:
            print("  User {}: {}".format(err['user_id'], err['reason']))
        if len(stats['errors']) > 5:
            print("  ... and {} more".format(len(stats['errors']) - 5))
    
    print("\nVerifying final consolidation...\n")
    
    # Final verification
    all_self_entries = AutoPoolAccount.objects.filter(
        pool_type='FIVE_150',
        user_entry_index__gte=1
    ).order_by('owner_id', 'user_entry_index')
    
    scattered_users = defaultdict(list)
    for entry in all_self_entries:
        scattered_users[entry.owner_id].append(entry)
    
    users_with_scatter = {
        uid: entries 
        for uid, entries in scattered_users.items() 
        if len(set(e.parent_account_id for e in entries)) > 1
    }
    
    if users_with_scatter:
        print("Still scattered: {} users".format(len(users_with_scatter)))
        for user_id in sorted(users_with_scatter.keys())[:5]:
            entries = users_with_scatter[user_id]
            parents = set(e.parent_account_id for e in entries)
            print("  User {}: {} entries under {} parents".format(user_id, len(entries), len(parents)))
    else:
        print("SUCCESS! All users consolidated!")
    
    return {'deleted': len(entries_to_delete), 'fixed': stats['total_fixed'], 'moved': stats['total_moved']}

if __name__ == '__main__':
    result = cleanup_and_consolidate()
    print("\n" + "="*70)
    print("FINAL RESULT: Deleted={}, Fixed={}, Moved={}".format(
        result['deleted'], result['fixed'], result['moved']))
    print("="*70)
