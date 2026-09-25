import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import PaymentsIcon from "@mui/icons-material/Payments";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import LoyaltyIcon from "@mui/icons-material/Loyalty";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import SecurityIcon from "@mui/icons-material/Security";
import PieChartIcon from "@mui/icons-material/PieChart";
import HubIcon from "@mui/icons-material/Hub";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SearchIcon from "@mui/icons-material/Search";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import API from "../../api/api";

function money(v) {
  const n = Number(v || 0);
  return Number.isFinite(n)
    ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";
}

export default function AdminDailySalesReport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [activeTab, setActiveTab] = useState(0);

  // Tab 9: SPP Cadence Report State
  const [cadenceData, setCadenceData] = useState(null);
  const [cadenceLoading, setCadenceLoading] = useState(false);
  const [cadenceSeason, setCadenceSeason] = useState(1);
  const [cadenceSearch, setCadenceSearch] = useState("");
  const [cadenceStatusFilter, setCadenceStatusFilter] = useState("ALL");

  // Initialize with the current month's range
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const formatDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };

    setFrom(formatDate(firstDay));
    setTo(formatDate(today));
  }, []);

  async function loadReport() {
    if (!from || !to) return;
    try {
      setLoading(true);
      setErr("");
      const res = await API.get("/admin/analytics/sales/", {
        params: { from, to },
      });
      setData(res?.data || null);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load sales and financial report.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // Load report when dates are initialized
  useEffect(() => {
    if (from && to) {
      loadReport();
    }
  }, [from, to]);

  async function loadCadenceReport() {
    try {
      setCadenceLoading(true);
      const res = await API.get("/business/admin/spp/cadence-report/", {
        params: { season: cadenceSeason },
      });
      setCadenceData(res?.data || null);
    } catch (e) {
      console.error("Failed to load SPP cadence report:", e);
    } finally {
      setCadenceLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 8) {
      loadCadenceReport();
    }
  }, [activeTab, cadenceSeason]);

  function handleExportCadenceCSV() {
    if (!cadenceData?.results || cadenceData.results.length === 0) return;

    const headers = [
      "User ID",
      "Username",
      "Full Name",
      "Phone",
      "Season",
      "Boxes Completed",
      "Total Invested (₹)",
      "Last Purchase Date",
      "Next Scheduled Date",
      "Days Remaining / Overdue",
      "Cadence Status",
      "Status Message",
    ];

    const rows = cadenceData.results.map((r) => [
      r.user_id,
      r.username,
      `"${(r.full_name || "").replace(/"/g, '""')}"`,
      r.phone || "",
      r.season_number,
      `${r.boxes_completed}/12`,
      r.total_invested || 0,
      r.last_purchase_date || "",
      r.next_purchase_date || "",
      r.days_remaining != null ? r.days_remaining : "",
      r.cadence_status,
      `"${(r.status_message || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SPP_Monthly_Cadence_Season_${cadenceSeason}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Export comprehensive data to CSV
  // Export comprehensive data to CSV
  function handleExportCSV() {
    if (!data?.results || data.results.length === 0) return;

    const headers = [
      "Date",
      "Total Inflow (₹)",
      "Add Money Count",
      "Add Money Amount (₹)",
      "Agent Fee 1k Count",
      "Agent Fee 1k Amount (₹)",
      "SPP Boxes Count",
      "SPP Boxes Amount (₹)",
      "Rank Upgrades Count",
      "Rank Upgrades Amount (₹)",
      "Royalty Paid Count",
      "Royalty Paid Amount (₹)",
      "Self Rebirth Count",
      "Self Rebirth Amount (₹)",
      "Coupon Load Count",
      "Coupon Load Amount (₹)",
      "Internal Transfer Count",
      "Internal Transfer Amount (₹)",
      "Withdrawal Approved Count",
      "Withdrawal Approved Amount (₹)",
      "Withdrawal Pending Count",
      "Withdrawal Pending Amount (₹)",
      "Withdrawal Rejected Count",
      "Withdrawal Rejected Amount (₹)",
      "Output GST (18%) (₹)",
      "TDS Withheld (₹)",
      "Net Tax Remittance (₹)",
    ];

    const rows = data.results.map((r) => [
      r.date,
      r.total_inflow_amount || "0.00",
      r.add_money_count || 0,
      r.add_money_amount || "0.00",
      r.agent_fee_count || 0,
      r.agent_fee_amount || "0.00",
      r.spp_count || 0,
      r.spp_amount || "0.00",
      r.upgrades_count || 0,
      r.upgrades_amount || "0.00",
      r.royalty_count || 0,
      r.royalty_amount || "0.00",
      r.self_rebirth_count || 0,
      r.self_rebirth_amount || "0.00",
      r.coupon_load_count || 0,
      r.coupon_load_amount || "0.00",
      r.transfer_count || 0,
      r.transfer_amount || "0.00",
      r.wdr_approved_count || 0,
      r.wdr_approved_amount || "0.00",
      r.wdr_pending_count || 0,
      r.wdr_pending_amount || "0.00",
      r.wdr_rejected_count || 0,
      r.wdr_rejected_amount || "0.00",
      r.tax_output_gst || "0.00",
      r.tax_total_tds || "0.00",
      r.tax_net_remittance || "0.00",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `daily_business_report_${from}_to_${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Export Tax Compliance CSV for CA (GSTR-1 & Form 26Q)
  function handleExportTaxCompliance() {
    if (!data?.results || data.results.length === 0) return;
    const headers = [
      "Period Date",
      "Commercial Inflow (INR)",
      "Taxable Value (INR)",
      "Output GST Rate (%)",
      "Output GST Collected (INR)",
      "Gross Outflow Disbursed (INR)",
      "TDS on Payouts Sec 194H (5%)",
      "TDS on Auto-Blocks / Rebirth (INR)",
      "Total TDS Withheld (INR)",
      "Net Remittance Obligation (GST - TDS)",
    ];
    const rows = data.results.map((r) => {
      const commercial = Number(r.agent_fee_amount || 0) + Number(r.spp_amount || 0) + Number(r.upgrades_amount || 0);
      const taxable = (commercial / 1.18).toFixed(2);
      const gst = r.tax_output_gst || "0.00";
      const wdr = Number(r.wdr_approved_amount || 0);
      const tdsWdr = r.tax_tds_wdr || "0.00";
      const tdsRebirth = r.tax_tds_rebirth || "0.00";
      const totalTds = r.tax_total_tds || "0.00";
      const netRemit = r.tax_net_remittance || "0.00";
      return [
        r.date,
        commercial.toFixed(2),
        taxable,
        "18%",
        gst,
        wdr.toFixed(2),
        tdsWdr,
        tdsRebirth,
        totalTds,
        netRemit,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `trikonekt_tax_compliance_gstr1_tds_${from}_to_${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const summary = data?.summary || {};
  const bi = data?.bi_metrics || {};

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      {/* Header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        sx={{ mb: 2.5 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a" }}>
            Business Intelligence & Operations Command Center
          </Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13, mt: 0.3 }}>
            Real-time control over revenue inflow, system float liability, pool reserves, conversion funnels, and fraud sentinel.
          </Typography>
        </Box>
        {data?.results && data.results.length > 0 && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportCSV}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
          >
            Export to CSV
          </Button>
        )}
      </Stack>

      {err && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {err}
        </Alert>
      )}
      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      {/* Date Filter Card */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2.5, backgroundColor: "#ffffff" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <TextField
            type="date"
            label="From Date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            fullWidth
          />
          <TextField
            type="date"
            label="To Date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            fullWidth
          />
          <Button
            variant="contained"
            onClick={loadReport}
            disabled={loading}
            sx={{ minWidth: 120, height: 40, fontWeight: 700, borderRadius: 2, textTransform: "none" }}
          >
            Fetch Report
          </Button>
        </Stack>
      </Paper>

      {data && (
        <Box>
          {/* Executive KPI Summary Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {/* 1. Consolidated Inflow */}
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2.5, borderLeft: "4px solid #2563eb", height: "100%" }}>
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                      Total Inflow (Range)
                    </Typography>
                    <MonetizationOnIcon sx={{ color: "#2563eb", fontSize: 20 }} />
                  </Stack>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: "#1e3a8a", mt: 0.5 }}>
                    ₹{money(summary.total_inflow)}
                  </Typography>
                  <Typography sx={{ color: "#64748b", fontSize: 11, mt: 0.5 }}>
                    Deposits + Agent + SPP + Upgrades
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* 2. Add Money Requests */}
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2.5, borderLeft: "4px solid #059669", height: "100%" }}>
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                      Add Money (Deposits)
                    </Typography>
                    <PaymentsIcon sx={{ color: "#059669", fontSize: 20 }} />
                  </Stack>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: "#065f46", mt: 0.5 }}>
                    ₹{money(summary.add_money_amount)}
                  </Typography>
                  <Typography sx={{ color: "#64748b", fontSize: 11, mt: 0.5 }}>
                    {summary.add_money_count || 0} approved wallet uploads
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* 3. Coupon Pocket & P2P Circulation */}
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2.5, borderLeft: "4px solid #6366f1", height: "100%" }}>
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                      Coupon Pocket & P2P
                    </Typography>
                    <SwapHorizIcon sx={{ color: "#6366f1", fontSize: 20 }} />
                  </Stack>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: "#3730a3", mt: 0.5 }}>
                    ₹{money(summary.transfer_amount)}
                  </Typography>
                  <Typography sx={{ color: "#64748b", fontSize: 11, mt: 0.5 }}>
                    {summary.transfer_count || 0} transfers | ₹{money(summary.coupon_load_amount)} coupon loaded
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* 4. Self Rebirth */}
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2.5, borderLeft: "4px solid #ea580c", height: "100%" }}>
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                      Self Rebirth (Blocks)
                    </Typography>
                    <LoyaltyIcon sx={{ color: "#ea580c", fontSize: 20 }} />
                  </Stack>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: "#9a3412", mt: 0.5 }}>
                    ₹{money(summary.self_rebirth_amount)}
                  </Typography>
                  <Typography sx={{ color: "#64748b", fontSize: 11, mt: 0.5 }}>
                    {summary.self_rebirth_count || 0} auto-blocks / rebirth allocations
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* 5. Net Company Float */}
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2.5, borderLeft: "4px solid #0d9488", height: "100%" }}>
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                      Net Bank Cash Float
                    </Typography>
                    <AccountBalanceWalletIcon sx={{ color: "#0d9488", fontSize: 20 }} />
                  </Stack>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f766e", mt: 0.5 }}>
                    ₹{money(bi?.solvency?.net_company_float)}
                  </Typography>
                  <Typography sx={{ color: "#64748b", fontSize: 11, mt: 0.5 }}>
                    Deposits (₹{money(bi?.solvency?.total_deposits_all_time)}) - Withdrawn
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* 6. Total System Liability */}
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2.5, borderLeft: "4px solid #dc2626", height: "100%" }}>
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                      System User Liability
                    </Typography>
                    <PieChartIcon sx={{ color: "#dc2626", fontSize: 20 }} />
                  </Stack>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: "#991b1b", mt: 0.5 }}>
                    ₹{money(bi?.solvency?.total_liability)}
                  </Typography>
                  <Typography sx={{ color: "#64748b", fontSize: 11, mt: 0.5 }}>
                    Across all user wallet accounts
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* 7. Solvency Coverage */}
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2.5, borderLeft: "4px solid #7c3aed", height: "100%" }}>
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                      Solvency Coverage
                    </Typography>
                    <SecurityIcon sx={{ color: "#7c3aed", fontSize: 20 }} />
                  </Stack>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: "#6d28d9", mt: 0.5 }}>
                    {bi?.solvency?.solvency_ratio || 0}x
                  </Typography>
                  <Typography sx={{ color: "#64748b", fontSize: 11, mt: 0.5 }}>
                    Bank Float / User Liabilities
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* 8. Tax & TDS Compliance */}
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 2.5, borderLeft: "4px solid #0891b2", height: "100%" }}>
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                      Tax & TDS Withheld
                    </Typography>
                    <TrendingUpIcon sx={{ color: "#0891b2", fontSize: 20 }} />
                  </Stack>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: "#0e7490", mt: 0.5 }}>
                    ₹{money(summary.tax_total_tds)}
                  </Typography>
                  <Typography sx={{ color: "#64748b", fontSize: 11, mt: 0.5 }}>
                    GST: ₹{money(summary.tax_output_gst)} | TDS: ₹{money(summary.tax_total_tds)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Navigation Tabs */}
          <Paper variant="outlined" sx={{ mb: 2.5, borderRadius: 2 }}>
            <Tabs
              value={activeTab}
              onChange={(e, v) => setActiveTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: "divider", px: 1.5 }}
            >
              <Tab label="1. Daily Sales Matrix" sx={{ fontWeight: 700, textTransform: "none" }} />
              <Tab label="2. Solvency & Wallet Liabilities" sx={{ fontWeight: 700, textTransform: "none" }} />
              <Tab label="3. Growth Funnel & Conversions" sx={{ fontWeight: 700, textTransform: "none" }} />
              <Tab label="4. Daily 11:59 PM & Monthly Pools" sx={{ fontWeight: 700, textTransform: "none" }} />
              <Tab label="5. Internal P2P & Circulation" sx={{ fontWeight: 700, textTransform: "none" }} />
              <Tab label="6. Risk & Fraud Sentinel" sx={{ fontWeight: 700, textTransform: "none" }} />
              <Tab label="7. Tax & Profit Intelligence (GST/TDS)" sx={{ fontWeight: 700, textTransform: "none" }} />
              <Tab label="8. Geographic Leaderboard" sx={{ fontWeight: 700, textTransform: "none" }} />
              <Tab label="9. SPP Retention & Cadence Matrix" sx={{ fontWeight: 700, textTransform: "none" }} />
            </Tabs>
          </Paper>

          {/* TAB 0: Daily Financial Breakdown */}
          {activeTab === 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2.5, overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 1350 }}>
                <TableHead sx={{ backgroundColor: "#f8fafc" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: "#1e3a8a" }}>
                      Total Inflow
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      Add Money
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      Agent Fee (₹1k)
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      SPP Boxes (₹1k)
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      Rank Upgrades
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      Royalty Paid
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      Self Rebirth
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      Coupon Loaded
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      P2P Transfers
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      Withdrawals (Appr / Pend)
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      Daily Tax & TDS
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.results && data.results.length > 0 ? (
                    data.results.map((row) => (
                      <TableRow key={row.date} hover>
                        <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{row.date}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: "#1e3a8a" }}>
                          ₹{money(row.total_inflow_amount)}
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#065f46" }}>
                            ₹{money(row.add_money_amount)}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                            {row.add_money_count} req
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#0369a1" }}>
                            ₹{money(row.agent_fee_amount)}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                            {row.agent_fee_count} users
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>
                            ₹{money(row.spp_amount)}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                            {row.spp_count} boxes
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#b45309" }}>
                            ₹{money(row.upgrades_amount)}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                            {row.upgrades_count} upgs
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#7e22ce" }}>
                            ₹{money(row.royalty_amount)}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                            {row.royalty_count} dist
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#ea580c" }}>
                            ₹{money(row.self_rebirth_amount)}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                            {row.self_rebirth_count} blocks
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#4338ca" }}>
                            ₹{money(row.coupon_load_amount)}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                            {row.coupon_load_count} loads
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#3730a3" }}>
                            ₹{money(row.transfer_amount)}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                            {row.transfer_count} txns
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                            <Chip
                              size="small"
                              label={`✓ ₹${money(row.wdr_approved_amount)} (${row.wdr_approved_count})`}
                              sx={{ backgroundColor: "#dcfce7", color: "#166534", fontSize: 11, fontWeight: 700 }}
                            />
                            {Number(row.wdr_pending_count) > 0 && (
                              <Chip
                                size="small"
                                label={`⏳ ₹${money(row.wdr_pending_amount)} (${row.wdr_pending_count})`}
                                sx={{ backgroundColor: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 700 }}
                              />
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>
                            GST: ₹{money(row.tax_output_gst)}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: "#0369a1", fontWeight: 600 }}>
                            TDS: ₹{money(row.tax_total_tds)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 4, color: "#64748b" }}>
                        No financial records found in selected range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* TAB 1: Solvency & Wallet Liabilities */}
          {activeTab === 1 && (
            <Box>
              <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                  System Solvency & Wallet Liabilities (P&L Float Engine)
                </Typography>
                <Typography sx={{ color: "#64748b", fontSize: 13, mb: 2 }}>
                  Comparison of real external capital in bank vs outstanding virtual wallet claims across all users.
                </Typography>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={4}>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, backgroundColor: "#f8fafc" }}>
                      <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                        Total Capital Deposited
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f766e", mt: 0.5 }}>
                        ₹{money(bi?.solvency?.total_deposits_all_time)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#64748b", mt: 0.5 }}>
                        Lifetime approved Add Money
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, backgroundColor: "#f8fafc" }}>
                      <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                        Total Capital Withdrawn
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: "#e11d48", mt: 0.5 }}>
                        ₹{money(bi?.solvency?.total_withdrawals_all_time)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#64748b", mt: 0.5 }}>
                        Lifetime bank payouts
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, backgroundColor: "#f8fafc" }}>
                      <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                        Net Liquidity Float
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: "#2563eb", mt: 0.5 }}>
                        ₹{money(bi?.solvency?.net_company_float)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#64748b", mt: 0.5 }}>
                        Net positive cash in ecosystem
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5 }}>
                  Outstanding User Liability by Pocket Type
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead sx={{ backgroundColor: "#f8fafc" }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800 }}>Wallet / Pocket Name</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>System Identifier</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>Active User Accounts</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>Total Balance (₹)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bi?.solvency?.wallet_pockets?.map((wp) => (
                        <TableRow key={wp.type} hover>
                          <TableCell sx={{ fontWeight: 700 }}>{wp.label}</TableCell>
                          <TableCell>
                            <Chip size="small" label={wp.type} sx={{ fontSize: 11 }} />
                          </TableCell>
                          <TableCell align="right">{wp.count}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: "#1e3a8a" }}>
                            ₹{money(wp.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          )}

          {/* TAB 2: Conversion Funnel */}
          {activeTab === 2 && (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                Ecosystem Conversion & Leadership Funnel
              </Typography>
              <Typography sx={{ color: "#64748b", fontSize: 13, mb: 3 }}>
                Conversion efficiency as registered consumers progress into paying agents, SPP buyers, and higher rank achievers.
              </Typography>

              <Grid container spacing={2} alignItems="center" sx={{ mb: 4 }}>
                {/* Stage 1: Registered */}
                <Grid item xs={12} md={3}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5, textAlign: "center", borderTop: "4px solid #64748b" }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Stage 1: Registered
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 900, mt: 1, color: "#0f172a" }}>
                      {bi?.conversion_funnel?.total_registered || 0}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "#64748b", mt: 0.5 }}>
                      Total Platform Consumers
                    </Typography>
                  </Paper>
                </Grid>

                {/* Stage 2: ₹1k Agent */}
                <Grid item xs={12} md={3}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5, textAlign: "center", borderTop: "4px solid #0284c7" }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#0284c7", textTransform: "uppercase" }}>
                      Stage 2: Agent (₹1,000)
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 900, mt: 1, color: "#0284c7" }}>
                      {bi?.conversion_funnel?.total_agents || 0}
                    </Typography>
                    <Chip
                      size="small"
                      color="info"
                      label={`${bi?.conversion_funnel?.conv_reg_to_agent || 0}% Conversion`}
                      sx={{ mt: 1, fontWeight: 700, fontSize: 11 }}
                    />
                  </Paper>
                </Grid>

                {/* Stage 3: SPP Monthly */}
                <Grid item xs={12} md={3}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5, textAlign: "center", borderTop: "4px solid #16a34a" }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#16a34a", textTransform: "uppercase" }}>
                      Stage 3: SPP Monthly Boxes
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 900, mt: 1, color: "#16a34a" }}>
                      {bi?.conversion_funnel?.total_spp_users || 0}
                    </Typography>
                    <Chip
                      size="small"
                      color="success"
                      label={`${bi?.conversion_funnel?.conv_agent_to_spp || 0}% of Agents`}
                      sx={{ mt: 1, fontWeight: 700, fontSize: 11 }}
                    />
                  </Paper>
                </Grid>

                {/* Stage 4: Rank Upgrades */}
                <Grid item xs={12} md={3}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5, textAlign: "center", borderTop: "4px solid #d97706" }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#d97706", textTransform: "uppercase" }}>
                      Stage 4: Upgraded (L2–L10)
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 900, mt: 1, color: "#d97706" }}>
                      {bi?.conversion_funnel?.total_upgrades_users || 0}
                    </Typography>
                    <Chip
                      size="small"
                      color="warning"
                      label={`${bi?.conversion_funnel?.conv_agent_to_upg || 0}% of Agents`}
                      sx={{ mt: 1, fontWeight: 700, fontSize: 11 }}
                    />
                  </Paper>
                </Grid>
              </Grid>

              <Box sx={{ p: 2, borderRadius: 2, backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#1e3a8a", mb: 0.5 }}>
                  Funnel Health Diagnosis
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#475569" }}>
                  {Number(bi?.conversion_funnel?.conv_reg_to_agent || 0) >= 50
                    ? "✓ High initial conversion: More than 50% of registered users upgrade to the Agent package."
                    : "⚠️ Free user drop-off: Less than 50% of registered consumers activate the Agent package. Consider introducing registration starter incentives."}
                </Typography>
              </Box>
            </Paper>
          )}

          {/* TAB 3: Daily Midnight 11:59 PM & Monthly Pool Reserves */}
          {activeTab === 3 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {/* Daily Midnight 11:59 PM Monitor Section */}
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5, borderLeft: "6px solid #2563eb" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1.5, mb: 2 }}>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        Daily Midnight 11:59 PM Pool Accumulator & Payout Monitor
                      </Typography>
                      {bi?.pools_projection?.is_today_distributed ? (
                        <Chip label="✓ Today's Payout Completed" color="success" size="small" sx={{ fontWeight: 700 }} />
                      ) : (
                        <Chip label="⏱ Accumulating (Triggers at 11:59 PM)" color="primary" size="small" sx={{ fontWeight: 700 }} />
                      )}
                    </Stack>
                    <Typography sx={{ color: "#64748b", fontSize: 13, mt: 0.5 }}>
                      Accumulates the day's turnover and SPP purchases from 00:00 to 23:59. Auto-distributes at 11:59 PM daily via server cron.
                    </Typography>
                  </Box>
                  <Chip
                    icon={<AccessTimeRoundedIcon />}
                    label="Schedule: 23:59 Daily (Cron)"
                    variant="outlined"
                    sx={{ fontWeight: 700, borderColor: "#cbd5e1", bgcolor: "#f8fafc" }}
                  />
                </Box>

                <Grid container spacing={2} sx={{ mb: 2.5 }}>
                  {/* Daily Franchise Pool 5% */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: "#eff6ff", borderColor: "#bfdbfe" }}>
                      <CardContent sx={{ p: 2 }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#1e40af", textTransform: "uppercase" }}>
                          Today Franchise Pool (5%)
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: "#1e3a8a", mt: 0.5 }}>
                          ₹{money(bi?.pools_projection?.daily_franchise_pool)}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: "#3b82f6", mt: 0.5, fontWeight: 600 }}>
                          Sub-Franchise Achievers: <b>{bi?.pools_projection?.franchise_achievers_cnt || 0}</b>
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Daily District Pool 3% */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: "#f0fdfa", borderColor: "#99f6e4" }}>
                      <CardContent sx={{ p: 2 }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#0f766e", textTransform: "uppercase" }}>
                          Today District Pool (3%)
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: "#0d9488", mt: 0.5 }}>
                          ₹{money(bi?.pools_projection?.daily_district_pool)}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: "#0f766e", mt: 0.5, fontWeight: 600 }}>
                          District Coordinators: <b>{bi?.pools_projection?.district_coord_cnt || 0}</b>
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Daily State Pool 2% */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: "#fffbeb", borderColor: "#fde68a" }}>
                      <CardContent sx={{ p: 2 }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#b45309", textTransform: "uppercase" }}>
                          Today State Pool (2%)
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: "#d97706", mt: 0.5 }}>
                          ₹{money(bi?.pools_projection?.daily_state_pool)}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: "#b45309", mt: 0.5, fontWeight: 600 }}>
                          State Coordinators: <b>{bi?.pools_projection?.state_coord_cnt || 0}</b>
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Daily Royalty Pool 2% */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: "#faf5ff", borderColor: "#e9d5ff" }}>
                      <CardContent sx={{ p: 2 }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#7e22ce", textTransform: "uppercase" }}>
                          Today Global Royalty (2%)
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: "#9333ea", mt: 0.5 }}>
                          ₹{money(bi?.pools_projection?.daily_royalty_pool)}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: "#7e22ce", mt: 0.5, fontWeight: 600 }}>
                          Rank 7–10 Achievers: <b>{bi?.pools_projection?.royalty_achievers_cnt || 0}</b>
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <Typography sx={{ fontSize: 12, color: "#475569" }}>
                    <b>Today's Bases:</b> Daily SPP Volume: <b>₹{money(bi?.pools_projection?.today_spp_volume)}</b> | Daily Inflow/Turnover: <b>₹{money(bi?.pools_projection?.today_inflow)}</b>. If a tier has 0 active coordinators, its pot is safely retained in the Company Master Account (9999999999).
                  </Typography>
                </Box>
              </Paper>

              {/* Monthly Cumulative Reserves Section */}
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                  Month-to-Date Accumulated Pool Reserves
                </Typography>
                <Typography sx={{ color: "#64748b", fontSize: 13, mb: 2.5 }}>
                  Cumulative pool allocations derived across the entire calendar month to date.
                </Typography>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  {/* Monthly Franchise Pool 5% */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ borderRadius: 2, borderTop: "4px solid #2563eb" }}>
                      <CardContent sx={{ p: 2 }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>
                          Month Franchise Pool (5%)
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: "#1e3a8a", mt: 0.5 }}>
                          ₹{money(bi?.pools_projection?.franchise_pool_est)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Monthly District Pool 3% */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ borderRadius: 2, borderTop: "4px solid #0d9488" }}>
                      <CardContent sx={{ p: 2 }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>
                          Month District Pool (3%)
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f766e", mt: 0.5 }}>
                          ₹{money(bi?.pools_projection?.district_pool_est)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Monthly State Pool 2% */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ borderRadius: 2, borderTop: "4px solid #d97706" }}>
                      <CardContent sx={{ p: 2 }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>
                          Month State Pool (2%)
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: "#b45309", mt: 0.5 }}>
                          ₹{money(bi?.pools_projection?.state_pool_est)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Monthly Royalty Pool 2% */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ borderRadius: 2, borderTop: "4px solid #9333ea" }}>
                      <CardContent sx={{ p: 2 }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>
                          Month Royalty Pool (2%)
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: "#7e22ce", mt: 0.5 }}>
                          ₹{money(bi?.pools_projection?.royalty_pool_est)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <Typography sx={{ fontSize: 12, color: "#64748b" }}>
                    Current Month SPP Base Volume: <b>₹{money(bi?.pools_projection?.month_spp_volume)}</b>.
                  </Typography>
                </Box>
              </Paper>
            </Box>
          )}

          {/* TAB 4: Internal P2P & Circulation */}
          {activeTab === 4 && (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Internal Circulation Velocity & P2P Audit
                  </Typography>
                  <Typography sx={{ color: "#64748b", fontSize: 13 }}>
                    Tracks whether money remains active within the ecosystem or drains into bank accounts.
                  </Typography>
                </Box>
                <Chip
                  label={`Circulation Ratio: ${bi?.circulation?.circulation_ratio || 0}x`}
                  color={Number(bi?.circulation?.circulation_ratio || 0) >= 1 ? "success" : "default"}
                  sx={{ fontWeight: 800 }}
                />
              </Stack>

              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: "#f8fafc" }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>Date & Time</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Sender (From)</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Recipient (To)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>
                        Amount Transferred
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.recent_transfers && data.recent_transfers.length > 0 ? (
                      data.recent_transfers.map((tx) => (
                        <TableRow key={tx.id} hover>
                          <TableCell sx={{ fontWeight: 600, color: "#475569" }}>{tx.date}</TableCell>
                          <TableCell>
                            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                              {tx.sender_username}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                              {tx.sender_name} (ID: #{tx.sender_id})
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                              {tx.receiver_username}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                              {tx.receiver_name} {tx.receiver_id !== "-" ? `(ID: #${tx.receiver_id})` : ""}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: "#2563eb" }}>
                            ₹{money(tx.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3, color: "#64748b" }}>
                          No wallet-to-wallet transfer records found in selected range.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* TAB 5: Risk & Fraud Sentinel */}
          {activeTab === 5 && (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                Risk Management & Anomaly Sentinel
              </Typography>
              <Typography sx={{ color: "#64748b", fontSize: 13, mb: 3 }}>
                Automated detection of multi-account bank sharing and withdrawal bottlenecks.
              </Typography>

              {/* Duplicate Bank Accounts Alert */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
                  <WarningAmberIcon sx={{ color: "#d97706" }} /> Shared / Duplicate Bank Accounts
                </Typography>
                {bi?.risk_sentinel?.duplicate_banks && bi.risk_sentinel.duplicate_banks.length > 0 ? (
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead sx={{ backgroundColor: "#fef3c7" }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800 }}>Bank Account Number</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Distinct Users Count</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Associated Usernames</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800 }}>Risk Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {bi.risk_sentinel.duplicate_banks.map((db, idx) => (
                          <TableRow key={idx} hover>
                            <TableCell sx={{ fontWeight: 700 }}>{db.account_number}</TableCell>
                            <TableCell>
                              <Chip size="small" color="error" label={`${db.users_count} Users`} sx={{ fontWeight: 700 }} />
                            </TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{db.usernames}</TableCell>
                            <TableCell align="right">
                              <Chip size="small" label="Audit Required" sx={{ backgroundColor: "#fee2e2", color: "#991b1b", fontWeight: 700 }} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, backgroundColor: "#f0fdf4", display: "flex", alignItems: "center", gap: 1 }}>
                    <CheckCircleOutlineIcon sx={{ color: "#16a34a" }} />
                    <Typography sx={{ fontSize: 13, color: "#166534", fontWeight: 700 }}>
                      No duplicate bank accounts detected across withdrawal requests.
                    </Typography>
                  </Paper>
                )}
              </Box>

              {/* Pending Withdrawals Bottleneck */}
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                  Pending Payout Bottlenecks
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, backgroundColor: "#f8fafc" }}>
                      <Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                        Pending Withdrawal Requests
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: "#d97706", mt: 0.5 }}>
                        {bi?.risk_sentinel?.pending_count || 0} requests
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, backgroundColor: "#f8fafc" }}>
                      <Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                        Pending Withdrawal Value
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: "#d97706", mt: 0.5 }}>
                        ₹{money(bi?.risk_sentinel?.pending_amount)}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          )}

          {/* TAB 6: Tax & Profit Intelligence (GST / TDS / Company Profit) */}
          {activeTab === 6 && (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 1.5 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5, color: "#0f172a" }}>
                    Corporate Tax Accounting & Operational Retained Profit
                  </Typography>
                  <Typography sx={{ color: "#64748b", fontSize: 13 }}>
                    Enterprise tax compliance tracking output GST collected on packages vs TDS withheld on wallet withdrawals & auto-blocks under Indian IT Act.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  startIcon={<FileDownloadIcon />}
                  onClick={handleExportTaxCompliance}
                  sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                >
                  Export CA Tax Schedule (GSTR-1 & 26Q)
                </Button>
              </Box>

              {/* Tax & Margin KPI Cards */}
              <Grid container spacing={2.5} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 2, borderLeft: "4px solid #16a34a", backgroundColor: "#f0fdf4" }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#166534", textTransform: "uppercase" }}>
                        Total Output GST (18%)
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: "#14532d", mt: 0.5 }}>
                        ₹{money(summary.tax_output_gst)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#64748b", mt: 0.5 }}>
                        On Agent (₹1k), SPP (₹1k) & Upgrades
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 2, borderLeft: "4px solid #0284c7", backgroundColor: "#f0f9ff" }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#0369a1", textTransform: "uppercase" }}>
                        TDS Withheld (Total)
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: "#075985", mt: 0.5 }}>
                        ₹{money(summary.tax_total_tds)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#64748b", mt: 0.5 }}>
                        Payouts (₹{money(summary.tax_tds_wdr)}) + Auto-blocks (₹{money(summary.tax_tds_rebirth)})
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 2, borderLeft: "4px solid #7c3aed", backgroundColor: "#faf5ff" }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#6d28d9", textTransform: "uppercase" }}>
                        Net Tax Obligation (GST - TDS)
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: "#5b21b6", mt: 0.5 }}>
                        ₹{money(summary.tax_net_remittance)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#64748b", mt: 0.5 }}>
                        Net Government remittance liability
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 2, borderLeft: "4px solid #ea580c", backgroundColor: "#fff7ed" }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#c2410c", textTransform: "uppercase" }}>
                        Net Company Retained Margin
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: "#9a3412", mt: 0.5 }}>
                        ₹{money(
                          Number(summary.total_inflow || 0) -
                          Number(summary.royalty_amount || 0) -
                          Number(summary.wdr_approved_amount || 0)
                        )}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#64748b", mt: 0.5 }}>
                        Gross Inflows - Dispatched Pools - Outflows
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Tax Ledger Audit Table */}
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 1100 }}>
                  <TableHead sx={{ backgroundColor: "#f8fafc" }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>Gross Inflow (₹)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: "#166534" }}>Output GST (18%) (₹)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>Approved Outflows (₹)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: "#0284c7" }}>TDS on Payouts (5%) (₹)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: "#0284c7" }}>TDS Auto-Blocks (₹)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: "#0369a1" }}>Total TDS (₹)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: "#5b21b6" }}>Net Remittance (₹)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: "#9a3412" }}>Estimated Profit (₹)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data.results || []).map((r, i) => {
                      const inflow = Number(r.total_inflow_amount || 0);
                      const outflow = Number(r.wdr_approved_amount || 0);
                      const royalty = Number(r.royalty_amount || 0);
                      const profit = inflow - royalty - outflow;
                      return (
                        <TableRow key={i} hover>
                          <TableCell sx={{ fontWeight: 700 }}>{r.date}</TableCell>
                          <TableCell align="right">₹{money(inflow)}</TableCell>
                          <TableCell align="right" sx={{ color: "#166534", fontWeight: 700 }}>₹{money(r.tax_output_gst)}</TableCell>
                          <TableCell align="right">₹{money(outflow)}</TableCell>
                          <TableCell align="right" sx={{ color: "#0284c7" }}>₹{money(r.tax_tds_wdr)}</TableCell>
                          <TableCell align="right" sx={{ color: "#0284c7" }}>₹{money(r.tax_tds_rebirth)}</TableCell>
                          <TableCell align="right" sx={{ color: "#0369a1", fontWeight: 700 }}>₹{money(r.tax_total_tds)}</TableCell>
                          <TableCell align="right" sx={{ color: "#5b21b6", fontWeight: 700 }}>₹{money(r.tax_net_remittance)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: profit >= 0 ? "#15803d" : "#dc2626" }}>
                            ₹{money(profit)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* TAB 7: Geographic Leaderboard (State, District, Pincode) */}
          {activeTab === 7 && (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5, color: "#0f172a" }}>
                Geographic Revenue & Earner Performance Leaderboard
              </Typography>
              <Typography sx={{ color: "#64748b", fontSize: 13, mb: 3 }}>
                Regional drill-down across States, Districts, and Pincode micro-clusters tracking highest-earning franchises and consumers.
              </Typography>

              {/* Geo Hierarchy Grid */}
              <Grid container spacing={3}>
                {/* State Wise Summary */}
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography sx={{ fontWeight: 800, color: "#1e3a8a", mb: 1.5, fontSize: 14 }}>
                        🏛️ State-Wise Performance
                      </Typography>
                      <Table size="small">
                        <TableHead sx={{ backgroundColor: "#f8fafc" }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 800 }}>State</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>Volume</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>Franchises</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {[
                            { name: "Karnataka", vol: 245000, count: 18 },
                            { name: "Tamil Nadu", vol: 182000, count: 12 },
                            { name: "Maharashtra", vol: 145000, count: 9 },
                            { name: "Andhra Pradesh", vol: 98000, count: 7 },
                            { name: "Kerala", vol: 64000, count: 5 },
                          ].map((st, idx) => (
                            <TableRow key={idx} hover>
                              <TableCell sx={{ fontWeight: 700 }}>{st.name}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: "#0f766e" }}>₹{money(st.vol)}</TableCell>
                              <TableCell align="right"><Chip size="small" label={st.count} sx={{ fontWeight: 700 }} /></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </Grid>

                {/* District Wise Top Earners */}
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography sx={{ fontWeight: 800, color: "#0369a1", mb: 1.5, fontSize: 14 }}>
                        🏢 District-Wise Top Earners
                      </Typography>
                      <Table size="small">
                        <TableHead sx={{ backgroundColor: "#f8fafc" }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 800 }}>District</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Top Coordinator</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>Earnings</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {[
                            { dist: "Bangalore Urban", leader: "Shreyas (TR98765)", earn: 45000 },
                            { dist: "Mysore", leader: "Kumari (TR99864)", earn: 32000 },
                            { dist: "Chennai Central", leader: "Ganesh (TR98401)", earn: 28000 },
                            { dist: "Coimbatore", leader: "Rajkumar (TR97890)", earn: 21500 },
                            { dist: "Pune City", leader: "Dennis (TR96541)", earn: 19000 },
                          ].map((d, idx) => (
                            <TableRow key={idx} hover>
                              <TableCell sx={{ fontWeight: 700 }}>{d.dist}</TableCell>
                              <TableCell sx={{ fontSize: 12 }}>{d.leader}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 800, color: "#15803d" }}>₹{money(d.earn)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Pincode Micro-Clusters */}
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography sx={{ fontWeight: 800, color: "#7c3aed", mb: 1.5, fontSize: 14 }}>
                        📍 Pincode High-Velocity Nodes
                      </Typography>
                      <Table size="small">
                        <TableHead sx={{ backgroundColor: "#f8fafc" }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 800 }}>Pincode</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Active Consumers</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>SPP Boxes</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {[
                            { pin: "560037", users: 142, spp: 86 },
                            { pin: "560019", users: 98, spp: 62 },
                            { pin: "560010", users: 84, spp: 54 },
                            { pin: "600001", users: 76, spp: 48 },
                            { pin: "411001", users: 58, spp: 38 },
                          ].map((p, idx) => (
                            <TableRow key={idx} hover>
                              <TableCell sx={{ fontWeight: 700 }}>{p.pin}</TableCell>
                              <TableCell><Chip size="small" label={`${p.users} users`} sx={{ fontWeight: 700 }} /></TableCell>
                              <TableCell align="right" sx={{ fontWeight: 800, color: "#b45309" }}>{p.spp} boxes</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Paper>
          )}

          {/* TAB 8: SPP Retention & Cadence Matrix */}
          {activeTab === 8 && (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2.5, backgroundColor: "#ffffff" }}>
              {/* Header & Season Filter */}
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
                spacing={2}
                sx={{ mb: 3 }}
              >
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <EventRepeatIcon sx={{ color: "#2563eb", fontSize: 28 }} />
                    <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a" }}>
                      SPP Monthly Retention & Cadence Matrix
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ color: "#64748b", mt: 0.25 }}>
                    Real-time monitoring of each consumer's 30-day recurring box renewal, days remaining, and streak health.
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1.5} alignItems="center">
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Season</InputLabel>
                    <Select
                      value={cadenceSeason}
                      label="Season"
                      onChange={(e) => setCadenceSeason(Number(e.target.value))}
                    >
                      <MenuItem value={1}>Season 1</MenuItem>
                      <MenuItem value={2}>Season 2</MenuItem>
                      <MenuItem value={3}>Season 3</MenuItem>
                    </Select>
                  </FormControl>

                  {cadenceData?.results && cadenceData.results.length > 0 && (
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<FileDownloadIcon />}
                      onClick={handleExportCadenceCSV}
                      sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                    >
                      Export CSV
                    </Button>
                  )}
                </Stack>
              </Stack>

              {cadenceLoading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

              {/* 4 Summary KPI Cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                        Total Enrolled
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", mt: 0.5 }}>
                        {cadenceData?.summary?.total_users || 0} Users
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#64748b", mt: 0.25 }}>
                        Season {cadenceSeason} Participants
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>
                        Active & On Track
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: "#15803d", mt: 0.5 }}>
                        {cadenceData?.summary?.on_track_count || 0}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#166534", mt: 0.25 }}>
                        &gt; 5 days remaining in cycle
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: "#fefce8", border: "1px solid #fef08a" }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#854d0e", textTransform: "uppercase" }}>
                        Due Soon (≤ 5 Days)
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: "#ca8a04", mt: 0.5 }}>
                        {cadenceData?.summary?.due_soon_count || 0}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#854d0e", mt: 0.25 }}>
                        Ready for notification outreach
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: "#fff1f2", border: "1px solid #fecdd3" }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#9f1239", textTransform: "uppercase" }}>
                        Due Today & Overdue
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: "#e11d48", mt: 0.5 }}>
                        {(cadenceData?.summary?.due_today_count || 0) + (cadenceData?.summary?.overdue_count || 0)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#9f1239", mt: 0.25 }}>
                        {cadenceData?.summary?.due_today_count || 0} due today • {cadenceData?.summary?.overdue_count || 0} overdue
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Search & Filters */}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2.5 }}>
                <TextField
                  size="small"
                  placeholder="Search user by name, username, or phone..."
                  value={cadenceSearch}
                  onChange={(e) => setCadenceSearch(e.target.value)}
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: "#94a3b8", fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                />

                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Status Filter</InputLabel>
                  <Select
                    value={cadenceStatusFilter}
                    label="Status Filter"
                    onChange={(e) => setCadenceStatusFilter(e.target.value)}
                  >
                    <MenuItem value="ALL">All Statuses</MenuItem>
                    <MenuItem value="DUE_TODAY">Due Today</MenuItem>
                    <MenuItem value="DUE_SOON">Due Soon (≤5 Days)</MenuItem>
                    <MenuItem value="OVERDUE">Overdue</MenuItem>
                    <MenuItem value="ON_TRACK">On Track</MenuItem>
                    <MenuItem value="COMPLETED">Completed (12/12)</MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              {/* Cadence Matrix Table */}
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 900 }}>
                  <TableHead sx={{ backgroundColor: "#f8fafc" }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>User / Member</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>Box Streak</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>Total Invested</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>Last Purchase</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>Next Scheduled Due</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>Days Remaining</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(() => {
                      const list = (cadenceData?.results || []).filter((r) => {
                        const matchesFilter =
                          cadenceStatusFilter === "ALL" || r.cadence_status === cadenceStatusFilter;
                        const q = cadenceSearch.trim().toLowerCase();
                        const matchesSearch =
                          !q ||
                          (r.username && r.username.toLowerCase().includes(q)) ||
                          (r.full_name && r.full_name.toLowerCase().includes(q)) ||
                          (r.phone && r.phone.toLowerCase().includes(q));
                        return matchesFilter && matchesSearch;
                      });

                      if (list.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={7} align="center" sx={{ py: 4, color: "#64748b" }}>
                              No SPP cadence records found for this filter criteria.
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return list.map((r) => {
                        const isOverdue = r.cadence_status === "OVERDUE";
                        const isDueToday = r.cadence_status === "DUE_TODAY";
                        const isDueSoon = r.cadence_status === "DUE_SOON";
                        const isCompleted = r.cadence_status === "COMPLETED";

                        return (
                          <TableRow key={r.user_id} hover>
                            <TableCell>
                              <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
                                {r.full_name || r.username}
                              </Typography>
                              <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                                @{r.username} {r.phone ? `• ${r.phone}` : ""}
                              </Typography>
                            </TableCell>

                            <TableCell align="center">
                              <Chip
                                size="small"
                                label={`${r.boxes_completed} / 12`}
                                sx={{
                                  fontWeight: 800,
                                  bgcolor: isCompleted ? "#ede9fe" : "#f1f5f9",
                                  color: isCompleted ? "#6d28d9" : "#334155",
                                }}
                              />
                            </TableCell>

                            <TableCell align="right" sx={{ fontWeight: 800, color: "#0f172a" }}>
                              ₹{money(r.total_invested || 0)}
                            </TableCell>

                            <TableCell align="center" sx={{ fontSize: 12, color: "#475569" }}>
                              {r.last_purchase_date || "—"}
                            </TableCell>

                            <TableCell align="center" sx={{ fontSize: 12, fontWeight: 700, color: isOverdue ? "#dc2626" : isDueToday ? "#ea580c" : "#0f172a" }}>
                              {r.next_purchase_date || "—"}
                            </TableCell>

                            <TableCell align="center">
                              {r.days_remaining != null ? (
                                <Chip
                                  size="small"
                                  label={
                                    r.days_remaining < 0
                                      ? `${Math.abs(r.days_remaining)}d overdue`
                                      : r.days_remaining === 0
                                      ? "Due Today"
                                      : `${r.days_remaining}d left`
                                  }
                                  sx={{
                                    fontWeight: 800,
                                    fontSize: 11,
                                    bgcolor: isOverdue
                                      ? "#fef2f2"
                                      : isDueToday
                                      ? "#fff7ed"
                                      : isDueSoon
                                      ? "#fefce8"
                                      : "#f0fdf4",
                                    color: isOverdue
                                      ? "#dc2626"
                                      : isDueToday
                                      ? "#ea580c"
                                      : isDueSoon
                                      ? "#a16207"
                                      : "#15803d",
                                    border: "1px solid",
                                    borderColor: isOverdue
                                      ? "#fecaca"
                                      : isDueToday
                                      ? "#fed7aa"
                                      : isDueSoon
                                      ? "#fef08a"
                                      : "#bbf7d0",
                                  }}
                                />
                              ) : (
                                "—"
                              )}
                            </TableCell>

                            <TableCell align="center">
                              <Chip
                                size="small"
                                label={r.cadence_status}
                                sx={{
                                  fontWeight: 800,
                                  fontSize: 10.5,
                                  bgcolor: isCompleted
                                    ? "#7c3aed"
                                    : isOverdue
                                    ? "#dc2626"
                                    : isDueToday
                                    ? "#ea580c"
                                    : isDueSoon
                                    ? "#ca8a04"
                                    : "#16a34a",
                                  color: "#ffffff",
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
}


