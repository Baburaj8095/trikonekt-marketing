"""
Diagnostic script: Find all positions for a user and check their placement in the tree.
Usage: python diagnose_position_placement.py <phone_or_id> [pool_type]
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db.models import Q
from accounts.models import CustomUser
from business.models import AutoPoolAccount

def diagnose_user_positions(phone_or_id, pool_type='FIVE_150'):
    """Diagnose where all positions for a user are placed in the tree."""
    
    # Find the user
    try:
        user_id = int(phone_or_id)
        user = CustomUser.objects.get(id=user_id)
    except (ValueError, CustomUser.DoesNotExist):
        # Try by phone
        user = CustomUser.objects.filter(
            Q(phone=phone_or_id) | Q(username=phone_or_id)
        ).first()
    
    if not user:
        print(f"❌ User not found: {phone_or_id}")
        return
    
    print(f"\n{'='*80}")
    print(f"DIAGNOSIS: User {user.id} ({user.phone or user.username})")
    print(f"Pool Type: {pool_type}")
    print(f"{'='*80}\n")
    
    # Get all positions owned by this user
    positions = AutoPoolAccount.objects.filter(
        owner=user,
        pool_type=pool_type,
        status='ACTIVE'
    ).select_related('owner', 'parent_account').order_by('id')
    
    print(f"📊 Total positions: {positions.count()}\n")
    
    if not positions.exists():
        print("❌ No active positions found!")
        return
    
    for idx, pos in enumerate(positions, 1):
        print(f"{idx}. AutoPoolAccount #{pos.id}")
        print(f"   └─ User ID: {pos.owner.id}")
        print(f"   └─ Username: {pos.owner.phone}")
        print(f"   └─ Position: {pos.position}")
        print(f"   └─ User Entry Index: {pos.user_entry_index}")
        print(f"   └─ Level: {pos.level}")
        
        # Find parent account (upline)
        if pos.parent_account:
            parent = pos.parent_account
            print(f"   └─ Parent Account: #{parent.id} (User: {parent.owner.phone})")
            print(f"   └─ Parent is Root?: {parent.owner.id == user.id}")
        else:
            print(f"   └─ Parent Account: None (ROOT)")
        
        # Count direct children
        children_count = pos.children.filter(pool_type=pool_type).count()
        print(f"   └─ Direct Children: {children_count}")
        print()
    
    # Summary Analysis
    print(f"\n{'='*80}")
    print("📋 PLACEMENT ANALYSIS")
    print(f"{'='*80}\n")
    
    # Find root account (parent_account=None)
    root_accounts = AutoPoolAccount.objects.filter(
        pool_type=pool_type,
        parent_account__isnull=True
    )
    
    # Check if user has own root or if their positions are children of others
    user_root = positions.filter(parent_account__isnull=True).first()
    
    if user_root:
        print(f"✓ User Root Account found: #{user_root.id} (user_entry_index: {user_root.user_entry_index})")
        
        # Get direct children of user's root
        direct_children = user_root.children.filter(pool_type=pool_type).order_by('position')
        print(f"✓ Direct children of user's root: {direct_children.count()}")
        for child in direct_children:
            print(f"  ├─ Account #{child.id} at position {child.position} (User: {child.owner.phone})")
        
        # Check if there are positions NOT as direct children of user's root
        non_direct = positions.exclude(parent_account=user_root)
        if non_direct.exists():
            print(f"\n⚠️  WARNING: {non_direct.count()} positions are NOT direct children of user's root!")
            for pos in non_direct:
                if pos.parent_account:
                    parent_user = pos.parent_account.owner
                    print(f"  ├─ Account #{pos.id} is child of Account #{pos.parent_account.id} (User: {parent_user.phone}, ID: {parent_user.id})")
                else:
                    print(f"  ├─ Account #{pos.id} has no parent (orphaned)")
    else:
        print("⚠️  WARNING: User has no root account (parent_account=None)!")
        print("All positions must be children of some parent account:")
        for pos in positions:
            if pos.parent_account:
                parent_user = pos.parent_account.owner
                print(f"  ├─ Account #{pos.id} is child of Account #{pos.parent_account.id} (User: {parent_user.phone})")
            else:
                print(f"  ├─ Account #{pos.id} has no parent!")
    
    print(f"\n{'='*80}\n")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python diagnose_position_placement.py <phone_or_id> [pool_type]")
        print("Example: python diagnose_position_placement.py 7975274750")
        print("         python diagnose_position_placement.py 395 THREE_150")
        sys.exit(1)
    
    phone_or_id = sys.argv[1]
    pool_type = sys.argv[2] if len(sys.argv) > 2 else 'FIVE_150'
    
    diagnose_user_positions(phone_or_id, pool_type)
