import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Button,
  Chip,
  TextField,
  Card,
  CardContent,
} from "@mui/material";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import LoopIcon from "@mui/icons-material/Loop";
import GroupIcon from "@mui/icons-material/Group";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import PaymentsIcon from "@mui/icons-material/Payments";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import StarIcon from "@mui/icons-material/Star";
import FilterListIcon from "@mui/icons-material/FilterList";
import API from "../../api/api";

function money(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? `₹${n.toFixed(2)}` : "₹0.00";
}

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Data states
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [addMoneyRequests, setAddMoneyRequests] = useState([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [promoPurchases, setPromoPurchases] = useState([]);
  const [rankUpgrades, setRankUpgrades] = useState([]);

  // Date Filter State: "today" | "2days" | "7days" | "all" | "custom"
  const [filterPreset, setFilterPreset] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const loadData = async () => {
    setLoading(true);
    setErr("");
    try {
      const [
        usersRes,
        ledgerRes,
        metricsRes,
        addMoneyRes,
        withdrawalsRes,
        promoRes,
        rankRes,
      ] = await Promise.allSettled([
        API.get("/api/admin/users/", { params: { page_size: 1000 } }),
        API.get("/admin/wallets/ledger/", { params: { page_size: 500 } }),
        API.get("admin/metrics/"),
        API.get("/admin/wallet-upload-approvals/", { params: { page_size: 500 } }),
        API.get("/admin/withdrawals/", { params: { page_size: 500 } }),
        API.get("/admin/promo-purchases/", { params: { page_size: 500 } }),
        API.get("/admin/rank-upgrades/", { params: { page_size: 500 } }),
      ]);

      const parseArr = (res) => {
        if (res.status !== "fulfilled") return [];
        const d = res.value?.data;
        if (Array.isArray(d)) return d;
        if (Array.isArray(d?.results)) return d.results;
        if (Array.isArray(d?.items)) return d.items;
        return [];
      };

      setUsers(parseArr(usersRes));
      setTransactions(parseArr(ledgerRes));
      setMetrics(metricsRes.status === "fulfilled" ? metricsRes.value?.data || {} : {});
      setAddMoneyRequests(parseArr(addMoneyRes));
      setWithdrawalRequests(parseArr(withdrawalsRes));
      setPromoPurchases(parseArr(promoRes));
      setRankUpgrades(parseArr(rankRes));
    } catch (e) {
      console.error(e);
      setErr("Failed to load operations analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calculate Date Filter Range Boundary
  const dateRange = useMemo(() => {
    const now = new Date();
    let start = null;
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (filterPreset === "today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (filterPreset === "2days") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    } else if (filterPreset === "7days") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    } else if (filterPreset === "custom") {
      start = customFrom ? new Date(`${customFrom}T00:00:00`) : null;
      end = customTo ? new Date(`${customTo}T23:59:59`) : end;
    }
    return { start, end };
  }, [filterPreset, customFrom, customTo]);

  const inDateRange = (dateStr) => {
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    if (!Number.isFinite(t)) return false;
    if (dateRange.start && t < dateRange.start.getTime()) return false;
    if (dateRange.end && t > dateRange.end.getTime()) return false;
    return true;
  };

  // Filtered Datasets
  const filteredAddMoney = useMemo(() => {
    return addMoneyRequests.filter((r) => inDateRange(r.created_at || r.requested_at || r.date));
  }, [addMoneyRequests, inDateRange]);

  const filteredWithdrawals = useMemo(() => {
    return withdrawalRequests.filter((r) => inDateRange(r.requested_at || r.created_at || r.date));
  }, [withdrawalRequests, inDateRange]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => inDateRange(t.created_at || t.date));
  }, [transactions, inDateRange]);

  const filteredPromos = useMemo(() => {
    return promoPurchases.filter((p) => inDateRange(p.created_at || p.approved_at || p.date));
  }, [promoPurchases, inDateRange]);

  const filteredRankUpgrades = useMemo(() => {
    return rankUpgrades.filter((ru) => inDateRange(ru.created_at || ru.upgraded_at || ru.date));
  }, [rankUpgrades, inDateRange]);

  // --- Add Money Aggregations ---
  const addMoneyStats = useMemo(() => {
    let cameCount = filteredAddMoney.length;
    let cameVolume = 0;
    let approvedCount = 0;
    let approvedVolume = 0;
    let pendingCount = 0;
    let rejectedCount = 0;

    filteredAddMoney.forEach((r) => {
      const amt = Number(r.amount || 0);
      cameVolume += amt;
      const st = String(r.status || "").toUpperCase();
      if (st === "APPROVED" || st === "SUCCESS" || st === "COMPLETED") {
        approvedCount += 1;
        approvedVolume += amt;
      } else if (st === "PENDING" || st === "SUBMITTED") {
        pendingCount += 1;
      } else if (st === "REJECTED" || st === "CANCELLED") {
        rejectedCount += 1;
      }
    });

    return { cameCount, cameVolume, approvedCount, approvedVolume, pendingCount, rejectedCount };
  }, [filteredAddMoney]);

  // --- Withdrawal Aggregations ---
  const withdrawalStats = useMemo(() => {
    let cameCount = filteredWithdrawals.length;
    let cameVolume = 0;
    let approvedCount = 0;
    let approvedVolume = 0;
    let pendingCount = 0;
    let rejectedCount = 0;

    filteredWithdrawals.forEach((r) => {
      const amt = Number(r.amount || 0);
      cameVolume += amt;
      const st = String(r.status || "").toUpperCase();
      if (st === "APPROVED" || st === "SUCCESS" || st === "COMPLETED" || st === "PAID") {
        approvedCount += 1;
        approvedVolume += amt;
      } else if (st === "PENDING" || st === "SUBMITTED" || st === "PROCESSING") {
        pendingCount += 1;
      } else if (st === "REJECTED" || st === "CANCELLED" || st === "FAILED") {
        rejectedCount += 1;
      }
    });

    return { cameCount, cameVolume, approvedCount, approvedVolume, pendingCount, rejectedCount };
  }, [filteredWithdrawals]);

  // --- Wallet Transfers Aggregations ---
  const transferStats = useMemo(() => {
    let couponCount = 0;
    let couponVolume = 0;
    let internalCount = 0;
    let internalVolume = 0;

    filteredTransactions.forEach((tx) => {
      const amt = Math.abs(Number(tx.amount || 0));
      const type = String(tx.transaction_type || tx.type || tx.category || "").toUpperCase();

      if (type.includes("COUPON")) {
        couponCount += 1;
        couponVolume += amt;
      } else if (type.includes("INTERNAL") || type.includes("POCKET") || type.includes("TRANSFER")) {
        internalCount += 1;
        internalVolume += amt;
      }
    });

    return { couponCount, couponVolume, internalCount, internalVolume };
  }, [filteredTransactions]);

  // --- Prime Package Purchases Aggregations ---
  const promoStats = useMemo(() => {
    let count750 = 0;
    let vol750 = 0;
    let countSpp = 0;
    let volSpp = 0;
    let countDigital = 0;
    let volDigital = 0;
    let countTour = 0;
    let volTour = 0;

    filteredPromos.forEach((p) => {
      const amt = Number(p.price || p.amount || 0);
      const pkgType = String(p.package_type || p.type || p.name || "").toUpperCase();
      if (pkgType.includes("750") || pkgType.includes("SUBSCRIPTION")) {
        count750 += 1;
        vol750 += amt || 750;
      } else if (pkgType.includes("SPP") || pkgType.includes("SMART")) {
        countSpp += 1;
        volSpp += amt;
      } else if (pkgType.includes("DIGITAL") || pkgType.includes("EDUCATION")) {
        countDigital += 1;
        volDigital += amt;
      } else if (pkgType.includes("TOUR") || pkgType.includes("HOLIDAY")) {
        countTour += 1;
        volTour += amt;
      }
    });

    return { count750, vol750, countSpp, volSpp, countDigital, volDigital, countTour, volTour };
  }, [filteredPromos]);

  // --- Rank Upgrades Aggregations ---
  const rankStats = useMemo(() => {
    let totalCount = filteredRankUpgrades.length;
    let totalVolume = 0;
    filteredRankUpgrades.forEach((ru) => {
      totalVolume += Number(ru.amount || ru.fee || 0);
    });
    return { totalCount, totalVolume };
  }, [filteredRankUpgrades]);

  // --- Geodemographic calculations ---
  const geoStats = useMemo(() => {
    const pincodesMap = {};
    const districtsMap = {};
    const statesMap = {};

    users.forEach((u) => {
      const pin = u.pincode || u.address_pincode || "Unknown Pincode";
      pincodesMap[pin] = (pincodesMap[pin] || 0) + 1;
      const dist = u.city || "Unknown District";
      districtsMap[dist] = (districtsMap[dist] || 0) + 1;
      const state = u.state || "Unknown State";
      statesMap[state] = (statesMap[state] || 0) + 1;
    });

    const topPincodes = Object.entries(pincodesMap)
      .map(([key, val]) => ({ name: key, count: val }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topDistricts = Object.entries(districtsMap)
      .map(([key, val]) => ({ name: key, count: val }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topStates = Object.entries(statesMap)
      .map(([key, val]) => ({ name: key, count: val }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { topPincodes, topDistricts, topStates };
  }, [users]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (err) {
    return (
      <Box sx={{ p: 2, textAlign: "center" }}>
        <Typography color="error" sx={{ fontWeight: 800, mb: 2 }}>{err}</Typography>
        <Button variant="contained" onClick={loadData} startIcon={<LoopIcon />}>Retry</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1 }}>
      {/* Header & Filter Controls */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid #EEF2F6", mb: 2.5, bgcolor: "#fff" }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={2}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900, color: "#0C2D48" }}>
              Admin Operations & Summary Dashboard
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
              Real-time audit of Add Money, Withdrawals, Transfers, Prime Packages, and Rank Upgrades.
            </Typography>
          </Box>
          <Button variant="outlined" onClick={loadData} startIcon={<LoopIcon />}>
            Reload
          </Button>
        </Stack>

        {/* Date Filter Bar */}
        <Box sx={{ mt: 2, pt: 1.5, borderTop: "1px solid #F1F5F9" }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={1}>
            <FilterListIcon color="action" fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 800, color: "#0C2D48", mr: 1 }}>
              Filter Period:
            </Typography>
            <Chip
              label="Today"
              clickable
              color={filterPreset === "today" ? "primary" : "default"}
              onClick={() => setFilterPreset("today")}
              sx={{ fontWeight: 800 }}
            />
            <Chip
              label="Last 2 Days"
              clickable
              color={filterPreset === "2days" ? "primary" : "default"}
              onClick={() => setFilterPreset("2days")}
              sx={{ fontWeight: 800 }}
            />
            <Chip
              label="Last 7 Days"
              clickable
              color={filterPreset === "7days" ? "primary" : "default"}
              onClick={() => setFilterPreset("7days")}
              sx={{ fontWeight: 800 }}
            />
            <Chip
              label="All Time"
              clickable
              color={filterPreset === "all" ? "primary" : "default"}
              onClick={() => setFilterPreset("all")}
              sx={{ fontWeight: 800 }}
            />
            <Chip
              label="Custom Date Range"
              clickable
              color={filterPreset === "custom" ? "primary" : "default"}
              onClick={() => setFilterPreset("custom")}
              sx={{ fontWeight: 800 }}
            />

            {filterPreset === "custom" && (
              <Stack direction="row" spacing={1} sx={{ ml: 1 }}>
                <TextField
                  type="date"
                  size="small"
                  label="From"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  type="date"
                  size="small"
                  label="To"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
            )}
          </Stack>
        </Box>
      </Paper>

      {/* Row 1: Operations KPI Cards (Add Money & Withdrawals) */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: "1.5px solid #3b82f6", borderRadius: 3, bgcolor: "#eff6ff" }}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                <AccountBalanceWalletIcon sx={{ color: "#2563eb", fontSize: 28 }} />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "#1e3a8a" }}>
                    Add Money Requests (Came vs Approved)
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#3b82f6", fontWeight: 700 }}>
                    Inflow requests submitted by members
                  </Typography>
                </Box>
              </Stack>

              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                <Grid item xs={6}>
                  <Box sx={{ p: 1.5, bgcolor: "#fff", borderRadius: 2, border: "1px solid #bfdbfe" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                      Total Requests Came
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 950, color: "#1e40af" }}>
                      {addMoneyStats.cameCount} requests
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: "#2563eb" }}>
                      {money(addMoneyStats.cameVolume)}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={6}>
                  <Box sx={{ p: 1.5, bgcolor: "#fff", borderRadius: 2, border: "1px solid #bbf7d0" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                      Approved & Credited
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 950, color: "#15803d" }}>
                      {addMoneyStats.approvedCount} approved
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: "#16a34a" }}>
                      {money(addMoneyStats.approvedVolume)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              <Stack direction="row" spacing={2} sx={{ mt: 1.5, pt: 1, borderTop: "1px dashed #93c5fd" }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: "#1d4ed8" }}>
                  Pending: <strong>{addMoneyStats.pendingCount}</strong>
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 800, color: "#dc2626" }}>
                  Rejected: <strong>{addMoneyStats.rejectedCount}</strong>
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: "1.5px solid #10b981", borderRadius: 3, bgcolor: "#ecfdf5" }}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                <PaymentsIcon sx={{ color: "#059669", fontSize: 28 }} />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "#064e3b" }}>
                    Withdrawal Requests (Came vs Approved)
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#10b981", fontWeight: 700 }}>
                    Bank withdrawal payout requests submitted
                  </Typography>
                </Box>
              </Stack>

              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                <Grid item xs={6}>
                  <Box sx={{ p: 1.5, bgcolor: "#fff", borderRadius: 2, border: "1px solid #a7f3d0" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                      Total Requests Came
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 950, color: "#065f46" }}>
                      {withdrawalStats.cameCount} requests
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: "#059669" }}>
                      {money(withdrawalStats.cameVolume)}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={6}>
                  <Box sx={{ p: 1.5, bgcolor: "#fff", borderRadius: 2, border: "1px solid #6ee7b7" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                      Approved & Paid
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 950, color: "#047857" }}>
                      {withdrawalStats.approvedCount} approved
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: "#10b981" }}>
                      {money(withdrawalStats.approvedVolume)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              <Stack direction="row" spacing={2} sx={{ mt: 1.5, pt: 1, borderTop: "1px dashed #6ee7b7" }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: "#047857" }}>
                  Pending: <strong>{withdrawalStats.pendingCount}</strong>
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 800, color: "#dc2626" }}>
                  Rejected: <strong>{withdrawalStats.rejectedCount}</strong>
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Row 2: Wallet Transfers, Prime Packages, Rank Upgrades */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid #EEF2F6", height: "100%" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <SwapHorizIcon color="primary" />
              <Typography sx={{ fontWeight: 900, color: "#0C2D48" }}>User Wallet Transfers</Typography>
            </Stack>
            
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box sx={{ p: 1.5, bgcolor: "#fafafa", borderRadius: 2, border: "1px solid #f0f0f0" }}>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                  Coupon Wallet Transfers
                </Typography>
                <Typography sx={{ fontSize: 20, fontWeight: 950, color: "primary.main" }}>
                  {transferStats.couponCount} transfers
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: "text.primary" }}>
                  {money(transferStats.couponVolume)}
                </Typography>
              </Box>

              <Box sx={{ p: 1.5, bgcolor: "#fafafa", borderRadius: 2, border: "1px solid #f0f0f0" }}>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                  Internal Wallet Transfers
                </Typography>
                <Typography sx={{ fontSize: 20, fontWeight: 950, color: "secondary.main" }}>
                  {transferStats.internalCount} transfers
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: "text.primary" }}>
                  {money(transferStats.internalVolume)}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid #EEF2F6", height: "100%" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <CardGiftcardIcon color="secondary" />
              <Typography sx={{ fontWeight: 900, color: "#0C2D48" }}>Prime Package Sales</Typography>
            </Stack>

            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <Box sx={{ p: 1.2, bgcolor: "#fcf5ff", borderRadius: 2, border: "1px solid #f3e8ff" }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                    Join Sub (750)
                  </Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#7c3aed" }}>
                    {promoStats.count750} sold
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: "text.primary", display: "block" }}>
                    {money(promoStats.vol750)}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={6}>
                <Box sx={{ p: 1.2, bgcolor: "#fff7ed", borderRadius: 2, border: "1px solid #ffedd5" }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                    Smart SPP
                  </Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#c2410c" }}>
                    {promoStats.countSpp} sold
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: "text.primary", display: "block" }}>
                    {money(promoStats.volSpp)}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={6}>
                <Box sx={{ p: 1.2, bgcolor: "#f0fdf4", borderRadius: 2, border: "1px solid #dcfce7" }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                    Digital Education
                  </Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#15803d" }}>
                    {promoStats.countDigital} sold
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: "text.primary", display: "block" }}>
                    {money(promoStats.volDigital)}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={6}>
                <Box sx={{ p: 1.2, bgcolor: "#f0f9ff", borderRadius: 2, border: "1px solid #e0f2fe" }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                    Tri Tour Prime
                  </Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#0369a1" }}>
                    {promoStats.countTour} sold
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: "text.primary", display: "block" }}>
                    {money(promoStats.volTour)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid #EEF2F6", height: "100%" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <StarIcon color="warning" />
              <Typography sx={{ fontWeight: 900, color: "#0C2D48" }}>Rank Upgrades</Typography>
            </Stack>

            <Box sx={{ p: 2, bgcolor: "#fffbeb", borderRadius: 2, border: "1px solid #fef3c7", textAlign: "center", mt: 1 }}>
              <Typography variant="caption" sx={{ color: "#b45309", fontWeight: 800 }}>
                Total Rank Upgrades
              </Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 950, color: "#d97706", my: 0.5 }}>
                {rankStats.totalCount}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: "#92400e" }}>
                {money(rankStats.totalVolume)}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Row 3: Geodemographic Leaderboards */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid #EEF2F6" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <LocationOnIcon color="primary" />
              <Typography sx={{ fontWeight: 900, color: "#0C2D48" }}>Top Registered Pincodes</Typography>
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Pincode</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>Members</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {geoStats.topPincodes.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: "primary.main" }}>{row.count}</TableCell>
                    </TableRow>
                  ))}
                  {geoStats.topPincodes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} align="center">No data found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid #EEF2F6" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <LocationOnIcon color="secondary" />
              <Typography sx={{ fontWeight: 900, color: "#0C2D48" }}>Top Districts (Cities)</Typography>
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>District/City</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>Members</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {geoStats.topDistricts.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: "secondary.main" }}>{row.count}</TableCell>
                    </TableRow>
                  ))}
                  {geoStats.topDistricts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} align="center">No data found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid #EEF2F6" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <GroupIcon color="success" />
              <Typography sx={{ fontWeight: 900, color: "#0C2D48" }}>Top States</Typography>
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>State</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>Members</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {geoStats.topStates.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: "success.main" }}>{row.count}</TableCell>
                    </TableRow>
                  ))}
                  {geoStats.topStates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} align="center">No data found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
