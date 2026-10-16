# Trikonekt Workspace Custom Rules

- **Do Not Modify Django Backend**: When working on tasks referencing `tri-consumer` or `tri-business`, do NOT modify, write, delete, or refactor any code inside the Django backend directory (`backend/`). All database table additions, API implementations, and administrative panels must be built strictly inside the Java/Spring Boot backends and React frontends.

- **Java Compilation and Execution**: When compiling or running the Java backends (`tri-consumer` and `tri-business`), always use the repository-specific Java version and Maven tools found in the workspace (specifically, JDK 17 located at `tri-consumer/.jdks/temurin-17` and Maven at `tri-consumer/.maven/apache-maven-3.9.6/bin`). You can invoke the local build/run scripts (`build.ps1`, `run-dev.ps1`) directly, or override the `JAVA_HOME` and `Path` environment variables prior to running `mvn` commands.

- **Always Deploy to asiyapp.com**: For any frontend, marketing, admin panel, or growth updates in this repository, always build, deploy, and push the changes live to `asiyapp.com` (EC2 staging at `/srv/trikonekt/staging/frontend/build` and reload Nginx) from now onwards.

- **Dynamic Admin-Configured Commission Engine (Zero Hardcoding)**:
  - **No Hardcoded Constants**: All commission values, direct referral bonuses (Sponsor & Self), 5/3-Matrix block earnings, GST/Tax rates, Geo/Franchise pools, and gross margins must NEVER be hardcoded. They are **100% dynamic and read directly from Admin Configuration (`CommissionConfig`)** configured live in the Admin Panel (`asiyapp.com/admin/commissions/distribute`).
  - **₹2,000 Prime Digital Education Package**: Composite of 3 dynamic sub-engines:
    1. **₹750 Prime**: Base prime membership & onboarding activation. Places user in **5-Matrix & 3-Matrix**, distributing commissions per live Admin settings (dynamically configured by Admin).
    2. **₹1,000 SPP (Smart Product Package)**: Monthly physical product box subscription + ₹1,000 Shopping Voucher. Distributes SPP commissions per live Admin settings (dynamically configured by Admin).
    3. **₹250 E-Education / Rank 1 Upgrade**: Digital course access, LMS modules, and certification on `trieducation.in`. Deducts **Tax / GST** and distributes the net pool **100% instantly** (50% to Direct Sponsor and 50% to Level 1 Upline). There is **no hold** in the system.
  - **₹8,000 Package**: Intermediate tier with part-payment / installment support (Part 1: ₹4,750 for Ranks 2–5, Part 2: ₹3,250 for Ranks 6–7).
  - **₹40,000 Package**: Master tier package for leadership & franchise activations (Tranche 1: ₹5,000 for Rank 8, Tranche 2: ₹10,000 for Rank 9, Tranche 3: ₹25,000 for Rank 10).
  - **Commission Payout Flow**: All commissions are released **100% instantly** (split 75% to Main Wallet and 25% to Self Account Pocket for the ₹250 Self-Rebirth loop). There is **no hold** period anywhere in the system.
  - **Royalty Engine**: ₹50.00 from every ₹250 Rebirth ID (₹20 Tier 1 + ₹30 Tier 2) + platform daily turnover pool is distributed **daily at 11:59 PM** to qualified ₹50k Promoters.
  - **Payment & Onboarding Flow**: Digital education packages and prime subscriptions are purchased through `trieducation.in` (and supported wallet pockets).
  - **Strict Tree Placement & Initialization Invariants (PERMANENTLY LOCKED - NEVER MODIFY)**:
    - **Empty Tree Initialization & Apex Root**: The matrix trees start completely empty (`AutoPoolAccount.count() == 0`). When the first user `9999999999` purchases the ₹2,000 package, their ₹750 Prime purchase directly creates the **Apex Root entry** (`level=0`, `parent_account=None`, `position=None`, `user_entry_index=1`) for both 5-Matrix (`FIVE_150`) and 3-Matrix (`THREE_150`). `9999999999` is the ONE AND ONLY Root user across the entire platform. Admin has **0 accounts** in `AutoPoolAccount`.
    - **5-Matrix Placement (`FIVE_150`)**:
      - **1st Entry (₹750 Prime)**: Anchors to direct sponsor's primary entry (`_sponsor_start_entry_id_for`). When sponsored by virtual root `9999999999`, fills next available slot under Apex Root.
      - **2nd+ Entries (₹1,000 SPP & ₹250 Rebirth)**: Cluster under the user's own base entry (`own_base`) as sub IDs (Position 1 of user's own subtree).
    - **3-Matrix Placement (`THREE_150`) - Pure Global BFS Auto-Pool**:
      - **Every Entry (Prime, SPP, Rebirth)**: `start_id = None` ALWAYS. Places strictly level-by-level, left-to-right (BFS) across the global tree starting from Apex Root `9999999999`. It fills the next available empty slot wherever available in the global tree, **NEVER inside their parent**.
    - **Zero Self-Commission on Matrix Levels**: Matrix level commissions are strictly paid to upline ancestors (`recipient != consumer`). A user purchasing a package receives only their designated Personal Cashback / Self Bonus, NEVER matrix level commissions on their own purchase.
    - **SPP 2nd Box Gating**: Matrix accounts are opened ONLY on the 1st SPP purchase (`is_first_month=True`). 2nd box onwards creates 0 matrix accounts and 0 matrix commissions; it triggers only the recurring direct sponsor bonus.
    - **Overhead Income & 24h Washout**: All system margin, tax, and unallocated pool fractions route to Company Overhead (`NSB2C0000000000`) and display on `asiyapp.com/admin/overhead-income`. Any overhead records older than 24 hours are automatically washed out / purged.

