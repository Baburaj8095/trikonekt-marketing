import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Box, Button, Chip, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import API from "../../api/api";

const CATEGORY_META = {
  agency_state_coordinator: { label: "State Coordinator", short: "SC", scopeLabel: "States" },
  agency_state: { label: "State", short: "ST", scopeLabel: "State Codes" },
  agency_district_coordinator: { label: "District Coordinator", short: "DC", scopeLabel: "Districts" },
  agency_district: { label: "District", short: "DT", scopeLabel: "District Codes" },
  agency_pincode_coordinator: { label: "Pincode Coordinator", short: "PC", scopeLabel: "Pincodes" },
  agency_pincode: { label: "Pincode", short: "PN", scopeLabel: "Pincode Codes" },
};

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function compact(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? String(n) : "0";
}

function StatCard({ title, value, note, to, tone = "default" }) {
  const colors = {
    default: ["#ffffff", "#e2e8f0", "#0f172a"],
    blue: ["#eff6ff", "#bfdbfe", "#1d4ed8"],
    green: ["#f0fdf4", "#bbf7d0", "#166534"],
    amber: ["#fffbeb", "#fde68a", "#92400e"],
    red: ["#fef2f2", "#fecaca", "#991b1b"],
  };
  const [bg, border, color] = colors[tone] || colors.default;
  return (
    <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1, bgcolor: bg, borderColor: border, minHeight: 118 }}>
      <Stack spacing={0.7}>
        <Typography sx={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{title}</Typography>
        <Typography sx={{ color, fontSize: 24, lineHeight: 1.1, fontWeight: 950 }}>{value}</Typography>
        <Typography sx={{ color: "#64748b", fontSize: 12 }}>{note}</Typography>
        {to ? (
          <Button component={Link} to={to} size="small" variant="outlined" sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 800 }}>
            Open
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
}

