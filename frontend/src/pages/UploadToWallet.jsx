import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import normalizeMediaUrl from "../utils/media";
import API, { createWalletUploadRequest, getEcouponStoreBootstrap } from "../api/api";
import { useNavigate } from "react-router-dom";
import { C, R, S } from "../theme/tokens";

const PRESET_AMOUNTS = [500, 1000, 2000, 5000, 10000];

function readStoredUser() {
  try {
    const raw =
      localStorage.getItem("user_user") ||
      sessionStorage.getItem("user_user") ||
      localStorage.getItem("user") ||
      sessionStorage.getItem("user");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function UploadToWallet() {
  const navigate = useNavigate();
  const storedUser = useMemo(() => readStoredUser(), []);

  const [loading, setLoading] = useState(true);
  const [screenError, setScreenError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [profile, setProfile] = useState(null);
  const [copiedUpi, setCopiedUpi] = useState(false);

  const [form, setForm] = useState({
    amount: "",
    utr: "",
    bill: null,
  });
  const [fileInputKey, setFileInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setScreenError("");

        const [boot, profileRes] = await Promise.allSettled([
          getEcouponStoreBootstrap(),
          API.get("/accounts/profile/"),
        ]);

        if (!mounted) return;

        if (boot.status === "fulfilled") {
          setPaymentConfig(boot.value?.payment_config || null);
        }

        if (profileRes.status === "fulfilled") {
          setProfile(profileRes.value?.data || null);
        }
      } catch {
        if (!mounted) return;
        setScreenError("Failed to load upload to wallet details.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const consumerId =
    storedUser?.username ||
    profile?.username ||
    profile?.phone ||
    "-";

  const consumerName =
    storedUser?.full_name ||
    profile?.full_name ||
    storedUser?.name ||
    "Consumer";

  const billName = form.bill?.name || "";
  const amountValue = Number(form.amount);
  const canSubmit = Number.isFinite(amountValue) && amountValue > 0 && Boolean(form.bill);

  const onChange = (field) => (event) => {
    const value = event?.target?.value ?? "";
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const setPreset = (amt) => {
    setForm((prev) => ({ ...prev, amount: String(amt) }));
  };

  const copyUpiId = async () => {
    if (!paymentConfig?.upi_id) return;
    try {
      await navigator.clipboard.writeText(paymentConfig.upi_id);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    } catch (_) {}
  };

  const onFileChange = (event) => {
    const file = event?.target?.files?.[0] || null;
    setForm((prev) => ({ ...prev, bill: file }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setScreenError("");
    setSuccessMsg("");

    if (!String(form.amount || "").trim()) {
      setScreenError("Please enter the amount.");
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setScreenError("Please enter a valid amount greater than 0.");
      return;
    }

    if (!form.bill) {
      setScreenError("Please upload the bill or payment screenshot.");
      return;
    }

    setSubmitting(true);
    try {
      await createWalletUploadRequest({
        amount: String(amount),
        utr: String(form.utr || "").trim(),
        proof: form.bill,
      });
      setSuccessMsg("Payment request submitted successfully");
      setSuccessOpen(true);
      setForm({ amount: "", utr: "", bill: null });
      setFileInputKey((prev) => prev + 1);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const amountErr = err?.response?.data?.amount?.[0];
      const utrErr = err?.response?.data?.utr?.[0];
      const proofErr = err?.response?.data?.proof?.[0];
      setScreenError(
        detail ||
          amountErr ||
          utrErr ||
          proofErr ||
          err?.message ||
          "Failed to submit upload request."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", px: { xs: 2, sm: 3 }, py: 2.5, pb: 10 }}>
      {/* Header */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2.5 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: C.text, letterSpacing: "-0.5px" }}>
            Add Money
          </Typography>
          <Typography variant="body2" sx={{ color: C.textSecondary, mt: 0.5 }}>
            Upload payment screenshot to deposit funds to wallet
          </Typography>
        </Box>

        <Button
          variant="outlined"
          size="small"
          startIcon={<HistoryRoundedIcon />}
          onClick={() => navigate("/user/team-history?tab=add-money")}
          sx={{
            borderRadius: `${R.md}px`,
            borderColor: C.border,
            color: C.text,
            fontWeight: 700,
            textTransform: "none",
            "&:hover": { borderColor: C.primary, bgcolor: C.primaryLight },
          }}
        >
          History
        </Button>
      </Stack>

      {screenError ? (
        <Alert severity="error" sx={{ mb: 2, borderRadius: `${R.md}px` }} onClose={() => setScreenError("")}>
          {screenError}
        </Alert>
      ) : null}

      {/* Main Add Money Card */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          borderRadius: `${R.lg}px`,
          bgcolor: C.surface,
          border: `1.5px solid ${C.border}`,
          boxShadow: S.card,
        }}
      >
        {loading ? (
          <Box sx={{ py: 6, display: "grid", placeItems: "center" }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {/* Account Info Pill */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: `${R.md}px`,
                bgcolor: C.bg,
                border: `1px solid ${C.border}`,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography sx={{ fontSize: 12, color: C.textSecondary, fontWeight: 600 }}>
                    DEPOSIT ACCOUNT
                  </Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 15, color: C.text }}>
                    {consumerName}
                  </Typography>
                </Box>
                <Chip
                  label={consumerId}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    bgcolor: C.primaryLight,
                    color: C.primary,
                    borderRadius: `${R.sm}px`,
                  }}
                />
              </Stack>
            </Paper>

            <Box component="form" onSubmit={onSubmit}>
              <Stack spacing={2.5}>
                {/* Amount Input */}
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, color: C.text, mb: 1 }}>
                    Enter Amount
                  </Typography>
                  <TextField
                    placeholder="₹ 0"
                    size="medium"
                    fullWidth
                    type="number"
                    value={form.amount}
                    onChange={onChange("amount")}
                    inputProps={{ min: 1, step: "1" }}
                    sx={{ mb: 1.5 }}
                  />

                  {/* Preset Amount Chips (Screen 9) */}
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {PRESET_AMOUNTS.map((amt) => {
                      const isSelected = String(form.amount) === String(amt);
                      return (
                        <Chip
                          key={amt}
                          label={`+₹${amt.toLocaleString("en-IN")}`}
                          onClick={() => setPreset(amt)}
                          sx={{
                            fontWeight: 700,
                            fontSize: 13,
                            borderRadius: `${R.md}px`,
                            py: 2,
                            px: 0.5,
                            cursor: "pointer",
                            bgcolor: isSelected ? C.primary : C.bg,
                            color: isSelected ? "#ffffff" : C.text,
                            border: `1px solid ${isSelected ? C.primary : C.border}`,
                            "&:hover": {
                              bgcolor: isSelected ? C.primaryDark : C.primaryLight,
                            },
                          }}
                        />
                      );
                    })}
                  </Stack>
                </Box>

                {/* QR Scanner Section (Screen 9) */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: `${R.md}px`,
                    border: `1.5px dashed ${C.border}`,
                    bgcolor: C.bg,
                    textAlign: "center",
                  }}
                >
                  <Stack spacing={1.5} alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <QrCode2RoundedIcon sx={{ color: C.primary }} />
                      <Typography sx={{ fontWeight: 800, fontSize: 15, color: C.text }}>
                        Scan & Pay with any UPI App
                      </Typography>
                    </Stack>

                    {paymentConfig?.upi_qr_image_url ? (
                      <Box
                        component="img"
                        src={normalizeMediaUrl(paymentConfig.upi_qr_image_url)}
                        alt="Payment scanner"
                        sx={{
                          width: 180,
                          height: 180,
                          objectFit: "contain",
                          borderRadius: `${R.md}px`,
                          border: `1px solid ${C.border}`,
                          bgcolor: "#fff",
                          p: 1.5,
                          boxShadow: S.sm,
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 180,
                          height: 180,
                          borderRadius: `${R.md}px`,
                          border: `1px solid ${C.border}`,
                          bgcolor: "#fff",
                          display: "grid",
                          placeItems: "center",
                          color: C.textSecondary,
                          fontSize: 13,
                          fontWeight: 500,
                          p: 2,
                        }}
                      >
                        Official UPI QR will appear here.
                      </Box>
                    )}

                    {paymentConfig?.upi_id ? (
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                        <Typography variant="body2" sx={{ color: C.textSecondary, fontWeight: 600 }}>
                          UPI ID: <b style={{ color: C.text }}>{paymentConfig.upi_id}</b>
                        </Typography>
                        <IconButton size="small" onClick={copyUpiId} sx={{ p: 0.5 }}>
                          {copiedUpi ? (
                            <CheckRoundedIcon sx={{ fontSize: 16, color: C.success }} />
                          ) : (
                            <ContentCopyRoundedIcon sx={{ fontSize: 16, color: C.primary }} />
                          )}
                        </IconButton>
                      </Stack>
                    ) : null}
                  </Stack>
                </Paper>

                {/* UTR Reference Input */}
                <TextField
                  label="UTR / Transaction Reference (Optional)"
                  placeholder="e.g. 329482910382"
                  fullWidth
                  value={form.utr}
                  onChange={onChange("utr")}
                />

                {/* Upload Screenshot Dropzone */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: `${R.md}px`,
                    border: `1.5px solid ${C.border}`,
                    bgcolor: C.surface,
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: 14, color: C.text }}>
                        Payment Proof Screenshot *
                      </Typography>
                      <Typography variant="caption" sx={{ color: C.textSecondary }}>
                        Upload clear screenshot showing UTR & Amount
                      </Typography>
                      {billName ? (
                        <Typography variant="body2" sx={{ mt: 0.75, color: C.primary, fontWeight: 700 }}>
                          ✓ Selected: {billName}
                        </Typography>
                      ) : null}
                    </Box>

                    <Button
                      component="label"
                      variant="outlined"
                      startIcon={<UploadFileRoundedIcon />}
                      sx={{
                        borderRadius: `${R.md}px`,
                        borderColor: C.border,
                        color: C.text,
                        fontWeight: 700,
                        textTransform: "none",
                        width: { xs: "100%", sm: "auto" },
                        "&:hover": { borderColor: C.primary, bgcolor: C.primaryLight },
                      }}
                    >
                      Browse File
                      <input
                        key={fileInputKey}
                        type="file"
                        hidden
                        accept="image/*,.pdf"
                        onChange={onFileChange}
                      />
                    </Button>
                  </Stack>
                </Paper>

                {/* Submit CTA */}
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={submitting || !canSubmit}
                  endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardRoundedIcon />}
                  sx={{
                    py: 1.6,
                    fontSize: 15,
                    fontWeight: 800,
                    borderRadius: `${R.md}px`,
                    background: C.primary,
                    boxShadow: S.buttonPrimary,
                    "&:hover": { background: C.primaryDark },
                  }}
                >
                  {submitting ? "Submitting..." : "Submit Deposit Request"}
                </Button>
              </Stack>
            </Box>
          </Stack>
        )}
      </Paper>

      {/* Success Dialog */}
      <Dialog open={successOpen} onClose={() => setSuccessOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: `${R.lg}px`, p: 1 } }}>
        <DialogTitle sx={{ textAlign: "center", pt: 3 }}>
          <CheckCircleRoundedIcon sx={{ fontSize: 56, color: C.success, mb: 1 }} />
          <Typography sx={{ fontWeight: 900, color: C.text, fontSize: 18 }}>
            Request Submitted!
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ textAlign: "center", color: C.textSecondary }}>
            Your deposit request has been placed. Funds will be credited once verified.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", px: 3, pb: 2.5 }}>
          <Button onClick={() => setSuccessOpen(false)} sx={{ textTransform: "none", fontWeight: 600 }}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate("/user/team-history?tab=add-money")}
            sx={{
              textTransform: "none",
              fontWeight: 800,
              borderRadius: `${R.md}px`,
              background: C.primary,
            }}
          >
            View History
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
