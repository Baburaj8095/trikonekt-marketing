"""
SIMPLIFIED VISUALIZATION: 20 USER TREE STRUCTURE WITH 5-MATRIX & 3-MATRIX
========================================================================
"""

tree_structure = """

USER1'S MATRICES AFTER BUYING PROMO PACKAGE (250 self allocation):
═════════════════════════════════════════════════════════════════════

SECTION A: USER1's 5-MATRIX ID (SPONSORED LEVEL TREE CHAIN)
═══════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────┐
│           USER1 - 5-MATRIX ID (FIVE_150)                       │
│         Sponsored Level Tree Chain                             │
│           Parent = Sponsor's positioned account                │
│              Total Capacity: 5 positions                        │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LEVEL 1 (5-MATRIX CONSTRAINT = MAX 5 POSITIONS ONLY): 🔴 RULE  │
│  ═══════════════════════════════════════════════════════════   │
│                                                                  │
│  ├─ [Pos 1] USER2 (9876543210) ✓ ACTIVE                        │
│  │          └─ Position 1 in User1's 5-MATRIX tree              │
│  │          └─ (User2 also has own 5-MATRIX & 3-MATRIX)        │
│  │                                                              │
│  ├─ [Pos 2] USER3 (9111111111) ✓ ACTIVE                        │
│  │          └─ Position 2 in User1's 5-MATRIX tree              │
│  │          └─ (User3 also has own 5-MATRIX & 3-MATRIX)        │
│  │                                                              │
│  ├─ [Pos 3] USER4 (9222222222) ✓ ACTIVE                        │
│  │          └─ Position 3 in User1's 5-MATRIX tree              │
│  │          └─ (User4 also has own 5-MATRIX & 3-MATRIX)        │
│  │                                                              │
│  ├─ [Pos 4] USER5 (9333333333) ✓ ACTIVE                        │
│  │          └─ Position 4 in User1's 5-MATRIX tree              │
│  │          └─ (User5 also has own 5-MATRIX & 3-MATRIX)        │
│  │                                                              │
│  └─ [Pos 5] USER6 (9444444444) ✓ ACTIVE                        │
│             └─ Position 5 in User1's 5-MATRIX tree              │
│             └─ (User6 also has own 5-MATRIX & 3-MATRIX)        │
│                                                                  │
│                                                                  │
│  LEVEL 2 (SPILLOVER when User1's Level 1 positions 1-5 FULL):  │
│  ═══════════════════════════════════════════════════════════   │
│                                                                  │
│  └─ Under User2's Position (Pos 1):                            │
│     ├─ [L2-Pos 1] USER10 Level 2 Spillover ✓                   │
│     ├─ [L2-Pos 2] USER11 Level 2 Spillover ✓                   │
│     ├─ [L2-Pos 3] USER12 Level 2 Spillover ✓                   │
│     ├─ [L2-Pos 4] USER13 Level 2 Spillover ✓                   │
│     └─ [L2-Pos 5] USER14 Level 2 Spillover ✓                   │
│                                                                  │
│  └─ Under User3's Position (Pos 2):                            │
│     └─ [L2-Pos 1] USER15 Level 2 Spillover ✓                   │
│                                                                  │
│  SUMMARY:                                                        │
│  ✓ Total Level 1 Positions: 5 (FIXED - 5-MATRIX RULE)          │
│  ✓ All Level 1 Occupied: YES (User2-6)                         │
│  ✓ Level 2 Spillover: YES (User10-15 go to Level 2)            │
│  ✓ Self Re-birth Active: YES (Account 2) but doesn't change    │
│    Level 1 capacity - still 5 positions ONLY                    │
│  ✓ Total Team Size: 15+ depending on how many accounts         │
│                                                                  │
└────────────────────────────────────────────────────────────────┘


SECTION B: USER1's 3-MATRIX ID (GLOBAL LEVEL - EMPTY SLOTS)
═══════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────┐
│           USER1 - 3-MATRIX ID (THREE_150)                      │
│         Global Level (Fills Empty Slots in MLM Algorithm)      │
│        Parent = Empty slot in global MLM pool                  │
│              Total Capacity: 3 positions                        │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LEVEL 1 (3-MATRIX = MAX 3 POSITIONS ONLY): 🔴 RULE             │
│  ═══════════════════════════════════════════════════════════   │
│                                                                  │
│  ├─ [Pos 1] USER7 (9555555555) ✓ ACTIVE                        │
│  ├─ [Pos 2] USER8 (9666666666) ✓ ACTIVE                        │
│  └─ [Pos 3] USER9 (9777777777) ✓ ACTIVE                        │
│                                                                  │
│  LEVEL 2 (SPILLOVER - When 3 Level 1 positions full):          │
│  ═══════════════════════════════════════════════════════════   │
│                                                                  │
│  └─ Under User7's Position (Pos 1):                            │
│     └─ [L2-Pos 1] USER20 Level 2 Spillover ✓                   │
│                                                                  │
│  3-MATRIX SUMMARY:                                              │
│  ✓ Total Level 1 Positions: 3 (FIXED - 3-MATRIX RULE)          │
│  ✓ All Level 1 Occupied: YES (User7-9)                         │
│  ✓ Level 2 Spillover: YES (User20+ go to Level 2)              │
│  ✓ Parent: Global slot from MLM algorithm (NOT sponsor)        │
│  ✓ Total Team Size: 4+ (3 direct + spillover)                  │
│                                                                  │
└────────────────────────────────────────────────────────────────┘


SECTION C: USER2's OWN MATRICES (Separate from Position in User1)
═══════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────┐
│        USER2 (9876543210) - Their Own 5-MATRIX ID             │
│         (SEPARATE from their Position 1 in User1's 5-MATRIX)   │
│           Parent = User2's sponsor positioned account          │
│              Total Capacity: 5 positions                        │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LEVEL 1:                                                        │
│  ├─ [Pos 1] ??? (User referred by User2)                       │
│  ├─ [Pos 2] ??? (User referred by User2)                       │
│  ├─ [Pos 3] ??? (User referred by User2)                       │
│  ├─ [Pos 4] EMPTY                                              │
│  └─ [Pos 5] EMPTY                                              │
│                                                                  │
│  USER2's OWN MATRIX SUMMARY:                                    │
│  ✓ This is User2's tree (not part of User1's tree)             │
│  ✓ Parent: Wherever User2's sponsor placed them               │
│  ✓ If User2 refers 3 people: Positions 1-3 filled ✓           │
│  ✓ If User2 refers 3 people: Positions 4-5 stay EMPTY ✓       │
│  ✓ Completely independent from User1's matrices               │
│                                                                  │
└────────────────────────────────────────────────────────────────┘


CRITICAL DISTINCTION:
═════════════════════════════════════════════════════════════════

❌ WRONG (Mixing concepts):
   User2 in User1's tree + User2's own referrals = Same thing

✅ RIGHT (Two separate concepts):
   
   1. USER2's POSITION in User1's 5-MATRIX:
      └─ Position 1
      └─ Level 2 spillover: User10, 11, 12, 13, 14 (in User1's tree)
   
   2. USER2's OWN 5-MATRIX (their tree as an active user):
      └─ Position 1-3: Filled if they refer 3 people
      └─ Position 4-5: EMPTY (no referrals)
   
   THESE ARE NOT CONNECTED!


VISUAL CLARITY:
═════════════════════════════════════════════════════════════════

USER1's FOREST (Two trees):

TREE 1: 5-MATRIX (Sponsored)
───────────────────────────────
User1.5matrix
├─ Pos 1: User2 ─────────┐
├─ Pos 2: User3           │
├─ Pos 3: User4           │  (These are User1's direct referrals)
├─ Pos 4: User5           │
└─ Pos 5: User6 ─────────┐
   └─ [L2] User10-14      │  (Spillover in User1's tree)
      User15

TREE 2: 3-MATRIX (Global)
──────────────────────────
User1.3matrix
├─ Pos 1: User7 ─────────┐
├─ Pos 2: User8           │  (These are User1's direct referrals)
└─ Pos 3: User9 ─────────┐
   └─ [L2] User20         │  (Spillover in User1's tree)


USER2's SEPARATE FOREST (Also two trees):

TREE 1: User2's 5-MATRIX (Sponsored)      TREE 2: User2's 3-MATRIX (Global)
──────────────────────────────────        ──────────────────────
User2.5matrix                             User2.3matrix
├─ Pos 1: ??? (if referred)               ├─ Pos 1: ??? (if referred)
├─ Pos 2: ??? (if referred)               ├─ Pos 2: ??? (if referred)
├─ Pos 3: ??? (if referred)               └─ Pos 3: ??? (if referred)
├─ Pos 4: EMPTY                          
└─ Pos 5: EMPTY                          

^ This is Independent of User1's trees!
^ User2 has their OWN earning streams!


TREE STRUCTURE CLARITY:
═════════════════════════════════════════════════════════════════

When User2 is activated and placed in User1's tree:

Step 1: User2 joins and gets positioned
   └─ User2 placed at Position 1 in User1's 5-MATRIX
   └─ User2 also gets their own matrices (as an active user)
   
   Result: User2 now has TWO MATRIX PAIRS:
     ├─ User2's position in User1's tree (earning from User1's structure)
     └─ User2's own personal matrices (earning from their own referrals)


Step 2: Level 2 spillover happens in User1's tree
   └─ When User1's positions 1-5 all filled, next person goes to Level 2
   └─ User10-14 placed at Level 2 positions under User2's position
   └─ This does NOT affect User2's own matrix positions
   
   Result: User1 earns from User2 (position), User10-14 (spillover)
          User2 earns from their own referrals (separate tree)


Step 3: User2's own positions fill (if they refer people)
   └─ User2 refers User X, Y, Z to their own 5-MATRIX
   └─ These are NOT the same as User10-14 (which are in User1's tree)
   └─ User2's positions 1-3 filled, 4-5 empty
   
   Result: User2 earns from User X, Y, Z (their own tree)
          User1 still earns from User10-14 (User1's tree)


EVOLUTION TIMELINE WITH CLARITY:
═════════════════════════════════════════════════════════════════

Day 1: User1 buys PROMO package
  └─ Creates User1's 5-MATRIX (parent = User1's sponsor)
  └─ Creates User1's 3-MATRIX (parent = global slot)
  └─ Capacity: 5 + 3 = 8 positions available


Day 5: User2-6 join (referred to User1's 5-MATRIX)
  └─ User2 at Position 1 of User1.5matrix ✓
  └─ User3 at Position 2 of User1.5matrix ✓
  └─ User4 at Position 3 of User1.5matrix ✓
  └─ User5 at Position 4 of User1.5matrix ✓
  └─ User6 at Position 5 of User1.5matrix ✓
  
  User1's 5-MATRIX Level 1: FULL


Day 7: User2 becomes active (gets their own matrices)
  └─ User2 now has User2.5matrix (parent = User2's sponsor)
  └─ User2 now has User2.3matrix (parent = global slot)
  └─ User2 can now refer people to their own trees
  └─ But these are separate from User2's position in User1's tree!


Day 10: User7-9 join (referred to User1's 3-MATRIX)
  └─ User7 at Position 1 of User1.3matrix ✓
  └─ User8 at Position 2 of User1.3matrix ✓
  └─ User9 at Position 3 of User1.3matrix ✓
  
  User1's 3-MATRIX Level 1: FULL


Day 15: User10-14 join (spillover in User1's 5-MATRIX)
  └─ User1's 5-MATRIX Level 1 is full (User2-6)
  └─ User10 placed at Level 2 under User2.position ✓
  └─ User11 placed at Level 2 under User2.position ✓
  └─ User12 placed at Level 2 under User2.position ✓
  └─ User13 placed at Level 2 under User2.position ✓
  └─ User14 placed at Level 2 under User2.position ✓
  
  ⚠️ User10-14 are in User1's tree, NOT in User2's personal tree!


Day 20: User2 refers User25, User26, User27 (to User2's own 5-MATRIX)
  └─ User25 at Position 1 of User2.5matrix ✓
  └─ User26 at Position 2 of User2.5matrix ✓
  └─ User27 at Position 3 of User2.5matrix ✓
  
  User2.5matrix Level 1:
    Positions 1-3: FILLED (User25-27)
    Positions 4-5: EMPTY
  
  ✓ This earnings goes to User2 (not User1!)


Day 25: User20 joins (spillover in User1's 3-MATRIX)
  └─ User1's 3-MATRIX Level 1 is full (User7-9)
  └─ User20 placed at Level 2 under User7.position ✓
  
  User1 earns from User20 (in User1's 3-matrix)
  User2 doesn't earn from User20 (different tree!)


EARNINGS BREAKDOWN:
═════════════════════════════════════════════════════════════════

User1 Earns From:
  ├─ User1.5matrix:
  │  ├─ Level 1: User2, User3, User4, User5, User6 (5)
  │  └─ Level 2: User10, User11, User12, User13, User14 (5)
  │
  └─ User1.3matrix:
     ├─ Level 1: User7, User8, User9 (3)
     └─ Level 2: User20 (1+)
  
  Total: 14+ people earning for User1


User2 Earns From:
  ├─ User2's position (under User1):
  │  └─ Earn commission from User1's sponsor chain
  │
  ├─ User2.5matrix:
  │  └─ Level 1: User25, User26, User27 (3)
  │  └─ Level 2: (empty if no spillover)
  │
  └─ User2.3matrix:
     └─ Level 1: (empty if User2 hasn't referred to 3-matrix)
     └─ Level 2: (empty)
  
  Total: 3+ people + commission from User1's upline

print("\n" + "="*80)
print("ACCOUNT CREATION SEQUENCE IN CODE")
print("="*80)

code_sequence = """

