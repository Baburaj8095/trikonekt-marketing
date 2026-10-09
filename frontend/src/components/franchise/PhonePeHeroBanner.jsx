import React, { useState, useEffect } from "react";
import { Box, Typography, Button, Stack, Paper } from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import primeDealImg from "../../assets/prime_deal.png";

const BANNERS = [
  {
    id: 1,
    tag: "TRIKONEKT",
    headline: "Grow Your Local Business",
    subtitle: "More Merchants • More Consumers More Earnings",
    cta: "Explore Now →",
    footnote: "Autonomous daily payouts • 75% Main & 25% Self Rebirth",
    action: "command_center",
  },
  {
    id: 2,
    tag: "Prime Digital Education",
    headline: "Starting from ₹2,000",
    subtitle: "Instant Geo Overrides & 50% Direct Referral",
    cta: "Check now →",
    footnote: "100% Instant distribution across 6-tier territory upline",
    action: "self_rebirth",
  },
  {
    id: 3,
    tag: "SPP Monthly Subscription",
    headline: "₹1,000 Smart Box + Voucher",
    subtitle: "Earn ongoing monthly physical product box overrides",
    cta: "Explore now →",
    footnote: "Monthly product delivery with retail cashback vouchers",
    action: "merchants",
  },
  {
    id: 4,
    tag: "₹250 Self-Rebirth Matrix",
    headline: "Autonomous 5/3 Matrix Loop",
    subtitle: "Auto-spawns next ID every ₹250 accumulated",
    cta: "View Matrix →",
    footnote: "₹20 Tier 1 & ₹30 Tier 2 Royalty pool at 11:59 PM daily",
    action: "self_rebirth",
  },
];

export default function PhonePeHeroBanner({ onAction }) {
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % BANNERS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const active = BANNERS[currentIdx];

  return (
    <Paper
      elevation={0}
      sx={{
        width: "100%",
        borderRadius: "22px",
        background: "linear-gradient(135deg, #4A154B 0%, #5F259F 55%, #3B0764 100%)",
        color: "#FFFFFF",
        p: { xs: 2.25, sm: 2.5 },
        pb: 1.5,
        mb: 2,
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 10px 30px rgba(95, 37, 159, 0.35)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Background Subtle Gradient Glow */}
      <Box
        sx={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(251, 191, 36, 0.25) 0%, rgba(95, 37, 159, 0) 70%)",
          pointerEvents: "none",
        }}
      />

      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
        {/* Left: Editorial PhonePe Headline & Pill CTA */}
        <Box sx={{ flex: 1, minWidth: 0, zIndex: 2 }}>
          <Typography
            noWrap
            sx={{
              fontSize: { xs: 11, sm: 12 },
              fontWeight: 800,
              color: "#FDE68A",
              letterSpacing: "0.4px",
              mb: 0.5,
              textTransform: "uppercase",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {active.tag}
          </Typography>

          <Typography
            sx={{
              fontSize: { xs: 20, sm: 22 },
              fontWeight: 900,
              color: "#FFFFFF",
              lineHeight: 1.18,
              letterSpacing: "-0.025em",
              textShadow: "0 2px 8px rgba(0,0,0,0.3)",
              mb: 1.5,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {active.headline}
          </Typography>

          {/* PhonePe White Pill Button ("Check now →") */}
          <Button
            variant="contained"
            onClick={() => onAction && onAction(active.action)}
            endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{
              bgcolor: "#FFFFFF",
              color: "#5F259F",
              fontWeight: 900,
              fontSize: { xs: 12, sm: 12.5 },
              borderRadius: "999px",
              textTransform: "none",
              px: 2.25,
              py: 0.6,
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.25)",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              "&:hover": {
                bgcolor: "#F8FAFC",
                color: "#4A154B",
              },
              "&:active": { transform: "scale(0.95)" },
            }}
          >
            {active.cta}
          </Button>
        </Box>

        {/* Right: PhonePe 3D Illustration Graphics */}
        <Box
          sx={{
            width: { xs: 100, sm: 120 },
            height: { xs: 90, sm: 100 },
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* 3D Graphic Asset */}
          <Box
            component="img"
            src={primeDealImg}
            alt="Prime Growth"
            sx={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.4))",
            }}
          />
        </Box>
      </Stack>

      {/* Bottom Disclaimer Footnote (Exact PhonePe Styling) */}
      <Box
        sx={{
          borderTop: "1px solid rgba(255, 255, 255, 0.15)",
          mt: 1.8,
          pt: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography
          noWrap
          sx={{
            fontSize: 10,
            color: "rgba(255, 255, 255, 0.75)",
            fontWeight: 600,
            letterSpacing: "0.1px",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          {active.footnote}
        </Typography>

        {/* Slide indicator dots */}
        <Stack direction="row" spacing={0.5} sx={{ ml: 1, flexShrink: 0 }}>
          {BANNERS.map((b, i) => (
            <Box
              key={b.id}
              onClick={() => setCurrentIdx(i)}
              sx={{
                width: currentIdx === i ? 14 : 5,
                height: 5,
                borderRadius: "3px",
                bgcolor: currentIdx === i ? "#FBBF24" : "rgba(255,255,255,0.3)",
                transition: "all 200ms ease",
                cursor: "pointer",
              }}
            />
          ))}
        </Stack>
      </Box>
    </Paper>
  );
}
