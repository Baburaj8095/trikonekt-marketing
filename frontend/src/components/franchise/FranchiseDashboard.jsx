import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import IconButton from "@mui/material/IconButton";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import CurrencyRupeeRoundedIcon from "@mui/icons-material/AccountBalanceWallet";
import PublicRoundedIcon from "@mui/icons-material/MyLocation";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";

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

const achievers = [
  { rank: "#1", name: "Prakash Kumar", value: "₹2.5L", color: COLORS.success, photo: "https://i.pravatar.cc/120?img=12" },
  { rank: "#2", name: "Priya Sharma", value: "₹2.2L", color: COLORS.primary, photo: "https://i.pravatar.cc/120?img=15" },
  { rank: "#3", name: "Amit Patel", value: "₹2.1L", color: COLORS.primaryDark, photo: "https://i.pravatar.cc/120?img=10" },
  { rank: "#4", name: "Sneha Reddy", value: "₹1.9L", color: COLORS.secondary, photo: "https://i.pravatar.cc/120?img=18" },
  { rank: "#5", name: "Vikram Singh", value: "₹1.8L", color: COLORS.success, photo: "https://i.pravatar.cc/120?img=22" },
  { rank: "#6", name: "Meera Nair", value: "₹1.7L", color: COLORS.primary, photo: "https://i.pravatar.cc/120?img=20" },
];

const pincodeOverviewMetrics = [
  {
    title: "Pincode Total Consumers",
    value: "1,245",
    icon: <PeopleOutlineIcon />,
    accent: COLORS.primary,
  },
  {
    title: "Pincode Captain Office",
    value: "12",
    icon: <BusinessCenterOutlinedIcon />,
    accent: COLORS.success,
  },
  {
    title: "Pincode Sarathi Count",
    value: "45",
    icon: <SupportAgentOutlinedIcon />,
    accent: COLORS.secondary,
  },
  {
    title: "Pincode All Type of model merchant",
    value: "89",
    icon: <StorefrontOutlinedIcon />,
    accent: COLORS.primaryDark,
  },
  {
    title: "Pincode Total Self Rebirth Count",
    value: "567",
    icon: <AssignmentOutlinedIcon />,
    accent: COLORS.success,
  },
];

const pincodeCoordinatorOverviewMetrics = [
  {
    title: "Pincode Total Consumer",
    value: "(Pincode1 count, Pincode2 count)",
    icon: <PeopleOutlineIcon />,
    accent: COLORS.primary,
  },
  {
    title: "Pincode Captain Office",
    value: "(Pincode1 count, Pincode2 count)",
    icon: <BusinessCenterOutlinedIcon />,
    accent: COLORS.success,
  },
  {
    title: "Pincode Sarathi",
    value: "(Pincode1 count, Pincode2 count)",
    icon: <HubOutlinedIcon />,
    accent: COLORS.secondary,
  },
  {
    title: "Pincode All Type of model merchant",
    value: "(Pincode1 count, Pincode2 count)",
    icon: <AccountTreeOutlinedIcon />,
    accent: COLORS.primaryDark,
  },
];

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

function AchieverCard({ rank, name, value, color, photo }) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          p: 2,
          minWidth: 170,
          borderRadius: 2,
          bgcolor: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          transition: "all 0.3s ease",
          "&:hover": { boxShadow: "0 4px 12px rgba(0,0,0,0.1)" },
        }}
      >
        <Avatar src={photo} alt={name} sx={{ width: 72, height: 72, mb: 1 }} />
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            bgcolor: color,
            color: COLORS.surface,
            mb: 1,
            fontWeight: 800,
            fontSize: "1rem",
          }}
        >
          {rank}
        </Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, textAlign: "center", mb: 0.5 }}>
          {name}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 800, color, textAlign: "center" }}>
          {value}
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
          minHeight: 220,
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

        <Typography variant="body1" sx={{ fontWeight: 600, color: COLORS.text, mb: 2 }}>
          {title}
        </Typography>

        <Typography
          sx={{
            fontWeight: 800,
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
          sx={{ fontWeight: 800, color: COLORS.text, fontSize: { xs: "1.25rem", md: "1.5rem" } }}
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
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: "0.7rem" }}>
            {item.name}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