PHASE 1: User1 Joins (Day 0)
──────────────────────────────
create_five_150_for_user(
    user=User1,
    source_type='INITIAL_REGISTRATION',
    source_id='reg_001'
)

Result: 
  ├─ Entry_idx: 0 (Root account, position=0)
  ├─ parent_account: NULL
  ├─ Position range: 1-5 available
  └─ Status: Ready


PHASE 2: User2 Joins & Activates (Day 5)
──────────────────────────────────────────
create_five_150_for_user(
    user=User2,
    source_type='ACCOUNT_ACTIVATION',
    source_id='user2_activation',
    start_entry_id=<User1's root ID>
)

Result:
  ├─ Entry_idx: 0 (Root account)
  ├─ parent_account: User1's root
  ├─ position: 1 (first available under User1)
  └─ Status: Placed


[Similar for User3, User4, User5, User6 - positions 2-5]


PHASE 3: User1 Buys PRIME/Self Re-birth (Day 10)
───────────────────────────────────────────────────
create_five_150_for_user(
    user=User1,
    source_type='PRIME_PURCHASE',
    source_id='prime_purchase_001'
)

Result:
  ├─ Entry_idx: 2 (Account 2, self re-birth)
  ├─ parent_account: NULL (grouped under same root)
  ├─ position: NULL
  ├─ Position range: 6-10 now available
  └─ Status: Ready for placement


