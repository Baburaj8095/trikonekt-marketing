import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import API from "../../api/api";

import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
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

const COLORS = {
  primary: "#0ea5e9",
  primaryDark: "#0284c7",
  success: "#22c55e",
  secondary: "#a855f7",
  background: "#f1f5f9",
  surface: "#ffffff",
  text: "#0f172a",
  textSecondary: "#64748b",
  border: "#e5e7eb",
};

function AchieverCard({ name, subtitle, achieved, photoUrl }) {
  const initials = useMemo(() => {
    const t = String(name || "").trim();
    if (!t) return "A";
    return t.split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
  }, [name]);

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          p: 2,
          minWidth: 190,
          borderRadius: 2,
          bgcolor: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          transition: "all 0.3s ease",
          "&:hover": { boxShadow: "0 4px 12px rgba(0,0,0,0.1)" },
        }}
      >
        <Avatar
          src={photoUrl || undefined}
          alt={name}
          sx={{ width: 72, height: 72, mb: 1, bgcolor: COLORS.primary }}
        >
          {initials}
        </Avatar>

        <Typography variant="subtitle2" sx={{ fontWeight: 800, textAlign: "center" }}>
          {name || "Achiever"}
        </Typography>
        <Typography variant="caption" sx={{ color: COLORS.textSecondary, textAlign: "center", mb: 1 }}>
          {subtitle || ""}
        </Typography>

        <Typography variant="body2" sx={{ fontWeight: 700, color: COLORS.success, textAlign: "center" }}>
          {achieved || ""}
        </Typography>
      </Box>
    </motion.div>
  );
}

