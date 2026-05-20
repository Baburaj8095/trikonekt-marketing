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
  useMediaQuery,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";
import API, { listWalletUploadRequests } from "../../api/api";

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

function EmptyState({ children }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        border: "1px dashed #cbd5e1",
        bgcolor: "#f8fafc",
        textAlign: "center",
        color: "#64748b",
        fontWeight: 700,
      }}
    >
      {children}
    </Paper>
  );
}

function DetailRow({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.45 }}>
      <Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 750 }}>{label}</Typography>
      <Typography component="div" sx={{ fontSize: 12.5, color: "#0f172a", fontWeight: 850, textAlign: "right", overflowWrap: "anywhere" }}>
        {value}
      </Typography>
    </Stack>
  );
}

function HistoryCard({ row, index, pocketHeader }) {
  return (
    <Paper elevation={0} className="consumer-fintech-card" sx={{ p: 1.5, borderRadius: 3 }}>
      <Stack direction="row" justifyContent="space-between" spacing={1.5} sx={{ mb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: "#0f172a" }}>{pocketHeader}</Typography>
          <Typography sx={{ fontSize: 11.5, color: "#64748b", fontWeight: 700 }}>{fmtDate(row.date)}</Typography>
        </Box>
        <Chip size="small" color="success" label={row.status} sx={{ height: 24 }} />
      </Stack>
      <DetailRow label="SL No" value={index + 1} />
      <DetailRow label="Main Wallet" value={`Rs. ${fmtAmount(row.mainWallet)}`} />
      <DetailRow label="Admin Service Charge" value={row.adminCharge} />
      <DetailRow label={pocketHeader} value={`Rs. ${fmtAmount(row.pocketAmount)}`} />
    </Paper>
  );
}

function HistoryTable({ title, rows, pocketHeader }) {
  const isMobile = useMediaQuery("(max-width:700px)");

  if (isMobile) {
    return (
      <Box>
        <Typography sx={{ fontWeight: 900, color: "#0f172a", mb: 1 }}>{title}</Typography>
        <Stack spacing={1.2}>
          {rows.map((row, index) => (
            <HistoryCard key={row.id || index} row={row} index={index} pocketHeader={pocketHeader} />
          ))}
          {!rows.length ? <EmptyState>No history found.</EmptyState> : null}
        </Stack>
      </Box>
    );
  }

  return (
    <Paper elevation={0} className="consumer-fintech-card" sx={{ borderRadius: 3, overflow: "hidden", bgcolor: "#fff" }}>
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
  const isMobile = useMediaQuery("(max-width:700px)");

  if (isMobile) {
    return (
      <Box>
        <Typography sx={{ fontWeight: 900, color: "#0f172a", mb: 1 }}>Voucher History</Typography>
        <Stack spacing={1.2}>
          {rows.map((row, index) => (
            <Paper key={row.id || index} elevation={0} className="consumer-fintech-card" sx={{ p: 1.5, borderRadius: 3 }}>
              <Stack direction="row" justifyContent="space-between" spacing={1.5} sx={{ mb: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: "#0f172a" }}>{row.code}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: "#64748b", fontWeight: 700 }}>{row.voucher_type_label || row.voucher_type}</Typography>
                </Box>
                <Chip size="small" label={row.status} sx={{ height: 24 }} />
              </Stack>
              <DetailRow label="SL No" value={index + 1} />
              <DetailRow label="Amount" value={`Rs. ${fmtAmount(row.amount)}`} />
              <DetailRow label="Created By" value={row.creator_username || "-"} />
              <DetailRow label="Sent To" value={row.assigned_to_username || "-"} />
              <DetailRow label="Redeemed By" value={row.redeemed_by_username || "-"} />
              <DetailRow label="Created" value={fmtDate(row.created_at)} />
              <DetailRow label="Valid Till" value={fmtDate(row.expires_at)} />
              <DetailRow label="Redeemed At" value={fmtDate(row.redeemed_at)} />
            </Paper>
          ))}
          {!rows.length ? <EmptyState>No voucher history found.</EmptyState> : null}
        </Stack>
      </Box>
    );
  }

  return (
    <Paper elevation={0} className="consumer-fintech-card" sx={{ borderRadius: 3, overflow: "hidden", bgcolor: "#fff" }}>
      <Box sx={{ px: 1.5, py: 1.25, borderBottom: "1px solid #e2e8f0" }}>
        <Typography sx={{ fontWeight: 900, color: "#0f172a" }}>Voucher History</Typography>
      </Box>
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 1040 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "#f8fafc" }}>
              <TableCell sx={{ fontWeight: 900 }}>SL No</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Code</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Amount</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Created By</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Sent To</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Redeemed By</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Created</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Valid Till</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Redeemed At</TableCell>
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
                <TableCell>{row.creator_username || "-"}</TableCell>
                <TableCell>{row.assigned_to_username || "-"}</TableCell>
                <TableCell>{row.redeemed_by_username || "-"}</TableCell>
                <TableCell>{fmtDate(row.created_at)}</TableCell>
                <TableCell>{fmtDate(row.expires_at)}</TableCell>
                <TableCell>{fmtDate(row.redeemed_at)}</TableCell>
                <TableCell><Chip size="small" label={row.status} sx={{ fontWeight: 800 }} /></TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={11} sx={{ color: "#94a3b8", py: 3, textAlign: "center" }}>
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

