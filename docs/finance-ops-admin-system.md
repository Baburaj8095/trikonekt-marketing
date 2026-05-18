# Finance Operations Admin System

This layer is additive. It does not change existing wallet names, MLM flows, package approvals, reward rules, voucher behavior, or user-facing wallet UI. Existing business writes continue to use the current models and the dual-write finance substrate where present.

## Admin Screen Structure

- Wallet Command Center: operational overview for volume, withdrawals, add money approvals, MLM payout volume, GST/service charges, company revenue, reconciliation mismatches, and risk alerts.
- Central Ledger: transaction explorer over `FinancialTransaction` and `LedgerEntry`, with user, wallet type, category, module, gross/service/GST/TDS/net amounts, before/after balances, actor fields, references, and flow steps.
- Wallet Detail: user drilldown with current pockets, structured wallet accounts, credits/debits, locked/pending balances, income breakdown, linked ledger entries, and audit events.
- Wallet Reconcile: compares legacy wallet balances to legacy transaction totals and structured `WalletAccount.current_balance` to derived `LedgerEntry` totals.
- Settlement Reports: daily/monthly/yearly tax, service-charge, GST, TDS, transfer, withdrawal, voucher, package, and platform revenue summaries.
- Monitoring & Risk: failed transaction counts, duplicate UTRs, duplicate withdrawals, duplicate vouchers, high-frequency movement, and recent audit timeline.
- Voucher Operations: lifecycle, redemption/refund state, expiry processing, duplicate detection through risk monitoring, and linked finance references where available.
- Withdrawal Operations: existing approval lifecycle remains intact; settlement and risk screens now expose pending, payout, duplicate, and failed-transaction visibility.
- MLM / Reward Operations: sponsor, matrix, franchise, and reward distributions are visible through finance categories without altering payout rules.

## Money Flow Strategy

Finance transactions expose a deterministic flow model:

Package Purchase -> Sponsor Commission -> Level Bonus -> Wallet Credit -> Withdrawal -> Settlement

Other modules map similarly: add money approval, voucher create/redeem/refund, withdrawal approval/payout, reward distribution, and admin adjustment. The flow is traced by `transaction_ref`, `flow_id`, `source_module`, `source_id`, `reference_id`, and ledger entries.

## Reconciliation Strategy

- Legacy reconciliation: `Wallet.balance` versus summed `WalletTransaction.amount`.
- Pocket reconciliation: `WalletAccount.current_balance` versus credits minus debits from `LedgerEntry`.
- Mismatch queues are read-only and highlight inconsistencies for operational review.
- The architecture is ready for scheduled reconciliation jobs and persisted summary snapshots, but this implementation avoids changing posting behavior.

## Settlement And Tax Handling

Settlement reports aggregate `gross_amount`, `charges_amount`, `gst_amount`, `tds_amount`, and `net_amount` from `FinancialTransaction`. Categories identify withdrawal, transfer, voucher, package, MLM, reward, refund, and settlement activity. Exports can be layered onto the same endpoints with async job storage.

## Audit And Risk Flow

Audit timeline reads immutable `AuditLog` rows with actor, action, module, reference, IP, device, and timestamp. Risk monitoring currently flags duplicate UTR uploads, repeated withdrawals, duplicate voucher codes, and high-frequency wallet movement. These are detection-only controls and do not block user behavior.

## Scalability Readiness

The finance endpoints use indexed fields already present on `FinancialTransaction`, `LedgerEntry`, `WalletAccount`, `WalletTransaction`, and `WithdrawalRequest`, plus pagination and bounded summaries. Next scaling steps are async CSV/XLSX exports, scheduled summary tables, cached dashboard aggregates, and read-replica routing for large admin reports.

## Remaining Risks

- Some older wallet activity may exist only as legacy `WalletTransaction` rows until every write path dual-writes to `FinancialTransaction`.
- GST/TDS/service-charge reports depend on upstream workflows populating structured finance fields.
- Reconciliation is currently diagnostic; automated repair/reversal should remain a separate controlled workflow.
