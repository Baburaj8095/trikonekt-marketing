import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Stack,
  Button,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
  Divider,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import API from "../../api/api";

export default function EmailOtpModal({
  open,
  onClose,
  title = "Security Authorization",
  actionLabel = "Confirm & Authorize",
  transferType = "withdrawal",
  amount = 0,
  targetConsumerId = null,
  recipientPhone = null,
  details = [],
  onConfirm,
}) {
  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);

  // Send or re-send OTP
  const handleSendOtp = async () => {
    try {
      setSendingOtp(true);
      setError("");
      const payload = {
        transfer_type: transferType,
        amount: Number(amount) || 1,
      };
      if (targetConsumerId) payload.target_consumer_id = targetConsumerId;
      if (recipientPhone) {
        payload.recipient_phone = recipientPhone;
        payload.phone = recipientPhone;
      }

      const res = await API.post("/accounts/wallet/transfer/request-otp/", payload);
      setOtpSent(true);
      setMaskedEmail(res?.data?.masked_email || "your registered email");
      setCountdown(60);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Failed to dispatch verification code. Please try again."
      );
    } finally {
      setSendingOtp(false);
    }
  };

  // Auto-send OTP when opened if not sent yet
  useEffect(() => {
    if (open) {
      setOtp("");
      setError("");
      handleSendOtp();
    } else {
      setOtp("");
      setOtpSent(false);
      setError("");
      setCountdown(60);
    }
  }, [open]);

  // Countdown timer
  useEffect(() => {
    let timer;
    if (open && otpSent && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((c) => Math.max(0, c - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [open, otpSent, countdown]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      await onConfirm(cleanOtp);
      onClose();
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.response?.data?.otp ||
          "Verification failed. Please check the code and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3.5,
          p: 1,
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.22)",
        },
      }}
    >
      <DialogTitle sx={{ p: 2, pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "12px",
              bgcolor: "rgba(37, 99, 235, 0.1)",
              color: "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldRoundedIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", lineHeight: 1.2 }}>
              {title}
            </Typography>
            <Typography sx={{ fontSize: "12px", color: "#64748B", mt: 0.2 }}>
              Email 2FA Verification
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} disabled={submitting} size="small" sx={{ color: "#94A3B8" }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2, pt: 1 }}>
        <Stack spacing={2}>
          {/* Transaction Summary Chips */}
          {details && details.length > 0 && (
            <Box
              sx={{
                bgcolor: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 2.5,
                p: 1.5,
              }}
            >
              <Stack spacing={0.8}>
                {details.map((d, i) => (
                  <Stack key={i} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: "12px", color: "#64748B", fontWeight: 500 }}>
                      {d.label}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "12.5px",
                        fontWeight: 700,
                        color: d.color || "#0F172A",
                      }}
                    >
                      {d.value}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}

          {/* Email Info Banner */}
          <Box
            sx={{
              bgcolor: "rgba(14, 165, 233, 0.08)",
              border: "1px solid rgba(14, 165, 233, 0.2)",
              borderRadius: 2.5,
              p: 1.5,
              display: "flex",
              alignItems: "flex-start",
              gap: 1.2,
            }}
          >
            <MarkEmailReadRoundedIcon sx={{ fontSize: 20, color: "#0284C7", mt: 0.2 }} />
            <Box>
              <Typography sx={{ fontSize: "12.5px", fontWeight: 700, color: "#0369A1" }}>
                Security Code Dispatched
              </Typography>
              <Typography sx={{ fontSize: "11.5px", color: "#475569", mt: 0.2 }}>
                We sent a 6-digit authorization code to{" "}
                <strong style={{ color: "#0F172A" }}>{maskedEmail || "your registered email"}</strong>.
              </Typography>
            </Box>
          </Box>

          {/* Error Banner */}
          {error && (
            <Alert severity="error" sx={{ borderRadius: 2, fontSize: "12px" }}>
              {error}
            </Alert>
          )}

          {/* 6-Digit OTP Field */}
          <Box>
            <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#334155", mb: 0.8 }}>
              Enter 6-Digit Verification Code
            </Typography>
            <TextField
              fullWidth
              autoFocus
              variant="outlined"
              placeholder="••••••"
              value={otp}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setOtp(val);
                if (error) setError("");
              }}
              inputProps={{
                maxLength: 6,
                style: {
                  textAlign: "center",
                  fontSize: "24px",
                  letterSpacing: "8px",
                  fontWeight: 800,
                  fontFamily: "monospace",
                  color: "#0F172A",
                  padding: "10px",
                },
              }}
              sx={{
                bgcolor: "#FFFFFF",
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2.5,
                  "&.Mui-focused fieldset": {
                    borderColor: "#2563EB",
                    borderWidth: 2,
                  },
                },
              }}
            />
          </Box>

          {/* Resend Timer */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontSize: "11.5px", color: "#64748B" }}>
              Didn't receive code?
            </Typography>
            {countdown > 0 ? (
              <Typography sx={{ fontSize: "11.5px", fontWeight: 700, color: "#64748B" }}>
                Resend in {countdown}s
              </Typography>
            ) : (
              <Button
                size="small"
                onClick={handleSendOtp}
                disabled={sendingOtp || submitting}
                startIcon={sendingOtp ? <CircularProgress size={12} color="inherit" /> : <RefreshRoundedIcon fontSize="small" />}
                sx={{
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: "#2563EB",
                  p: 0,
                  minWidth: 0,
                  "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
                }}
              >
                {sendingOtp ? "Sending..." : "Resend OTP"}
              </Button>
            )}
          </Stack>
        </Stack>
      </DialogContent>

      <Divider sx={{ my: 0.5 }} />

      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button
          onClick={onClose}
          disabled={submitting}
          sx={{
            fontWeight: 600,
            color: "#64748B",
            textTransform: "none",
            borderRadius: 2,
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || otp.length < 6}
          sx={{
            bgcolor: "#2563EB",
            "&:hover": { bgcolor: "#1D4ED8" },
            fontWeight: 800,
            textTransform: "none",
            borderRadius: 2.5,
            px: 3,
            py: 1,
            boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)",
          }}
        >
          {submitting ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} color="inherit" />
              <span>Verifying...</span>
            </Stack>
          ) : (
            actionLabel
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
