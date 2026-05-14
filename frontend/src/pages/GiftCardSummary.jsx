import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
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
  Typography,
} from "@mui/material";
import API from "../api/api";

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

function statusColor(status) {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE") return "success";
  if (s === "REDEEMED") return "primary";
  if (s === "EXPIRED" || s === "CANCELLED") return "default";
  return "default";
}

function VoucherTable({ rows }) {
  return (
    <TableContainer sx={{ overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 820 }}>
        <TableHead>
          <TableRow sx={{ bgcolor: "#f8fafc" }}>
            <TableCell sx={{ fontWeight: 900 }}>SL No</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Date & Time</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Coupon Type</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Code</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Amount</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Receiver</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Valid Till</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.id || index}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>{fmtDate(row.created_at)}</TableCell>
              <TableCell>{row.voucher_type_label || row.voucher_type}</TableCell>
              <TableCell>{row.code}</TableCell>
              <TableCell>Rs. {fmtAmount(row.amount)}</TableCell>
              <TableCell>{row.assigned_to_username || row.redeemed_by_username || "-"}</TableCell>
              <TableCell>{fmtDate(row.expires_at)}</TableCell>
              <TableCell>
                <Chip size="small" color={statusColor(row.status)} label={row.status || "-"} sx={{ fontWeight: 800 }} />
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={8} sx={{ textAlign: "center", py: 3, color: "#94a3b8" }}>
                No history found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function WalletTable({ rows }) {
  return (
    <TableContainer sx={{ overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 760 }}>
        <TableHead>
          <TableRow sx={{ bgcolor: "#f8fafc" }}>
            <TableCell sx={{ fontWeight: 900 }}>SL No</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Date & Time</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Transaction</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Source</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Amount</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.id || index}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>{fmtDate(row.created_at)}</TableCell>
              <TableCell>{String(row.type || "").replace(/_/g, " ")}</TableCell>
              <TableCell>{row.source_type || "-"}</TableCell>
              <TableCell sx={{ color: Number(row.amount) < 0 ? "#dc2626" : "#15803d", fontWeight: 900 }}>
                Rs. {fmtAmount(row.amount)}
              </TableCell>
              <TableCell><Chip size="small" color="success" label="Completed" sx={{ fontWeight: 800 }} /></TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={6} sx={{ textAlign: "center", py: 3, color: "#94a3b8" }}>
                No history found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function GiftCardSummary() {
  const [tab, setTab] = useState("trizone");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vouchers, setVouchers] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const [voucherRes, txRes] = await Promise.all([
          API.get("/accounts/wallet/vouchers/"),
          API.get("/accounts/wallet/me/transactions/", { params: { page_size: 100 } }),
        ]);
        if (!alive) return;
        setVouchers(voucherRes?.data?.results || []);
        setTransactions(txRes?.data?.results || []);
      } catch (err) {
        if (alive) setError(err?.response?.data?.detail || "Failed to load gift card summary.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const byType = (type) => vouchers.filter((v) => String(v.voucher_type || "").toUpperCase() === type);
    const selfPackageTypes = new Set(["INTERNAL_WALLET_CREDIT", "INTERNAL_WALLET_DEBIT", "PACKAGE_COUPON_WALLET_CREDIT", "PACKAGE_COUPON_WALLET_DEBIT", "VOUCHER_REDEEM_CREDIT"]);
    return {
      trizone: byType("TRIZONE"),
      online: byType("ONLINE"),
      nearstore: byType("NEAR_STORE"),
      package: byType("PACKAGE_PURCHASE"),
      selfPackage: transactions.filter((tx) => selfPackageTypes.has(String(tx.type || "").toUpperCase())),
    };
  }, [transactions, vouchers]);

  return (
    <Box sx={{ maxWidth: 1120, mx: "auto", px: { xs: 1.2, sm: 2 }, py: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a" }}>
        Gift Card Summary
      </Typography>
      <Typography sx={{ color: "#64748b", fontSize: 13, mb: 2 }}>
        History for Trizone, Online, Near Store, Package Coupons, and Self Package Pocket activity.
      </Typography>

      {loading && <LinearProgress sx={{ mb: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      <Paper variant="outlined" sx={{ borderRadius: 2, mb: 1.5 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 44, "& .MuiTab-root": { minHeight: 44, fontWeight: 800, textTransform: "none" } }}
        >
          <Tab value="trizone" label="Trizone" />
          <Tab value="online" label="Online" />
          <Tab value="nearstore" label="Near Store" />
          <Tab value="package" label="Package Coupon" />
          <Tab value="selfPackage" label="Self Package Pocket" />
        </Tabs>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
        <Box sx={{ px: 1.5, py: 1.25, borderBottom: "1px solid #e2e8f0" }}>
          <Typography sx={{ fontWeight: 900, color: "#0f172a" }}>
            {tab === "trizone" && "Trizone Coupon History"}
            {tab === "online" && "Online Coupon History"}
            {tab === "nearstore" && "Near Store Coupon History"}
            {tab === "package" && "Package Purchase Coupon History"}
            {tab === "selfPackage" && "Self Package Pocket History"}
          </Typography>
        </Box>
        {tab === "selfPackage" ? (
          <WalletTable rows={grouped.selfPackage} />
        ) : (
          <VoucherTable rows={grouped[tab] || []} />
        )}
      </Paper>
    </Box>
  );
}
