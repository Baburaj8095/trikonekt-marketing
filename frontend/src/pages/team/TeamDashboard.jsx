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
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import { useNavigate, useLocation } from "react-router-dom";
import API, { getWalletMe } from "../../api/api";
import BalanceCard from "../../components/common/BalanceCard";
import QuickActionGrid from "../../components/common/QuickActionGrid";
import imgEcommerce from "../../assets/ecommerce.jpg";
import imgGifts from "../../assets/gifts.jpg";
import imgHolidays from "../../assets/holidays.jpg";
import imgKerala from "../../assets/kerala.jpg";
import imgThailand from "../../assets/thailand.jpg";

function resolveApiMediaUrl(item, MEDIA_BASE) {
  const raw = item?.image_url || item?.image || "";
  if (!raw) return "";
  const s = String(raw);
  if (s.startsWith("data:")) return s;
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
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#64748b", letterSpacing: "0.5px", textTransform: "uppercase" }}>
        {title}
      </Typography>
      {action ? (
        <Typography
          onClick={onAction}
          sx={{
            fontSize: 12,
            fontWeight: 700,
            color: "#2563eb",
            cursor: "pointer",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {action}
        </Typography>
      ) : null}
    </Stack>
  );
}

function DynamicHeroWishingBanner({
  banners = [],
  loading = false,
  error = "",
  user = {},
  directTeamCount = 0,
  totalTeamCount = 0,
  currentRank = "Prime 1",
}) {
  const bannerList = Array.isArray(banners) ? banners : [];
  const [idx, setIdx] = useState(0);
  const MEDIA_BASE = useMemo(() => String(API?.defaults?.baseURL || "").replace(/\/api\/?$/, ""), []);
  const active = bannerList[idx] || null;
  const activeSrc = useMemo(() => resolveApiMediaUrl(active, MEDIA_BASE), [active, MEDIA_BASE]);

  const fullName = user?.full_name || user?.name || user?.username || "Team User";

  useEffect(() => {
    if (!bannerList.length) return undefined;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % bannerList.length), 4000);
    return () => window.clearInterval(t);
  }, [bannerList.length]);

  if (activeSrc) {
    return (
      <Paper
        elevation={0}
        sx={{
          borderRadius: "18px",
          border: `1px solid ${C.border}`,
          bgcolor: C.surface,
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
          overflow: "hidden",
        }}
      >
        <Box sx={{ position: "relative", width: "100%", height: { xs: 170, sm: 210 } }}>
          <Box
            component="img"
            src={activeSrc}
            alt={active.title || "Wishing Banner"}
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(15,23,42,0.7) 0%, transparent 60%)",
              display: "flex",
              alignItems: "flex-end",
              p: 2,
            }}
          >
            <Typography sx={{ color: "#ffffff", fontWeight: 700, fontSize: 14 }}>
              {active.title || "Special Announcement"}
            </Typography>
          </Box>
        </Box>
        {bannerList.length > 1 && (
          <Stack direction="row" spacing={0.75} justifyContent="center" sx={{ py: 1 }}>
            {bannerList.map((_, i) => (
              <Box
                key={i}
                onClick={() => setIdx(i)}
                sx={{
                  width: i === idx ? 18 : 6,
                  height: 6,
                  borderRadius: 4,
                  bgcolor: i === idx ? C.primary : "#cbd5e1",
                  cursor: "pointer",
                  transition: "all 140ms ease",
                }}
              />
            ))}
          </Stack>
        )}
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.25, sm: 2.75 },
        borderRadius: "18px",
        background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
        color: "#ffffff",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 10px 28px rgba(15, 23, 42, 0.22)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: -24,
          right: -24,
          width: 130,
          height: 130,
          borderRadius: "50%",
          bgcolor: "rgba(37, 99, 235, 0.14)",
          filter: "blur(20px)",
        }}
      />

      <Stack spacing={1.75}>
        <Box>
          <Typography
            sx={{
              fontSize: 10.5,
              fontWeight: 800,
              color: "#38BDF8",
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            GOOD MORNING, TEAM CONSUMER
          </Typography>
          <Typography sx={{ fontSize: { xs: 18, sm: 20 }, fontWeight: 800, color: "#ffffff", mt: 0.5 }}>
            Welcome back, {fullName} 👋
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: "#94A3B8", mt: 0.25 }}>
            Here's what's happening today
          </Typography>
        </Box>

        {/* 2 Quick Dynamic Team & Rank Metrics (No duplicate wallet balance) */}
        <Stack direction="row" spacing={1.5}>
          <Box
            sx={{
              flex: 1,
              p: 1.5,
              borderRadius: "12px",
              bgcolor: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <Typography sx={{ fontSize: 17, fontWeight: 800, color: "#ffffff" }}>
              {directTeamCount}
            </Typography>
            <Typography sx={{ fontSize: 11, color: "#94A3B8", fontWeight: 500, mt: 0.2 }}>
              Direct Referrals
            </Typography>
          </Box>

          <Box
            sx={{
              flex: 1,
              p: 1.5,
              borderRadius: "12px",
              bgcolor: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <Typography sx={{ fontSize: 17, fontWeight: 800, color: "#ffffff" }} noWrap>
              {totalTeamCount > 0 ? totalTeamCount : currentRank}
            </Typography>
            <Typography sx={{ fontSize: 11, color: "#94A3B8", fontWeight: 500, mt: 0.2 }}>
              {totalTeamCount > 0 ? "Total Team" : "Current Rank"}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 0.5, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <Typography sx={{ fontSize: 12, fontStyle: "italic", color: "#CBD5E1" }}>
            "Build today. Grow tomorrow."
          </Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#38BDF8" }}>
            →
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

function TopAchieversRow({ items = [], loading = false, error = "", onSeeAll }) {
  const rows = Array.isArray(items) ? items : [];
  return (
    <Box>
      <SectionTitle title="TOP ACHIEVERS" action="See all →" onAction={onSeeAll} />

      {loading ? (
        <Typography sx={{ fontSize: 12, color: C.textSec, fontWeight: 600, mb: 1 }}>Loading achievers...</Typography>
      ) : rows.length > 0 ? (
        <Stack direction="row" spacing={1.5} sx={{ overflowX: "auto", pb: 0.5, "&::-webkit-scrollbar": { display: "none" } }}>
          {rows.map((a, i) => {
            const name = a?.name || "Team Member";
            const initials = String(name).trim().slice(0, 2).toUpperCase();
            return (
              <Paper
                key={a?.id || i}
                elevation={0}
                sx={{
                  flexShrink: 0,
                  width: { xs: 160, sm: 190 },
                  border: `1px solid ${C.border}`,
                  borderRadius: "16px",
                  p: 1.5,
                  bgcolor: C.surface,
                  boxShadow: "0 4px 14px rgba(15, 23, 42, 0.05)",
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Avatar sx={{ width: 42, height: 42, bgcolor: C.primary, fontWeight: 800, fontSize: 14 }}>
                    {initials}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.text }} noWrap>
                      {name}
                    </Typography>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: C.primaryDark }} noWrap>
                      {a?.achieved || "Top Performer"}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      ) : (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: "16px",
            border: `1px dashed ${C.border}`,
            bgcolor: C.surface,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              bgcolor: "#EFF6FF",
              color: "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            ★
          </Box>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.text }}>
              Team Achievers Spotlight
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: C.textSec }}>
              New achievers will appear here as the team advances.
            </Typography>
          </Box>
        </Paper>
      )}
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
        pb: 0.5,
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {children}
    </Box>
  );
}

function VideoScroller({ videos = [], loading = false, onOpenFallback, onBuyPrime }) {
  const MEDIA_BASE = useMemo(() => String(API?.defaults?.baseURL || "").replace(/\/api\/?$/, ""), []);
  const resolveRaw = (raw) => resolveApiMediaUrl({ image_url: raw }, MEDIA_BASE);
  const [activeVideo, setActiveVideo] = useState(null);

  const rows = Array.isArray(videos) ? videos : [];

  const getYouTubeEmbedId = (v) => {
    if (v?.youtube_video_id) return v.youtube_video_id;
    const url = v?.youtube_url || v?.video_url || v?.video;
    if (!url) return "";
    const match = String(url).match(/(?:v=|\/embed\/|\/v\/|https:\/\/youtu\.be\/|\/watch\?v=|\&v=)([^#\&\?]{11})/);
    return match ? match[1] : "";
  };

  return (
    <Box>
      <SectionTitle title="Digital Education Videos" action="Open" onAction={onOpenFallback} />
      {loading ? (
        <Typography sx={{ fontSize: 12, color: C.textSec, fontWeight: 700, mb: 1 }}>Loading videos...</Typography>
      ) : null}
      <HorizontalScroller>
        {rows.map((v) => {
          const videoUrl = resolveRaw(v.video_url || v.video);
          const ytEmbedId = getYouTubeEmbedId(v);
          const ytThumb = ytEmbedId ? `https://img.youtube.com/vi/${ytEmbedId}/hqdefault.jpg` : "";
          const thumb = ytThumb || resolveRaw(v.thumbnail_url || v.thumbnail);
          const isPurchased = !!v.is_purchased || !!v.can_access;
          const canWatch = isPurchased && (!!ytEmbedId || !!videoUrl);
          const rankLabel = v.required_rank_name || (v.required_rank_level ? `Prime L${v.required_rank_level}` : "Digital Education Prime");
          const actionLabel = isPurchased ? (canWatch ? "Watch Video" : "Purchased") : "Buy";

          return (
            <Paper
              key={v.id || v.required_rank}
              elevation={0}
              onClick={() => {
                if (canWatch) setActiveVideo({ title: v.title || rankLabel, ytEmbedId, videoUrl });
                else if (!isPurchased) onBuyPrime?.(v);
              }}
              sx={{
                flex: "0 0 184px",
                scrollSnapAlign: "start",
                p: 1,
                borderRadius: 3,
                border: `1px solid ${C.border}`,
                cursor: "pointer",
                bgcolor: C.surface,
                boxShadow: "0 8px 22px rgba(15, 23, 42, 0.06)",
                transition: "transform 160ms ease, box-shadow 160ms ease",
                "&:active": { transform: "scale(0.985)" },
              }}
            >
              <Box
                sx={{
                  height: 86,
                  borderRadius: 1.5,
                  overflow: "hidden",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "rgba(37,99,235,0.1)",
                  color: C.primary,
                  position: "relative",
                }}
              >
                {thumb ? (
                  <Box component="img" src={thumb} alt={v.title || "Video"} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <PlayCircleRoundedIcon sx={{ fontSize: 38 }} />
                )}
                {canWatch && (
                  <Box sx={{ position: "absolute", inset: 0, bgcolor: "rgba(0,0,0,0.25)", display: "grid", placeItems: "center" }}>
                    <PlayCircleRoundedIcon sx={{ fontSize: 36, color: "#ffffff", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))" }} />
                  </Box>
                )}
              </Box>
              <Typography sx={{ mt: 0.9, fontSize: 13, fontWeight: 1000 }} noWrap>
                {v.title || rankLabel}
              </Typography>
              <Typography sx={{ mt: 0.2, fontSize: 11.5, color: C.textSec, fontWeight: 700 }} noWrap>
                {canWatch ? "Ready to watch" : isPurchased ? "Video pending" : rankLabel}
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ mt: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  fullWidth
                  disabled={!canWatch && isPurchased}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canWatch) setActiveVideo({ title: v.title || rankLabel, ytEmbedId, videoUrl });
                    else if (!isPurchased) onBuyPrime?.(v);
                  }}
                  sx={{ fontSize: 11, fontWeight: 900, textTransform: "none" }}
                >
                  {actionLabel}
                </Button>
              </Stack>
            </Paper>
          );
        })}
      </HorizontalScroller>

      {/* YouTube / Video Popup Player Modal */}
      <Dialog
        open={Boolean(activeVideo)}
        onClose={() => setActiveVideo(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: "#0f172a",
            color: "#ffffff",
            overflow: "hidden",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 1.5, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <Typography sx={{ fontWeight: 900, fontSize: 16, color: "#ffffff" }} noWrap>
            {activeVideo?.title || "Educational Video"}
          </Typography>
          <IconButton 
            aria-label="close video" 
            onClick={() => setActiveVideo(null)} 
            sx={{ color: "#ffffff", bgcolor: "rgba(255,255,255,0.1)", "&:hover": { bgcolor: "rgba(255,255,255,0.2)" } }}
          >
            ✕
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: "#000000", overflow: "hidden" }}>
          <Box sx={{ position: "relative", width: "100%", pt: "56.25%" /* 16:9 Aspect Ratio */ }}>
            {activeVideo?.ytEmbedId ? (
              <iframe
                src={`https://www.youtube.com/embed/${activeVideo.ytEmbedId}?autoplay=1&rel=0&modestbranding=1`}
                title={activeVideo?.title || "Educational Video"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: 0,
                }}
              />
            ) : activeVideo?.videoUrl ? (
              <video
                src={activeVideo.videoUrl}
                controls
                autoPlay
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: 0,
                }}
              />
            ) : null}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

function TourScroller({ onTour, onShop, onCoupons }) {
  const items = [
    { name: "Goa", image: imgHolidays, onClick: onTour },
    { name: "Kerala", image: imgKerala, onClick: onTour },
    { name: "Thailand", image: imgThailand, onClick: onTour },
    { name: "Malaysia", image: imgHolidays, onClick: onTour },
    { name: "E-Commerce", image: imgEcommerce, onClick: onShop },
    { name: "Coupons", image: imgGifts, onClick: onCoupons },
  ];

  return (
    <Box>
      <SectionTitle title="E-Commerce and TRI Tour" />
      <HorizontalScroller>
        {items.map((d) => (
          <Paper
            key={d.name}
            elevation={0}
            onClick={d.onClick}
            sx={{
              flex: "0 0 136px",
              scrollSnapAlign: "start",
              borderRadius: 3,
              overflow: "hidden",
              border: `1px solid ${C.border}`,
              bgcolor: C.surface,
              cursor: "pointer",
              boxShadow: "0 8px 22px rgba(15, 23, 42, 0.06)",
              transition: "transform 160ms ease, box-shadow 160ms ease",
              "&:active": { transform: "scale(0.985)" },
            }}
          >
            <Box component="img" src={d.image} alt={d.name} sx={{ width: "100%", height: 94, objectFit: "cover", display: "block" }} />
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1, py: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 1000 }} noWrap>
                {d.name}
              </Typography>
              {d.name === "E-Commerce" ? <StorefrontRoundedIcon sx={{ fontSize: 17, color: C.primary }} /> : <FlightTakeoffRoundedIcon sx={{ fontSize: 17, color: C.primary }} />}
            </Stack>
          </Paper>
        ))}
      </HorizontalScroller>
    </Box>
  );
}

