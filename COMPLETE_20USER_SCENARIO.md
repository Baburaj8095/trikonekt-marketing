"""
COMPLETE EXAMPLE: 20 USERS WITH MULTI-LEVEL REFERRALS & SELF RE-BIRTH
======================================================================

Scenario:
- User1 (8095918105) refers User2-6 (5 direct referrals)
- User2 (9876543210) refers User7-9 (3 direct referrals)
- User1 buys PRIME + self account allocation → creates self re-birth IDs
- Show complete tree structure and placement

"""

print("""
╔════════════════════════════════════════════════════════════════════════════╗
║              COMPLETE 20-USER SCENARIO WITH MULTI-LEVEL TREE               ║
╚════════════════════════════════════════════════════════════════════════════╝

USER LIST (1-20):
═════════════════════════════════════════════════════════════════════════════

Sponsor Chain:
  User1 (8095918105) ← Root of this tree
    ├─ User2 (9876543210) ← Referred by User1
    ├─ User3 (9111111111) ← Referred by User1
    ├─ User4 (9222222222) ← Referred by User1
    ├─ User5 (9333333333) ← Referred by User1
    ├─ User6 (9444444444) ← Referred by User1
    │
    User2's sub-referrals:
    ├─ User7 (9555555555) ← Referred by User2
    ├─ User8 (9666666666) ← Referred by User2
    ├─ User9 (9777777777) ← Referred by User2
    │
    Additional users for tree fill:
    ├─ User10 (9888888888)
    ├─ User11 (9999999999)
    ├─ User12 (8100000001)
    ├─ User13 (8100000002)
    ├─ User14 (8100000003)
    ├─ User15 (8100000004)
    ├─ User16 (8100000005)
    ├─ User17 (8100000006)
    ├─ User18 (8100000007)
    ├─ User19 (8100000008)
    └─ User20 (8100000009)


TIMELINE OF EVENTS:
═════════════════════════════════════════════════════════════════════════════

PHASE 0: INITIALIZATION
  └─ User1 registers (sponsored by someone else, e.g., root/sentinel)

PHASE 1: USER1 MAKES INITIAL PURCHASE
  └─ User1 buys "Account Allocation 1" (e.g., purchases a product)
     › Creates Account1 for User1 (entry_index: 1)
     › Unlocks 5 matrix positions (FIVE_150 pool)
     › Position capacity: 1-5

  USER1's Status:
    └─ Root account created (position=0, parent=NULL)
    └─ Account 1 allocated (entry_index: 1)
    └─ Available positions: 1, 2, 3, 4, 5

PHASE 2: USER1 REFERS & ACTIVATES 5 MEMBERS
  USER1 refers: User2, User3, User4, User5, User6
  
  Activation order & placement:
    1. User2 activates → placed in Position 1
    2. User3 activates → placed in Position 2
    3. User4 activates → placed in Position 3
    4. User5 activates → placed in Position 4
    5. User6 activates → placed in Position 5
    
  USER1's Tree (after Phase 2):
    ┌─────────────────────────┐
    │ User1 Root (pos 0)      │
    │ Account 1 (entry_idx:1) │
    ├─────────────────────────┤
    │ ├─ User2 (pos 1)        │
    │ ├─ User3 (pos 2)        │
    │ ├─ User4 (pos 3)        │
    │ ├─ User5 (pos 4)        │
    │ └─ User6 (pos 5)        │
    └─────────────────────────┘
    
    All positions FULL: 1-5 occupied

PHASE 3: USER2 CREATES OWN ROOT & REFERS 3 USERS
  
  User2's independent tree (nested under User1):
    ┌─────────────────────────────────────────┐
    │ User2 Root (pos 0)                      │
    │ Parent: User1's position 1              │
    │ Account 1 (entry_idx: 1)                │
    ├─────────────────────────────────────────┤
    │ ├─ User7 (pos 1)                        │
    │ ├─ User8 (pos 2)                        │
    │ ├─ User9 (pos 3)                        │
    │ ├─ Position 4 (EMPTY)                   │
    │ └─ Position 5 (EMPTY)                   │
    └─────────────────────────────────────────┘
    
    User2 has 2 empty slots available (pos 4-5)
    User1 is earning from User2's entire tree (User7, 8, 9)

PHASE 4: USER1 BUYS PRIME + SELF ACCOUNT ALLOCATION
  
  User1 purchases:
    ✓ PRIME package (creates Account 2, entry_index: 2)
    ✓ Self re-birth ID #1 (account allocation)
    ✓ Creates capacity for 5 MORE positions
  
  New capacity: 5 (account 1) + 5 (account 2) = 10 total positions
  
  Positions now available: 1-10
  Currently occupied: 1-5
  Newly available: 6-10
  
  USER1's Tree (after Phase 4):
    ┌──────────────────────────────┐
    │ User1 Root (pos 0)           │
    │ Account 1 (entry_idx: 1)     │
    │ Account 2 (entry_idx: 2) ✨  │
    ├──────────────────────────────┤
    │ ├─ User2 (pos 1)             │
    │ ├─ User3 (pos 2)             │
    │ ├─ User4 (pos 3)             │
    │ ├─ User5 (pos 4)             │
    │ ├─ User6 (pos 5)             │
    │ │                            │
    │ ├─ Position 6  (EMPTY) ✨    │
    │ ├─ Position 7  (EMPTY) ✨    │
    │ ├─ Position 8  (EMPTY) ✨    │
    │ ├─ Position 9  (EMPTY) ✨    │
    │ └─ Position 10 (EMPTY) ✨    │
    └──────────────────────────────┘
    
    ✨ = Unlocked by Account 2 (self re-birth)
    
    Accounts:
    ├─ Account1: created at initial purchase (entry_idx: 1)
    └─ Account2: created when buying PRIME (entry_idx: 2)
                → This is the "self re-birth" or "self account allocation"
    
    Question: Is there Account3?
      → If User1 buys another allocation → Yes, Account3 (entry_idx: 3)
      → Positions 11-15 become available
      → INFINITE scaling possible

PHASE 5: USER1 REFERS MORE MEMBERS (USES NEW POSITIONS 6-10)
  
  User1 refers: User10, User11, User12, User13, User14
  
  Activation order:
    6. User10 activates → placed in Position 6
    7. User11 activates → placed in Position 7
    8. User12 activates → placed in Position 8
    9. User13 activates → placed in Position 9
    10. User14 activates → placed in Position 10
  
  USER1's Tree (after Phase 5):
    ┌──────────────────────────────────┐
    │ User1 Root (pos 0)               │
    │ Account 1 (entry_idx: 1)         │
    │ Account 2 (entry_idx: 2)         │
    ├──────────────────────────────────┤
    │ LEVEL 1 (Positions 1-10):        │
    │ ├─ User2  (pos 1)                │
    │ ├─ User3  (pos 2)                │
    │ ├─ User4  (pos 3)                │
    │ ├─ User5  (pos 4)                │
    │ ├─ User6  (pos 5)                │
    │ ├─ User10 (pos 6)  ← New         │
    │ ├─ User11 (pos 7)  ← New         │
    │ ├─ User12 (pos 8)  ← New         │
    │ ├─ User13 (pos 9)  ← New         │
    │ └─ User14 (pos 10) ← New         │
    │                                  │
    │ LEVEL 2 (Spillover):             │
    │ └─ (Empty, waiting for Level 1   │
    │    Level 1 children to repeat)   │
    └──────────────────────────────────┘
    
    All positions occupied!
    Level 1 completely filled: 1-10
    Next referral will spill to Level 2

PHASE 6: USER1 REFERS 11TH MEMBER (SPILLOVER TO LEVEL 2)
  
  User1 refers: User15
  
  Activation:
    11. User15 activates → placed in Level 2, Position 1
  
  Level 2 placement logic:
    └─ Positions on Level 2 are children of Level 1 positions
    └─ User15 becomes child of User2 (pos 1) in the 5-matrix
  
  USER1's Tree (after Phase 6):
    ┌──────────────────────────────────┐
    │ User1 Root (pos 0)               │
    ├──────────────────────────────────┤
    │ LEVEL 1 (Positions 1-10):        │
    │ ├─ User2  (pos 1)                │
    │ │  └─ User15 (child, pos 1)      │
    │ ├─ User3  (pos 2)                │
    │ ├─ User4  (pos 3)                │
    │ ├─ User5  (pos 4)                │
    │ ├─ User6  (pos 5)                │
    │ ├─ User10 (pos 6)                │
    │ ├─ User11 (pos 7)                │
    │ ├─ User12 (pos 8)                │
    │ ├─ User13 (pos 9)                │
    │ └─ User14 (pos 10)               │
    └──────────────────────────────────┘
    
    Structure:
    User1
    ├─ Pos 1: User2 → Pos 1: User15
    ├─ Pos 2: User3
    ├─ Pos 3: User4
    ├─ Pos 4: User5
    ├─ Pos 5: User6
    ├─ Pos 6: User10
    ├─ Pos 7: User11
    ├─ Pos 8: User12
    ├─ Pos 9: User13
    └─ Pos 10: User14

PHASE 7: USER2, USER10, USER11 CREATE OWN ROOTS
  
  Each user creates independent subtree:
  
  USER2's subtree (already shown):
    Root under User1's Position 1
    Positions: User7 (pos 1), User8 (pos 2), User9 (pos 3)
  
  USER10's subtree:
    Root under User1's Position 6
    Positions: empty (1, 2, 3, 4, 5)
  
  USER11's subtree:
    Root under User1's Position 7
    Positions: empty (1, 2, 3, 4, 5)
  
  This continues recursively...


COMPLETE FINAL TREE STRUCTURE (20 Users):
═════════════════════════════════════════════════════════════════════════════

Level 1 (User1's direct positions):

User1 (Root)
├─ Pos 1: User2 (sponsored by User1, parent=User1 Root)
│  └─ User2's Root
│     ├─ Pos 1: User7 (sponsored by User2)
│     ├─ Pos 2: User8 (sponsored by User2)
│     ├─ Pos 3: User9 (sponsored by User2)
│     ├─ Pos 4: EMPTY
│     └─ Pos 5: EMPTY
│        └─ (Could have grandchildren when User7-9 refer people)
│
├─ Pos 2: User3 (sponsored by User1)
│  └─ User3's Root
│     └─ (empty positions waiting for User3's referrals)
│
├─ Pos 3: User4 (sponsored by User1)
│  └─ User4's Root
│     └─ (empty)
│
├─ Pos 4: User5 (sponsored by User1)
│  └─ User5's Root
│     └─ (empty)
│
├─ Pos 5: User6 (sponsored by User1)
│  └─ User6's Root
│     └─ (empty)
│
├─ Pos 6: User10 (sponsored by User1, Account 2)
│  └─ User10's Root
│     └─ (empty)
│
├─ Pos 7: User11 (sponsored by User1, Account 2)
│  └─ User11's Root
│     └─ (empty)
│
├─ Pos 8: User12 (sponsored by User1, Account 2)
│  └─ User12's Root
│     └─ (empty)
│
├─ Pos 9: User13 (sponsored by User1, Account 2)
│  └─ User13's Root
│     └─ (empty)
│
└─ Pos 10: User14 (sponsored by User1, Account 2)
   └─ User14's Root
      └─ (empty)

Level 2 (Spillover):
   User2's Pos 1: User15 (grandchild of User1 through User2)


DATABASE REPRESENTATION:
═════════════════════════════════════════════════════════════════════════════

AutoPoolAccount table (FIVE_150 pool):

ID  │ owner_id │ entry_idx │ parent_id │ position │ status  │ username_key
────┼──────────┼──────────┼───────────┼──────────┼─────────┼──────────────
1   │ User1    │ 0        │ NULL      │ 0        │ ACTIVE  │ User1_Root
2   │ User1    │ 1        │ NULL(root)│ NULL     │ ACTIVE  │ User1_Acc1
3   │ User1    │ 2        │ NULL(root)│ NULL     │ ACTIVE  │ User1_Acc2
    │          │          │           │          │         │
4   │ User2    │ 0        │ 2         │ 1        │ ACTIVE  │ User2_Root
5   │ User2    │ 1        │ NULL      │ NULL     │ ACTIVE  │ User2_Acc1
    │          │          │           │          │         │
6   │ User3    │ 0        │ 2         │ 2        │ ACTIVE  │ User3_Root
7   │ User3    │ 1        │ NULL      │ NULL     │ ACTIVE  │ User3_Acc1
    │          │          │           │          │         │
...

Explanation:
  - Row 1: User1's Root (entry_idx: 0, position: 0, parent: NULL)
  - Row 2: User1's Account 1 (entry_idx: 1, position: NULL)
  - Row 3: User1's Account 2 "self re-birth" (entry_idx: 2, position: NULL)
  - Row 4: User2's Root (entry_idx: 0, position: 1, parent: Row 2/User1's root)
  - Row 5: User2's Account 1 (entry_idx: 1, position: NULL)
  
  Position mapping:
    User1 Root → Position 1 = User2
              → Position 2 = User3
              → ...
              → Position 10 = User14
    
    User2 Root → Position 1 = User7
              → Position 2 = User8
              → Position 3 = User9


COMMISSION CALCULATION (Why it still works):
═════════════════════════════════════════════════════════════════════════════

User1's earnings:
  = Commission from all descendants of User1's positions
  = traverse_tree(User2) + traverse_tree(User3) + ... + traverse_tree(User14)
  = includes User2, User7, User8, User9, User3, ..., User14, User15, etc.

User1's sponsor's earnings:
  = Commission from User1's positions + all their descendants
  = traverse_tree(User1 Root)
  = includes all of User1's network

Why it works:
  → Positions still form a tree (parent_account chain intact)
  → Earnings follow parent_account chain
  → Even with multiple accounts (entry_idx), the commission query works
  → Commission doesn't care about entry_idx boundaries
  → Just follows parent pointers

Query:
  SELECT SUM(earning) FROM AutoPoolAccount
  WHERE parent_account IN (SELECT id FROM AutoPoolAccount WHERE owner = User1)
  RECURSIVE


FRONTEND DISPLAY (What Admin/User Sees):
═════════════════════════════════════════════════════════════════════════════

Admin Tree View (showing User1):

User1
└─ Root
   ├─ Position 1 [Account 1] - User2
   │  └─ Pos 1 [Account 1] - User7
   │  └─ Pos 2 [Account 1] - User8
   │  └─ Pos 3 [Account 1] - User9
   │
   ├─ Position 2 [Account 1] - User3
   ├─ Position 3 [Account 1] - User4
   ├─ Position 4 [Account 1] - User5
   ├─ Position 5 [Account 1] - User6
   │
   ├─ Position 6 [Account 2] - User10  ← from self re-birth
   ├─ Position 7 [Account 2] - User11  ← from self re-birth
   ├─ Position 8 [Account 2] - User12  ← from self re-birth
   ├─ Position 9 [Account 2] - User13  ← from self re-birth
   └─ Position 10 [Account 2] - User14 ← from self re-birth
      └─ Pos 1 - User15 (Level 2 spillover)


KEY INSIGHTS:
═════════════════════════════════════════════════════════════════════════════

1. ACCOUNT ALLOCATION CREATES CAPACITY
   ✓ Account 1 → 5 positions
   ✓ Account 2 (self re-birth) → 5 more positions
   ✓ Total capacity: 10 positions per account set

2. REFERRED MEMBERS FILL POSITIONS IN ORDER
   ✓ Members activate → placed in first available position (1-10)
   ✓ No gaps (BFS algorithm)
   ✓ When all filled → spillover to Level 2

3. SELF RE-BIRTH DOESN'T CREATE SEPARATE TREE
   ✓ It creates separate entry_index
   ✓ But all under SAME root
   ✓ Visually: just positions 6-10 available
   ✓ Not a separate "tree2"

4. MULTI-LEVEL STRUCTURE
   ✓ User1 has 10 direct positions
   ✓ User2 (a position) has 3 positions under it
   ✓ User7 (User2's position) could have its own positions
   ✓ Recursive structure

5. COMMISSION FLOW
   ✓ User1 earns from positions 1-10 and all descendants
   ✓ User1's sponsor earns from User1 and all descendants
   ✓ User2 earns from its positions (User7, 8, 9)
   ✓ User7 earns from its positions (if any)


HANDLING IN CODE:
═════════════════════════════════════════════════════════════════════════════

Phase 1: User1 buys Account 1
  create_five_150_for_user(user=User1, source_type='ACCOUNT_PURCHASE')
    → Creates root (entry_idx: 0)
    → Returns position 1-5 capacity

Phase 2: User1 refers User2
  User2 registers with sponsor=User1
  When User2 activates:
    create_five_150_for_user(user=User2, source_type='ACTIVATION')
      → Finds User1's root
      → Finds next available position (1)
      → Creates User2 root as child of User1 root at position 1

Phase 3: User1 buys PRIME (self re-birth)
  User1 buys prime package (simulates self account allocation):
    create_five_150_for_user(user=User1, source_type='PRIME_PURCHASE')
      → User1 already has root (entry_idx: 0)
      → Creates new entry (entry_idx: 2)
      → Expands position range to 6-10
      → Returns new capacity info

Phase 4: User1 refers User10 (uses new capacity)
  User10 registers with sponsor=User1
  When User10 activates:
    create_five_150_for_user(user=User10, source_type='ACTIVATION')
      → Finds User1's root
      → Finds next available position (6) ← Now possible because Account 2!
      → Creates User10 root as child of User1 root at position 6

Phase 5: User1 refers User15 (spillover)
  User15 registers with sponsor=User1
  When User15 activates:
    create_five_150_for_user(user=User15, source_type='ACTIVATION')
      → Finds User1's root
      → Finds next available position (all 1-10 full)
      → Spillover: places at Level 2 under position 1 (User2)
      → Creates User15 root as child of User2 root at position 1 (Level 2)


MANAGEMENT IN ADMIN PANEL:
═════════════════════════════════════════════════════════════════════════════

User1's Admin View Shows:
  ✓ Single tree with 10 positions visible
  ✓ 5 filled (User2-6)
  ✓ 5 filled (User10-14)
  ✓ 1 Level 2 spillover (User15 under User2)
  ✓ Accounts labeled: [Account 1] vs [Account 2]
  ✓ Drill-down into User2 shows User2's subtree
  ✓ Commission dashboard shows total earnings

User1's Consumer View Shows:
  ✓ "My Tree" tab
  ✓ Visual 5-matrix representation
  ✓ All 10 positions visible (or paginated)
  ✓ "Referred Members" count: 10
  ✓ "Team Size" count: 11+ (includes all descendants)

""")

