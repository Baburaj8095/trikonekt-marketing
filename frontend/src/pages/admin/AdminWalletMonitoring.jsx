import React from "react";
import { Link } from "react-router-dom";
import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";

function QueueCard({ title, status, body, to, action = "Open" }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, height: "100%" }}>
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Typography sx={{ fontWeight: 950, color: "#0f172a" }}>{title}</Typography>
          <Chip size="small" label={status} color={status === "Live" ? "success" : status === "Planned" ? "default" : "warning"} />
        </Stack>
        <Typography sx={{ color: "#64748b", fontSize: 13 }}>{body}</Typography>
        <Button component={Link} to={to} variant="outlined" size="small" sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 800 }}>
          {action}
        </Button>
      </Stack>
    </Paper>
  );
}

export default function AdminWalletMonitoring() {
  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1440, mx: "auto" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>Wallet Monitoring & Risk</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Operational queues for failed transactions, fraud detection, OTP verification logs, settlement reports, GST, and auditability.
          </Typography>
        </Box>
        <Button component={Link} to="/admin/wallet-command-center" variant="contained">Command Center</Button>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" }, gap: 1.5 }}>
        <QueueCard title="Failed Transaction Monitoring" status="Workflow" body="Review failed debit/credit pairs, cancelled package payments, rejected withdrawals, and stale pending records." to="/admin/wallet-ledger" />
        <QueueCard title="Fraud Detection Queue" status="Planned" body="Risk queue for duplicate UTR, high-value transfers, repeated OTP failures, unusual coupon generation, and velocity spikes." to="/admin/wallet-ledger" />
        <QueueCard title="OTP Verification Logs" status="Planned" body="Audit OTP request/verify lifecycle for wallet-to-wallet and main wallet transfer confirmation without exposing OTP values." to="/admin/wallet-ledger" />
        <QueueCard title="GST Invoice Management" status="Workflow" body="Track package purchase invoices and future GST ledger links from package approval records." to="/admin/package-management" />
        <QueueCard title="Settlement Reports" status="Workflow" body="Use withdrawals, add money requests, reconciliation, and commission history to prepare daily/monthly settlements." to="/admin/wallet-settlements" />
        <QueueCard title="Audit Logs" status="Workflow" body="Use transaction drill-down metadata and approval screens to trace admin actions, remarks, references, and financial impact." to="/admin/wallet-ledger" />
      </Box>
    </Box>
  );
}
