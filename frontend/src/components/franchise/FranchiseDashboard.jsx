import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../../api/api";

import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Paper,
  Skeleton,
  Stack,
  Typography,
  IconButton,
} from "@mui/material";

import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import StoreOutlinedIcon from "@mui/icons-material/StoreOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import WorkOutlineOutlinedIcon from "@mui/icons-material/WorkOutlineOutlined";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import CurrencyRupeeRoundedIcon from "@mui/icons-material/AccountBalanceWallet";
import PublicRoundedIcon from "@mui/icons-material/MyLocation";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import BusinessCenterRoundedIcon from "@mui/icons-material/BusinessCenterRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";

const COLORS = {
  primary: "#0ea5e9",
  primaryDark: "#0284c7",
  success: "#22c55e",
  secondary: "#a855f7",
  background: "#f6f8fb",
  surface: "#ffffff",
  text: "#0f172a",
  textSecondary: "#64748b",
  border: "#e5e7eb",
  shadow: "0 16px 42px rgba(15, 23, 42, 0.08), 0 1px 0 rgba(15, 23, 42, 0.03)",
};

const sectionCardSx = {
  borderRadius: { xs: 2, sm: 4 },
  boxShadow: {
    xs: "0 10px 24px rgba(15, 23, 42, 0.07), 0 1px 0 rgba(15, 23, 42, 0.04)",
    md: COLORS.shadow,
  },
  border: `1px solid ${COLORS.border}`,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  overflow: "hidden",
};

const scrollRowSx = {
  display: "flex",
  gap: { xs: 1.25, sm: 2, md: 2.5 },
  overflowX: "auto",
  overflowY: "hidden",
  pb: { xs: 0.75, md: 1 },
  px: { xs: 0.25, md: 0 },
  scrollSnapType: "x mandatory",
  WebkitOverflowScrolling: "touch",
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" },
};

function SectionTitle({ title }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, mb: { xs: 1.75, md: 2.5 } }}>
      <Typography
        variant="h5"
        sx={{
          fontWeight: 900,
          color: COLORS.text,
          fontSize: { xs: "1rem", sm: "1.15rem", md: "1.5rem" },
          lineHeight: 1.18,
        }}
      >
        {title}
      </Typography>
      <Box sx={{ width: 36, height: 4, borderRadius: 999, bgcolor: "rgba(14,165,233,0.22)", flexShrink: 0 }} />
    </Box>
  );
}

