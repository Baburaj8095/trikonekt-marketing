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
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination } from "@mui/material";

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
  const [balance, setBalance] = useState("0.00"); // legacy total (for backward compatibility)
  const [mainBalance, setMainBalance] = useState("0.00"); // gross earnings
  const [withdrawableBalance, setWithdrawableBalance] = useState("0.00"); // net (can withdraw)
  const [taxPercent, setTaxPercent] = useState("0");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [txs, setTxs] = useState([]);
  const [txPage, setTxPage] = useState(0);
  const [txPageSize, setTxPageSize] = useState(10);
  const [txCount, setTxCount] = useState(0);
  const [txLoading, setTxLoading] = useState(false);
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
        const wlist = Array.isArray(mw?.data) ? mw.data : mw?.data?.results || [];
        setMyWithdrawals(wlist || []);
        setKyc(kycRes?.data || { verified: false });
        await fetchTransactions(0, txPageSize);
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

  async function fetchTransactions(page = 0, pageSize = txPageSize) {
    try {
      setTxLoading(true);
      const res = await API.get("/accounts/wallet/me/transactions/", {
        params: { page: page + 1, page_size: pageSize },
      });
      const data = res?.data || {};
      const list = Array.isArray(data) ? data : data?.results || [];
      const count = typeof data?.count === "number" ? data.count : list.length;
      setTxs(list);
      setTxCount(count);
    } catch (e) {
      setErr("Failed to load transactions.");
      setTxs([]);
      setTxCount(0);
    } finally {
      setTxLoading(false);
    }
  }

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
      // Refresh wallet, txs, withdrawals
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
      await fetchTransactions(txPage, txPageSize);
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
              Main Wallet (Gross)
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
              ₹ {fmtAmount(mainBalance)}
            </Typography>

            <Divider sx={{ my: 1.5 }} />

            <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
              Withdrawable Wallet (Net)
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: "primary.main" }}>
              ₹ {fmtAmount(withdrawableBalance)}
            </Typography>

            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
              Tax Withholding: {String(taxPercent)}%
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

            <Divider sx={{ mb: 2 }} />

            <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 1 }}>
              Recent Activity
            </Typography>
            {txLoading ? (
              <LinearProgress />
            ) : err ? (
              <Typography variant="body2" color="error">{err}</Typography>
            ) : (
              <React.Fragment>
                <TableContainer sx={{ maxHeight: 420 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>TR Username</TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Full Name</TableCell>
                        <TableCell>Pincode</TableCell>
                        <TableCell align="right">Commission (₹)</TableCell>
                        <TableCell sx={{ display: { xs: "none", md: "table-cell" } }} align="right">Bal After (₹)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(txs || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              No transactions yet.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        (txs || []).map((tx) => (
                          <TableRow key={tx.id} hover>
                            <TableCell>
                              {tx.created_at ? new Date(tx.created_at).toLocaleString() : "-"}
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <TxTypeChip type={tx.type} />
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                  {tx.source_type || "-"}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>{tx.tr_username || "-"}</TableCell>
                            <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                              {tx.full_name || "-"}
                            </TableCell>
                            <TableCell>{tx.pincode || "-"}</TableCell>
                            <TableCell align="right">
                              <Amount value={tx.commission ?? tx.amount} />
                            </TableCell>
                            <TableCell sx={{ display: { xs: "none", md: "table-cell" } }} align="right">
                              ₹ {fmtAmount(tx.balance_after)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={txCount}
                  page={txPage}
                  onPageChange={(e, newPage) => {
                    setTxPage(newPage);
                    fetchTransactions(newPage, txPageSize);
                  }}
                  rowsPerPage={txPageSize}
                  onRowsPerPageChange={(e) => {
                    const newSize = parseInt(e.target.value, 10);
                    setTxPageSize(newSize);
                    setTxPage(0);
                    fetchTransactions(0, newSize);
                  }}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              </React.Fragment>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
