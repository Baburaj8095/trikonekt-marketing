---
name: staging-operations-sync
description: Standard Operating Procedures for working on Trikonekt Staging (EC2 65.0.40.184). Covers double-entry ledger balancing invariants, wallet reconciliation safeguards, bidirectional sync protocols, daemon services management, and verification checklists to guarantee zero code loss.
---

# Trikonekt Staging Operations & Ledger Synchronization Guide

> [!IMPORTANT]
> **Core Operating Directive**:
> Whenever working on the Trikonekt Staging environment (`asiyapp.com` / `trieducation.in` on EC2 `65.0.40.184`), the agent must ALWAYS follow these strict ledger invariants, deployment safety protocols, and synchronization procedures to guarantee zero code loss, zero financial drift, and 100% database integrity.

---

## 1. Staging Server Environment Inventory

| Component | Target / Value | Purpose |
| :--- | :--- | :--- |
| **Server Host** | `ubuntu@65.0.40.184` | AWS EC2 Staging Instance |
| **SSH Key** | `C:\Users\babur\Downloads\TRI_MARKETING.pem` | Staging Access Key |
| **Git Repository** | `Baburaj8095/trikonekt-marketing.git` | Branch: `staging` |
| **Backend Directory** | `/srv/trikonekt/staging/backend` | Staging Django Backend |
| **Python Virtualenv** | `/srv/trikonekt/staging/backend/.venv/bin/python` | Target Python 3.14 Environment |
| **Academy API Dir** | `/srv/trikonekt/tri-academy/backend` | Node.js Backend (`:5005`) |
| **Growth Daemon** | `trikonekt-growth-bridge.service` | Pre-warmed Python Daemon (`:5006`) |
| **Django Web** | `trikonekt-staging-web.service` | Gunicorn / Daphne Django Web Service |
| **Academy Service** | `trikonekt-academy.service` | Node.js API Service |
| **Reverse Proxy** | `nginx.service` | Routes `asiyapp.com` & `trieducation.in` |

---

## 2. Double-Entry Accounting Ledger Invariant (PERMANENTLY LOCKED)

### A. The Strict Balancing Rule ($\text{Debits} \equiv \text{Credits}$)
In `accounts/models.py` (`CustomUser._distribute_wallet_stream`), all commission payouts MUST satisfy strict double-entry balance:
$$\sum \text{LedgerPosting(DEBIT)} \equiv \sum \text{LedgerPosting(CREDIT)}$$

```python
# CORRECT & LOCKED:
postings = [
    LedgerPosting(system_user, WalletTypes.SYSTEM, LedgerDirections.DEBIT, amt),
    LedgerPosting(self.user, WalletTypes.MAIN, LedgerDirections.CREDIT, income),       # 75%
    LedgerPosting(self.user, WalletTypes.SELF_PACKAGE_POCKET, LedgerDirections.CREDIT, self_part), # 25%
]
```
* **Debits**: $₹500.00$
* **Credits**: $₹375.00 + ₹125.00 = ₹500.00$
* **Result**: **Balanced $\rightarrow$ Posts into `LedgerEntry` cleanly.**

> [!CAUTION]
> **NEVER append an un-debited credit to `WITHDRAWAL_WALLET` in the payout posting.**
> Doing so creates an unbalanced entry ($₹500 \text{ Debit} \neq ₹875 \text{ Credit}$), causing `WalletEngine.post_transaction` to fail with `ValueError: Ledger postings must balance.`

### B. Withdrawable Balance Handling for Active Users
* For active users, `withdrawable_balance` is automatically mirrored from `main_balance` inside `reconcile_wallet_accounts`:
  ```python
  true_with = main_acc.current_balance if getattr(user, "account_active", False) else Decimal("0.00")
  with_acc.current_balance = true_with
  ```
* When users execute a payout, funds are moved from `MAIN` to `WITHDRAWAL_WALLET` via `/accounts/wallet/transfer/` with statutory TDS deductions.

---

## 3. Wallet Reconciliation Invariants (`accounts/wallet_engine.py`)

Whenever `WalletEngine.reconcile_wallet_accounts(user)` is executed (e.g. during `GET /api/accounts/wallet/me/history/`), it MUST protect against historical clamping:

1. **Main Wallet Invariant**:
   ```python
   # MUST take max of LedgerEntry and verified WalletTransaction:
   true_main = max(le_main, wt_main)
   ```
   * Ensures that if any historical transaction was recorded in `WalletTransaction`, it is **NEVER dropped or clamped** by older partial `LedgerEntry` records.

2. **Self Account Pocket Invariant**:
   ```python
   # Accurately nets credits against ₹250 Self-Rebirth deductions:
   true_self = max(Decimal("0.00"), cr_s_wt + db_s_wt)
   ```
   * Guarantees that the Self Pocket reflects the true remaining balance after ₹250 Self-Rebirth deductions.

---

## 4. Staging Deployment & Synchronization Protocol

To ensure we **NEVER lose code or overwrite live staging features**:

### Step 1: Pre-Change Verification
* Inspect both local and server files.
* Confirm git branch is `staging` and clean:
  ```powershell
  git status
  ```

### Step 2: Cryptographic Checksum Matching
Before and after editing or deploying backend files:
* Local Hash:
  ```powershell
  Get-FileHash backend/path/to/file.py -Algorithm MD5
  ```
* Server Hash:
  ```powershell
  ssh -i "C:\Users\babur\Downloads\TRI_MARKETING.pem" ubuntu@65.0.40.184 "md5sum /srv/trikonekt/staging/backend/path/to/file.py"
  ```
* Verify that the MD5 checksums are **100% identical**.

### Step 3: Deploy & Service Refresh Protocol
1. Transfer files cleanly via `scp`.
2. Restart staging services on EC2:
   ```powershell
   ssh -i "C:\Users\babur\Downloads\TRI_MARKETING.pem" ubuntu@65.0.40.184 "sudo systemctl restart trikonekt-staging-web.service"
   ```
3. If restarting `trikonekt-growth-bridge.service`, ensure background sockets are closed cleanly (use `sudo pkill -f growth_bridge_daemon.py` if a thread hangs during shutdown, then `sudo systemctl start trikonekt-growth-bridge.service`).

### Step 4: Verification API Call
Always run a test API request to confirm status 200 and balance integrity:
```python
# GET /api/accounts/wallet/me/history/ returns 200 OK
# Verifies top.main_income_balance, top.self_account_balance, and top.lifetime_credits_total
```

### Step 5: Git Commit & Remote Push
Always commit the exact modified files and push to `Baburaj8095/trikonekt-marketing.git` on branch `staging`:
```powershell
git add <files>
git commit -m "..."
git push origin staging
```

---

## 5. Summary of Locked Sensitive Rules
- **Do NOT modify Django backend when working on Java/Spring Boot tasks** (per `AGENTS.md`).
- **Always build and verify staging against live `asiyapp.com`**.
- **Preserve growth bridge performance under 1s** (`fast=True`, persistent daemon port 5006, 3s memoization caches).
- **Never revert code without explicit user permission**.
