import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import API, { adminListWalletUploadRequests } from "../../api/api";

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function countFrom(data) {
  if (typeof data?.count === "number") return data.count;
  if (Array.isArray(data?.results)) return data.results.length;
  if (Array.isArray(data)) return data.length;
  return 0;
}

function sumRows(rows, getter) {
  return (rows || []).reduce((sum, row) => sum + Number(getter(row) || 0), 0);
}

function MetricCard({ label, value, hint, tone = "default" }) {
  const colors = {
    default: ["#f8fafc", "#e2e8f0", "#0f172a"],
    warning: ["#fffbeb", "#fde68a", "#92400e"],
    success: ["#f0fdf4", "#bbf7d0", "#166534"],
    danger: ["#fef2f2", "#fecaca", "#991b1b"],
    info: ["#eff6ff", "#bfdbfe", "#1d4ed8"],
  };
  const [bg, border, color] = colors[tone] || colors.default;
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: bg, borderColor: border }}>
      <Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>{label}</Typography>
      <Typography sx={{ mt: 0.5, fontSize: 24, lineHeight: 1.1, color, fontWeight: 950 }}>
        {value}
      </Typography>
      {hint ? <Typography sx={{ mt: 0.5, fontSize: 12, color: "#64748b" }}>{hint}</Typography> : null}
    </Paper>
  );
}

function WorkflowCard({ title, body, to, badge, tone = "default" }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, height: "100%" }}>
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Typography sx={{ fontWeight: 950, color: "#0f172a" }}>{title}</Typography>
          {badge ? <Chip size="small" label={badge} color={tone === "danger" ? "error" : tone === "warning" ? "warning" : "default"} /> : null}
        </Stack>
        <Typography sx={{ color: "#64748b", fontSize: 13, minHeight: 38 }}>{body}</Typography>
        <Button component={Link} to={to} variant="outlined" size="small" sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 800 }}>
          Open
        </Button>
      </Stack>
    </Paper>
  );
}

