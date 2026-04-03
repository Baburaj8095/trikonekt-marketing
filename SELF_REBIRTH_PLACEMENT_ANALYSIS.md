"""
SLOT ALLOCATION & SELF RE-BIRTH PLACEMENT ANALYSIS
====================================================

Scenario: User 8095918105 refers 5 members, then buys self account allocation

CRITICAL QUESTIONS:
1. Where do the 5 referred members get placed?
2. When user buys self re-birth (8095918105-2), where does it go?
3. Can referred members fill empty slots?
4. How many independent trees per user?
"""

print("""
╔════════════════════════════════════════════════════════════════════════════╗
║             SLOT ALLOCATION SCENARIOS & SELF RE-BIRTH PLACEMENT            ║
╚════════════════════════════════════════════════════════════════════════════╝

SCENARIO: User 8095918105 Refers 5 Members, Then Self Re-birth
═════════════════════════════════════════════════════════════════════════════


EXAMPLE 1: CURRENT PROPOSED SYSTEM
═════════════════════════════════════════════════════════════════════════════

User 8095918105 (Original Account/Entry Index 1)
└─ Root (position 0)
   ├─ Position 1: Member A (referred by user, activated by user)
   ├─ Position 2: Member B
   ├─ Position 3: Member C
   ├─ Position 4: Member D
   ├─ Position 5: Member E
   │
   └─ Level 2 (Spillover for 6th+ referrals)
      └─ Position 1: Future referral 6
         └─ Member F's children
      └─ Position 2: Future referral 7
      └─ ...

USER BUYS SELF RE-BIRTH (Entry Index 2):
═══════════════════════════════════════════════════════════════════════════════

Question: Where should 8095918105-2 go?

OPTION A: CREATE SEPARATE ROOT (INDEPENDENT TREE)
┌──────────────────────────┐
│ User 8095918105          │
│ ├─ ROOT 1 (entry idx 1)  │  ← 5 referred members here
│ │  ├─ Member A           │
│ │  ├─ Member B           │
│ │  └─ ...                │
│ │                        │
│ └─ ROOT 2 (entry idx 2)  │  ← Self re-birth, separate root
│    ├─ (empty slots)      │
│    ├─ (can have own      │
│    └─  referrals)        │
└──────────────────────────┘

Pros:
  ✓ Each entry index has own complete tree (5 slots each)
  ✓ Can refer completely different members
  ✓ Separate slot management
  ✓ User can grow 2x(5) = 10 direct positions

Cons:
  ✗ User sees TWO separate matrices in admin
  ✗ Members see which root they're under
  ✗ More complex tracking


OPTION B: SELF RE-BIRTH BECOMES CHILD OF ORIGINAL ROOT
┌──────────────────────────────────┐
│ User 8095918105                  │
│ └─ ROOT 1 (entry idx 1)          │
│    ├─ Position 1: Member A       │
│    ├─ Position 2: Member B       │
│    ├─ Position 3: Member C       │
│    ├─ Position 4: Member D       │
│    ├─ Position 5: Member E       │
│    │                             │
│    └─ Level 2:                   │
│       ├─ Position 1: 8095918105-2│  ← Re-birth is here!
│       │  ├─ (empty slots)        │
│       │  └─ (can have referrals) │
│       │                          │
│       └─ Position 2: Future ref  │
└──────────────────────────────────┘

Pros:
  ✓ Single unified tree per user
  ✓ User sees all positions in one place
  ✓ Simple tracking

Cons:
  ✗ Self re-birth USES a spillover slot
  ✗ Reduces space for referred members
  ✗ Self re-birth competes with referrals


OPTION C: SELF RE-BIRTH DEFINED AS "ADDITIONAL SLOT CREATOR" (RECOMMENDED)
═════════════════════════════════════════════════════════════════════════════

User buys self re-birth = User buys RIGHT to create more positions
(doesn't need to be placed in tree, just unlocks capacity)

Example:

User 8095918105
├─ Account allocation (self account 1) → can have 5 positions
├─ Self re-birth (self account 2) → can have 5 MORE positions
├─ → Total: up to 10 parallel positions under same root
│
User 8095918105's Root
├─ Position 1-5: From account 1
├─ Position 6-10: From account 2  ← Uses different entry_index bucket
│
├─ Level 1 (positions 1-5):
│  ├─ Pos 1: Member A (from account 1)
│  ├─ Pos 2: Member B (from account 1)
│  ├─ Pos 3: Member C (from account 1)
│  ├─ Pos 4: Member D (from account 1)
│  ├─ Pos 5: Member E (from account 1)
│
├─ Level 1 (positions 6-10):  ← Only if user has self re-birth
│  ├─ Pos 6: Can place referral 6
│  ├─ Pos 7: Can place referral 7
│  └─ ...
│
└─ Level 2: Spillover for more

Pros:
  ✅ BEST: User sees single unified matrix with 10 slots (if 2 accounts)
  ✅ Referred members DO fill empty slots
  ✅ Self re-birth EXPANDS capacity, doesn't create separate tree
  ✅ Simple for admin to understand
  ✅ No complex multi-tree tracking


COMPARISON TABLE:
═════════════════════════════════════════════════════════════════════════════

┌─────────────────────┬──────────┬──────────┬──────────────┐
│ Aspect              │ Option A │ Option B │ Option C ✓   │
├─────────────────────┼──────────┼──────────┼──────────────┤
│ # of Roots          │ 2        │ 1        │ 1            │
│ Referred members    │ 5+5      │ 5 + 1    │ 5+5          │
│ Complexity          │ High     │ Medium   │ Low          │
│ Admin visibility    │ Complex  │ Simple   │ Simple ✓     │
│ Slot utilization    │ Good     │ Poor     │ Good ✓       │
│ Self re-birth as    │ ROOT     │ POSITION │ CAPACITY     │
└─────────────────────┴──────────┴──────────┴──────────────┘


RECOMMENDATION: OPTION C - CAPACITY-BASED MODEL
═════════════════════════════════════════════════════════════════════════════

User 8095918105 (pool: FIVE_150)
├─ Account Allocation 1 (entry_index: 1)
│  └─ Creates capacity for 5 positions
│
├─ Self Re-Birth 2 (entry_index: 2)
│  └─ Creates capacity for 5 MORE positions
│
= Total capacity: 10 positions available

Placement Logic:
  BFS fills position 1-5, then 6-10
  
  Position 1-5 source: entry_index 1 (account 1)
  Position 6-10 source: entry_index 2 (account 2)
  
  But they're all SIBLINGS under same ROOT

Tree View:
┌────────────────────────────────────┐
│ User 8095918105's Root             │
├────────────────────────────────────┤
│ Account 1 (entry_idx 1):           │
│  ├─ Pos 1: Member A                │
│  ├─ Pos 2: Member B                │
│  ├─ Pos 3: Member C                │
│  ├─ Pos 4: Member D                │
│  └─ Pos 5: Member E                │
│                                    │
│ Account 2 (entry_idx 2):           │
│  ├─ Pos 6: Can place referral      │
│  ├─ Pos 7: Can place referral      │
│  └─ ...                            │
│                                    │
│ Level 2 (if Level 1 full):         │
│  └─ Spillover positions 1, 2, ...  │
└────────────────────────────────────┘


ANSWER TO YOUR QUESTIONS:
═════════════════════════════════════════════════════════════════════════════

Q1: "Where slots will be empty, user can have direct refer right?"
A1: YES ✓
    - 5 referred members fill positions 1-5
    - Positions are tracked by (parent, position) constraint
    - If position is empty, next referral placement algorithm finds it
    - Returns to BFS filling empty slots before spillover

Q2: "This user has referred 5 members, they will be placed under him?"
A2: YES ✓
    - 5 members → placed in positions 1-5 under their root
    - BFS placement algorithm
    - Referred when they activate account

Q3: "Later user will buy or self account allocate which will create self re-birth id, 
     then where that self id will be placed?"
A3: Two scenarios:

    SCENARIO A: Self re-birth is just a CAPACITY INCREASE
      - It doesn't get "placed" anywhere
      - It just unlocks positions 6-10
      - So user can refer 10 people instead of 5
      - No self re-birth is placed in the tree
    
    SCENARIO B: Self re-birth creates SEPARATE ROOT
      - User 8095918105-2 gets its own root
      - Can place its own 5 positions under it
      - User sees TWO matrices side-by-side
      - Need to clarify business logic


WHICH SCENARIO MATCHES YOUR BUSINESS MODEL?
═════════════════════════════════════════════════════════════════════════════

IMPORTANT: This affects:
  1. How many direct referrals a user can have
  2. How self re-birth accounts interact with original account
  3. Commission calculation (does re-birth earn separately?)


EXAMPLE - SCENARIO A (Capacity Increase):
  User 8095918105 buys 1 account: can refer 5 people
  User 8095918105 buys self re-birth: can refer 10 people
  
  Cost: User effectively buys MORE slots per account allocation
  Benefit: User maximized referral growth in single tree

EXAMPLE - SCENARIO B (Separate Trees):
  User 8095918105 account 1: refers 5 people (Account 1)
  User 8095918105 account 2: refers 5 different people (Account 2)
  
  Cost: User manages two separate matrices
  Benefit: Each account independent, can have completely different structure


CURRENT SYSTEM CONTEXT:
═════════════════════════════════════════════════════════════════════════════

Looking at your diagnostic results:
  Account #9213 (entry_index: 1, position: 4)
  Account #9214 (entry_index: 2, position: 5)
  Account #9609 (entry_index: 3, position: 5)
  Account #9610 (entry_index: 4, position: 2)
  Account #9611 (entry_index: 5, position: 3)
  Account #9612 (entry_index: 6, position: 4)

This suggests: SCENARIO B is current behavior
  - Multiple entry_index = multiple separate accounts
  - User 395 has 6 accounts with different positions
  - Each taking up a slot in someone's tree

So the "self re-birth" likely creates a NEW entry_index, which:
  ❌ Currently creates separate node (takes slot in sponsor tree)
  ✅ Should (per your request) create separate root (visual grouping)


SLOT MANAGEMENT ALGORITHM:
═════════════════════════════════════════════════════════════════════════════

For Option C (Capacity-based):

def get_available_position(user, pool_type):
    \"\"\"Find next available position for user's root.\"\"\"
    
    # Count all entry_indexes for this user + pool
    all_entries = AutoPoolAccount.objects.filter(
        owner=user,
        pool_type=pool_type
    ).aggregate(max_idx=Max('user_entry_index'))
    
    # Maximum positions = 5 * number_of_entries
    max_positions = (all_entries['max_idx'] or 0 + 1) * 5
    
    # Find current positions under user's root
    occupied = AutoPoolAccount.objects.filter(
        parent_account__owner=user,
        pool_type=pool_type,
        position__isnull=False
    ).values('position')
    
    # Find first empty slot
    for pos in range(1, max_positions + 1):
        if pos not in occupied:
            return pos
    
    # No slots available
    return None


SPILLOVER LOGIC UPDATE:
═════════════════════════════════════════════════════════════════════════════

Current 5-matrix spillover:
  Positions 1-5 (Level 1)
    → Position 6 goes to Level 2, Position 1

With self re-birth creating more capacity:
  Positions 1-5 (Level 1, account 1)
  Positions 6-10 (Level 1, account 2)  ← NEW
    → Position 11 goes to Level 2, Position 1

""")

