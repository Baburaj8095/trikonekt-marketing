import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import { useNavigate } from "react-router-dom";
import API from "../../../api/api";

const COLORS = {
  page: "#f7f9ff",
  surface: "#ffffff",
  text: "#14213d",
  muted: "#64748b",
  border: "#e2e8f0",
  blue: "#2563eb",
  green: "#16a34a",
  orange: "#f97316",
  red: "#dc2626",
};

function money(value) {
  const num = Number(value || 0);
  return `₹${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return String(value);
  }
}

function statusColor(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return { bg: "#dcfce7", fg: "#166534" };
  if (s === "rejected") return { bg: "#fee2e2", fg: "#991b1b" };
  return { bg: "#fef3c7", fg: "#92400e" };
}

function getApiError(error) {
  const data = error?.response?.data;
  if (!data) return "Something went wrong. Please try again.";
  if (typeof data === "string") return data;
  if (data.detail) return String(data.detail);
  const firstKey = Object.keys(data)[0];
  const firstValue = firstKey ? data[firstKey] : null;
  if (Array.isArray(firstValue)) return firstValue.join(", ");
  if (firstValue) return String(firstValue);
  return JSON.stringify(data);
}

export default function WithdrawalHistory() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [wallet, setWallet] = useState(null);
  const [kyc, setKyc] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [form, setForm] = useState({ amount: "", note: "" });

  const withdrawable = Number(wallet?.withdrawable_balance || 0);
  const pendingTotal = useMemo(
    () =>
      withdrawals
        .filter((item) => String(item.status || "").toLowerCase() === "pending")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [withdrawals]
  );

  const loadData = async () => {
    try {
      setError("");
      setLoading(true);
      const [walletRes, withdrawalsRes, kycRes] = await Promise.all([
        API.get("/accounts/wallet/me/", { dedupe: "cancelPrevious" }),
        API.get("/accounts/withdrawals/me/", { dedupe: "cancelPrevious" }),
        API.get("/accounts/kyc/me/", { dedupe: "cancelPrevious" }).catch(() => ({ data: null })),
      ]);
      setWallet(walletRes?.data || {});
      const list = Array.isArray(withdrawalsRes?.data)
        ? withdrawalsRes.data
        : withdrawalsRes?.data?.results || [];
      setWithdrawals(list);
      setKyc(kycRes?.data || null);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const canSubmit = Number(form.amount || 0) > 0 && !submitting;

  const submitWithdrawal = async () => {
    const amount = Number(form.amount || 0);
    setError("");
    setSuccess("");
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid withdrawal amount.");
      return;
    }
    if (amount > withdrawable) {
      setError(`Amount cannot exceed your Withdrawal Wallet balance of ${money(withdrawable)}.`);
      return;
    }

    try {
      setSubmitting(true);
      await API.post("/accounts/withdrawals/", {
        amount,
        method: "bank",
        note: form.note,
      });
      setForm({ amount: "", note: "" });
      setSuccess("Withdrawal request submitted successfully. Admin approval is pending.");
      await loadData();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.page, py: { xs: 1.5, md: 3 } }}>
      <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2.5 } }}>
        <Stack spacing={2.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Box>
              <Typography sx={{ color: COLORS.text, fontWeight: 900, fontSize: { xs: "1.35rem", md: "1.9rem" } }}>
                Withdrawals
              </Typography>
              <Typography sx={{ color: COLORS.muted, fontWeight: 600, fontSize: { xs: "0.82rem", md: "0.95rem" } }}>
                Request bank withdrawal from your Withdrawal Wallet and track approval status.
              </Typography>
            </Box>
            <Button
              startIcon={<ArrowBackRoundedIcon />}
              onClick={() => navigate("/agency/franchise-wallet")}
              sx={{
                display: { xs: "none", sm: "inline-flex" },
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 800,
                border: `1px solid ${COLORS.border}`,
                color: COLORS.text,
                bgcolor: "#fff",
              }}
            >
              Wallet
            </Button>
          </Stack>

          {loading ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          {success ? <Alert severity="success">{success}</Alert> : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: "100%", borderRadius: 3, border: `1px solid ${COLORS.border}`, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.07)" }}>
                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" spacing={1.3}>
                      <Box sx={{ width: 44, height: 44, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "#dbeafe", color: COLORS.blue }}>
                        <AccountBalanceWalletRoundedIcon />
                      </Box>
                      <Box>
                        <Typography sx={{ color: COLORS.muted, fontWeight: 700, fontSize: "0.78rem" }}>
                          Withdrawal Wallet
                        </Typography>
                        <Typography sx={{ color: COLORS.blue, fontWeight: 950, fontSize: { xs: "1.45rem", md: "1.7rem" }, lineHeight: 1.1 }}>
                          {money(withdrawable)}
                        </Typography>
                      </Box>
                    </Stack>
                    <Divider />
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: COLORS.muted, fontWeight: 700, fontSize: "0.84rem" }}>Pending requests</Typography>
                        <Typography sx={{ color: COLORS.text, fontWeight: 900 }}>{money(pendingTotal)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: COLORS.muted, fontWeight: 700, fontSize: "0.84rem" }}>KYC status</Typography>
                        <Chip
                          size="small"
                          label={kyc?.verified ? "Verified" : "Required"}
                          sx={{
                            bgcolor: kyc?.verified ? "#dcfce7" : "#fee2e2",
                            color: kyc?.verified ? "#166534" : "#991b1b",
                            fontWeight: 900,
                          }}
                        />
                      </Stack>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={8}>
              <Card sx={{ height: "100%", borderRadius: 3, border: `1px solid ${COLORS.border}`, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.07)" }}>
                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <PaymentsRoundedIcon sx={{ color: COLORS.green }} />
                      <Box>
                        <Typography sx={{ color: COLORS.text, fontWeight: 900, fontSize: "1.05rem" }}>
                          New Withdrawal Request
                        </Typography>
                        <Typography sx={{ color: COLORS.muted, fontWeight: 600, fontSize: "0.82rem" }}>
                          Bank details are picked from verified KYC. Final payout happens after admin approval.
                        </Typography>
                      </Box>
                    </Stack>
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} sm={5}>
                        <TextField
                          label="Amount"
                          type="number"
                          value={form.amount}
                          onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                          fullWidth
                          inputProps={{ min: 0, max: withdrawable, step: "0.01" }}
                          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={7}>
                        <TextField
                          label="Note"
                          value={form.note}
                          onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                          fullWidth
                          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                        />
                      </Grid>
                    </Grid>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }}>
                      <Typography sx={{ color: COLORS.muted, fontWeight: 700, fontSize: "0.82rem" }}>
                        Available now: {money(withdrawable)}
                      </Typography>
                      <Button
                        onClick={submitWithdrawal}
                        disabled={!canSubmit}
                        sx={{
                          minWidth: 170,
                          borderRadius: 2,
                          py: 1,
                          bgcolor: COLORS.blue,
                          color: "#fff",
                          fontWeight: 900,
                          textTransform: "none",
                          "&:hover": { bgcolor: "#1d4ed8" },
                        }}
                      >
                        {submitting ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Submit Request"}
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card sx={{ borderRadius: 3, border: `1px solid ${COLORS.border}`, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)" }}>
            <CardContent sx={{ p: { xs: 1.5, md: 2.5 } }}>
              <Stack spacing={1.5}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <ReceiptLongRoundedIcon sx={{ color: COLORS.blue }} />
                  <Typography sx={{ color: COLORS.text, fontWeight: 900, fontSize: "1.05rem" }}>
                    Withdrawal History
                  </Typography>
                </Stack>

                {withdrawals.length ? (
                  <Stack spacing={1}>
                    {withdrawals.map((item) => {
                      const color = statusColor(item.status);
                      return (
                        <Card key={item.id} sx={{ borderRadius: 2, border: `1px solid ${COLORS.border}`, boxShadow: "none", bgcolor: "#fff" }}>
                          <CardContent sx={{ p: { xs: 1.3, md: 1.6 } }}>
                            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.2}>
                              <Box>
                                <Typography sx={{ color: COLORS.text, fontWeight: 950, fontSize: "1rem" }}>
                                  {money(item.amount)}
                                </Typography>
                                <Typography sx={{ color: COLORS.muted, fontWeight: 700, fontSize: "0.78rem" }}>
                                  Requested: {formatDate(item.requested_at)}
                                </Typography>
                                {item.payout_ref ? (
                                  <Typography sx={{ color: COLORS.muted, fontWeight: 700, fontSize: "0.78rem" }}>
                                    Payout ref: {item.payout_ref}
                                  </Typography>
                                ) : null}
                              </Box>
                              <Stack alignItems={{ xs: "flex-start", sm: "flex-end" }} spacing={0.7}>
                                <Chip
                                  size="small"
                                  label={String(item.status || "pending").toUpperCase()}
                                  sx={{ bgcolor: color.bg, color: color.fg, fontWeight: 900 }}
                                />
                                <Typography sx={{ color: COLORS.muted, fontWeight: 700, fontSize: "0.78rem" }}>
                                  {item.decided_at ? `Decided: ${formatDate(item.decided_at)}` : "Awaiting admin action"}
                                </Typography>
                              </Stack>
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                ) : (
                  <Box sx={{ py: 5, textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 2 }}>
                    <Typography sx={{ color: COLORS.text, fontWeight: 900 }}>No withdrawal requests yet</Typography>
                    <Typography sx={{ color: COLORS.muted, fontWeight: 600, fontSize: "0.86rem" }}>
                      Your submitted withdrawal requests will appear here.
                    </Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