function ToggleCard({ title, paid = "0.00", unpaid = "0.00" }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1, minHeight: 118 }}>
      <Stack spacing={0.65}>
        <Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>{title}</Typography>
        <Typography sx={{ fontSize: 14, color: "#0f172a", fontWeight: 900 }}>Paid Rs. {money(paid)}</Typography>
        <Typography sx={{ fontSize: 14, color: "#0f172a", fontWeight: 900 }}>Not Paid Rs. {money(unpaid)}</Typography>
        <Stack direction="row" spacing={0.5}>
          <Chip size="small" label="On" color="success" />
          <Chip size="small" label="Off" variant="outlined" />
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function AdminFranchiseCategoryDashboard() {
  const { category } = useParams();
  const meta = CATEGORY_META[category] || CATEGORY_META.agency_pincode;
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [counts, setCounts] = useState({ total: 0, active: 0, inactive: 0 });
  const [walletRows, setWalletRows] = useState([]);
  const [sampleUsers, setSampleUsers] = useState([]);

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const [allUsers, activeUsers, inactiveUsers, wallets] = await Promise.all([
        API.get("/admin/users/", { params: { role: "agency", category, page_size: 25 } }),
        API.get("/admin/users/", { params: { role: "agency", category, account_active: "active", page_size: 1 } }),
        API.get("/admin/users/", { params: { role: "agency", category, account_active: "inactive", page_size: 1 } }),
        API.get("/admin/wallets/", { params: { category, page_size: 200 } }),
      ]);
      setCounts({
        total: Number(allUsers?.data?.count || 0),
        active: Number(activeUsers?.data?.count || 0),
        inactive: Number(inactiveUsers?.data?.count || 0),
      });
      setSampleUsers(allUsers?.data?.results || []);
      setWalletRows(wallets?.data?.results || []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load franchise category dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [category]);

  const wallet = useMemo(() => {
    return walletRows.reduce(
      (acc, row) => {
        acc.total += Number(row.balance || 0);
        acc.main += Number(row.main_balance || 0);
        acc.withdrawal += Number(row.withdrawable_balance || 0);
        acc.selfPackage += Number(row.pockets?.self_package || 0);
        acc.coupon += Number(row.pockets?.coupon || 0);
        acc.packageCoupon += Number(row.pockets?.package_purchase_coupon || 0);
        return acc;
      },
      { total: 0, main: 0, withdrawal: 0, selfPackage: 0, coupon: 0, packageCoupon: 0 }
    );
  }, [walletRows]);

  const usersUrl = `/admin/franchise/users?category=${category}`;
  const walletsUrl = `/admin/franchise/wallets?category=${category}`;

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1480, mx: "auto" }}>
      <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>{meta.label} Dashboard</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Category-wise franchise overview based on the selected agency level. Click list or wallet cards to drill into the exact records.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button onClick={load} variant="outlined">Refresh</Button>
          <Button component={Link} to={usersUrl} variant="outlined">List</Button>
          <Button component={Link} to="/admin/franchise/dashboard" variant="contained">Main Dashboard</Button>
        </Stack>
      </Stack>

      {err ? <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert> : null}
      {loading ? <LinearProgress sx={{ mb: 1.5 }} /> : null}

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
          <Chip label={meta.short} />
          <Typography sx={{ fontWeight: 950 }}>Overall View</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 12 }}>{meta.scopeLabel}</Typography>
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(6, 1fr)" }, gap: 1 }}>
          <StatCard title={`${meta.label} Count`} value={compact(counts.total)} note="Total registrations" to={usersUrl} tone="blue" />
          <StatCard title="Active" value={compact(counts.active)} note="Account active records" to={`${usersUrl}&account_active=active`} tone="green" />
          <StatCard title="Inactive" value={compact(counts.inactive)} note="Inactive records" to={`${usersUrl}&account_active=inactive`} tone={counts.inactive ? "amber" : "green"} />
          <StatCard title="Company Marketing" value={`Rs. ${money(wallet.selfPackage)}`} note="Mapped from wallet pockets" to={walletsUrl} />
          <StatCard title="Franchise Self Rebirth" value={`Rs. ${money(wallet.packageCoupon)}`} note="Package coupon exposure" to={walletsUrl} />
          <StatCard title="Main Wallet" value={`Rs. ${money(wallet.main)}`} note="Current main wallet" to={walletsUrl} />
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1, mb: 2 }}>
        <Typography sx={{ fontWeight: 950, mb: 1 }}>Based On Franchise Holding</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(5, 1fr)" }, gap: 1 }}>
          <StatCard title={`${meta.label} Total Earning`} value={`Rs. ${money(wallet.total)}`} note="Total wallet exposure" to={walletsUrl} />
          <StatCard title={`${meta.label} Active Work 25%`} value="Track" note="Ready for payout source mapping" />
          <StatCard title={`${meta.label} Inactive Work 25%`} value="Track" note="Ready for inactive payout mapping" />
          <StatCard title={`${meta.label} Subscription Entry`} value="Track" note="ID count and amount source" />
          <StatCard title={`${meta.label} Smart Product Package`} value="Track" note="Package benefit source" />
          <StatCard title={`${meta.label} Total Withdrawal`} value={`Rs. ${money(wallet.withdrawal)}`} note="Withdrawable exposure" to={walletsUrl} />
          <ToggleCard title={`${meta.label} Monthly Active Work`} paid="0" unpaid="0" />
          <ToggleCard title={`${meta.label} Monthly Inactive Work`} paid="0" unpaid="0" />
          <StatCard title="Self Rebirth ID Benefit" value="Track" note="ID count and amount source" />
          <StatCard title="Shopping Scanner / Online / Trizone / Adds" value="Track" note="Scanner module source pending" />
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
        <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
          <Box>
            <Typography sx={{ fontWeight: 950 }}>Recent {meta.label} Registrations</Typography>
            <Typography sx={{ color: "#64748b", fontSize: 12 }}>Showing latest records for this category.</Typography>
          </Box>
          <Button component={Link} to={usersUrl} size="small" variant="outlined">Open Full List</Button>
        </Stack>
        <Stack spacing={0.8}>
          {sampleUsers.map((user) => (
            <Paper key={user.id} variant="outlined" sx={{ p: 1, borderRadius: 1, bgcolor: "#f8fafc" }}>
              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                <Box>
                  <Typography sx={{ fontWeight: 900, fontSize: 13 }}>{user.full_name || user.username}</Typography>
                  <Typography sx={{ color: "#64748b", fontSize: 12 }}>{user.user_code || user.prefixed_id || user.username} · {user.phone || "-"}</Typography>
                </Box>
                <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{user.assigned_regions_summary || user.state_name || user.pincode || "-"}</Typography>
                  <Typography sx={{ color: "#64748b", fontSize: 12 }}>{user.account_active ? "Active" : "Inactive"}</Typography>
                </Box>
              </Stack>
            </Paper>
          ))}
          {!sampleUsers.length && !loading ? <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>No records found for this category.</Typography> : null}
        </Stack>
      </Paper>
    </Box>
  );
}
