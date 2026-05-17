import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Box, Button, Chip, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import API from "../../api/api";

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function Stat({ label, value, hint }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "#fff" }}>
      <Typography sx={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{label}</Typography>
      <Typography sx={{ color: "#0f172a", fontSize: 23, fontWeight: 950, mt: 0.5 }}>{value}</Typography>
      {hint ? <Typography sx={{ color: "#64748b", fontSize: 12, mt: 0.5 }}>{hint}</Typography> : null}
    </Paper>
  );
}

function ExposureBar({ label, value, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((Number(value || 0) / total) * 100)) : 0;
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{label}</Typography>
        <Typography sx={{ fontSize: 13, color: "#64748b" }}>Rs. {money(value)}</Typography>
      </Stack>
      <Box sx={{ mt: 0.5, height: 8, borderRadius: 999, bgcolor: "#e2e8f0", overflow: "hidden" }}>
        <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: "#2563eb" }} />
      </Box>
    </Box>
  );
}

export default function AdminTeamWalletDashboard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [vouchers, setVouchers] = useState([]);

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const [walletRes, voucherRes] = await Promise.all([
        API.get("/admin/wallets/", { params: { page_size: 100 }, dedupe: "cancelPrevious" }),
        API.get("/admin/wallet-vouchers/", { params: { page_size: 100 }, dedupe: "cancelPrevious" }),
      ]);
      setRows(walletRes?.data?.results || []);
      setVouchers(voucherRes?.data?.results || []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load team wallet dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const analytics = useMemo(() => {
    const totals = rows.reduce(
      (acc, row) => {
        const pockets = row.pockets || {};
        acc.main += Number(row.main_balance || 0);
        acc.withdrawal += Number(row.withdrawable_balance || 0);
        acc.coupon += Number(pockets.coupon || 0);
        acc.selfPackage += Number(pockets.self_package || 0);
        acc.shopping += Number(pockets.shopping || 0);
        acc.packageCoupon += Number(pockets.package_purchase_coupon || 0);
        acc.directBenefit += Number(pockets.direct_benefit || 0);
        acc.levelBenefit += Number(pockets.level_benefit || 0);
        acc.adminCharges += Number(pockets.admin_service_charges || 0);
        return acc;
      },
      { main: 0, withdrawal: 0, coupon: 0, selfPackage: 0, shopping: 0, packageCoupon: 0, directBenefit: 0, levelBenefit: 0, adminCharges: 0 }
    );
    const topEarners = [...rows]
      .sort((a, b) => Number(b.main_balance || b.balance || 0) - Number(a.main_balance || a.balance || 0))
      .slice(0, 8);
    const totalExposure = Object.values(totals).reduce((sum, value) => sum + Number(value || 0), 0);
    const activeVouchers = vouchers.filter((item) => item.status === "ACTIVE");
    return { totals, topEarners, totalExposure, activeVouchers };
  }, [rows, vouchers]);

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1440, mx: "auto" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>Team Wallet Dashboard</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Admin visibility for sponsor income, matrix income, shopping rewards, reward income, wallet trends, and rebirth exposure.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button component={Link} to="/admin/wallet-ledger" variant="contained">Open Ledger</Button>
          <Button component={Link} to="/admin/wallets" variant="outlined">Wallet Users</Button>
          <Button onClick={load} variant="outlined">Refresh</Button>
        </Stack>
      </Stack>

      {err ? <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert> : null}
      {loading ? <LinearProgress sx={{ mb: 1.5 }} /> : null}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 1.5, mb: 2 }}>
        <Stat label="Daily Income Analytics" value="Ledger View" hint="Use Central Ledger date filter for today" />
        <Stat label="Monthly Earnings" value={`Rs. ${money(analytics.totals.main)}`} hint="Current wallet exposure sample" />
        <Stat label="Yearly Earnings" value="Reports" hint="Use settlement reports for fiscal view" />
        <Stat label="Sponsor Income" value={`Rs. ${money(analytics.totals.directBenefit)}`} hint="Direct Benefit Wallet exposure" />
        <Stat label="Matrix Income" value={`Rs. ${money(analytics.totals.levelBenefit)}`} hint="Level Benefit Wallet exposure" />
        <Stat label="Shopping Income" value={`Rs. ${money(analytics.totals.shopping)}`} hint="Shopping Self Re-birth exposure" />
        <Stat label="Reward Income" value={`Rs. ${money(analytics.totals.packageCoupon)}`} hint="Package Purchase Coupon wallet" />
        <Stat label="Pending Settlements" value={analytics.activeVouchers.length} hint="Active vouchers awaiting redeem/expiry" />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.1fr 0.9fr" }, gap: 1.5 }}>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 950, mb: 1 }}>Wallet Trends & Exposure</Typography>
          <Stack spacing={1.4}>
            <ExposureBar label="Main Wallet" value={analytics.totals.main} total={analytics.totalExposure} />
            <ExposureBar label="Coupon Wallet" value={analytics.totals.coupon} total={analytics.totalExposure} />
            <ExposureBar label="Self Package Pocket" value={analytics.totals.selfPackage} total={analytics.totalExposure} />
            <ExposureBar label="Withdrawal Wallet" value={analytics.totals.withdrawal} total={analytics.totalExposure} />
            <ExposureBar label="Shopping Rewards" value={analytics.totals.shopping} total={analytics.totalExposure} />
            <ExposureBar label="Package Purchase Wallet" value={analytics.totals.packageCoupon} total={analytics.totalExposure} />
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 950, mb: 1 }}>Top Earning Users</Typography>
          <Stack spacing={1}>
            {analytics.topEarners.map((row, index) => (
              <Stack key={row.user_id} direction="row" justifyContent="space-between" spacing={1} sx={{ pb: 1, borderBottom: "1px solid #f1f5f9" }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 900 }}>{index + 1}. {row.full_name || row.username}</Typography>
                  <Typography sx={{ color: "#64748b", fontSize: 12 }}>{row.username} {row.prefixed_id ? `- ${row.prefixed_id}` : ""}</Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" label={`Rs. ${money(row.main_balance || row.balance)}`} />
                  <Button component={Link} to={`/admin/wallets/${row.user_id}`} size="small" variant="outlined">Detail</Button>
                </Stack>
              </Stack>
            ))}
            {!analytics.topEarners.length ? <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>No users loaded.</Typography> : null}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