function statusChipColor(status) {
  switch (String(status || "").toUpperCase()) {
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "error";
    case "PENDING":
      return "warning";
    default:
      return "default";
  }
}

function AddMoneyTable({ rows }) {
  const isMobile = useMediaQuery("(max-width:700px)");

  if (isMobile) {
    return (
      <Box>
        <Typography sx={{ fontWeight: 900, color: "#0f172a", mb: 1 }}>Add Money History</Typography>
        <Stack spacing={1.2}>
          {rows.map((row, index) => (
            <Paper key={row.id || index} elevation={0} className="consumer-fintech-card" sx={{ p: 1.5, borderRadius: 3 }}>
              <Stack direction="row" justifyContent="space-between" spacing={1.5} sx={{ mb: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: "#0f172a" }}>Rs. {fmtAmount(row.amount)}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: "#64748b", fontWeight: 700 }}>{fmtDate(row.requested_at)}</Typography>
                </Box>
                <Chip size="small" color={statusChipColor(row.status)} label={row.status || "-"} sx={{ height: 24 }} />
              </Stack>
              <DetailRow label="SL No" value={index + 1} />
              <DetailRow label="UTR No" value={row.utr || "-"} />
              <DetailRow
                label="Proof"
                value={
                  row.proof ? (
                    <Button size="small" href={row.proof} target="_blank" rel="noreferrer" sx={{ minHeight: 30, px: 1.2 }}>
                      View
                    </Button>
                  ) : (
                    "-"
                  )
                }
              />
              <DetailRow label="Approved / Rejected At" value={fmtDate(row.decided_at)} />
              <DetailRow label="Remarks" value={row.reject_reason || row.remarks || "-"} />
            </Paper>
          ))}
          {!rows.length ? <EmptyState>No add money history found.</EmptyState> : null}
        </Stack>
      </Box>
    );
  }

  return (
    <Paper elevation={0} className="consumer-fintech-card" sx={{ borderRadius: 3, overflow: "hidden", bgcolor: "#fff" }}>
      <Box sx={{ px: 1.5, py: 1.25, borderBottom: "1px solid #e2e8f0" }}>
        <Typography sx={{ fontWeight: 900, color: "#0f172a" }}>Add Money History</Typography>
      </Box>
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 920 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "#f8fafc" }}>
              <TableCell sx={{ fontWeight: 900 }}>SL No</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Requested At</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Amount</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>UTR No</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Proof</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Approved / Rejected At</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Remarks</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.id || index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{fmtDate(row.requested_at)}</TableCell>
                <TableCell>Rs. {fmtAmount(row.amount)}</TableCell>
                <TableCell>{row.utr || "-"}</TableCell>
                <TableCell>
                  {row.proof ? (
                    <Button
                      size="small"
                      href={row.proof}
                      target="_blank"
                      rel="noreferrer"
                      sx={{ textTransform: "none", fontWeight: 800 }}
                    >
                      View
                    </Button>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{fmtDate(row.decided_at)}</TableCell>
                <TableCell>{row.reject_reason || row.remarks || "-"}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={statusChipColor(row.status)}
                    label={row.status || "-"}
                    sx={{ fontWeight: 800 }}
                  />
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={8} sx={{ color: "#94a3b8", py: 3, textAlign: "center" }}>
                  No add money history found.
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
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const initialTab = searchParams.get("tab") === "add-money" ? "add-money" : "coupon";
  const [uploadRequests, setUploadRequests] = useState([]);
  const [tab, setTab] = useState(initialTab);
  const [voucherType, setVoucherType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const [txRes, voucherRes, uploadRes] = await Promise.all([
        API.get("/accounts/wallet/me/transactions/", {
          params: { page_size: 100, date_from: dateFrom || undefined, date_to: dateTo || undefined },
        }),
        API.get("/accounts/wallet/vouchers/"),
        listWalletUploadRequests({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
      ]);
      setTransactions(txRes?.data?.results || []);
      setVouchers(voucherRes?.data?.results || []);
      setUploadRequests(Array.isArray(uploadRes) ? uploadRes : uploadRes?.results || []);
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

  useEffect(() => {
    if (searchParams.get("tab") === "add-money") {
      setTab("add-money");
    }
  }, [searchParams]);

  const rows = useMemo(() => {
    const coupon = buildTransferRows(transactions, "MAIN_TO_COUPON", "COUPON_WALLET_CREDIT", "Coupon Pocket");
    const internal = buildTransferRows(transactions, "MAIN_TO_INTERNAL", "INTERNAL_WALLET_CREDIT", "Buy Package Pocket");
    const withdrawal = buildTransferRows(transactions, "MAIN_TO_WITHDRAWAL", "WITHDRAWAL_WALLET_CREDIT", "Withdrawal Pocket");
    return { coupon, internal, withdrawal };
  }, [transactions]);

  const filteredVouchers = useMemo(() => {
    const list = Array.isArray(vouchers) ? vouchers : [];
    if (!voucherType) return list;
    return list.filter((item) => String(item?.voucher_type || "").toUpperCase() === voucherType);
  }, [voucherType, vouchers]);

  return (
    <Box className="consumer-fintech-page" sx={{ px: { xs: 0.5, sm: 2 }, py: { xs: 1, sm: 2.5 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a" }}>
            Team History
          </Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Main wallet transfer and voucher transaction history.
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", sm: "auto" } }}>
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <Button variant="contained" onClick={load} sx={{ width: { xs: "100%", sm: "auto" } }}>Search</Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {loading && <LinearProgress sx={{ mb: 1 }} />}

      <Paper elevation={0} className="consumer-fintech-card" sx={{ borderRadius: 3, mb: 1.5 }}>
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
          <Tab value="add-money" label="Add Money" />
          <Tab value="vouchers" label="Vouchers" />
        </Tabs>
      </Paper>

      {tab === "vouchers" && (
        <Paper elevation={0} className="consumer-fintech-card" sx={{ p: 1, borderRadius: 3, mb: 1.5 }}>
          <Tabs
            value={voucherType}
            onChange={(_, v) => setVoucherType(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, fontWeight: 800, textTransform: "none" } }}
          >
            <Tab value="" label="All" />
            <Tab value="TRIZONE" label="Trizone" />
            <Tab value="ONLINE" label="Online" />
            <Tab value="NEAR_STORE" label="Near Store" />
            <Tab value="PACKAGE_PURCHASE" label="Package Purchase" />
          </Tabs>
        </Paper>
      )}

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
        {tab === "add-money" && <AddMoneyTable rows={uploadRequests} />}
        {tab === "vouchers" && <VoucherTable rows={filteredVouchers} />}
      </Stack>
    </Box>
  );
}