export default function AdminWalletCommandCenter() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [walletRows, setWalletRows] = useState([]);
  const [withdrawalRows, setWithdrawalRows] = useState([]);
  const [uploadRows, setUploadRows] = useState([]);
  const [voucherData, setVoucherData] = useState({ results: [], count: 0 });
  const [reconcile, setReconcile] = useState({ results: [], mismatches: 0 });

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const [wallets, withdrawals, uploads, vouchers, rec] = await Promise.allSettled([
        API.get("/admin/wallets/", { params: { page_size: 50 }, dedupe: "cancelPrevious" }),
        API.get("/admin/withdrawals/", { params: { status: "pending", page_size: 50 }, dedupe: "cancelPrevious" }),
        adminListWalletUploadRequests({ status: "PENDING" }),
        API.get("/admin/wallet-vouchers/", { params: { page_size: 50 }, dedupe: "cancelPrevious" }),
        API.get("/admin/wallets/reconcile/", { params: { limit: 100 }, dedupe: "cancelPrevious" }),
      ]);

      if (wallets.status === "fulfilled") setWalletRows(wallets.value?.data?.results || []);
      if (withdrawals.status === "fulfilled") setWithdrawalRows(withdrawals.value?.data?.results || withdrawals.value?.data || []);
      if (uploads.status === "fulfilled") setUploadRows(Array.isArray(uploads.value) ? uploads.value : []);
      if (vouchers.status === "fulfilled") setVoucherData(vouchers.value?.data || { results: [] });
      if (rec.status === "fulfilled") setReconcile(rec.value?.data || { results: [], mismatches: 0 });
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load wallet command center.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const pockets = walletRows.reduce(
      (acc, row) => {
        acc.main += Number(row.main_balance || 0);
        acc.withdrawal += Number(row.withdrawable_balance || 0);
        acc.coupon += Number(row.pockets?.coupon || 0);
        acc.selfPackage += Number(row.pockets?.self_package || 0);
        acc.packageCoupon += Number(row.pockets?.package_purchase_coupon || 0);
        return acc;
      },
      { main: 0, withdrawal: 0, coupon: 0, selfPackage: 0, packageCoupon: 0 }
    );
    return {
      ...pockets,
      pendingWithdrawalAmount: sumRows(withdrawalRows, (row) => row.amount),
      pendingUploadAmount: sumRows(uploadRows, (row) => row.amount),
      activeVouchers: (voucherData?.results || []).filter((row) => row.status === "ACTIVE").length,
      voucherCount: countFrom(voucherData),
    };
  }, [uploadRows, voucherData, walletRows, withdrawalRows]);

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1440, mx: "auto" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>Wallet Command Center</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Central operating view for wallet balances, approvals, vouchers, reconciliation, and transaction risk.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button component={Link} to="/admin/wallet-ledger" variant="contained">Central Ledger</Button>
          <Button component={Link} to="/admin/wallet-monitoring" variant="outlined">Monitoring</Button>
          <Button onClick={load} variant="outlined">Refresh</Button>
        </Stack>
      </Stack>

      {err ? <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert> : null}
      {loading ? <LinearProgress sx={{ mb: 1.5 }} /> : null}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 1.5, mb: 2 }}>
        <MetricCard label="Main Wallet Exposure" value={`Rs. ${money(totals.main)}`} hint={`${walletRows.length} users sampled`} tone="info" />
        <MetricCard label="Pending Withdrawals" value={`Rs. ${money(totals.pendingWithdrawalAmount)}`} hint={`${withdrawalRows.length} requests awaiting action`} tone={withdrawalRows.length ? "warning" : "success"} />
        <MetricCard label="Pending Add Money" value={`Rs. ${money(totals.pendingUploadAmount)}`} hint={`${uploadRows.length} upload approvals`} tone={uploadRows.length ? "warning" : "success"} />
        <MetricCard label="Reconciliation Mismatches" value={Number(reconcile?.mismatches || 0)} hint="Stored balance vs ledger checks" tone={reconcile?.mismatches ? "danger" : "success"} />
        <MetricCard label="Coupon Pocket" value={`Rs. ${money(totals.coupon)}`} hint="Coupon Wallet exposure" />
        <MetricCard label="Self Package Pocket" value={`Rs. ${money(totals.selfPackage)}`} hint="Package purchase wallet exposure" />
        <MetricCard label="Withdrawal Wallet" value={`Rs. ${money(totals.withdrawal)}`} hint="Withdrawable balance exposure" />
        <MetricCard label="Active Vouchers" value={totals.activeVouchers} hint={`${totals.voucherCount} vouchers in current view`} />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" }, gap: 1.5 }}>
        <WorkflowCard title="Wallet Overview" body="Search users, inspect all wallet pockets, and apply audited manual entries." to="/admin/wallets" />
        <WorkflowCard title="Team Wallet Dashboard" body="Monitor team wallet income, pocket exposure, top earners, and rebirth/reward trends." to="/admin/team-wallet-dashboard" />
        <WorkflowCard title="Central Ledger" body="Enterprise transaction table with drill-down workflow across wallet events." to="/admin/wallet-ledger" />
        <WorkflowCard title="Add Money Requests" body="Approve uploaded money for Self Package Pocket after UTR and proof verification." to="/admin/wallet-upload-approvals" badge={uploadRows.length} tone="warning" />
        <WorkflowCard title="Withdrawal Requests" body="Review KYC-backed bank/UPI withdrawals, tax preview, payout reference, and approval outcome." to="/admin/withdrawals" badge={withdrawalRows.length} tone="warning" />
        <WorkflowCard title="Coupon Management" body="Manage active, redeemed, expired, cancelled, and refundable wallet vouchers." to="/admin/wallet-vouchers" badge={totals.activeVouchers} />
        <WorkflowCard title="Package Management" body="Verify Join Subscription, SPP, Prime Education, and Tour purchase approval queues." to="/admin/package-management" />
        <WorkflowCard title="Reward Distribution" body="Monitor commission distribution, matrix earnings, auto commission, and reward processing." to="/admin/reward-distribution" />
        <WorkflowCard title="Settlement & Reconcile" body="Run wallet reconciliation, inspect mismatch queues, and prepare settlement reporting." to="/admin/wallet-settlements" badge={reconcile?.mismatches || ""} tone={reconcile?.mismatches ? "danger" : "default"} />
      </Box>
    </Box>
  );
}