PHASE 4: User10 Joins & Activates (Day 15)
────────────────────────────────────────────
create_five_150_for_user(
    user=User10,
    source_type='ACCOUNT_ACTIVATION',
    source_id='user10_activation',
    start_entry_id=<User1's root ID>
)

Find next available position:
  └─ Positions 1-5: Full
  └─ Position 6: Available! (from Account 2)
  └─ Placement: position 6

Result:
  ├─ Entry_idx: 0 (Root account)
  ├─ parent_account: User1's root
  ├─ position: 6 (from Account 2 capacity)
  └─ Status: Placed


PHASE 5: User15 Joins & Activates (Day 20)
────────────────────────────────────────────
create_five_150_for_user(
    user=User15,
    source_type='ACCOUNT_ACTIVATION',
    source_id='user15_activation',
    start_entry_id=<User1's root ID>
)

Find next available position:
  └─ Positions 1-10: All full!
  └─ Spillover to Level 2
  └─ Level 2, Position 1 available (under User2)
  └─ Placement: parent=User2's root, position=1, level=2

Result:
  ├─ Entry_idx: 0 (Root account)
  ├─ parent_account: User2's root (not User1!)
  ├─ position: 1 (level 2)
  ├─ level: 2
  └─ Status: Placed (spillover)


DATABASE STATE FINAL:
═════════════════════════════════════════════════════════════════

