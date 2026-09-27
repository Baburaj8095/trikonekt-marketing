import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import ConfirmationNumberRoundedIcon from "@mui/icons-material/ConfirmationNumberRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import API from "../api/api";

function fmtAmount(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";
}

function fmtDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  const [activeTab, setActiveTab] = useState(0); // 0: Transfer, 1: Redeem, 2: History
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [wallet, setWallet] = useState({});
  const [voucherData, setVoucherData] = useState({ results: [] });
  const [copiedCode, setCopiedCode] = useState("");

  // Transfer Form State
  const [transferForm, setTransferForm] = useState({
    recipient_phone: "",
    amount: "1000",
  });

  // Manual Redeem State
  const [code, setCode] = useState("");

  // Admin Configured Taxes
  const [taxConfig, setTaxConfig] = useState({
    p2p_package_tax_percent: 7,
    p2p_coupon_tax_percent: 7,
    withdrawal_tax_percent: 10,
  });

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [walletRes, voucherRes, taxRes] = await Promise.all([
        API.get("/accounts/wallet/me/"),
        API.get("/accounts/wallet/vouchers/"),
        API.get("/business/platform-taxes/").catch(() => ({ data: null })),
      ]);
      setWallet(walletRes?.data || {});
      setVoucherData(voucherRes?.data || { results: [] });
      if (taxRes?.data) {
        setTaxConfig({
          p2p_package_tax_percent: Number(taxRes.data.p2p_package_tax_percent ?? 7),
          p2p_coupon_tax_percent: Number(taxRes.data.p2p_coupon_tax_percent ?? 7),
          withdrawal_tax_percent: Number(taxRes.data.withdrawal_tax_percent ?? 10),
        });
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load package coupon pocket.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Balances
  const packageCouponBalance = Number(
    wallet?.transfer_wallets?.packagePurchaseCoupon ||
      voucherData?.package_coupon_wallet_balance ||
      0
  );
  const withdrawableBalance = Number(
    wallet?.withdrawable_balance ||
      wallet?.transfer_wallets?.withdrawal ||
      0
  );

  // Vouchers Separation
  const allVouchers = useMemo(() => voucherData?.results || [], [voucherData]);

  const receivedVouchers = useMemo(
    () =>
      allVouchers.filter(
        (v) =>
          String(v?.voucher_type || "").toUpperCase() === "PACKAGE_PURCHASE" &&
          (
            !currentUser?.username ||
            v?.assigned_to_username === currentUser.username ||
            v?.redeemed_by_username === currentUser.username
          )
      ),
    [currentUser, allVouchers]
  );

  const sentVouchers = useMemo(
    () =>
      allVouchers.filter(
        (v) =>
          String(v?.voucher_type || "").toUpperCase() === "PACKAGE_PURCHASE" &&
          currentUser?.username &&
          v?.creator_username === currentUser.username
      ),
    [currentUser, allVouchers]
  );

  // Transfer Calculations with Admin-Configured Tax
  const transferGross = Number(transferForm.amount || 0);
  const taxPercent = Number(taxConfig.p2p_package_tax_percent || 7);
  const transferTax = transferGross > 0 ? Number(((transferGross * taxPercent) / 100).toFixed(2)) : 0;
  const transferNet = transferGross > 0 ? Number((transferGross - transferTax).toFixed(2)) : 0;

  // Handle P2P Transfer (Send)
  const handleTransfer = async () => {
    if (!transferForm.recipient_phone.trim()) {
      setError("Please enter the recipient Consumer ID or mobile number.");
      return;
    }
    if (transferGross <= 0) {
      setError("Please enter a valid transfer amount.");
      return;
    }
    if (transferGross > withdrawableBalance) {
      setError(`Insufficient withdrawable balance. Your available balance is ₹${fmtAmount(withdrawableBalance)}.`);
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const res = await API.post("/business/coupons/p2p-transfer/", {
        recipient_phone: transferForm.recipient_phone.trim(),
        amount: transferGross,
        coupon_type: "PACKAGE_COUPON",
      });

      const voucherCode = res.data?.voucher_code;
      setSuccess(
        `Package Coupon transferred successfully! Generated Voucher Code: ${voucherCode || "Assigned to recipient"} for net value ₹${fmtAmount(transferNet)} (${taxPercent}% GST/Tax: ₹${fmtAmount(transferTax)}). Recipient can now redeem it on their screen.`
      );
      setTransferForm({ recipient_phone: "", amount: "1000" });
      await load();
      setActiveTab(2); // View history
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to transfer package coupon.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Redeem
  const handleRedeem = async (targetCode = code) => {
    const trimmed = String(targetCode || "").trim();
    if (!trimmed) {
      setError("Please enter or select a voucher code to redeem.");
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      await API.post("/accounts/wallet/vouchers/redeem/", { code: trimmed });
      setCode("");
      setSuccess(`Voucher ${trimmed} successfully redeemed! Amount credited to your Package Purchase Coupon Received wallet.`);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to redeem voucher.");
    } finally {
      setActionLoading(false);
    }
  };

  const copyCode = (voucherCode) => {
    navigator.clipboard.writeText(voucherCode);
    setCopiedCode(voucherCode);
    setTimeout(() => setCopiedCode(""), 2500);
  };

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 1.5, sm: 2.5 }, py: 2.5 }}>
      {/* Top Header Card */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          borderRadius: 3.5,
          background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #3B82F6 100%)",
          color: "#fff",
          mb: 2.5,
          boxShadow: "0 10px 30px rgba(37,99,235,0.22)",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2.5,
                  bgcolor: "rgba(255,255,255,0.18)",
                  backdropFilter: "blur(10px)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <CardGiftcardIcon sx={{ fontSize: 26, color: "#fff" }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>
                P2P Package Coupon
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)", fontSize: "13.5px" }}>
              Unified Transfer & Redeem • Send coupons to members or redeem assigned coupons to buy packages
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5}>
            <IconButton
              onClick={load}
              disabled={loading}
              sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "#fff", "&:hover": { bgcolor: "rgba(255,255,255,0.25)" } }}
            >
              <RefreshRoundedIcon sx={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </IconButton>
            <Button
              variant="contained"
              onClick={() => navigate("/user/promo-packages")}
              startIcon={<ShoppingBagRoundedIcon />}
              sx={{
                bgcolor: "#FFFFFF",
                color: "#1D4ED8",
                fontWeight: 800,
                borderRadius: 2.5,
                px: 2.5,
                py: 1,
                textTransform: "none",
                boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                "&:hover": { bgcolor: "#F8FAFC" },
              }}
            >
              Buy Package
            </Button>
          </Stack>
        </Stack>

        {/* Balance Showcase */}
        <Grid container spacing={2} sx={{ mt: 1.5 }}>
          <Grid item xs={12} sm={6}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: "rgba(255,255,255,0.12)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase" }}>
                Package Coupon Balance (Ready to Buy Packages)
              </Typography>
              <Typography sx={{ fontSize: { xs: "24px", sm: "28px" }, fontWeight: 900, color: "#FFFFFF", mt: 0.5 }}>
                ₹ {fmtAmount(packageCouponBalance)}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase" }}>
                Available Withdrawable Balance (Source for Transfer)
              </Typography>
              <Typography sx={{ fontSize: { xs: "24px", sm: "28px" }, fontWeight: 900, color: "#A7F3D0", mt: 0.5 }}>
                ₹ {fmtAmount(withdrawableBalance)}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

      {/* Unified Screen Mode Tabs */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: "1.5px solid #E2E8F0",
          bgcolor: "#FFFFFF",
          mb: 2.5,
          overflow: "hidden",
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          variant="fullWidth"
          sx={{
            bgcolor: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
            "& .MuiTab-root": {
              py: 2,
              fontWeight: 800,
              fontSize: { xs: "13px", sm: "14.5px" },
              textTransform: "none",
              color: "#64748B",
              "&.Mui-selected": {
                color: "#2563EB",
                bgcolor: "#FFFFFF",
              },
            },
          }}
        >
          <Tab icon={<SendRoundedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Transfer Package Coupon" />
          <Tab icon={<ConfirmationNumberRoundedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Redeem Package Coupon" />
          <Tab icon={<HistoryRoundedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Coupon History" />
        </Tabs>

        {/* TAB 0: TRANSFER / SEND PACKAGE COUPON */}
        {activeTab === 0 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 900, color: "#0F172A", fontSize: "18px" }}>
                Send Package Coupon to Member
              </Typography>
              <Typography variant="body2" sx={{ color: "#64748B", fontSize: "13px", mt: 0.3 }}>
                One member transfers coupon value to another member. Applicable GST/Tax ({taxPercent}%) is automatically deducted, and a package purchase coupon is instantly assigned to the recipient to redeem.
              </Typography>
            </Box>

            <Grid container spacing={2.5}>
              <Grid item xs={12} md={7}>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Recipient Consumer ID or Mobile Number"
                    placeholder="Enter recipient ID (e.g. 8095918105)"
                    value={transferForm.recipient_phone}
                    onChange={(e) => setTransferForm({ ...transferForm, recipient_phone: e.target.value })}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonRoundedIcon sx={{ color: "#94A3B8" }} />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Box>
                    <TextField
                      fullWidth
                      label="Transfer Amount (₹)"
                      placeholder="e.g. 1000"
                      type="number"
                      value={transferForm.amount}
                      onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                      }}
                    />
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      {["1000", "2000", "5000", "10000"].map((preset) => (
                        <Chip
                          key={preset}
                          label={`₹${Number(preset).toLocaleString("en-IN")}`}
                          clickable
                          onClick={() => setTransferForm({ ...transferForm, amount: preset })}
                          variant={transferForm.amount === preset ? "filled" : "outlined"}
                          color={transferForm.amount === preset ? "primary" : "default"}
                          size="small"
                          sx={{ fontWeight: 700 }}
                        />
                      ))}
                    </Stack>
                  </Box>

                  <Button
                    variant="contained"
                    size="large"
                    disabled={actionLoading || transferGross <= 0 || !transferForm.recipient_phone.trim()}
                    onClick={handleTransfer}
                    startIcon={actionLoading ? <CircularProgress size={18} color="inherit" /> : <SendRoundedIcon />}
                    sx={{
                      py: 1.5,
                      borderRadius: 2.5,
                      fontWeight: 800,
                      fontSize: "15px",
                      textTransform: "none",
                      bgcolor: "#2563EB",
                      "&:hover": { bgcolor: "#1D4ED8" },
                    }}
                  >
                    {actionLoading
                      ? "Transferring..."
                      : `Transfer ₹${fmtAmount(transferGross)} (Net: ₹${fmtAmount(transferNet)})`}
                  </Button>
                </Stack>
              </Grid>

              {/* Real-Time Tax & Fee Breakdown Card */}
              <Grid item xs={12} md={5}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 2.5,
                    bgcolor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <Typography sx={{ fontWeight: 800, color: "#1E293B", fontSize: "14px", mb: 1.5 }}>
                    Transfer Breakdown
                  </Typography>

                  <Stack spacing={1.2}>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: "13px", color: "#64748B" }}>Gross Transfer Amount:</Typography>
                      <Typography sx={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>
                        ₹ {fmtAmount(transferGross)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: "13px", color: "#DC2626" }}>
                        Platform Tax / GST ({taxPercent}%):
                      </Typography>
                      <Typography sx={{ fontSize: "13px", fontWeight: 700, color: "#DC2626" }}>
                        - ₹ {fmtAmount(transferTax)}
                      </Typography>
                    </Box>

                    <Divider sx={{ my: 0.5 }} />

                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: "14px", fontWeight: 900, color: "#1D4ED8" }}>
                        Net Coupon Value Delivered:
                      </Typography>
                      <Typography sx={{ fontSize: "15px", fontWeight: 900, color: "#1D4ED8" }}>
                        ₹ {fmtAmount(transferNet)}
                      </Typography>
                    </Box>
                  </Stack>

                  <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                    <Typography sx={{ fontSize: "12px", color: "#1E40AF", lineHeight: 1.5 }}>
                      <b>Tax Notice:</b> The {taxPercent}% GST/platform tax is configured in the Admin Control Screen. Transferred coupons are instantly redeemable by the recipient into their Package Purchase wallet.
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* TAB 1: REDEEM PACKAGE COUPON */}
        {activeTab === 1 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {/* Quick Code Entry Card */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 2.5,
                bgcolor: "#F8FAFC",
                border: "1.5px solid #E2E8F0",
                mb: 3,
              }}
            >
              <Typography sx={{ fontWeight: 900, color: "#0F172A", mb: 0.5, fontSize: "16px" }}>
                Redeem Package Coupon Code
              </Typography>
              <Typography sx={{ fontSize: "13px", color: "#64748B", mb: 2 }}>
                Enter the package coupon code (e.g. PKG-XXXXXXXX) received from another member or promotion.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  fullWidth
                  size="small"
                  label="Self Package Coupon Code"
                  placeholder="Enter PKG-... coupon code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ConfirmationNumberRoundedIcon sx={{ color: "#94A3B8" }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  variant="contained"
                  disabled={actionLoading || !code.trim()}
                  onClick={() => handleRedeem(code)}
                  sx={{
                    px: 3.5,
                    py: { xs: 1.2, sm: 0 },
                    fontWeight: 800,
                    borderRadius: 2,
                    textTransform: "none",
                    bgcolor: "#7C3AED",
                    "&:hover": { bgcolor: "#6D28D9" },
                    whiteSpace: "nowrap",
                  }}
                >
                  {actionLoading ? "Redeeming..." : "Redeem Now"}
                </Button>
              </Stack>
            </Paper>

            {/* Received Vouchers List with 1-Click Redeem */}
            <Box>
              <Typography sx={{ fontWeight: 900, color: "#0F172A", fontSize: "17px", mb: 0.5 }}>
                Your Received Package Coupon Vouchers
              </Typography>
              <Typography sx={{ fontSize: "13px", color: "#64748B", mb: 2 }}>
                Package coupons assigned to your account. Click "Redeem" to add the amount to your Buy Package wallet.
              </Typography>

              <Stack spacing={1.5}>
                {receivedVouchers.map((voucher) => {
                  const isActive = String(voucher.status || "").toUpperCase() === "ACTIVE";
                  return (
                    <Paper
                      key={voucher.id}
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        border: "1px solid",
                        borderColor: isActive ? "#BFDBFE" : "#E2E8F0",
                        bgcolor: isActive ? "#F0F9FF" : "#FFFFFF",
                        display: "flex",
                        flexDirection: { xs: "column", sm: "row" },
                        justifyContent: "space-between",
                        alignItems: { xs: "flex-start", sm: "center" },
                        gap: 1.5,
                      }}
                    >
                      <Box>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography sx={{ fontWeight: 900, fontSize: "16px", color: "#0F172A" }}>
                            ₹ {fmtAmount(voucher.amount)}
                          </Typography>
                          <Chip
                            size="small"
                            label={voucher.code}
                            onClick={() => copyCode(voucher.code)}
                            onDelete={() => copyCode(voucher.code)}
                            deleteIcon={copiedCode === voucher.code ? <CheckRoundedIcon sx={{ fontSize: 14 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />}
                            sx={{ fontWeight: 700, bgcolor: "#E2E8F0" }}
                          />
                        </Stack>
                        <Typography sx={{ color: "#64748B", fontSize: "12.5px", mt: 0.4 }}>
                          From: <b>{voucher.creator_username || "Direct Transfer"}</b> • Valid till: {fmtDate(voucher.expires_at)}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={1.2} alignItems="center">
                        <Chip
                          size="small"
                          label={voucher.status}
                          color={isActive ? "success" : "default"}
                          sx={{ fontWeight: 800 }}
                        />
                        {isActive && (
                          <Button
                            size="small"
                            variant="contained"
                            disabled={actionLoading}
                            onClick={() => handleRedeem(voucher.code)}
                            sx={{
                              bgcolor: "#2563EB",
                              fontWeight: 800,
                              borderRadius: 2,
                              textTransform: "none",
                              px: 2,
                              "&:hover": { bgcolor: "#1D4ED8" },
                            }}
                          >
                            Redeem
                          </Button>
                        )}
                      </Stack>
                    </Paper>
                  );
                })}

                {!receivedVouchers.length && !loading && (
                  <Paper
                    elevation={0}
                    sx={{ p: 4, textAlign: "center", borderRadius: 2.5, bgcolor: "#F8FAFC", border: "1px dashed #CBD5E1" }}
                  >
                    <CardGiftcardIcon sx={{ fontSize: 40, color: "#94A3B8", mb: 1 }} />
                    <Typography sx={{ color: "#64748B", fontWeight: 700 }}>
                      No package coupons assigned yet.
                    </Typography>
                    <Typography sx={{ color: "#94A3B8", fontSize: "12.5px", mt: 0.3 }}>
                      When another member transfers a package coupon to your ID, it will appear here for 1-click redemption.
                    </Typography>
                  </Paper>
                )}
              </Stack>
            </Box>
          </Box>
        )}

        {/* TAB 2: COUPON HISTORY (SENT & RECEIVED) */}
        {activeTab === 2 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h6" sx={{ fontWeight: 900, color: "#0F172A", fontSize: "17px", mb: 2 }}>
              Sent Package Coupons (Transferred to Others)
            </Typography>

            <Stack spacing={1.5} sx={{ mb: 4 }}>
              {sentVouchers.map((voucher) => (
                <Paper
                  key={voucher.id}
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: "1px solid #E2E8F0",
                    bgcolor: "#FFFFFF",
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    justifyContent: "space-between",
                    alignItems: { xs: "flex-start", sm: "center" },
                    gap: 1.5,
                  }}
                >
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography sx={{ fontWeight: 900, fontSize: "15px", color: "#0F172A" }}>
                        ₹ {fmtAmount(voucher.amount)}
                      </Typography>
                      <Chip size="small" label={voucher.code} sx={{ fontWeight: 700 }} />
                    </Stack>
                    <Typography sx={{ color: "#64748B", fontSize: "12.5px", mt: 0.4 }}>
                      Recipient: <b>{voucher.assigned_to_username || "Assigned Member"}</b> • Sent on: {fmtDate(voucher.created_at)}
                    </Typography>
                  </Box>

                  <Chip
                    size="small"
                    label={voucher.status}
                    color={voucher.status === "ACTIVE" ? "primary" : voucher.status === "REDEEMED" ? "success" : "default"}
                    sx={{ fontWeight: 800 }}
                  />
                </Paper>
              ))}

              {!sentVouchers.length && !loading && (
                <Paper elevation={0} sx={{ p: 3, textAlign: "center", borderRadius: 2.5, bgcolor: "#F8FAFC", border: "1px dashed #CBD5E1" }}>
                  <Typography sx={{ color: "#64748B", fontWeight: 700 }}>No sent package coupons yet.</Typography>
                </Paper>
              )}
            </Stack>

            <Typography variant="h6" sx={{ fontWeight: 900, color: "#0F172A", fontSize: "17px", mb: 2 }}>
              Received Package Coupons
            </Typography>

            <Stack spacing={1.5}>
              {receivedVouchers.map((voucher) => (
                <Paper
                  key={voucher.id}
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: "1px solid #E2E8F0",
                    bgcolor: "#FFFFFF",
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    justifyContent: "space-between",
                    alignItems: { xs: "flex-start", sm: "center" },
                    gap: 1.5,
                  }}
                >
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography sx={{ fontWeight: 900, fontSize: "15px", color: "#0F172A" }}>
                        ₹ {fmtAmount(voucher.amount)}
                      </Typography>
                      <Chip size="small" label={voucher.code} sx={{ fontWeight: 700 }} />
                    </Stack>
                    <Typography sx={{ color: "#64748B", fontSize: "12.5px", mt: 0.4 }}>
                      From: <b>{voucher.creator_username || "Direct Transfer"}</b> • {fmtDate(voucher.created_at)}
                    </Typography>
                  </Box>

                  <Chip
                    size="small"
                    label={voucher.status}
                    color={voucher.status === "ACTIVE" ? "success" : "default"}
                    sx={{ fontWeight: 800 }}
                  />
                </Paper>
              ))}
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
