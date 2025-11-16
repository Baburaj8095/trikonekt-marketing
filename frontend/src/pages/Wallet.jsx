import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  Divider,
  Chip,
  Stack,
  LinearProgress,
} from "@mui/material";
import { TextField, Button, Alert } from "@mui/material";
import API from "../api/api";

function fmtAmount(value) {
  const num = Number(value || 0);
  return num.toFixed(2);
}

function Amount({ value }) {
  const num = Number(value || 0);
  const color = num >= 0 ? "success.main" : "error.main";
  const sign = num >= 0 ? "+" : "";
  return (
    <Typography component="span" sx={{ color, fontWeight: 600 }}>
      {sign}
      {fmtAmount(num)}
    </Typography>
  );
}

function TxTypeChip({ type }) {
  let color = "default";
  if (type === "COMMISSION_CREDIT" || (type || "").endsWith("_CREDIT")) color = "success";
  if ((type || "").endsWith("_DEBIT")) color = "warning";
  return <Chip size="small" color={color} label={type || "TX"} />;
}

export default function Wallet() {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState("0.00");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [txs, setTxs] = useState([]);
  const [err, setErr] = useState("");

  // Withdrawals
  const [myWithdrawals, setMyWithdrawals] = useState([]);
  const [wdrErr, setWdrErr] = useState("");
  const [wdrSubmitting, setWdrSubmitting] = useState(false);
  const [wdrForm, setWdrForm] = useState({
    amount: "",
    method: "bank",
    bank_name: "",
    bank_account_number: "",
    ifsc_code: "",
  });
  const onWdrChange = (e) => setWdrForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const cooldownUntil = useMemo(() => {
    try {
      // list is ordered by -requested_at (backend)
      const last = (myWithdrawals || []).find((w) => String(w.status).toLowerCase() !== "rejected");
      if (!last || !last.requested_at) return null;
      const dt = new Date(last.requested_at);
      dt.setDate(dt.getDate() + 7);
      return dt;
    } catch {
      return null;
    }
  }, [myWithdrawals]);
  const onCooldown = Boolean(cooldownUntil && cooldownUntil > new Date());

  useEffect(() => {
    let mounted = true;
    async function fetchAll() {
      try {
        setLoading(true);
        setErr("");
        const [w, t, mw] = await Promise.all([
          API.get("/accounts/wallet/me/"),
          API.get("/accounts/wallet/me/transactions/"),
          API.get("/accounts/withdrawals/me/"),
        ]);
        if (!mounted) return;
        const bal = String(w?.data?.balance ?? "0.00");
        const upd = w?.data?.updated_at || null;
        const list = Array.isArray(t?.data) ? t.data : t?.data?.results || [];
        setBalance(bal);
        setUpdatedAt(upd);
        setTxs((list || []).slice(0, 100));
        const wlist = Array.isArray(mw?.data) ? mw.data : mw?.data?.results || [];
        setMyWithdrawals(wlist || []);
      } catch (e) {
        if (!mounted) return;
        setErr("Failed to load wallet. Please try again.");
        setTxs([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchAll();
    return () => {
      mounted = false;
    };
  }, []);

  async function submitWithdrawal(e) {
    e.preventDefault();
    setWdrErr("");
    if (onCooldown) return;
    const amtNum = Number(wdrForm.amount);
    if (!Number.isFinite(amtNum) || amtNum <= 0) {
      setWdrErr("Enter a valid amount.");
      return;
    }
    const payload = {
      amount: amtNum,
      method: "bank",
    };
    // Bank details optional here; backend will hydrate from KYC if missing
    if (wdrForm.bank_name) payload.bank_name = wdrForm.bank_name.trim();
    if (wdrForm.bank_account_number) payload.bank_account_number = wdrForm.bank_account_number.trim();
    if (wdrForm.ifsc_code) payload.ifsc_code = wdrForm.ifsc_code.trim().toUpperCase();
    try {
      setWdrSubmitting(true);
      await API.post("/accounts/withdrawals/", payload);
      // Refresh wallet, txs, withdrawals
      const [w, t, mw] = await Promise.all([
        API.get("/accounts/wallet/me/"),
        API.get("/accounts/wallet/me/transactions/"),
        API.get("/accounts/withdrawals/me/"),
      ]);
      const bal = String(w?.data?.balance ?? "0.00");
      const upd = w?.data?.updated_at || null;
      const list = Array.isArray(t?.data) ? t.data : t?.data?.results || [];
      const wlist = Array.isArray(mw?.data) ? mw.data : mw?.data?.results || [];
      setBalance(bal);
      setUpdatedAt(upd);
      setTxs((list || []).slice(0, 100));
      setMyWithdrawals(wlist || []);
      setWdrForm({
        amount: "",
        method: wdrForm.method,
        bank_name: "",
        bank_account_number: "",
        ifsc_code: "",
      });
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (e?.response?.data ? JSON.stringify(e.response.data) : "Failed to submit withdrawal.");
      setWdrErr(String(msg));
    } finally {
      setWdrSubmitting(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700, color: "#0C2D48" }}>
        Wallet
      </Typography>

      <Grid container spacing={{ xs: 2, sm: 2 }} sx={{ mx: { xs: -2, sm: 0 } }}>
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
              Current Balance
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, mt: 1 }}>
              ₹ {fmtAmount(balance)}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Updated: {updatedAt ? new Date(updatedAt).toLocaleString() : "-"}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 2, borderRadius: 2, minHeight: 120 }}>
            <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 1 }}>
              Request Withdrawal
            </Typography>
            {wdrErr ? <Alert severity="error" sx={{ mb: 1 }}>{wdrErr}</Alert> : null}
            {onCooldown ? (
              <Alert severity="warning" sx={{ mb: 1 }}>
                Only one withdrawal is allowed per week. Next available:{" "}
                {cooldownUntil ? cooldownUntil.toLocaleString() : "-"}
              </Alert>
            ) : null}
            <Box component="form" onSubmit={submitWithdrawal} sx={{ mb: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  label="Amount (₹)"
                  name="amount"
                  value={wdrForm.amount}
                  onChange={onWdrChange}
                  inputProps={{ inputMode: "decimal" }}
                  required
                />
                {/* Method fixed to Bank; UPI removed */}
                <TextField
                  fullWidth
                  size="small"
                  label="Method"
                  name="method"
                  value="bank"
                  disabled
                />
              </Stack>
              <Stack spacing={1} sx={{ mt: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Bank Name"
                  name="bank_name"
                  value={wdrForm.bank_name}
                  onChange={onWdrChange}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Account Number"
                  name="bank_account_number"
                  value={wdrForm.bank_account_number}
                  onChange={onWdrChange}
                  inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="IFSC Code"
                  name="ifsc_code"
                  value={wdrForm.ifsc_code}
                  onChange={onWdrChange}
                  inputProps={{ maxLength: 11, style: { textTransform: "uppercase" } }}
                />
              </Stack>
              <Button
                type="submit"
                variant="contained"
                disabled={onCooldown || wdrSubmitting}
                sx={{ mt: 1 }}
              >
                {wdrSubmitting ? "Requesting..." : "Request Withdrawal"}
              </Button>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 1 }}>
              Recent Activity
            </Typography>
            {loading ? (
              <LinearProgress />
            ) : err ? (
              <Typography variant="body2" color="error">
                {err}
              </Typography>
            ) : (txs || []).length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                No transactions yet.
              </Typography>
            ) : (
              <Box>
                {(txs || []).map((tx) => (
                  <Box key={tx.id} sx={{ py: 1.2 }}>
                    <Grid container spacing={{ xs: 1, sm: 1 }} sx={{ mx: { xs: -1, sm: 0 } }} alignItems="center">
                      <Grid item xs={12} sm={5} md={4}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TxTypeChip type={tx.type} />
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            {tx.source_type || "-"}
                          </Typography>
                        </Stack>
                      </Grid>
                      <Grid item xs={6} sm={3} md={3}>
                        <Typography variant="body2">
                          <Amount value={tx.amount} />
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={4} md={3}>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Bal: ₹ {fmtAmount(tx.balance_after)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {tx.created_at ? new Date(tx.created_at).toLocaleString() : ""}
                        </Typography>
                      </Grid>
                    </Grid>
                    {tx.meta ? (
                      <Typography variant="caption" sx={{ color: "text.disabled" }}>
                        {(() => {
                          try {
                            return JSON.stringify(tx.meta);
                          } catch {
                            return String(tx.meta);
                          }
                        })()}
                      </Typography>
                    ) : null}
                    <Divider sx={{ mt: 1.2 }} />
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
