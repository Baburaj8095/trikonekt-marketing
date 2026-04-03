#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Final cleanup: Users should have ONLY ONE self account per pool (entry_idx=1)
All excess entries (entry_idx > 1) should be deleted.
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from business.models import AutoPoolAccount
from collections import defaultdict

def cleanup_excess_entries():
    """Remove all self accounts except the primary one (entry_idx=1)."""
    
    print("\n" + "="*70)
    print("IDENTIFYING EXCESS SELF ACCOUNTS")
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
    
    # Find excess entries
    excess = []
    stats = defaultdict(int)
    
    for user_id in sorted(by_user.keys()):
        entries = sorted(by_user[user_id], key=lambda e: e.user_entry_index)
        
        if len(entries) > 1:
            primary = entries[0]
            redundant = entries[1:]
            
            print("User {}: {} entries total".format(user_id, len(entries)))
            print("  Keep: Idx=1, ID={}, Parent={}, Pos={}".format(
                primary.id, primary.parent_account_id, primary.position))
            print("  DELETE: {} excess entry(ies)".format(len(redundant)))
            for r in redundant[:3]:
                print("    - Idx={}, ID={}, Parent={}, Pos={}".format(
                    r.user_entry_index, r.id, r.parent_account_id, r.position))
            if len(redundant) > 3:
                print("    - ... and {} more".format(len(redundant) - 3))
            
            excess.extend(redundant)
            stats[user_id] = len(redundant)
            print()
    
    print("="*70)
    print("SUMMARY")
    print("="*70)
    print("Total self accounts: {}".format(all_self.count()))
    print("Users with excess entries: {}".format(len(stats)))
    print("Total excess entries to delete: {}\n".format(len(excess)))
    
    if excess:
        print("Top users with most excess:")
        for user_id, count in sorted(stats.items(), key=lambda x: -x[1])[:5]:
            print("  User {}: {} excess entries".format(user_id, count))
        
        print("\n" + "="*70)
        print("DELETING EXCESS ENTRIES")
        print("="*70 + "\n")
        
        deleted = 0
        for entry in excess:
            try:
                entry.delete()
                deleted += 1
                if deleted <= 10:
                    print("Deleted: User {}, Idx={}, ID={}".format(
                        entry.owner_id, entry.user_entry_index, entry.id))
            except Exception as e:
                print("ERROR deleting {}: {}".format(entry.id, str(e)))
        
        if deleted > 10:
            print("... and {} more".format(deleted - 10))
        
        print("\nTotal deleted: {}".format(deleted))
        
        print("\n" + "="*70)
        print("VERIFYING CONSOLIDATION")
        print("="*70 + "\n")
        
        # Verify remaining entries
        remaining = AutoPoolAccount.objects.filter(
            pool_type='FIVE_150',
            user_entry_index__gte=1
        ).order_by('owner_id', 'user_entry_index')
        
        by_user = defaultdict(list)
        for entry in remaining:
            by_user[entry.owner_id].append(entry)
        
        # Find users still with multiple entries
        still_scattered = {uid: entries for uid, entries in by_user.items() if len(entries) > 1}
        
        if still_scattered:
            print("ERROR: Still have users with multiple entries:")
            for user_id, entries in sorted(still_scattered.items())[:5]:
                print("  User {}: {} entries".format(user_id, len(entries)))
        else:
            print("SUCCESS! Each user now has exactly ONE self account.\n")
            print("Remaining entries to consolidate: {}".format(remaining.count()))
            print("Users: {}".format(by_user.count()))
        
        return {'deleted': deleted, 'remaining': remaining.count()}
    else:
        print("No excess entries found!")
        return {'deleted': 0, 'remaining': all_self.count()}

if __name__ == '__main__':
    result = cleanup_excess_entries()
    print("\n" + "="*70)
    print("FINAL: Deleted={} excess entries, {} accounts remain".format(
        result['deleted'], result['remaining']))
    print("="*70)
