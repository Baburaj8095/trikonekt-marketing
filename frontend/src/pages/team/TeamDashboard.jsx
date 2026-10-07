import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import PlayCircleRoundedIcon from "@mui/icons-material/PlayCircleRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import FlightTakeoffRoundedIcon from "@mui/icons-material/FlightTakeoffRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import CardGiftcardRoundedIcon from "@mui/icons-material/CardGiftcardRounded";
import AccessTimeFilledRoundedIcon from "@mui/icons-material/AccessTimeFilledRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import TempleHinduRoundedIcon from "@mui/icons-material/TempleHinduRounded";
import BeachAccessRoundedIcon from "@mui/icons-material/BeachAccessRounded";
import TerrainRoundedIcon from "@mui/icons-material/TerrainRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import MilitaryTechRoundedIcon from "@mui/icons-material/MilitaryTechRounded";
import WidgetsRoundedIcon from "@mui/icons-material/WidgetsRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import { useNavigate, useLocation } from "react-router-dom";
import API, { getWalletMe } from "../../api/api";
import QuickActionGrid from "../../components/common/QuickActionGrid";
import IxigoHolidaySection from "../../components/travel/IxigoHolidaySection";
import imgEcommerce from "../../assets/ecommerce.jpg";
import imgGifts from "../../assets/gifts.jpg";
import imgHolidays from "../../assets/holidays.jpg";
import imgKerala from "../../assets/kerala.jpg";
import imgThailand from "../../assets/thailand.jpg";
import imgHimalayanTempleBg from "../../assets/himalayan_temple_bg.jpg";
import topHeroWebp from "../../assets/top-hero-india-mountains.webp";
import imgHomepageBanner from "../../assets/homepage_banner.png";
import imgWishingGanesha from "../../assets/wishing_gowri_ganesha.png";
import imgWishingGrow from "../../assets/wishing_connect_grow.png";
import GiftCardModal from "../../components/vouchers/GiftCardModal";

