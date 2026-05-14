import React, { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, LinearProgress, Paper, Stack, TextField, Typography } from "@mui/material";
import API from "../../api/api";

function money(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export default function AdminWalletReconcile() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [mismatches, setMismatches] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const res = await API.get("/admin/wallets/reconcile/", { params: { q, limit: 200 } });
      setRows(res?.data?.results || []);
      setMismatches(res?.data?.mismatches || 0);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to reconcile wallets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>Wallet Reconcile</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>Compares stored wallet balance against ledger transaction totals.</Typography>
        </Box>
        <Chip label={`${mismatches} mismatches`} color={mismatches ? "error" : "success"} />
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
      {loading && <LinearProgress sx={{ mb: 1 }} />}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField size="small" label="Search user" value={q} onChange={(e) => setQ(e.target.value)} fullWidth />
          <Button variant="contained" onClick={load}>Run</Button>
        </Stack>
      </Paper>
      <Stack spacing={1}>
        {rows.map((r) => (
          <Paper key={r.user_id} variant="outlined" sx={{ p: 1.25, borderRadius: 2, borderColor: r.status === "OK" ? "#e2e8f0" : "#fca5a5" }}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
              <Box>
                <Typography sx={{ fontWeight: 900 }}>{r.full_name || r.username}</Typography>
                <Typography sx={{ color: "#64748b", fontSize: 12 }}>{r.username} {r.prefixed_id ? `- ${r.prefixed_id}` : ""}</Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`Stored Rs. ${money(r.balance)}`} />
                <Chip label={`Ledger Rs. ${money(r.ledger_total)}`} />
                <Chip label={`Diff Rs. ${money(r.balance_vs_ledger_diff)}`} color={r.status === "OK" ? "success" : "error"} />
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
