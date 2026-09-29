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
import FlightTakeoffRoundedIcon from "@mui/icons-material/FlightTakeoffRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import API from "../api/api";
import { S } from "../theme/tokens";
import StatusBadge from "../components/common/StatusBadge";

const COUPON_BUCKETS = [
  {
    id: "P2P_INTERNAL",
    name: "P2P Package Coupon",
    description: "Instant peer-to-peer package coupon transfer to any Trikonekt user",
    isOpen: true,
    badgeText: "ACTIVE",
    badgeColor: "success",
    icon: SendRoundedIcon,
    accent: "#2563EB",
    feeNote: "7% transfer fee applies on P2P send",
  },
  {
    id: "TRI_HOLIDAY",
    name: "Tri Holiday Coupon",
    description: "Redeemable towards premium domestic & international travel packages",
    isOpen: false,
    badgeText: "DISABLED",
    badgeColor: "default",
    icon: FlightTakeoffRoundedIcon,
    accent: "#64748B",
    feeNote: "Disabled by Admin",
  },
  {
    id: "TRIZONE",
    name: "Trizone Coupon",
    description: "Exclusive discounts across Trizone verified merchant hubs",
    isOpen: false,
    badgeText: "DISABLED",
    badgeColor: "default",
    icon: ShoppingBagRoundedIcon,
    accent: "#64748B",
    feeNote: "Disabled by Admin",
  },
  {
    id: "ONLINE",
    name: "Online Coupon",
    description: "Digital e-commerce shopping vouchers for partnered brands",
    isOpen: false,
    badgeText: "DISABLED",
    badgeColor: "default",
    icon: LanguageRoundedIcon,
    accent: "#64748B",
    feeNote: "Disabled by Admin",
  },
  {
    id: "NEAR_STORE",
    name: "Near Store Coupon",
    description: "Hyperlocal retail store discounts across verified offline shops",
    isOpen: false,
    badgeText: "DISABLED",
    badgeColor: "default",
    icon: StorefrontRoundedIcon,
    accent: "#64748B",
    feeNote: "Disabled by Admin",
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
  const [p2pModalError, setP2pModalError] = useState("");
  const [p2pModalSuccess, setP2pModalSuccess] = useState("");

  // Recipient Verification State
  const [recipientValid, setRecipientValid] = useState(null); // null | true | false
  const [recipientChecking, setRecipientChecking] = useState(false);
  const [recipientInfo, setRecipientInfo] = useState(null);

  const [redeemModalOpen, setRedeemModalOpen] = useState(false);
  const [redeemForm, setRedeemForm] = useState({
    coupon_code: "",
    category: "ECOMMERCE_SHOPPING",
    pin: "",
  });
  const [redeemModalError, setRedeemModalError] = useState("");
  const [redeemModalSuccess, setRedeemModalSuccess] = useState("");

  const currentUsername = useMemo(() => {
    try {
      const ls =
        localStorage.getItem("user_user") ||
        sessionStorage.getItem("user_user") ||
        localStorage.getItem("user") ||
        sessionStorage.getItem("user");
      const u = ls ? JSON.parse(ls) : null;
      return String(u?.username || "").trim();
    } catch {
      return "";
    }
  }, []);

  // Explicit Recipient Verification
  const handleVerifyRecipient = async () => {
    const val = String(p2pForm.recipient_phone || "").trim();
    if (!val) {
      setRecipientValid(false);
      setRecipientInfo(null);
      return;
    }
    setRecipientChecking(true);
    setRecipientValid(null);
    setRecipientInfo(null);
    setP2pModalError("");
    try {
      let found = false;
      let info = null;

      // Check 1: Sponsor / Region lookup
      try {
        const res = await API.get("/accounts/regions/by-sponsor/", {
          params: { sponsor: val, level: "state" },
        });
        const sp = res?.data?.sponsor;
        if (sp && sp.username) {
          found = true;
          info = {
            name: sp.full_name || sp.username,
            username: sp.username,
            phone: sp.phone || sp.username,
            pincode: sp.pincode,
          };
        }
      } catch {}

      // Check 2: User hierarchy lookup fallback
      if (!found) {
        try {
          const res2 = await API.get("/accounts/hierarchy/", {
            params: { username: val },
          });
          const u = res2?.data?.user || res2?.data;
          if (u && (u.username || u.full_name)) {
            found = true;
            info = {
              name: u.full_name || u.username,
              username: u.username,
              phone: u.phone || u.username,
              pincode: u.pincode,
            };
          }
        } catch {}
      }

      if (found && info) {
        setRecipientValid(true);
        setRecipientInfo(info);
      } else {
        setRecipientValid(false);
        setRecipientInfo(null);
      }
    } catch {
      setRecipientValid(false);
      setRecipientInfo(null);
    } finally {
      setRecipientChecking(false);
    }
  };

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
  const mainBalance = Number(wallet?.main_balance || wallet?.balance || 0);
  const availableBalance = Number(wallet?.main_balance || wallet?.balance || wallet?.withdrawable_balance || 0);

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
    setP2pModalError("");
    setP2pModalSuccess("");
    if (!p2pForm.recipient_phone.trim()) {
      setP2pModalError("Please enter the recipient phone number.");
      return;
    }
    if (p2pGross <= 0) {
      setP2pModalError("Please enter a valid transfer amount.");
      return;
    }
    if (p2pGross > availableBalance && p2pGross > couponBalance) {
      setP2pModalError(`Insufficient balance. Your available balance is ₹${fmtAmount(availableBalance)}.`);
      return;
    }

    try {
      setActionLoading(true);
      const res = await API.post("/business/coupons/p2p-transfer/", {
        recipient_phone: p2pForm.recipient_phone.trim(),
        amount: p2pGross,
        coupon_type: p2pForm.coupon_type,
      });

      const vCode = res?.data?.voucher_code;
      const successMsg = `Successfully sent ₹${fmtAmount(p2pNet)} to ${p2pForm.recipient_phone}! (7% Fee: ₹${fmtAmount(p2pFee)})${vCode ? ` • Voucher: ${vCode}` : ""}`;
      setP2pModalSuccess(successMsg);
      setSuccess(successMsg);
      setP2pForm({ recipient_phone: "", amount: "", coupon_type: "PACKAGE_COUPON", note: "" });
      setRecipientValid(null);
      setRecipientInfo(null);
      setTimeout(() => {
        setP2pModalOpen(false);
        setP2pModalSuccess("");
      }, 2500);
      load();
    } catch (err) {
      const errMsg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to process P2P transfer.";
      setP2pModalError(errMsg);
      setError(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRedeemCoupon = async () => {
    setRedeemModalError("");
    setRedeemModalSuccess("");
    const codeToRedeem = redeemForm.coupon_code.trim();
    if (!codeToRedeem) {
      setRedeemModalError("Please enter the coupon code to redeem.");
      return;
    }
    try {
      setActionLoading(true);
      await API.post("/accounts/wallet/vouchers/redeem/", {
        code: codeToRedeem,
        category: redeemForm.category,
      });

      const msg = `Coupon ${codeToRedeem} redeemed successfully for ${redeemForm.category.replace(/_/g, " ")}!`;
      setRedeemModalSuccess(msg);
      setSuccess(msg);
      setTimeout(() => {
        setRedeemModalOpen(false);
        setRedeemModalSuccess("");
        setRedeemForm({ coupon_code: "", category: "ECOMMERCE_SHOPPING", pin: "" });
      }, 2000);
      load();
    } catch (err) {
      const errMsg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to redeem coupon.";
      setRedeemModalError(errMsg);
      setError(errMsg);
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
              Peer-to-Peer coupon routing, package vouchers, and ledger history
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ width: { xs: "100%", sm: "auto" } }}>
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
              onClick={() => {
                setP2pModalError("");
                setP2pModalSuccess("");
                setP2pModalOpen(true);
              }}
              sx={{
                background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                color: "#fff",
                fontWeight: 800,
                px: 2.5,
                py: 1,
                borderRadius: 2.5,
                textTransform: "none",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 14px rgba(37,99,235,0.4)",
              }}
            >
              P2P Send (7% Fee)
            </Button>

            <Button
              variant="contained"
              fullWidth
              startIcon={<ShoppingBagRoundedIcon />}
              onClick={() => {
                setRedeemModalError("");
                setRedeemModalSuccess("");
                setRedeemModalOpen(true);
              }}
              sx={{
                background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                color: "#fff",
                fontWeight: 800,
                px: 2.5,
                py: 1,
                borderRadius: 2.5,
                textTransform: "none",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 14px rgba(5,150,105,0.4)",
              }}
            >
              Redeem Coupon
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
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Active Category</Typography>
              <Typography sx={{ fontSize: "18px", fontWeight: 900, color: "#C084FC" }}>Package Coupon</Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2.5, fontWeight: 600 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2.5, borderRadius: 2.5, fontWeight: 600 }}>{success}</Alert>}

      {/* Bucket Selector Grid */}
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
                  opacity: bucket.isOpen ? 1 : 0.7,
                  "&:hover": {
                    borderColor: bucket.accent,
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
                    <Box sx={{ p: 1, borderRadius: 2, bgcolor: bucket.isOpen ? `${bucket.accent}15` : "#F1F5F9" }}>
                      <Icon sx={{ color: bucket.isOpen ? bucket.accent : "#94A3B8", fontSize: 22 }} />
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
                  <Typography sx={{ fontSize: "10.5px", fontWeight: 700, color: bucket.isOpen ? "#059669" : "#64748B" }}>
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
              onClick={() => {
                setP2pModalError("");
                setP2pModalSuccess("");
                setP2pModalOpen(true);
              }}
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
            <Typography sx={{ fontWeight: 800, color: "#334155" }}>No vouchers found in your ledger</Typography>
            <Typography sx={{ fontSize: "12.5px", color: "#64748B", mt: 0.5 }}>
              Use P2P Internal Send or purchase package coupons to populate your pocket.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {(voucherData?.results || []).map((voucher) => {
              const creator = String(voucher.creator_username || "").trim();
              const assigned = String(voucher.assigned_to_username || "").trim();
              const isSender = Boolean(currentUsername && creator === currentUsername && assigned && assigned !== currentUsername);
              const isRedeemed = voucher.status === "REDEEMED";
              const isActive = voucher.status === "ACTIVE";

              return (
                <Grid item xs={12} sm={6} md={4} key={voucher.id || voucher.code}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      border: isSender ? "1.5px solid #BFDBFE" : "1.5px solid #E2E8F0",
                      bgcolor: isSender ? "#F8FAFC" : "#FFFFFF",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      position: "relative",
                    }}
                  >
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Typography sx={{ fontSize: "11px", fontWeight: 800, color: isSender ? "#2563EB" : "#059669", textTransform: "uppercase" }}>
                            {voucher.voucher_type || "PACKAGE_COUPON"}
                          </Typography>
                          {isSender && (
                            <Chip
                              label="SENT P2P"
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: "10px",
                                fontWeight: 800,
                                bgcolor: "#DBEAFE",
                                color: "#1E40AF",
                              }}
                            />
                          )}
                        </Stack>

                        <StatusBadge
                          label={isSender ? (isRedeemed ? "REDEEMED" : "SENT (ACTIVE)") : (voucher.status || "ACTIVE")}
                          color={isRedeemed ? "default" : isActive ? "success" : "warning"}
                        />
                      </Stack>

                      <Typography sx={{ fontSize: "18px", fontWeight: 900, color: "#0F172A", mb: 1 }}>
                        ₹{fmtAmount(voucher.amount || voucher.value)}
                      </Typography>

                      <Box sx={{ p: 1, bgcolor: "#F8FAFC", borderRadius: 2, border: "1px dashed #CBD5E1", display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                        <Typography sx={{ fontFamily: "monospace", fontWeight: 800, fontSize: "13px", color: "#0F172A" }}>
                          {voucher.code}
                        </Typography>
                        <Tooltip title="Copy Code">
                          <IconButton size="small" onClick={() => handleCopy(voucher.code, voucher.id)}>
                            {copiedId === voucher.id ? <CheckRoundedIcon fontSize="small" sx={{ color: "#16A34A" }} /> : <ContentCopyRoundedIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {/* Recipient / Creator metadata tag */}
                      <Box sx={{ mb: 1 }}>
                        {isSender ? (
                          <Typography sx={{ fontSize: "11.5px", color: "#2563EB", fontWeight: 700 }}>
                            Sent to: {assigned || "Assigned User"}
                          </Typography>
                        ) : assigned ? (
                          <Typography sx={{ fontSize: "11.5px", color: "#64748B", fontWeight: 600 }}>
                            From: {creator || "Admin"}
                          </Typography>
                        ) : null}
                      </Box>
                    </Box>

                    <Box sx={{ mt: 1.5, pt: 1, borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography sx={{ fontSize: "11px", color: "#64748B" }}>
                        {isRedeemed && voucher.redeemed_at
                          ? `Redeemed: ${fmtDate(voucher.redeemed_at)}`
                          : `Created: ${fmtDate(voucher.created_at)}`}
                      </Typography>

                      {/* Action Button: Senders only view history; only Recipients can Redeem active vouchers */}
                      {isSender ? (
                        <Chip
                          label={isRedeemed ? "Redeemed by Recipient" : "P2P Sent"}
                          size="small"
                          sx={{
                            fontSize: "11px",
                            fontWeight: 700,
                            bgcolor: isRedeemed ? "#F1F5F9" : "#EFF6FF",
                            color: isRedeemed ? "#64748B" : "#1D4ED8",
                            border: isRedeemed ? "1px solid #E2E8F0" : "1px solid #BFDBFE",
                          }}
                        />
                      ) : isActive ? (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<ShoppingBagRoundedIcon sx={{ fontSize: 14 }} />}
                          onClick={() => {
                            setRedeemModalError("");
                            setRedeemModalSuccess("");
                            setRedeemForm({ coupon_code: voucher.code, category: "ECOMMERCE_SHOPPING", pin: "" });
                            setRedeemModalOpen(true);
                          }}
                          sx={{
                            fontSize: "11px",
                            fontWeight: 800,
                            textTransform: "none",
                            borderRadius: 1.5,
                            bgcolor: "#059669",
                            color: "#fff",
                            "&:hover": { bgcolor: "#047857" },
                          }}
                        >
                          Redeem
                        </Button>
                      ) : isRedeemed ? (
                        <Chip
                          label="Redeemed"
                          size="small"
                          sx={{
                            fontSize: "11px",
                            fontWeight: 700,
                            bgcolor: "#F1F5F9",
                            color: "#64748B",
                          }}
                        />
                      ) : (
                        <Chip
                          label="Expired"
                          size="small"
                          sx={{
                            fontSize: "11px",
                            fontWeight: 700,
                            bgcolor: "#FEF2F2",
                            color: "#DC2626",
                          }}
                        />
                      )}
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
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

            {p2pModalError && <Alert severity="error" sx={{ borderRadius: 2.5, fontSize: "12.5px" }}>{p2pModalError}</Alert>}
            {p2pModalSuccess && <Alert severity="success" sx={{ borderRadius: 2.5, fontSize: "12.5px" }}>{p2pModalSuccess}</Alert>}

            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  label="Recipient Phone / User ID"
                  fullWidth
                  size="small"
                  placeholder="e.g. 9876543210"
                  value={p2pForm.recipient_phone}
                  onChange={(e) => {
                    setP2pForm({ ...p2pForm, recipient_phone: e.target.value });
                    setRecipientValid(null);
                    setRecipientInfo(null);
                    setP2pModalError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleVerifyRecipient();
                    }
                  }}
                />
                <Button
                  variant="contained"
                  disabled={recipientChecking || !p2pForm.recipient_phone.trim()}
                  onClick={handleVerifyRecipient}
                  sx={{
                    py: 1,
                    px: 2,
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 800,
                    fontSize: "12.5px",
                    bgcolor: "#0F172A",
                    "&:hover": { bgcolor: "#1E293B" },
                    whiteSpace: "nowrap",
                    minWidth: 80,
                  }}
                >
                  {recipientChecking ? <CircularProgress size={14} color="inherit" /> : "Verify"}
                </Button>
              </Stack>

              {!recipientChecking && recipientValid === true && recipientInfo && (
                <Paper
                  elevation={0}
                  sx={{
                    mt: 1,
                    p: 1,
                    px: 1.2,
                    borderRadius: 2,
                    bgcolor: "#ECFDF5",
                    border: "1px solid #A7F3D0",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <CheckRoundedIcon sx={{ color: "#059669", fontSize: 18 }} />
                  <Box>
                    <Typography sx={{ fontSize: "12px", fontWeight: 800, color: "#065F46" }}>
                      Verified: {recipientInfo.name}
                    </Typography>
                    <Typography sx={{ fontSize: "11px", color: "#047857" }}>
                      ID/Phone: {recipientInfo.username} {recipientInfo.pincode ? `• PIN: ${recipientInfo.pincode}` : ""}
                    </Typography>
                  </Box>
                </Paper>
              )}

              {!recipientChecking && recipientValid === false && (
                <Typography sx={{ fontSize: "11.5px", color: "#DC2626", fontWeight: 600, mt: 0.8, px: 0.5 }}>
                  ⚠ Recipient not found. Please verify the mobile number or user ID.
                </Typography>
              )}
            </Box>

            <TextField
              label="Transfer Amount (₹)"
              type="number"
              fullWidth
              size="small"
              placeholder="e.g. 1000"
              value={p2pForm.amount}
              onChange={(e) => {
                setP2pForm({ ...p2pForm, amount: e.target.value });
                setP2pModalError("");
              }}
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
            disabled={actionLoading || p2pGross <= 0 || !p2pForm.recipient_phone || recipientValid !== true}
            sx={{
              bgcolor: "#2563EB",
              "&:hover": { bgcolor: "#1D4ED8" },
              fontWeight: 800,
              borderRadius: 2,
              px: 3,
            }}
          >
            {actionLoading ? "Processing..." : recipientValid === true ? `Send ₹${fmtAmount(p2pNet)}` : "Verify Recipient to Send"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Redeem Coupon Modal */}
      <Dialog
        open={redeemModalOpen}
        onClose={() => setRedeemModalOpen(false)}
        PaperProps={{ sx: { borderRadius: 3.5, maxWidth: 460, width: "100%", p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 0.5, fontSize: "18px" }}>
          Redeem Coupon / Voucher
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="success" sx={{ borderRadius: 2.5, fontSize: "12.5px" }}>
              Redeem 100% face value towards package purchases or shopping.
            </Alert>

            {redeemModalError && <Alert severity="error" sx={{ borderRadius: 2.5, fontSize: "12.5px" }}>{redeemModalError}</Alert>}
            {redeemModalSuccess && <Alert severity="success" sx={{ borderRadius: 2.5, fontSize: "12.5px" }}>{redeemModalSuccess}</Alert>}

            <TextField
              label="Coupon / Voucher Code"
              fullWidth
              size="small"
              placeholder="e.g. PKG-53BF758F"
              value={redeemForm.coupon_code}
              onChange={(e) => {
                setRedeemForm({ ...redeemForm, coupon_code: e.target.value });
                setRedeemModalError("");
              }}
            />

            <TextField
              select
              label="Redemption Channel"
              fullWidth
              size="small"
              value={redeemForm.category}
              onChange={(e) => setRedeemForm({ ...redeemForm, category: e.target.value })}
            >
              <MenuItem value="ECOMMERCE_SHOPPING">Package Purchase / E-Commerce (Instant Balance)</MenuItem>
              <MenuItem value="NEAR_STORE_MERCHANT" disabled>Near Store / Offline Merchant Store (Disabled)</MenuItem>
              <MenuItem value="TRI_HOLIDAY" disabled>Tri Holiday Travel Package (Disabled)</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRedeemModalOpen(false)} sx={{ fontWeight: 600, color: "#64748B" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRedeemCoupon}
            disabled={actionLoading || !redeemForm.coupon_code.trim()}
            sx={{
              bgcolor: "#059669",
              "&:hover": { bgcolor: "#047857" },
              fontWeight: 800,
              borderRadius: 2,
              px: 3,
            }}
          >
            {actionLoading ? "Processing..." : "Confirm Redemption"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