function resolveApiMediaUrl(item, MEDIA_BASE) {
  let raw = item?.image_url || item?.image || item?.photo_url || item?.photo || "";
  if (!raw) return "";
  let s = String(raw).trim();

  // If Unsplash URL is present anywhere (even wrapped by Cloudinary or /media/ prefix):
  const unsplashMatch = s.match(/(?:https%3A\/?\/|https?:\/+)(images\.unsplash\.com[^\s"'>]*)/i);
  if (unsplashMatch) {
    let cleanUnsplash = "https://" + unsplashMatch[1];
    try {
      cleanUnsplash = decodeURIComponent(cleanUnsplash);
    } catch (_) {}
    return cleanUnsplash.replace(/%3F/gi, "?").replace(/%3D/gi, "=").replace(/%26/gi, "&");
  }

  // Handle general encoded full URLs in /media/
  if (s.includes("https%3A") || s.includes("http%3A")) {
    try {
      s = decodeURIComponent(s);
    } catch (_) {}
  }

  // Strip leading /media/ or media/ if followed by http(s):
  s = s.replace(/^\/?media\/+/i, "");

  // Fix single slashes after http(s): e.g. https:/example.com -> https://example.com
  s = s.replace(/^(https?):\/+([^\/])/i, "$1://$2");

  // If there's an embedded http(s) URL inside Cloudinary wrappers:
  const lastHttps = s.lastIndexOf("https://");
  if (lastHttps > 0) {
    s = s.substring(lastHttps);
  } else {
    const lastHttp = s.lastIndexOf("http://");
    if (lastHttp > 0) s = s.substring(lastHttp);
  }

  // Decode query params if needed
  if (s.includes("%3F") || s.includes("%3D") || s.includes("%26")) {
    s = s.replace(/%3F/gi, "?").replace(/%3D/gi, "=").replace(/%26/gi, "&");
  }

  if (s.startsWith("data:") || s.startsWith("blob:") || s.startsWith("/static/") || s.includes("static/media/")) return s;
  if (/^https?:\/\//i.test(s)) {
    if (/^https?:\/\/localhost(?::\d+)?\//i.test(s) && MEDIA_BASE) {
      const path = s.replace(/^https?:\/\/localhost(?::\d+)?/i, "");
      return `${MEDIA_BASE}${path}`;
    }
    return s;
  }
  if (!MEDIA_BASE) return s;
  return `${MEDIA_BASE}${s.startsWith("/") ? "" : "/"}${s}`;
}

const C = {
  appBg: "#F5F7FA",
  surface: "#ffffff",
  primary: "#2563eb",
  primaryDark: "#1e40af",
  accent: "#0f766e",
  warm: "#f59e0b",
  text: "#111827",
  textSec: "#64748b",
  border: "#e2e8f0",
  shadow: "0 12px 28px rgba(15, 23, 42, 0.07), 0 1px 0 rgba(15, 23, 42, 0.03)",
};

const MotionPaper = motion.create(Paper);

function SectionTitle({ title, action, onAction }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25, px: 0.5 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box
          sx={{
            width: 4,
            height: 16,
            borderRadius: 2,
            background: "linear-gradient(to bottom, #2563eb, #06b6d4)",
          }}
        />
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#1e293b", letterSpacing: "0.4px", textTransform: "uppercase" }}>
          {title}
        </Typography>
      </Stack>
      {action ? (
        <Typography
          onClick={onAction}
          sx={{
            fontSize: 12.5,
            fontWeight: 800,
            background: "linear-gradient(90deg, #2563eb, #7c3aed)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            cursor: "pointer",
            "&:hover": { opacity: 0.8 },
          }}
        >
          {action}
        </Typography>
      ) : null}
    </Stack>
  );
}

function GiftCoinsIllustration() {
  return (
    <Box
      sx={{
        position: "relative",
        width: { xs: 90, sm: 110 },
        height: { xs: 75, sm: 85 },
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="boxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="50%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id="ribbonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <linearGradient id="coinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="60%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {/* Sparkles */}
        <path d="M25 18 L27 23 L32 25 L27 27 L25 32 L23 27 L18 25 L23 23 Z" fill="#FEF08A" opacity="0.9" filter="url(#goldGlow)" />
        <path d="M104 32 L105.5 35.5 L109 37 L105.5 38.5 L104 42 L102.5 38.5 L99 37 L102.5 35.5 Z" fill="#FEF08A" opacity="0.85" />
        <path d="M88 14 L89 16.5 L91.5 17.5 L89 18.5 L88 21 L87 18.5 L84.5 17.5 L87 16.5 Z" fill="#FEF08A" opacity="0.8" />
        {/* Floating Coin 1 (Left) */}
        <ellipse cx="26" cy="44" rx="12" ry="7.5" transform="rotate(-25 26 44)" fill="url(#coinGrad)" stroke="#FDE68A" strokeWidth="1.2" />
        <ellipse cx="26" cy="44" rx="8" ry="4.5" transform="rotate(-25 26 44)" fill="none" stroke="#FDE68A" strokeWidth="0.8" opacity="0.7" />
        {/* Floating Coin 2 (Bottom Left) */}
        <ellipse cx="20" cy="68" rx="13" ry="6.5" transform="rotate(-15 20 68)" fill="url(#coinGrad)" stroke="#FDE68A" strokeWidth="1.2" />
        {/* Floating Coin 3 (Far Right) */}
        <ellipse cx="104" cy="46" rx="10.5" ry="6" transform="rotate(20 104 46)" fill="url(#coinGrad)" stroke="#FDE68A" strokeWidth="1.2" />
        {/* Gift Box Base */}
        <rect x="40" y="42" width="46" height="36" rx="6" fill="url(#boxGrad)" />
        {/* Gift Box Vertical Ribbon */}
        <rect x="59" y="42" width="8" height="36" fill="url(#ribbonGrad)" />
        {/* Gift Box Lid */}
        <rect x="36" y="36" width="54" height="11" rx="4" fill="url(#ribbonGrad)" stroke="#FDE68A" strokeWidth="1" />
        {/* Lid Vertical Ribbon */}
        <rect x="59" y="36" width="8" height="11" fill="#FEF08A" />
        {/* Bow Left Loop */}
        <path d="M61 36 C53 24 41 28 49 36 C53 36 57 36 61 36 Z" fill="url(#ribbonGrad)" stroke="#FEF08A" strokeWidth="1" />
        {/* Bow Right Loop */}
        <path d="M65 36 C73 24 85 28 77 36 C73 36 69 36 65 36 Z" fill="url(#ribbonGrad)" stroke="#FEF08A" strokeWidth="1" />
        {/* Bow Center Knot */}
        <circle cx="63" cy="36" r="3.5" fill="#FEF08A" />
      </svg>
    </Box>
  );
}

function PremiumHeader({ user, initials, vouchersCount = 0, notificationCount = 0, onOpenNotifications, onOpenGiftCards }) {
  const displayName = useMemo(() => {
    const raw = user?.full_name || user?.name || user?.username || "Baburaj";
    const str = String(raw).trim();
    // If username is digits (like phone number) and no full name, format neatly
    if (/^\d+$/.test(str)) {
      return str.length >= 10 ? str.slice(-10) : str;
    }
    const first = str.split(/\s+/)[0];
    return first.charAt(0).toUpperCase() + first.slice(1);
  }, [user]);

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 1, pb: 0.5, px: 0.5 }}>
      {/* Left: Glossy Avatar + Greeting */}
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Avatar
          sx={{
            width: 46,
            height: 46,
            background: "linear-gradient(135deg, #1D6AE5 0%, #0047AB 100%)",
            color: "#FFFFFF",
            fontWeight: 900,
            fontSize: 20,
            border: "2.5px solid rgba(255, 255, 255, 0.95)",
            boxShadow: "0 6px 18px rgba(2, 86, 180, 0.35)",
            cursor: "pointer",
          }}
          onClick={() => {
            try {
              window.dispatchEvent(new CustomEvent("trikonekt:open-consumer-sidebar"));
            } catch (_) {}
          }}
        >
          {initials}
        </Avatar>
        <Box>
          <Typography
            sx={{
              fontSize: { xs: 16.5, sm: 17.5 },
              fontWeight: 800,
              color: "#0F172A",
              lineHeight: 1.25,
              letterSpacing: "-0.015em",
            }}
          >
            Hello, {displayName} 👋
          </Typography>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 600,
              color: "#64748B",
              letterSpacing: "0.2px",
            }}
          >
            Community Consumer
          </Typography>
        </Box>
      </Stack>

      {/* Right: Actions (Dynamic Gift Card + Notification Bell) */}
      <Stack direction="row" alignItems="center" spacing={1.25}>
        <IconButton
          onClick={onOpenGiftCards}
          size="small"
          sx={{
            width: 40,
            height: 40,
            bgcolor: "rgba(255, 255, 255, 0.88)",
            backdropFilter: "blur(12px)",
            color: "#0F172A",
            border: "1px solid rgba(226, 232, 240, 0.9)",
            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.05)",
            position: "relative",
            transition: "all 160ms ease",
            "&:hover": { bgcolor: "#FFFFFF", borderColor: "#CBD5E1" },
          }}
        >
          <CardGiftcardRoundedIcon sx={{ fontSize: 20, color: vouchersCount > 0 ? "#D97706" : "#0F172A" }} />
          {/* Dynamic Voucher Badge if vouchers are available */}
          {vouchersCount > 0 && (
            <Box
              sx={{
                position: "absolute",
                top: -3,
                right: -3,
                minWidth: 17,
                height: 17,
                borderRadius: "50%",
                bgcolor: "#F59E0B",
                color: "#FFFFFF",
                fontSize: 10,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #FFFFFF",
                boxShadow: "0 2px 6px rgba(245, 158, 11, 0.45)",
                px: 0.3,
              }}
            >
              {vouchersCount}
            </Box>
          )}
        </IconButton>

        <IconButton
          onClick={onOpenNotifications}
          size="small"
          sx={{
            width: 40,
            height: 40,
            bgcolor: "rgba(255, 255, 255, 0.88)",
            backdropFilter: "blur(12px)",
            color: "#0F172A",
            border: "1px solid rgba(226, 232, 240, 0.9)",
            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.05)",
            position: "relative",
            transition: "all 160ms ease",
            "&:hover": { bgcolor: "#FFFFFF", borderColor: "#CBD5E1" },
          }}
        >
          <NotificationsNoneRoundedIcon sx={{ fontSize: 20 }} />
          {/* Red Notification Pill with Dynamic Badge */}
          {notificationCount > 0 && (
            <Box
              sx={{
                position: "absolute",
                top: -3,
                right: -3,
                minWidth: 17,
                height: 17,
                borderRadius: "50%",
                bgcolor: "#EF4444",
                color: "#FFFFFF",
                fontSize: 10,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #FFFFFF",
                boxShadow: "0 2px 6px rgba(239, 68, 68, 0.45)",
                px: 0.3,
              }}
            >
              {notificationCount}
            </Box>
          )}
        </IconButton>
      </Stack>
    </Stack>
  );
}

function DestinationSearch({ searchTerm, onSearchChange }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: "9px 18px",
        display: "flex",
        alignItems: "center",
        borderRadius: "24px",
        bgcolor: "rgba(255, 255, 255, 0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.95)",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.03)",
        transition: "all 180ms ease",
        "&:focus-within": {
          borderColor: "#0256B4",
          boxShadow: "0 10px 28px rgba(2, 86, 180, 0.15)",
        },
      }}
    >
      <SearchRoundedIcon sx={{ fontSize: 24, color: "#0256B4", mr: 1.5 }} />
      <input
        type="text"
        placeholder="Where do you want to go? (e.g. Munnar, Vaishno Devi)"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: "14px",
          fontWeight: 500,
          color: "#0F172A",
          fontFamily: "Inter, sans-serif",
        }}
      />
      <IconButton
        size="small"
        onClick={() => {
          const el = document.getElementById("ixigo-holiday-packages");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }}
        sx={{
          bgcolor: "#EFF6FF",
          color: "#0256B4",
          p: 0.7,
          borderRadius: "50%",
          "&:hover": { bgcolor: "#DBEAFE" },
        }}
      >
        <TuneRoundedIcon sx={{ fontSize: 19 }} />
      </IconButton>
    </Paper>
  );
}

