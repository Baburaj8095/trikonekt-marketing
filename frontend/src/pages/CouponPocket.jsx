import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import API from "../api/api";

const VOUCHER_TYPES = [
  { value: "TRIZONE", label: "Trizone Voucher", validity: "30 days" },
  { value: "ONLINE", label: "Online Coupon", validity: "30 days" },
  { value: "NEAR_STORE", label: "Near Store Coupon", validity: "30 days" },
  { value: "PACKAGE_PURCHASE", label: "Package Purchase Coupon", validity: "7 days" },
];

function fmtAmount(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

function fmtDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
}

export default function CouponPocket() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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
    const text = `${voucher.code} - Rs. ${fmtAmount(voucher.amount)} (${voucher.voucher_type_label || voucher.voucher_type})`;
    try {
      await navigator.clipboard.writeText(text);
      setSuccess("Coupon voucher copied. You can share it with the receiver.");
    } catch (_) {
      setSuccess(`Coupon voucher: ${text}`);
    }
  };

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 1.2, sm: 2 }, py: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a" }}>
            Coupon Pocket
          </Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Create Trizone, Online, Near Store, and Package Purchase coupons from your Coupon Pocket balance.
          </Typography>
        </Box>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 1 }}>{success}</Alert>}

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              bgcolor: "#dcfce7",
              color: "#15803d",
              display: "grid",
              placeItems: "center",
            }}
          >
            <ConfirmationNumberIcon />
          </Box>
          <Box>
            <Typography sx={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>
              Coupon Pocket Balance
            </Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>
              Rs. {fmtAmount(couponBalance)}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 2 }}>
        <Typography sx={{ fontWeight: 900, mb: 1 }}>Create Coupon</Typography>
        <Stack spacing={1.2}>
          <TextField
            select
            size="small"
            label="Coupon Type"
            value={form.voucher_type}
            onChange={(e) => change("voucher_type", e.target.value)}
            fullWidth
          >
            {VOUCHER_TYPES.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label} ({option.validity})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Amount"
            type="number"
            value={form.amount}
            onChange={(e) => change("amount", e.target.value)}
            fullWidth
          />
          {form.voucher_type === "PACKAGE_PURCHASE" && (
            <TextField
              size="small"
              label="Receiver Consumer ID"
              value={form.assigned_to}
              onChange={(e) => change("assigned_to", e.target.value)}
              fullWidth
            />
          )}
          <TextField
            size="small"
            label="Note"
            value={form.note}
            onChange={(e) => change("note", e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <Button
            variant="contained"
            disabled={actionLoading || !form.amount || (form.voucher_type === "PACKAGE_PURCHASE" && !form.assigned_to)}
            onClick={createVoucher}
            sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
          >
            {actionLoading ? "Creating..." : "Create Coupon"}
          </Button>
        </Stack>
      </Paper>

      <Typography sx={{ fontWeight: 900, mb: 1 }}>Created Coupons</Typography>
      <Stack spacing={1}>
        {createdVouchers.map((voucher) => (
          <Paper key={voucher.id} variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
              <Box>
                <Typography sx={{ fontWeight: 900 }}>{voucher.code} - Rs. {fmtAmount(voucher.amount)}</Typography>
                <Typography sx={{ color: "#64748b", fontSize: 12 }}>
                  {voucher.voucher_type_label || voucher.voucher_type}
                  {voucher.assigned_to_username ? ` - Receiver ${voucher.assigned_to_username}` : ""}
                  {voucher.redeemed_by_username ? ` - Redeemed by ${voucher.redeemed_by_username}` : ""}
                  {" "} - Valid till {fmtDate(voucher.expires_at)}
                </Typography>
              </Box>
              <Chip size="small" label={voucher.status} sx={{ fontWeight: 800 }} />
              <Button size="small" variant="outlined" onClick={() => copyVoucher(voucher)}>
                Copy
              </Button>
            </Stack>
          </Paper>
        ))}
        {!createdVouchers.length && !loading && (
          <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>No coupons created yet.</Typography>
        )}
      </Stack>
    </Box>
  );
}
