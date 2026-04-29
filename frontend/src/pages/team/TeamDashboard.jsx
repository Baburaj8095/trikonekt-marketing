
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Avatar,
  Box,
  Button,
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
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../../api/api";

// Light, premium, unified look (aligned with Genealogy5 design tokens)
const C = {
  appBg: "#f0f4ff",
  surface: "#ffffff",
  primary: "#4f46e5",
  primarySoft: "rgba(79,70,229,0.12)",
  text: "#111827",
  textSec: "#6b7280",
  border: "#e5e7eb",
  shadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
  radius: 3,
};

const MotionPaper = motion.create(Paper);

function WishingBannerCarousel({ items = [], loading = false, error = "" }) {
  const banners = Array.isArray(items) ? items : [];
  const [idx, setIdx] = useState(0);

  // auto-advance
  useEffect(() => {
    if (!banners.length) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % banners.length);
    }, 3500);
    return () => window.clearInterval(t);
  }, [banners.length]);

  useEffect(() => {
    // reset index when list changes
    if (!banners.length) setIdx(0);
    else if (idx >= banners.length) setIdx(0);
  }, [banners.length, idx]);

  const active = banners[idx] || null;

  return (
    <MotionPaper
      elevation={0}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      sx={{
        mt: 2.25,
        borderRadius: 4,
        border: `1px solid ${C.border}`,
        background: C.surface,
        boxShadow: "0 8px 18px rgba(2, 6, 23, 0.05)",
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 1000, color: C.text }}>
          Wishing Banner
        </Typography>
      </Box>

      {error ? (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#dc2626" }}>{error}</Typography>
        </Box>
      ) : null}

      {loading ? (
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography sx={{ fontSize: 12, color: C.textSec, fontWeight: 700 }}>Loading banners…</Typography>
        </Box>
      ) : null}

      {active?.image_url ? (
        <Box
          key={active.id || idx}
          component="img"
          src={active.image_url}
          alt={active.title || "banner"}
          sx={{
            width: "100%",
            height: 170,
            objectFit: "cover",
            display: "block",
            borderTop: `1px solid ${C.border}`,
          }}
        />
      ) : (
        !loading && !error ? (
          <Box sx={{ px: 2, pb: 2 }}>
            <Typography sx={{ fontSize: 12, color: C.textSec, fontWeight: 700 }}>No banners available.</Typography>
          </Box>
        ) : null
      )}

      {banners.length > 1 ? (
        <Stack direction="row" spacing={0.75} justifyContent="center" sx={{ py: 1.25, bgcolor: "rgba(255,255,255,0.7)" }}>
          {banners.map((_, i) => (
            <Box
              key={i}
              onClick={() => setIdx(i)}
              role="button"
              tabIndex={0}
              sx={{
                width: i === idx ? 18 : 7,
                height: 7,
                borderRadius: 99,
                bgcolor: i === idx ? C.primary : "rgba(148,163,184,0.9)",
                transition: "all 160ms ease",
                cursor: "pointer",
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
    <Box sx={{ mt: 2.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 1000, color: C.text }}>
          Top Achievers
        </Typography>
      </Stack>

      {error ? (
        <Paper elevation={0} sx={{ p: 1.25, borderRadius: 3, border: `1px solid ${C.border}` }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#dc2626" }}>{error}</Typography>
        </Paper>
      ) : null}

      {loading ? (
        <Typography sx={{ fontSize: 12, color: C.textSec, fontWeight: 700, mb: 1 }}>Loading achievers…</Typography>
      ) : null}

      <Stack
        direction="row"
        spacing={1.25}
        sx={{ overflowX: "auto", pb: 0.5, "&::-webkit-scrollbar": { display: "none" } }}
      >
        {(rows || []).map((a) => {
          const name = a?.name || "—";
          const initials = String(name).trim().slice(0, 2).toUpperCase();
          return (
            <Paper
              key={a?.id || name}
              elevation={0}
              sx={{
                flexShrink: 0,
                width: 180,
                border: `1px solid ${C.border}`,
                borderRadius: 3,
                p: 1.25,
                background: C.surface,
                boxShadow: "0 8px 18px rgba(2, 6, 23, 0.05)",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Avatar
                  src={a?.photo_url || undefined}
                  sx={{ width: 46, height: 46, bgcolor: C.primary, fontWeight: 900 }}
                  imgProps={{ referrerPolicy: "no-referrer" }}
                >
                  {initials}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 1000, color: C.text }} noWrap>
                    {name}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: C.textSec }} noWrap>
                    {a?.achieved || "—"}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          );
        })}

        {!loading && !error && !rows.length ? (
          <Paper
            elevation={0}
            sx={{
              flexShrink: 0,
              width: 220,
              border: `1px dashed ${C.border}`,
              borderRadius: 3,
              p: 1.25,
              background: "rgba(255,255,255,0.7)",
            }}
          >
            <Typography sx={{ fontSize: 12, color: C.textSec, fontWeight: 800 }}>No achievers added yet.</Typography>
          </Paper>
        ) : null}
      </Stack>
    </Box>
  );
}

function MobileBottomNav({ value, onChange }) {
  const items = [
    { key: "home", label: "Home", icon: <HomeRoundedIcon />, value: 0 },
    { key: "team", label: "Team", icon: <GroupsRoundedIcon />, value: 1 },
    { key: "wallet", label: "Wallet", icon: <AccountBalanceWalletRoundedIcon />, value: 2 },
    { key: "history", label: "History", icon: <HistoryRoundedIcon />, value: 3 },
    { key: "profile", label: "Profile", icon: <PersonRoundedIcon />, value: 4 },
  ];

  return (
    <Paper
      elevation={10}
      sx={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 520,
        borderTop: `1px solid ${C.border}`,
        zIndex: 2000,
        borderRadius: "18px 18px 0 0",
        overflow: "hidden",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-around", py: 1, bgcolor: C.surface }}>
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
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.25,
                color: active ? C.primary : "#94a3b8",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <Box
                sx={{
                  width: 42,
                  height: 30,
                  borderRadius: 99,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: active ? C.primarySoft : "transparent",
                  transition: "background 0.18s ease",
                }}
              >
                {React.cloneElement(it.icon, { fontSize: "small" })}
              </Box>
              <Typography sx={{ fontSize: 11, fontWeight: active ? 900 : 700, lineHeight: 1 }}>
                {it.label}
              </Typography>
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

  const username = storedUser?.username || "";
  const fullName = storedUser?.full_name || "Team User";
  const initials = useMemo(() => {
    const n = String(fullName || username || "T").trim();
    const parts = n.split(" ").filter(Boolean);
    const a = parts[0]?.[0] || "T";
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
    return (a + b).toUpperCase();
  }, [fullName, username]);

  // Team/Consumer dashboard content (admin-managed)
  const [banners, setBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [bannersErr, setBannersErr] = useState("");

  const [achievers, setAchievers] = useState([]);
  const [achieversLoading, setAchieversLoading] = useState(false);
  const [achieversErr, setAchieversErr] = useState("");

  useEffect(() => {
    let alive = true;

    const fetchBanners = async () => {
      setBannersLoading(true);
      setBannersErr("");
      try {
        const res = await API.get("/business/team-consumer/wishing-banners/", { cacheTTL: 2500, retryAttempts: 1 });
        if (!alive) return;
        const items = Array.isArray(res?.data?.results) ? res.data.results : [];
        setBanners(items);
      } catch (_) {
        if (!alive) return;
        setBannersErr("Unable to load wishing banners.");
        setBanners([]);
      } finally {
        if (alive) setBannersLoading(false);
      }
    };

    const fetchAchievers = async () => {
      setAchieversLoading(true);
      setAchieversErr("");
      try {
        const res = await API.get("/business/team-consumer/top-achievers/", { cacheTTL: 2500, retryAttempts: 1 });
        if (!alive) return;
        const items = Array.isArray(res?.data?.results) ? res.data.results : [];
        setAchievers(items);
      } catch (_) {
        if (!alive) return;
        setAchieversErr("Unable to load top achievers.");
        setAchievers([]);
      } finally {
        if (alive) setAchieversLoading(false);
      }
    };

    fetchBanners();
    fetchAchievers();

    return () => {
      alive = false;
    };
  }, []);

  // Bottom nav selection based on path
  const navIndex = useMemo(() => {
    const p = location.pathname || "";
    if (p.includes("/genealogy")) return 1;
    if (p.includes("/wallet")) return 2;
    if (p.includes("/history")) return 3;
    if (p.includes("/profile")) return 4;
    return 0;
  }, [location.pathname]);

  const handleNav = (idx) => {
    if (idx === 0) navigate("/user/team-dashboard");
    if (idx === 1) navigate("/user/genealogy-5");
    if (idx === 2) navigate("/user/team-wallet");
    if (idx === 3) navigate("/user/history");
    if (idx === 4) navigate("/user/profile");
  };

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: C.appBg }}>
      <Box sx={{ maxWidth: 520, mx: "auto", px: 2, pt: 2, pb: isMobile ? 10 : 4 }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Avatar sx={{ width: 44, height: 44, bgcolor: C.primary, fontWeight: 900 }}>
              {initials}
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: C.textSec, lineHeight: 1 }}>
                Welcome
              </Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 900, color: C.text, letterSpacing: "-0.4px" }}>
                {fullName}
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: C.primary }}>
                ID: {username || "—"}
              </Typography>
            </Box>
          </Stack>
          <IconButton aria-label="notifications" sx={{ bgcolor: C.surface, border: `1px solid ${C.border}` }}>
            <NotificationsNoneRoundedIcon />
          </IconButton>
        </Stack>

        {/* Hero banner */}
        <MotionPaper
          elevation={0}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          sx={{
            p: 2,
            borderRadius: 4,
            color: "#0f172a",
            border: `1px solid ${C.border}`,
            background: "linear-gradient(135deg, rgba(79,70,229,0.16) 0%, rgba(59,130,246,0.10) 48%, rgba(255,255,255,1) 100%)",
            boxShadow: C.shadow,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              right: -30,
              top: -30,
              width: 140,
              height: 140,
              borderRadius: 999,
              background: "radial-gradient(circle at 30% 30%, rgba(79,70,229,0.22), transparent 70%)",
            }}
          />
          <Typography sx={{ fontSize: 18, fontWeight: 1000, color: C.text, letterSpacing: "-0.4px" }}>
            Grow your business with Trikonekt
          </Typography>
          <Typography sx={{ fontSize: 13, color: C.textSec, fontWeight: 700, mt: 0.75, maxWidth: 420 }}>
            Track earnings, manage wallet actions, and explore your team — all in one place.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap" }}>
            <Button
              variant="contained"
              onClick={() => navigate("/user/upload-wallet")}
              sx={{
                textTransform: "none",
                fontWeight: 900,
                borderRadius: 99,
                px: 2,
                background: C.primary,
                boxShadow: "0 10px 18px rgba(79,70,229,0.22)",
                "&:hover": { background: "#4338ca" },
              }}
            >
              Upload Wallet
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate("/user/wallet")}
              sx={{
                textTransform: "none",
                fontWeight: 900,
                borderRadius: 99,
                px: 2,
                borderColor: "rgba(79,70,229,0.35)",
                color: C.primary,
                bgcolor: "rgba(255,255,255,0.65)",
                "&:hover": { borderColor: C.primary, bgcolor: "rgba(79,70,229,0.06)" },
              }}
            >
              Withdraw
            </Button>
            <Button
              variant="text"
              onClick={() => navigate("/user/genealogy-5")}
              sx={{ textTransform: "none", fontWeight: 900, borderRadius: 99, color: C.text }}
            >
              Team View
            </Button>
            <Button
              variant="text"
              onClick={() => navigate("/user/history")}
              sx={{ textTransform: "none", fontWeight: 900, borderRadius: 99, color: C.text }}
            >
              History
            </Button>
          </Stack>
        </MotionPaper>

        {/* Wishing banner carousel (replaces wallet statistics) */}
        <WishingBannerCarousel items={banners} loading={bannersLoading} error={bannersErr} />

        {/* Top achievers (admin managed) */}
        <TopAchieversRow items={achievers} loading={achieversLoading} error={achieversErr} />
      </Box>

      {/* Mobile-only bottom navigation */}
      {isMobile ? <MobileBottomNav value={navIndex} onChange={handleNav} /> : null}
    </Box>
  );
}