AutoPoolAccount table (relevant rows):

id │ owner │ entry_idx │ parent_id │ position │ level │ status
───┼───────┼───────────┼───────────┼──────────┼───────┼────────
1  │ U1    │ 0         │ NULL      │ 0        │ 1     │ ACTIVE
2  │ U1    │ 1         │ NULL      │ NULL     │ 1     │ ACTIVE
3  │ U1    │ 2         │ NULL      │ NULL     │ 1     │ ACTIVE  ← Self re-birth
4  │ U2    │ 0         │ 1         │ 1        │ 2     │ ACTIVE
5  │ U2    │ 1         │ NULL      │ NULL     │ 1     │ ACTIVE
6  │ U3    │ 0         │ 1         │ 2        │ 2     │ ACTIVE
7  │ U4    │ 0         │ 1         │ 3        │ 2     │ ACTIVE
8  │ U5    │ 0         │ 1         │ 4        │ 2     │ ACTIVE
9  │ U6    │ 0         │ 1         │ 5        │ 2     │ ACTIVE
10 │ U7    │ 0         │ 4         │ 1        │ 3     │ ACTIVE
11 │ U8    │ 0         │ 4         │ 2        │ 3     │ ACTIVE
12 │ U9    │ 0         │ 4         │ 3        │ 3     │ ACTIVE
13 │ U10   │ 0         │ 1         │ 6        │ 2     │ ACTIVE
14 │ U11   │ 0         │ 1         │ 7        │ 2     │ ACTIVE
15 │ U12   │ 0         │ 1         │ 8        │ 2     │ ACTIVE
16 │ U13   │ 0         │ 1         │ 9        │ 2     │ ACTIVE
17 │ U14   │ 0         │ 1         │ 10       │ 2     │ ACTIVE
18 │ U15   │ 0         │ 4         │ 1        │ 3     │ ACTIVE  ← Child of U2 (spillover)

Key observations:
  • User1 has 3 accounts (entry_idx: 0, 1, 2) but only 1 root
  • Positions 1-5: Account 1 users
  • Positions 6-10: Account 2 users
  • User2 root (entry_idx: 0) has parent_id=1 (User1's root)
  • User15 is child of User2, NOT User1 (spillover creates hierarchy level)


ANSWER TO YOUR QUESTIONS:
═════════════════════════════════════════════════════════════════

Q: "Where will self re-birth IDs be placed?"
A: Under same root! Account 2 just unlocks positions 6-10

Q: "User2 refers 3 users - where do they go?"
A: Under User2's root (positions 1-3), not under User1's positions

Q: "User1 will take prime + self account allocation - how many self IDs?"
A: Depends on how many allocations purchased:
   • 1 allocation = Account 1 (5 positions)
   • 2 allocations = Account 1 + Account 2 (10 positions)
   • 3 allocations = Account 1 + 2 + 3 (15 positions)
   = Infinite scaling possible

Q: "How is this scenario handled?"
A: Three entry_indexes under same root, positions numbered 1-15+

"""

print(code_sequence)
