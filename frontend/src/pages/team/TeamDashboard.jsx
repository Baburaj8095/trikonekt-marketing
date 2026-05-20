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
import API from "../../api/api";
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
      <Typography sx={{ fontSize: 15.5, fontWeight: 900, color: C.text }}>{title}</Typography>
      {action ? (
        <Button
          size="small"
          endIcon={<ArrowForwardIosRoundedIcon sx={{ fontSize: 13 }} />}
          onClick={onAction}
          sx={{ textTransform: "none", fontWeight: 900, color: C.primary }}
        >
          {action}
        </Button>
      ) : null}
    </Stack>
  );
}

function WishingBannerCarousel({ items = [], loading = false, error = "" }) {
  const banners = Array.isArray(items) ? items : [];
  const [idx, setIdx] = useState(0);
  const MEDIA_BASE = useMemo(() => String(API?.defaults?.baseURL || "").replace(/\/api\/?$/, ""), []);

  useEffect(() => {
    if (!banners.length) return undefined;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % banners.length), 3500);
    return () => window.clearInterval(t);
  }, [banners.length]);

  useEffect(() => {
    if (!banners.length) setIdx(0);
    else if (idx >= banners.length) setIdx(0);
  }, [banners.length, idx]);

  const active = banners[idx] || null;
  const activeSrc = useMemo(() => resolveApiMediaUrl(active, MEDIA_BASE), [active, MEDIA_BASE]);

  return (
    <MotionPaper
      elevation={0}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      sx={{
        borderRadius: 3,
        border: `1px solid ${C.border}`,
        background: C.surface,
        boxShadow: C.shadow,
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: 1.35, pb: 0.75 }}>
        <SectionTitle title="Daily Wishing Banner" />
      </Box>

      {error ? (
        <Typography sx={{ px: 2, pb: 2, fontSize: 13, fontWeight: 800, color: "#dc2626" }}>{error}</Typography>
      ) : null}

      {loading ? (
        <Typography sx={{ px: 2, pb: 2, fontSize: 12, color: C.textSec, fontWeight: 700 }}>Loading banners...</Typography>
      ) : null}

      {activeSrc ? (
        <Box
          key={active.id || idx}
          component="img"
          src={activeSrc}
          alt={active.title || "Wishing banner"}
          sx={{ width: "100%", height: { xs: 230, sm: 250, md: 280 }, objectFit: "cover", objectPosition: "center", display: "block" }}
        />
      ) : !loading && !error ? (
        <Box
          sx={{
            minHeight: { xs: 220, sm: 240, md: 270 },
            display: "grid",
            placeItems: "center",
            px: 2,
            background: "linear-gradient(135deg, #dbeafe 0%, #ffffff 55%, #dcfce7 100%)",
          }}
        >
          <Typography sx={{ fontSize: { xs: 20, md: 28 }, fontWeight: 1000, color: C.primaryDark, textAlign: "center" }}>
            Welcome to Team Consumer
          </Typography>
        </Box>
      ) : null}

      {banners.length > 1 ? (
        <Stack direction="row" spacing={0.75} justifyContent="center" sx={{ py: 1 }}>
          {banners.map((_, i) => (
            <Box
              key={i}
              onClick={() => setIdx(i)}
              role="button"
              tabIndex={0}
              sx={{
                width: i === idx ? 20 : 7,
                height: 7,
                borderRadius: 99,
                bgcolor: i === idx ? C.primary : "#cbd5e1",
                cursor: "pointer",
                transition: "all 160ms ease",
              }}
            />
          ))}
        </Stack>
      ) : null}
    </MotionPaper>
  );
}

