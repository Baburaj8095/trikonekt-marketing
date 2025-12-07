import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  Divider,
  Stack,
  LinearProgress,
} from "@mui/material";
import { TextField, Button, Alert } from "@mui/material";
import API from "../api/api";

function fmtAmount(value) {
  const num = Number(value || 0);
  return num.toFixed(2);
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
  const [balance, setBalance] = useState("0.00"); // legacy total (for backward compatibility)
  const [mainBalance, setMainBalance] = useState("0.00"); // gross earnings
  const [withdrawableBalance, setWithdrawableBalance] = useState("0.00"); // net (can withdraw)
  const [taxPercent, setTaxPercent] = useState("0");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [err, setErr] = useState("");
  const [autoBlock, setAutoBlock] = useState(null);
  const [breakdown, setBreakdown] = useState({ coupon_cost: "150.00", tds: "50.00", direct_ref_bonus: "50.00" });
  const [redeemPoints, setRedeemPoints] = useState({ self: 0, refer: 0 });
  const [nextBlock, setNextBlock] = useState({ completed_in_current_block: "0.00", remaining_to_next_block: "1000.00", progress_percent: 0 });
  const [kyc, setKyc] = useState({ verified: false });
  const [windowInfo, setWindowInfo] = useState(computeWeeklyWindowLocal());

  // Show Withdraw Wallet as Income minus 10% TDS (preview for UI display)
  const computedNetPreview = useMemo(() => {
    const gross = Number(mainBalance || 0);
    const tdsPct = 10; // fixed 10% TDS as per requirement
    const net = gross - (gross * tdsPct / 100);
    return net < 0 ? 0 : net;
  }, [mainBalance]);

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
    if (Number(withdrawableBalance) < 500) return "Minimum withdrawable balance ₹500 required";
    if (!windowInfo?.isOpen) return "Withdrawals are allowed only on Sunday 6:00 PM to 11:59 PM (IST)";
    if (inWindowCooldown) return "You have already requested a withdrawal in this week's window";
    return "";
  }, [kyc, withdrawableBalance, windowInfo, inWindowCooldown]);

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
        const [w, mw, kycRes] = await Promise.all([
          API.get("/accounts/wallet/me/"),
          API.get("/accounts/withdrawals/me/"),
          API.get("/accounts/kyc/me/"),
        ]);
        if (!mounted) return;
        const bal = String(w?.data?.balance ?? "0.00");
        const mainBal = String(w?.data?.main_balance ?? "0.00");
        const wdBal = String(w?.data?.withdrawable_balance ?? "0.00");
        const tax = String(w?.data?.tax_percent ?? "0");
        const upd = w?.data?.updated_at || null;
        setBalance(bal);
        setMainBalance(mainBal);
        setWithdrawableBalance(wdBal);
        setTaxPercent(tax);
        setUpdatedAt(upd);
        setAutoBlock(w?.data?.auto_block || null);
        setBreakdown(w?.data?.breakdown_per_block || { coupon_cost: "150.00", tds: "50.00", direct_ref_bonus: "50.00" });
        setRedeemPoints(w?.data?.redeem_points || { self: 0, refer: 0 });
        setNextBlock(w?.data?.next_block || { completed_in_current_block: "0.00", remaining_to_next_block: "1000.00", progress_percent: 0 });
        const wlist = Array.isArray(mw?.data) ? mw.data : mw?.data?.results || [];
        setMyWithdrawals(wlist || []);
        setKyc(kycRes?.data || { verified: false });
        setWindowInfo(computeWeeklyWindowLocal());
      } catch (e) {
        if (!mounted) return;
        setErr("Failed to load wallet. Please try again.");
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
    const maxAvail = Number(withdrawableBalance);
    if (amtNum > maxAvail) {
      setWdrErr(`Amount exceeds withdrawable balance (₹${fmtAmount(maxAvail)} available).`);
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
      // Refresh wallet and withdrawals after submitting
      const [w, mw] = await Promise.all([
        API.get("/accounts/wallet/me/"),
        API.get("/accounts/withdrawals/me/"),
      ]);
      const bal = String(w?.data?.balance ?? "0.00");
      const mainBal = String(w?.data?.main_balance ?? "0.00");
      const wdBal = String(w?.data?.withdrawable_balance ?? "0.00");
      const tax = String(w?.data?.tax_percent ?? "0");
      const upd = w?.data?.updated_at || null;
      const wlist = Array.isArray(mw?.data) ? mw.data : mw?.data?.results || [];
      setBalance(bal);
      setMainBalance(mainBal);
      setWithdrawableBalance(wdBal);
      setTaxPercent(tax);
      setUpdatedAt(upd);
      setMyWithdrawals(wlist || []);
      setAutoBlock(w?.data?.auto_block || null);
      setBreakdown(w?.data?.breakdown_per_block || { coupon_cost: "150.00", tds: "50.00", direct_ref_bonus: "50.00" });
      setRedeemPoints(w?.data?.redeem_points || { self: 0, refer: 0 });
      setNextBlock(w?.data?.next_block || { completed_in_current_block: "0.00", remaining_to_next_block: "1000.00", progress_percent: 0 });
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

      <Paper elevation={3} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
          Redeem Point Wallet
        </Typography>
        <Grid container spacing={1} sx={{ mt: 1 }}>
          <Grid item xs={6}>
            <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>Self</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{Number(redeemPoints?.self || 0)}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6}>
            <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>Refer</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{Number(redeemPoints?.refer || 0)}</Typography>
            </Paper>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={{ xs: 2, sm: 2 }}>
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
              Income Wallet
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
              ₹ {fmtAmount(mainBalance)}
            </Typography>
            {autoBlock ? (
              <Box sx={{ mt: 1 }}>
                <LinearProgress variant="determinate" value={Number(nextBlock?.progress_percent || 0)} />
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                  Completed in current ₹1000 block: ₹ {fmtAmount(nextBlock?.completed_in_current_block || "0")}
                  {" • "}Remaining: ₹ {fmtAmount(nextBlock?.remaining_to_next_block || "1000")}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                  Blocks applied: {autoBlock?.applied_blocks || 0} / {autoBlock?.total_blocks || 0} • Pending: {autoBlock?.pending_blocks || 0}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Per ₹1000 block deductions</Typography>
                <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
                  <Typography variant="caption">Self coupon: ₹{fmtAmount(breakdown?.coupon_cost || "150")}</Typography>
                  <Typography variant="caption">TDS: ₹{fmtAmount(breakdown?.tds || "50")}</Typography>
                  <Typography variant="caption">Direct refer bonus: ₹{fmtAmount(breakdown?.direct_ref_bonus || "50")}</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    Net to Withdraw: ₹{fmtAmount(1000 - Number(breakdown?.coupon_cost || 0) - Number(breakdown?.tds || 0) - Number(breakdown?.direct_ref_bonus || 0))}
                  </Typography>
                </Stack>
              </Box>
            ) : null}

            <Divider sx={{ my: 1.5 }} />

            <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
              Withdraw Wallet
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: "primary.main" }}>
              ₹ {fmtAmount(computedNetPreview)}
            </Typography>

            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
              Tax Withholding: 10%
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Updated: {updatedAt ? new Date(updatedAt).toLocaleString() : "-"}
            </Typography>

            <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mt: 0.5 }}>
              Total (Legacy): ₹ {fmtAmount(balance)}
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
            {Number(withdrawableBalance) < 500 ? (
              <Alert severity="warning" sx={{ mb: 1 }}>
                Minimum withdrawable balance ₹500 required to enable withdrawals. Short by ₹{(Math.max(0, 500 - Number(withdrawableBalance))).toFixed(2)}
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
                  helperText={`Available: ₹ ${fmtAmount(withdrawableBalance)}`}
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
                Withdrawals are debited only from your Withdrawable Wallet (Net). Bank details are captured in the KYC screen.
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
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
