import React, { useState, useEffect } from "react";
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
} from "@mui/material";
import {
  ReceiptLongRounded as LedgerIcon,
  SearchRounded as SearchIcon,
  RefreshRounded as RefreshIcon,
  FileDownloadRounded as DownloadIcon,
  AccountBalanceWalletRounded as WalletIcon,
  PaidRounded as PaidIcon,
  PriceCheckRounded as FeeIcon,
  TuneRounded as SettingsIcon,
  CheckCircleRounded as CheckIcon,
} from "@mui/icons-material";
import { Alert } from "@mui/material";
import API from "../../api/api";
import { C, R, S } from "../../theme/tokens";
import StatusBadge from "../../components/common/StatusBadge";

function fmtAmount(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";
}

export default function AdminTotalAdminCharges() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ summary: {}, results: [] });
  const [search, setSearch] = useState("");

  // Platform Tax & Deductions Configuration
  const [taxConfig, setTaxConfig] = useState({
    p2p_package_tax_percent: 7,
    p2p_coupon_tax_percent: 7,
    withdrawal_tax_percent: 10,
  });
  const [taxSaving, setTaxSaving] = useState(false);
  const [taxMsg, setTaxMsg] = useState({ type: "", text: "" });

  const fetchTaxConfig = async () => {
    try {
      const res = await API.get("/business/platform-taxes/");
      if (res.data) {
        setTaxConfig({
          p2p_package_tax_percent: res.data.p2p_package_tax_percent ?? 7,
          p2p_coupon_tax_percent: res.data.p2p_coupon_tax_percent ?? 7,
          withdrawal_tax_percent: res.data.withdrawal_tax_percent ?? 10,
        });
      }
    } catch (e) {
      console.error("Failed to load platform taxes:", e);
    }
  };

  const saveTaxConfig = async () => {
    try {
      setTaxSaving(true);
      setTaxMsg({ type: "", text: "" });
      const res = await API.post("/business/platform-taxes/", taxConfig);
      setTaxMsg({ type: "success", text: "Platform tax rates saved successfully!" });
    } catch (err) {
      setTaxMsg({ type: "error", text: err?.response?.data?.detail || "Failed to update tax rates." });
    } finally {
      setTaxSaving(false);
    }
  };

  const fetchCharges = async () => {
    try {
      setLoading(true);
      const res = await API.get("/business/admin/total-admin-charges/");
      setData(res.data || { summary: {}, results: [] });
    } catch (err) {
      console.error("Failed to fetch admin charges:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharges();
    fetchTaxConfig();
  }, []);

  const summary = data.summary || {};
  const results = data.results || [];

  const filteredResults = results.filter((item) => {
    return (
      item.user_phone.toLowerCase().includes(search.toLowerCase()) ||
      item.charge_type.toLowerCase().includes(search.toLowerCase()) ||
      String(item.id).includes(search)
    );
  });

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", p: { xs: 1.5, sm: 2.5, md: 3.5 } }}>
      {/* Header Banner */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          borderRadius: 3.5,
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          color: "#fff",
          mb: 3,
          boxShadow: S.card,
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
              <LedgerIcon sx={{ fontSize: 32, color: "#38BDF8" }} />
              <Typography variant="h5" sx={{ fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>
                Total Admin Charges Ledger
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: "#94A3B8", fontWeight: 500, fontSize: "13.5px" }}>
              Comprehensive revenue audit of Package Activation fees, P2P Transaction fees (7%/15%/25%), and Admin Withholdings
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5}>
            <IconButton
              onClick={fetchCharges}
              disabled={loading}
              sx={{ bgcolor: "rgba(255,255,255,0.08)", color: "#fff", "&:hover": { bgcolor: "rgba(255,255,255,0.18)" } }}
            >
              <RefreshIcon sx={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </IconButton>
          </Stack>
        </Stack>

        {/* 4-Metric Grid */}
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Total Collected</Typography>
              <Typography sx={{ fontSize: "20px", fontWeight: 900, color: "#38BDF8" }}>₹{fmtAmount(summary.total_admin_charges)}</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>P2P Fees (7%/15%/25%)</Typography>
              <Typography sx={{ fontSize: "20px", fontWeight: 900, color: "#4ADE80" }}>₹{fmtAmount(summary.total_p2p_fees)}</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Activation Fees</Typography>
              <Typography sx={{ fontSize: "20px", fontWeight: 900, color: "#FBBF24" }}>₹{fmtAmount(summary.total_activation_fees)}</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Admin Withholdings</Typography>
              <Typography sx={{ fontSize: "20px", fontWeight: 900, color: "#C084FC" }}>₹{fmtAmount(summary.total_withdrawal_admin_fees)}</Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Platform Tax & Charges Configuration Card */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 3,
          border: "1.5px solid #E2E8F0",
          bgcolor: "#FFFFFF",
          boxShadow: S.card,
          mb: 3,
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1.5} sx={{ mb: 2 }}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <SettingsIcon sx={{ color: "#2563EB", fontSize: 24 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#0F172A", fontSize: "17px" }}>
                Platform Taxes & Charges Configuration
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: "#64748B", fontSize: "13px" }}>
              Configure GST/Tax rates for P2P Package transfers, Coupon pocket transfers, and Withdrawal TDS.
            </Typography>
          </Box>
          <Button
            variant="contained"
            disabled={taxSaving}
            onClick={saveTaxConfig}
            startIcon={taxSaving ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />}
            sx={{
              bgcolor: "#2563EB",
              color: "#fff",
              fontWeight: 700,
              borderRadius: 2,
              px: 2.5,
              textTransform: "none",
              "&:hover": { bgcolor: "#1D4ED8" },
            }}
          >
            {taxSaving ? "Saving..." : "Save Tax Configuration"}
          </Button>
        </Stack>

        {taxMsg.text && (
          <Alert severity={taxMsg.type} sx={{ mb: 2, borderRadius: 2 }} onClose={() => setTaxMsg({ type: "", text: "" })}>
            {taxMsg.text}
          </Alert>
        )}

        <Grid container spacing={2.5}>
          <Grid item xs={12} sm={4}>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <Typography sx={{ fontSize: "13px", fontWeight: 700, color: "#1E293B", mb: 0.5 }}>
                P2P Package Coupon Transfer Tax (%)
              </Typography>
              <Typography sx={{ fontSize: "11.5px", color: "#64748B", mb: 1.5, minHeight: 34 }}>
                GST / Tax deducted when a consumer sends a package coupon to another member.
              </Typography>
              <TextField
                size="small"
                type="number"
                fullWidth
                value={taxConfig.p2p_package_tax_percent}
                onChange={(e) => setTaxConfig({ ...taxConfig, p2p_package_tax_percent: e.target.value })}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <Typography sx={{ fontSize: "13px", fontWeight: 700, color: "#1E293B", mb: 0.5 }}>
                History → P2P Coupon Pocket Tax (%)
              </Typography>
              <Typography sx={{ fontSize: "11.5px", color: "#64748B", mb: 1.5, minHeight: 34 }}>
                Tax / Fee deducted when transferring from Main Wallet to P2P Coupon Pocket.
              </Typography>
              <TextField
                size="small"
                type="number"
                fullWidth
                value={taxConfig.p2p_coupon_tax_percent}
                onChange={(e) => setTaxConfig({ ...taxConfig, p2p_coupon_tax_percent: e.target.value })}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <Typography sx={{ fontSize: "13px", fontWeight: 700, color: "#1E293B", mb: 0.5 }}>
                History → Withdrawal Pocket Tax / TDS (%)
              </Typography>
              <Typography sx={{ fontSize: "11.5px", color: "#64748B", mb: 1.5, minHeight: 34 }}>
                Tax / TDS deducted when transferring from Main Wallet to Withdrawal Pocket.
              </Typography>
              <TextField
                size="small"
                type="number"
                fullWidth
                value={taxConfig.withdrawal_tax_percent}
                onChange={(e) => setTaxConfig({ ...taxConfig, withdrawal_tax_percent: e.target.value })}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Search Toolbar */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3,
          border: "1.5px solid #E2E8F0",
          bgcolor: "#FFFFFF",
          boxShadow: S.card,
          mb: 2.5,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <TextField
          size="small"
          placeholder="Search by User Phone, Charge Type or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: { xs: "100%", sm: 380 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "#94A3B8", fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
        />

        <Typography sx={{ fontSize: "12.5px", fontWeight: 700, color: "#64748B", display: { xs: "none", sm: "block" } }}>
          Showing {filteredResults.length} transactions
        </Typography>
      </Paper>

      {/* Ledger Table */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3.5,
          border: "1.5px solid #E2E8F0",
          bgcolor: "#FFFFFF",
          boxShadow: S.card,
          overflow: "hidden",
        }}
      >
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#F8FAFC" }}>
                <TableCell sx={{ fontWeight: 800, color: "#475569", fontSize: "12px" }}>TX ID</TableCell>
                <TableCell sx={{ fontWeight: 800, color: "#475569", fontSize: "12px" }}>SOURCE USER</TableCell>
                <TableCell sx={{ fontWeight: 800, color: "#475569", fontSize: "12px" }}>CHARGE CATEGORY</TableCell>
                <TableCell sx={{ fontWeight: 800, color: "#475569", fontSize: "12px" }}>GROSS AMOUNT</TableCell>
                <TableCell sx={{ fontWeight: 800, color: "#475569", fontSize: "12px" }}>FEE COLLECTED</TableCell>
                <TableCell sx={{ fontWeight: 800, color: "#475569", fontSize: "12px" }}>DATE & TIME</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: "center", py: 6 }}>
                    <CircularProgress size={32} sx={{ color: "#2563EB" }} />
                    <Typography sx={{ fontSize: "13px", color: "#64748B", mt: 1 }}>Loading charges audit...</Typography>
                  </TableCell>
                </TableRow>
              ) : filteredResults.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: "center", py: 6 }}>
                    <FeeIcon sx={{ fontSize: 40, color: "#94A3B8", mb: 1 }} />
                    <Typography sx={{ fontWeight: 800, color: "#334155" }}>No admin charges recorded</Typography>
                    <Typography sx={{ fontSize: "12.5px", color: "#64748B" }}>Transactions with admin fees will automatically record here.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredResults.map((item) => (
                  <TableRow key={item.id} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: "12px", color: "#64748B" }}>
                      #{item.id}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: "13px", color: "#0F172A" }}>
                      {item.user_phone}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={item.charge_type}
                        sx={{
                          fontWeight: 700,
                          fontSize: "11px",
                          bgcolor: item.charge_type.includes("P2P") ? "#EFF6FF" : "#FEF3C7",
                          color: item.charge_type.includes("P2P") ? "#2563EB" : "#D97706",
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: "13px", fontWeight: 600, color: "#475569" }}>
                      ₹{fmtAmount(item.gross_amount)}
                    </TableCell>
                    <TableCell sx={{ fontSize: "13.5px", fontWeight: 900, color: "#16A34A" }}>
                      + ₹{fmtAmount(item.amount)}
                    </TableCell>
                    <TableCell sx={{ fontSize: "12px", color: "#64748B" }}>
                      {item.date}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