function TopAchieversRow({ items = [], loading = false, error = "" }) {
  const rows = Array.isArray(items) ? items : [];
  return (
    <Box>
      <SectionTitle title="Top Achievers" />

      {error ? (
        <Paper elevation={0} sx={{ p: 1.25, borderRadius: 2, border: `1px solid ${C.border}` }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#dc2626" }}>{error}</Typography>
        </Paper>
      ) : null}

      {loading ? (
        <Typography sx={{ fontSize: 12, color: C.textSec, fontWeight: 700, mb: 1 }}>Loading achievers...</Typography>
      ) : null}

      <Stack direction="row" spacing={1.25} sx={{ overflowX: "auto", pb: 0.5, "&::-webkit-scrollbar": { display: "none" } }}>
        {rows.map((a) => {
          const name = a?.name || "Team Member";
          const initials = String(name).trim().slice(0, 2).toUpperCase();
          return (
            <Paper
              key={a?.id || name}
              elevation={0}
              sx={{
                flexShrink: 0,
                width: { xs: 172, sm: 210 },
                border: `1px solid ${C.border}`,
                borderRadius: 2.5,
                p: 1.25,
                background: C.surface,
                boxShadow: "0 10px 26px rgba(2, 6, 23, 0.07)",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Avatar src={a?.photo_url || undefined} sx={{ width: 46, height: 46, bgcolor: C.primary, fontWeight: 900 }}>
                  {initials}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 1000, color: C.text }} noWrap>
                    {name}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: C.textSec }} noWrap>
                    {a?.achieved || "Achiever"}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          );
        })}

        {!loading && !error && !rows.length ? (
          <Paper elevation={0} sx={{ flexShrink: 0, width: 220, border: `1px dashed ${C.border}`, borderRadius: 2, p: 1.25 }}>
            <Typography sx={{ fontSize: 12, color: C.textSec, fontWeight: 800 }}>No achievers added yet.</Typography>
          </Paper>
        ) : null}
      </Stack>
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

  const rows = Array.isArray(videos) ? videos : [];

  const downloadFile = (url, title) => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${String(title || "educational-video").replace(/[^\w.-]+/g, "-")}.mp4`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
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
          const thumb = resolveRaw(v.thumbnail_url || v.thumbnail);
          const isPurchased = !!v.is_purchased || !!v.can_access;
          const canWatch = isPurchased && !!videoUrl;
          const rankLabel = v.required_rank_name || (v.required_rank_level ? `Prime L${v.required_rank_level}` : "Digital Education Prime");
          const actionLabel = isPurchased ? (videoUrl ? "View" : "Purchased") : "Buy";
          return (
            <Paper
              key={v.id}
              elevation={0}
              onClick={() => {
                if (canWatch) window.open(videoUrl, "_blank", "noopener,noreferrer");
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
                }}
              >
                {thumb ? (
                  <Box component="img" src={thumb} alt={v.title || "Video"} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <PlayCircleRoundedIcon sx={{ fontSize: 38 }} />
                )}
              </Box>
              <Typography sx={{ mt: 0.9, fontSize: 13, fontWeight: 1000 }} noWrap>
                {v.title || "Educational Video"}
              </Typography>
              <Typography sx={{ mt: 0.2, fontSize: 11.5, color: C.textSec, fontWeight: 700 }} noWrap>
                {canWatch ? "Ready to watch" : isPurchased ? "Video upload pending" : rankLabel}
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ mt: 1 }}>
                {canWatch ? (
                  <>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(videoUrl, "_blank", "noopener,noreferrer");
                      }}
                      sx={{ minWidth: 0, flex: 1, fontSize: 11, fontWeight: 900, textTransform: "none" }}
                    >
                      View
                    </Button>
                    <IconButton
                      size="small"
                      aria-label="download video"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(videoUrl, v.title);
                      }}
                      sx={{ border: `1px solid ${C.border}`, borderRadius: 1 }}
                    >
                      <FileDownloadRoundedIcon fontSize="small" />
                    </IconButton>
                  </>
                ) : (
                  <Button
                    size="small"
                    variant="contained"
                    fullWidth
                    disabled={isPurchased}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isPurchased) onBuyPrime?.(v);
                    }}
                    sx={{ fontSize: 11, fontWeight: 900, textTransform: "none" }}
                  >
                    {actionLabel}
                  </Button>
                )}
              </Stack>
            </Paper>
          );
        })}
      </HorizontalScroller>
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
          setAchievedPrimeLevel(Number(eligRes.value?.data?.achieved_level || 0));
        } else {
          setAchievedPrimeLevel(0);
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

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: C.appBg, pb: isMobile ? "calc(84px + env(safe-area-inset-bottom))" : 3 }}>
      <Box className="consumer-fintech-page" sx={{ width: "100%", maxWidth: 1180, mx: "auto", px: { xs: 0, sm: 1, md: 2 }, py: { xs: 0.5, md: 1.5 } }}>
        <Paper
          elevation={0}
          sx={{
            mb: { xs: 1.5, md: 2 },
            p: { xs: 1.25, md: 2 },
            borderRadius: 3,
            border: `1px solid ${C.border}`,
            background: C.surface,
            boxShadow: C.shadow,
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
            <Stack direction="row" alignItems="center" spacing={1.1} sx={{ minWidth: 0 }}>
              <Avatar sx={{ width: { xs: 46, md: 52 }, height: { xs: 46, md: 52 }, bgcolor: C.primary, fontWeight: 900, boxShadow: "0 8px 18px rgba(37,99,235,0.20)" }}>{initials}</Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 11.5, fontWeight: 750, color: C.textSec, lineHeight: 1 }}>Team Consumer</Typography>
                <Typography sx={{ fontSize: { xs: 17, md: 22 }, fontWeight: 900, color: C.text }} noWrap>
                  {profileUser?.full_name || fullName}
                </Typography>
                <Stack direction="row" spacing={0.65} alignItems="center" sx={{ mt: 0.45, flexWrap: "wrap" }}>
                  <Chip size="small" label={`ID: ${profileUser?.prefixed_id || profileUser?.unique_id || username || "-"}`} sx={{ height: 22, fontSize: 10.5, fontWeight: 750, bgcolor: "rgba(37,99,235,0.08)", color: C.primary }} />
                  <Chip size="small" label={`Status: ${status}`} sx={{ height: 22, fontSize: 10.5, fontWeight: 750, bgcolor: "rgba(22,163,74,0.10)", color: "#047857" }} />
                </Stack>
              </Box>
            </Stack>
            <IconButton aria-label="notifications" sx={{ width: 38, height: 38, bgcolor: "#f8fafc", border: `1px solid ${C.border}` }}>
              <NotificationsNoneRoundedIcon />
            </IconButton>
          </Stack>
        </Paper>

        {docErr ? (
          <Paper elevation={0} sx={{ mb: 2, p: 1.25, borderRadius: 2, border: "1px solid #fecaca", bgcolor: "#fef2f2" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#b91c1c" }}>{docErr}</Typography>
          </Paper>
        ) : null}

        <Stack spacing={2.5}>
          <WishingBannerCarousel items={banners} loading={bannersLoading} error={bannersErr} />
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
      {isMobile ? <MobileBottomNav value={navIndex} onChange={handleNav} /> : null}
    </Box>
  );
}
