---
name: user-growth-reset
description: >-
  Standard operating procedure and automated script to safely and cleanly reset
  or purge users (such as test candidates 9999999999 or 8095918105) across all
  Trikonekt Growth databases, matrix trees, wallets, promo boxes, and ranks.
---

# User Growth Reset Skill

This skill documents all database tables affected by user registration, starter bundle / SPP purchases, matrix placements, rank upgrades, and wallet distributions. It also provides the authoritative reset script to return any user to a pristine unpurchased state or cleanly delete them.

---

## 1. Identified Tables & Dependency Graph

When a user registers and purchases a package (e.g. ₹2,000 Starter Bundle on `trieducation.in` or `asiyapp.com`), records are inserted into the following tables in order:

| Order | Table Name | Django Model | Purpose & Reset Action |
|:---:|:---|:---|:---|
| 1 | `business_autopoolaccount` | `business.AutoPoolAccount` | **Matrix Seats (5-Matrix & 3-Matrix)**<br>Contains tree nodes for `FIVE_150` and `THREE_150`. Delete all rows where `owner_id = user.id`. |
| 1b | `business_usermatrixprogress` | `business.UserMatrixProgress` | **Matrix Progress & Earnings Cache**<br>Tracks per-pool matrix earnings and layer counts. Delete all rows where `user_id = user.id`. |
| 2 | `business_promomonthlybox` | `business.PromoMonthlyBox` | **SPP Monthly Unlocks**<br>Tracks paid monthly boxes (e.g. Month 1). Delete all rows where `user_id = user.id`. |
| 3 | `business_promopurchase` | `business.PromoPurchase` | **Package Purchases**<br>Stores `PRIME750`, `MONTHLY759`, etc. Delete all rows where `user_id = user.id`. |
| 4 | `mlm_ranks_upgradecommission` | `mlm_ranks.UpgradeCommission` | **Rank Upline Commissions**<br>Commissions generated from rank upgrade. Delete rows where `user_id = user.id` or `upgrade__user_id = user.id`. |
| 5 | `mlm_ranks_rankupgrade` | `mlm_ranks.RankUpgrade` | **Academic / MLM Rank Upgrades**<br>Level 1, Stage 2, Stage 3 rank records. Delete all rows where `user_id = user.id`. |
| 5b | `mlm_ranks_rankmatrixnode` | `mlm_ranks.RankMatrixNode` | **Rank Matrix Tree Nodes**<br>BFS tree placement nodes for 5-Matrix education. Delete rows where `root_user_id = user.id`, `placed_user_id = user.id`, or `parent_user_id = user.id`. |
| 5c | `mlm_ranks_rankupgradepayment` | `mlm_ranks.RankUpgradePayment` | **Rank Payment Records**<br>Manual/gateway rank payment slips. Delete rows where `upgrade__user_id = user.id`. |
| 6 | `accounts_wallettransaction` | `accounts.WalletTransaction` | **Wallet Ledgers**<br>Delete user transactions (`user_id = user.id`) and sponsor transactions caused by this user (`meta__from_user_id = user.id`). |
| 7 | `accounts_wallet` | `accounts.Wallet` | **User Balances**<br>Reset all balances (`balance`, `main_balance`, `withdrawable_balance`, `total_earnings`, `total_withdrawn`, `self_account_balance`) to `0.00`. |
| 7b | `accounts_walletaccount` | `accounts.WalletAccount` | **Pocket Sub-Accounts**<br>Main, Self-Package, Withdrawable pockets. Reset balances to `0.00`. |
| 7c | `accounts_ledgerentry` | `accounts.LedgerEntry` | **Double-Entry Ledgers**<br>Delete rows where `user_id = user.id` or `financial_transaction__user_id = user.id`. |
| 7d | `accounts_financialtransaction` | `accounts.FinancialTransaction` | **Financial Audit Records**<br>Delete rows where `user_id = user.id`. |
| 8 | `accounts_rewardpointsaccount` | `accounts.RewardPointsAccount` | **Shopping Reward Points**<br>Reset reward balances to `0.00`. |
| 8b | `accounts_rewardpointstransaction` | `accounts.RewardPointsTransaction` | **Reward Transactions**<br>Delete rows where `user_id = user.id`. |
| 9 | `accounts_consumervoucher` | `accounts.ConsumerVoucher` | **P2P Gift Cards & Vouchers**<br>Delete rows where `assigned_to_id = user.id` or `creator_id = user.id`. |
| 10 | `coupons_couponcode` | `coupons.CouponCode` | **Coupons**<br>Delete or unbind rows where `assigned_to_id = user.id`. |
| 11 | `coupons_audittrail` | `coupons.AuditTrail` | **Distribution Audits**<br>Delete rows where `actor_id = user.id` or `metadata__source_id` matches deleted purchases. |
| 12 | `accounts_customuser` | `accounts.CustomUser` | **Core User Profile**<br>Reset `account_active = False`, `is_active = True`, `current_rank = None`, `password = 123456`, `registered_by = sponsor`. Or delete user completely if deleting. |

---

## 2. Safe Automated Reset Script

The script is available at `.agents/skills/user-growth-reset/scripts/reset_user.py` and deployed on the staging server at `/srv/trikonekt/scripts/reset_user.py`.

### Supported Operations:
1. **Reset to Clean State (`--action reset`)**:
   Clears all purchases, matrix accounts, wallets, ranks, vouchers, and sets account to active with default password `123456`, ready to test purchase again.
2. **Hard Delete (`--action delete`)**:
   Completely removes the user from the database.

### Usage on Staging Server:
```bash
sudo bash -c 'set -a && source /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/scripts/reset_user.py --phone 9999999999 --action reset'
```

For user `8095918105`:
```bash
sudo bash -c 'set -a && source /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/scripts/reset_user.py --phone 8095918105 --action reset'
```

---

## 3. Important Invariants Preserved
1. **Admin Sentinel Accounts (ID 1 & 2)**:
   The reset script will NEVER touch or delete root sentinel accounts `admin` (Pool ID #1 `FIVE_150` and Pool ID #2 `THREE_150`).
2. **Next Tree Placement**:
   When a reset user purchases the Starter Bundle, their matrix positions will automatically attach to their respective sponsor or sentinel in serial order.
