"""
HYBRID PLACEMENT ANALYSIS: User-Centric Positions + Sponsor-Chain Earnings
===========================================================================

User 8095918105's scenario:
- Refers 6 members
- Has self account allocation creating multiple entries
- All positions should appear under 8095918105's matrix
- Commission still flows upline to sponsor

KEY INSIGHT: This is NOT a breaking change - it's a placement reorganization only.
"""

print("""
╔════════════════════════════════════════════════════════════════════════════╗
║          SCENARIO: User 8095918105 Self-Rooted + Sponsor Earnings         ║
╚════════════════════════════════════════════════════════════════════════════╝

1. USER 8095918105'S OWN POSITIONS (FROM SELF ALLOCATION)
═══════════════════════════════════════════════════════════════════════════════

Current System (Sponsor-Anchored):
┌────────────────────────────────┐
│ Sponsor (registered_by)        │
│   └─ Root (position 0)         │
│      ├─ Position 8095918105-1  │ ← Scattered across sponsor's tree
│      ├─ Position 8095918105-2  │
│      ├─ Position 8095918105-3  │
│      └─ (Other users' positions) │
└────────────────────────────────┘

DESIRED SYSTEM (User-Rooted):
┌────────────────────────────────┐
│ User 8095918105                │
│   └─ Root (position 0)         │
│      ├─ Position 8095918105-1  │ ← All grouped together
│      ├─ Position 8095918105-2  │
│      ├─ Position 8095918105-3  │
│      ├─ Position 8095918105-4  │
│      ├─ Position 8095918105-5  │
│      ├─ Position 8095918105-6  │
│      └─ Level 2: Spillover...  │
└────────────────────────────────┘


2. REFERRAL MEMBERS (6 REFERRED BY 8095918105)
═══════════════════════════════════════════════════════════════════════════════

User 8095918105's Positions act as PARENTS:

Position 1 (pos=1)    ← Member A gets placed here
Position 2 (pos=2)    ← Member B gets placed here
Position 3 (pos=3)    ← Member C gets placed here
Position 4 (pos=4)    ← Member D gets placed here
Position 5 (pos=5)    ← Member E gets placed here
Position 6 (Level 2)  ← Member F spills over here


3. CRITICAL ARCHITECTURE: DUAL ANCHORING
═══════════════════════════════════════════════════════════════════════════════

This creates TWO separate chains:

PLACEMENT CHAIN (for tree visualization):
  8095918105's Root → [8095918105-1 to 8095918105-6] → Referrals → ...

COMMISSION CHAIN (for earnings):
  Sponsor A → ... → 8095918105 (still earns for A) → 8095918105's positions


4. CHANGE IMPACT ANALYSIS
═══════════════════════════════════════════════════════════════════════════════

PLACEMENT CHANGES:
  ✅ create_five_150_for_user() now uses user's root, NOT sponsor's tree
  ✅ Spillover goes to user's level 2, NOT sibling positions
  ✅ Only affects WHERE positions are placed (parent_account reference)

COMMISSION CHANGES:
  ✅ NO CHANGE - Positions still in global tree = still generate upline earnings
  ✅ The tree structure doesn't change for commission calculations
  ✅ Just the viewing/anchoring point changes


5. HOW IT WORKS: THE MECHANISM
═══════════════════════════════════════════════════════════════════════════════

Code change needed: _sponsor_start_entry_id_for()

CURRENT:
  def _sponsor_start_entry_id_for(user, pool_type):
      sponsor = user.registered_by
      sponsor_account = AutoPoolAccount.objects.filter(
          owner=sponsor,
          parent_account__isnull=False  ← NOT NULL (positioned under sponsor's sponsor)
      ).first()
      return sponsor_account.id

PROPOSED:
  def _user_root_entry_for(user, pool_type):
      return AutoPoolAccount.objects.filter(
          owner=user,
          parent_account__isnull=True,  ← Find USER'S own root, not sponsor's
          pool_type=pool_type
      ).first()

  def _sponsor_start_entry_id_for(user, pool_type):
      user_root = _user_root_entry_for(user, pool_type)
      
      if not user_root:
          # Create it if missing
          user_root = AutoPoolAccount.objects.create(
              owner=user,
              parent_account=user.registered_by's root,  ← CRITICAL
              position=NULL,  ← No specific position; it's a root
              pool_type=pool_type,
              level=N,
              ...
          )
      
      return user_root.id


6. COMMISSION STILL WORKS - WHY?
═══════════════════════════════════════════════════════════════════════════════

EARNINGS CALCULATION doesn't change:

commission = traverse_tree_for_earnings(my_positions)
           = filter(owner=sponsor, parent_account IN [my_positions])
           = all descendants of my positions

Even if the positions are now under user's root instead of sponsor's tree,
they're still in the same global AutoPoolAccount table. 

Commission query still works:
  SELECT sum(earnings) FROM AutoPoolAccount
  WHERE parent_account IN (my_position.id) RECURSIVELY

The tree structure is the same - the only difference is:
  OLD: Sponsor A → Position A1 → Position B1 → ...
  NEW: Sponsor A → 8095918105 Root → Position 8095918105-1 → Position B1 → ...

But earnings still flow because the parent_account chain is intact!


7. IMPACT ON DATABASE
═══════════════════════════════════════════════════════════════════════════════

Data changes needed:

Option A: ZERO changes to existing data
  ✓ Only affects NEW position creation logic
  ✓ No migration of existing 6M positions
  ✓ Hybrid state: old positions stay scattered, new positions are grouped
  ✗ Confusing for admins (old users scattered, new users grouped)

Option B: Migrate existing positions
  ✓ All positions grouped consistently
  ✓ Clean state
  ✗ Requires data migration (but MUCH SIMPLER than full rewrite)
  
  Migration steps:
    1. For each user with positions:
       CREATE root (position=0, parent=NULL)
       UPDATE positions SET parent_account = root WHERE owner = user
    
    This is SAFE because:
      - Positions still in same tree (parent of root = NULL)
      - Commission queries still work (just different starting point)
      - No position moves in the hierarchy

Option C: Gradual migration (feature flagged)
  ✓ Can test with subset of users first
  ✓ Rollback per-user if needed
  ⚠ Requires query-level logic to handle both old and new


8. THE KEY QUESTION: WHERE DOES USER'S ROOT GET PLACED?
═══════════════════════════════════════════════════════════════════════════════

This determines if earnings flow works:

OPTION 1: User's root is child of sponsor's root
┌─────────────────────────────┐
│ Sponsor A (root)            │
│   ├─ 8095918105 Root        │ ← 8095918105's root is here
│   │  ├─ 8095918105-1        │
│   │  ├─ 8095918105-2        │
│   │  └─ ...                 │
│   │                         │
│   └─ Other users...         │
└─────────────────────────────┘

✅ PROS:
  - 8095918105's earnings still go to Sponsor A
  - Simple parent-child relationship
  - Existing commission queries work unchanged

❌ CONS:
  - Takes up 1 slot in Sponsor A's tree
  - Sponsor A sees 8095918105's root as 1 child, not 6 positions


OPTION 2: User's root is completely separate (parallel)
┌──────────────────────┐        ┌──────────────────────┐
│ Sponsor A (root)     │        │ 8095918105 (root)    │
│   └─ Other users...  │        │   ├─ 8095918105-1    │
└──────────────────────┘        │   ├─ 8095918105-2    │
                                │   └─ ...             │
                                └──────────────────────┘

❌ PROS:
  - 8095918105's tree is fully independent

❌ CONS:
  - Breaks commission chain (8095918105's earnings don't flow to A)
  - Requires NEW commission logic (not acceptable per your requirement)
  - WRONG APPROACH


RECOMMENDED: OPTION 1
User root is child of their sponsor's root
(Just like any other position, but with position=0 or position=NULL)


9. HOW SPILLOVER WORKS IN NEW SYSTEM
═══════════════════════════════════════════════════════════════════════════════

User 8095918105 buys 6 self-accounts:

Placement order: 8095918105-1, 8095918105-2, ..., 8095918105-6

┌─── 8095918105's ROOT ─────────────────────────────────┐
│                                                        │
├─ [8095918105-1] ← pos 1 (Member A referred by A)      │
├─ [8095918105-2] ← pos 2 (Member B referred by B)      │
├─ [8095918105-3] ← pos 3 (Member C referred by C)      │
├─ [8095918105-4] ← pos 4 (Member D referred by D)      │
├─ [8095918105-5] ← pos 5 (Member E referred by E)      │
│                                                        │
└─ LEVEL 2 (spillover starts here)                      │
   └─ [8095918105-6] ← pos 1 (Member F - spillover)     │
      └─ ...new children go here                        │


10. COMPLEXITY ASSESSMENT
═══════════════════════════════════════════════════════════════════════════════

RISK: 🟢 LOW (compared to full system redesign)

Why?
  ✓ Placement algorithm unchanged (BFS still works)
  ✓ Commission logic unchanged (positions still in tree)
  ✓ Spillover logic unchanged
  ✓ Only ONE code location changes: _sponsor_start_entry_id_for()
  ✓ Can migrate gradually or not at all (new positions only)

IMPLEMENTATION EFFORT: 🟡 MEDIUM

  Tasks:
    1. Create _user_root_entry_for() function
    2. Update create_five_150_for_user() to use it
    3. Update genealogy APIs to fetch user's root instead
    4. Update frontend Genealogy5.jsx to show user's own positions
    5. Test with new users first

  NO CHANGES to:
    ✓ Commission calculation logic
    ✓ Database schema
    ✓ Existing position queries
    ✓ Earnings calculations


11. IMPACT ON ALL USERS (MIGRATION SCOPE)
═══════════════════════════════════════════════════════════════════════════════

Option A: Don't migrate existing users
  Timeline: IMMEDIATE (code change only)
  Risk: LOW
  Benefit: Immediate for new users, old users unaffected
  Con: Hybrid state (inconsistent for admins)

Option B: Migrate existing users
  Timeline: 1-2 weeks (migration script + verification)
  Risk: MEDIUM (safe but needs testing)
  Benefit: All users consistent
  Con: Requires downtime window

RECOMMENDATION: Option A
  Deploy code change immediately for new users
  Build migration script
  Schedule migration for future maintenance window
  Test with subset first (100 users)


12. DATABASE IMPACT
═══════════════════════════════════════════════════════════════════════════════

Schema: NO CHANGES needed

Current fields already support this:
  ✓ AutoPoolAccount.parent_account → can point to user's root
  ✓ AutoPoolAccount.owner → already set correctly
  ✓ AutoPoolAccount.position → works for all positions

Index usage:
  Current: (parent_account, pool_type, position) ← still used
  New need: (owner, parent_account, pool_type) for faster lookup
  
  (should already exist or add one index)


13. COMMISSION FLOW VERIFICATION
═══════════════════════════════════════════════════════════════════════════════

Example: Who earns what?

User 8095918105 (sponsored by Sponsor A)
├─ Wins commission from: 8095918105-1 to 8095918105-6 ✓
├─ Sponsor A wins commission from: 8095918105-1 to 8095918105-6 ✓
│
Member A (referred by 8095918105, sponsored by A)
├─ Placed under: 8095918105-1
├─ Wins commission from: Member A's own children
├─ 8095918105 wins commission from: Member A + Member A's tree ✓
└─ Sponsor A wins commission from: 8095918105 + entire tree ✓

RESULT: No change in who earns from whom!
Only the tree VIEW changes, not the tree STRUCTURE.


14. SUMMARY: IS THIS SAFE AND VIABLE?
═══════════════════════════════════════════════════════════════════════════════

✅ YES, absolutely viable and MUCH safer than original proposal

✅ Why safe?
  - Position table structure unchanged
  - Commission logic unchanged
  - Only placement anchor changes
  - Earnings still flow upline correctly

✅ Why better?
  - Admin can see all user 8095918105's positions in one place
  - Cleaner tree visualization
  - Spillover logic intuitive (within user's tree)
  - New positions organized by owner, not by sponsor

⚠ Caveats:
  - Need to decide: migrate old users or not?
  - Requires small code change in 1-2 functions
  - Frontend needs update to show user's positions instead of sponsor's

🎯 RECOMMENDED APPROACH:
  Phase 1: Code change for NEW positions (low risk)
  Phase 2: Test with 100 new users
  Phase 3: If working, build migration for old users
  Phase 4: Schedule migration in maintenance window

""")

