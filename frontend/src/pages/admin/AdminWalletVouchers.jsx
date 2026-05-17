import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import API from "../../api/api";

const VOUCHER_TYPES = [
  { value: "", label: "All coupon types" },
  { value: "TRIZONE", label: "Trizone" },
  { value: "ONLINE", label: "Online" },
  { value: "NEAR_STORE", label: "Near Store" },
  { value: "PACKAGE_PURCHASE", label: "Package Purchase" },
];

function money(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function fmtDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
}

function statusColor(status) {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE") return "success";
  if (s === "REDEEMED") return "primary";
  if (s === "CANCELLED") return "error";
  if (s === "EXPIRED") return "warning";
  return "default";
}

export default function AdminWalletVouchers() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [voucherType, setVoucherType] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const res = await API.get("/admin/wallet-vouchers/", {
        params: { q, status, voucher_type: voucherType, page_size: 100 },
      });
      setRows(res?.data?.results || []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load vouchers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function cancelRefund(id) {
    const reason = window.prompt("Reason for cancel/refund?") || "";
    try {
      await API.post(`/admin/wallet-vouchers/${id}/cancel-refund/`, { reason });
      await load();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Cancel/refund failed");
    }
  }

  const summary = useMemo(() => {
    const base = { ACTIVE: 0, REDEEMED: 0, EXPIRED: 0, CANCELLED: 0, totalAmount: 0 };
    rows.forEach((row) => {
      const s = String(row?.status || "").toUpperCase();
      if (base[s] !== undefined) base[s] += 1;
      base.totalAmount += Number(row?.amount || 0);
    });
    return base;
  }, [rows]);

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1440, mx: "auto" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>
            Coupon & Voucher Management
          </Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Track Trizone, Online, Near Store, and Package Purchase coupon vouchers, including creator, assigned consumer, redeemed consumer, and status.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={load}>Refresh</Button>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
      {loading && <LinearProgress sx={{ mb: 1 }} />}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(5, 1fr)" }, gap: 1, mb: 2 }}>
        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
          <Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Total Value</Typography>
          <Typography sx={{ fontWeight: 950 }}>Rs. {money(summary.totalAmount)}</Typography>
        </Paper>
        {["ACTIVE", "REDEEMED", "EXPIRED", "CANCELLED"].map((key) => (
          <Paper key={key} variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
            <Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>{key}</Typography>
            <Typography sx={{ fontWeight: 950 }}>{summary[key]}</Typography>
          </Paper>
        ))}
      </Box>

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField size="small" label="Search code / creator / receiver / redeemer" value={q} onChange={(e) => setQ(e.target.value)} fullWidth />
          <TextField select size="small" label="Coupon Type" value={voucherType} onChange={(e) => setVoucherType(e.target.value)} sx={{ minWidth: 190 }}>
            {VOUCHER_TYPES.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="REDEEMED">Redeemed</MenuItem>
            <MenuItem value="EXPIRED">Expired</MenuItem>
            <MenuItem value="CANCELLED">Cancelled</MenuItem>
          </TextField>
          <Button variant="contained" onClick={load}>Search</Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 1180 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "#f8fafc" }}>
                <TableCell sx={{ fontWeight: 900 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Created By</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Assigned / Sent To</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Redeemed By</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Created</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Valid Till</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Redeemed At</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell sx={{ fontWeight: 900 }}>{row.code}</TableCell>
                  <TableCell>{row.voucher_type_label || row.voucher_type}</TableCell>
                  <TableCell>Rs. {money(row.amount)}</TableCell>
                  <TableCell>{row.creator_username || "-"}</TableCell>
                  <TableCell>{row.assigned_to_username || "-"}</TableCell>
                  <TableCell>{row.redeemed_by_username || "-"}</TableCell>
                  <TableCell>{fmtDate(row.created_at)}</TableCell>
                  <TableCell>{fmtDate(row.expires_at)}</TableCell>
                  <TableCell>{fmtDate(row.redeemed_at)}</TableCell>
                  <TableCell><Chip size="small" label={row.status} color={statusColor(row.status)} sx={{ fontWeight: 800 }} /></TableCell>
                  <TableCell>
                    {row.status === "ACTIVE" ? (
                      <Button size="small" variant="outlined" color="error" onClick={() => cancelRefund(row.id)}>
                        Cancel/Refund
                      </Button>
                    ) : (
                      <Typography sx={{ color: "#94a3b8", fontSize: 12 }}>No actions</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && !loading ? (
                <TableRow>
                  <TableCell colSpan={11} sx={{ py: 3, color: "#94a3b8", textAlign: "center" }}>
                    No vouchers found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