function OverviewMetricCard({ title, value, icon, accent }) {
  return (
    <motion.div whileHover={{ y: -6 }} transition={{ duration: 0.24 }}>
      <Box
        sx={{
          height: "100%",
          minHeight: 180,
          p: 3,
          borderRadius: 4,
          bgcolor: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 10px 30px rgba(15,23,42,0.07)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 2 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 3,
              display: "grid",
              placeItems: "center",
              bgcolor: `${accent}14`,
              color: accent,
              border: `1px solid ${accent}22`,
            }}
          >
            {icon}
          </Box>
        </Box>

        <Typography variant="body1" sx={{ fontWeight: 700, color: COLORS.text, mb: 1 }}>
          {title}
        </Typography>

        <Typography
          sx={{
            fontWeight: 900,
            color: accent,
            fontSize: { xs: "1.35rem", sm: "1.55rem" },
            lineHeight: 1.2,
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
    <Card
      sx={{
        borderRadius: 4,
        boxShadow: "0 12px 36px rgba(15,23,42,0.08)",
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Typography
          variant="h5"
          sx={{ fontWeight: 900, color: COLORS.text, fontSize: { xs: "1.25rem", md: "1.5rem" } }}
        >
          {title}
        </Typography>

        <Divider sx={{ my: 3 }} />

        {horizontalSwipe ? (
          <Box sx={{ display: "flex", gap: 2.5, overflowX: "auto", pb: 1 }}>
            {metrics.map((metric) => (
              <Box
                key={metric.title}
                sx={{
                  flex: "0 0 auto",
                  width: { xs: "88%", sm: 340, md: 360, lg: 380 },
                }}
              >
                <OverviewMetricCard {...metric} />
              </Box>
            ))}
          </Box>
        ) : (
          <Grid container spacing={2.5}>
            {metrics.map((metric) => (
              <Grid item xs={12} sm={6} lg={4} xl={3} key={metric.title}>
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
    <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: `1px solid ${COLORS.border}` }}>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Typography variant="h6" sx={{ fontWeight: 900, color: COLORS.text, mb: 2 }}>
          {title}
        </Typography>
        <Box sx={{ overflowX: "auto", pb: 1 }}>
          <Stack direction="row" spacing={2} sx={{ minWidth: "max-content" }}>
            {(rows || []).map((r) => (
              <Card key={r.pincode} sx={{ minWidth: 220, borderRadius: 3, border: `1px solid ${COLORS.border}`, boxShadow: "none" }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        bgcolor: COLORS.background,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: COLORS.primary,
                      }}
                    >
                      {icon}
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ color: COLORS.textSecondary, fontWeight: 800 }}>
                        Pincode {r.pincode}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900, color: COLORS.text, lineHeight: 1.1 }}>
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
    <Stack direction="row" spacing={1} alignItems="flex-end" justifyContent="space-around" sx={{ minHeight: 200, py: 2, overflowX: "auto" }}>
      {data.map((item) => (
        <Box
          key={item.name}
          sx={{
            flex: 1,
            minWidth: 40,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Box
            sx={{
              width: "100%",
              height: `${Math.max(30, (item.value / maxValue) * 150)}px`,
              bgcolor: COLORS.primary,
              borderRadius: 2,
              mb: 1,
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

  const pincodeOverviewMetrics = useMemo(() => {
    const counts = metrics?.overall?.counts || {};
    return [
      { title: "Pincode Total Consumer Count", value: String(counts.consumers ?? 0), icon: <GroupsOutlinedIcon />, accent: COLORS.primary },
      { title: "Pincode Captain Office Count", value: String(counts.captain_office ?? 0), icon: <ApartmentOutlinedIcon />, accent: COLORS.success },
      { title: "Pincode Sarathi Count", value: String(counts.sarathi ?? 0), icon: <WorkOutlineOutlinedIcon />, accent: COLORS.secondary },
      { title: "Pincode Merchant Count", value: String(counts.merchants ?? 0), icon: <StoreOutlinedIcon />, accent: COLORS.primaryDark },
      { title: "Pincode Total Self Rebirth ID", value: String(counts.self_rebirth_ids ?? 0), icon: <TrendingUpOutlinedIcon />, accent: COLORS.success },
    ];
  }, [metrics]);

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
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, py: { xs: 2, md: 4 } }}>
      <Container maxWidth="xl">
        <Stack spacing={4}>
          {err ? <Alert severity="error">{err}</Alert> : null}

          {/* Wishing banner scroller */}
          {loading ? (
            <Skeleton variant="rounded" height={210} />
          ) : banners?.length ? (
            <Card sx={{ borderRadius: 3, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ overflowX: "auto" }}>
                  <Stack direction="row" spacing={0} sx={{ minWidth: "max-content" }}>
                    {banners.map((b) => (
                      <Box key={b.id} sx={{ width: { xs: 320, md: 520 }, height: { xs: 160, md: 220 }, flex: "0 0 auto" }}>
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
                background: `linear-gradient(135deg, ${COLORS.success} 0%, ${COLORS.primary} 100%)`,
                borderRadius: 4,
                boxShadow: "0 8px 32px rgba(34, 197, 94, 0.3)",
                border: "none",
                overflow: "hidden",
              }}
            >
              <CardContent sx={{ p: { xs: 3, md: 4 }, color: "white" }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        bgcolor: "rgba(255,255,255,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <TrendingUpOutlinedIcon sx={{ fontSize: 28, color: "white" }} />
                    </Box>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 900, fontSize: { xs: "1.5rem", md: "2rem" }, mb: 0.5 }}>
                        Franchise Dashboard
                      </Typography>
                      <Typography variant="subtitle1" sx={{ opacity: 0.9, fontSize: { xs: "0.9rem", md: "1rem" } }}>
                        Pincode coordinator overview
                      </Typography>
                    </Box>
                  </Box>

                  <Stack direction="row" spacing={1}>
                    <IconButton sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white" }}>
                      <NotificationsNoneRoundedIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => navigate("/agency/franchise-wallet")}
                      sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white" }}
                    >
                      <CurrencyRupeeRoundedIcon />
                    </IconButton>
                    <IconButton sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white" }}>
                      <PublicRoundedIcon />
                    </IconButton>
                  </Stack>
                </Box>

                <Box sx={{ mt: 3 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: "white", mb: 0.5 }}>
                    {storedUser?.full_name || storedUser?.username || "Franchise Partner"}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)", mb: 1 }}>
                    {storedUser?.category ? String(storedUser.category).replaceAll("_", " ") : "Agency"}
                  </Typography>

                  <Paper
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      bgcolor: "rgba(255,255,255,0.15)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={4}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <BadgeOutlinedIcon sx={{ color: "white", opacity: 0.9, fontSize: 20 }} />
                          <Box>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)", display: "block" }}>
                              Username
                            </Typography>
                            <Typography variant="body2" sx={{ color: "white", fontWeight: 800 }}>
                              {storedUser?.username || "—"}
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <LocationOnOutlinedIcon sx={{ color: "white", opacity: 0.9, fontSize: 20 }} />
                          <Box>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)", display: "block" }}>
                              Pincode
                            </Typography>
                            <Typography variant="body2" sx={{ color: "white", fontWeight: 800 }}>
                              {storedUser?.pincode || "—"}
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <TrendingUpOutlinedIcon sx={{ color: "white", opacity: 0.9, fontSize: 20 }} />
                          <Box>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)", display: "block" }}>
                              Assigned pincodes
                            </Typography>
                            <Typography variant="body2" sx={{ color: "white", fontWeight: 900 }}>
                              {Array.isArray(metrics?.overall?.pincodes) ? metrics.overall.pincodes.length : 0}
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
          <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: `1px solid ${COLORS.border}` }}>
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Typography variant="h5" sx={{ fontWeight: 900, color: COLORS.text, mb: 3 }}>
                Top Achievers
              </Typography>
              <Box sx={{ overflowX: "auto", pb: 2 }}>
                <Stack direction="row" spacing={2} sx={{ minWidth: "max-content" }}>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <Skeleton key={idx} variant="rounded" width={190} height={190} />
                    ))
                  ) : achievers.length ? (
                    achievers.map((a) => (
                      <div key={a.id}>
                        <AchieverCard
                          name={a.name}
                          subtitle={a.pincode ? `Pincode ${a.pincode}` : ""}
                          achieved={a.achieved}
                          photoUrl={a.photo_url}
                        />
                      </div>
                    ))
                  ) : (
                    <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                      No achievers configured for your pincodes.
                    </Typography>
                  )}
                </Stack>
              </Box>
            </CardContent>
          </Card>

          {/* Overview counts */}
          <Stack spacing={3}>
            <OverviewSection title="Pincode Overview Counts" metrics={pincodeOverviewMetrics} horizontalSwipe />
            <OverviewSection title="Consumer Stats (Overall + Month)" metrics={consumerStatsCards} />
          </Stack>

          {/* Pincode-wise scrollers */}
          <PincodeWiseScroller title="Pincode Total Consumer (pincode-wise)" icon={<GroupsOutlinedIcon />} rows={perPin?.consumers} />
          <PincodeWiseScroller title="Pincode Captain Office (pincode-wise)" icon={<ApartmentOutlinedIcon />} rows={perPin?.captain_office} />
          <PincodeWiseScroller title="Pincode Sarathi (pincode-wise)" icon={<WorkOutlineOutlinedIcon />} rows={perPin?.sarathi} />
          <PincodeWiseScroller title="Pincode Merchant (pincode-wise)" icon={<StoreOutlinedIcon />} rows={perPin?.merchants} />
          <PincodeWiseScroller title="Pincode Self Rebirth ID (pincode-wise)" icon={<TrendingUpOutlinedIcon />} rows={perPin?.self_rebirth_ids} />

          {/* Growth analytics placeholder (existing UI) */}
          <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: `1px solid ${COLORS.border}` }}>
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3, flexWrap: "wrap", gap: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 900, color: COLORS.text }}>
                  Growth Analytics
                </Typography>

                <Stack direction="row" spacing={1}>
                  {Object.keys(growthData).map((tab) => (
                    <Chip
                      key={tab}
                      label={tab}
                      onClick={() => setSelectedTab(tab)}
                      sx={{
                        fontWeight: 700,
                        bgcolor: selectedTab === tab ? COLORS.primary : COLORS.background,
                        color: selectedTab === tab ? COLORS.surface : COLORS.text,
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
    </Box>
  );
}
