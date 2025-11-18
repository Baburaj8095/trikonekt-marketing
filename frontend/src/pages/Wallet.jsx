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

function computeWeeklyWindowLocal() {
  // Compute current week's Sunday 6:00 PM to 11:59 PM window using local time
  const now = new Date();

  // JS weekday: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const day = now.getDay();

  // Days since this week's Sunday
  const daysSinceSun = ((day - 0) + 7) % 7;

  // Get this week's Sunday date
  const currentSun = new Date(now);
  currentSun.setHours(0, 0, 0, 0);
  currentSun.setDate(currentSun.getDate() - daysSinceSun);

  // Window start/end (local time)
  const currentStart = new Date(currentSun);
  currentStart.setHours(18, 0, 0, 0); // 6:00 PM
  const currentEnd = new Date(currentSun);
  currentEnd.setHours(23, 59, 59, 999); // 11:59 PM

  // Open state
  const isOpen = now >= currentStart && now < currentEnd;

  // Next window start
  let nextStart = new Date(currentStart);
  if (now >= currentEnd) {
    // next week's Sunday
    nextStart = new Date(currentStart);
    nextStart.setDate(nextStart.getDate() + 7);
  } else if (now < currentStart) {
    nextStart = new Date(currentStart);
  }

  return { isOpen, nextWindowAt: nextStart, currentStart, currentEnd };
}

export default function Wallet() {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState("0.00");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [txs, setTxs] = useState([]);
  const [err, setErr] = useState("");
  const [kyc, setKyc] = useState({ verified: false });
  const [windowInfo, setWindowInfo] = useState(computeWeeklyWindowLocal());

  // Withdrawals
  const [myWithdrawals, setMyWithdrawals] = useState([]);
  const [wdrErr, setWdrErr] = useState("");
  const [wdrSubmitting, setWdrSubmitting] = useState(false);
  const [wdrForm, setWdrForm] = useState({
    amount: "",
    method: "bank",
  });
  const onWdrChange = (e) => setWdrForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const inWindowCooldown = useMemo(() => {
    const wi = windowInfo;
    if (!wi || !wi.currentStart || !wi.currentEnd) return false;
    try {
      return (myWithdrawals || []).some((w) => {
        const status = String(w.status || "").toLowerCase();
        if (status === "rejected") return false;
        const dt = w.requested_at ? new Date(w.requested_at) : null;
        return dt && dt >= wi.currentStart && dt < wi.currentEnd;
      });
    } catch {
      return false;
    }
  }, [myWithdrawals, windowInfo]);

  const disableReason = useMemo(() => {
    if (!kyc?.verified) return "KYC verification required";
    if (Number(balance) < 500) return "Minimum balance ₹500 required";
    if (!windowInfo?.isOpen) return "Withdrawals are allowed only on Sunday 6:00 PM to 11:59 PM (IST)";
    if (inWindowCooldown) return "You have already requested a withdrawal in this week's window";
    return "";
  }, [kyc, balance, windowInfo, inWindowCooldown]);

  useEffect(() => {
    const id = setInterval(() => setWindowInfo(computeWeeklyWindowLocal()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function fetchAll() {
      try {
        setLoading(true);
        setErr("");
        const [w, t, mw, kycRes] = await Promise.all([
          API.get("/accounts/wallet/me/"),
          API.get("/accounts/wallet/me/transactions/"),
          API.get("/accounts/withdrawals/me/"),
          API.get("/accounts/kyc/me/"),
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
        setKyc(kycRes?.data || { verified: false });
        setWindowInfo(computeWeeklyWindowLocal());
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
    if (disableReason) {
      setWdrErr(disableReason);
      return;
    }
    const amtNum = Number(wdrForm.amount);
    if (!Number.isFinite(amtNum) || amtNum <= 0) {
      setWdrErr("Enter a valid amount.");
      return;
    }
    const payload = {
      amount: amtNum,
      method: "bank",
    };
    // Bank details are captured from KYC; not collected on this screen.
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
    <Box sx={{ maxWidth: 1000, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700, color: "#0C2D48" }}>
        Wallet
      </Typography>

      <Grid container spacing={{ xs: 2, sm: 2 }}>
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
            {!kyc?.verified ? (
              <Alert severity="error" sx={{ mb: 1 }}>
                KYC verification required to request withdrawal. Please complete KYC in the KYC section.
              </Alert>
            ) : null}
            {Number(balance) < 500 ? (
              <Alert severity="warning" sx={{ mb: 1 }}>
                Minimum balance ₹500 required to enable withdrawals. Short by ₹{(Math.max(0, 500 - Number(balance))).toFixed(2)}
              </Alert>
            ) : null}
            {!windowInfo?.isOpen ? (
              <Alert severity="info" sx={{ mb: 1 }}>
                Withdrawals open on Sunday between 6:00 PM and 11:59 PM (IST).{" "}
                Next window: {windowInfo?.nextWindowAt ? windowInfo.nextWindowAt.toLocaleString() : "-"}
              </Alert>
            ) : null}
            {inWindowCooldown ? (
              <Alert severity="warning" sx={{ mb: 1 }}>
                You have already requested a withdrawal in this week's window.
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
              <Alert severity="info" sx={{ mt: 1 }}>
                Bank details are captured in the KYC screen. Ensure your KYC bank details are correct before requesting a withdrawal.
              </Alert>
              <Button
                type="submit"
                variant="contained"
                disabled={Boolean(disableReason) || wdrSubmitting}
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
                    <Grid container spacing={{ xs: 1, sm: 1 }} alignItems="center">
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
                      <Typography variant="caption" sx={{ color: "text.disabled", wordBreak: "break-word", whiteSpace: "normal" }}>
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
