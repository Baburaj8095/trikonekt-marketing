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
  const [mlmIncomeType, setMlmIncomeType] = useState("");
  const [status, setStatus] = useState("");
  const [sourceModule, setSourceModule] = useState("");
  const [reference, setReference] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedTx, setSelectedTx] = useState(null);

  async function exportCsv() {
    const params = { export: "csv" };
    if (walletType) params.source_type = walletType;
    if (txType) params.category = txType;
    if (mlmIncomeType) params.mlm_income_type = mlmIncomeType;
    if (status) params.status = status;
    if (sourceModule) params.source_module = sourceModule;
    if (reference) params.q = reference;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    const url = selectedUserId ? `/admin/wallets/${selectedUserId}/ledger/` : "/admin/wallets/ledger/";
    const res = await API.get(url, { params, responseType: "blob", timeout: 60000 });
    const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = "finance-ledger.csv";
    a.click();
    window.URL.revokeObjectURL(blobUrl);
  }

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
      if (txType) params.category = txType;
      if (mlmIncomeType) params.mlm_income_type = mlmIncomeType;
      if (status) params.status = status;
      if (sourceModule) params.source_module = sourceModule;
      if (reference) params.q = `${params.q || ""} ${reference}`.trim();
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
    [dateFrom, dateTo, mlmIncomeType, reference, selectedUserId, sourceModule, status, txType, walletType]
  );

  const columns = useMemo(
    () => [
      { field: "transaction_ref", headerName: "Transaction ID", minWidth: 190, flex: 1 },
      { field: "username", headerName: "User", minWidth: 150, flex: 1 },
      { field: "wallet_type", headerName: "Wallet Type", minWidth: 190, flex: 1 },
      { field: "category", headerName: "Transaction Type", minWidth: 170, flex: 1 },
      { field: "source_module", headerName: "Source Module", minWidth: 170, flex: 1 },
      {
        field: "gross_amount",
        headerName: "Gross",
        width: 140,
        renderCell: (params) => {
          const amount = Number(params?.row?.gross_amount ?? params?.row?.amount ?? 0);
          return <span style={{ fontWeight: 900, color: amount < 0 ? "#dc2626" : "#15803d" }}>Rs. {money(amount)}</span>;
        },
      },
      {
        field: "service_charge",
        headerName: "Service Charge",
        width: 145,
        renderCell: (params) => `Rs. ${money(params?.row?.service_charge ?? params?.row?.charges_amount)}`,
      },
      {
        field: "gst_amount",
        headerName: "GST",
        width: 120,
        renderCell: (params) => `Rs. ${money(params?.row?.gst_amount)}`,
      },
      {
        field: "tds_amount",
        headerName: "TDS",
        width: 120,
        renderCell: (params) => `Rs. ${money(params?.row?.tds_amount)}`,
      },
      {
        field: "net_amount",
        headerName: "Net Amount",
        width: 140,
        renderCell: (params) => `Rs. ${money(params?.row?.net_amount ?? params?.row?.amount)}`,
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
        <MenuItem value="MAIN">Main Wallet</MenuItem>
        <MenuItem value="COUPON_POCKET">Coupon Wallet</MenuItem>
        <MenuItem value="WITHDRAWAL_WALLET">Withdrawal Wallet</MenuItem>
        <MenuItem value="REWARD_WALLET">Reward Wallet</MenuItem>
        <MenuItem value="SELF_PACKAGE_POCKET">Self Package Wallet</MenuItem>
        <MenuItem value="ADD_MONEY_POCKET">Add Money Pocket</MenuItem>
        <MenuItem value="PACKAGE_PURCHASE_COUPON">Package Coupon</MenuItem>
        <MenuItem value="GIFT_CARD">Gift Cards</MenuItem>
        <MenuItem value="ECOMMERCE">E-Commerce</MenuItem>
      </TextField>
      <TextField select size="small" label="Category" value={txType} onChange={(e) => setTxType(e.target.value)} sx={{ minWidth: 190 }}>
        <MenuItem value="">All</MenuItem>
        {["ADD_MONEY", "WITHDRAWAL", "WALLET_TRANSFER", "VOUCHER_CREATE", "VOUCHER_REDEEM", "PACKAGE_PURCHASE", "MLM_INCOME", "SPONSOR_INCOME", "MATRIX_INCOME", "REWARD_DISTRIBUTION", "GST_INVOICE", "ADMIN_ADJUSTMENT", "REFUND", "SETTLEMENT"].map((v) => (
          <MenuItem key={v} value={v}>{v}</MenuItem>
        ))}
      </TextField>
      <TextField size="small" label="MLM income type" value={mlmIncomeType} onChange={(e) => setMlmIncomeType(e.target.value)} sx={{ minWidth: 170 }} />
      <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 150 }}>
        <MenuItem value="">All</MenuItem>
        {["PENDING", "PROCESSING", "COMPLETED", "FAILED", "REVERSED", "CANCELLED"].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
      </TextField>
      <TextField size="small" label="Module / package" value={sourceModule} onChange={(e) => setSourceModule(e.target.value)} sx={{ minWidth: 170 }} />
      <TextField size="small" label="Voucher / withdrawal / ref" value={reference} onChange={(e) => setReference(e.target.value)} sx={{ minWidth: 190 }} />
      <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
      <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      <Button variant="contained" onClick={() => setRefreshKey((k) => k + 1)}>Apply</Button>
      <Button variant="outlined" onClick={exportCsv}>Export</Button>
    </Stack>
  );

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1440, mx: "auto" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>Central Wallet Ledger</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Central finance transaction explorer for wallet movement, GST/TDS, service charges, references, approval state, and linked ledger flow.
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
        extraKey={`${walletType}-${txType}-${mlmIncomeType}-${status}-${sourceModule}-${reference}-${dateFrom}-${dateTo}-${selectedUserId}`}
      />

      <Drawer anchor="right" open={Boolean(selectedTx)} onClose={() => setSelectedTx(null)} PaperProps={{ sx: { width: { xs: "100%", sm: 460 }, p: 2 } }}>
        <Typography variant="h6" sx={{ fontWeight: 950 }}>Transaction Drill-Down</Typography>
        <Typography sx={{ color: "#64748b", fontSize: 13, mb: 1 }}>Ledger, references, deductions, and audit-ready metadata.</Typography>
        <Divider sx={{ mb: 1 }} />
        <DetailRow label="Transaction ID" value={selectedTx?.transaction_ref || selectedTx?.id} />
        <DetailRow label="User" value={selectedTx?.username} />
        <DetailRow label="Wallet Type" value={selectedTx?.wallet_type} />
        <DetailRow label="Transaction Type" value={selectedTx?.category || selectedTx?.type} />
        <DetailRow label="Source Module" value={selectedTx?.source_module || selectedTx?.source_type} />
        <DetailRow label="Source / Destination" value={selectedTx?.source_destination || selectedTx?.destination_module} />
        <DetailRow label="Gross Amount" value={`Rs. ${money(selectedTx?.gross_amount ?? selectedTx?.amount)}`} />
        <DetailRow label="Service Charge" value={`Rs. ${money(selectedTx?.service_charge || selectedTx?.charges_amount)}`} />
        <DetailRow label="GST" value={`Rs. ${money(selectedTx?.gst_amount || selectedTx?.metadata?.gst)}`} />
        <DetailRow label="TDS" value={`Rs. ${money(selectedTx?.tds_amount || selectedTx?.metadata?.tds)}`} />
        <DetailRow label="Net Amount" value={`Rs. ${money(selectedTx?.net_amount ?? selectedTx?.amount)}`} />
        <DetailRow label="Before Balance" value={`Rs. ${money(selectedTx?.before_balance)}`} />
        <DetailRow label="After Balance" value={`Rs. ${money(selectedTx?.after_balance)}`} />
        <DetailRow label="Status" value={selectedTx?.status || "Completed"} />
        <DetailRow label="Approval Status" value={selectedTx?.approval_status || selectedTx?.metadata?.approval_status} />
        <DetailRow label="Gateway Ref" value={selectedTx?.payment_gateway_reference || selectedTx?.metadata?.payment_gateway_reference} />
        <DetailRow label="UTR Number" value={selectedTx?.utr_number || selectedTx?.metadata?.utr} />
        <DetailRow label="Reference IDs" value={[selectedTx?.flow_id, selectedTx?.source_id, selectedTx?.reference_id].filter(Boolean).join(" / ")} />
        <DetailRow label="Created Time" value={fmtDate(selectedTx?.created_at)} />
        <DetailRow label="Created By" value={selectedTx?.created_by} />
        <DetailRow label="Approved By" value={selectedTx?.approved_by || selectedTx?.metadata?.approved_by} />
        <DetailRow label="Remarks" value={selectedTx?.remarks || selectedTx?.note || selectedTx?.metadata?.note} />
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontWeight: 900, mb: 0.75 }}>Linked Transaction Flow</Typography>
          <Stack spacing={0.75}>
            {(selectedTx?.linked_transaction_flow || []).map((step, index) => (
              <Paper key={`${step.label}-${index}`} variant="outlined" sx={{ p: 1, borderRadius: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 900 }}>{index + 1}. {step.label}</Typography>
                <Typography sx={{ fontSize: 12, color: "#64748b" }}>{step.status} {step.reference ? `- ${step.reference}` : ""}</Typography>
              </Paper>
            ))}
          </Stack>
        </Box>
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontWeight: 900, mb: 0.75 }}>Audit Metadata</Typography>
          <Paper variant="outlined" sx={{ p: 1, borderRadius: 1, bgcolor: "#f8fafc", maxHeight: 180, overflow: "auto" }}>
            <Typography component="pre" sx={{ m: 0, fontSize: 12, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(selectedTx?.metadata || selectedTx?.meta || {}, null, 2)}
            </Typography>
          </Paper>
        </Box>
      </Drawer>
    </Box>
  );
}
