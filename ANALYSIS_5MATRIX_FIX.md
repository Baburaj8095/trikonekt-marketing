# ANALYSIS: 5-MATRIX FIX - SPONSOR-ANCHORED → USER-ROOTED

## Current State: How 5-MATRIX Works Now

### Code Flow:
```
create_five_150_for_user(user=User1)
  ↓
Call: _sponsor_start_entry_id_for(user=User1, pool_type="FIVE_150")
  ↓
Query: AutoPoolAccount.objects.filter(
    owner=User1.registered_by,          ← SPONSOR, not User1!
    pool_type="FIVE_150",
    status="ACTIVE",
    parent_account__isnull=False        ← must be positioned (not root)
).first()
  Returns: Sponsor's FIVE_150 account ID
  ↓
Call: GenericPlacement.place_account(
    owner=User1,
    pool_type="FIVE_150",
    start_entry_id=SPONSOR_ACCOUNT_ID   ← KEY: start from sponsor's tree
)
  ↓
find_next_placement_slot():
  - root = AutoPoolAccount.objects.get(id=SPONSOR_ACCOUNT_ID)  ← Sponsor's positioned account
  - BFS from this node
  - Finds first empty position under sponsor's subtree
  ↓
CREATE AutoPoolAccount:
  - owner: User1
  - parent_account: Sponsor's positioned account
  - position: [1-5] (first available under sponsor)
  - level: 2 (one level below sponsor)
```

### Example (Current Broken State):
```
User1.sponsor = UserA
User2.sponsor = UserB
UserC.sponsor = UserC (self)

User1 buys FIVE_150:
  ↓ Looks for UserA's positioned FIVE_150
  ↓ Finds UserA.5matrix (parent=UserA.sponsor, pos=2)
  → User1.5matrix created as child of UserA.5matrix at position 1
  → User1 now in UserA's tree!

User2 buys FIVE_150:
  ↓ Looks for UserB's positioned FIVE_150
  ↓ Finds UserB.5matrix (parent=UserB.sponsor, pos=3)
  → User2.5matrix created as child of UserB.5matrix at position 1
  → User2 now in UserB's tree!

User1 refers User2:
  ↓ PROBLEM: User2.5matrix is NOT under User1!
  ↓ User2 is a child of some other parent (UserB's tree)
  ↓ Cannot build unified tree under User1
```

---

## 3-MATRIX: Already Correct (No Changes Needed)

### Code:
```python
create_three_150_for_user(user=User1)
  ↓
Call: GenericPlacement.place_account(
    owner=user,
    pool_type="THREE_150",
    start_entry_id=None           ← *** NO SPONSOR ANCHOR ***
)
  ↓
find_next_placement_slot(start_account_id=None):
  - root = _ensure_sentinel_root("THREE_150")  ← Global pool root
  - BFS from sentinel
  - Finds next empty slot in global tree
  ↓
CREATE AutoPoolAccount:
  - owner: User1
  - parent_account: (some global node)
  - position: [1-3]
  - level: depends on global tree state
```

✅ This is CORRECT - 3-MATRIX uses global pool, not sponsor chain.

---

## Solution: Make 5-MATRIX User-Rooted

### High Level Change:
**Instead of:**
```
User1.5matrix.parent = Sponsor's positioned account
```

**Do this:**
```
User1.5matrix.parent = User1's own root (if exists)
```

### Implementation Required:

#### STEP 1: Add Helper Function
**File:** `backend/business/models.py`

**Add new method to `AutoPoolAccount` class:**
```python
@classmethod
def _get_or_create_user_root(cls, user, pool_type: str):
    """
    Get or create the user's root FIVE_150 account.
    
    A user root is:
      - owner = user
      - parent_account = NULL (no parent)
      - position = NULL (no sibling position)
      - level = 1 (top level of user's tree)
      - user_entry_index = 0 (primary account)
      - pool_type = FIVE_150
    
    Returns:
      - Existing root if found
      - Newly created root if not found
      - None if user not eligible
    """
    # Eligibility check
    if not is_matrix_eligible(user):
        return None
    
    try:
        # Try to find existing root (parent=NULL, user_entry_index=0)
        root = cls.objects.filter(
            owner=user,
            pool_type=pool_type,
            parent_account__isnull=True,
            user_entry_index=0,
            status="ACTIVE"
        ).first()
        
        if root:
            return root
        
        # CREATE new root under transaction lock
        with transaction.atomic():
            # Double-check (race condition guard)
            root = cls.objects.select_for_update().filter(
                owner=user,
                pool_type=pool_type,
                parent_account__isnull=True,
                user_entry_index=0
            ).first()
            
            if root:
                return root
            
            # Create new root
            root = cls.objects.create(
                owner=user,
                username_key=getattr(user, "username", "") or "",
                entry_amount=Decimal("150.00"),
                pool_type=pool_type,
                status="ACTIVE",
                parent_account=None,           ← KEY: No parent
                level=1,                       ← Top level
                position=None,                 ← No sibling position
                user_entry_index=0,            ← Primary account
                source_type="USER_ROOT",
                source_id=f"user_{user.id}"
            )
            return root
            
    except Exception as e:
        logger.exception(f"Error in _get_or_create_user_root: {e}")
        return None
```

#### STEP 2: Modify create_five_150_for_user()
**File:** `backend/business/models.py`

**Current code:**
```python
start_id = cls._sponsor_start_entry_id_for(user, "FIVE_150") if start_entry_id is None else start_entry_id
return GenericPlacement.place_account(
    owner=user,
    pool_type="FIVE_150",
    amount=amt,
    source_type=source_type or "",
    source_id=source_id or "",
    start_entry_id=start_id,  ← Uses sponsor's account
)
```

