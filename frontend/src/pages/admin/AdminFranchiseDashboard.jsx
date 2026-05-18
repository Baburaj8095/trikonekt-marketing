import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Box, Button, Chip, LinearProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import API from "../../api/api";

const FRANCHISE_CATEGORIES = [
  { key: "agency_state_coordinator", label: "State Coordinator", short: "SC" },
  { key: "agency_state", label: "State", short: "ST" },
  { key: "agency_district_coordinator", label: "District Coordinator", short: "DC" },
  { key: "agency_district", label: "District", short: "DT" },
  { key: "agency_pincode_coordinator", label: "Pincode Coordinator", short: "PC" },
  { key: "agency_pincode", label: "Pincode", short: "PN" },
];

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function MetricCard({ title, value, hint, to, tone = "default" }) {
  const colors = {
    default: ["#ffffff", "#e2e8f0", "#0f172a"],
    blue: ["#eff6ff", "#bfdbfe", "#1d4ed8"],
    green: ["#f0fdf4", "#bbf7d0", "#166534"],
    amber: ["#fffbeb", "#fde68a", "#92400e"],
    red: ["#fef2f2", "#fecaca", "#991b1b"],
  };
  const [bg, border, color] = colors[tone] || colors.default;
  return (
    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1, bgcolor: bg, borderColor: border, minHeight: 112 }}>
      <Stack spacing={0.75}>
        <Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>{title}</Typography>
        <Typography sx={{ fontSize: 23, lineHeight: 1.1, color, fontWeight: 950 }}>{value}</Typography>
        <Typography sx={{ fontSize: 12, color: "#64748b" }}>{hint}</Typography>
        {to ? (
          <Button component={Link} to={to} size="small" variant="outlined" sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 800 }}>
            Open
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
}