function MobileBottomNav({ activePath, onNavigate }) {
  const items = [
    { label: "Home", icon: <HomeRoundedIcon />, path: "/agency/franchise-dashboard" },
    { label: "Business Connect", icon: <BusinessCenterRoundedIcon />, path: "/agency/franchise-dashboard" },
    { label: "Wallet", icon: <CurrencyRupeeRoundedIcon />, path: "/agency/franchise-wallet" },
    { label: "History", icon: <HistoryRoundedIcon />, path: "/agency/transactions" },
    { label: "Report", icon: <AssessmentRoundedIcon />, path: "/agency/daily-report" },
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1200,
        display: { xs: "block", md: "none" },
        px: 1,
        pt: 0.75,
        pb: "calc(0.75rem + env(safe-area-inset-bottom))",
        bgcolor: "rgba(255,255,255,0.94)",
        borderTop: "1px solid rgba(226,232,240,0.9)",
        boxShadow: "0 -12px 32px rgba(15,23,42,0.12)",
        backdropFilter: "blur(16px)",
      }}
    >
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0.35 }}>
        {items.map((item) => {
          const active = activePath === item.path || (item.label === "Home" && activePath === "/franchise/dashboard");
          return (
            <Box
              key={item.label}
              component="button"
              type="button"
              onClick={() => onNavigate(item.path)}
              aria-current={active ? "page" : undefined}
              sx={{
                minWidth: 0,
                border: 0,
                borderRadius: 2,
                px: 0.25,
                py: 0.55,
                bgcolor: active ? "rgba(14,165,233,0.12)" : "transparent",
                color: active ? COLORS.primaryDark : COLORS.textSecondary,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.25,
                cursor: "pointer",
                transition: "background-color 160ms ease, color 160ms ease, transform 160ms ease",
                "&:active": { transform: "scale(0.96)" },
                "& svg": { fontSize: 20 },
              }}
            >
              {item.icon}
              <Typography
                component="span"
                sx={{
                  fontSize: item.label === "Business Connect" ? 9.5 : 10.5,
                  lineHeight: 1.1,
                  fontWeight: active ? 900 : 800,
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

function AchieverCard({ name, subtitle, achieved, photoUrl }) {
  const initials = useMemo(() => {
    const t = String(name || "").trim();
    if (!t) return "A";
    return t.split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
  }, [name]);

  return (
    <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.18 }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          p: { xs: 1.5, md: 2 },
          minWidth: { xs: 156, sm: 190 },
          maxWidth: { xs: 156, sm: 190 },
          minHeight: { xs: 158, sm: 184 },
          borderRadius: { xs: 2, sm: 3 },
          bgcolor: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 10px 24px rgba(15,23,42,0.07)",
          transition: "box-shadow 180ms ease, border-color 180ms ease",
          "&:hover": { boxShadow: "0 14px 34px rgba(15,23,42,0.11)", borderColor: "rgba(14,165,233,0.22)" },
        }}
      >
        <Avatar
          src={photoUrl || undefined}
          alt={name}
          sx={{ width: { xs: 56, sm: 72 }, height: { xs: 56, sm: 72 }, mb: 1, bgcolor: COLORS.primary, fontWeight: 900 }}
        >
          {initials}
        </Avatar>

        <Typography variant="subtitle2" sx={{ fontWeight: 900, textAlign: "center", fontSize: { xs: 12.5, sm: 14 }, lineHeight: 1.2 }}>
          {name || "Achiever"}
        </Typography>
        <Typography variant="caption" sx={{ color: COLORS.textSecondary, textAlign: "center", mb: 0.75, fontWeight: 700, lineHeight: 1.2 }}>
          {subtitle || ""}
        </Typography>

        <Typography variant="body2" sx={{ fontWeight: 800, color: COLORS.success, textAlign: "center", fontSize: { xs: 12, sm: 14 }, lineHeight: 1.2 }}>
          {achieved || ""}
        </Typography>
      </Box>
    </motion.div>
  );
}

function OverviewMetricCard({ title, value, icon, accent }) {
  return (
    <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.2 }}>
      <Box
        sx={{
          height: "100%",
          minHeight: { xs: 132, sm: 150, md: 180 },
          p: { xs: 1.7, sm: 2, md: 3 },
          borderRadius: { xs: 2, sm: 3, md: 4 },
          bgcolor: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          boxShadow: { xs: "0 10px 22px rgba(15,23,42,0.07)", md: COLORS.shadow },
          transition: "box-shadow 180ms ease, border-color 180ms ease",
          "&:hover": { borderColor: "rgba(14,165,233,0.22)", boxShadow: "0 18px 48px rgba(15,23,42,0.12)" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: { xs: 1.25, md: 2 } }}>
          <Box
            sx={{
              width: { xs: 38, md: 52 },
              height: { xs: 38, md: 52 },
              borderRadius: { xs: 2, md: 3 },
              display: "grid",
              placeItems: "center",
              bgcolor: `${accent}14`,
              color: accent,
              border: `1px solid ${accent}22`,
              boxShadow: `0 10px 24px ${accent}18`,
              "& svg": { fontSize: { xs: 21, md: 26 } },
            }}
          >
            {icon}
          </Box>
        </Box>

        <Typography variant="body1" sx={{ fontWeight: 800, color: COLORS.text, mb: 0.75, fontSize: { xs: 12.5, md: 16 }, lineHeight: 1.25 }}>
          {title}
        </Typography>

        <Typography
          sx={{
            fontWeight: 900,
            color: accent,
            fontSize: { xs: "1.22rem", sm: "1.38rem", md: "1.55rem" },
            lineHeight: 1.12,
            wordBreak: "break-word",
          }}
        >
          {value}
        </Typography>
      </Box>
    </motion.div>
  );
}

function OverviewSection({ title, metrics, horizontalSwipe = false }) {
  return (
    <Card sx={sectionCardSx}>
      <CardContent sx={{ p: { xs: 2, md: 4 } }}>
        <SectionTitle title={title} />

        {horizontalSwipe ? (
          <Box sx={scrollRowSx}>
            {metrics.map((metric) => (
              <Box
                key={metric.title}
                sx={{
                  flex: "0 0 auto",
                  width: { xs: "78vw", sm: 300, md: 360, lg: 380 },
                  maxWidth: { xs: 290, sm: 340, md: 380 },
                  scrollSnapAlign: "start",
                }}
              >
                <OverviewMetricCard {...metric} />
              </Box>
            ))}
          </Box>
        ) : (
          <Grid
            container
            spacing={{ xs: 0, md: 2.5 }}
            sx={{
              display: "flex",
              flexWrap: { xs: "nowrap", md: "wrap" },
              gap: { xs: 1.25, md: 0 },
              overflowX: { xs: "auto", md: "visible" },
              scrollSnapType: { xs: "x mandatory", md: "none" },
              WebkitOverflowScrolling: "touch",
              pb: { xs: 0.75, md: 0 },
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            {metrics.map((metric) => (
              <Grid
                item
                xs={12}
                sm={6}
                lg={4}
                xl={3}
                key={metric.title}
                sx={{
                  flex: { xs: "0 0 78vw", sm: "0 0 310px", md: "unset" },
                  maxWidth: { xs: 290, sm: 330, md: "none" },
                  scrollSnapAlign: "start",
                }}
              >
                <OverviewMetricCard {...metric} />
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>
    </Card>
  );
}

function PincodeWiseScroller({ title, icon, rows }) {
  return (
    <Card sx={sectionCardSx}>
      <CardContent sx={{ p: { xs: 2, md: 4 } }}>
        <SectionTitle title={title} />
        <Box sx={scrollRowSx}>
          <Stack direction="row" spacing={{ xs: 1.25, md: 2 }} sx={{ minWidth: "max-content" }}>
            {(rows || []).map((r) => (
              <Card key={r.pincode} sx={{ minWidth: { xs: 184, sm: 220 }, borderRadius: { xs: 2, sm: 3 }, border: `1px solid ${COLORS.border}`, boxShadow: "0 8px 20px rgba(15,23,42,0.06)", scrollSnapAlign: "start" }}>
                <CardContent sx={{ p: { xs: 1.5, md: 2.5 } }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: { xs: 36, md: 40 },
                        height: { xs: 36, md: 40 },
                        borderRadius: 2,
                        bgcolor: COLORS.background,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: COLORS.primary,
                        "& svg": { fontSize: { xs: 20, md: 24 } },
                      }}
                    >
                      {icon}
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ color: COLORS.textSecondary, fontWeight: 800, fontSize: { xs: 12, md: 14 } }}>
                        Pincode {r.pincode}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900, color: COLORS.text, lineHeight: 1.1, fontSize: { xs: "1.15rem", md: "1.25rem" } }}>
                        {r.count}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

const growthData = {
  Daily: [
    { name: "Mon", value: 420 },
    { name: "Tue", value: 510 },
    { name: "Wed", value: 470 },
    { name: "Thu", value: 560 },
    { name: "Fri", value: 620 },
    { name: "Sat", value: 710 },
    { name: "Sun", value: 760 },
  ],
  Weekly: [
    { name: "W1", value: 3200 },
    { name: "W2", value: 3600 },
    { name: "W3", value: 3400 },
    { name: "W4", value: 4100 },
  ],
  Monthly: [
    { name: "Jan", value: 5.2 },
    { name: "Feb", value: 6.1 },
    { name: "Mar", value: 5.8 },
    { name: "Apr", value: 6.3 },
    { name: "May", value: 6.8 },
  ],
};

function GrowthBar({ data, maxValue }) {
  return (
    <Stack
      direction="row"
      spacing={{ xs: 0.85, md: 1 }}
      alignItems="flex-end"
      justifyContent="space-around"
      sx={{
        minHeight: { xs: 158, md: 200 },
        py: { xs: 1, md: 2 },
        overflowX: "auto",
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {data.map((item) => (
        <Box
          key={item.name}
          sx={{
            flex: 1,
            minWidth: { xs: 34, md: 40 },
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            scrollSnapAlign: "start",
          }}
        >
          <Box
            sx={{
              width: "100%",
              height: { xs: `${Math.max(28, (item.value / maxValue) * 110)}px`, md: `${Math.max(30, (item.value / maxValue) * 150)}px` },
              background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
              borderRadius: 1.5,
              mb: 1,
              boxShadow: "0 8px 18px rgba(14,165,233,0.2)",
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontSize: "0.7rem" }}>
            {item.name}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

export default function FranchiseDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedTab, setSelectedTab] = useState("Daily");

  const storedUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user_agency") || sessionStorage.getItem("user_agency");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [banners, setBanners] = useState([]);
  const [achievers, setAchievers] = useState([]);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const [mRes, aRes, bRes] = await Promise.all([
          API.get("/business/franchise/dashboard-metrics/"),
          API.get("/business/franchise/achievers/"),
          API.get("/business/franchise/wishing-banners/"),
        ]);
        if (!alive) return;
        setMetrics(mRes?.data || null);
        setAchievers(Array.isArray(aRes?.data?.results) ? aRes.data.results : []);
        setBanners(Array.isArray(bRes?.data?.results) ? bRes.data.results : []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.detail || "Failed to load franchise dashboard data.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const fmtMoney = (v) => {
    try {
      const n = Number(v || 0);
      return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    } catch {
      return `₹${v || 0}`;
    }
  };

  const scope = metrics?.scope || {};
  const scopeLabel = scope?.label || "Franchise";
  const scopeEntityLabel = scope?.level === "state" ? "State" : scope?.level === "district" ? "District" : "Pincode";
  const stateFallback = storedUser?.state?.name || (typeof storedUser?.state === "string" ? storedUser.state : "");
  const districtFallback = storedUser?.city?.name || (typeof storedUser?.city === "string" ? storedUser.city : "");
  const assignedScopeText = useMemo(() => {
    if (scope?.level === "state") {
      const names = Array.isArray(scope?.states) ? scope.states.map((s) => s?.name).filter(Boolean) : [];
      return names.length ? names.join(", ") : stateFallback || "-";
    }
    if (scope?.level === "district") {
      const names = Array.isArray(scope?.districts)
        ? scope.districts.map((d) => [d?.district, d?.state].filter(Boolean).join(", ")).filter(Boolean)
        : [];
      return names.length ? names.join(" | ") : districtFallback || "-";
    }
    const pins = Array.isArray(scope?.assigned_pincodes) && scope.assigned_pincodes.length
      ? scope.assigned_pincodes
      : Array.isArray(scope?.pincodes)
        ? scope.pincodes
        : [];
    return pins.length ? pins.join(", ") : storedUser?.pincode || "-";
  }, [scope, stateFallback, districtFallback, storedUser?.pincode]);

  const pincodeOverviewMetrics = useMemo(() => {
    const counts = metrics?.overall?.counts || {};
    return [
      { title: `${scopeEntityLabel} Total Consumer Count`, value: String(counts.consumers ?? 0), icon: <GroupsOutlinedIcon />, accent: COLORS.primary },
      { title: `${scopeEntityLabel} Captain Office Count`, value: String(counts.captain_office ?? 0), icon: <ApartmentOutlinedIcon />, accent: COLORS.success },
      { title: `${scopeEntityLabel} Sarathi Count`, value: String(counts.sarathi ?? 0), icon: <WorkOutlineOutlinedIcon />, accent: COLORS.secondary },
      { title: `${scopeEntityLabel} Merchant Count`, value: String(counts.merchants ?? 0), icon: <StoreOutlinedIcon />, accent: COLORS.primaryDark },
      { title: `${scopeEntityLabel} Total Self Rebirth ID`, value: String(counts.self_rebirth_ids ?? 0), icon: <TrendingUpOutlinedIcon />, accent: COLORS.success },
    ];
  }, [metrics, scopeEntityLabel]);

  const consumerStatsCards = useMemo(() => {
    const cs = metrics?.consumer_stats || {};
    return [
      { title: "Consumer Active Overall", value: String(cs?.active?.overall ?? 0), icon: <TrendingUpOutlinedIcon />, accent: COLORS.success },
      { title: "Consumer Active Month", value: String(cs?.active?.month ?? 0), icon: <TrendingUpOutlinedIcon />, accent: COLORS.success },
      { title: "Consumer Inactive Overall", value: String(cs?.inactive?.overall ?? 0), icon: <TrendingUpOutlinedIcon />, accent: COLORS.secondary },
      { title: "Consumer Inactive Month", value: String(cs?.inactive?.month ?? 0), icon: <TrendingUpOutlinedIcon />, accent: COLORS.secondary },
      { title: "Consumer ID Self Rebirth Overall", value: String(cs?.self_rebirth_id?.overall ?? 0), icon: <TrendingUpOutlinedIcon />, accent: COLORS.primary },
      { title: "Consumer ID Self Rebirth Month", value: String(cs?.self_rebirth_id?.month ?? 0), icon: <TrendingUpOutlinedIcon />, accent: COLORS.primary },
      { title: "Consumer Total Earning Overall", value: fmtMoney(cs?.total_earning?.overall ?? 0), icon: <CurrencyRupeeRoundedIcon />, accent: COLORS.primaryDark },
      { title: "Consumer Total Earning Month", value: fmtMoney(cs?.total_earning?.month ?? 0), icon: <CurrencyRupeeRoundedIcon />, accent: COLORS.primaryDark },
    ];
  }, [metrics]);

  const selectedData = growthData[selectedTab] || [];
  const maxDataValue = useMemo(() => Math.max(...selectedData.map((item) => item.value), 1), [selectedData]);

  const perPin = metrics?.per_pincode || {};

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: COLORS.background,
        pt: { xs: 1.25, md: 4 },
        pb: { xs: "calc(92px + env(safe-area-inset-bottom))", md: 4 },
        WebkitOverflowScrolling: "touch",
      }}
    >
      <Container maxWidth="xl" sx={{ px: { xs: 1.25, sm: 2, md: 3 } }}>
        <Stack spacing={{ xs: 1.5, md: 4 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}

          {/* Wishing banner scroller */}
          {loading ? (
            <Skeleton variant="rounded" height={210} sx={{ borderRadius: { xs: 2, md: 4 } }} />
          ) : banners?.length ? (
            <Card sx={{ borderRadius: { xs: 2, md: 4 }, overflow: "hidden", border: `1px solid ${COLORS.border}`, boxShadow: { xs: "0 10px 24px rgba(15,23,42,0.08)", md: COLORS.shadow } }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ ...scrollRowSx, gap: 0, p: 0 }}>
                  <Stack direction="row" spacing={0} sx={{ minWidth: "max-content" }}>
                    {banners.map((b) => (
                      <Box key={b.id} sx={{ width: { xs: "calc(100vw - 20px)", sm: 420, md: 520 }, height: { xs: 142, sm: 170, md: 220 }, flex: "0 0 auto", scrollSnapAlign: "start" }}>
                        {b?.image_url ? (
                          <img
                            src={b.image_url}
                            alt={b.title || "Banner"}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <Box sx={{ width: "100%", height: "100%", bgcolor: COLORS.background }} />
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          ) : null}

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Card
              sx={{
                background: `linear-gradient(135deg, ${COLORS.success} 0%, ${COLORS.primary} 58%, ${COLORS.primaryDark} 100%)`,
                borderRadius: { xs: 2, md: 4 },
                boxShadow: { xs: "0 14px 34px rgba(14, 165, 233, 0.2)", md: "0 22px 54px rgba(14, 165, 233, 0.22)" },
                border: "none",
                overflow: "hidden",
              }}
            >
              <CardContent sx={{ p: { xs: 2, md: 4 }, color: "white" }}>
                <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", gap: { xs: 1.5, md: 2 } }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1.25, md: 2 }, minWidth: 0 }}>
                    <Box
                      sx={{
                        width: { xs: 42, md: 48 },
                        height: { xs: 42, md: 48 },
                        borderRadius: 2,
                        bgcolor: "rgba(255,255,255,0.2)",
                        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.22)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <TrendingUpOutlinedIcon sx={{ fontSize: { xs: 24, md: 28 }, color: "white" }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h4" sx={{ fontWeight: 900, fontSize: { xs: "1.25rem", sm: "1.5rem", md: "2rem" }, mb: 0.35, lineHeight: 1.12 }}>
                        Franchise Dashboard
                      </Typography>
                      <Typography variant="subtitle1" sx={{ opacity: 0.9, fontSize: { xs: "0.8rem", md: "1rem" }, lineHeight: 1.2 }}>
                        {scopeLabel} overview
                      </Typography>
                    </Box>
                  </Box>

                  <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
                    <IconButton sx={{ width: { xs: 38, md: 40 }, height: { xs: 38, md: 40 }, bgcolor: "rgba(255,255,255,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.22)", transition: "transform 140ms ease", "&:active": { transform: "scale(0.94)" } }}>
                      <NotificationsNoneRoundedIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => navigate("/agency/franchise-wallet")}
                      sx={{ width: { xs: 38, md: 40 }, height: { xs: 38, md: 40 }, bgcolor: "rgba(255,255,255,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.22)", transition: "transform 140ms ease", "&:active": { transform: "scale(0.94)" } }}
                    >
                      <CurrencyRupeeRoundedIcon />
                    </IconButton>
                    <IconButton sx={{ width: { xs: 38, md: 40 }, height: { xs: 38, md: 40 }, bgcolor: "rgba(255,255,255,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.22)", transition: "transform 140ms ease", "&:active": { transform: "scale(0.94)" } }}>
                      <PublicRoundedIcon />
                    </IconButton>
                  </Stack>
                </Box>

                <Box sx={{ mt: { xs: 2, md: 3 } }}>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: "white", mb: 0.35, fontSize: { xs: "1.05rem", md: "1.5rem" }, lineHeight: 1.18 }}>
                    {storedUser?.full_name || storedUser?.username || "Franchise Partner"}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)", mb: { xs: 1.25, md: 1 }, fontSize: { xs: 12.5, md: 14 }, textTransform: "capitalize" }}>
                    {storedUser?.category ? String(storedUser.category).replaceAll("_", " ") : "Agency"}
                  </Typography>

                  <Paper
                    sx={{
                      p: { xs: 1.5, md: 3 },
                      borderRadius: { xs: 2, md: 3 },
                      bgcolor: "rgba(255,255,255,0.15)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)",
                    }}
                  >
                    <Grid container spacing={{ xs: 1.25, md: 3 }}>
                      <Grid item xs={12} sm={4}>
                        <Stack direction="row" alignItems="center" spacing={1.25}>
                          <BadgeOutlinedIcon sx={{ color: "white", opacity: 0.9, fontSize: 20 }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)", display: "block", fontWeight: 700, lineHeight: 1.15 }}>
                              Username
                            </Typography>
                            <Typography variant="body2" sx={{ color: "white", fontWeight: 900, overflowWrap: "anywhere", lineHeight: 1.2 }}>
                              {storedUser?.username || "â€”"}
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <Stack direction="row" alignItems="center" spacing={1.25}>
                          <LocationOnOutlinedIcon sx={{ color: "white", opacity: 0.9, fontSize: 20 }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)", display: "block", fontWeight: 700, lineHeight: 1.15 }}>
                              Assigned {scopeEntityLabel}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "white", fontWeight: 900, overflowWrap: "anywhere", lineHeight: 1.2 }}>
                              {assignedScopeText}
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <Stack direction="row" alignItems="center" spacing={1.25}>
                          <TrendingUpOutlinedIcon sx={{ color: "white", opacity: 0.9, fontSize: 20 }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)", display: "block", fontWeight: 700, lineHeight: 1.15 }}>
                              Resolved pincodes
                            </Typography>
                            <Typography variant="body2" sx={{ color: "white", fontWeight: 900, lineHeight: 1.2 }}>
                              {Number(scope?.pincode_count ?? (Array.isArray(metrics?.overall?.pincodes) ? metrics.overall.pincodes.length : 0))}
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>
                    </Grid>
                  </Paper>
                </Box>
              </CardContent>
            </Card>
          </motion.div>

          {/* Achievers */}
          <Card sx={sectionCardSx}>
            <CardContent sx={{ p: { xs: 2, md: 4 } }}>
              <SectionTitle title="Top Achievers" />
              <Box sx={scrollRowSx}>
                <Stack direction="row" spacing={{ xs: 1.25, md: 2 }} sx={{ minWidth: "max-content" }}>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <Skeleton key={idx} variant="rounded" width={156} height={158} sx={{ borderRadius: 2, scrollSnapAlign: "start" }} />
                    ))
                  ) : achievers.length ? (
                    achievers.map((a) => (
                      <Box key={a.id} sx={{ scrollSnapAlign: "start" }}>
                        <AchieverCard
                          name={a.name}
                          subtitle={a.pincode ? `Pincode ${a.pincode}` : ""}
                          achieved={a.achieved}
                          photoUrl={a.photo_url}
                        />
                      </Box>
                    ))
                  ) : (
                    <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                      No achievers configured for your assigned region.
                    </Typography>
                  )}
                </Stack>
              </Box>
            </CardContent>
          </Card>

          {/* Overview counts */}
          <Stack spacing={3}>
            <OverviewSection title={`${scopeEntityLabel} Overview Counts`} metrics={pincodeOverviewMetrics} horizontalSwipe />
            <OverviewSection title="Consumer Stats (Overall + Month)" metrics={consumerStatsCards} />
          </Stack>

          {/* Pincode-wise scrollers */}
          <PincodeWiseScroller title="Pincode Total Consumer (pincode-wise)" icon={<GroupsOutlinedIcon />} rows={perPin?.consumers} />
          <PincodeWiseScroller title="Pincode Captain Office (pincode-wise)" icon={<ApartmentOutlinedIcon />} rows={perPin?.captain_office} />
          <PincodeWiseScroller title="Pincode Sarathi (pincode-wise)" icon={<WorkOutlineOutlinedIcon />} rows={perPin?.sarathi} />
          <PincodeWiseScroller title="Pincode Merchant (pincode-wise)" icon={<StoreOutlinedIcon />} rows={perPin?.merchants} />
          <PincodeWiseScroller title="Pincode Self Rebirth ID (pincode-wise)" icon={<TrendingUpOutlinedIcon />} rows={perPin?.self_rebirth_ids} />

          {/* Growth analytics placeholder (existing UI) */}
          <Card sx={sectionCardSx}>
            <CardContent sx={{ p: { xs: 2, md: 4 } }}>
              <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", mb: { xs: 1.75, md: 3 }, flexWrap: "wrap", gap: 1.5 }}>
                <SectionTitle title="Growth Analytics" />

                <Stack direction="row" spacing={1}>
                  {Object.keys(growthData).map((tab) => (
                    <Chip
                      key={tab}
                      label={tab}
                      onClick={() => setSelectedTab(tab)}
                      sx={{
                        fontWeight: 700,
                        height: { xs: 30, md: 32 },
                        borderRadius: 999,
                        bgcolor: selectedTab === tab ? COLORS.primary : COLORS.background,
                        color: selectedTab === tab ? COLORS.surface : COLORS.text,
                        border: `1px solid ${selectedTab === tab ? COLORS.primary : COLORS.border}`,
                      }}
                    />
                  ))}
                </Stack>
              </Box>

              <GrowthBar data={selectedData} maxValue={maxDataValue} />
            </CardContent>
          </Card>
        </Stack>
      </Container>
      <MobileBottomNav activePath={location.pathname} onNavigate={navigate} />
    </Box>
  );
}
