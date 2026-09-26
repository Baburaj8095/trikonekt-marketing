import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Stack,
  Tooltip,
  Alert,
  Snackbar,
  CircularProgress,
  TextField,
  MenuItem,
} from "@mui/material";
import {
  CardGiftcard as GiftIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  CheckCircle as CheckCircleIcon,
  QrCode2 as QrCodeIcon,
  ContentCopy as CopyIcon,
  FlightTakeoff as HolidayIcon,
  MonetizationOn as MoneyIcon,
  Refresh as RefreshIcon,
  ShoppingBag as ShoppingBagIcon,
  Verified as VerifiedIcon,
  Stars as StarsIcon,
  ArrowForward as ArrowForwardIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import API from "../../api/api";

// Simple QR code renderer using standard SVG/canvas or QR code API
function QRCodeView({ value, size = 180 }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    value
  )}&bgcolor=ffffff&color=0f172a&margin=1`;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        bgcolor: "#ffffff",
        borderRadius: 3,
        boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        border: "1px solid #e2e8f0",
      }}
    >
      <img
        src={qrUrl}
        alt="SPP QR Code"
        style={{ width: size, height: size, borderRadius: 8 }}
      />
    </Box>
  );
}

export default function SPPGiftCards() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedSeason, setSelectedSeason] = useState(1);

  // Modals & Snackbars
  const [qrModalCard, setQrModalCard] = useState(null);
  const [redeemModalCard, setRedeemModalCard] = useState(null);
  const [redeemTripName, setRedeemTripName] = useState("Tri Kerala Premium Tour");
  const [redeeming, setRedeeming] = useState(false);
  const [claimingMaturity, setClaimingMaturity] = useState(false);
  const [toast, setToast] = useState({ open: false, msg: "", severity: "success" });

  const fetchGiftCards = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await API.get("/business/spp/gift-cards/", {
        params: { season: selectedSeason },
      });
      setCards(res.data.results || []);
      setSummary(res.data.summary || null);
    } catch (err) {
      console.error("Failed to fetch SPP gift cards:", err);
      setToast({
        open: true,
        msg: "Failed to load SPP gift cards. Please retry.",
        severity: "error",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGiftCards();
  }, [selectedSeason]);

  const handleCopy = (code) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setToast({ open: true, msg: `Copied "${code}" to clipboard!`, severity: "success" });
    }
  };

  const handleRedeemHoliday = async () => {
    if (!redeemModalCard) return;
    setRedeeming(true);
    try {
      const res = await API.post("/business/spp/gift-cards/redeem-holiday/", {
        coupon_code: redeemModalCard.coupon_code,
        trip_id: `TRIP-${redeemTripName.replace(/\s+/g, "-").toUpperCase()}`,
        trip_name: redeemTripName,
      });
      setToast({
        open: true,
        msg: res.data.message || "Gift card successfully redeemed for Tri Holiday!",
        severity: "success",
      });
      setRedeemModalCard(null);
      fetchGiftCards();
    } catch (err) {
      const errMsg = err?.response?.data?.detail || "Redemption failed.";
      setToast({ open: true, msg: errMsg, severity: "error" });
    } finally {
      setRedeeming(false);
    }
  };

  const handleClaimAnnualMaturity = async () => {
    setClaimingMaturity(true);
    try {
      const res = await API.post("/business/spp/gift-cards/claim-maturity/", {
        season_number: selectedSeason,
      });
      setToast({
        open: true,
        msg: res.data.message || "₹14,000 credited to your Main Wallet!",
        severity: "success",
      });
      fetchGiftCards();
    } catch (err) {
      const errMsg = err?.response?.data?.detail || "Annual maturity claim failed.";
      setToast({ open: true, msg: errMsg, severity: "error" });
    } finally {
      setClaimingMaturity(false);
    }
  };

  const filteredCards = useMemo(() => {
    if (statusFilter === "ALL") return cards;
    return cards.filter((c) => c.status === statusFilter);
  }, [cards, statusFilter]);

  const annualMaturity = summary?.annual_maturity;
  const boxesCompleted = annualMaturity?.boxes_completed || 0;
  const progressPercent = Math.min(100, Math.round((boxesCompleted / 12) * 100));

  const filterTabs = [
    { label: "All Vouchers", value: "ALL", count: cards.length },
    { label: "Active (Redeemable)", value: "ACTIVE", count: summary?.active_count || 0 },
    { label: "Locked (0-60 Days)", value: "LOCKED", count: summary?.locked_count || 0 },
    { label: "Maturity Eligible", value: "MATURITY_ELIGIBLE", count: summary?.maturity_eligible_count || 0 },
    { label: "Redeemed for Trips", value: "REDEEMED", count: summary?.redeemed_count || 0 },
    { label: "Matured & Paid", value: "MATURED_PAID", count: summary?.matured_paid_count || 0 },
  ];

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5, md: 4 }, maxWidth: 1280, mx: "auto" }}>
      {/* Header Banner */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          mb: 2.5,
          gap: 1.5,
        }}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 0.5 }}>
            <GiftIcon sx={{ fontSize: { xs: 26, sm: 30 }, color: "#10b981" }} />
            <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a", fontSize: { xs: "1.25rem", sm: "1.5rem" }, letterSpacing: -0.5 }}>
              SPP Gift Cards & Maturity Vault
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 500, fontSize: { xs: "0.8rem", sm: "0.875rem" } }}>
            QR-enabled ₹1,000 Universal Vouchers redeemable across <b>Tri Holidays, Products, Packages</b> or <b>₹14,000 Year-End Maturity</b>
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ width: { xs: "100%", sm: "auto" } }}>
          <IconButton
            onClick={() => fetchGiftCards(true)}
            disabled={refreshing}
            size="small"
            sx={{
              bgcolor: "#f1f5f9",
              border: "1px solid #e2e8f0",
              p: 1,
              "&:hover": { bgcolor: "#e2e8f0" },
            }}
          >
            <RefreshIcon sx={{ color: "#475569", fontSize: 20, animation: refreshing ? "spin 1s linear infinite" : "none" }} />
          </IconButton>

          <Button
            variant="contained"
            fullWidth
            startIcon={<ShoppingBagIcon />}
            onClick={() => navigate("/user/packages/spp")}
            sx={{
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              color: "#fff",
              fontWeight: 700,
              fontSize: { xs: "13px", sm: "14px" },
              px: 2.5,
              py: 0.9,
              borderRadius: 2.5,
              textTransform: "none",
              boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
              whiteSpace: "nowrap",
            }}
          >
            Buy SPP Box (₹1,000)
          </Button>
        </Stack>
      </Box>

      {/* Financial Overview Metrics (2x2 Grid on Mobile, 4-col on Desktop) */}
      <Grid container spacing={{ xs: 1.5, sm: 2, md: 2.5 }} sx={{ mb: 2.5 }}>
        {/* Total SPP Boxes */}
        <Grid item xs={6} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: { xs: 1.75, sm: 2.25 },
              borderRadius: 3,
              background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
              color: "#ffffff",
              boxShadow: "0 6px 18px rgba(15,23,42,0.12)",
              border: "1px solid rgba(255,255,255,0.08)",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: { xs: 10, sm: 11.5 }, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                Total Boxes
              </Typography>
              <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.1)" }}>
                <ShoppingBagIcon sx={{ color: "#38bdf8", fontSize: { xs: 16, sm: 18 } }} />
              </Box>
            </Stack>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.25rem", sm: "1.6rem" }, color: "#ffffff", lineHeight: 1.2 }}>
                {summary?.total_purchased || 0}{" "}
                <Typography component="span" sx={{ fontSize: { xs: 11, sm: 13 }, color: "#94a3b8", fontWeight: 600 }}>
                  / 12
                </Typography>
              </Typography>
              <Typography sx={{ fontSize: { xs: 10.5, sm: 11.5 }, color: "#38bdf8", fontWeight: 600, mt: 0.25 }}>
                ₹{(summary?.total_invested || 0).toLocaleString("en-IN")} Value
              </Typography>
            </Box>
          </Card>
        </Grid>

        {/* Active Universal Vouchers */}
        <Grid item xs={6} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: { xs: 1.75, sm: 2.25 },
              borderRadius: 3,
              background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
              color: "#ffffff",
              boxShadow: "0 6px 18px rgba(4,120,87,0.15)",
              border: "1px solid rgba(255,255,255,0.1)",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: { xs: 10, sm: 11.5 }, fontWeight: 700, color: "#a7f3d0", textTransform: "uppercase" }}>
                Active Vouchers
              </Typography>
              <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.15)" }}>
                <GiftIcon sx={{ color: "#6ee7b7", fontSize: { xs: 16, sm: 18 } }} />
              </Box>
            </Stack>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.25rem", sm: "1.6rem" }, color: "#ffffff", lineHeight: 1.2 }}>
                {summary?.active_count || 0}{" "}
                <Typography component="span" sx={{ fontSize: { xs: 11, sm: 13 }, color: "#a7f3d0", fontWeight: 600 }}>
                  Active
                </Typography>
              </Typography>
              <Typography sx={{ fontSize: { xs: 10.5, sm: 11.5 }, color: "#a7f3d0", fontWeight: 600, mt: 0.25 }}>
                ₹{((summary?.active_count || 0) * 1000).toLocaleString("en-IN")} Balance
              </Typography>
            </Box>
          </Card>
        </Grid>

        {/* Locked for 60 Days */}
        <Grid item xs={6} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: { xs: 1.75, sm: 2.25 },
              borderRadius: 3,
              background: "linear-gradient(135deg, #78350f 0%, #b45309 100%)",
              color: "#ffffff",
              boxShadow: "0 6px 18px rgba(180,83,9,0.15)",
              border: "1px solid rgba(255,255,255,0.1)",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: { xs: 10, sm: 11.5 }, fontWeight: 700, color: "#fde68a", textTransform: "uppercase" }}>
                60-Day Lock
              </Typography>
              <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.15)" }}>
                <LockIcon sx={{ color: "#fde68a", fontSize: { xs: 16, sm: 18 } }} />
              </Box>
            </Stack>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.25rem", sm: "1.6rem" }, color: "#ffffff", lineHeight: 1.2 }}>
                {summary?.locked_count || 0}{" "}
                <Typography component="span" sx={{ fontSize: { xs: 11, sm: 13 }, color: "#fde68a", fontWeight: 600 }}>
                  Locked
                </Typography>
              </Typography>
              <Typography sx={{ fontSize: { xs: 10.5, sm: 11.5 }, color: "#fde68a", fontWeight: 600, mt: 0.25 }}>
                Unlocks in 60d
              </Typography>
            </Box>
          </Card>
        </Grid>

        {/* Annual Maturity Status */}
        <Grid item xs={6} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: { xs: 1.75, sm: 2.25 },
              borderRadius: 3,
              background: "linear-gradient(135deg, #311042 0%, #581c87 100%)",
              color: "#ffffff",
              boxShadow: "0 6px 18px rgba(88,28,135,0.15)",
              border: "1px solid rgba(255,255,255,0.1)",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: { xs: 10, sm: 11.5 }, fontWeight: 700, color: "#e9d5ff", textTransform: "uppercase" }}>
                Annual Maturity
              </Typography>
              <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.15)" }}>
                <StarsIcon sx={{ color: "#f0abfc", fontSize: { xs: 16, sm: 18 } }} />
              </Box>
            </Stack>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.25rem", sm: "1.6rem" }, color: "#f0abfc", lineHeight: 1.2 }}>
                ₹14,000
              </Typography>
              <Typography sx={{ fontSize: { xs: 10.5, sm: 11.5 }, color: "#e9d5ff", fontWeight: 600, mt: 0.25 }}>
                ₹12k + ₹2k Bonus
              </Typography>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* 30-Day Renewal Cadence Countdown Card */}
      {summary?.renewal_cadence && (
        <Card
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.5 },
            mb: 2.5,
            borderRadius: 3,
            border: "1.5px solid",
            borderColor:
              summary.renewal_cadence.cadence_status === "OVERDUE"
                ? "#fca5a5"
                : summary.renewal_cadence.cadence_status === "DUE_TODAY"
                ? "#fed7aa"
                : summary.renewal_cadence.cadence_status === "DUE_SOON"
                ? "#fde047"
                : "#bbf7d0",
            bgcolor:
              summary.renewal_cadence.cadence_status === "OVERDUE"
                ? "#fff5f5"
                : summary.renewal_cadence.cadence_status === "DUE_TODAY"
                ? "#fffaf0"
                : "#f0fdf4",
            boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            spacing={1.5}
          >
            <Box sx={{ width: "100%" }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <Chip
                  size="small"
                  label={
                    summary.renewal_cadence.cadence_status === "COMPLETED"
                      ? "Maturity Complete"
                      : summary.renewal_cadence.cadence_status === "OVERDUE"
                      ? "Renewal Overdue"
                      : summary.renewal_cadence.cadence_status === "DUE_TODAY"
                      ? "Due Today"
                      : summary.renewal_cadence.cadence_status === "DUE_SOON"
                      ? "Due Soon"
                      : "Streak On Track"
                  }
                  sx={{
                    fontWeight: 800,
                    fontSize: "11px",
                    bgcolor:
                      summary.renewal_cadence.cadence_status === "OVERDUE"
                        ? "#dc2626"
                        : summary.renewal_cadence.cadence_status === "DUE_TODAY"
                        ? "#ea580c"
                        : summary.renewal_cadence.cadence_status === "DUE_SOON"
                        ? "#ca8a04"
                        : "#16a34a",
                    color: "#fff",
                  }}
                />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0f172a" }}>
                  30-Day Monthly Renewal Cycle
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: "#475569", fontWeight: 500, fontSize: "13px" }}>
                {summary.renewal_cadence.status_message}
              </Typography>
              {summary.renewal_cadence.next_purchase_date && (
                <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 600, display: "block", mt: 0.5 }}>
                  📅 Next Scheduled: <b>{summary.renewal_cadence.next_purchase_date}</b> • Last Box: {summary.renewal_cadence.last_purchase_date || "N/A"}
                </Typography>
              )}
            </Box>

            {summary.renewal_cadence.cadence_status !== "COMPLETED" && (
              <Button
                variant="contained"
                fullWidth
                onClick={() => navigate("/user/packages/spp")}
                sx={{
                  bgcolor:
                    summary.renewal_cadence.cadence_status === "OVERDUE" || summary.renewal_cadence.cadence_status === "DUE_TODAY"
                      ? "#ea580c"
                      : "#2563eb",
                  "&:hover": {
                    bgcolor:
                      summary.renewal_cadence.cadence_status === "OVERDUE" || summary.renewal_cadence.cadence_status === "DUE_TODAY"
                        ? "#c2410c"
                        : "#1d4ed8",
                  },
                  fontWeight: 800,
                  fontSize: "13px",
                  borderRadius: 2.5,
                  px: 3,
                  py: 1,
                  textTransform: "none",
                  whiteSpace: "nowrap",
                  maxWidth: { sm: 260 },
                }}
              >
                Purchase Monthly Box (₹1,000)
              </Button>
            )}
          </Stack>
        </Card>
      )}

      {/* Annual Maturity Vault Progress Card */}
      <Card
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5, md: 3 },
          mb: 3,
          borderRadius: 3.5,
          bgcolor: "#ffffff",
          border: "1.5px solid #e2e8f0",
          boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={1.5}
          sx={{ mb: 1.5 }}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <MoneyIcon sx={{ color: "#8b5cf6", fontSize: 22 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a" }}>
                12-Month SPP Maturity Vault Progress (Season {selectedSeason})
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: "#64748b", fontSize: "13px" }}>
              Complete 12 monthly boxes without holiday redemption to claim <b>₹14,000</b> (₹12,000 invested + ₹2,000 bonus) directly to your Main Wallet!
            </Typography>
          </Box>

          {annualMaturity?.status === "READY_TO_CLAIM" ? (
            <Button
              variant="contained"
              fullWidth
              onClick={handleClaimAnnualMaturity}
              disabled={claimingMaturity}
              startIcon={<StarsIcon />}
              sx={{
                background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
                color: "#fff",
                fontWeight: 900,
                fontSize: "14px",
                px: 3,
                py: 1.2,
                borderRadius: 2.5,
                textTransform: "none",
                boxShadow: "0 6px 20px rgba(139,92,246,0.35)",
                whiteSpace: "nowrap",
                maxWidth: { md: 280 },
              }}
            >
              {claimingMaturity ? "Processing..." : "Claim ₹14,000 Payout"}
            </Button>
          ) : annualMaturity?.status === "MATURED_PAID" ? (
            <Chip
              label="₹14,000 Payout Paid to Wallet"
              color="success"
              sx={{ fontWeight: 800, px: 1.5, py: 2, fontSize: 12.5, borderRadius: 2 }}
            />
          ) : (
            <Chip
              label={`${boxesCompleted}/12 Boxes Completed`}
              sx={{
                bgcolor: "#f1f5f9",
                color: "#475569",
                fontWeight: 800,
                fontSize: 12.5,
                px: 1,
                py: 1.75,
                borderRadius: 2,
              }}
            />
          )}
        </Stack>

        <Box sx={{ mt: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
            <Typography sx={{ fontSize: "12.5px", fontWeight: 700, color: "#475569" }}>
              Annual Savings Progress: {boxesCompleted} of 12 Months
            </Typography>
            <Typography sx={{ fontSize: "12.5px", fontWeight: 800, color: "#8b5cf6" }}>
              {progressPercent}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{
              height: 10,
              borderRadius: 5,
              bgcolor: "#f1f5f9",
              "& .MuiLinearProgress-bar": {
                borderRadius: 5,
                background: "linear-gradient(90deg, #8b5cf6 0%, #10b981 100%)",
              },
            }}
          />
        </Box>
      </Card>

      {/* Modern Horizontal Scroll Filter Pill Tabs (Fixed Overlapping) */}
      <Box
        sx={{
          mb: 2.5,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          display: "flex",
          alignItems: "center",
          gap: 1,
          pb: 1,
          pt: 0.5,
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {filterTabs.map((tab) => {
          const isSelected = statusFilter === tab.value;
          return (
            <Button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              disableElevation
              sx={{
                flexShrink: 0,
                minWidth: "fit-content",
                px: { xs: 1.75, sm: 2.25 },
                py: 0.75,
                borderRadius: "999px",
                fontSize: { xs: "12px", sm: "13px" },
                fontWeight: 700,
                textTransform: "none",
                whiteSpace: "nowrap",
                bgcolor: isSelected ? "#0f172a" : "#ffffff",
                color: isSelected ? "#ffffff" : "#475569",
                border: isSelected ? "1.5px solid #0f172a" : "1.5px solid #e2e8f0",
                boxShadow: isSelected ? "0 4px 12px rgba(15,23,42,0.18)" : "0 1px 3px rgba(0,0,0,0.03)",
                transition: "all 0.15s ease",
                "&:hover": {
                  bgcolor: isSelected ? "#1e293b" : "#f1f5f9",
                  borderColor: isSelected ? "#1e293b" : "#cbd5e1",
                },
              }}
            >
              {tab.label}
              <Box
                component="span"
                sx={{
                  ml: 0.8,
                  px: 0.85,
                  py: 0.15,
                  borderRadius: "999px",
                  bgcolor: isSelected ? "rgba(255,255,255,0.22)" : "#f1f5f9",
                  color: isSelected ? "#ffffff" : "#64748b",
                  fontSize: "11px",
                  fontWeight: 800,
                  display: "inline-block",
                }}
              >
                {tab.count}
              </Box>
            </Button>
          );
        })}
      </Box>

      {/* Gift Cards Grid */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress size={40} sx={{ color: "#2563eb" }} />
        </Box>
      ) : filteredCards.length === 0 ? (
        <Card
          elevation={0}
          sx={{
            p: { xs: 4, sm: 6 },
            textAlign: "center",
            borderRadius: 3.5,
            bgcolor: "#f8fafc",
            border: "1.5px dashed #cbd5e1",
          }}
        >
          <GiftIcon sx={{ fontSize: 44, color: "#94a3b8", mb: 1.5 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#334155", mb: 0.75 }}>
            No SPP Gift Cards in this category
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mb: 2.5, maxWidth: 440, mx: "auto", fontSize: "13px" }}>
            Purchase SPP Monthly Boxes to generate luxury ₹1,000 QR Gift Cards and start your 12-month savings journey.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate("/user/packages/spp")}
            sx={{
              bgcolor: "#2563eb",
              "&:hover": { bgcolor: "#1d4ed8" },
              fontWeight: 700,
              borderRadius: 2.5,
              textTransform: "none",
              px: 3,
            }}
          >
            Go to SPP Store
          </Button>
        </Card>
      ) : (
        <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
          {filteredCards.map((card) => {
            const isLocked = card.status === "LOCKED";
            const isActive = card.status === "ACTIVE";
            const isRedeemed = card.status === "REDEEMED";
            const isMaturityEligible = card.status === "MATURITY_ELIGIBLE";
            const isMaturedPaid = card.status === "MATURED_PAID";

            // Status border & background themes
            let cardBg = "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)";
            let accentColor = "#38bdf8";

            if (isActive) {
              cardBg = "linear-gradient(135deg, #064e3b 0%, #022c22 100%)";
              accentColor = "#10b981";
            } else if (isLocked) {
              cardBg = "linear-gradient(135deg, #3f2d1d 0%, #1c150c 100%)";
              accentColor = "#f59e0b";
            } else if (isMaturedPaid || isMaturityEligible) {
              cardBg = "linear-gradient(135deg, #3b0764 0%, #1e1b4b 100%)";
              accentColor = "#c084fc";
            }

            return (
              <Grid item xs={12} sm={6} lg={4} key={card.id}>
                <Card
                  elevation={0}
                  sx={{
                    borderRadius: 3.5,
                    background: cardBg,
                    color: "#ffffff",
                    border: `1.5px solid ${accentColor}33`,
                    boxShadow: `0 8px 24px rgba(0,0,0,0.2)`,
                    position: "relative",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: 280,
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-3px)",
                      boxShadow: `0 14px 32px rgba(0,0,0,0.3)`,
                    },
                  }}
                >
                  {/* Decorative Shimmer / Watermark */}
                  <Box
                    sx={{
                      position: "absolute",
                      right: -15,
                      bottom: -15,
                      opacity: 0.08,
                      pointerEvents: "none",
                    }}
                  >
                    <GiftIcon sx={{ fontSize: 160, color: "#ffffff" }} />
                  </Box>

                  <CardContent sx={{ p: { xs: 2, sm: 2.5 }, position: "relative", zIndex: 1 }}>
                    {/* Top Row: Brand & Box Number */}
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                      <Box>
                        <Typography
                          sx={{
                            fontSize: 9.5,
                            fontWeight: 900,
                            letterSpacing: 1.2,
                            color: accentColor,
                            textTransform: "uppercase",
                          }}
                        >
                          TRIKONEKT SPP VOUCHER
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: "#ffffff", letterSpacing: -0.5, fontSize: "1.4rem" }}>
                          ₹{Number(card.amount || 1000).toLocaleString("en-IN")}
                        </Typography>
                      </Box>

                      <Chip
                        label={`Month ${card.box_number} Box`}
                        sx={{
                          bgcolor: "rgba(255,255,255,0.12)",
                          color: "#ffffff",
                          fontWeight: 800,
                          fontSize: 10.5,
                          borderRadius: 2,
                          border: "1px solid rgba(255,255,255,0.2)",
                        }}
                      />
                    </Stack>

                    {/* Voucher Code Box */}
                    <Box
                      sx={{
                        p: 1.25,
                        borderRadius: 2,
                        bgcolor: "rgba(0,0,0,0.35)",
                        border: "1px dashed rgba(255,255,255,0.2)",
                        mb: 1.5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontSize: 9.5, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>
                          Voucher Code (Phone: {card.user_phone || "User"})
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 14,
                            fontWeight: 800,
                            letterSpacing: 0.8,
                            color: "#ffffff",
                            fontFamily: "monospace",
                          }}
                        >
                          {card.coupon_code}
                        </Typography>
                      </Box>

                      <Tooltip title="Copy Code">
                        <IconButton
                          size="small"
                          onClick={() => handleCopy(card.coupon_code)}
                          sx={{
                            color: accentColor,
                            bgcolor: "rgba(255,255,255,0.08)",
                            "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
                          }}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    {/* Status & Validity Info */}
                    {isLocked && (
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color: "#fde68a", mb: 0.5 }}>
                        <LockIcon sx={{ fontSize: 14 }} />
                        <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>
                          Locked for 60 Days ({card.days_until_unlock}d left • Unlocks {dayjs(card.unlock_at).format("DD MMM YYYY")})
                        </Typography>
                      </Stack>
                    )}

                    {isActive && (
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color: "#6ee7b7", mb: 0.5 }}>
                        <UnlockIcon sx={{ fontSize: 14 }} />
                        <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>
                          Active for Tri Holidays ({card.days_until_expiry}d left • Expires {dayjs(card.expires_at).format("DD MMM YYYY")})
                        </Typography>
                      </Stack>
                    )}

                    {isRedeemed && (
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color: "#93c5fd", mb: 0.5 }}>
                        <CheckCircleIcon sx={{ fontSize: 14 }} />
                        <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>
                          Redeemed for: {card.redeemed_trip_name || "Tri Holiday Tour"}
                        </Typography>
                      </Stack>
                    )}

                    {isMaturityEligible && (
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color: "#f0abfc", mb: 0.5 }}>
                        <StarsIcon sx={{ fontSize: 14 }} />
                        <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>
                          Saved for Year-End Maturity (₹12k + ₹2k Bonus)
                        </Typography>
                      </Stack>
                    )}

                    {isMaturedPaid && (
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color: "#86efac", mb: 0.5 }}>
                        <VerifiedIcon sx={{ fontSize: 14 }} />
                        <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>
                          ₹14,000 Annual Maturity Paid to Main Wallet
                        </Typography>
                      </Stack>
                    )}
                  </CardContent>

                  {/* Actions Bar */}
                  <Box
                    sx={{
                      p: { xs: 1.5, sm: 2 },
                      pt: 0,
                      display: "flex",
                      gap: 1,
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      startIcon={<QrCodeIcon />}
                      onClick={() => setQrModalCard(card)}
                      sx={{
                        color: "#ffffff",
                        borderColor: "rgba(255,255,255,0.25)",
                        fontWeight: 700,
                        fontSize: "12px",
                        borderRadius: 2,
                        textTransform: "none",
                        "&:hover": {
                          borderColor: "#ffffff",
                          bgcolor: "rgba(255,255,255,0.08)",
                        },
                      }}
                    >
                      View QR
                    </Button>

                    {isActive && (
                      <Button
                        fullWidth
                        variant="contained"
                        size="small"
                        startIcon={<HolidayIcon />}
                        onClick={() => setRedeemModalCard(card)}
                        sx={{
                          bgcolor: "#10b981",
                          color: "#ffffff",
                          fontWeight: 800,
                          fontSize: "12px",
                          borderRadius: 2,
                          textTransform: "none",
                          "&:hover": { bgcolor: "#059669" },
                        }}
                      >
                        Redeem
                      </Button>
                    )}
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* QR Code Dialog */}
      <Dialog
        open={Boolean(qrModalCard)}
        onClose={() => setQrModalCard(null)}
        PaperProps={{
          sx: { borderRadius: 4, maxWidth: 360, width: "90%", p: 1 },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", fontWeight: 900, pb: 0.5 }}>
          SPP Voucher QR Code
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center" }}>
          {qrModalCard && (
            <>
              <Typography variant="body2" sx={{ color: "#64748b", mb: 2, fontSize: "13px" }}>
                Scan to redeem towards Tri Holiday packages or verify authenticity.
              </Typography>

              <QRCodeView value={qrModalCard.coupon_code} size={180} />

              <Box sx={{ mt: 2, p: 1.5, bgcolor: "#f8fafc", borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
                <Typography sx={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                  Alphanumeric Voucher Code
                </Typography>
                <Typography
                  sx={{
                    fontSize: 16,
                    fontWeight: 900,
                    fontFamily: "monospace",
                    color: "#0f172a",
                    letterSpacing: 1,
                  }}
                >
                  {qrModalCard.coupon_code}
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: "#2563eb", fontWeight: 600, mt: 0.25 }}>
                  Face Value: ₹1,000 • Month {qrModalCard.box_number} Box
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
          <Button
            variant="contained"
            onClick={() => setQrModalCard(null)}
            sx={{
              bgcolor: "#0f172a",
              "&:hover": { bgcolor: "#1e293b" },
              fontWeight: 700,
              borderRadius: 2,
              px: 4,
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Redeem for Tri Holiday Dialog */}
      <Dialog
        open={Boolean(redeemModalCard)}
        onClose={() => setRedeemModalCard(null)}
        PaperProps={{
          sx: { borderRadius: 4, maxWidth: 420, width: "92%", p: 1 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 0.5 }}>
          Redeem for Tri Holiday
        </DialogTitle>
        <DialogContent>
          {redeemModalCard && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="info" sx={{ borderRadius: 2.5, fontSize: "12.5px" }}>
                Applying voucher <b>{redeemModalCard.coupon_code}</b> gives you an instant <b>₹1,000</b> deduction towards your travel package.
              </Alert>

              <TextField
                select
                fullWidth
                size="small"
                label="Select Tri Holiday Destination"
                value={redeemTripName}
                onChange={(e) => setRedeemTripName(e.target.value)}
              >
                <MenuItem value="Tri Kerala Backwaters & Hills (5D/4N)">
                  Tri Kerala Backwaters & Hills (5D/4N)
                </MenuItem>
                <MenuItem value="Tri Thailand Exotic Explorer (6D/5N)">
                  Tri Thailand Exotic Explorer (6D/5N)
                </MenuItem>
                <MenuItem value="Tri Goa Coastal Escape (4D/3N)">
                  Tri Goa Coastal Escape (4D/3N)
                </MenuItem>
                <MenuItem value="Tri Kashmir Paradise Experience (6D/5N)">
                  Tri Kashmir Paradise Experience (6D/5N)
                </MenuItem>
              </TextField>

              <Box sx={{ p: 1.5, bgcolor: "#f8fafc", borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                  <Typography sx={{ fontSize: 12.5, color: "#64748b" }}>Package Discount:</Typography>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#10b981" }}>- ₹1,000.00</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ fontSize: 12.5, color: "#64748b" }}>Voucher Used:</Typography>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>
                    {redeemModalCard.coupon_code}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRedeemModalCard(null)} sx={{ fontWeight: 600, color: "#64748b" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRedeemHoliday}
            disabled={redeeming}
            sx={{
              bgcolor: "#10b981",
              "&:hover": { bgcolor: "#059669" },
              fontWeight: 800,
              borderRadius: 2,
              px: 2.5,
            }}
          >
            {redeeming ? "Redeeming..." : "Confirm Discount"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          severity={toast.severity}
          sx={{ width: "100%", borderRadius: 3, fontWeight: 700 }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>

      {/* Mobile Bottom Clearance Spacer */}
      <Box sx={{ height: { xs: 80, sm: 40 } }} />
    </Box>
  );
}
