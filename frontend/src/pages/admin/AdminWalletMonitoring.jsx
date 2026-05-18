import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Box, Button, Chip, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import API from "../../api/api";

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
  const [risk, setRisk] = useState([]);
  const [audit, setAudit] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const [riskRes, auditRes, overviewRes] = await Promise.all([
        API.get("/admin/finance/risk-alerts/"),
        API.get("/admin/finance/audit-timeline/", { params: { page_size: 8 } }),
        API.get("/admin/finance/overview/"),
      ]);
      setRisk(riskRes?.data?.results || []);
      setAudit(auditRes?.data?.results || []);
      setOverview(overviewRes?.data || null);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load finance monitoring.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1440, mx: "auto" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>Wallet Monitoring & Risk</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Operational queues for failed transactions, fraud detection, OTP verification logs, settlement reports, GST, and auditability.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button onClick={load} variant="outlined">Refresh</Button>
          <Button component={Link} to="/admin/wallet-command-center" variant="contained">Command Center</Button>
        </Stack>
      </Stack>
      {err ? <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert> : null}
      {loading ? <LinearProgress sx={{ mb: 1.5 }} /> : null}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 1, mb: 2 }}>
        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}><Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Failed Jobs</Typography><Typography sx={{ fontWeight: 950 }}>{overview?.failed_transactions || 0}</Typography></Paper>
        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}><Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Risk Alerts</Typography><Typography sx={{ fontWeight: 950 }}>{overview?.suspicious_activity_alerts || risk.length}</Typography></Paper>
        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}><Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Pending Withdrawals</Typography><Typography sx={{ fontWeight: 950 }}>{overview?.pending_withdrawals || 0}</Typography></Paper>
        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}><Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Active Users</Typography><Typography sx={{ fontWeight: 950 }}>{overview?.active_users || 0}</Typography></Paper>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" }, gap: 1.5 }}>
        <QueueCard title="Failed Transaction Monitoring" status="Workflow" body="Review failed debit/credit pairs, cancelled package payments, rejected withdrawals, and stale pending records." to="/admin/wallet-ledger" />
        <QueueCard title="Fraud Detection Queue" status={risk.length ? `${risk.length} alerts` : "Live"} body="Risk queue for duplicate UTR, high-value transfers, duplicate vouchers, repeated withdrawals, and wallet velocity spikes." to="/admin/wallet-ledger" />
        <QueueCard title="Audit Activity Timeline" status="Live" body="Trace approvals, reversals, refunds, wallet adjustments, admin actions, IP/device, module, and reference IDs." to="/admin/wallet-ledger" />
        <QueueCard title="GST Invoice Management" status="Workflow" body="Track package purchase invoices and future GST ledger links from package approval records." to="/admin/package-management" />
        <QueueCard title="Settlement Reports" status="Workflow" body="Use withdrawals, add money requests, reconciliation, and commission history to prepare daily/monthly settlements." to="/admin/wallet-settlements" />
        <QueueCard title="Audit Logs" status="Workflow" body="Use transaction drill-down metadata and approval screens to trace admin actions, remarks, references, and financial impact." to="/admin/wallet-ledger" />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 1.5, mt: 2 }}>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 950, mb: 1 }}>Risk Alerts</Typography>
          <Stack spacing={1}>
            {risk.slice(0, 8).map((row, index) => (
              <Paper key={`${row.type}-${index}`} variant="outlined" sx={{ p: 1, borderRadius: 1, borderColor: row.severity === "high" ? "#fca5a5" : "#e2e8f0" }}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography sx={{ fontWeight: 900, fontSize: 13 }}>{row.type}</Typography>
                  <Chip size="small" label={row.severity || "medium"} color={row.severity === "high" ? "error" : "warning"} />
                </Stack>
                <Typography sx={{ color: "#64748b", fontSize: 12 }}>{row.message}</Typography>
              </Paper>
            ))}
            {!risk.length ? <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>No risk alerts in the current scan.</Typography> : null}
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 950, mb: 1 }}>Recent Audit Events</Typography>
          <Stack spacing={1}>
            {audit.map((row) => (
              <Paper key={row.id} variant="outlined" sx={{ p: 1, borderRadius: 1 }}>
                <Typography sx={{ fontWeight: 900, fontSize: 13 }}>{row.action}</Typography>
                <Typography sx={{ color: "#64748b", fontSize: 12 }}>{row.actor || "System"} / {row.module || "-"} / {row.reference_id || "-"}</Typography>
                <Typography sx={{ color: "#64748b", fontSize: 12 }}>{row.created_at ? new Date(row.created_at).toLocaleString() : ""}</Typography>
              </Paper>
            ))}
            {!audit.length ? <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>No audit events found.</Typography> : null}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
