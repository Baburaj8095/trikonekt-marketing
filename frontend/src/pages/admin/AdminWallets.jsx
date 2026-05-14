import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import API from "../../api/api";

const pockets = [
  ["coupon", "Coupon Pocket"],
  ["self_package", "Self Package Pocket"],
  ["withdrawal", "Withdrawal Pocket"],
  ["shopping", "Shopping Pocket"],
  ["package_purchase_coupon", "Package Coupon Wallet"],
];

function money(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export default function AdminWallets() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [adjust, setAdjust] = useState({ user_id: "", pocket: "main", action: "credit", amount: "", note: "" });

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const res = await API.get("/admin/wallets/", { params: { q, page_size: 50 } });
      setRows(res?.data?.results || []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load wallets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitAdjust() {
    try {
      setErr("");
      await API.post(`/admin/wallets/${adjust.user_id}/adjust/`, adjust);
      setAdjust((x) => ({ ...x, amount: "", note: "" }));
      await load();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Adjustment failed");
    }
  }

  const selected = useMemo(() => rows.find((r) => String(r.user_id) === String(adjust.user_id)), [rows, adjust.user_id]);

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>Wallets</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>All user wallet pockets, balances, and manual audited entries.</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button component={Link} to="/admin/wallet-vouchers" variant="outlined">Vouchers</Button>
          <Button component={Link} to="/admin/wallet-reconcile" variant="outlined">Reconcile</Button>
        </Stack>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
      {loading && <LinearProgress sx={{ mb: 1 }} />}

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField size="small" label="Search user" value={q} onChange={(e) => setQ(e.target.value)} fullWidth />
          <Button variant="contained" onClick={load} sx={{ minWidth: 120 }}>Search</Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 900, mb: 1 }}>Manual Wallet Entry</Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField select size="small" label="User" value={adjust.user_id} onChange={(e) => setAdjust((x) => ({ ...x, user_id: e.target.value }))} sx={{ minWidth: 220 }}>
            <MenuItem value="">Select user</MenuItem>
            {rows.map((r) => <MenuItem key={r.user_id} value={r.user_id}>{r.username} {r.prefixed_id ? `(${r.prefixed_id})` : ""}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Pocket" value={adjust.pocket} onChange={(e) => setAdjust((x) => ({ ...x, pocket: e.target.value }))} sx={{ minWidth: 190 }}>
            <MenuItem value="main">Main Wallet</MenuItem>
            {pockets.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Action" value={adjust.action} onChange={(e) => setAdjust((x) => ({ ...x, action: e.target.value }))} sx={{ minWidth: 120 }}>
            <MenuItem value="credit">Credit</MenuItem>
            <MenuItem value="debit">Debit</MenuItem>
          </TextField>
          <TextField size="small" label="Amount" type="number" value={adjust.amount} onChange={(e) => setAdjust((x) => ({ ...x, amount: e.target.value }))} />
          <TextField size="small" label="Reason" value={adjust.note} onChange={(e) => setAdjust((x) => ({ ...x, note: e.target.value }))} fullWidth />
          <Button variant="contained" disabled={!adjust.user_id || !adjust.amount} onClick={submitAdjust}>Apply</Button>
        </Stack>
        {selected && <Typography sx={{ mt: 1, fontSize: 12, color: "#64748b" }}>Selected: {selected.full_name || selected.username}</Typography>}
      </Paper>

      <Stack spacing={1}>
        {rows.map((r) => (
          <Paper key={r.user_id} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
              <Box>
                <Typography sx={{ fontWeight: 900 }}>{r.full_name || r.username}</Typography>
                <Typography sx={{ color: "#64748b", fontSize: 12 }}>{r.username} {r.prefixed_id ? `- ${r.prefixed_id}` : ""}</Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`Main Rs. ${money(r.main_balance)}`} />
                <Chip label={`Withdrawal Rs. ${money(r.withdrawable_balance)}`} />
                <Chip label={`Coupon Rs. ${money(r.pockets?.coupon)}`} />
                <Chip label={`Self Pkg Rs. ${money(r.pockets?.self_package)}`} />
                <Chip label={`Pkg Coupon Rs. ${money(r.pockets?.package_purchase_coupon)}`} />
                <Button component={Link} to={`/admin/wallets/${r.user_id}`} size="small" variant="outlined">Detail</Button>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