- **Strict Versioning, Zero Revert & Deployment Safety (PERMANENTLY LOCKED - NEVER VIOLATE)**:
  - **No Code Reversion Without Explicit User Permission**: Never overwrite, discard, revert, or roll back any code, routes, compliance pages, terms, policies, or components without the user's explicit, prior authorization.
  - **Bidirectional Sync Invariant Before Build/Deploy**: Before building or deploying any frontend or backend for `trieducation.in` (`tri-academy`) or `asiyapp.com`:
    1. Inspect both local and server directories.
    2. Synchronize any server-side additions or edits into the local repository before compiling.
    3. Always build directly on the target server or verify that the local build source matches the server source 100%.
    4. Never upload an un-synced or stale `dist/` bundle that could overwrite live features or compliance pages.
  - **Preserve Growth Bridge API Optimizations (Under 1s Performance Invariant)**:
    - **In-Memory Persistent Daemon (`:5006`)**: All DB-heavy growth operations must run through `trikonekt-growth-bridge.service` using pre-warmed Django connections.
    - **Single-Trip Batch Upgrades**: Multi-tranche purchases (Stages 2, 3) must execute in a single roundtrip via `--tranche` lists (`'1,2,3'`), never sequential loops.
    - **Fast Overview (`fast=True`)**: Re-use `bridgeResult.overview` directly in `orderController.js` and skip recursive tree counting on purchase completions.
    - **Daemon Timeout Guard**: The bridge caller in `growthBridgeService.js` must maintain a minimum 45,000ms timeout to avoid premature CLI fallback.
    - **Warm In-Memory Memoization (PERMANENTLY LOCKED)**: `_cached_get_solo()` and `_cached_get_company_user()` in `growth_bridge_exec.py` MUST NEVER be removed or bypassed. They eliminate 180+ repetitive PostgreSQL queries per activation.
    - **Stage 1 (₹2k) Idempotency Guard (PERMANENTLY LOCKED)**: `has_prime and has_spp and has_rank1` check in `execute_starter_bundle` MUST NEVER be removed. It prevents duplicate matrix account creations and returns in <150ms.
    - **Stage 2 (₹8k) & Stage 3 (₹40k) Bulk Prefetch & Idempotency (PERMANENTLY LOCKED)**: Bulk `Rank` / `RankUpgrade` queries and `set(target_levels).issubset(achieved_levels)` in `execute_stage_upgrade` MUST NEVER be converted back to sequential per-level loops.
    - **Daemon Socket Resiliency (PERMANENTLY LOCKED)**: Exception handling for `(BrokenPipeError, ConnectionResetError)` in `growth_bridge_daemon.py` MUST be preserved to prevent thread lockups.

