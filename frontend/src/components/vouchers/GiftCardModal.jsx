import React, { useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import CurrencyRupeeRoundedIcon from "@mui/icons-material/CurrencyRupeeRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CardGiftcardRoundedIcon from "@mui/icons-material/CardGiftcardRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import API from "../../api/api";

function fmtAmount(val) {
  const n = Number(val || 0);
  return Number.isFinite(n) ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";
}

function fmtDate(val) {
  if (!val) return "Recent";
  try {
    return new Date(val).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return String(val);
  }
}

export default function GiftCardModal({
  open,
  onClose,
  voucher,
  onRedeemSuccess,
}) {
  const [copied, setCopied] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [justRedeemed, setJustRedeemed] = useState(false);

  if (!voucher) return null;

  const code = voucher.code || voucher.voucher_code || "";
  const amount = voucher.amount ?? voucher.value ?? voucher.net_amount ?? voucher.gross_amount ?? 0;
  const sender = voucher.creator_username || voucher.creator || voucher.from || "Admin";
  const createdDate = voucher.created_at || voucher.created || voucher.date || new Date();
  const isRedeemed = voucher.status === "REDEEMED" || justRedeemed;
  const isActive = (voucher.status === "ACTIVE" || !voucher.status) && !justRedeemed;

  const handleCopy = () => {
    if (code && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleRedeem = async () => {
    if (!code || isRedeemed || redeeming) return;
    setRedeeming(true);
    setRedeemError("");
    try {
      await API.post("/accounts/wallet/vouchers/redeem/", {
        code: code,
        category: "PACKAGE_PURCHASE",
      });
      setJustRedeemed(true);
      if (onRedeemSuccess) {
        onRedeemSuccess(voucher);
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to redeem voucher. Please try again.";
      setRedeemError(msg);
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "28px",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(15, 23, 42, 0.35)",
          bgcolor: "#ffffff",
          m: { xs: 1.5, sm: 2 },
          maxHeight: "92vh",
        },
      }}
    >
      <DialogContent sx={{ p: 0, overflowY: "auto" }}>
        {/* 1. FESTIVE HEADER WITH 3D GIFTS & CELEBRATION */}
        <Box
          sx={{
            position: "relative",
            background: "linear-gradient(135deg, #6366f1 0%, #3b82f6 45%, #0ea5e9 100%)",
            px: { xs: 2.5, sm: 4 },
            pt: { xs: 3, sm: 3.5 },
            pb: { xs: 2.5, sm: 3 },
            color: "#ffffff",
            overflow: "hidden",
          }}
        >
          {/* Confetti & Particle Decor */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: "none",
              background:
                "radial-gradient(circle at 10% 20%, rgba(253, 224, 71, 0.4) 0%, transparent 20%), radial-gradient(circle at 90% 80%, rgba(236, 72, 153, 0.4) 0%, transparent 25%), radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.15) 0%, transparent 60%)",
            }}
          />

          {/* Close button */}
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              position: "absolute",
              top: 14,
              right: 14,
              bgcolor: "rgba(15, 23, 42, 0.35)",
              color: "#ffffff",
              backdropFilter: "blur(4px)",
              "&:hover": { bgcolor: "rgba(15, 23, 42, 0.55)" },
              zIndex: 3,
            }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            spacing={2}
            sx={{ position: "relative", zIndex: 1 }}
          >
            {/* 3D Gift Box Visual */}
            <Box
              sx={{
                width: { xs: 64, sm: 76 },
                height: { xs: 64, sm: 76 },
                borderRadius: "20px",
                background: "linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 10px 25px rgba(244, 63, 94, 0.45)",
                border: "2px solid rgba(255,255,255,0.4)",
                flexShrink: 0,
              }}
            >
              <CardGiftcardRoundedIcon sx={{ fontSize: { xs: 36, sm: 44 }, color: "#ffffff" }} />
            </Box>

            <Box>
              <Typography
                sx={{
                  fontSize: { xs: 22, sm: 26 },
                  fontWeight: 900,
                  letterSpacing: "-0.5px",
                  lineHeight: 1.15,
                  color: "#ffffff",
                }}
              >
                Congratulations!
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: 14.5, sm: 16 },
                  fontWeight: 700,
                  color: "#e0e7ff",
                  mt: 0.5,
                }}
              >
                You received a P2P Package Coupon
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: 11.5, sm: 12.5 },
                  color: "rgba(255, 255, 255, 0.85)",
                  mt: 0.25,
                  fontWeight: 500,
                }}
              >
                Instant peer-to-peer package transfer • 7% transfer fee applies on P2P send
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* 2. BODY SECTION (GIFT CARD + DETAILS) */}
        <Box sx={{ p: { xs: 2.5, sm: 3.5 }, bgcolor: "#f8fafc" }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={{ xs: 2.5, md: 3 }}
            alignItems="stretch"
          >
            {/* LEFT: THE DIGITAL GIFT CARD */}
            <Box sx={{ flex: { xs: "1", md: "1.15" } }}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2.5, sm: 3 },
                  borderRadius: "22px",
                  background: "linear-gradient(135deg, #e11d48 0%, #f43f5e 40%, #fb923c 100%)",
                  color: "#ffffff",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: "0 14px 34px rgba(225, 29, 72, 0.3)",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: { xs: 220, sm: 240 },
                }}
              >
                {/* Background Sparkles / Shapes */}
                <Box
                  sx={{
                    position: "absolute",
                    top: -30,
                    right: -30,
                    width: 140,
                    height: 140,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%)",
                    pointerEvents: "none",
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    bottom: -20,
                    left: -20,
                    width: 120,
                    height: 120,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)",
                    pointerEvents: "none",
                  }}
                />

                {/* Card Top: Brand + Tag */}
                <Box sx={{ position: "relative", zIndex: 1 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: "10px",
                          bgcolor: "rgba(255,255,255,0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backdropFilter: "blur(4px)",
                        }}
                      >
                        <ShoppingBagRoundedIcon sx={{ fontSize: 18, color: "#ffffff" }} />
                      </Box>
                      <Typography sx={{ fontWeight: 900, fontSize: 17, letterSpacing: "-0.3px", color: "#ffffff" }}>
                        Asiayapp
                      </Typography>
                    </Stack>

                    <Chip
                      label="PACKAGE PURCHASE"
                      size="small"
                      sx={{
                        bgcolor: "rgba(255, 255, 255, 0.22)",
                        color: "#ffffff",
                        fontWeight: 800,
                        fontSize: 10,
                        letterSpacing: "0.5px",
                        border: "1px solid rgba(255, 255, 255, 0.4)",
                        backdropFilter: "blur(4px)",
                      }}
                    />
                  </Stack>

                  <Box sx={{ my: 1.5, borderTop: "1px dashed rgba(255,255,255,0.4)" }} />

                  {/* Card Value */}
                  <Stack direction="row" alignItems="flex-end" justifyContent="space-between">
                    <Box>
                      <Typography
                        sx={{
                          fontSize: { xs: 34, sm: 40 },
                          fontWeight: 900,
                          lineHeight: 1.1,
                          letterSpacing: "-1px",
                          color: "#ffffff",
                          textShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        }}
                      >
                        ₹{fmtAmount(amount)}
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", mt: 0.25 }}>
                        Gift Coupon
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: "16px",
                        bgcolor: "rgba(255,255,255,0.18)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backdropFilter: "blur(6px)",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    >
                      <CardGiftcardRoundedIcon sx={{ fontSize: 32, color: "#ffffff" }} />
                    </Box>
                  </Stack>
                </Box>

                {/* Card Bottom: Coupon Code Capsule with Copy */}
                <Box
                  sx={{
                    mt: 2,
                    p: 1.25,
                    borderRadius: "14px",
                    bgcolor: "rgba(255, 255, 255, 0.95)",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <Box sx={{ pl: 0.5 }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Coupon Code
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: { xs: 14, sm: 15.5 },
                        fontWeight: 900,
                        fontFamily: "monospace",
                        color: "#0f172a",
                        letterSpacing: "0.8px",
                      }}
                    >
                      {code}
                    </Typography>
                  </Box>

                  <Tooltip title={copied ? "Copied!" : "Copy Code"}>
                    <Button
                      size="small"
                      onClick={handleCopy}
                      startIcon={copied ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />}
                      sx={{
                        bgcolor: copied ? "#10b981" : "#0f172a",
                        color: "#ffffff",
                        fontWeight: 800,
                        fontSize: 11.5,
                        textTransform: "none",
                        borderRadius: "10px",
                        px: 1.5,
                        py: 0.6,
                        "&:hover": { bgcolor: copied ? "#059669" : "#1e293b" },
                      }}
                    >
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </Tooltip>
                </Box>
              </Paper>
            </Box>

            {/* RIGHT: METADATA DETAILS CARD */}
            <Box sx={{ flex: "1", display: "flex", flexDirection: "column", gap: 1.25 }}>
              {/* Row 1: Type */}
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: "14px",
                  bgcolor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: "10px",
                      bgcolor: "#ecfdf5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#059669",
                    }}
                  >
                    <ShoppingBagRoundedIcon sx={{ fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Type</Typography>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a" }}>
                      Package Purchase
                    </Typography>
                  </Box>
                </Stack>
                <Chip
                  label={isRedeemed ? "REDEEMED" : "ACTIVE"}
                  size="small"
                  sx={{
                    fontWeight: 800,
                    fontSize: 11,
                    bgcolor: isRedeemed ? "#f1f5f9" : "#dcfce7",
                    color: isRedeemed ? "#64748b" : "#15803d",
                    border: isRedeemed ? "1px solid #cbd5e1" : "1px solid #86efac",
                  }}
                />
              </Paper>

              {/* Row 2: Value */}
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: "14px",
                  bgcolor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: "10px",
                      bgcolor: "#f5f3ff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#7c3aed",
                    }}
                  >
                    <CurrencyRupeeRoundedIcon sx={{ fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Value</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
                      ₹{fmtAmount(amount)}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              {/* Row 3: From */}
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: "14px",
                  bgcolor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: "10px",
                      bgcolor: "#eff6ff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#2563eb",
                    }}
                  >
                    <GroupRoundedIcon sx={{ fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>From</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                      {sender}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              {/* Row 4: Created On */}
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: "14px",
                  bgcolor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: "10px",
                      bgcolor: "#fdf2f8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#db2777",
                    }}
                  >
                    <CalendarMonthRoundedIcon sx={{ fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Created On</Typography>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a" }}>
                      {fmtDate(createdDate)}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Box>
          </Stack>

          {/* Feedback messages */}
          {redeemError && (
            <Paper
              elevation={0}
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: "12px",
                bgcolor: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
              }}
            >
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{redeemError}</Typography>
            </Paper>
          )}

          {justRedeemed && (
            <Paper
              elevation={0}
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: "12px",
                bgcolor: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#065f46",
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <CheckCircleRoundedIcon sx={{ color: "#059669" }} />
              <Typography sx={{ fontSize: 13, fontWeight: 800 }}>
                🎉 Successfully Redeemed! ₹{fmtAmount(amount)} has been credited to your Main Wallet.
              </Typography>
            </Paper>
          )}

          {/* 3. FOOTER: HOW TO REDEEM + ACTION BUTTON */}
          <Paper
            elevation={0}
            sx={{
              mt: 2.5,
              p: { xs: 2, sm: 2.25 },
              borderRadius: "18px",
              bgcolor: "#ffffff",
              border: "1px solid #e2e8f0",
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              alignItems: { xs: "stretch", md: "center" },
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            {/* Steps */}
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
                <InfoOutlinedIcon sx={{ fontSize: 17, color: "#2563eb" }} />
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                  How to redeem?
                </Typography>
              </Stack>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "flex-start", sm: "center" }}
                spacing={{ xs: 1, sm: 1.5 }}
              >
                {/* Step 1 */}
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      bgcolor: "#eff6ff",
                      color: "#2563eb",
                      fontSize: 11,
                      fontWeight: 900,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    1
                  </Box>
                  <Typography sx={{ fontSize: 11.5, color: "#475569", fontWeight: 600 }}>
                    Copy code or click Redeem
                  </Typography>
                </Stack>

                <ArrowForwardRoundedIcon sx={{ fontSize: 14, color: "#cbd5e1", display: { xs: "none", sm: "block" } }} />

                {/* Step 2 */}
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      bgcolor: "#eff6ff",
                      color: "#2563eb",
                      fontSize: 11,
                      fontWeight: 900,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    2
                  </Box>
                  <Typography sx={{ fontSize: 11.5, color: "#475569", fontWeight: 600 }}>
                    Apply it during purchase
                  </Typography>
                </Stack>

                <ArrowForwardRoundedIcon sx={{ fontSize: 14, color: "#cbd5e1", display: { xs: "none", sm: "block" } }} />

                {/* Step 3 */}
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      bgcolor: "#eff6ff",
                      color: "#2563eb",
                      fontSize: 11,
                      fontWeight: 900,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    3
                  </Box>
                  <Typography sx={{ fontSize: 11.5, color: "#475569", fontWeight: 600 }}>
                    Enjoy the discount
                  </Typography>
                </Stack>
              </Stack>
            </Box>

            {/* Redeem Button */}
            <Box sx={{ minWidth: { md: 200 } }}>
              {isRedeemed ? (
                <Button
                  variant="contained"
                  disabled
                  fullWidth
                  startIcon={<CheckRoundedIcon />}
                  sx={{
                    py: 1.25,
                    borderRadius: "14px",
                    fontWeight: 800,
                    fontSize: 13.5,
                    textTransform: "none",
                    bgcolor: "#e2e8f0 !important",
                    color: "#64748b !important",
                  }}
                >
                  Already Redeemed
                </Button>
              ) : (
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleRedeem}
                  disabled={redeeming}
                  startIcon={
                    redeeming ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <CardGiftcardRoundedIcon />
                    )
                  }
                  endIcon={!redeeming && <ArrowForwardRoundedIcon />}
                  sx={{
                    py: 1.25,
                    px: 3,
                    borderRadius: "14px",
                    background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                    color: "#ffffff",
                    fontWeight: 900,
                    fontSize: 14,
                    textTransform: "none",
                    boxShadow: "0 6px 18px rgba(16, 185, 129, 0.4)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #047857 0%, #059669 100%)",
                      boxShadow: "0 8px 24px rgba(16, 185, 129, 0.5)",
                    },
                  }}
                >
                  {redeeming ? "Redeeming..." : "Redeem Now"}
                </Button>
              )}
            </Box>
          </Paper>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