function WorkflowRow({ title, body, to, status = "Ready" }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.15, borderRadius: 1 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
        <Box>
          <Typography sx={{ fontWeight: 950, color: "#0f172a", fontSize: 14 }}>{title}</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 12 }}>{body}</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip size="small" label={status} color={status === "Needs route" ? "warning" : "success"} />
          <Button component={Link} to={to} size="small" variant="outlined" sx={{ textTransform: "none", fontWeight: 800 }}>
            Open
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function AdminFranchiseDashboard() {
  const [scope, setScope] = useState("agency_pincode");
  const [counts, setCounts] = useState({});
  const [wallets, setWallets] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const countCalls = FRANCHISE_CATEGORIES.map((cat) =>
        API.get("/admin/users/", { params: { category: cat.key, page_size: 1, fast: 0 } })
          .then((res) => [cat.key, Number(res?.data?.count || 0)])
          .catch(() => [cat.key, 0])
      );
      const [countPairs, walletRes, withdrawalRes] = await Promise.all([
        Promise.all(countCalls),
        API.get("/admin/wallets/", { params: { category: scope, page_size: 25 } }),
        API.get("/admin/withdrawals/", { params: { status: "pending", page_size: 50 } }),
      ]);
      setCounts(Object.fromEntries(countPairs));
      setWallets(walletRes?.data?.results || []);
      setWithdrawals(withdrawalRes?.data?.results || withdrawalRes?.data || []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load franchise dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [scope]);

  const walletSummary = useMemo(() => {
    return wallets.reduce(
      (acc, row) => {
        acc.total += Number(row.balance || 0);
        acc.main += Number(row.main_balance || 0);
        acc.withdrawal += Number(row.withdrawable_balance || 0);
        acc.selfPackage += Number(row.pockets?.self_package || 0);
        return acc;
      },
      { total: 0, main: 0, withdrawal: 0, selfPackage: 0 }
    );
  }, [wallets]);

  const pendingWithdrawalAmount = useMemo(() => withdrawals.reduce((sum, row) => sum + Number(row.amount || 0), 0), [withdrawals]);
  const totalFranchiseUsers = useMemo(() => FRANCHISE_CATEGORIES.reduce((sum, cat) => sum + Number(counts[cat.key] || 0), 0), [counts]);

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1440, mx: "auto" }}>
      <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>Franchise Overall View Dashboard</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Separate operating view for State Coordinator, State, District Coordinator, District, Pincode Coordinator, and Pincode flows.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TextField select size="small" label="Wallet scope" value={scope} onChange={(e) => setScope(e.target.value)} sx={{ minWidth: 210 }}>
            {FRANCHISE_CATEGORIES.map((cat) => (
              <MenuItem key={cat.key} value={cat.key}>{cat.label}</MenuItem>
            ))}
          </TextField>
          <Button onClick={load} variant="outlined">Refresh</Button>
          <Button component={Link} to="/admin/dashboard" variant="contained">Team Consumer Admin</Button>
        </Stack>
      </Stack>

      {err ? <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert> : null}
      {loading ? <LinearProgress sx={{ mb: 1.5 }} /> : null}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 1.2, mb: 2 }}>
        <MetricCard title="Total Franchise Users" value={totalFranchiseUsers} hint="All franchise categories combined" to="/admin/franchise/users" tone="blue" />
        <MetricCard title="Sample Wallet Exposure" value={`Rs. ${money(walletSummary.total)}`} hint={`Current scope: ${scope}`} to={`/admin/franchise/wallets?category=${scope}`} tone="green" />
        <MetricCard title="Pending Withdrawals" value={`Rs. ${money(pendingWithdrawalAmount)}`} hint={`${withdrawals.length} pending requests`} to="/admin/franchise/withdrawals" tone={withdrawals.length ? "amber" : "green"} />
        <MetricCard title="Monthly Active Work" value="On / Off" hint="Operational switch placeholder from your sketch" to="/admin/franchise/monthly-entry-report" tone="default" />
      </Box>

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1, mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
          <Box>
            <Typography sx={{ fontWeight: 950 }}>Hierarchy Counts</Typography>
            <Typography sx={{ color: "#64748b", fontSize: 12 }}>Use this as the top-level sort box: State opens State list, District opens District list, Pincode opens Pincode list.</Typography>
          </Box>
          <Chip label="Franchise hierarchy" />
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 1 }}>
          {FRANCHISE_CATEGORIES.map((cat) => (
            <MetricCard
              key={cat.key}
              title={cat.label}
              value={counts[cat.key] || 0}
              hint={`${cat.short} records`}
              to={`/admin/franchise/users?category=${cat.key}`}
            />
          ))}
        </Box>
      </Paper>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.2fr 0.8fr" }, gap: 1.5 }}>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
          <Typography sx={{ fontWeight: 950, mb: 1 }}>Based On Franchise Holding</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" }, gap: 1 }}>
            <MetricCard title="Franchise Total Earning" value={`Rs. ${money(walletSummary.total)}`} hint="Sampled from selected scope wallets" />
            <MetricCard title="Main Wallet" value={`Rs. ${money(walletSummary.main)}`} hint="Current wallet balance" />
            <MetricCard title="Active Work 25%" value="Track" hint="Active work payout control" />
            <MetricCard title="Inactive Work 25%" value="Track" hint="Inactive work payout control" />
            <MetricCard title="Self Rebirth IDs" value="Track" hint="ID count and amount source" />
            <MetricCard title="Company Marketing Pocket" value={`Rs. ${money(walletSummary.selfPackage)}`} hint="Mapped to selected wallet scope" />
            <MetricCard title="Total Withdrawal" value={`Rs. ${money(walletSummary.withdrawal)}`} hint="Withdrawable exposure" />
            <MetricCard title="Subscription Entry" value="Track" hint="ID count and amount source" />
            <MetricCard title="Smart Product Package" value="Track" hint="Package benefit ID count" />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
          <Typography sx={{ fontWeight: 950, mb: 1 }}>Operational Workflow</Typography>
          <Stack spacing={1}>
            <WorkflowRow title="Franchise Users" body="State, district, pincode and coordinator filtered user lists." to="/admin/franchise/users" />
            <WorkflowRow title="Franchise Wallets" body="Wallet exposure for franchise hierarchy users." to="/admin/franchise/wallets" />
            <WorkflowRow title="Achievers Screen" body="Existing franchise achiever management." to="/admin/franchise/achievers" />
            <WorkflowRow title="Wishing Banner" body="Existing franchise wishing banner management." to="/admin/franchise/wishing-banners" />
            <WorkflowRow title="Agreement / ID Card" body="Form flow placeholder for agreement upload and ID card generation." to="/admin/franchise/agreement" status="Needs route" />
            <WorkflowRow title="Customer Care Chat" body="WhatsApp/customer-care module placeholder." to="/admin/franchise/customer-care" status="Needs route" />
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