print("\n" + "="*80)
print("QUICK SUMMARY TABLE")
print("="*80)

summary = """

USER-BY-USER BREAKDOWN (20 Users):

┌─────┬────────────────┬──────────┬────────────────────┬─────────────┐
│ No  │ Name/ID        │ Sponsor  │ MatrixPosition     │ TreeLevel   │
├─────┼────────────────┼──────────┼────────────────────┼─────────────┤
│ 1   │ User1          │ Root     │ Root (pos 0)       │ 0 (Root)    │
│     │ (8095918105)   │          │ Acc1 (entry_idx:1) │             │
│     │                │          │ Acc2 (entry_idx:2) │             │
├─────┼────────────────┼──────────┼────────────────────┼─────────────┤
│ 2   │ User2          │ User1    │ Pos 1 (under U1)   │ 1           │
│     │ (9876543210)   │ Ref#1    │ Acc1 (entry_idx:1) │             │
├─────┼────────────────┼──────────┼────────────────────┼─────────────┤
│ 3   │ User3          │ User1    │ Pos 2 (under U1)   │ 1           │
│     │                │ Ref#2    │ Acc1 (entry_idx:1) │             │
├─────┼────────────────┼──────────┼────────────────────┼─────────────┤
│ 4   │ User4          │ User1    │ Pos 3              │ 1           │
│     │                │ Ref#3    │                    │             │
├─────┼────────────────┼──────────┼────────────────────┼─────────────┤
│ 5   │ User5          │ User1    │ Pos 4              │ 1           │
│     │                │ Ref#4    │                    │             │
├─────┼────────────────┼──────────┼────────────────────┼─────────────┤
│ 6   │ User6          │ User1    │ Pos 5              │ 1           │
│     │                │ Ref#5    │                    │             │
├─────┼────────────────┼──────────┼────────────────────┼─────────────┤
│ 7   │ User7          │ User2    │ Pos 1 (under U2)   │ 2           │
│     │                │ Ref#1    │                    │             │
├─────┼────────────────┼──────────┼────────────────────┼─────────────┤
│ 8   │ User8          │ User2    │ Pos 2 (under U2)   │ 2           │
│     │                │ Ref#2    │                    │             │
├─────┼────────────────┼──────────┼────────────────────┼─────────────┤
│ 9   │ User9          │ User2    │ Pos 3 (under U2)   │ 2           │
│     │                │ Ref#3    │                    │             │
├─────┼────────────────┼──────────┼────────────────────┼─────────────┤
│ 10  │ User10         │ User1    │ Pos 6 (under U1)   │ 1           │
│     │                │ Ref#6    │ [from Acc2]        │             │
├─────┼────────────────┼──────────┼────────────────────┼─────────────┤
│ 11  │ User11         │ User1    │ Pos 7 (under U1)   │ 1           │
│     │                │ Ref#7    │ [from Acc2]        │             │
├─────┼────────────────┼──────────┼────────────────────┼─────────────┤
│ 12  │ User12         │ User1    │ Pos 8 (under U1)   │ 1           │
│     │                │ Ref#8    │ [from Acc2]        │             │
├─────┼────────────────┼──────────┼────────────────────┼─────────────┤
│ 13  │ User13         │ User1    │ Pos 9 (under U1)   │ 1           │
│     │                │ Ref#9    │ [from Acc2]        │             │
├─────┼────────────────┼──────────┼────────────────────┼─────────────┤
│ 14  │ User14         │ User1    │ Pos 10 (under U1)  │ 1           │
│     │                │ Ref#10   │ [from Acc2]        │             │
├─────┼────────────────┼──────────┼────────────────────┼─────────────┤
│ 15  │ User15         │ User1    │ Pos 1 Lv2 (U2)     │ 2 (Spillover)
│     │                │ Ref#11   │ [from Acc2, spill] │             │
├─────┼────────────────┼──────────┼────────────────────┼─────────────┤
│ 16  │ User16         │ TBD      │ (not activated)    │ N/A         │
│ 17  │ User17         │ TBD      │ (not activated)    │ N/A         │
│ 18  │ User18         │ TBD      │ (not activated)    │ N/A         │
│ 19  │ User19         │ TBD      │ (not activated)    │ N/A         │
│ 20  │ User20         │ TBD      │ (not activated)    │ N/A         │
└─────┴────────────────┴──────────┴────────────────────┴─────────────┘


ACCOUNTS CREATED:
  User1: 3 accounts
    - Entry_idx 0: Root
    - Entry_idx 1: Account 1 (initial purchase)
    - Entry_idx 2: Account 2 (PRIME/self re-birth) ← SELF RE-BIRTH #1
    
  User2: 2 accounts
    - Entry_idx 0: Root
    - Entry_idx 1: Account 1

  Users 3-15: Similar (at least root + account 1)


EARNINGS FLOW:
  User1 earns from: All 10 direct positions + descendants (User15)
  User2 earns from: User7, User8, User9 (direct 3 positions)
  User1's sponsor earns from: User1 + entire User1's tree
  User2's sponsor (User1) earns from: User2, User7, User8, User9
  ...


KEY ACHIEVEMENT:
  ✓ User1's self re-birth (Account 2) doesn't create separate tree
  ✓ Just unlocks 5 more position slots (6-10)
  ✓ User1 sees single unified matrix with 10 members
  ✓ No tree fragmentation
  ✓ Commission flows naturally up the chain
  ✓ All positions visible together in admin

"""

print(summary)