function IdCardDialog({ open, onClose, user, initials }) {
  const MEDIA_BASE = String(API?.defaults?.baseURL || "").replace(/\/api\/?$/, "");
  const avatar = resolveApiMediaUrl({ image_url: user?.avatar_url || user?.avatar || "" }, MEDIA_BASE);
  const role = user?.role || user?.category || "Team Consumer";
  const userId = user?.prefixed_id || user?.unique_id || user?.username || user?.id || "-";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 900 }}>Team ID Card</DialogTitle>
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
            <Typography sx={{ fontSize: 16, fontWeight: 1000 }}>TRIKONEKT</Typography>
            <Typography sx={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>TEAM CONSUMER ID CARD</Typography>
          </Box>
          <Box sx={{ p: 2, textAlign: "center" }}>
            <Avatar src={avatar || undefined} sx={{ width: 86, height: 86, mx: "auto", bgcolor: C.primaryDark, fontSize: 26, fontWeight: 1000 }}>
              {initials}
            </Avatar>
            <Typography sx={{ mt: 1.25, fontSize: 18, fontWeight: 1000 }}>{user?.full_name || user?.name || "Team User"}</Typography>
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
    { key: "team", label: "Team", icon: <GroupsRoundedIcon />, value: 1 },
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
  const fullName = storedUser?.full_name || storedUser?.name || "Team User";
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

    const fetchVideos = async () => {
      setVideosLoading(true);
      try {
        const [videoRes, rankRes, eligRes] = await Promise.allSettled([
          API.get("/business/team-consumer/educational-videos/", { cacheTTL: 2500, retryAttempts: 1 }),
          API.get("/ranks/", { cacheTTL: 10000, retryAttempts: 1 }),
          API.get("/user/upgrade-eligibility/", { params: { summary: "achieved" }, cacheTTL: 2500, retryAttempts: 1, timeout: 15000 }),
        ]);
        if (!alive) return;
        if (videoRes.status === "fulfilled") {
          setVideos(Array.isArray(videoRes.value?.data?.results) ? videoRes.value.data.results : []);
        } else {
          setVideos([]);
        }
        if (rankRes.status === "fulfilled") {
          const ranks = Array.isArray(rankRes.value?.data) ? rankRes.value.data : [];
          setPrimeRanks(ranks.slice(0, 10));
        } else {
          setPrimeRanks([]);
        }
        if (eligRes.status === "fulfilled") {
          const eligData = eligRes.value?.data || {};
          setAchievedPrimeLevel(Number(eligData?.achieved_level || 0));
          setTeamStats({
            direct_count: Number(eligData?.direct_count || 0),
            current_team_size: Number(eligData?.current_team_size || 0),
            current_rank: eligData?.current_rank || (eligData?.achieved_level ? `Prime ${eligData.achieved_level}` : "Prime 1"),
          });
        } else {
          setAchievedPrimeLevel(0);
          setTeamStats({ direct_count: 0, current_team_size: 0, current_rank: "Prime 1" });
        }
      } catch {
        if (alive) {
          setVideos([]);
          setPrimeRanks([]);
          setAchievedPrimeLevel(0);
        }
      } finally {
        if (alive) setVideosLoading(false);
      }
    };

    const fetchProfile = async () => {
      try {
        const res = await API.get("/accounts/profile/", { cacheTTL: 2500, retryAttempts: 1 });
        if (alive && res?.data) setProfileUser({ ...storedUser, ...res.data });
      } catch {
        if (alive) setProfileUser(storedUser);
      }
    };

    fetchBanners();
    fetchAchievers();
    fetchVideos();
    fetchProfile();
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

  const [walletData, setWalletData] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const w = await getWalletMe();
        if (alive && w) setWalletData(w);
      } catch (_) {}
    })();
    return () => { alive = false; };
  }, []);

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: C.appBg, pb: 4 }}>
      <Box className="consumer-fintech-page" sx={{ width: "100%", maxWidth: 1180, mx: "auto", px: { xs: 1, sm: 2 }, py: { xs: 1, sm: 2 } }}>
        <Stack spacing={2}>
          {/* 1) MAIN WALLET HERO CARD */}
          <BalanceCard
            title="Main Wallet Balance"
            amount={walletData?.main_wallet ?? walletData?.main_balance ?? 0}
            subtitle="View wallet details"
            onClick={() => navigate("/user/team-wallet")}
          />

          {docErr ? (
            <Paper elevation={0} sx={{ p: 1.25, borderRadius: 2, border: "1px solid #fecaca", bgcolor: "#fef2f2" }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#b91c1c" }}>{docErr}</Typography>
            </Paper>
          ) : null}

          {/* 2) 4 QUICK ACTION BUTTONS */}
          <QuickActionGrid variant="dashboard" />

          {/* 3) EXPLORE OPPORTUNITIES BANNER (Screen 1 Target) */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderRadius: "16px",
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #075985 100%)",
              color: "#ffffff",
              boxShadow: "0 8px 24px rgba(2, 132, 199, 0.25)",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 1,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: { xs: 17, sm: 19 }, fontWeight: 700, color: "#ffffff", lineHeight: 1.2 }}>
                Explore Opportunities
              </Typography>
              <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.9)", mt: 0.25 }}>
                Shop • Learn • Travel • Earn
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate("/trikonekt-products")}
              sx={{
                bgcolor: "#ffffff",
                color: "#0369a1",
                fontWeight: 700,
                fontSize: 12.5,
                borderRadius: "999px",
                px: 2,
                mt: 0.5,
                "&:hover": { bgcolor: "#f0f9ff" },
              }}
            >
              Explore Now →
            </Button>
          </Paper>

          {/* 4) DAILY WISHING BANNER, TOP ACHIEVERS, VIDEOS & TOUR */}
          <DynamicHeroWishingBanner
            banners={banners}
            loading={bannersLoading}
            error={bannersErr}
            user={profileUser}
            directTeamCount={teamStats.direct_count || profileUser?.direct_count || profileUser?.total_directs || 0}
            totalTeamCount={teamStats.current_team_size || 0}
            currentRank={teamStats.current_rank || (achievedPrimeLevel ? `Prime ${achievedPrimeLevel}` : "Prime 1")}
          />
          <TopAchieversRow items={achievers} loading={achieversLoading} error={achieversErr} />
          <VideoScroller
            videos={educationVideoSlots}
            loading={videosLoading}
            onOpenFallback={() => navigate("/user/packages/digital-education-prime")}
            onBuyPrime={(video) => {
              if (video?.is_purchased || video?.can_access) return;
              const params = new URLSearchParams();
              if (video?.required_rank) params.set("rank_id", String(video.required_rank));
              if (video?.id) params.set("video_id", String(video.id));
              navigate(`/user/packages/digital-education-prime${params.toString() ? `?${params.toString()}` : ""}`);
            }}
          />
          <TourScroller
            onTour={() => navigate("/user/tri/tri-holidays")}
            onShop={() => navigate("/trikonekt-products")}
            onCoupons={() => navigate("/user/coupon-pocket")}
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
    </Box>
  );
}
