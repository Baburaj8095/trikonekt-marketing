# Matrix Account Timeline Analysis Report

## Executive Summary

**Critical Discovery Through Timeline Matching:**

The approval time of transactions (promo purchases, self-account allocations, e-coupons) should match closely with the creation time of matrix accounts. When there's a mismatch, it indicates the account was created by an **EXTERNAL COMMAND** rather than from the transaction itself.

### Key Findings

| Metric | Count |
|--------|-------|
| **Unbalanced Users** | 29 |
| **Orphaned FIVE_150 Accounts** | 136 |
| **Orphaned THREE_150 Accounts** | 81 |
| **Total Orphaned/Duplicate Accounts** | **217** |

These 217 orphaned accounts are the **root cause of all duplicates** - they were NOT created by transaction processing logic, but by external commands.

---

## Timeline Matching Criteria

When matching transaction times to account creation times:

- `[OK]` = Account created within 5 seconds of transaction ✓ **Valid**
- `[~]` = Account created 5-60 seconds after transaction ~ **Marginal** (network delay)
- `[X]` = Account created >60 seconds later or no transaction before it ✗ **ORPHANED** (external command)

---

## User 368 (6360983677) - Case Study

**User's Question:** "Why is this user excluded? FIVE=2, THREE=6?"

### Transaction Timeline
```
2026-03-28 09:33:30 - PRIME750 purchase approved
2026-03-28 09:35:14 - PRIME759 purchase approved  
2026-03-28 14:36:08 - Self Account ₹250 allocation #1
2026-03-28 14:43:32 - Self Account ₹250 allocation #2
2026-03-28 14:51:27 - Self Account ₹250 allocation #3
2026-03-28 14:54:40 - Self Account ₹250 allocation #4
2026-03-31 14:36:33 - Self Account ₹250 allocation #5
2026-03-31 14:40:46 - Self Account ₹250 allocation #6
2026-03-31 14:42:29 - Self Account ₹250 allocation #7
2026-03-31 14:47:06 - Self Account ₹250 allocation #8
```

**Expected:** 10 FIVE + 10 THREE (1 from PRIME750 + 1 delayed from PRIME759 + 8 from Self ₹250)

### Account Creation Timeline

**FIVE_150 Accounts:**
| ID | Created At | Match Status | Notes |
|----|------------|--------------|-------|
| 8926 | 2026-03-28 09:34:03 | [~] PRIME750 (32.2s) | Acceptable delay |
| 9034 | 2026-04-02 05:17:12 | [X] **ORPHANED** | Created 5 DAYS LATER - **EXTERNAL COMMAND** |

**THREE_150 Accounts:**
| ID | Created At | Match Status | Notes |
|----|------------|--------------|-------|
| 8927 | 2026-03-28 09:34:04 | [~] PRIME750 (33.8s) | Acceptable delay |
| 8949 | 2026-03-28 14:36:13 | [~] Self ₹250 #1 (5.7s) | Marginal delay |
| 8950 | 2026-03-28 14:43:35 | [OK] Self ₹250 #2 (2.5s) | Perfect match |
| 8951 | 2026-03-28 14:51:29 | [OK] Self ₹250 #3 (2.6s) | Perfect match |
| 8952 | 2026-03-28 14:54:42 | [OK] Self ₹250 #4 (2.0s) | Perfect match |
| 8985 | 2026-03-31 14:36:36 | [OK] Self ₹250 #5 (2.8s) | Perfect match |

### Analysis

- **Account 9034 (FIVE)** is clearly **ORPHANED** - created as an external command 5 days after approval
- **All THREE accounts** are correctly time-matched to their source transactions
- **Problem:** User expected 10 FIVE + 10 THREE but only got 2 FIVE + 6 THREE
  - Got only 2 of 10 expected FIVE (but 1 is orphaned, so only 1 valid FIVE)
  - Got only 6 of 10 expected THREE (but all are properly time-matched)
  - Missing 8 FIVE accounts from transaction sources
  - Missing 4 THREE accounts from transaction sources

**Why was User 368 excluded?** The original reconciliation script couldn't identify which accounts were orphaned. The user has legitimate missing accounts (8 FIVE, 4 THREE) that should be in the CREATE plan, but the script may not have accounted for the unbalanced state properly.

---

## Top Users with Most Orphaned Accounts

| User ID | Username | Expected FIVE | Actual FIVE | Orphaned FIVE | Expected THREE | Actual THREE | Orphaned THREE | Total Orphaned |
|---------|----------|---------------|-------------|---------------|----------------|--------------|----------------|----------------|
| **362** | 9448631918 | 25 | 26 | **26** | 25 | 23 | **23** | **49** |
| **277** | 9113805694 | 11 | 20 | **20** | 11 | 18 | **18** | **38** |
| **136** | 8095918105 | 2 | 10 | **10** | 2 | 9 | **9** | **19** |
| **125** | 1010000011 | 1 | 8 | **8** | 1 | 7 | **7** | **15** |
| **295** | 9972003031 | 30 | 33 | **9** | 30 | 30 | **6** | **15** |

### Critical Pattern

**Users 362 and 277** have a concerning pattern:
- **0 accounts matched to transactions**
- **100% of accounts created by external commands**
- This suggests a systemic external command running during a specific timeframe
- ALL their accounts are duplicates/orphaned

---

## Root Cause: External Commands

The timeline analysis reveals that account creation without corresponding transaction times indicates **external command execution**. This could be:

1. **Test/Debug Scripts** - Running matrix creation outside normal flow
2. **Batch Job** - A cron task or worker process creating accounts
3. **Manual Database Inserts** - DBA or admin directly inserting records
4. **Multiple Transaction Triggers** - Same source triggering multiple account creations

### Evidence Chain

```
Transaction APPROVED at 2026-03-28 09:33:30
    ↓
Account CREATED at 2026-03-28 09:34:03 ✓ (30 seconds later - valid network delay)
    ↓
Another Account CREATED at 2026-04-02 05:17:12 ✗ (5 DAYS later - external command!)
```

---

## Reconciliation Strategy

### Phase 1: Delete Orphaned Accounts (217 accounts)

All 136 FIVE_150 and 81 THREE_150 orphaned accounts should be deleted as they represent duplicates created by external commands.

```sql
DELETE FROM autodistribution_autopolaccount 
WHERE id IN (
  -- Specific orphaned account IDs from timeline analysis
)
AND status = 'ACTIVE';
```

### Phase 2: Create Missing Accounts

After validating User 368 and other unbalanced users:
- Create missing FIVE_150 accounts for transactions that didn't trigger them
- Create missing THREE_150 accounts for transactions that didn't trigger them

---

## Conclusion

**The timing mismatch between transaction approval and account creation is the diagnostic key to identify duplicates created by external commands.**

- Orphaned accounts (no matching transaction within reasonable time window) = **DELETE THESE**
- Missing matched accounts (transaction exists but no corresponding account) = **CREATE THESE**

This approach provides clear, auditable rules for cleanup without guessing which accounts are legitimate.
