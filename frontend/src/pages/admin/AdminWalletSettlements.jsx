import React from "react";
import { Link } from "react-router-dom";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";

function ReportCard({ title, body, to }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Typography sx={{ fontWeight: 950 }}>{title}</Typography>
      <Typography sx={{ color: "#64748b", fontSize: 13, mt: 0.75 }}>{body}</Typography>
      <Button component={Link} to={to} variant="outlined" size="small" sx={{ mt: 1, textTransform: "none", fontWeight: 800 }}>
        Open
      </Button>
    </Paper>
  );
}

export default function AdminWalletSettlements() {
  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1280, mx: "auto" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>Settlement Reports</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Settlement, reconciliation, GST/TDS, admin charges, and financial control hub.
          </Typography>
        </Box>
        <Button component={Link} to="/admin/wallet-reconcile" variant="contained">Run Reconcile</Button>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" }, gap: 1.5 }}>
        <ReportCard title="Wallet Reconciliation" body="Compare stored wallet balances against ledger transaction totals." to="/admin/wallet-reconcile" />
        <ReportCard title="Withdrawal Settlement" body="Prepare payout settlement from approved and pending withdrawal requests." to="/admin/withdrawals" />
        <ReportCard title="Add Money Settlement" body="Review manual payment proof approvals and Self Package Pocket credits." to="/admin/wallet-upload-approvals" />
        <ReportCard title="Admin Charges" body="Inspect service charge impact through central ledger transaction metadata." to="/admin/wallet-ledger" />
        <ReportCard title="TDS / GST" body="Track deduction and invoice-related fields through package and ledger workflows." to="/admin/package-management" />
        <ReportCard title="Business Reports" body="Open broader admin business/reporting surfaces." to="/admin/reports" />
      </Box>
    </Box>
  );
}
