import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Alert, Box, Button, Chip, Divider, LinearProgress, Paper, Stack, Typography } from "@mui/material";
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
        <>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 2 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={`Total Rs. ${money(wallet.balance)}`} />
              <Chip label={`Main Rs. ${money(wallet.main_balance)}`} />
              <Chip label={`Withdrawal Rs. ${money(wallet.withdrawable_balance)}`} />
              <Chip label={`Coupon Rs. ${money(wallet.pockets?.coupon)}`} />
              <Chip label={`Self Package Rs. ${money(wallet.pockets?.self_package)}`} />
              <Chip label={`Reward Rs. ${money(wallet.pockets?.rewards || wallet.pockets?.reward)}`} />
              <Chip label={`Package Coupon Rs. ${money(wallet.pockets?.package_purchase_coupon)}`} />
              <Chip label={`Direct Rs. ${money(wallet.pockets?.direct_benefit)}`} />
              <Chip label={`Level Rs. ${money(wallet.pockets?.level_benefit)}`} />
              <Chip label={`Charges Rs. ${money(wallet.pockets?.admin_service_charges)}`} />
            </Stack>
          </Paper>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.2fr 0.8fr" }, gap: 1.5, mb: 2 }}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 900, mb: 1 }}>Pocket-Level Finance Accounts</Typography>
              <Stack spacing={1}>
                {(wallet.finance_accounts || []).map((account) => (
                  <Paper key={account.id} variant="outlined" sx={{ p: 1, borderRadius: 1, bgcolor: "#f8fafc" }}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                      <Box>
                        <Typography sx={{ fontWeight: 900, fontSize: 13 }}>{account.wallet_type}</Typography>
                        <Typography sx={{ color: "#64748b", fontSize: 12 }}>{account.status}</Typography>
                      </Box>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={`Credits Rs. ${money(account.total_credits)}`} color="success" />
                        <Chip size="small" label={`Debits Rs. ${money(account.total_debits)}`} color="warning" />
                        <Chip size="small" label={`Current Rs. ${money(account.current_balance)}`} />
                        <Chip size="small" label={`Locked Rs. ${money(account.locked_balance)}`} />
                        <Chip size="small" label={`Pending Rs. ${money(account.pending_balance)}`} />
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
                {!wallet.finance_accounts?.length ? <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>No structured finance accounts yet.</Typography> : null}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 900, mb: 1 }}>Income & Module Breakdown</Typography>
              <Stack spacing={0.75}>
                {(wallet.income_breakdown || []).map((row) => (
                  <Stack key={row.category} direction="row" justifyContent="space-between" sx={{ py: 0.5, borderBottom: "1px solid #f1f5f9" }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{row.category}</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 900 }}>Rs. {money(row.total)} ({row.count})</Typography>
                  </Stack>
                ))}
                {!wallet.income_breakdown?.length ? <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>No structured finance transactions yet.</Typography> : null}
              </Stack>
            </Paper>
          </Box>
        </>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ p: 1.25, borderBottom: "1px solid #e2e8f0", fontWeight: 900 }}>Linked Ledger Entries & Transaction Timeline</Box>
        {ledger.map((tx) => (
          <Stack key={tx.id} direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1} sx={{ p: 1.25, borderBottom: "1px solid #f1f5f9" }}>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{tx.transaction_ref || tx.id} - {tx.category || tx.type}</Typography>
              <Typography sx={{ color: "#64748b", fontSize: 12 }}>{tx.source_module || tx.source_type || "-"} {tx.source_id ? `- ${tx.source_id}` : ""}</Typography>
              <Typography sx={{ color: "#64748b", fontSize: 12 }}>{tx.wallet_type || ""}</Typography>
            </Box>
            <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
              <Typography sx={{ fontWeight: 900, color: Number(tx.net_amount ?? tx.amount) < 0 ? "#dc2626" : "#15803d" }}>Rs. {money(tx.net_amount ?? tx.amount)}</Typography>
              <Typography sx={{ color: "#64748b", fontSize: 12 }}>{tx.created_at ? new Date(tx.created_at).toLocaleString() : ""}</Typography>
            </Box>
          </Stack>
        ))}
      </Paper>

      {wallet?.audit_timeline?.length ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", mt: 2 }}>
          <Box sx={{ p: 1.25, borderBottom: "1px solid #e2e8f0", fontWeight: 900 }}>Audit & Activity Timeline</Box>
          {wallet.audit_timeline.map((event) => (
            <Box key={event.id} sx={{ p: 1.25, borderBottom: "1px solid #f1f5f9" }}>
              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                <Box>
                  <Typography sx={{ fontWeight: 900, fontSize: 13 }}>{event.action}</Typography>
                  <Typography sx={{ color: "#64748b", fontSize: 12 }}>{event.module} / {event.reference_id || "-"}</Typography>
                </Box>
                <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{event.actor || "System"}</Typography>
                  <Typography sx={{ color: "#64748b", fontSize: 12 }}>{event.created_at ? new Date(event.created_at).toLocaleString() : ""}</Typography>
                </Box>
              </Stack>
              <Divider sx={{ my: 0.75 }} />
              <Typography sx={{ color: "#64748b", fontSize: 12 }}>{event.ip_address || "-"} {event.device ? `- ${event.device}` : ""}</Typography>
            </Box>
          ))}
        </Paper>
      ) : null}
    </Box>
  );
}