**Change to:**
```python
# For FIVE_150, always use user's own root (not sponsor)
# This consolidates all user's positions under ONE tree
user_root = cls._get_or_create_user_root(user, "FIVE_150")

if not user_root:
    logger.warning(f"Cannot create FIVE_150: user not eligible", extra={"user_id": user.id})
    return None

return GenericPlacement.place_account(
    owner=user,
    pool_type="FIVE_150",
    amount=amt,
    source_type=source_type or "",
    source_id=source_id or "",
    start_entry_id=user_root.id,  ← Uses user's root, not sponsor!
)
```

#### STEP 3: Check GenericPlacement.place_account()
**Status:** ✅ NO CHANGES NEEDED

Why?
- It takes `start_entry_id` parameter
- Does BFS from that point
- Doesn't care if it's sponsor's account or user's root
- Just does placement algorithm correctly

#### STEP 4: Check find_next_placement_slot()
**Status:** ✅ NO CHANGES NEEDED

Why?
- Takes `start_account_id` parameter
- Does standard BFS (width-before-depth)
- Returns (parent, position, level)
- Doesn't care about who owns the parent

---

## What This Changes:

### BEFORE FIX:
```
Sponsor's FIVE_150 (parent=Sponsor's parent)
├─ Position 1: User1.5matrix
│  └─ Position 1: User10.5matrix (spillover)
├─ Position 2: User2.5matrix
│  └─ (empty)
└─ Position 3: User3.5matrix
   └─ (empty)

User1's own tree: DOESN'T EXIST
User1 can't see unified tree
```

### AFTER FIX:
```
User1's ROOT (parent=NULL)
├─ Position 1: User2
│  └─ Position 1: User10 (spillover)
├─ Position 2: User3
│  └─ Position 1: User11 (spillover)
├─ Position 3: User4
├─ Position 4: User5
└─ Position 5: User6

User1 also has User1.3matrix (global pool):
├─ Position 1: User7
├─ Position 2: User8
└─ Position 3: User9

User1 sees BOTH trees together!
```

---

## Key Changes Summary:

| Aspect | Before | After |
|--------|--------|-------|
| **5-MATRIX parent** | Sponsor's positioned account | User's own root |
| **User root exists?** | NO | YES (created on demand) |
| **Where placed** | Sponsor's tree | Own tree |
| **Spillover** | Under sponsor's user2 | Under own user2 |
| **Admin view** | Scattered positions | Unified tree |
| **Commission flow** | Through sponsor chain | User's root → sponsor (unchanged) |
| **3-MATRIX** | Global pool | NO CHANGE |

---

## Impact Analysis:

### No Impact:
- ✅ BFS algorithm (unchanged)
- ✅ Width-before-depth (unchanged)
- ✅ Position numbering (unchanged)
- ✅ Commission calculation (unchanged)
- ✅ 3-MATRIX placement (unchanged)
- ✅ Database schema (unchanged)
- ✅ API responses (JSON still same)

### Minor Changes:
- ⚠️ User root creation (new row auto-created)
- ⚠️ Tree visualization (now shows user's tree, not sponsor's)
- ⚠️ Genealogy queries (fetches from user root instead of first positioned)

### Migration Path:
- 🔄 Option A: New users only (apply now, existing unaffected)
- 🔄 Option B: Full migration (run script to create roots + reparent for existing users)

---

## Risk Assessment:

### Low Risk:
- New function only adds to codebase
- GenericPlacement untouched
- No schema changes
- Commission logic untouched

### Testable:
- Create new user, buy FIVE_150
- Verify: user has parent_account=NULL root
- Verify: referrals placed as children of root
- Verify: spillover works (under user2, not sponsor's user2)

### Rollback:
- Revert code changes
- Old data stays in place (no deletion)
- No data corruption risk

---

## Pseudo-Code for Fix:

```python
# OLD (BROKEN):
def create_five_150_for_user(user):
    sponsor_root_id = find_sponsor_positioned_account(user)  # ❌ Wrong anchor
    place_account(owner=user, start_entry_id=sponsor_root_id)

# NEW (FIXED):
def create_five_150_for_user(user):
    user_root = get_or_create_user_root(user)  # ✅ Right anchor
    place_account(owner=user, start_entry_id=user_root.id)
```

---

## Files to Modify:

1. **backend/business/models.py**
   - Add `_get_or_create_user_root(user, pool_type)` method
   - Modify `create_five_150_for_user()` to use new method

2. **backend/business/services/placement.py**
   - ✅ NO CHANGES

3. **backend/business/views.py** (genealogy endpoint)
   - May need update to fetch from user root instead of first position
   - ✅ Depends on how UI currently works

---

## Testing Checklist:

- [ ] User creates FIVE_150 → has parent_account=NULL root
- [ ] User refers User2 → User2 placed as position 1 under user root
- [ ] User refers User3-6 → positions 1-5 filled under user root
- [ ] User refers User7 → spillover to level 2 under User2
- [ ] Tree visualization shows all 6 users in one tree
- [ ] 3-MATRIX still works (global pool)
- [ ] Commission earnings unchanged
- [ ] Existing users unaffected (if Option A)

---

## Conclusion:

**Only 5-MATRIX needs fixing.** Change one function call:
```
FROM: start_entry_id = _sponsor_start_entry_id_for(user)
TO:   start_entry_id = _get_or_create_user_root(user).id
```

3-MATRIX already correctly uses global pool (no changes needed).
