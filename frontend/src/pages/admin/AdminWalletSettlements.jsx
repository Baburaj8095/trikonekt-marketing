import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Box, Button, Chip, LinearProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import API from "../../api/api";

function money(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

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
  const [period, setPeriod] = useState("daily");
  const [tax, setTax] = useState({ summary: {}, results: [] });
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const [taxRes, overviewRes] = await Promise.all([
        API.get("/admin/finance/tax-service-charges/", { params: { period } }),
        API.get("/admin/finance/overview/"),
      ]);
      setTax(taxRes?.data || { summary: {}, results: [] });
      setOverview(overviewRes?.data || null);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load settlement reports.");
    } finally {
      setLoading(false);
    }
  }

  async function exportCsv() {
    const res = await API.get("/admin/finance/tax-service-charges/", {
      params: { period, export: "csv" },
      responseType: "blob",
      timeout: 60000,
    });
    const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = "tax-service-charge-summary.csv";
    a.click();
    window.URL.revokeObjectURL(blobUrl);
  }

  useEffect(() => {
    load();
  }, [period]);

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1280, mx: "auto" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>Settlement Reports</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Settlement, reconciliation, GST/TDS, admin charges, and financial control hub.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TextField select size="small" label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} sx={{ minWidth: 130 }}>
            <MenuItem value="daily">Daily</MenuItem>
            <MenuItem value="monthly">Monthly</MenuItem>
            <MenuItem value="yearly">Yearly</MenuItem>
          </TextField>
          <Button onClick={load} variant="outlined">Refresh</Button>
          <Button onClick={exportCsv} variant="outlined">Export</Button>
          <Button component={Link} to="/admin/wallet-reconcile" variant="contained">Run Reconcile</Button>
        </Stack>
      </Stack>
      {err ? <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert> : null}
      {loading ? <LinearProgress sx={{ mb: 1.5 }} /> : null}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", lg: "repeat(6, 1fr)" }, gap: 1, mb: 2 }}>
        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}><Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Gross Volume</Typography><Typography sx={{ fontWeight: 950 }}>Rs. {money(tax.summary?.gross_amount || overview?.transaction_volume)}</Typography></Paper>
        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}><Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Service Charges</Typography><Typography sx={{ fontWeight: 950 }}>Rs. {money(tax.summary?.service_charge || overview?.company_revenue)}</Typography></Paper>
        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}><Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>GST Collection</Typography><Typography sx={{ fontWeight: 950 }}>Rs. {money(tax.summary?.gst_amount || overview?.tax_collected)}</Typography></Paper>
        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}><Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>TDS Deduction</Typography><Typography sx={{ fontWeight: 950 }}>Rs. {money(tax.summary?.tds_amount || overview?.tds_deducted)}</Typography></Paper>
        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}><Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Platform Revenue</Typography><Typography sx={{ fontWeight: 950 }}>Rs. {money(tax.summary?.platform_revenue)}</Typography></Paper>
        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}><Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Pending Withdrawals</Typography><Typography sx={{ fontWeight: 950 }}>{overview?.pending_withdrawals || 0}</Typography></Paper>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" }, gap: 1.5 }}>
        <ReportCard title="Wallet Reconciliation" body="Compare stored wallet balances against ledger transaction totals." to="/admin/wallet-reconcile" />
        <ReportCard title="Withdrawal Settlement" body="Prepare payout settlement from approved and pending withdrawal requests." to="/admin/withdrawals" />
        <ReportCard title="Add Money Settlement" body="Review manual payment proof approvals and Self Package Pocket credits." to="/admin/wallet-upload-approvals" />
        <ReportCard title="Admin Charges" body="Inspect service charge impact through central ledger transaction metadata." to="/admin/wallet-ledger" />
        <ReportCard title="TDS / GST" body="Track deduction and invoice-related fields through package and ledger workflows." to="/admin/package-management" />
        <ReportCard title="Business Reports" body="Open broader admin business/reporting surfaces." to="/admin/reports" />
      </Box>
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mt: 2 }}>
        <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
          <Typography sx={{ fontWeight: 950 }}>Tax / Service Charge Settlement Summary</Typography>
          <Chip size="small" label={`${period} report`} />
        </Stack>
        <Stack spacing={0.75}>
          {(tax.results || []).slice(0, 20).map((row, index) => (
            <Paper key={`${row.period}-${index}`} variant="outlined" sx={{ p: 1, borderRadius: 1 }}>
              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                <Typography sx={{ fontWeight: 900 }}>{row.period ? new Date(row.period).toLocaleDateString() : "-"}</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`Charges Rs. ${money(row.service_charge)}`} />
                  <Chip size="small" label={`GST Rs. ${money(row.gst_amount)}`} />
                  <Chip size="small" label={`TDS Rs. ${money(row.tds_amount)}`} />
                  <Chip size="small" label={`Net Rs. ${money(row.net_amount)}`} />
                </Stack>
              </Stack>
            </Paper>
          ))}
          {!tax.results?.length ? <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>No tax/service charge ledger rows yet.</Typography> : null}
        </Stack>
      </Paper>
    </Box>
  );
}