{/* 1. STATIC TOP BRAND HERO (Always visible, permanent brand hero, no clipping at mobile) */}
function StaticTopHero({ onExplore }) {
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        minHeight: { xs: 360, sm: 380, md: 360 },
        borderRadius: "24px",
        overflow: "hidden",
        boxShadow: "0 16px 40px rgba(9, 30, 58, 0.22), 0 4px 12px rgba(9, 30, 58, 0.12)",
        bgcolor: "#091E3A",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        p: { xs: "24px 20px 24px 20px", sm: "28px 24px 24px 24px" },
      }}
    >
      {/* Permanent Static Background Image */}
      <Box
        component="img"
        src={topHeroWebp}
        alt="Sacred Journeys & Dream Holidays Across India"
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: { xs: "65% center", sm: "center" },
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* Dark gradient scrim from bottom-left for high text readability */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(9,30,58,0.3) 0%, rgba(9,30,58,0.65) 45%, rgba(9,30,58,0.92) 100%)",
          zIndex: 2,
        }}
      />

      {/* Editorial Content rendered in HTML/UI */}
      <Box sx={{ position: "relative", zIndex: 3, maxWidth: { xs: "100%", sm: 420 } }}>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            px: 1.25,
            py: 0.4,
            borderRadius: "16px",
            bgcolor: "rgba(254, 243, 199, 0.95)",
            color: "#92400E",
            fontWeight: 800,
            fontSize: { xs: 10, sm: 10.5 },
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            mb: { xs: 1.5, sm: 2 },
          }}
        >
          🛕 FEATURED DISCOVERY
        </Box>

        <Typography
          sx={{
            fontSize: { xs: 24, sm: 28 },
            fontWeight: 900,
            color: "#FFFFFF",
            lineHeight: 1.18,
            letterSpacing: "-0.025em",
            textShadow: "0 2px 10px rgba(0,0,0,0.5)",
            mb: { xs: 1.25, sm: 1.5 },
          }}
        >
          Sacred Journeys &<br />
          Dream Holidays<br />
          <span style={{ color: "#FCD34D" }}>Across India</span>
        </Typography>

        <Typography
          sx={{
            fontSize: { xs: 12.5, sm: 13.5 },
            color: "rgba(255, 255, 255, 0.92)",
            fontWeight: 500,
            lineHeight: 1.4,
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            mb: { xs: 2.25, sm: 2.5 },
          }}
        >
          Spiritual darshans, serene hill escapes and family holidays with premium stays and VIP transfers.
        </Typography>

        {/* Action CTA Button - Unclipped, fully visible with ample padding below */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Button
            variant="contained"
            onClick={onExplore}
            endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 18 }} />}
            sx={{
              height: 48,
              background: "linear-gradient(135deg, #1D6AE5 0%, #0047AB 100%)",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: { xs: 13, sm: 13.5 },
              borderRadius: "999px",
              textTransform: "none",
              px: { xs: 2.75, sm: 3.25 },
              boxShadow: "0 6px 18px rgba(2, 86, 180, 0.5)",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              "&:hover": { background: "linear-gradient(135deg, #1858c4 0%, #003b8e 100%)" },
            }}
          >
            Explore Now
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