- **MANDATORY USER APPROVAL BEFORE ANY SCRIPT/COMMAND EXECUTION (PERMANENTLY LOCKED — ZERO EXCEPTIONS)**:
  - **NO script, management command, shell command, SSH command, or DB query may be executed on the staging server (`65.0.40.184`) or against the production PostgreSQL database WITHOUT the user's explicit written "yes, run it" approval in the current conversation.**
  - This applies to ALL of the following — no exceptions:
    - Django management commands (`manage.py seed_*`, `manage.py shell`, `manage.py migrate`, `manage.py repair_*`, etc.)
    - Any script under `backend/scripts/`, `backend/scratch/`, `backend/accounts/management/commands/`, `backend/business/management/commands/`
    - Any SSH terminal command that touches the live DB — including read-only `SELECT` queries and `django shell` reads
    - Any `python` / `.venv/bin/python` invocation on the server
    - Any DB cleanup, backfill, repair, or seed operation
  - **Required workflow EVERY TIME — no shortcuts:**
    1. Show the user the **exact command or script** that will run, with full arguments
    2. Explain **what it does** (read-only vs write, which tables, which users affected)
    3. **Wait for explicit written approval** (`"yes"`, `"run it"`, `"go ahead"`, etc.)
    4. Only then execute — never assume approval carries over from a previous message
  - **Identified High-Risk Scripts (NEVER run without approval):**
    - `backend/run_concurrent_load_test.py` — deletes users + creates PromoPurchase records directly via ORM
    - `backend/scripts/run_full_fix.py` — bulk DB fixes via subprocess
    - `backend/scripts/run_prime_tests.py` — creates + approves PromoPurchase directly
    - `backend/scratch/test_all_features_live.py` — writes to live production tables
    - `backend/scratch/test_concurrent_multi_user.py` — concurrent load test writing live DB
    - `backend/accounts/management/commands/seed_karnataka_full.py` — seeds users + purchases (no idempotency on MONTHLY packages)
    - `backend/accounts/management/commands/seed_demo_hierarchy.py` — seeds full hierarchy
    - `backend/accounts/management/commands/seed_loadtest_data.py` — seeds load test data
    - `backend/business/management/commands/seed_root_consumer.py` — sets apex root user
    - `backend/business/management/commands/seed_trikonekt_bulk_consumers.py` — bulk user creation
    - `backend/business/management/commands/repair_matrix_from_sources.py` — matrix repair (modifies AutoPoolAccount)
    - `backend/business/management/commands/rebuild_prime_matrices.py` — full matrix rebuild
    - `backend/jobs/management/commands/process_tasks.py` — job queue processor
    - `backend/business/services/daily_pool_distributor.py` — daily pool auto-distribution (runs at 11:59 PM)
    - `backend/scripts_run/send_ssv_due_reminders.py` — sends live SMS/notifications to users

- **Sensitive Core Files — DO NOT MODIFY OR REVERT WITHOUT EXPLICIT WRITTEN APPROVAL**:
  - `tri-academy/backend/src/scripts/growth_bridge_exec.py` (Core Bridge Executor & Commission Caches)
  - `tri-academy/backend/src/scripts/growth_bridge_daemon.py` (Persistent Python Daemon on port 5006)
  - `tri-academy/backend/src/services/growthBridgeService.js` (Daemon Bridge Client with 45s Timeout)
  - `tri-academy/backend/src/controllers/orderController.js` (Order Settlement & Single-Trip Batched Tranches)
  - `tri-academy/frontend/src/index.css` & `frontend/index.html` (Light Theme `#F8FAFC`, slim scrollbars, `overflow-x: clip;`)
  - `tri-academy/frontend/src/components/TopHeader.jsx` (`sticky top-0 z-40`, compact mobile avatar, no phone number)
  - `tri-academy/frontend/src/pages/policies/*` (Terms, Privacy, Refund, Shipping, Contact Compliance Pages)

