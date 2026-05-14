import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Alert, Box, Button, Chip, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import API from "../../api/api";

function money(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export default function AdminWalletDetail() {
  const { userId } = useParams();
  const [wallet, setWallet] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        setErr("");
        const [w, l] = await Promise.all([
          API.get(`/admin/wallets/${userId}/`),
          API.get(`/admin/wallets/${userId}/ledger/`, { params: { page_size: 100 } }),
        ]);
        if (!alive) return;
        setWallet(w?.data || null);
        setLedger(l?.data?.results || []);
      } catch (e) {
        if (alive) setErr(e?.response?.data?.detail || "Failed to load wallet detail");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [userId]);

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>Wallet Detail</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>{wallet?.username || ""}</Typography>
        </Box>
        <Button component={Link} to="/admin/wallets" variant="outlined">Back</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
      {loading && <LinearProgress sx={{ mb: 1 }} />}
      {wallet && (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 2 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={`Total Rs. ${money(wallet.balance)}`} />
            <Chip label={`Main Rs. ${money(wallet.main_balance)}`} />
            <Chip label={`Withdrawal Rs. ${money(wallet.withdrawable_balance)}`} />
            <Chip label={`Coupon Rs. ${money(wallet.pockets?.coupon)}`} />
            <Chip label={`Self Package Rs. ${money(wallet.pockets?.self_package)}`} />
            <Chip label={`Shopping Rs. ${money(wallet.pockets?.shopping)}`} />
            <Chip label={`Package Coupon Rs. ${money(wallet.pockets?.package_purchase_coupon)}`} />
            <Chip label={`Direct Rs. ${money(wallet.pockets?.direct_benefit)}`} />
            <Chip label={`Level Rs. ${money(wallet.pockets?.level_benefit)}`} />
            <Chip label={`Charges Rs. ${money(wallet.pockets?.admin_service_charges)}`} />
          </Stack>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ p: 1.25, borderBottom: "1px solid #e2e8f0", fontWeight: 900 }}>Ledger</Box>
        {ledger.map((tx) => (
          <Stack key={tx.id} direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1} sx={{ p: 1.25, borderBottom: "1px solid #f1f5f9" }}>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{tx.type}</Typography>
              <Typography sx={{ color: "#64748b", fontSize: 12 }}>{tx.source_type || "-"} {tx.source_id ? `- ${tx.source_id}` : ""}</Typography>
            </Box>
            <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
              <Typography sx={{ fontWeight: 900, color: Number(tx.amount) < 0 ? "#dc2626" : "#15803d" }}>Rs. {money(tx.amount)}</Typography>
              <Typography sx={{ color: "#64748b", fontSize: 12 }}>{tx.created_at ? new Date(tx.created_at).toLocaleString() : ""}</Typography>
            </Box>
          </Stack>
        ))}
      </Paper>
    </Box>
  );
}
