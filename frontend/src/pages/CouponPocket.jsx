import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ConfirmationNumberRoundedIcon from "@mui/icons-material/ConfirmationNumberRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import FlightTakeoffRoundedIcon from "@mui/icons-material/FlightTakeoffRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import API from "../api/api";
import { C, R, S } from "../theme/tokens";
import StatusBadge from "../components/common/StatusBadge";

const COUPON_BUCKETS = [
  {
    id: "P2P_INTERNAL",
    name: "P2P Internal Coupon",
    description: "Instant peer-to-peer coupon transfer to any Trikonekt user",
    isOpen: true,
    badgeText: "OPEN NOW",
    badgeColor: "success",
    icon: SendRoundedIcon,
    accent: "#2563EB",
    feeNote: "7% transfer fee applies on P2P send",
  },
  {
    id: "TRI_HOLIDAY",
    name: "Tri Holiday Coupon",
    description: "Redeemable towards premium domestic & international travel packages",
    isOpen: true,
    badgeText: "OPEN NOW",
    badgeColor: "success",
    icon: FlightTakeoffRoundedIcon,
    accent: "#0D9488",
    feeNote: "100% face value redemption on travel tours",
  },
  {
    id: "TRIZONE",
    name: "Trizone Coupon",
    description: "Exclusive discounts across Trizone verified merchant hubs",
    isOpen: false,
    badgeText: "LOCKED",
    badgeColor: "warning",
    icon: ShoppingBagRoundedIcon,
    accent: "#EA580C",
    feeNote: "Controlled by Admin (Opens during promotional seasons)",
  },
  {
    id: "ONLINE",
    name: "Online Coupon",
    description: "Digital e-commerce shopping vouchers for partnered brands",
    isOpen: false,
    badgeText: "LOCKED",
    badgeColor: "warning",
    icon: LanguageRoundedIcon,
    accent: "#7C3AED",
    feeNote: "Controlled by Admin (Unlocks on milestone ranks)",
  },
  {
    id: "NEAR_STORE",
    name: "Near Store Coupon",
    description: "Hyperlocal retail store discounts across verified offline shops",
    isOpen: false,
    badgeText: "LOCKED",
    badgeColor: "warning",
    icon: StorefrontRoundedIcon,
    accent: "#D97706",
    feeNote: "Controlled by Admin (Offline merchant network)",
  },
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
  const [selectedBucket, setSelectedBucket] = useState(COUPON_BUCKETS[0]);
  const [p2pModalOpen, setP2pModalOpen] = useState(false);

  const [p2pForm, setP2pForm] = useState({
    recipient_phone: "",
    amount: "",
    coupon_type: "PACKAGE_COUPON",
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
  const withdrawableBalance = Number(wallet?.withdrawable_balance || 0);

  const p2pGross = Number(p2pForm.amount || 0);
  const p2pFee = p2pGross > 0 ? Number((p2pGross * 0.07).toFixed(2)) : 0;
  const p2pNet = p2pGross > 0 ? Number((p2pGross - p2pFee).toFixed(2)) : 0;

  const handleCopy = (code, id) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleP2pTransfer = async () => {
    if (!p2pForm.recipient_phone.trim()) {
      setError("Please enter the recipient phone number.");
      return;
    }
    if (p2pGross <= 0) {
      setError("Please enter a valid transfer amount.");
      return;
    }
    if (p2pGross > withdrawableBalance && p2pGross > couponBalance) {
      setError(`Insufficient balance. Your balance is ₹${fmtAmount(withdrawableBalance)}.`);
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const res = await API.post("/business/coupons/p2p-transfer/", {
        recipient_phone: p2pForm.recipient_phone.trim(),
        amount: p2pGross,
        coupon_type: p2pForm.coupon_type,
      });

      setSuccess(`Successfully sent ₹${fmtAmount(p2pNet)} to ${p2pForm.recipient_phone}! (Fee: ₹${fmtAmount(p2pFee)})`);
      setP2pModalOpen(false);
      setP2pForm({ recipient_phone: "", amount: "", coupon_type: "PACKAGE_COUPON", note: "" });
      load();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to process P2P transfer.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: { xs: 1.5, sm: 2.5, md: 3 } }}>
      {/* Header Banner */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          borderRadius: 3.5,
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          color: "#fff",
          mb: 3,
          boxShadow: S.card,
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
              <ConfirmationNumberRoundedIcon sx={{ fontSize: 32, color: "#38BDF8" }} />
              <Typography variant="h5" sx={{ fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>
                P2P Internal & Coupon Pocket
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: "#94A3B8", fontWeight: 500, fontSize: "13.5px" }}>
              Peer-to-Peer coupon routing, universal holiday vouchers, and multi-tier store discounts
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5} sx={{ width: { xs: "100%", sm: "auto" } }}>
            <IconButton
              onClick={load}
              disabled={loading}
              sx={{ bgcolor: "rgba(255,255,255,0.08)", color: "#fff", "&:hover": { bgcolor: "rgba(255,255,255,0.18)" } }}
            >
              <RefreshRoundedIcon sx={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </IconButton>

            <Button
              variant="contained"
              fullWidth
              startIcon={<SendRoundedIcon />}
              onClick={() => setP2pModalOpen(true)}
              sx={{
                background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                color: "#fff",
                fontWeight: 800,
                px: 3,
                py: 1,
                borderRadius: 2.5,
                textTransform: "none",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 14px rgba(37,99,235,0.4)",
              }}
            >
              P2P Internal Send (7% Fee)
            </Button>
          </Stack>
        </Stack>

        {/* Balance Badges */}
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Coupon Balance</Typography>
              <Typography sx={{ fontSize: "18px", fontWeight: 900, color: "#38BDF8" }}>₹{fmtAmount(couponBalance)}</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Withdrawable Wallet</Typography>
              <Typography sx={{ fontSize: "18px", fontWeight: 900, color: "#4ADE80" }}>₹{fmtAmount(withdrawableBalance)}</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>P2P Transfer Fee</Typography>
              <Typography sx={{ fontSize: "18px", fontWeight: 900, color: "#FBBF24" }}>7.00%</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Available Buckets</Typography>
              <Typography sx={{ fontSize: "18px", fontWeight: 900, color: "#C084FC" }}>5 Categories</Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2.5, fontWeight: 600 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2.5, borderRadius: 2.5, fontWeight: 600 }}>{success}</Alert>}

      {/* 5-Bucket Selector Grid */}
      <Typography variant="h6" sx={{ fontWeight: 800, color: "#0F172A", mb: 1.5, fontSize: "16px" }}>
        Coupon Buckets & Access Controls
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3.5 }}>
        {COUPON_BUCKETS.map((bucket) => {
          const Icon = bucket.icon;
          const isSelected = selectedBucket?.id === bucket.id;
          return (
            <Grid item xs={12} sm={6} md={2.4} key={bucket.id}>
              <Paper
                elevation={0}
                onClick={() => setSelectedBucket(bucket)}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  cursor: "pointer",
                  border: isSelected ? `2px solid ${bucket.accent}` : "1.5px solid #E2E8F0",
                  bgcolor: isSelected ? "#F8FAFC" : "#FFFFFF",
                  boxShadow: isSelected ? "0 8px 24px rgba(15,23,42,0.08)" : S.card,
                  transition: "all 0.2s ease",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  "&:hover": {
                    borderColor: bucket.accent,
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
                    <Box sx={{ p: 1, borderRadius: 2, bgcolor: `${bucket.accent}15` }}>
                      <Icon sx={{ color: bucket.accent, fontSize: 22 }} />
                    </Box>
                    <StatusBadge
                      label={bucket.badgeText}
                      color={bucket.isOpen ? "success" : "default"}
                    />
                  </Stack>

                  <Typography sx={{ fontWeight: 800, color: "#0F172A", fontSize: "14px", mb: 0.5 }}>
                    {bucket.name}
                  </Typography>
                  <Typography sx={{ fontSize: "11.5px", color: "#64748B", lineHeight: 1.4 }}>
                    {bucket.description}
                  </Typography>
                </Box>

                <Box sx={{ mt: 1.5, pt: 1, borderTop: "1px dashed #E2E8F0" }}>
                  <Typography sx={{ fontSize: "10.5px", fontWeight: 700, color: bucket.isOpen ? "#059669" : "#D97706" }}>
                    {bucket.feeNote}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* Selected Bucket Detail & Action Card */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: 3.5,
          border: "1.5px solid #E2E8F0",
          bgcolor: "#FFFFFF",
          boxShadow: S.card,
          mb: 4,
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 900, color: "#0F172A" }}>
                {selectedBucket.name} Ledger
              </Typography>
              <StatusBadge label={selectedBucket.badgeText} color={selectedBucket.isOpen ? "success" : "default"} />
            </Stack>
            <Typography variant="body2" sx={{ color: "#64748B", fontSize: "13px" }}>
              {selectedBucket.description} • {selectedBucket.feeNote}
            </Typography>
          </Box>

          {selectedBucket.isOpen ? (
            <Button
              variant="contained"
              startIcon={<SendRoundedIcon />}
              onClick={() => setP2pModalOpen(true)}
              sx={{
                bgcolor: selectedBucket.accent,
                "&:hover": { bgcolor: selectedBucket.accent, opacity: 0.9 },
                fontWeight: 800,
                borderRadius: 2.5,
                px: 3,
                textTransform: "none",
              }}
            >
              Send {selectedBucket.name}
            </Button>
          ) : (
            <Button
              variant="outlined"
              disabled
              startIcon={<LockRoundedIcon />}
              sx={{
                borderRadius: 2.5,
                fontWeight: 700,
                textTransform: "none",
                borderColor: "#CBD5E1",
                color: "#94A3B8",
              }}
            >
              Locked by Admin
            </Button>
          )}
        </Stack>

        {/* Voucher List */}
        {voucherData?.results?.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center", bgcolor: "#F8FAFC", borderRadius: 3, border: "1.5px dashed #CBD5E1" }}>
            <ConfirmationNumberRoundedIcon sx={{ fontSize: 40, color: "#94A3B8", mb: 1 }} />
            <Typography sx={{ fontWeight: 800, color: "#334155" }}>No active vouchers in this bucket</Typography>
            <Typography sx={{ fontSize: "12.5px", color: "#64748B", mt: 0.5 }}>
              Use P2P Internal Send or purchase package coupons to populate your pocket.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {(voucherData?.results || []).map((voucher) => (
              <Grid item xs={12} sm={6} md={4} key={voucher.id || voucher.code}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    border: "1.5px solid #E2E8F0",
                    bgcolor: "#F8FAFC",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography sx={{ fontSize: "11px", fontWeight: 800, color: "#2563EB", textTransform: "uppercase" }}>
                        {voucher.voucher_type || "COUPON"}
                      </Typography>
                      <StatusBadge label={voucher.status || "ACTIVE"} color={voucher.status === "ACTIVE" ? "success" : "default"} />
                    </Stack>
                    <Typography sx={{ fontSize: "18px", fontWeight: 900, color: "#0F172A", mb: 1 }}>
                      ₹{fmtAmount(voucher.amount || voucher.value)}
                    </Typography>

                    <Box sx={{ p: 1, bgcolor: "#FFFFFF", borderRadius: 2, border: "1px dashed #CBD5E1", display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                      <Typography sx={{ fontFamily: "monospace", fontWeight: 800, fontSize: "13px", color: "#0F172A" }}>
                        {voucher.code}
                      </Typography>
                      <Tooltip title="Copy Code">
                        <IconButton size="small" onClick={() => handleCopy(voucher.code, voucher.id)}>
                          {copiedId === voucher.id ? <CheckRoundedIcon fontSize="small" sx={{ color: "#16A34A" }} /> : <ContentCopyRoundedIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  <Typography sx={{ fontSize: "11px", color: "#64748B", mt: 1 }}>
                    Created: {fmtDate(voucher.created_at)}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      {/* P2P Transfer Modal */}
      <Dialog
        open={p2pModalOpen}
        onClose={() => setP2pModalOpen(false)}
        PaperProps={{ sx: { borderRadius: 3.5, maxWidth: 460, width: "100%", p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 0.5, fontSize: "18px" }}>
          P2P Internal Coupon Transfer
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info" sx={{ borderRadius: 2.5, fontSize: "12.5px" }}>
              Standard <b>7.00% P2P transfer fee</b> is automatically deducted upon sending.
            </Alert>

            <TextField
              label="Recipient Phone / ID"
              fullWidth
              size="small"
              placeholder="e.g. 9876543210"
              value={p2pForm.recipient_phone}
              onChange={(e) => setP2pForm({ ...p2pForm, recipient_phone: e.target.value })}
            />

            <TextField
              label="Transfer Amount (₹)"
              type="number"
              fullWidth
              size="small"
              placeholder="e.g. 1000"
              value={p2pForm.amount}
              onChange={(e) => setP2pForm({ ...p2pForm, amount: e.target.value })}
            />

            {p2pGross > 0 && (
              <Box sx={{ p: 2, bgcolor: "#F8FAFC", borderRadius: 2.5, border: "1px solid #E2E8F0" }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                  <Typography sx={{ fontSize: "12.5px", color: "#64748B" }}>Gross Amount:</Typography>
                  <Typography sx={{ fontSize: "12.5px", fontWeight: 700, color: "#0F172A" }}>₹{fmtAmount(p2pGross)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                  <Typography sx={{ fontSize: "12.5px", color: "#DC2626" }}>Transfer Fee (7%):</Typography>
                  <Typography sx={{ fontSize: "12.5px", fontWeight: 700, color: "#DC2626" }}>- ₹{fmtAmount(p2pFee)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ pt: 1, borderTop: "1px dashed #CBD5E1" }}>
                  <Typography sx={{ fontSize: "13.5px", fontWeight: 800, color: "#0F172A" }}>Recipient Receives:</Typography>
                  <Typography sx={{ fontSize: "14px", fontWeight: 900, color: "#16A34A" }}>₹{fmtAmount(p2pNet)}</Typography>
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setP2pModalOpen(false)} sx={{ fontWeight: 600, color: "#64748B" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleP2pTransfer}
            disabled={actionLoading || p2pGross <= 0 || !p2pForm.recipient_phone}
            sx={{
              bgcolor: "#2563EB",
              "&:hover": { bgcolor: "#1D4ED8" },
              fontWeight: 800,
              borderRadius: 2,
              px: 3,
            }}
          >
            {actionLoading ? "Processing..." : `Send ₹${fmtAmount(p2pNet)}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
