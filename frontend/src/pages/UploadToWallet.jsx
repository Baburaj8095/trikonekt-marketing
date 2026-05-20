import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import normalizeMediaUrl from "../utils/media";
import API, { createWalletUploadRequest, getEcouponStoreBootstrap } from "../api/api";
import { useNavigate } from "react-router-dom";

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
      setSuccessMsg("Payment is successfully inittated");
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
    <Box className="consumer-fintech-page" sx={{ maxWidth: 900, mx: "auto", px: { xs: 0.5, sm: 2 }, py: { xs: 1, sm: 2 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>
            Upload to Wallet
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            Add your payment details and upload the supporting bill as shown in the sketch.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<HistoryRoundedIcon />}
          onClick={() => navigate("/user/team-history?tab=add-money")}
          sx={{ borderRadius: 2.5, width: { xs: "100%", sm: "auto" } }}
        >
          History
        </Button>
      </Stack>

      {screenError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {screenError}
        </Alert>
      ) : null}

      {successMsg ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      ) : null}

      <Paper
        elevation={0}
        className="consumer-fintech-card"
        sx={{
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            px: { xs: 2, sm: 3 },
            py: 2,
            background: "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)",
            color: "#fff",
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: 2.5,
                bgcolor: "rgba(255,255,255,0.14)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <AccountBalanceWalletRoundedIcon />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 950, fontSize: 18 }}>
                Wallet Upload Request
              </Typography>
              <Typography sx={{ fontSize: 13, opacity: 0.85 }}>
                Consumer details are auto-shown below.
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {loading ? (
            <Box sx={{ py: 6, display: "grid", placeItems: "center" }}>
              <CircularProgress />
            </Box>
          ) : (
            <Stack spacing={2.5}>
              <Paper
                elevation={0}
                sx={{ p: 2, borderRadius: 3, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}
              >
                <Stack spacing={1.25}>
                  <Chip
                    label="Auto Show"
                    size="small"
                    sx={{ width: "fit-content", fontWeight: 850, bgcolor: "#eff6ff", color: "#2563eb" }}
                  />
                  <Typography sx={{ fontWeight: 600 }}>
                    Consumer ID: <Box component="span" sx={{ fontWeight: 400 }}>{consumerId}</Box>
                  </Typography>
                  <Typography sx={{ fontWeight: 600 }}>
                    Consumer Name: <Box component="span" sx={{ fontWeight: 400 }}>{consumerName}</Box>
                  </Typography>
                </Stack>
              </Paper>

              <Box component="form" onSubmit={onSubmit}>
                <Stack spacing={2.5}>
                  <TextField
                    label="Amount"
                    placeholder="Enter amount"
                    size="small"
                    fullWidth
                    type="number"
                    value={form.amount}
                    onChange={onChange("amount")}
                    inputProps={{ min: 0, step: "0.01" }}
                  />

                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      borderStyle: "dashed",
                      borderColor: "#CBD5E1",
                      borderWidth: 1,
                      bgcolor: "#ffffff",
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <QrCode2RoundedIcon color="primary" />
                        <Typography sx={{ fontWeight: 700 }}>Payment Scanner</Typography>
                      </Stack>

                      {paymentConfig?.upi_qr_image_url ? (
                        <Box
                          component="img"
                          src={normalizeMediaUrl(paymentConfig.upi_qr_image_url)}
                          alt="Payment scanner"
                          sx={{
                            width: { xs: "100%", sm: 178 },
                            maxWidth: 210,
                            height: 178,
                            objectFit: "contain",
                            borderRadius: 2,
                            border: "1px solid #E2E8F0",
                            bgcolor: "#fff",
                            p: 1,
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: { xs: "100%", sm: 178 },
                            maxWidth: 210,
                            height: 178,
                            borderRadius: 2,
                            border: "1px solid #E2E8F0",
                            bgcolor: "#F8FAFC",
                            display: "grid",
                            placeItems: "center",
                            color: "text.secondary",
                            textAlign: "center",
                            px: 2,
                          }}
                        >
                          QR scanner not configured yet.
                        </Box>
                      )}

                      {paymentConfig?.upi_id ? (
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          UPI ID: <b>{paymentConfig.upi_id}</b>
                        </Typography>
                      ) : null}
                    </Stack>
                  </Paper>

                  <TextField
                    label="UTR No (Optional)"
                    placeholder="Enter UTR number if available"
                    size="small"
                    fullWidth
                    value={form.utr}
                    onChange={onChange("utr")}
                  />

                  <Paper
                    elevation={0}
                    sx={{ p: 2, borderRadius: 3, border: "1px solid #E2E8F0" }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.5}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", sm: "center" }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 700, mb: 0.25 }}>
                          Upload Bill
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Upload the payment screenshot, receipt, or bill.
                        </Typography>
                        {billName ? (
                          <Typography variant="body2" sx={{ mt: 1, color: "#145DA0", fontWeight: 600 }}>
                            Selected: {billName}
                          </Typography>
                        ) : null}
                      </Box>

                      <Button
                        component="label"
                        variant="outlined"
                        startIcon={<UploadFileRoundedIcon />}
                        sx={{ borderRadius: 2.5, width: { xs: "100%", sm: "auto" } }}
                      >
                        Choose File
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

                  <Divider />

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.25}
                    justifyContent="flex-start"
                  >
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={submitting || !canSubmit}
                      sx={{
                        minWidth: 160,
                        textTransform: "none",
                        borderRadius: 2.5,
                        fontWeight: 700,
                      }}
                    >
                      {submitting ? "Submitting..." : "Submit"}
                    </Button>

                    <Button
                      variant="text"
                      onClick={() => navigate("/user/team-history?tab=add-money")}
                      sx={{ fontWeight: 850 }}
                    >
                      View History
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            </Stack>
          )}
        </Box>
      </Paper>

      <Dialog open={successOpen} onClose={() => setSuccessOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ textAlign: "center", pt: 3 }}>
          <CheckCircleRoundedIcon color="success" sx={{ fontSize: 56, mb: 1 }} />
          <Typography sx={{ fontWeight: 900, color: "#0f172a" }}>
            {successMsg || "Payment is successfully inittated"}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ textAlign: "center", color: "text.secondary" }}>
            Your Add Money request is waiting for admin approval.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", px: 3, pb: 3 }}>
          <Button onClick={() => setSuccessOpen(false)} sx={{ textTransform: "none" }}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate("/user/team-history?tab=add-money")}
            sx={{ textTransform: "none", fontWeight: 800 }}
          >
            View History
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