function FranchiseDashboard() {
  const [selectedTab, setSelectedTab] = useState("Daily");
  const navigate = useNavigate();

  const selectedData = growthData[selectedTab];
  const maxDataValue = useMemo(
    () => Math.max(...selectedData.map((item) => item.value), 1),
    [selectedData]
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, py: { xs: 2, md: 4 } }}>
      <Container maxWidth="xl">
        <Stack spacing={4}>
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
                      <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: "1.5rem", md: "2rem" }, mb: 0.5 }}>
                        Tri Growth Dashboard
                      </Typography>
                      <Typography variant="subtitle1" sx={{ opacity: 0.9, fontSize: { xs: "0.9rem", md: "1rem" } }}>
                        Your success analytics platform
                      </Typography>
                    </Box>
                  </Box>

                  <Stack direction="row" spacing={1}>
                    <IconButton sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white" }}>
                      <NotificationsNoneRoundedIcon />
                    </IconButton>

                    <IconButton
                      onClick={() => navigate("/user/franchise-wallet")}
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
                  <Typography variant="h5" sx={{ fontWeight: 700, color: "white", mb: 0.5 }}>
                    Prakash J
                  </Typography>

                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)", mb: 1 }}>
                    Franchise Partner
                  </Typography>

                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <ApartmentOutlinedIcon sx={{ color: "white", opacity: 0.9, fontSize: 18 }} />
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
                      Franchise Type: Master Franchise
                    </Typography>
                  </Stack>

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
                              User ID
                            </Typography>
                            <Typography variant="body2" sx={{ color: "white", fontWeight: 700 }}>
                              TRFN 56157223
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <LocationOnOutlinedIcon sx={{ color: "white", opacity: 0.9, fontSize: 20 }} />
                          <Box>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)", display: "block" }}>
                              Location
                            </Typography>
                            <Typography variant="body2" sx={{ color: "white", fontWeight: 700 }}>
                              Bangalore
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <TrendingUpOutlinedIcon sx={{ color: "white", opacity: 0.9, fontSize: 20 }} />
                          <Box>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)", display: "block" }}>
                              Performance
                            </Typography>
                            <Typography variant="body2" sx={{ color: "white", fontWeight: 800 }}>
                              94%
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

          <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: `1px solid ${COLORS.border}` }}>
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: COLORS.text, mb: 3 }}>
                🏆 Top Achievers
              </Typography>
              <Box sx={{ overflowX: "auto", pb: 2 }}>
                <Stack direction="row" spacing={2} sx={{ minWidth: "max-content" }}>
                  {achievers.map((achiever) => (
                    <div key={achiever.rank}>
                      <AchieverCard {...achiever} />
                    </div>
                  ))}
                </Stack>
              </Box>
            </CardContent>
          </Card>

          <Stack spacing={3}>
            <OverviewSection title="Pincode Overview Count" metrics={pincodeOverviewMetrics} horizontalSwipe />
            <OverviewSection title="Pincode - Co-ordinator Overview Count" metrics={pincodeCoordinatorOverviewMetrics} />
          </Stack>

          <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: `1px solid ${COLORS.border}` }}>
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3, flexWrap: "wrap", gap: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: COLORS.text }}>
                  📈 Growth Analytics
                </Typography>

                <Stack direction="row" spacing={1}>
                  {Object.keys(growthData).map((tab) => (
                    <Chip
                      key={tab}
                      label={tab}
                      onClick={() => setSelectedTab(tab)}
                      sx={{
                        fontWeight: 600,
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

export default FranchiseDashboard;