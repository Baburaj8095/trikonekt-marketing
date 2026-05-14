import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import API from "../../api/api";

function fmtAmount(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

function fmtDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
}

function serviceCharge(meta = {}) {
  const pct = meta.admin_service_charge_percent;
  const amount = meta.admin_service_charge_amount;
  if (pct || amount) return `${fmtAmount(pct)}% / Rs. ${fmtAmount(amount)}`;
  return "-";
}

function buildTransferRows(transactions, sourceType, creditType, pocketLabel) {
  return (transactions || [])
    .filter((tx) => tx.type === creditType && tx.source_type === sourceType)
    .map((tx, index) => {
      const meta = tx.meta || {};
      return {
        id: tx.id,
        sl: index + 1,
        date: tx.created_at,
        mainWallet: meta.gross_amount || tx.amount,
        adminCharge: serviceCharge(meta),
        pocketAmount: meta.net_amount || tx.amount,
        pocketLabel,
        status: "Completed",
      };
    });
}

function HistoryTable({ title, rows, pocketHeader }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
      <Box sx={{ px: 1.5, py: 1.25, borderBottom: "1px solid #e2e8f0" }}>
        <Typography sx={{ fontWeight: 900, color: "#0f172a" }}>{title}</Typography>
      </Box>
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 720 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "#f8fafc" }}>
              <TableCell sx={{ fontWeight: 900 }}>SL No</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Date & Time</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Main Wallet</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Admin Service Charge</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>{pocketHeader}</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.id || index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{fmtDate(row.date)}</TableCell>
                <TableCell>Rs. {fmtAmount(row.mainWallet)}</TableCell>
                <TableCell>{row.adminCharge}</TableCell>
                <TableCell>Rs. {fmtAmount(row.pocketAmount)}</TableCell>
                <TableCell>
                  <Chip size="small" color="success" label={row.status} sx={{ fontWeight: 800 }} />
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={6} sx={{ color: "#94a3b8", py: 3, textAlign: "center" }}>
                  No history found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

function VoucherTable({ rows }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
      <Box sx={{ px: 1.5, py: 1.25, borderBottom: "1px solid #e2e8f0" }}>
        <Typography sx={{ fontWeight: 900, color: "#0f172a" }}>Voucher History</Typography>
      </Box>
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 760 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "#f8fafc" }}>
              <TableCell sx={{ fontWeight: 900 }}>SL No</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Code</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Amount</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Created</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Valid Till</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.id || index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{row.code}</TableCell>
                <TableCell>{row.voucher_type_label || row.voucher_type}</TableCell>
                <TableCell>Rs. {fmtAmount(row.amount)}</TableCell>
                <TableCell>{fmtDate(row.created_at)}</TableCell>
                <TableCell>{fmtDate(row.expires_at)}</TableCell>
                <TableCell><Chip size="small" label={row.status} sx={{ fontWeight: 800 }} /></TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={7} sx={{ color: "#94a3b8", py: 3, textAlign: "center" }}>
                  No voucher history found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default function TeamWalletHistory() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [tab, setTab] = useState("coupon");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const [txRes, voucherRes] = await Promise.all([
        API.get("/accounts/wallet/me/transactions/", {
          params: { page_size: 100, date_from: dateFrom || undefined, date_to: dateTo || undefined },
        }),
        API.get("/accounts/wallet/vouchers/"),
      ]);
      setTransactions(txRes?.data?.results || []);
      setVouchers(voucherRes?.data?.results || []);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load team wallet history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Load once on mount. Filters use the Search button.
  }, []);

  const rows = useMemo(() => {
    const coupon = buildTransferRows(transactions, "MAIN_TO_COUPON", "COUPON_WALLET_CREDIT", "Coupon Pocket");
    const internal = buildTransferRows(transactions, "MAIN_TO_INTERNAL", "INTERNAL_WALLET_CREDIT", "Buy Package Pocket");
    const withdrawal = buildTransferRows(transactions, "MAIN_TO_WITHDRAWAL", "WITHDRAWAL_WALLET_CREDIT", "Withdrawal Pocket");
    return { coupon, internal, withdrawal };
  }, [transactions]);

  return (
    <Box sx={{ maxWidth: 1120, mx: "auto", px: { xs: 1.2, sm: 2 }, py: { xs: 1.5, sm: 2.5 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a" }}>
            Team History
          </Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Main wallet transfer and voucher transaction history.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <Button variant="contained" onClick={load}>Search</Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {loading && <LinearProgress sx={{ mb: 1 }} />}

      <Paper variant="outlined" sx={{ borderRadius: 2, mb: 1.5 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 44, "& .MuiTab-root": { minHeight: 44, fontWeight: 800, textTransform: "none" } }}
        >
          <Tab value="coupon" label="Coupon Pocket" />
          <Tab value="internal" label="Buy Package Pocket" />
          <Tab value="withdrawal" label="Withdrawal Pocket" />
          <Tab value="vouchers" label="Vouchers" />
        </Tabs>
      </Paper>

      <Stack spacing={2}>
        {tab === "coupon" && (
          <HistoryTable title="Coupon Pocket History" rows={rows.coupon} pocketHeader="Coupon Pocket Wallet" />
        )}
        {tab === "internal" && (
          <HistoryTable title="Buy Package Pocket History" rows={rows.internal} pocketHeader="Buy Package From Internal Wallet" />
        )}
        {tab === "withdrawal" && (
          <HistoryTable title="Withdrawal To Pocket History" rows={rows.withdrawal} pocketHeader="Withdrawal To Wallet" />
        )}
        {tab === "vouchers" && <VoucherTable rows={vouchers} />}
      </Stack>
    </Box>
  );
}