{/* 2. DYNAMIC HERO / PROMOTIONAL SLIDER (Below Categories, auto-slides every 4-5s, navigation controls) */}
function DynamicPromotionalHero({ banners = [], loading = false }) {
  const defaultBanners = useMemo(
    () => [
      {
        id: "promo-kerala",
        title: "Experience Kerala Like Never Before",
        subtitle: "Tranquil backwaters, lush greenery and memorable family vacations.",
        image: imgKerala,
        cta: "View Packages",
      },
      {
        id: "promo-beach",
        title: "Sun-Kissed Coastal Escapes",
        subtitle: "Golden sands, azure waters, and luxury beachfront resorts.",
        image: imgHolidays,
        cta: "View Packages",
      },
      {
        id: "promo-thailand",
        title: "Tropical Odyssey Getaways",
        subtitle: "Exotic islands, vibrant culture, and world-class dining.",
        image: imgThailand,
        cta: "View Packages",
      },
    ],
    []
  );

  const bannerList = useMemo(() => {
    const valid = Array.isArray(banners) ? banners.filter((b) => b && (b.image || b.image_url)) : [];
    return valid.length > 0 ? valid : defaultBanners;
  }, [banners, defaultBanners]);

  const [idx, setIdx] = useState(0);
  const [imgLoadError, setImgLoadError] = useState({});
  const MEDIA_BASE = useMemo(() => String(API?.defaults?.baseURL || "").replace(/\/api\/?$/, ""), []);
  const active = bannerList[idx] || bannerList[0] || null;

  useEffect(() => {
    if (bannerList.length <= 1) return undefined;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % bannerList.length), 4500);
    return () => window.clearInterval(t);
  }, [bannerList.length]);

  const getFallbackImage = useCallback((b, bIdx) => {
    const t = String(b?.title || "").toLowerCase();
    if (t.includes("ganesha") || t.includes("blessing")) return imgWishingGanesha;
    if (t.includes("grow") || t.includes("connect") || t.includes("share") || t.includes("together")) return imgWishingGrow;
    if (t.includes("sacred") || t.includes("holiday") || t.includes("india")) return imgHomepageBanner;
    return bIdx === 0 ? imgKerala : bIdx === 1 ? imgHolidays : imgThailand;
  }, []);

  const getSubtitle = useCallback((b) => {
    if (b?.subtitle) return b.subtitle;
    const t = String(b?.title || "").toLowerCase();
    if (t.includes("ganesha") || t.includes("blessing")) {
      return "May divine blessings bring happiness, prosperity, and joyous success.";
    }
    if (t.includes("grow") || t.includes("connect") || t.includes("share") || t.includes("together")) {
      return "Empowering every member to connect, share prosperity, and achieve milestones.";
    }
    if (t.includes("sacred") || t.includes("holiday") || t.includes("india")) {
      return "Tranquil destinations, curated journeys, and memorable holiday experiences.";
    }
    return "Tranquil backwaters, lush greenery and memorable family vacations.";
  }, []);

  const hasEmbeddedArtwork = Boolean(active?.image_has_text === true);

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        minHeight: { xs: 200, sm: 220, md: 240 },
        aspectRatio: { xs: "16 / 9", sm: "16 / 8", md: "16 / 7" },
        borderRadius: "22px",
        overflow: "hidden",
        boxShadow: "0 12px 32px rgba(9, 30, 58, 0.18), 0 2px 8px rgba(9, 30, 58, 0.08)",
        bgcolor: "#091E3A",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        p: { xs: 2, sm: 2.5 },
      }}
    >
      {/* Preloaded Banner Images with smooth fade and automatic local fallback on load error */}
      {bannerList.map((b, bIdx) => {
        const rawUrl = resolveApiMediaUrl(b, MEDIA_BASE);
        const fallback = getFallbackImage(b, bIdx);
        const failed = !!imgLoadError[b?.id || bIdx];
        const src = (!failed && rawUrl) ? rawUrl : fallback;
        const isCurrent = bIdx === idx;

        return (
          <Box
            key={b?.id || bIdx}
            component="img"
            src={src}
            onError={() => {
              setImgLoadError((prev) => ({ ...prev, [b?.id || bIdx]: true }));
            }}
            alt={b?.title || "Promotional Banner"}
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              zIndex: isCurrent ? 1 : 0,
              opacity: isCurrent ? 1 : 0,
              pointerEvents: "none",
              transition: "opacity 600ms ease-in-out",
            }}
          />
        );
      })}

      {/* Dark gradient overlay only if rendering HTML text overlay */}
      {!hasEmbeddedArtwork && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(9,30,58,0.85) 0%, rgba(9,30,58,0.6) 48%, rgba(9,30,58,0.15) 100%)",
            zIndex: 2,
          }}
        />
      )}

      {/* Navigation Arrows (Prev / Next) */}
      {bannerList.length > 1 && (
        <>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i - 1 + bannerList.length) % bannerList.length);
            }}
            sx={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              bgcolor: "rgba(255, 255, 255, 0.85)",
              color: "#0F172A",
              width: 32,
              height: 32,
              zIndex: 4,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              "&:hover": { bgcolor: "#FFFFFF" },
            }}
          >
            <ArrowForwardIosRoundedIcon sx={{ fontSize: 14, transform: "rotate(180deg)" }} />
          </IconButton>

          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i + 1) % bannerList.length);
            }}
            sx={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              bgcolor: "rgba(255, 255, 255, 0.85)",
              color: "#0F172A",
              width: 32,
              height: 32,
              zIndex: 4,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              "&:hover": { bgcolor: "#FFFFFF" },
            }}
          >
            <ArrowForwardIosRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </>
      )}

      {/* Editorial Content */}
      <Box sx={{ position: "relative", zIndex: 3, maxWidth: { xs: 260, sm: 340 } }}>
        {!hasEmbeddedArtwork && (
          <>
            <Typography
              sx={{
                fontSize: { xs: 19, sm: 22 },
                fontWeight: 900,
                color: "#FFFFFF",
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
                textShadow: "0 2px 8px rgba(0,0,0,0.6)",
              }}
            >
              {active?.title || "Experience Kerala Like Never Before"}
            </Typography>

            <Typography
              sx={{
                fontSize: { xs: 11.5, sm: 12.5 },
                color: "rgba(255, 255, 255, 0.92)",
                fontWeight: 500,
                mt: 0.6,
                lineHeight: 1.35,
                textShadow: "0 1px 4px rgba(0,0,0,0.6)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {getSubtitle(active)}
            </Typography>
          </>
        )}
      </Box>

      {/* Bottom Row: Centered Pagination Dots (no duplicate button) */}
      <Stack direction="row" alignItems="center" justifyContent="center" sx={{ position: "relative", zIndex: 3, mt: 1 }}>
        {bannerList.length > 1 && (
          <Stack direction="row" spacing={0.7} alignItems="center">
            {bannerList.map((_, i) => (
              <Box
                key={i}
                onClick={() => setIdx(i)}
                sx={{
                  width: i === idx ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: i === idx ? "#FFFFFF" : "rgba(255,255,255,0.45)",
                  boxShadow: i === idx ? "0 0 6px rgba(255,255,255,0.9)" : "none",
                  cursor: "pointer",
                  transition: "all 200ms ease",
                }}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

const CATEGORY_TILES = [
  {
    key: "ALL",
    label: "All Packages",
    icon: WidgetsRoundedIcon,
    color: "#0256B4",
  },
  {
    key: "SACRED",
    label: "Sacred Journeys",
    icon: TempleHinduRoundedIcon,
    color: "#EA580C",
  },
  {
    key: "HILLS",
    label: "Hills Stations",
    icon: TerrainRoundedIcon,
    color: "#0284C7",
  },
  {
    key: "PARENTS",
    label: "Family Vacations",
    icon: GroupsRoundedIcon,
    color: "#16A34A",
  },
  {
    key: "BEACH",
    label: "Beach Holidays",
    icon: BeachAccessRoundedIcon,
    color: "#E11D48",
  },
  {
    key: "INTERNATIONAL",
    label: "International",
    icon: PublicRoundedIcon,
    color: "#7C3AED",
  },
];

function CategoryNavigation({ activeCategory, onSelectCategory }) {
  return (
    <Box
      sx={{
        display: "flex",
        gap: { xs: 1.25, sm: 1.5 },
        overflowX: "auto",
        py: 0.5,
        px: 0.25,
        scrollSnapType: "x mandatory",
        "&::-webkit-scrollbar": { display: "none" },
        scrollbarWidth: "none",
      }}
    >
      {CATEGORY_TILES.map((cat) => {
        const isSelected = activeCategory === cat.key;
        const IconComp = cat.icon;
        return (
          <Paper
            key={cat.key}
            elevation={0}
            onClick={() => onSelectCategory(cat.key)}
            sx={{
              flexShrink: 0,
              scrollSnapAlign: "start",
              width: { xs: 78, sm: 84 },
              height: { xs: 80, sm: 86 },
              borderRadius: "20px",
              background: isSelected
                ? "linear-gradient(180deg, #1D6AE5 0%, #0047AB 100%)"
                : "#FFFFFF",
              color: isSelected ? "#FFFFFF" : "#0F172A",
              border: isSelected ? "none" : "1px solid rgba(226, 232, 240, 0.85)",
              boxShadow: isSelected
                ? "0 8px 22px rgba(2, 86, 180, 0.32)"
                : "0 2px 8px rgba(15, 23, 42, 0.04)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              p: 0.75,
              cursor: "pointer",
              transition: "all 160ms ease",
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: isSelected ? "0 10px 24px rgba(2, 86, 180, 0.35)" : "0 4px 12px rgba(15, 23, 42, 0.08)",
              },
              "&:active": { transform: "scale(0.95)" },
            }}
          >
            <Box
              sx={{
                color: isSelected ? "#FFFFFF" : cat.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 0.5,
              }}
            >
              <IconComp sx={{ fontSize: 25 }} />
            </Box>
            <Typography
              sx={{
                fontSize: 10.5,
                fontWeight: isSelected ? 800 : 700,
                lineHeight: 1.15,
                textAlign: "center",
                color: isSelected ? "#FFFFFF" : "#0F172A",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {cat.label}
            </Typography>
          </Paper>
        );
      })}
    </Box>
  );
}

function TopAchieversRow({ items = [], loading = false, error = "", onSeeAll }) {
  const MEDIA_BASE = useMemo(() => String(API?.defaults?.baseURL || "").replace(/\/api\/?$/, ""), []);
  const rows = useMemo(() => {
    const valid = Array.isArray(items)
      ? items.filter((x) => x && (x.is_active === undefined || x.is_active === true))
      : [];
    if (valid.length > 0) return valid;
    return [
      { id: 1, name: "Rakesh Kumar", achieved: "Diamond", rank: 1 },
      { id: 2, name: "Priya Sharma", achieved: "Platinum", rank: 2 },
      { id: 3, name: "Amit Singh", achieved: "Gold", rank: 3 },
      { id: 4, name: "Sunita Devi", achieved: "Gold", rank: 4 },
      { id: 5, name: "Vikram Das", achieved: "Silver", rank: 5 },
    ];
  }, [items]);

  const getRankMeta = (index) => {
    if (index === 0) {
      return {
        crownEmoji: "👑",
        ringColor: "#F59E0B",
        badgeBg: "#F59E0B",
        label: "Diamond",
      };
    }
    if (index === 1) {
      return {
        crownEmoji: "👑",
        ringColor: "#0284C7",
        badgeBg: "#0284C7",
        label: "Platinum",
      };
    }
    if (index === 2) {
      return {
        crownEmoji: "👑",
        ringColor: "#EA580C",
        badgeBg: "#EA580C",
        label: "Gold",
      };
    }
    return {
      crownEmoji: null,
      ringColor: "#E2E8F0",
      badgeBg: "#64748B",
      label: index === 3 ? "Gold" : "Silver",
    };
  };

  return (
    <Box sx={{ my: 0.5 }}>
      {/* Section Header with Amber vertical bar */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5, px: 0.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            sx={{
              width: 4,
              height: 18,
              borderRadius: 2,
              bgcolor: "#F59E0B",
            }}
          />
          <Typography sx={{ fontSize: 16.5, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.01em" }}>
            Top Achievers
          </Typography>
        </Stack>

        <Typography
          onClick={onSeeAll}
          sx={{
            fontSize: 12.5,
            fontWeight: 800,
            color: "#0256B4",
            cursor: "pointer",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          See All →
        </Typography>
      </Stack>

      {/* Horizontal Circular Leaderboard matching reference image */}
      <Box
        sx={{
          display: "flex",
          gap: { xs: 2, sm: 2.5 },
          overflowX: "auto",
          py: 1,
          px: 0.5,
          scrollSnapType: "x mandatory",
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
        }}
      >
        {rows.map((a, i) => {
          const name = a?.name || "Community User";
          const initials =
            String(name)
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((x) => x[0])
              .join("")
              .toUpperCase() || "A";
          const photoUrl = resolveApiMediaUrl(a, MEDIA_BASE);
          const photoSrc = photoUrl || a?.photo_url || a?.photo || undefined;
          const meta = getRankMeta(i);

          return (
            <Box
              key={a?.id || i}
              sx={{
                flexShrink: 0,
                scrollSnapAlign: "start",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: { xs: 68, sm: 76 },
                textAlign: "center",
              }}
            >
              {/* Avatar container with crown and rank badge */}
              <Box sx={{ position: "relative", mb: 0.75 }}>
                {/* Crown for top 3 */}
                {meta.crownEmoji && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: -12,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 14,
                      zIndex: 2,
                      lineHeight: 1,
                    }}
                  >
                    {meta.crownEmoji}
                  </Box>
                )}

                <Avatar
                  src={photoSrc}
                  alt={name}
                  sx={{
                    width: 54,
                    height: 54,
                    bgcolor: "#0256B4",
                    color: "#FFFFFF",
                    fontWeight: 900,
                    fontSize: 16,
                    border: `2.5px solid ${meta.ringColor}`,
                    boxShadow: `0 4px 12px ${meta.ringColor}40`,
                  }}
                >
                  {initials}
                </Avatar>

                {/* Rank number badge at bottom of circle */}
                <Box
                  sx={{
                    position: "absolute",
                    bottom: -4,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    bgcolor: meta.badgeBg,
                    color: "#FFFFFF",
                    fontSize: 10.5,
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #FFFFFF",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  }}
                >
                  {i + 1}
                </Box>
              </Box>

              {/* Name */}
              <Typography
                sx={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  color: "#0F172A",
                  mt: 0.5,
                  width: "100%",
                  lineHeight: 1.2,
                }}
                noWrap
              >
                {name}
              </Typography>

              {/* Tier / Status */}
              <Typography
                sx={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: "#64748B",
                  width: "100%",
                }}
                noWrap
              >
                {a?.achieved || meta.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function HorizontalScroller({ children }) {
  return (
    <Box
      sx={{
        display: "flex",
        gap: 1.25,
        overflowX: "auto",
        pt: 0.5,
        pb: 1.5,
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {children}
    </Box>
  );
}

function IdCardDialog({ open, onClose, user, initials }) {
  const MEDIA_BASE = String(API?.defaults?.baseURL || "").replace(/\/api\/?$/, "");
  const avatar = resolveApiMediaUrl({ image_url: user?.avatar_url || user?.avatar || "" }, MEDIA_BASE);
  const role = user?.role || user?.category || "Community Consumer";
  const userId = user?.prefixed_id || user?.unique_id || user?.username || user?.id || "-";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 900 }}>Community ID Card</DialogTitle>
      <DialogContent>
        <Paper
          elevation={0}
          sx={{
            width: "100%",
            maxWidth: 320,
            mx: "auto",
            borderRadius: 2,
            overflow: "hidden",
            border: `1px solid ${C.border}`,
            bgcolor: "#fff",
          }}
        >
          <Box sx={{ p: 1.25, bgcolor: C.primary, color: "#fff", textAlign: "center" }}>
            <Typography sx={{ fontSize: 16, fontWeight: 1000 }}>ASIYAPP</Typography>
            <Typography sx={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>COMMUNITY CONSUMER ID CARD</Typography>
          </Box>
          <Box sx={{ p: 2, textAlign: "center" }}>
            <Avatar src={avatar || undefined} sx={{ width: 86, height: 86, mx: "auto", bgcolor: C.primaryDark, fontSize: 26, fontWeight: 1000 }}>
              {initials}
            </Avatar>
            <Typography sx={{ mt: 1.25, fontSize: 18, fontWeight: 1000 }}>{user?.full_name || user?.name || "Community User"}</Typography>
            <Typography sx={{ fontSize: 12, color: C.textSec, fontWeight: 800 }}>{role}</Typography>
            <Box sx={{ mt: 1.5, textAlign: "left", borderTop: `1px solid ${C.border}`, pt: 1.25 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: C.textSec }}>User ID</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 1000 }}>{userId}</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: C.textSec, mt: 1 }}>Phone Number</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 1000 }}>{user?.phone || "-"}</Typography>
            </Box>
          </Box>
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={() => window.print()}>Print</Button>
      </DialogActions>
    </Dialog>
  );
}

function MobileBottomNav({ value, onChange }) {
  const items = [
    { key: "home", label: "Home", icon: <HomeRoundedIcon />, value: 0 },
    { key: "team", label: "Community", icon: <GroupsRoundedIcon />, value: 1 },
    { key: "wallet", label: "Wallet", icon: <AccountBalanceWalletRoundedIcon />, value: 2 },
    { key: "refer", label: "Refer", icon: <ShareRoundedIcon />, value: 3 },
    { key: "profile", label: "Profile", icon: <PersonRoundedIcon />, value: 4 },
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        width: "100%",
        maxWidth: "none",
        minHeight: "calc(72px + env(safe-area-inset-bottom))",
        borderTop: `1px solid ${C.border}`,
        borderLeft: 0,
        borderRight: 0,
        borderBottom: 0,
        zIndex: 1030,
        borderRadius: 0,
        overflow: "hidden",
        boxShadow: "0 -8px 22px rgba(15,23,42,0.08)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-around", height: 72, pb: "env(safe-area-inset-bottom)", bgcolor: "rgba(255,255,255,0.96)" }}>
        {items.map((it) => {
          const active = value === it.value;
          return (
            <Box
              key={it.key}
              onClick={() => onChange(it.value)}
              role="button"
              tabIndex={0}
              sx={{
                width: "20%",
                minHeight: 72,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.35,
                color: active ? C.primary : "#94a3b8",
                cursor: "pointer",
                transition: "transform 140ms ease, color 140ms ease",
                "&:active": { transform: "scale(0.96)" },
              }}
            >
              <Box sx={{ width: 26, height: 26, display: "grid", placeItems: "center", bgcolor: "transparent", color: "inherit" }}>
                {React.cloneElement(it.icon, { fontSize: "small" })}
              </Box>
              <Typography sx={{ fontSize: 11, fontWeight: active ? 800 : 650, lineHeight: 1 }}>{it.label}</Typography>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

export default function TeamDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width:600px)");

  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user_user") || sessionStorage.getItem("user_user");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);

  const username = storedUser?.username || storedUser?.id || "";
  const fullName = storedUser?.full_name || storedUser?.name || "Community User";
  const status = storedUser?.status || storedUser?.profile_status || "Agent";
  const [profileUser, setProfileUser] = useState(storedUser);
  const [idCardOpen, setIdCardOpen] = useState(false);
  const [docErr, setDocErr] = useState("");
  const consumerPhone = useMemo(() => {
    const value = profileUser?.phone || storedUser?.phone || "";
    if (value) return value;
    const usernameDigits = String(profileUser?.username || username || "").replace(/\D/g, "");
    return usernameDigits.length >= 10 ? usernameDigits : "-";
  }, [profileUser?.phone, profileUser?.username, storedUser?.phone, username]);
  const initials = useMemo(() => {
    const n = String(profileUser?.full_name || fullName || username || "T").trim();
    const parts = n.split(" ").filter(Boolean);
    return `${parts[0]?.[0] || "T"}${parts.length > 1 ? parts[parts.length - 1]?.[0] : ""}`.toUpperCase();
  }, [profileUser?.full_name, fullName, username]);

  const [banners, setBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [bannersErr, setBannersErr] = useState("");
  const [achievers, setAchievers] = useState([]);
  const [achieversLoading, setAchieversLoading] = useState(false);
  const [achieversErr, setAchieversErr] = useState("");
  const [videos, setVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [primeRanks, setPrimeRanks] = useState([]);
  const [achievedPrimeLevel, setAchievedPrimeLevel] = useState(0);
  const [teamStats, setTeamStats] = useState({
    direct_count: 0,
    current_team_size: 0,
    current_rank: "Prime 1",
  });
  const [unredeemedGiftCard, setUnredeemedGiftCard] = useState(null);
  const [vouchersCount, setVouchersCount] = useState(0);
  const [giftCardModalOpen, setGiftCardModalOpen] = useState(false);
  const [giftCardBannerDismissed, setGiftCardBannerDismissed] = useState(false);

  const educationVideoSlots = useMemo(() => {
    const ranks =
      Array.isArray(primeRanks) && primeRanks.length
        ? primeRanks.slice(0, 10)
        : Array.from({ length: 10 }).map((_, idx) => ({
            id: null,
            level_number: idx + 1,
            rank_name: `Prime ${idx + 1}`,
            upgrade_amount: "",
          }));

    const byLevel = new Map();
    const unmapped = [];
    (Array.isArray(videos) ? videos : []).forEach((video) => {
      const level = Number(video?.required_rank_level || 0);
      if (level) byLevel.set(level, video);
      else unmapped.push(video);
    });

    return ranks.map((rank, idx) => {
      const level = Number(rank?.level_number || idx + 1);
      const mapped = byLevel.get(level) || unmapped[idx] || {};
      const isPurchased = Number(achievedPrimeLevel || 0) >= level || !!mapped.can_access;
      const rankId = mapped.required_rank || rank?.id || null;
      return {
        ...mapped,
        id: mapped.id || `prime-slot-${level}`,
        title: mapped.title || `Video ${level}`,
        description: mapped.description || "Digital education",
        required_rank: rankId,
        required_rank_name: mapped.required_rank_name || rank?.rank_name || `Prime ${level}`,
        required_rank_level: level,
        required_rank_amount: mapped.required_rank_amount || rank?.upgrade_amount || "",
        can_access: !!mapped.can_access || isPurchased,
        is_purchased: isPurchased,
      };
    });
  }, [achievedPrimeLevel, primeRanks, videos]);

  useEffect(() => {
    let alive = true;

    const fetchBanners = async () => {
      setBannersLoading(true);
      setBannersErr("");
      try {
        const res = await API.get("/business/team-consumer/wishing-banners/", { cacheTTL: 2500, retryAttempts: 1 });
        if (alive) setBanners(Array.isArray(res?.data?.results) ? res.data.results : []);
      } catch {
        if (alive) {
          setBannersErr("Unable to load wishing banners.");
          setBanners([]);
        }
      } finally {
        if (alive) setBannersLoading(false);
      }
    };

    const fetchAchievers = async () => {
      setAchieversLoading(true);
      setAchieversErr("");
      try {
        const res = await API.get("/business/team-consumer/top-achievers/", { cacheTTL: 2500, retryAttempts: 1 });
        if (alive) setAchievers(Array.isArray(res?.data?.results) ? res.data.results : []);
      } catch {
        if (alive) {
          setAchieversErr("Unable to load top achievers.");
          setAchievers([]);
        }
      } finally {
        if (alive) setAchieversLoading(false);
      }
    };

    const fetchProfile = async () => {
      try {
        const res = await API.get("/accounts/profile/", { cacheTTL: 10000, retryAttempts: 1 });
        if (alive && res?.data) setProfileUser({ ...storedUser, ...res.data });
      } catch {
        if (alive) setProfileUser(storedUser);
      }
    };

    const fetchUnclaimedGiftCards = async () => {
      try {
        const res = await API.get("/accounts/wallet/vouchers/", { cacheTTL: 10000, retryAttempts: 1 });
        const list = Array.isArray(res?.data?.results) ? res.data.results : [];
        const currentUname = String(storedUser?.username || "").trim();
        const activeVouchers = list.filter((v) => v.status === "ACTIVE");
        if (alive) {
          setVouchersCount(activeVouchers.length);
        }
        const unredeemed = list.find(
          (v) =>
            v.status === "ACTIVE" &&
            String(v.creator_username || "").trim() !== currentUname
        );
        if (alive && unredeemed) {
          setUnredeemedGiftCard(unredeemed);
        }
      } catch {}
    };

    fetchBanners();
    fetchAchievers();
    fetchProfile();
    fetchUnclaimedGiftCards();
    return () => {
      alive = false;
    };
  }, [storedUser]);

  const navIndex = useMemo(() => {
    const p = location.pathname || "";
    if (p.includes("/genealogy")) return 1;
    if (p.includes("/wallet")) return 2;
    if (p.includes("/refer-earn")) return 3;
    if (p.includes("/profile")) return 4;
    return 0;
  }, [location.pathname]);

  const handleNav = (idx) => {
    if (idx === 0) navigate("/user/team-dashboard");
    if (idx === 1) navigate("/user/genealogy-5");
    if (idx === 2) navigate("/user/team-wallet");
    if (idx === 3) navigate("/user/refer-earn");
    if (idx === 4) {
      try {
        window.dispatchEvent(new CustomEvent("trikonekt:open-consumer-sidebar"));
      } catch (_) {}
    }
  };

  const resolveDocumentUrl = useCallback((raw) => {
    if (!raw) return "";
    const s = String(raw);
    if (/^https?:\/\//i.test(s) || s.startsWith("data:")) return s;
    const mediaBase = String(API?.defaults?.baseURL || "").replace(/\/api\/?$/, "");
    return mediaBase ? `${mediaBase}${s.startsWith("/") ? "" : "/"}${s}` : s;
  }, []);

  const openLatestDocument = useCallback(async (kind) => {
    setDocErr("");
    try {
      const res = await API.get(`/business/team-consumer/documents/${kind}/latest/`, { retryAttempts: 1 });
      const url = resolveDocumentUrl(res?.data?.file_url || res?.data?.file);
      if (!url) {
        setDocErr("Document uploaded record has no file.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
      navigate("/user/team-dashboard", { replace: true });
    } catch (e) {
      setDocErr(e?.response?.data?.detail || "Document is not uploaded yet.");
      navigate("/user/team-dashboard", { replace: true });
    }
  }, [navigate, resolveDocumentUrl]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const action = String(params.get("action") || "").toLowerCase();
    if (!action) return;
    if (action === "id-card") setIdCardOpen(true);
    if (action === "pdf") openLatestDocument("PDF");
    if (action === "certificate") openLatestDocument("CERTIFICATE");
  }, [location.search, openLatestDocument]);

function SPPMonthlyCadenceWidget() {
  const navigate = useNavigate();
  const [cadence, setCadence] = useState(null);
  const [vouchersCount, setVouchersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cadenceRes, sppCardsRes, walletVouchersRes] = await Promise.allSettled([
          API.get("/business/spp/cadence/", { cacheTTL: 10000, retryAttempts: 1 }),
          API.get("/business/spp/gift-cards/", { cacheTTL: 10000, retryAttempts: 1 }),
          API.get("/accounts/wallet/vouchers/", { cacheTTL: 10000, retryAttempts: 1 }),
        ]);

        if (!alive) return;

        let totalPurchased = 0;

        // 1. Check SPP Gift Cards (summary total_purchased or list length)
        if (sppCardsRes.status === "fulfilled" && sppCardsRes.value?.data) {
          const sppData = sppCardsRes.value.data;
          const sppSummaryPurchased = sppData?.summary?.total_purchased;
          const sppBoxesCompleted = sppData?.summary?.annual_maturity?.boxes_completed;
          const sppResultsCount = Array.isArray(sppData?.results) ? sppData.results.length : 0;
          if (typeof sppSummaryPurchased === "number") {
            totalPurchased = Math.max(totalPurchased, sppSummaryPurchased);
          } else if (typeof sppBoxesCompleted === "number") {
            totalPurchased = Math.max(totalPurchased, sppBoxesCompleted);
          } else if (sppResultsCount > 0) {
            totalPurchased = Math.max(totalPurchased, sppResultsCount);
          }
        }

        // 2. Check Cadence endpoint (returns object directly or cadence key)
        if (cadenceRes.status === "fulfilled" && cadenceRes.value?.data) {
          const rawCadence = cadenceRes.value.data?.cadence || cadenceRes.value.data;
          setCadence(rawCadence);
          if (typeof rawCadence?.boxes_completed === "number") {
            totalPurchased = Math.max(totalPurchased, rawCadence.boxes_completed);
          }
        }

        // 3. Check Wallet Vouchers endpoint
        if (walletVouchersRes.status === "fulfilled" && walletVouchersRes.value?.data) {
          const vList = Array.isArray(walletVouchersRes.value.data?.results)
            ? walletVouchersRes.value.data.results
            : Array.isArray(walletVouchersRes.value.data)
            ? walletVouchersRes.value.data
            : [];
          if (vList.length > 0) {
            totalPurchased = Math.max(totalPurchased, vList.length);
          }
        }

        setVouchersCount(totalPurchased);
      } catch (_) {
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const boxes = Math.min(12, Math.max(0, vouchersCount));
  const isCompleted = cadence?.cadence_status === "COMPLETED" || boxes >= 12;
  const remaining = Math.max(0, 12 - boxes);

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.25, sm: 2.75 },
        borderRadius: "24px",
        background: "linear-gradient(135deg, #091E3A 0%, #0F2D54 50%, #0A3D78 100%)",
        color: "#FFFFFF",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        boxShadow: "0 14px 34px rgba(9, 30, 58, 0.28)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top Header: Crown + SPP REWARDS > on left, View Details → pill on right */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.75 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography sx={{ fontSize: 18 }}>👑</Typography>
          <Typography sx={{ fontSize: 14.5, fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.5px" }}>
            SPP REWARDS &gt;
          </Typography>
        </Stack>

        <Button
          size="small"
          onClick={() => navigate("/user/spp-gift-cards")}
          endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 15 }} />}
          sx={{
            fontSize: 11.5,
            fontWeight: 700,
            textTransform: "none",
            borderRadius: "20px",
            bgcolor: "rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(8px)",
            color: "#FFFFFF",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            px: 1.8,
            py: 0.4,
            "&:hover": { bgcolor: "rgba(255, 255, 255, 0.25)" },
          }}
        >
          View Details
        </Button>
      </Stack>

      {/* Middle Section: Progress info on left, 3D gift box & coins on right */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box sx={{ flex: 1, pr: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 1.25 }}>
            <Typography sx={{ fontSize: 12.5, color: "rgba(255, 255, 255, 0.85)", fontWeight: 600 }}>
              Your Progress
            </Typography>
            <Typography sx={{ fontSize: 25, fontWeight: 900, color: "#FFFFFF", lineHeight: 1 }}>
              {boxes} <span style={{ color: "#38BDF8", fontWeight: 700 }}>/ 12</span>
            </Typography>
          </Stack>

          {/* Cyan Glowing Progress Bar */}
          <Box
            sx={{
              width: "100%",
              height: 10,
              borderRadius: 5,
              bgcolor: "rgba(255, 255, 255, 0.16)",
              overflow: "hidden",
              mb: 1.25,
            }}
          >
            <Box
              sx={{
                width: `${Math.min(100, Math.round((boxes / 12) * 100))}%`,
                height: "100%",
                background: "linear-gradient(90deg, #00C2CB 0%, #38BDF8 100%)",
                borderRadius: 5,
                boxShadow: "0 0 12px rgba(0, 194, 203, 0.7)",
                transition: "width 0.5s ease",
              }}
            />
          </Box>

          <Typography sx={{ fontSize: 12, color: "rgba(255, 255, 255, 0.88)", fontWeight: 500 }}>
            {isCompleted
              ? "All 12 cycles completed! Maturity unlocked."
              : `${remaining} boxes remaining to complete this cycle`}
          </Typography>
        </Box>

        {/* 3D Gift Box & Gold Coins Illustration */}
        <GiftCoinsIllustration />
      </Stack>
    </Paper>
  );
}

  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#F4F7FC", pb: 5, position: "relative" }}>
      {/* 1. Cinematic Himalayan Temple Scenic Backdrop covering Header & Search (Rich Sunset & Mountain Contrast) */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: { xs: 350, sm: 390 },
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <Box
          component="img"
          src={imgHimalayanTempleBg}
          alt="Himalayan Mountain Landscape"
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 18%",
            filter: "contrast(1.3) saturate(1.35) brightness(0.92)",
          }}
        />
        {/* Soft bottom atmospheric fade into page body with rich mountain visibility at top */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0, 0, 0, 0.16) 0%, rgba(0, 0, 0, 0.02) 25%, rgba(244, 247, 252, 0.35) 65%, rgba(244, 247, 252, 0.95) 90%, #F4F7FC 100%)",
          }}
        />
      </Box>

      <Box
        className="consumer-fintech-page"
        sx={{
          width: "100%",
          maxWidth: 1180,
          mx: "auto",
          px: { xs: 2, sm: 2.5 },
          py: 1,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Stack spacing={{ xs: 2.25, sm: 2.75 }}>
          {/* 1. PREMIUM HEADER */}
          <PremiumHeader
            user={profileUser}
            initials={initials}
            vouchersCount={vouchersCount}
            notificationCount={unredeemedGiftCard ? 1 : 0}
            onOpenNotifications={() => {
              try {
                window.dispatchEvent(new CustomEvent("trikonekt:open-consumer-sidebar"));
              } catch (_) {}
            }}
            onOpenGiftCards={() => navigate("/user/spp-gift-cards")}
          />

          {/* 2. DESTINATION SEARCH */}
          <DestinationSearch
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />

          {/* 3. STATIC TOP BRAND HERO (Always Visible, 16:9, permanent brand hero, no auto-slide) */}
          <StaticTopHero
            onExplore={() => {
              const el = document.getElementById("ixigo-holiday-packages");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          />

          {/* 4. CATEGORY NAVIGATION (Immediately below static hero) */}
          <CategoryNavigation
            activeCategory={activeCategory}
            onSelectCategory={(cat) => {
              setActiveCategory(cat);
              const el = document.getElementById("ixigo-holiday-packages");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          />

          {/* 5. DYNAMIC HERO / PROMOTIONAL SLIDER (Below categories, auto-sliding admin marketing banners) */}
          <DynamicPromotionalHero
            banners={banners}
            loading={bannersLoading}
          />

          {/* 6. SPP REWARDS CARD */}
          <SPPMonthlyCadenceWidget />

          {/* 6. UNCLAIMED GIFT CARD ALERT BANNER (If any) */}
          {unredeemedGiftCard && !giftCardBannerDismissed && (
            <Paper
              elevation={0}
              onClick={() => setGiftCardModalOpen(true)}
              sx={{
                p: { xs: 2, sm: 2.25 },
                borderRadius: "18px",
                background: "linear-gradient(135deg, #e11d48 0%, #f43f5e 40%, #fb923c 100%)",
                color: "#ffffff",
                boxShadow: "0 10px 28px rgba(225, 29, 72, 0.28)",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
                transition: "transform 180ms ease, box-shadow 180ms ease",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: "0 14px 34px rgba(225, 29, 72, 0.35)",
                },
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
                spacing={2}
              >
                <Stack direction="row" alignItems="center" spacing={1.75}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: "14px",
                      bgcolor: "rgba(255,255,255,0.22)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      backdropFilter: "blur(6px)",
                      flexShrink: 0,
                    }}
                  >
                    <CardGiftcardRoundedIcon sx={{ fontSize: 28, color: "#ffffff" }} />
                  </Box>

                  <Box>
                    <Typography
                      sx={{
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        color: "rgba(255,255,255,0.9)",
                      }}
                    >
                      🎁 You received a P2P Gift Card!
                    </Typography>
                    <Typography sx={{ fontSize: { xs: 16, sm: 17.5 }, fontWeight: 900, color: "#ffffff", lineHeight: 1.2 }}>
                      ₹{Number(unredeemedGiftCard.amount || unredeemedGiftCard.value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })} Gift Coupon
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.85)", mt: 0.25 }}>
                      From {unredeemedGiftCard.creator_username || "Community Member"} • Click to claim & redeem instantly
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" alignItems="center" spacing={1} sx={{ width: { xs: "100%", sm: "auto" } }}>
                  <Button
                    variant="contained"
                    fullWidth
                    size="small"
                    sx={{
                      bgcolor: "#ffffff",
                      color: "#e11d48",
                      fontWeight: 900,
                      fontSize: 13,
                      textTransform: "none",
                      borderRadius: "12px",
                      px: 2.5,
                      py: 0.9,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      "&:hover": { bgcolor: "#fff1f2" },
                    }}
                  >
                    Claim & Redeem →
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          )}

          {docErr ? (
            <Paper elevation={0} sx={{ p: 1.25, borderRadius: 2, border: "1px solid #fecaca", bgcolor: "#fef2f2" }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#b91c1c" }}>{docErr}</Typography>
            </Paper>
          ) : null}

          {/* 7. TOP ACHIEVERS (Leaderboard) */}
          <TopAchieversRow items={achievers} loading={achieversLoading} error={achieversErr} />

          {/* 8. POPULAR HOLIDAY PACKAGES */}
          <IxigoHolidaySection
            externalCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            hideSearchBar={true}
            hideCategoryPills={true}
          />
        </Stack>
      </Box>

      <IdCardDialog
        open={idCardOpen}
        onClose={() => {
          setIdCardOpen(false);
          navigate("/user/team-dashboard", { replace: true });
        }}
        user={profileUser}
        initials={initials}
      />

      {/* GIFT CARD REDEMPTION MODAL */}
      <GiftCardModal
        open={giftCardModalOpen}
        voucher={unredeemedGiftCard}
        onClose={() => setGiftCardModalOpen(false)}
        onRedeemSuccess={() => {
          setUnredeemedGiftCard(null);
        }}
      />
    </Box>
  );
}
