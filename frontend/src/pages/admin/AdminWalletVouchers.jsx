import React, { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, LinearProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import API from "../../api/api";

function money(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export default function AdminWalletVouchers() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const res = await API.get("/admin/wallet-vouchers/", { params: { q, status, page_size: 100 } });
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

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>Voucher Maintenance</Typography>
      <Typography sx={{ color: "#64748b", fontSize: 13, mb: 2 }}>Created, used, expired, and cancelled wallet vouchers.</Typography>
      {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
      {loading && <LinearProgress sx={{ mb: 1 }} />}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField size="small" label="Search code/user" value={q} onChange={(e) => setQ(e.target.value)} fullWidth />
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
      <Stack spacing={1}>
        {rows.map((r) => (
          <Paper key={r.id} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
              <Box>
                <Typography sx={{ fontWeight: 900 }}>{r.code} - Rs. {money(r.amount)}</Typography>
                <Typography sx={{ fontSize: 12, color: "#64748b" }}>{r.voucher_type} by {r.creator_username} {r.assigned_to_username ? `to ${r.assigned_to_username}` : ""}</Typography>
                <Typography sx={{ fontSize: 12, color: "#64748b" }}>Expires {r.expires_at ? new Date(r.expires_at).toLocaleString() : "-"}</Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={r.status} color={r.status === "ACTIVE" ? "success" : r.status === "REDEEMED" ? "primary" : "default"} />
                {r.status === "ACTIVE" && <Button size="small" variant="outlined" color="error" onClick={() => cancelRefund(r.id)}>Cancel/Refund</Button>}
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
