"""
Fix script: Create root entry for user and consolidate all positions under it.
This ensures the user has their own matrix tree with all 6 positions as direct children.
"""
import os
import sys
import django

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db.models import Q
from accounts.models import CustomUser
from business.models import AutoPoolAccount
from decimal import Decimal

def create_root_and_consolidate(phone_or_id, pool_type='FIVE_150', dry_run=True):
    """Create root entry for user and consolidate all positions under it."""
    
    # Find the user
    try:
        user_id = int(phone_or_id)
        user = CustomUser.objects.get(id=user_id)
    except (ValueError, CustomUser.DoesNotExist):
        user = CustomUser.objects.filter(
            Q(phone=phone_or_id) | Q(username=phone_or_id)
        ).first()
    
    if not user:
        print(f"❌ User not found: {phone_or_id}")
        return False
    
    print(f"\n{'='*80}")
    print(f"FIX PLAN: Create root and consolidate for User {user.id} ({user.phone})")
    print(f"Pool Type: {pool_type}")
    print(f"DRY RUN: {dry_run}")
    print(f"{'='*80}\n")
    
    # Get all existing positions
    positions = AutoPoolAccount.objects.filter(
        owner=user,
        pool_type=pool_type,
        status='ACTIVE'
    ).order_by('user_entry_index')
    
    print(f"📊 Found {positions.count()} positions to consolidate\n")
    
    if not positions.exists():
        print("❌ No active positions found!")
        return False
    
    # Check if root already exists
    root_exists = AutoPoolAccount.objects.filter(
        owner=user,
        pool_type=pool_type,
        parent_account__isnull=True
    ).exists()
    
    if root_exists:
        print("⚠️  Root entry already exists!")
        root = AutoPoolAccount.objects.get(owner=user, pool_type=pool_type, parent_account__isnull=True)
        print(f"Root: Account #{root.id}")
    else:
        print("✓ Creating ROOT entry (position=0, parent=None)...")
        if not dry_run:
            root = AutoPoolAccount.objects.create(
                owner=user,
                username_key=f"{user.phone or user.username}_5_0",
                entry_amount=Decimal("150.00"),
                pool_type=pool_type,
                status='ACTIVE',
                user_entry_index=0,
                position=0,
                parent_account=None,
                level=1,
                source_type='ROOT_CREATION',
                source_id=f'fix_root_{pool_type.lower()}',
            )
            print(f"✓ Created Root: Account #{root.id}\n")
        else:
            print(f"[DRY] Would create Root account\n")
            root = None
    
    # Show consolidation plan
    print("📋 CONSOLIDATION PLAN:")
    print("  Position → will be reparented to Root\n")
    
    for pos in positions:
        old_parent = pos.parent_account
        print(f"  Account #{pos.id} (entry_index:{pos.user_entry_index}, pos:{pos.position})")
        print(f"    Current parent: #{old_parent.id if old_parent else 'NONE'}")
        print(f"    Target:  Root entry (position={pos.position})")
        print()
    
    # Execute consolidation
    if not dry_run:
        if not root_exists:
            root = AutoPoolAccount.objects.get(owner=user, pool_type=pool_type, parent_account__isnull=True)
        
        for pos in positions:
            if pos.parent_account != root:
                pos.parent_account = root
                pos.level = 2  # Direct child of root
                pos.save(update_fields=['parent_account', 'level'])
                print(f"✓ Reparented Account #{pos.id} to Root")
        
        print(f"\n{'='*80}")
        print("✅ CONSOLIDATION COMPLETE")
        print(f"{'='*80}\n")
        return True
    else:
        print(f"{'='*80}")
        print("📋 DRY RUN: No changes made. Re-run with --apply to execute")
        print(f"{'='*80}\n")
        return False

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python fix_root_consolidation.py <phone_or_id> [--apply] [pool_type]")
        print("Example: python fix_root_consolidation.py 7975274750")
        print("         python fix_root_consolidation.py 7975274750 --apply")
        print("         python fix_root_consolidation.py 395 --apply THREE_150")
        sys.exit(1)
    
    phone_or_id = sys.argv[1]
    apply = '--apply' in sys.argv
    pool_type = 'THREE_150' if 'THREE_150' in sys.argv else 'FIVE_150'
    
    create_root_and_consolidate(phone_or_id, pool_type, dry_run=not apply)
