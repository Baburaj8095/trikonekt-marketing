#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Comprehensive cleanup with reparenting:
1. For each user with multiple entries, keep entry_idx=1
2. Reparent all children of excess entries to the keeper's parent
3. Then delete the excess entries
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from business.models import AutoPoolAccount
from collections import defaultdict

def cleanup_with_reparenting():
    """Remove excess entries with proper reparenting."""
    
    print("\n" + "="*70)
    print("CLEANUP WITH REPARENTING")
    print("="*70 + "\n")
    
    # Find all self accounts
    all_self = AutoPoolAccount.objects.filter(
        pool_type='FIVE_150',
        user_entry_index__gte=1
    ).order_by('owner_id', 'user_entry_index')
    
    # Group by user
    by_user = defaultdict(list)
    for entry in all_self:
        by_user[entry.owner_id].append(entry)
    
    stats = {
        'keeper_count': 0,
        'reparented': 0,
        'deleted': 0,
        'errors': 0
    }
    
    for user_id in sorted(by_user.keys()):
        entries = sorted(by_user[user_id], key=lambda e: e.user_entry_index)
        
        if len(entries) <= 1:
            stats['keeper_count'] += 1
            continue
        
        # Keeper is entry[0] (entry_idx=1)
        keeper = entries[0]
        excess = entries[1:]
        keeper_parent = keeper.parent_account_id
        
        print("User {}: {} total entries, keeping Idx=1 (ID={}), deleting {} excess".format(
            user_id, len(entries), keeper.id, len(excess)))
        
        for excess_entry in excess:
            # Get all children of this excess entry
            children = AutoPoolAccount.objects.filter(
                parent_account_id=excess_entry.id
            )
            
            if children.exists():
                print("  Entry Idx={} (ID={}): Reparenting {} children to parent {}".format(
                    excess_entry.user_entry_index, excess_entry.id, children.count(), keeper_parent))
                
                # Reparent all children to keeper's parent
                for child in children:
                    try:
                        # Check for position conflict
                        existing = AutoPoolAccount.objects.filter(
                            parent_account_id=keeper_parent,
                            position=child.position,
                            pool_type=child.pool_type
                        ).exclude(id=child.id).exists()
                        
                        if existing:
                            print("    Child {} position conflict, will be orphaned".format(child.id))
                            # If position taken, just orphan it
                            child.parent_account_id = None
                            child.position = None
                            child.level = 0
                        else:
                            child.parent_account_id = keeper_parent
                        
                        child.save()
                        stats['reparented'] += 1
                    except Exception as e:
                        print("    Child {} reparenting failed: {}".format(child.id, str(e)))
                        stats['errors'] += 1
            
            # Delete the excess entry
            try:
                excess_entry.delete()
                print("    Deleted Idx={} (ID={})".format(excess_entry.user_entry_index, excess_entry.id))
                stats['deleted'] += 1
            except Exception as e:
                print("    Failed to delete Idx={}: {}".format(excess_entry.user_entry_index, str(e)))
                stats['errors'] += 1
        
        stats['keeper_count'] += 1
        print()
    
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print("Users with single entry (keepers): {}".format(stats['keeper_count']))
    print("Children reparented: {}".format(stats['reparented']))
    print("Excess entries deleted: {}".format(stats['deleted']))
    print("Errors: {}".format(stats['errors']))
    
    # Verification
    print("\n" + "="*70)
    print("VERIFYING")
    print("="*70 + "\n")
    
    all_self = AutoPoolAccount.objects.filter(
        pool_type='FIVE_150',
        user_entry_index__gte=1
    ).order_by('owner_id', 'user_entry_index')
    
    by_user = defaultdict(list)
    for entry in all_self:
        by_user[entry.owner_id].append(entry)
    
    still_scattered = {uid: entries for uid, entries in by_user.items() if len(entries) > 1}
    
    if still_scattered:
        print("Still have {} users with multiple entries:".format(len(still_scattered)))
        for user_id in sorted(still_scattered.keys())[:5]:
            print("  User {}: {} entries".format(user_id, len(still_scattered[user_id])))
        if len(still_scattered) > 5:
            print("  ... and {} more".format(len(still_scattered) - 5))
    else:
        print("SUCCESS! All users now have single entry.\n")
        print("Total accounts: {}".format(all_self.count()))
    
    return stats

if __name__ == '__main__':
    result = cleanup_with_reparenting()
    print("\n" + "="*70)
    print("FINAL RESULT")
    print("="*70)
    for key, val in result.items():
        print("{}: {}".format(key, val))
    print("="*70)
