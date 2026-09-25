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
  Info as InfoIcon,
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

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1280, mx: "auto" }}>
      {/* Header Banner */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          mb: 3,
          gap: 2,
        }}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
            <GiftIcon sx={{ fontSize: 32, color: "#10b981" }} />
            <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a", letterSpacing: -0.5 }}>
              SPP Gift Cards & Maturity Vault
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 500 }}>
            QR-enabled ₹1,000 Universal Vouchers redeemable across <b>Tri Holidays, Products, Packages, Coupons</b> or <b>₹14,000 Year-End Maturity</b>
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <IconButton
            onClick={() => fetchGiftCards(true)}
            disabled={refreshing}
            sx={{
              bgcolor: "#f1f5f9",
              border: "1px solid #e2e8f0",
              "&:hover": { bgcolor: "#e2e8f0" },
            }}
          >
            <RefreshIcon sx={{ color: "#475569", animation: refreshing ? "spin 1s linear infinite" : "none" }} />
          </IconButton>

          <Button
            variant="contained"
            startIcon={<ShoppingBagIcon />}
            onClick={() => navigate("/user/packages/spp")}
            sx={{
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              color: "#fff",
              fontWeight: 700,
              px: 2.5,
              py: 1,
              borderRadius: 2.5,
              textTransform: "none",
              boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
            }}
          >
            Buy SPP Box (₹1,000)
          </Button>
        </Stack>
      </Box>

      {/* Financial Overview Metrics */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        {/* Total SPP Boxes */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3.5,
              background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
              color: "#ffffff",
              boxShadow: "0 10px 25px rgba(15,23,42,0.15)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                Total Boxes Owned
              </Typography>
              <Box sx={{ p: 1, borderRadius: 2, bgcolor: "rgba(255,255,255,0.1)" }}>
                <ShoppingBagIcon sx={{ color: "#38bdf8", fontSize: 20 }} />
              </Box>
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5, color: "#ffffff" }}>
              {summary?.total_purchased || 0}{" "}
              <Typography component="span" sx={{ fontSize: 16, color: "#94a3b8", fontWeight: 600 }}>
                / 12 Boxes
              </Typography>
            </Typography>
            <Typography sx={{ fontSize: 12, color: "#38bdf8", fontWeight: 600 }}>
              Total ₹{(summary?.total_invested || 0).toLocaleString("en-IN")} Value
            </Typography>
          </Card>
        </Grid>

        {/* Active Universal Vouchers */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3.5,
              background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
              color: "#ffffff",
              boxShadow: "0 10px 25px rgba(4,120,87,0.2)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#a7f3d0", textTransform: "uppercase" }}>
                Active Vouchers (Universal)
              </Typography>
              <Box sx={{ p: 1, borderRadius: 2, bgcolor: "rgba(255,255,255,0.15)" }}>
                <GiftIcon sx={{ color: "#6ee7b7", fontSize: 20 }} />
              </Box>
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5, color: "#ffffff" }}>
              {summary?.active_count || 0}{" "}
              <Typography component="span" sx={{ fontSize: 16, color: "#a7f3d0", fontWeight: 600 }}>
                Active
              </Typography>
            </Typography>
            <Typography sx={{ fontSize: 12, color: "#a7f3d0", fontWeight: 600 }}>
              ₹{((summary?.active_count || 0) * 1000).toLocaleString("en-IN")} Universal Balance
            </Typography>
          </Card>
        </Grid>

        {/* Locked for 60 Days */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3.5,
              background: "linear-gradient(135deg, #78350f 0%, #b45309 100%)",
              color: "#ffffff",
              boxShadow: "0 10px 25px rgba(180,83,9,0.2)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#fde68a", textTransform: "uppercase" }}>
                Locked (60-Day Lock)
              </Typography>
              <Box sx={{ p: 1, borderRadius: 2, bgcolor: "rgba(255,255,255,0.15)" }}>
                <LockIcon sx={{ color: "#fde68a", fontSize: 20 }} />
              </Box>
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5, color: "#ffffff" }}>
              {summary?.locked_count || 0}{" "}
              <Typography component="span" sx={{ fontSize: 16, color: "#fde68a", fontWeight: 600 }}>
                Locked
              </Typography>
            </Typography>
            <Typography sx={{ fontSize: 12, color: "#fde68a", fontWeight: 600 }}>
              Unlocks after 60 days
            </Typography>
          </Card>
        </Grid>

        {/* Annual Maturity Status */}
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3.5,
              background: "linear-gradient(135deg, #311042 0%, #581c87 100%)",
              color: "#ffffff",
              boxShadow: "0 10px 25px rgba(88,28,135,0.2)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#e9d5ff", textTransform: "uppercase" }}>
                Annual Maturity
              </Typography>
              <Box sx={{ p: 1, borderRadius: 2, bgcolor: "rgba(255,255,255,0.15)" }}>
                <StarsIcon sx={{ color: "#f0abfc", fontSize: 20 }} />
              </Box>
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5, color: "#f0abfc" }}>
              ₹14,000
            </Typography>
            <Typography sx={{ fontSize: 12, color: "#e9d5ff", fontWeight: 600 }}>
              ₹12,000 + ₹2,000 Bonus
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* 30-Day Renewal Cadence Countdown Card */}
      {summary?.renewal_cadence && (
        <Card
          elevation={0}
          sx={{
            p: 2.5,
            mb: 3,
            borderRadius: 3.5,
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
            boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            spacing={2}
          >
            <Box>
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
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a" }}>
                  30-Day Monthly Renewal Cycle
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: "#475569", fontWeight: 500 }}>
                {summary.renewal_cadence.status_message}
              </Typography>
              {summary.renewal_cadence.next_purchase_date && (
                <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 600, display: "block", mt: 0.5 }}>
                  📅 Next Scheduled Purchase: <b>{summary.renewal_cadence.next_purchase_date}</b> • Last Box: {summary.renewal_cadence.last_purchase_date || "N/A"}
                </Typography>
              )}
            </Box>

            {summary.renewal_cadence.cadence_status !== "COMPLETED" && (
              <Button
                variant="contained"
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
                  borderRadius: 2.5,
                  px: 3,
                  py: 1,
                  textTransform: "none",
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
          p: 3,
          mb: 4,
          borderRadius: 4,
          bgcolor: "#ffffff",
          border: "1.5px solid #e2e8f0",
          boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={2}
          sx={{ mb: 2 }}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <MoneyIcon sx={{ color: "#8b5cf6", fontSize: 24 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a" }}>
                12-Month SPP Maturity Vault Progress (Season {selectedSeason})
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: "#64748b" }}>
              Purchase all 12 monthly boxes without holiday redemption to claim <b>₹14,000</b> (₹12,000 invested + ₹2,000 guaranteed bonus) directly to your Main Wallet!
            </Typography>
          </Box>

          {annualMaturity?.status === "READY_TO_CLAIM" ? (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<VerifiedIcon />}
              onClick={handleClaimAnnualMaturity}
              disabled={claimingMaturity}
              sx={{
                bgcolor: "#8b5cf6",
                "&:hover": { bgcolor: "#7c3aed" },
                px: 3,
                py: 1.2,
                fontWeight: 800,
                borderRadius: 2.5,
                boxShadow: "0 4px 14px rgba(139,92,246,0.4)",
              }}
            >
              {claimingMaturity ? "Processing Payout..." : "Claim ₹14,000 Payout Now"}
            </Button>
          ) : annualMaturity?.status === "PAID" ? (
            <Chip
              icon={<CheckCircleIcon />}
              label="₹14,000 Payout Paid to Wallet"
              color="success"
              sx={{ fontWeight: 800, px: 1.5, py: 2.5, fontSize: 13, borderRadius: 2.5 }}
            />
          ) : (
            <Chip
              label={`${boxesCompleted}/12 Boxes Completed`}
              sx={{
                bgcolor: "#f1f5f9",
                color: "#475569",
                fontWeight: 800,
                fontSize: 13,
                px: 1,
                py: 2,
                borderRadius: 2,
              }}
            />
          )}
        </Stack>

        <Box sx={{ mt: 2 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>
              Annual Savings Progress: {boxesCompleted} of 12 Months
            </Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#8b5cf6" }}>
              {progressPercent}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{
              height: 12,
              borderRadius: 6,
              bgcolor: "#f1f5f9",
              "& .MuiLinearProgress-bar": {
                borderRadius: 6,
                background: "linear-gradient(90deg, #8b5cf6 0%, #10b981 100%)",
              },
            }}
          />
        </Box>
      </Card>

      {/* Filter Tabs */}
      <Stack
        direction="row"
        spacing={1}
        sx={{
          mb: 3,
          overflowX: "auto",
          pb: 1,
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {[
          { label: "All Vouchers", value: "ALL", count: cards.length },
          { label: "Active (Redeemable)", value: "ACTIVE", count: summary?.active_count || 0 },
          { label: "Locked (0-60 Days)", value: "LOCKED", count: summary?.locked_count || 0 },
          { label: "Maturity Eligible", value: "MATURITY_ELIGIBLE", count: summary?.maturity_eligible_count || 0 },
          { label: "Redeemed for Trips", value: "REDEEMED", count: summary?.redeemed_count || 0 },
          { label: "Matured & Paid", value: "MATURED_PAID", count: summary?.matured_paid_count || 0 },
        ].map((tab) => (
          <Button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            sx={{
              px: 2,
              py: 0.75,
              borderRadius: 3,
              fontSize: 13,
              fontWeight: 700,
              textTransform: "none",
              whiteSpace: "nowrap",
              bgcolor: statusFilter === tab.value ? "#0f172a" : "#f1f5f9",
              color: statusFilter === tab.value ? "#ffffff" : "#64748b",
              "&:hover": {
                bgcolor: statusFilter === tab.value ? "#1e293b" : "#e2e8f0",
              },
            }}
          >
            {tab.label} ({tab.count})
          </Button>
        ))}
      </Stack>

      {/* Gift Cards Grid */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress size={40} sx={{ color: "#2563eb" }} />
        </Box>
      ) : filteredCards.length === 0 ? (
        <Card
          elevation={0}
          sx={{
            p: 6,
            textAlign: "center",
            borderRadius: 4,
            bgcolor: "#f8fafc",
            border: "1.5px dashed #cbd5e1",
          }}
        >
          <GiftIcon sx={{ fontSize: 48, color: "#94a3b8", mb: 1.5 }} />
          <Typography variant="h6" sx={{ fontWeight: 800, color: "#334155", mb: 1 }}>
            No SPP Gift Cards in this category
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mb: 2.5 }}>
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
            }}
          >
            Go to SPP Store
          </Button>
        </Card>
      ) : (
        <Grid container spacing={3}>
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
              <Grid item xs={12} md={6} lg={4} key={card.id}>
                <Card
                  elevation={0}
                  sx={{
                    borderRadius: 4,
                    background: cardBg,
                    color: "#ffffff",
                    border: `1.5px solid ${accentColor}33`,
                    boxShadow: `0 12px 30px rgba(0,0,0,0.25)`,
                    position: "relative",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: 290,
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: `0 18px 40px rgba(0,0,0,0.35)`,
                    },
                  }}
                >
                  {/* Decorative Shimmer / Watermark */}
                  <Box
                    sx={{
                      position: "absolute",
                      right: -20,
                      bottom: -20,
                      opacity: 0.08,
                      pointerEvents: "none",
                    }}
                  >
                    <GiftIcon sx={{ fontSize: 180, color: "#ffffff" }} />
                  </Box>

                  <CardContent sx={{ p: 3, position: "relative", zIndex: 1 }}>
                    {/* Top Row: Brand & Box Number */}
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                      <Box>
                        <Typography
                          sx={{
                            fontSize: 10,
                            fontWeight: 900,
                            letterSpacing: 1.5,
                            color: accentColor,
                            textTransform: "uppercase",
                          }}
                        >
                          TRIKONEKT SPP VOUCHER
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: "#ffffff", letterSpacing: -0.5 }}>
                          ₹{Number(card.amount || 1000).toLocaleString("en-IN")}
                        </Typography>
                      </Box>

                      <Chip
                        label={`Month ${card.box_number} Box`}
                        sx={{
                          bgcolor: "rgba(255,255,255,0.12)",
                          color: "#ffffff",
                          fontWeight: 800,
                          fontSize: 11,
                          borderRadius: 2,
                          border: "1px solid rgba(255,255,255,0.2)",
                        }}
                      />
                    </Stack>

                    {/* Voucher Code Box */}
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2.5,
                        bgcolor: "rgba(0,0,0,0.35)",
                        border: "1px dashed rgba(255,255,255,0.2)",
                        mb: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>
                          Voucher Code (Phone: {card.user_phone || "User"})
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 15,
                            fontWeight: 800,
                            letterSpacing: 1,
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
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ color: "#fde68a", mb: 1 }}>
                        <LockIcon sx={{ fontSize: 16 }} />
                        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                          Locked for 60 Days ({card.days_until_unlock} days left • Unlocks {dayjs(card.unlock_at).format("DD MMM YYYY")})
                        </Typography>
                      </Stack>
                    )}

                    {isActive && (
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ color: "#6ee7b7", mb: 1 }}>
                        <UnlockIcon sx={{ fontSize: 16 }} />
                        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                          Active for Tri Holidays ({card.days_until_expiry} days left • Expires {dayjs(card.expires_at).format("DD MMM YYYY")})
                        </Typography>
                      </Stack>
                    )}

                    {isRedeemed && (
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ color: "#93c5fd", mb: 1 }}>
                        <CheckCircleIcon sx={{ fontSize: 16 }} />
                        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                          Redeemed for: {card.redeemed_trip_name || "Tri Holiday Tour"}
                        </Typography>
                      </Stack>
                    )}

                    {isMaturityEligible && (
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ color: "#f0abfc", mb: 1 }}>
                        <StarsIcon sx={{ fontSize: 16 }} />
                        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                          Holiday window passed • Saved for Year-End Maturity (₹12k + ₹2k Bonus)
                        </Typography>
                      </Stack>
                    )}

                    {isMaturedPaid && (
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ color: "#86efac", mb: 1 }}>
                        <VerifiedIcon sx={{ fontSize: 16 }} />
                        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                          ₹14,000 Annual Maturity Paid to Main Wallet
                        </Typography>
                      </Stack>
                    )}
                  </CardContent>

                  {/* Actions Bar */}
                  <Box
                    sx={{
                      p: 2,
                      pt: 0,
                      display: "flex",
                      gap: 1.5,
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
                        borderRadius: 2,
                        textTransform: "none",
                        "&:hover": {
                          borderColor: "#ffffff",
                          bgcolor: "rgba(255,255,255,0.08)",
                        },
                      }}
                    >
                      View QR Code
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
                          borderRadius: 2,
                          textTransform: "none",
                          "&:hover": { bgcolor: "#059669" },
                        }}
                      >
                        Redeem Holiday
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
          sx: { borderRadius: 4, maxWidth: 380, width: "100%", p: 1 },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", fontWeight: 900, pb: 0.5 }}>
          SPP Voucher QR Code
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center" }}>
          {qrModalCard && (
            <>
              <Typography variant="body2" sx={{ color: "#64748b", mb: 2 }}>
                Scan to redeem towards Tri Holiday packages or verify authenticity.
              </Typography>

              <QRCodeView value={qrModalCard.coupon_code} size={200} />

              <Box sx={{ mt: 2.5, p: 2, bgcolor: "#f8fafc", borderRadius: 3 }}>
                <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                  Alphanumeric Voucher Code
                </Typography>
                <Typography
                  sx={{
                    fontSize: 18,
                    fontWeight: 900,
                    fontFamily: "monospace",
                    color: "#0f172a",
                    letterSpacing: 1,
                  }}
                >
                  {qrModalCard.coupon_code}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#2563eb", fontWeight: 600, mt: 0.5 }}>
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
              borderRadius: 2.5,
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
          sx: { borderRadius: 4, maxWidth: 440, width: "100%", p: 1 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 0.5 }}>
          Redeem for Tri Holiday
        </DialogTitle>
        <DialogContent>
          {redeemModalCard && (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                Applying voucher <b>{redeemModalCard.coupon_code}</b> gives you an instant <b>₹1,000</b> deduction towards your travel package.
              </Alert>

              <TextField
                select
                fullWidth
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

              <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRadius: 3, border: "1px solid #e2e8f0" }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: 13, color: "#64748b" }}>Package Discount:</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>- ₹1,000.00</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ fontSize: 13, color: "#64748b" }}>Voucher Used:</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
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
              borderRadius: 2.5,
              px: 3,
            }}
          >
            {redeeming ? "Redeeming..." : "Confirm ₹1,000 Discount"}
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
    </Box>
  );
}