print("\n" + "="*80)
print("CODE CHANGE SUMMARY")
print("="*80)

code_changes = """
FILES TO CHANGE:

1. backend/business/models.py
   Function: create_five_150_for_user()
   
   OLD:
     start_id = cls._sponsor_start_entry_id_for(user, "FIVE_150")
     return GenericPlacement.place_account(
         owner=user,
         pool_type="FIVE_150",
         start_entry_id=start_id,  ← Sponsor's tree
         ...
     )
   
   NEW:
     user_root = cls._get_or_create_user_root(user, "FIVE_150")
     return GenericPlacement.place_account(
         owner=user,
         pool_type="FIVE_150",
         start_entry_id=user_root.id,  ← User's own root
         ...
     )


2. backend/business/models.py
   NEW FUNCTION:
   
   @classmethod
   def _get_or_create_user_root(cls, user, pool_type):
       \"\"\"Get or create a user's root entry.\"\"\"
       root = cls.objects.filter(
           owner=user,
           parent_account__isnull=True,
           pool_type=pool_type,
       ).first()
       
       if not root:
           # Create root under sponsor's root
           sponsor = user.registered_by
           sponsor_root = cls.objects.filter(
               owner=sponsor,
               parent_account__isnull=True,
               pool_type=pool_type,
           ).first()
           
           if not sponsor_root:
               # Fallback: sponsor has no root, use global sentinel
               sponsor_root = cls.objects.filter(
                   pool_type=pool_type,
                   owner__id=9999999999,  # Sentinel user
               ).first()
           
           # Find next available position under sponsor root
           next_pos = cls.objects.filter(
               parent_account=sponsor_root,
               pool_type=pool_type,
           ).count() + 1
           
           root = cls.objects.create(
               owner=user,
               parent_account=sponsor_root,
               position=next_pos,
               pool_type=pool_type,
               user_entry_index=0,
               level=sponsor_root.level + 1,
               status='ACTIVE',
           )
       
       return root


3. frontend/src/pages/team/Genealogy5.jsx
   
   OLD: Fetch from myPositions (array of positions)
   NEW: Fetch from user's root position first
   
   Change:
   const rootForTree = positions[0]  ← This user's first position (current)
   → const rootForTree = findUserRoot(positions)  ← This user's actual root


This is MUCH smaller change than the original proposal!
"""

print(code_changes)
