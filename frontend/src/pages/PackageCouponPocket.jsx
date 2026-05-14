import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import API from "../api/api";

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

export default function PackageCouponPocket() {
  const navigate = useNavigate();
  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user_user") || sessionStorage.getItem("user_user");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [wallet, setWallet] = useState({});
  const [voucherData, setVoucherData] = useState({ results: [] });
  const [code, setCode] = useState("");

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
      setError(err?.response?.data?.detail || "Failed to load package coupon pocket.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const balance = Number(
    wallet?.transfer_wallets?.packagePurchaseCoupon ||
      voucherData?.package_coupon_wallet_balance ||
      0
  );

  const assigned = useMemo(
    () =>
      (voucherData?.results || []).filter(
        (v) =>
          String(v?.voucher_type || "").toUpperCase() === "PACKAGE_PURCHASE" &&
          (
            !currentUser?.username ||
            v?.assigned_to_username === currentUser.username ||
            v?.redeemed_by_username === currentUser.username
          )
      ),
    [currentUser, voucherData]
  );

  const redeem = async (value = code) => {
    try {
      setActionLoading(true);
      setError("");
      setSuccess("");
      await API.post("/accounts/wallet/vouchers/redeem/", { code: String(value || "").trim() });
      setCode("");
      setSuccess("Voucher redeemed. Amount added to your Package Purchase Coupon Wallet.");
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to redeem voucher.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", px: { xs: 1.2, sm: 2 }, py: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a" }}>
            Package Purchase Coupon
          </Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Redeem package coupons assigned to your consumer ID and use the balance to buy packages.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => navigate("/user/promo-packages")}>
          Buy Package
        </Button>
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
              bgcolor: "#e0f2fe",
              color: "#0369a1",
              display: "grid",
              placeItems: "center",
            }}
          >
            <CardGiftcardIcon />
          </Box>
          <Box>
            <Typography sx={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>
              Available Balance
            </Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>
              Rs. {fmtAmount(balance)}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 2 }}>
        <Typography sx={{ fontWeight: 900, mb: 1 }}>Redeem Voucher</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            size="small"
            label="Package Coupon Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            fullWidth
          />
          <Button variant="contained" disabled={actionLoading || !code.trim()} onClick={() => redeem()}>
            Redeem
          </Button>
        </Stack>
      </Paper>

      <Typography sx={{ fontWeight: 900, mb: 1 }}>Your Package Coupon Vouchers</Typography>
      <Stack spacing={1}>
        {assigned.map((voucher) => (
          <Paper key={voucher.id} variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
              <Box>
                <Typography sx={{ fontWeight: 900 }}>{voucher.code} - Rs. {fmtAmount(voucher.amount)}</Typography>
                <Typography sx={{ color: "#64748b", fontSize: 12 }}>
                  Created by {voucher.creator_username || "-"} · Valid till {fmtDate(voucher.expires_at)}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={voucher.status} sx={{ fontWeight: 800 }} />
                {voucher.status === "ACTIVE" && (
                  <Button size="small" variant="outlined" disabled={actionLoading} onClick={() => redeem(voucher.code)}>
                    Redeem
                  </Button>
                )}
              </Stack>
            </Stack>
          </Paper>
        ))}
        {!assigned.length && !loading && (
          <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>No package coupons assigned yet.</Typography>
        )}
      </Stack>
    </Box>
  );
}
