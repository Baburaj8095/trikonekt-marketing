import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Stack,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
  Card,
  CardContent,
  Tooltip,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  AccountBalanceWalletRounded as WalletIcon,
  RefreshRounded as RefreshIcon,
  FileDownloadRounded as DownloadIcon,
  SearchRounded as SearchIcon,
  TrendingUpRounded as TrendingUpIcon,
  HourglassTopRounded as HourglassIcon,
  ShieldRounded as ShieldIcon,
  PaidRounded as PaidIcon,
  CategoryRounded as CategoryIcon,
  CheckCircleRounded as CheckIcon,
  AccessTimeRounded as TimeIcon,
  CallSplitRounded as OverflowIcon,
  InfoOutlined as InfoIcon,
} from "@mui/icons-material";
import API from "../../api/api";

function fmtINR(val) {
  const n = Number(val || 0);
  return Number.isFinite(n)
    ? `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "₹0.00";
}

function timeAgo(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function AdminOverheadIncome() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState("24h"); // "24h", "yesterday", "7d", "30d", "all"
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Raw fetched data
  const [adminWallet, setAdminWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [adminCharges, setAdminCharges] = useState(null);

  const fetchOverheadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      // 1. Fetch Company / Overhead Wallet & Ledgers (category="company")
      const [walletRes, ledgerRes, legacyLedgerRes, chargesRes] = await Promise.allSettled([
        API.get("/admin/wallets/company/"),
        API.get("/admin/wallets/company/ledger/", { params: { page_size: 1000 } }),
        API.get("/admin/wallets/company/ledger/", { params: { page_size: 1000, legacy: 1 } }),
        API.get("/business/admin/total-admin-charges/"),
      ]);

      if (walletRes.status === "fulfilled") {
        setAdminWallet(walletRes.value?.data || null);
      }

      const combinedList = [];
      const seenIds = new Set();

      if (legacyLedgerRes.status === "fulfilled") {
        const d = legacyLedgerRes.value?.data;
        const list = Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : [];
        list.forEach((tx) => {
          if (tx && tx.id) {
            seenIds.add(`leg_${tx.id}`);
            combinedList.push({ ...tx, _uid: `leg_${tx.id}` });
          }
        });
      }

      if (ledgerRes.status === "fulfilled") {
        const d = ledgerRes.value?.data;
        const list = Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : [];
        list.forEach((tx) => {
          if (tx && tx.id && !seenIds.has(`fin_${tx.id}`) && tx.source_module !== "SYSTEM") {
            seenIds.add(`fin_${tx.id}`);
            combinedList.push({ ...tx, _uid: `fin_${tx.id}` });
          }
        });
      }

      setTransactions(combinedList);

      if (chargesRes.status === "fulfilled") {
        setAdminCharges(chargesRes.value?.data || null);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to load overhead incomes:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOverheadData();
    const interval = setInterval(() => {
      fetchOverheadData(true);
    }, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, [fetchOverheadData]);

  // Filter items by time range
  const filteredByTime = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

    return transactions.filter((tx) => {
      const txDate = new Date(tx.created_at || tx.timestamp || tx.date);
      if (isNaN(txDate.getTime())) return true;

      if (timeFilter === "24h") {
        return (now - txDate) <= 24 * 60 * 60 * 1000;
      }
      if (timeFilter === "yesterday") {
        return txDate >= startOfYesterday && txDate < startOfToday;
      }
      if (timeFilter === "7d") {
        return (now - txDate) <= 7 * 24 * 60 * 60 * 1000;
      }
      if (timeFilter === "30d") {
        return (now - txDate) <= 30 * 24 * 60 * 60 * 1000;
      }
      return true; // "all"
    });
  }, [transactions, timeFilter]);

  // Categorize Transactions
  const categorizedRows = useMemo(() => {
    return filteredByTime.map((tx) => {
      const remarks = String(tx.remarks || tx.description || "").toLowerCase();
      const st = String(tx.source_type || tx.transaction_type || tx.type || "").toUpperCase();
      const meta = tx.meta || tx.metadata || {};

      let category = "PLATFORM_MARGIN";
      let categoryLabel = "Platform Join Margin";
      let categoryColor = "primary";

      if (
        st === "TAX_POOL_CREDIT" ||
        st.includes("GST") ||
        meta.pool_name === "COMPANY_TAX_POOL" ||
        meta.pool_name === "COMPANY_GST" ||
        remarks.includes("gst")
      ) {
        category = "COMPANY_GST";
        categoryLabel = "🏛️ Company GST / Tax Pool";
        categoryColor = "success";
      } else if (
        remarks.includes("admin_retention") ||
        meta.pool_name === "COMPANY_ADMIN_RETENTION" ||
        st.includes("ADMIN_RETENTION")
      ) {
        category = "ADMIN_RETENTION";
        categoryLabel = "🏢 Company Admin Retention";
        categoryColor = "primary";
      } else if (
        remarks.includes("overflow") ||
        remarks.includes("unclaimed") ||
        st.includes("RANK_OVERFLOW")
      ) {
        category = "RANK_OVERFLOW";
        categoryLabel = "📦 Unclaimed Rank Overflow";
        categoryColor = "warning";
      } else if (
        remarks.includes("p2p") ||
        remarks.includes("7%") ||
        remarks.includes("tax") ||
        st.includes("P2P_TAX") ||
        st.includes("ADMIN_CHARGE")
      ) {
        category = "P2P_ADMIN_FEE";
        categoryLabel = "🏷️ 7% P2P Admin Fee";
        categoryColor = "info";
      } else if (
        remarks.includes("withdrawal") ||
        remarks.includes("10%") ||
        remarks.includes("tds") ||
        st.includes("WITHDRAWAL_TAX")
      ) {
        category = "WITHDRAWAL_TDS";
        categoryLabel = "🛡️ 10% Withdrawal TDS/Fee";
        categoryColor = "error";
      } else if (
        remarks.includes("prime") ||
        st.includes("PRIME_750") ||
        meta.trigger === "PRIME_750" ||
        meta.source === "PRIME_750"
      ) {
        category = "PRIME_750_MARGIN";
        categoryLabel = "💼 Prime ₹750 Platform Margin";
        categoryColor = "success";
      } else if (
        remarks.includes("spp") ||
        remarks.includes("monthly") ||
        st.includes("MONTHLY") ||
        meta.trigger === "MONTHLY_759" ||
        meta.source === "MONTHLY_759"
      ) {
        category = "SPP_MARGIN";
        categoryLabel = "🛒 SPP Package Margin";
        categoryColor = "secondary";
      } else if (
        remarks.includes("autopool") ||
        st.includes("AUTOPOOL") ||
        st.includes("SELF_REBIRTH")
      ) {
        category = "AUTOPOOL_OVERHEAD";
        categoryLabel = "🌐 Autopool Overflow Margin";
        categoryColor = "info";
      }

      // Parse amount from amount, net_amount, or gross_amount
      const rawAmt = tx.amount !== undefined ? tx.amount : (tx.net_amount !== undefined ? tx.net_amount : tx.gross_amount);
      const amount = Math.abs(Number(rawAmt || 0));

      // Extract payer / target user
      let payer = meta.from_user || meta.payer || tx.payer;
      if (!payer || payer === "admin" || payer === "-") {
        if (meta.from_user) {
          payer = meta.from_user;
        } else if (meta.from_user_id === 2 || String(meta.from_user_id) === "2") {
          payer = "9999999999";
        } else if (meta.from_user_id === 3 || String(meta.from_user_id) === "3") {
          payer = "8095918105";
        } else if (meta.from_user_id === 4 || String(meta.from_user_id) === "4") {
          payer = "0000000001";
        } else if (meta.from_user_id) {
          payer = `Member #${meta.from_user_id}`;
        } else if (tx.source_destination) {
          const parts = tx.source_destination.split("|");
          payer = parts.find((p) => p.includes("CREDIT")) || parts[0] || "admin";
          payer = payer.replace("CREDIT:", "").replace("DEBIT:", "").trim();
        } else {
          payer = tx.username && tx.username !== "admin" ? tx.username : "Member";
        }
      }

      // Extract Level / Matrix Layer
      let levelDisplay = "-";
      if (meta.level !== undefined && meta.level !== null) {
        levelDisplay = `Level ${meta.level}`;
      } else if (meta.level_index !== undefined && meta.level_index !== null) {
        levelDisplay = `Level ${meta.level_index}`;
      } else if (meta.kind === "RANK_UPGRADE_DIRECT" || meta.orig_type === "DIRECT_REF_BONUS" || st === "DIRECT_REF_BONUS") {
        levelDisplay = "Direct Sponsor";
      } else if (meta.kind === "RANK_UPGRADE_LEVEL" || meta.orig_type === "LEVEL_BONUS" || st === "LEVEL_BONUS") {
        levelDisplay = `Level ${meta.level || 1}`;
      } else if (remarks.includes("direct")) {
        levelDisplay = "Direct Sponsor";
      } else if (remarks.includes("level")) {
        const match = remarks.match(/level\s*(\d+)/i);
        levelDisplay = match ? `Level ${match[1]}` : "Layer Pool";
      } else if (st.includes("FIVE_MATRIX") || remarks.includes("five")) {
        levelDisplay = meta.level_index ? `5-Block L${meta.level_index}` : "5-Block";
      } else if (st.includes("THREE_MATRIX") || remarks.includes("three")) {
        levelDisplay = meta.level_index ? `3-Block L${meta.level_index}` : "3-Block";
      }

      const generatedRemarks = (
        meta.kind === "RANK_UPGRADE_DIRECT"
          ? `Unclaimed Direct Sponsor Bonus from ${payer}`
          : meta.kind === "RANK_UPGRADE_LEVEL"
          ? `Unclaimed Layer ${meta.level || 1} Rank Match Overflow from ${payer}`
          : st.includes("RANK_UPGRADE")
          ? `Unclaimed Rank Upgrade Washout from ${payer}`
          : st.includes("SELF_REBIRTH")
          ? `Rebirth Platform Overhead from ${payer}`
          : ""
      );

      return {
        ...tx,
        category,
        categoryLabel,
        categoryColor,
        amount,
        payer: String(payer),
        levelDisplay,
        remarks: tx.remarks || tx.description || generatedRemarks || "-",
        createdDate: tx.created_at || tx.timestamp || tx.date,
      };
    });
  }, [filteredByTime]);

  // Final filtered list with category and search
  const displayedRows = useMemo(() => {
    return categorizedRows.filter((r) => {
      if (categoryFilter !== "ALL" && r.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const payer = String(r.payer || "").toLowerCase();
        const remarks = String(r.remarks || r.description || "").toLowerCase();
        const label = String(r.categoryLabel || "").toLowerCase();
        const lvl = String(r.levelDisplay || "").toLowerCase();
        return payer.includes(q) || remarks.includes(q) || label.includes(q) || lvl.includes(q);
      }
      return true;
    });
  }, [categorizedRows, categoryFilter, search]);

  // Metric Aggregations
  const metrics = useMemo(() => {
    let total24h = 0;
    let rankOverflow24h = 0;
    let p2pAdminFee24h = 0;
    let withdrawalTds24h = 0;
    let platformMargins24h = 0;

    categorizedRows.forEach((r) => {
      total24h += r.amount;
      if (r.category === "RANK_OVERFLOW") rankOverflow24h += r.amount;
      else if (r.category === "P2P_ADMIN_FEE") p2pAdminFee24h += r.amount;
      else if (r.category === "WITHDRAWAL_TDS") withdrawalTds24h += r.amount;
      else platformMargins24h += r.amount;
    });

    const pocketsTotal = Object.values(adminWallet?.pockets || {}).reduce(
      (sum, val) => sum + Number(val || 0),
      0
    );
    const cumulativeReserve = pocketsTotal > 0
      ? pocketsTotal
      : Number(
          adminWallet?.total_balance !== undefined
            ? adminWallet.total_balance
            : adminWallet?.balance !== undefined
            ? adminWallet.balance
            : adminWallet?.main_balance !== undefined
            ? adminWallet.main_balance
            : total24h
        );

    return {
      total24h,
      rankOverflow24h,
      p2pAdminFee24h,
      withdrawalTds24h,
      platformMargins24h,
      cumulativeReserve,
      totalCount: categorizedRows.length,
    };
  }, [categorizedRows, adminWallet]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!displayedRows.length) return;
    const headers = ["Transaction ID", "Date Time", "Category", "Blocks / Layer", "Payer Member", "Amount (INR)", "Remarks"];
    const rows = displayedRows.map((r) => [
      r.id || "-",
      new Date(r.createdDate).toLocaleString("en-IN"),
      r.categoryLabel.replace(/[^\x00-\x7F]/g, "").trim(),
      r.levelDisplay || "-",
      r.payer,
      r.amount.toFixed(2),
      `"${(r.remarks || r.description || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `trikonekt_overhead_incomes_${timeFilter}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, bgcolor: "#f8fafc", minHeight: "100vh" }}>
      {/* Header Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 3,
          background: "linear-gradient(135deg, #0C2D48 0%, #145DA0 100%)",
          color: "#ffffff",
          boxShadow: "0 10px 25px rgba(12, 45, 72, 0.15)",
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={2}>
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <PaidIcon sx={{ fontSize: 36, color: "#38bdf8" }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: -0.5 }}>
                  Daily 24h Overhead Incomes & Overflow Center
                </Typography>
                <Typography variant="body2" sx={{ color: "#bae6fd", fontWeight: 600, mt: 0.3 }}>
                  Live tracking of Company Platform Margins, Unclaimed Rank Upgrades (Overflow Box), 7% P2P Transfers & 10% TDS Deductions.
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Tooltip title="Real-time last sync timestamp">
              <Chip
                icon={<TimeIcon sx={{ color: "#ffffff !important" }} />}
                label={`Synced: ${lastUpdated.toLocaleTimeString("en-IN")}`}
                sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "#ffffff", fontWeight: 700 }}
              />
            </Tooltip>
            <Button
              variant="contained"
              onClick={() => fetchOverheadData(true)}
              disabled={refreshing}
              startIcon={refreshing ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
              sx={{
                bgcolor: "#38bdf8",
                color: "#0c2d48",
                fontWeight: 900,
                textTransform: "none",
                "&:hover": { bgcolor: "#7dd3fc" },
              }}
            >
              {refreshing ? "Refreshing..." : "Live Refresh"}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* 24-Hour & Time Filter Bar */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 2.5, border: "1px solid #e2e8f0", bgcolor: "#ffffff" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <HourglassIcon color="primary" />
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#334155" }}>
              Time Horizon:
            </Typography>
            <ToggleButtonGroup
              size="small"
              value={timeFilter}
              exclusive
              onChange={(_, val) => val && setTimeFilter(val)}
              sx={{
                "& .MuiToggleButton-root": {
                  fontWeight: 800,
                  textTransform: "none",
                  px: 2,
                  "&.Mui-selected": { bgcolor: "#0C2D48", color: "#ffffff", "&:hover": { bgcolor: "#145DA0" } },
                },
              }}
            >
              <ToggleButton value="24h">🕒 Last 24 Hours (Today)</ToggleButton>
              <ToggleButton value="yesterday">Yesterday</ToggleButton>
              <ToggleButton value="7d">Last 7 Days</ToggleButton>
              <ToggleButton value="30d">Last 30 Days</ToggleButton>
              <ToggleButton value="all">All Time</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Button
            variant="outlined"
            onClick={handleExportCSV}
            disabled={!displayedRows.length}
            startIcon={<DownloadIcon />}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2 }}
          >
            Export CSV ({displayedRows.length})
          </Button>
        </Stack>
      </Paper>

      {/* Metric Cards Grid */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* Card 1: Total Period Overhead */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: "1.5px solid #c7d2fe",
              bgcolor: "#eef2ff",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: "#4338ca", textTransform: "uppercase" }}>
                {timeFilter === "24h" ? "Today's 24h Overhead" : "Selected Period Total"}
              </Typography>
              <TrendingUpIcon sx={{ color: "#4f46e5" }} />
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 950, color: "#1e1b4b" }}>
              {fmtINR(metrics.total24h)}
            </Typography>
            <Typography variant="caption" sx={{ color: "#6366f1", fontWeight: 700 }}>
              {metrics.totalCount} incoming overhead entries
            </Typography>
          </Card>
        </Grid>

        {/* Card 2: Unclaimed Rank Overflow */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: "1.5px solid #fed7aa",
              bgcolor: "#fff7ed",
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: "#c2410c", textTransform: "uppercase" }}>
                📦 Unclaimed Rank Matches
              </Typography>
              <OverflowIcon sx={{ color: "#ea580c" }} />
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 950, color: "#7c2d12" }}>
              {fmtINR(metrics.rankOverflow24h)}
            </Typography>
            <Typography variant="caption" sx={{ color: "#ea580c", fontWeight: 700 }}>
              Bypassed unqualified uplines
            </Typography>
          </Card>
        </Grid>

        {/* Card 3: Platform Admin Charges (7% & 10%) */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: "1.5px solid #bae6fd",
              bgcolor: "#f0f9ff",
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: "#0369a1", textTransform: "uppercase" }}>
                🏷️ 7% P2P & 10% TDS Deductions
              </Typography>
              <ShieldIcon sx={{ color: "#0284c7" }} />
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 950, color: "#0c4a6e" }}>
              {fmtINR(metrics.p2pAdminFee24h + metrics.withdrawalTds24h)}
            </Typography>
            <Typography variant="caption" sx={{ color: "#0284c7", fontWeight: 700 }}>
              Platform transfer & TDS charges
            </Typography>
          </Card>
        </Grid>

        {/* Card 4: Cumulative Company Reserve */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: "1.5px solid #bbf7d0",
              bgcolor: "#f0fdf4",
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: "#15803d", textTransform: "uppercase" }}>
                💼 Cumulative Company Reserve
              </Typography>
              <WalletIcon sx={{ color: "#16a34a" }} />
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 950, color: "#14532d" }}>
              {fmtINR(metrics.cumulativeReserve)}
            </Typography>
            <Typography variant="caption" sx={{ color: "#16a34a", fontWeight: 700 }}>
              Total Company Wallet (User 1)
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Filters & Search Table Section */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#ffffff" }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2} sx={{ mb: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder="Search by Member / Remarks / Reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: "#94a3b8" }} />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: { xs: "100%", sm: 300 } }}
            />

            <ToggleButtonGroup
              size="small"
              value={categoryFilter}
              exclusive
              onChange={(_, val) => val && setCategoryFilter(val)}
              sx={{
                flexWrap: "wrap",
                "& .MuiToggleButton-root": {
                  fontWeight: 700,
                  fontSize: 12,
                  textTransform: "none",
                  px: 1.5,
                },
              }}
            >
              <ToggleButton value="ALL">All Streams</ToggleButton>
              <ToggleButton value="RANK_OVERFLOW">📦 Rank Overflows</ToggleButton>
              <ToggleButton value="P2P_ADMIN_FEE">🏷️ 7% P2P Admin</ToggleButton>
              <ToggleButton value="WITHDRAWAL_TDS">🛡️ 10% TDS</ToggleButton>
              <ToggleButton value="PRIME_750_MARGIN">💼 Prime Margins</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Typography variant="caption" sx={{ fontWeight: 800, color: "#64748b" }}>
            Showing <b>{displayedRows.length}</b> records
          </Typography>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        {/* Real-time Overhead Ledger Table */}
        {loading ? (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <CircularProgress size={36} />
            <Typography variant="body2" sx={{ color: "#64748b", mt: 2, fontWeight: 700 }}>
              Loading real-time overhead ledger...
            </Typography>
          </Box>
        ) : displayedRows.length === 0 ? (
          <Box sx={{ p: 6, textAlign: "center", bgcolor: "#f8fafc", borderRadius: 2, border: "1px dashed #cbd5e1" }}>
            <InfoIcon sx={{ fontSize: 40, color: "#94a3b8", mb: 1 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "#334155" }}>
              No Overhead Incomes in Selected Period
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b", maxWidth: 450, mx: "auto", mt: 0.5 }}>
              Transactions matching platform margins, unclaimed rank upgrades, or admin charges will stream here in real time.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "#f8fafc" }}>
                  <TableCell sx={{ fontWeight: 900, color: "#475569", py: 1.5 }}>Time / Date</TableCell>
                  <TableCell sx={{ fontWeight: 900, color: "#475569", py: 1.5 }}>Overhead Stream Category</TableCell>
                  <TableCell sx={{ fontWeight: 900, color: "#475569", py: 1.5 }}>Blocks / Layer</TableCell>
                  <TableCell sx={{ fontWeight: 900, color: "#475569", py: 1.5 }}>Triggering Member</TableCell>
                  <TableCell sx={{ fontWeight: 900, color: "#475569", py: 1.5 }}>Description / Event Remarks</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900, color: "#475569", py: 1.5 }}>Amount Credited (₹)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayedRows.map((row, idx) => (
                  <TableRow key={row.id || idx} hover sx={{ "&:last-child td": { border: 0 } }}>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: "#1e293b" }}>
                        {row.createdDate ? new Date(row.createdDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-"}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700 }}>
                        {row.createdDate ? new Date(row.createdDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""} • {timeAgo(row.createdDate)}
                      </Typography>
                    </TableCell>

                    <TableCell sx={{ py: 1.5 }}>
                      <Chip
                        label={row.categoryLabel}
                        size="small"
                        color={row.categoryColor}
                        variant="outlined"
                        sx={{ fontWeight: 800, fontSize: 11 }}
                      />
                    </TableCell>

                    <TableCell sx={{ py: 1.5 }}>
                      <Chip
                        label={row.levelDisplay}
                        size="small"
                        sx={{
                          fontWeight: 800,
                          fontSize: 11,
                          bgcolor: row.levelDisplay.includes("Direct") ? "#fef3c7" : "#f1f5f9",
                          color: row.levelDisplay.includes("Direct") ? "#b45309" : "#334155",
                          border: "1px solid #e2e8f0",
                        }}
                      />
                    </TableCell>

                    <TableCell sx={{ py: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: "#0f172a" }}>
                        {row.payer}
                      </Typography>
                    </TableCell>

                    <TableCell sx={{ py: 1.5, maxWidth: 350 }}>
                      <Typography variant="body2" sx={{ color: "#334155", fontWeight: 600, fontSize: 13 }}>
                        {row.remarks || row.description || "Company Platform Share Credit"}
                      </Typography>
                    </TableCell>

                    <TableCell align="right" sx={{ py: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 950, color: "#059669", fontSize: 14 }}>
                        +{fmtINR(row.amount)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
