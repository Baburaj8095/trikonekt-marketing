---
name: trikonekt-packages-flow
description: Canonical specifications for Trikonekt package purchasing on trieducation.in (₹2k Starter bundle = 750 Prime + 1k SPP + 250 Rank 1, ₹8k Super Agent tier, ₹40k Promoter tier). All commission values, referral bonuses, block pools, and splits are 100% dynamic via Admin Configuration (CommissionConfig) and NEVER hardcoded.
---

# Trikonekt Dynamic Admin-Configured Package Architecture & Distribution Engine

> [!IMPORTANT]
> **Zero Hardcoded Values Principle**:
> All commission payouts, direct sponsor bonuses, self cashbacks, matrix block distributions, tax percentages, and company margins are **strictly dynamic and database-driven via Admin Configuration (`CommissionConfig`)**.
> The backend engines NEVER hardcode monetary payout constants; they query `CommissionConfig.get_solo()` and the respective package/rank configuration models in real-time.

---

## 1. Executive Academic Programme Tracks (`trieducation.in`)

### Track 1 • Foundation: e-Edu Agent (Starter) — ₹2,000
When a user buys the **₹2,000 Starter Track**, `execute_starter_bundle` in `growth_bridge_exec.py` executes 3 dynamic sub-engines:

1. **₹750 Prime Joining Package (`PRIME750`)**:
   - Anchors the user in **5-Matrix (5-Directs tree)** and **3-Matrix (3-Autopool tree)**.
   - **Payouts Derived Dynamically from Admin Config (`CommissionConfig`)**:
     - *Direct Sponsor Bonus*: Read from admin setting (e.g., currently configured as ₹0.00).
     - *Direct Self Bonus*: Read from admin setting (e.g., currently configured as ₹0.00).
     - *Block Earnings (5-Block + 3-Block)*: Read from admin matrix configuration.
     - *Company Tax / GST Pool*: Calculated dynamically per admin tax rate (e.g. 18%).
     - *Geo / Franchise Pool*: Read from admin geo pool setting.
     - *Retained Company Margin*: Dynamic residual balance.

2. **₹1,000 Smart Product Package (`MONTHLY759` / SPP)**:
   - Anchors the user in **SPP 5-Matrix & 3-Matrix** and queues the 1st physical product box.
   - Automatically issues a **₹1,000 Shopping Rebate Voucher** (`ConsumerVoucher`).
   - **Payouts Derived Dynamically from Admin Config (`CommissionConfig`)**:
     - *Direct Sponsor Bonus*: Read from admin setting (e.g., currently configured as ₹600.00).
     - *Direct Self Cashback*: Read from admin setting (e.g., currently configured as ₹50.00).
     - *Block Earnings (5-Block + 3-Block)*: Read from admin matrix configuration.
     - *Company Tax / GST Pool*: Calculated dynamically per admin tax rate (e.g. 18%).
     - *Geo / Franchise Pool*: Read from admin geo pool setting.
     - *Retained Company Margin*: Dynamic residual balance.

3. **₹250 E-Education / Rank 1 Upgrade**:
   - Unlocks LMS Layer 1 masterclasses and digital certification on `trieducation.in`.
   - Deducts **Statutory GST** (dynamic from admin settings).
   - Distributes the net pool **100% instantly** per admin distribution formula:
     - **50% to Direct Sponsor**
     - **50% to Level 1 Upline**
   - **0 Hold**: All payouts are released immediately upon purchase.

---

### Track 2 • Advanced: Super Agent Leadership — ₹8,000
Unlocks Layers 2 to 7 via `execute_stage_upgrade`:
- **Part Payment 1**: **₹4,750** *(Upgrades Ranks 2 to 5)*
- **Part Payment 2**: **₹3,250** *(Upgrades Ranks 6 & 7)*
- *Total*: ₹4,750 + ₹3,250 = **₹8,000**.
- **Distribution Rule (Admin Driven)**:
  - Deducts GST dynamically.
  - **50% to Direct Sponsor** (Always credited to direct sponsor).
  - **50% to Level Upline** (Credited to the $R$-th ancestor if ancestor rank $\ge R$; otherwise fallback to Company Root user).
  - **100% Instant Release (0 Hold)**.

---

### Track 3 • District Scale: Promoter Agent & DAP — ₹40,000
Unlocks Layers 8 to 10 via `execute_stage_upgrade`:
- **Tranche 1**: **₹5,000** *(Layer 8)*
- **Tranche 2**: **₹10,000** *(Layer 9)*
- **Tranche 3**: **₹25,000** *(Layer 10)*
- *Total*: ₹5,000 + ₹10,000 + ₹25,000 = **₹40,000**.
- **Distribution Rule (Admin Driven)**:
  - Deducts GST dynamically.
  - **50% to Direct Sponsor**.
  - **50% to Level Upline** ($L8 \to Upline_8, L9 \to Upline_9, L10 \to Upline_{10}$ or Company fallback).
  - **100% Instant Release (0 Hold)**.
  - Automatically records **₹50,000 Cumulative Volume** (₹2k + ₹8k + ₹40k), qualifying the user for the **Daily District Royalty Pool**.

---

## 2. Dynamic Commission Payout Split & The ₹250 Self-Rebirth Loop

All incoming user earnings are split dynamically:
- **75% credited to Main Wallet** (Withdrawable / Usable instantly, 0 hold).
- **25% credited to Self Account Pocket** (`self_account_balance`), which powers the automatic Rebirth Loop.

```
                       User Commission Earned
                                 │
           ┌─────────────────────┴─────────────────────┐
           ▼ (75%)                                     ▼ (25%)
     Main Wallet Balance                     Self Account Balance Pocket
  (Withdrawable instantly)                   (Accumulates toward ₹250)
                                                       │
                                            Reaches ₹250.00 Threshold
                                                       │
                                                       ▼
                                             1. Debits ₹250 from Self Pocket
                                                (`SELF_ACCOUNT_DEBIT`)
                                             2. Calls `distribute_self_rebirth_250`
                                                       │
                                   ┌───────────────────┴───────────────────┐
                                   ▼                                       ▼
                       Creates NEW seat in                    Creates NEW seat in
                       5-Matrix Tree                          3-Matrix Tree
                       (`AutoPoolAccount`)                    (`AutoPoolAccount`)
```

- **Trigger**: When `self_account_balance` reaches **₹250.00**, it debits ₹250 and spawns new tree nodes in the 5-Matrix (`FIVE_150`) and 3-Matrix (`THREE_150`).
- **Dynamic Rebirth Pool Breakdown**:
  - Out of each ₹250 Rebirth ID, **₹50.00** feeds the District Royalty Pools (₹20 Tier 1 + ₹30 Tier 2), with remaining portions allocated across 5-Matrix levels, 3-Matrix levels, Direct Sponsor, Geo pools, and Company gross retention per admin config.

---

## 3. Daily 11:59 PM Royalty Distribution Engine

- **Dynamic Pool Aggregation**:
  - Rebirth pool allocations (₹50 per Rebirth ID) + Platform daily turnover percentage.
- **Qualification**:
  - Evaluated dynamically against user's cumulative package volume ($\ge ₹50,000$ Promoter tier).
- **Distribution Mechanism**:
  - Runs automatically every night at **11:59 PM** via cron (`59 23 * * *`) calling `distribute_daily_pools`.
  - Can be manually triggered on-demand from the Admin Panel (`/admin/commissions/distribute` $\to$ "Trigger Midnight 11:59 PM Pools Now").
  - Divides the live accumulated pool balance equally among all qualified promoters with **0 hold**.
