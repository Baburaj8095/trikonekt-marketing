import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useShell } from "../../components/layouts/ShellBase";
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
  Badge,
} from "@mui/material";
import { useCartStore } from "../../store/cartStore";
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
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
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
  { rank: "#1", name: "Prakash Kumar", value: "Rs.2.5L", color: COLORS.success, photo: "https://i.pravatar.cc/120?img=12" },
  { rank: "#2", name: "Priya Sharma", value: "Rs.2.2L", color: COLORS.primary, photo: "https://i.pravatar.cc/120?img=15" },
  { rank: "#3", name: "Amit Patel", value: "Rs.2.1L", color: COLORS.primaryDark, photo: "https://i.pravatar.cc/120?img=10" },
  { rank: "#4", name: "Sneha Reddy", value: "Rs.1.9L", color: COLORS.secondary, photo: "https://i.pravatar.cc/120?img=18" },
  { rank: "#5", name: "Vikram Singh", value: "Rs.1.8L", color: COLORS.success, photo: "https://i.pravatar.cc/120?img=22" },
  { rank: "#6", name: "Meera Nair", value: "Rs.1.7L", color: COLORS.primary, photo: "https://i.pravatar.cc/120?img=20" },
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
    value: "489",
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
    title: "Pincode Sarathi",
    value: "8889",
    icon: <HubOutlinedIcon />,
    accent: COLORS.secondary,
  },
  {
    title: "Pincode All Type of model merchant",
    value: "8889",
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
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} style={{ height: "100%" }}>
      <Box
        sx={{
          width: 200,
          height: 180,
          flexShrink: 0,
          p: 2.5,
          borderRadius: 4,
          bgcolor: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 10px 30px rgba(15,23,42,0.07)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 3,
            display: "grid",
            placeItems: "center",
            bgcolor: `${accent}14`,
            color: accent,
            border: `1px solid ${accent}22`,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>

        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            color: COLORS.textSecondary,
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </Typography>

        <Typography
          sx={{
            fontWeight: 800,
            color: accent,
            fontSize: "1.4rem",
            lineHeight: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {value}
        </Typography>
      </Box>
    </motion.div>
  );
}

function OverviewSection({ title, metrics }) {
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
          sx={{ fontWeight: 800, color: COLORS.text, fontSize: { xs: "1.1rem", md: "1.4rem" }, mb: 0 }}
        >
          {title}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Box
          sx={{
            display: "flex",
            gap: 2,
            overflowX: "auto",
            pb: 1,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {metrics.map((metric) => (
            <OverviewMetricCard key={metric.title} {...metric} />
          ))}
        </Box>
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

function FranchiseUserProfile({ name, role, type, userId, location, performance }) {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, color: "white", mb: 0.5 }}>
        {name}
      </Typography>

      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)", mb: 1 }}>
        {role}
      </Typography>

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <ApartmentOutlinedIcon sx={{ color: "white", opacity: 0.9, fontSize: 18 }} />
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
          Franchise Type: {type}
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
                  {userId}
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
                  {location}
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
                  {performance}
                </Typography>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}

function FranchiseDashboard() {
  const [selectedTab, setSelectedTab] = useState("Daily");
  const navigate = useNavigate();
  const { toggleSidebar, isMobile } = useShell();

  const cartItems = useCartStore((s) => s.items);
  const cartCount = Array.isArray(cartItems) ? cartItems.reduce((sum, i) => sum + (i.qty || 0), 0) : 0;

  const selectedData = growthData[selectedTab];
  const maxDataValue = useMemo(
    () => Math.max(...selectedData.map((item) => item.value), 1),
    [selectedData]
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, py: { xs: 0, md: 4 } }}>
      <Container maxWidth="xl" sx={{ px: { xs: 0, sm: 2, md: 3 } }}>
        <Stack spacing={{ xs: 2, md: 4 }}>
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Card
              sx={{
                background: `linear-gradient(135deg, ${COLORS.success} 0%, ${COLORS.primary} 100%)`,
                borderRadius: { xs: 0, md: 4 },
                boxShadow: "0 8px 32px rgba(34, 197, 94, 0.3)",
                border: "none",
                overflow: "hidden",
              }}
            >
              <CardContent sx={{ p: { xs: "20px 16px", md: 4 }, color: "white" }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "nowrap", gap: { xs: 1, sm: 2 } }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, overflow: "hidden", flex: 1, minWidth: 0 }}>
                    {isMobile && (
                      <IconButton
                        aria-label="Open menu"
                        onClick={toggleSidebar}
                        sx={{
                          bgcolor: "rgba(255,255,255,0.2)",
                          color: "white",
                          width: 36,
                          height: 36,
                          borderRadius: 2,
                          flexShrink: 0,
                          p: 0,
                          "&:hover": { bgcolor: "rgba(255,255,255,0.35)" },
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="3" y1="6" x2="21" y2="6" />
                          <line x1="3" y1="12" x2="21" y2="12" />
                          <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                      </IconButton>
                    )}

                    <Typography noWrap variant="h4" sx={{ fontWeight: 800, fontSize: { xs: "1.3rem", sm: "1.6rem", md: "2rem" }, mb: 0, lineHeight: 1 }}>
                      Tri Growth
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1}>
                    <IconButton
                      onClick={() => navigate("/user/cart")}
                      sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white" }}
                    >
                      <Badge badgeContent={cartCount} color="error">
                        <ShoppingCartRoundedIcon />
                      </Badge>
                    </IconButton>
                  </Stack>
                </Box>

                <FranchiseUserProfile
                  name="Prakash J"
                  role="Franchise Partner"
                  type="Master Franchise"
                  userId="TRFN 56157223"
                  location="Bangalore"
                  performance="94%"
                />
              </CardContent>
            </Card>
          </motion.div>

          <Box sx={{ px: { xs: 2, sm: 0 } }}>
            <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: `1px solid ${COLORS.border}` }}>
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: COLORS.text, mb: 3 }}>
                  Top Achievers
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
          </Box>

          <Box sx={{ px: { xs: 2, sm: 0 } }}>
            <Stack spacing={3}>
              <OverviewSection title="Pincode Overview Count" metrics={pincodeOverviewMetrics} horizontalSwipe />
              <OverviewSection title="Pincode - Co-ordinator Overview Count" metrics={pincodeCoordinatorOverviewMetrics} />
            </Stack>
          </Box>

          <Box sx={{ px: { xs: 2, sm: 0 } }}>
            <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: `1px solid ${COLORS.border}` }}>
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3, flexWrap: "wrap", gap: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: COLORS.text }}>
                    Growth Analytics
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
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}

export default FranchiseDashboard;