print("\n" + "="*80)
print("DECISION MATRIX: Which Scenario Are You Targeting?")
print("="*80)

decision_matrix = """

1. CURRENT BEHAVIOR (Scenario B - What You Have Now):
   
   Code location: _sponsor_start_entry_id_for()
   
   Each self re-birth creates separate entry_index
   → Places it as separate account in some tree
   → Account 9213, 9214, 9609, ... are all SEPARATE nodes
   
   PROBLEM: They're scattered across different parent accounts
   SOLUTION: Group them under user's root
   
   To implement:
    1. Create user root (position=0)
    2. Reparent all entry_indexes to user root
    3. Give each entry_index its own "position bucket"
       e.g., positions 1-5 for entry_idx 1
            positions 6-10 for entry_idx 2
            positions 11-15 for entry_idx 3

2. DESIRED BEHAVIOR (Scenario C - What You Want):
   
   Self re-birth = Capacity expansion, not new account
   
   User sees single tree with:
    - 5 positions (if 1 account)
    - 10 positions (if 2 accounts)
    - 15 positions (if 3 accounts)
   
   All under same root, visually grouped
   
   To implement:
    1. Create user root (position=0)
    2. All positions under that root
    3. Position numbering: 1-5, 6-10, 11-15, ...
    4. Track position <-> entry_index mapping for commission


RECOMMENDATION FOR YOUR SYSTEM:
═════════════════════════════════════════════════════════════════════════════

Based on your description: "user will buy or self account allocate 
which will create self re-birth id then where that self id will be placed?"

I recommend SCENARIO C (Capacity-based):

✅ User adds entry index 2 → unlocks positions 6-10
✅ User adds entry index 3 → unlocks positions 11-15
...
✅ All visible in single admin tree

This is CLEANER and matches your goal of having everything visible together.

IMPLEMENTATION IMPACT:

Code change needed:
  1. Placement algorithm tracks (owner, entry_index, position)
  2. Position range = (entry_index - 1) * 5 + 1 to entry_index * 5
  3. Spillover calculation updated for max position
  4. frontend shows single tree, not multiple roots

Risk: LOW - just changes position numbering logic
Benefit: HIGH - cleaner UX, user sees single matrix

"""

print(decision_matrix)
