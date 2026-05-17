import React, { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import API from "../../api/api";
import DataTable from "../../admin-panel/components/data/DataTable";

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function fmtDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function statusColor(value) {
  const v = String(value || "").toLowerCase();
  if (["approved", "completed", "success", "paid", "redeemed"].includes(v)) return "success";
  if (["pending", "earned"].includes(v)) return "warning";
  if (["failed", "rejected", "cancelled", "reversed"].includes(v)) return "error";
  return "default";
}

function DetailRow({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.75, borderBottom: "1px solid #f1f5f9" }}>
      <Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, color: "#0f172a", fontWeight: 700, textAlign: "right", overflowWrap: "anywhere" }}>{value || "-"}</Typography>
    </Stack>
  );
}

export default function AdminWalletLedger() {
  const [userQuery, setUserQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [users, setUsers] = useState([]);
  const [walletType, setWalletType] = useState("");
  const [txType, setTxType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedTx, setSelectedTx] = useState(null);

  async function searchUsers() {
    const res = await API.get("/admin/wallets/", { params: { q: userQuery, page_size: 50 } });
    const rows = res?.data?.results || [];
    setUsers(rows);
  }

  const fetcher = useCallback(
    async ({ page, pageSize, search, ordering }) => {
      const params = { page, page_size: pageSize };
      if (search) params.q = search;
      if (ordering) params.ordering = ordering;
      if (walletType) params.source_type = walletType;
      if (txType) params.type = txType;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const url = selectedUserId ? `/admin/wallets/${selectedUserId}/ledger/` : "/admin/wallets/ledger/";
      const res = await API.get(url, { params, timeout: 20000 });
      const data = res?.data || {};
      return {
        results: data.results || data || [],
        count: data.count || (Array.isArray(data.results) ? data.results.length : Array.isArray(data) ? data.length : 0),
      };
    },
    [dateFrom, dateTo, selectedUserId, txType, walletType]
  );

  const columns = useMemo(
    () => [
      { field: "id", headerName: "Transaction ID", width: 130 },
      { field: "type", headerName: "Transaction Type", minWidth: 190, flex: 1 },
      { field: "source_type", headerName: "Source", minWidth: 180, flex: 1 },
      {
        field: "amount",
        headerName: "Amount",
        width: 140,
        renderCell: (params) => {
          const amount = Number(params?.row?.amount || 0);
          return <span style={{ fontWeight: 900, color: amount < 0 ? "#dc2626" : "#15803d" }}>Rs. {money(amount)}</span>;
        },
      },
      {
        field: "net_amount",
        headerName: "Net Amount",
        width: 140,
        renderCell: (params) => `Rs. ${money(params?.row?.meta?.net_amount ?? params?.row?.net_amount ?? params?.row?.amount)}`,
      },
      {
        field: "admin_charge",
        headerName: "Charges",
        width: 130,
        renderCell: (params) => `Rs. ${money(params?.row?.meta?.admin_service_charge_amount ?? params?.row?.charges)}`,
      },
      {
        field: "status",
        headerName: "Status",
        width: 130,
        renderCell: (params) => <Chip size="small" label={params?.row?.status || "Completed"} color={statusColor(params?.row?.status || "completed")} />,
      },
      {
        field: "created_at",
        headerName: "Created Time",
        minWidth: 190,
        renderCell: (params) => fmtDate(params?.row?.created_at),
      },
      {
        field: "__actions",
        headerName: "Drill Down",
        width: 130,
        renderCell: (params) => (
          <Button size="small" variant="outlined" onClick={() => setSelectedTx(params?.row || null)}>
            View
          </Button>
        ),
      },
    ],
    []
  );

  const toolbar = (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <TextField select size="small" label="User" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} sx={{ minWidth: 220 }}>
        <MenuItem value="">All users</MenuItem>
        {users.map((row) => (
          <MenuItem key={row.user_id} value={row.user_id}>
            {row.username} {row.prefixed_id ? `(${row.prefixed_id})` : ""}
          </MenuItem>
        ))}
      </TextField>
      <TextField select size="small" label="Source Module" value={walletType} onChange={(e) => setWalletType(e.target.value)} sx={{ minWidth: 190 }}>
        <MenuItem value="">All</MenuItem>
        <MenuItem value="ADMIN">Admin Adjustment</MenuItem>
        <MenuItem value="ADMIN_MANUAL">Manual Approval</MenuItem>
        <MenuItem value="WALLET_UPLOAD">Add Money</MenuItem>
        <MenuItem value="WITHDRAWAL">Withdrawal</MenuItem>
        <MenuItem value="VOUCHER_CREATE">Voucher Creation</MenuItem>
        <MenuItem value="VOUCHER_REDEEM">Voucher Redemption</MenuItem>
        <MenuItem value="ECOUPON">Coupon/Package</MenuItem>
        <MenuItem value="SELF_250_PACK">Self Rebirth Pack</MenuItem>
        <MenuItem value="ORDER">Shopping/Order</MenuItem>
      </TextField>
      <TextField size="small" label="Type" value={txType} onChange={(e) => setTxType(e.target.value)} sx={{ minWidth: 180 }} />
      <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
      <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      <Button variant="contained" onClick={() => setRefreshKey((k) => k + 1)}>Apply</Button>
    </Stack>
  );

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1440, mx: "auto" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>Central Wallet Ledger</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            One admin table pattern for wallet movement, charges, GST/TDS fields, approval state, references, and audit drill-down.
          </Typography>
        </Box>
        <Button component={Link} to="/admin/wallet-command-center" variant="outlined">Command Center</Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField size="small" label="Search user first" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} fullWidth />
          <Button variant="contained" onClick={searchUsers} sx={{ minWidth: 130 }}>Search Users</Button>
        </Stack>
        <Typography sx={{ mt: 1, color: "#64748b", fontSize: 12 }}>
          Leave the user filter empty for the complete master ledger, or select a user for a focused wallet drill-down.
        </Typography>
      </Paper>

      <DataTable
        key={`${refreshKey}-${selectedUserId}`}
        columns={columns}
        fetcher={fetcher}
        toolbar={toolbar}
        checkboxSelection={false}
        density="standard"
        extraKey={`${walletType}-${txType}-${dateFrom}-${dateTo}-${selectedUserId}`}
      />

      <Drawer anchor="right" open={Boolean(selectedTx)} onClose={() => setSelectedTx(null)} PaperProps={{ sx: { width: { xs: "100%", sm: 460 }, p: 2 } }}>
        <Typography variant="h6" sx={{ fontWeight: 950 }}>Transaction Drill-Down</Typography>
        <Typography sx={{ color: "#64748b", fontSize: 13, mb: 1 }}>Ledger, references, deductions, and audit-ready metadata.</Typography>
        <Divider sx={{ mb: 1 }} />
        <DetailRow label="Transaction ID" value={selectedTx?.id} />
        <DetailRow label="Transaction Type" value={selectedTx?.type} />
        <DetailRow label="Wallet Source" value={selectedTx?.source_type} />
        <DetailRow label="Wallet Destination" value={selectedTx?.destination_wallet || selectedTx?.meta?.destination_wallet} />
        <DetailRow label="Amount" value={`Rs. ${money(selectedTx?.amount)}`} />
        <DetailRow label="Charges" value={`Rs. ${money(selectedTx?.meta?.admin_service_charge_amount || selectedTx?.charges)}`} />
        <DetailRow label="GST" value={`Rs. ${money(selectedTx?.gst || selectedTx?.meta?.gst)}`} />
        <DetailRow label="TDS" value={`Rs. ${money(selectedTx?.tds || selectedTx?.meta?.tds)}`} />
        <DetailRow label="Net Amount" value={`Rs. ${money(selectedTx?.meta?.net_amount ?? selectedTx?.net_amount ?? selectedTx?.amount)}`} />
        <DetailRow label="Status" value={selectedTx?.status || "Completed"} />
        <DetailRow label="Approval Status" value={selectedTx?.approval_status || selectedTx?.meta?.approval_status} />
        <DetailRow label="Gateway Ref" value={selectedTx?.payment_gateway_reference || selectedTx?.meta?.payment_gateway_reference} />
        <DetailRow label="UTR Number" value={selectedTx?.utr || selectedTx?.meta?.utr} />
        <DetailRow label="Created Time" value={fmtDate(selectedTx?.created_at)} />
        <DetailRow label="Approved By" value={selectedTx?.approved_by || selectedTx?.meta?.approved_by} />
        <DetailRow label="Remarks" value={selectedTx?.remarks || selectedTx?.note || selectedTx?.meta?.note} />
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontWeight: 900, mb: 0.75 }}>Audit Metadata</Typography>
          <Paper variant="outlined" sx={{ p: 1, borderRadius: 1, bgcolor: "#f8fafc", maxHeight: 180, overflow: "auto" }}>
            <Typography component="pre" sx={{ m: 0, fontSize: 12, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(selectedTx?.meta || {}, null, 2)}
            </Typography>
          </Paper>
        </Box>
      </Drawer>
    </Box>
  );
}
