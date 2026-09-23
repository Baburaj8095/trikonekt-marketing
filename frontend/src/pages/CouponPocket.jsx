import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ConfirmationNumberRoundedIcon from "@mui/icons-material/ConfirmationNumberRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import API from "../api/api";
import { C, R, S } from "../theme/tokens";
import StatusBadge from "../components/common/StatusBadge";

const VOUCHER_TYPES = [
  { value: "TRIZONE", label: "Trizone Voucher", validity: "30 days" },
  { value: "ONLINE", label: "Online Coupon", validity: "30 days" },
  { value: "NEAR_STORE", label: "Near Store Coupon", validity: "30 days" },
  { value: "PACKAGE_PURCHASE", label: "Package Purchase Coupon", validity: "7 days" },
];

function fmtAmount(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";
}

function fmtDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
}

export default function CouponPocket() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [wallet, setWallet] = useState({});
  const [voucherData, setVoucherData] = useState({ results: [] });
  const [form, setForm] = useState({
    voucher_type: "TRIZONE",
    amount: "",
    assigned_to: "",
    note: "",
  });

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [walletRes, voucherRes] = await Promise.all([
        API.get("/accounts/wallet/me/"),
        API.get("/accounts/wallet/vouchers/"),
      ]);
      setWallet(walletRes?.data || {});
      setVoucherData(voucherRes?.data || { results: [] });
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load coupon pocket.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const couponBalance = Number(wallet?.transfer_wallets?.coupon || voucherData?.coupon_wallet_balance || 0);
  const createdVouchers = useMemo(
    () => (voucherData?.results || []).filter((item) => item.creator_username),
    [voucherData]
  );

  const change = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const createVoucher = async () => {
    try {
      setActionLoading(true);
      setError("");
      setSuccess("");
      const payload = {
        voucher_type: form.voucher_type,
        amount: form.amount,
        note: form.note,
      };
      if (form.voucher_type === "PACKAGE_PURCHASE") {
        payload.assigned_to = form.assigned_to;
      }
      const res = await API.post("/accounts/wallet/vouchers/", payload);
      setSuccess(`Voucher created: ${res?.data?.code || ""}`);
      setForm((prev) => ({ ...prev, amount: "", assigned_to: "", note: "" }));
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to create voucher.");
    } finally {
      setActionLoading(false);
    }
  };

  const copyVoucher = async (voucher) => {
    const text = `${voucher.code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(voucher.id);
      setTimeout(() => setCopiedId(null), 2000);
      setSuccess(`Copied coupon code: ${voucher.code}`);
    } catch (_) {
      setSuccess(`Coupon voucher: ${text}`);
    }
  };

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", px: { xs: 2, sm: 3 }, py: 2.5, pb: 10 }}>
      {/* Header Info */}
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: C.text, letterSpacing: "-0.5px" }}>
          Coupon Pocket
        </Typography>
        <Typography variant="body2" sx={{ color: C.textSecondary, mt: 0.5 }}>
          Create & transfer coupons for Trizone, Online, and Near Stores
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: `${R.md}px` }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: `${R.md}px` }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {/* Screen 4 Hero Green Balance Card */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: `${R.hero}px`,
          background: "linear-gradient(135deg, #059669 0%, #10b981 60%, #34d399 100%)",
          color: "#ffffff",
          boxShadow: "0 10px 30px rgba(16, 185, 129, 0.25)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: -24,
            right: -24,
            width: 120,
            height: 120,
            borderRadius: "50%",
            bgcolor: "rgba(255, 255, 255, 0.08)",
          }}
        />
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: `${R.sm}px`,
              bgcolor: "rgba(255, 255, 255, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ConfirmationNumberRoundedIcon sx={{ fontSize: 20, color: "#fff" }} />
          </Box>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: "rgba(255, 255, 255, 0.9)", letterSpacing: "0.5px" }}>
            AVAILABLE COUPON BALANCE
          </Typography>
        </Stack>
        <Typography sx={{ fontSize: { xs: 32, sm: 38 }, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1.1 }}>
          ₹{fmtAmount(couponBalance)}
        </Typography>
      </Paper>

      {/* Create Coupon Form Card */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          mb: 3,
          borderRadius: `${R.lg}px`,
          bgcolor: C.surface,
          border: `1.5px solid ${C.border}`,
          boxShadow: S.card,
        }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: 16, color: C.text, mb: 2 }}>
          Create New Coupon
        </Typography>
        <Stack spacing={2}>
          <TextField
            select
            label="Coupon Type"
            value={form.voucher_type}
            onChange={(e) => change("voucher_type", e.target.value)}
            fullWidth
            size="medium"
          >
            {VOUCHER_TYPES.map((option) => (
              <MenuItem key={option.value} value={option.value} sx={{ py: 1.25 }}>
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{option.label}</Typography>
                  <Typography sx={{ fontSize: 12, color: C.textSecondary }}>Validity: {option.validity}</Typography>
                </Box>
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Amount (₹)"
            type="number"
            placeholder="e.g. 500"
            value={form.amount}
            onChange={(e) => change("amount", e.target.value)}
            fullWidth
            inputProps={{ min: 1 }}
          />

          {form.voucher_type === "PACKAGE_PURCHASE" && (
            <TextField
              label="Receiver Consumer ID"
              placeholder="Enter consumer username"
              value={form.assigned_to}
              onChange={(e) => change("assigned_to", e.target.value)}
              fullWidth
            />
          )}

          <TextField
            label="Note / Purpose (Optional)"
            placeholder="Add an optional memo"
            value={form.note}
            onChange={(e) => change("note", e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />

          <Button
            variant="contained"
            size="large"
            disabled={actionLoading || !form.amount || (form.voucher_type === "PACKAGE_PURCHASE" && !form.assigned_to)}
            onClick={createVoucher}
            endIcon={actionLoading ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardRoundedIcon />}
            sx={{
              py: 1.5,
              fontSize: 15,
              fontWeight: 700,
              borderRadius: `${R.md}px`,
              background: C.primary,
              boxShadow: S.buttonPrimary,
              "&:hover": { background: C.primaryDark },
            }}
          >
            {actionLoading ? "Generating..." : "Generate Coupon"}
          </Button>
        </Stack>
      </Paper>

      {/* Created Coupons List */}
      <Typography sx={{ fontWeight: 800, fontSize: 16, color: C.text, mb: 1.5 }}>
        Created Coupons ({createdVouchers.length})
      </Typography>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : createdVouchers.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 4,
            textAlign: "center",
            borderRadius: `${R.lg}px`,
            border: `1.5px dashed ${C.border}`,
            bgcolor: C.bg,
          }}
        >
          <ConfirmationNumberRoundedIcon sx={{ fontSize: 40, color: C.textTertiary, mb: 1 }} />
          <Typography sx={{ fontWeight: 600, color: C.textSecondary, fontSize: 14 }}>
            No coupons generated yet
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {createdVouchers.map((voucher) => (
            <Paper
              key={voucher.id}
              elevation={0}
              sx={{
                p: 2,
                borderRadius: `${R.lg}px`,
                bgcolor: C.surface,
                border: `1px solid ${C.border}`,
                boxShadow: S.sm,
                transition: "all 140ms ease",
                "&:hover": { boxShadow: S.card },
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 15, color: C.text }}>
                      {voucher.code}
                    </Typography>
                    <StatusBadge status={voucher.status} />
                  </Stack>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.primary, mb: 0.5 }}>
                    ₹{fmtAmount(voucher.amount)} • {voucher.voucher_type_label || voucher.voucher_type}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: C.textSecondary }}>
                    {voucher.assigned_to_username ? `Assigned to: ${voucher.assigned_to_username} • ` : ""}
                    Valid till {fmtDate(voucher.expires_at)}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => copyVoucher(voucher)}
                  sx={{
                    bgcolor: copiedId === voucher.id ? C.successBg : C.bg,
                    color: copiedId === voucher.id ? C.success : C.textSecondary,
                    borderRadius: `${R.sm}px`,
                    p: 1,
                  }}
                  title="Copy code"
                >
                  {copiedId === voucher.id ? (
                    <CheckRoundedIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />
                  )}
                </IconButton>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}
