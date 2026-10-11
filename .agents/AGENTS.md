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
  - **Strict Tree Placement Invariants (Permanently Locked)**:
    - **3-Matrix (`THREE_150`) is 100% Pure Global Auto-Pool**: Must ALWAYS use `start_entry_id = None`. NEVER use sponsor anchoring and NEVER use self-clustering (`own_base`) in 3-Matrix. Every single entry (Prime 750, SPP 1000, Rebirth 250) fills the global company pool level-by-level (BFS) from Sentinel root (`admin`).
    - **5-Matrix (`FIVE_150`) is Sponsor-Anchored + Self-Clustered**: 1st entry anchors to sponsor's subtree; 2nd+ entries (SPP, Rebirth) cluster under the user's own base entry (`own_base`).
    - **Zero Self-Commission on Matrix Levels**: Matrix level commissions are strictly paid to upline ancestors (`recipient != consumer`). A user purchasing a package receives only their designated Personal Cashback / Self Bonus, NEVER matrix level commissions on their own purchase.
    - **SPP 2nd Box Gating**: Matrix accounts are opened ONLY on the 1st SPP purchase (`is_first_month=True`). 2nd box onwards creates 0 matrix accounts and 0 matrix commissions; it triggers only the recurring direct sponsor bonus.
