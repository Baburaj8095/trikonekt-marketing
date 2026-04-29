import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
  Paper,
} from "@mui/material";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import TrendingDownOutlinedIcon from "@mui/icons-material/TrendingDownOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import LocalAtmOutlinedIcon from "@mui/icons-material/LocalAtmOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";

// Theme colors from ThemeProvider
const COLORS = {
  primary: "#0ea5e9",     // Sky blue
  primaryDark: "#0284c7", // Darker sky blue
  success: "#22c55e",     // Green
  secondary: "#a855f7",   // Purple
  background: "#f1f5f9",  // Light bg
  surface: "#ffffff",     // White
  text: "#0f172a",        // Dark text
  border: "#e5e7eb",      // Light border
};

const achievers = [
  { rank: "#1", name: "Prakash Kumar", value: "₹2.5L", color: COLORS.success, photo: "https://i.pravatar.cc/120?img=12" },
  { rank: "#2", name: "Priya Sharma", value: "₹2.2L", color: COLORS.primary, photo: "https://i.pravatar.cc/120?img=15" },
  { rank: "#3", name: "Amit Patel", value: "₹2.1L", color: COLORS.primaryDark, photo: "https://i.pravatar.cc/120?img=10" },
  { rank: "#4", name: "Sneha Reddy", value: "₹1.9L", color: COLORS.secondary, photo: "https://i.pravatar.cc/120?img=18" },
  { rank: "#5", name: "Vikram Singh", value: "₹1.8L", color: COLORS.success, photo: "https://i.pravatar.cc/120?img=22" },
  { rank: "#6", name: "Meera Nair", value: "₹1.7L", color: COLORS.primary, photo: "https://i.pravatar.cc/120?img=20" },
];

const pincodeMetrics = [
  { value: "1,245", label: "Pincode wise active count" },
  { value: "12", label: "Pincode wise of sales count" },
  { value: "45", label: "Pincode wise network count" },
  { value: "89", label: "Pincode wise team count" },
  { value: "567", label: "Pincode wise and reached count" },
];

const consumerMetrics = [
  { value: "892", label: "Consumer new overall month", icon: <PeopleOutlineIcon /> },
  { value: "353", label: "Consumer new overall month", icon: <AssignmentOutlinedIcon /> },
  { value: "127", label: "Consumer 30 nights overall month", icon: <TrendingDownOutlinedIcon /> },
  { value: "₹45.2L", label: "Consumer total earned overall month", icon: <LocalAtmOutlinedIcon /> },
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
        "&:hover": { transform: "translateY(-4px)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" },
      }}
    >
      <Avatar
        src={photo}
        alt={name}
        sx={{
          width: 72,
          height: 72,
          mb: 1,
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        }}
      />
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
        }}
      >
        {rank}
      </Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textAlign: "center", mb: 0.5, fontSize: "0.85rem" }}>
        {name}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 800, color: color, textAlign: "center", fontSize: "1rem" }}>
        {value}
      </Typography>
    </Box>
  );
}

function MetricBox({ value, label }) {
  return (
    <Box sx={{ textAlign: "center", py: { xs: 1, sm: 1.5, md: 2 }, px: 0.5 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, color: COLORS.success, mb: 0.5, fontSize: { xs: "1.2rem", sm: "1.5rem", md: "2rem" } }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: { xs: "0.65rem", sm: "0.75rem" } }}>
        {label}
      </Typography>
    </Box>
  );
}

function GrowthBar({ data, maxValue }) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-end" justifyContent="space-around" sx={{ minHeight: 200, py: 2, overflowX: "auto" }}>
      {data.map((item) => (
        <Box key={item.name} sx={{ flex: 1, minWidth: 40, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Box
            sx={{
              width: "100%",
              height: `${Math.max(30, (item.value / maxValue) * 150)}px`,
              bgcolor: COLORS.primary,
              borderRadius: 2,
              transition: "height 0.3s ease",
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

const HomeScreen = () => {
  const [selectedTab, setSelectedTab] = useState("Daily");

  const selectedData = growthData[selectedTab];
  const maxDataValue = useMemo(
    () => Math.max(...selectedData.map((item) => item.value), 1),
    [selectedData]
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, py: { xs: 2, md: 4 } }}>
      <Container maxWidth="xl">
        <Stack spacing={4}>
          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card
              sx={{
                background: `linear-gradient(135deg, ${COLORS.success} 0%, ${COLORS.primary} 100%)`,
                borderRadius: 4,
                boxShadow: "0 8px 32px rgba(34, 197, 94, 0.3)",
                border: "none",
                overflow: "hidden",
                position: "relative",
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
                      <Typography
                        variant="h4"
                        sx={{
                          fontWeight: 800,
                          fontSize: { xs: "1.5rem", md: "2rem" },
                          lineHeight: 1.2,
                          mb: 0.5,
                        }}
                      >
                        Tri Growth Dashboard
                      </Typography>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          opacity: 0.9,
                          fontSize: { xs: "0.9rem", md: "1rem" },
                          fontWeight: 500,
                        }}
                      >
                        Your success analytics platform
                      </Typography>
                    </Box>
                  </Box>

                  {/* Sign Out Button */}
                  <Button
                    variant="outlined"
                    sx={{
                      color: "white",
                      borderColor: "rgba(255,255,255,0.3)",
                      borderRadius: 2,
                      px: 3,
                      py: 1,
                      fontWeight: 600,
                      textTransform: "none",
                      "&:hover": {
                        borderColor: "white",
                        bgcolor: "rgba(255,255,255,0.1)",
                      },
                    }}
                    onClick={() => {
                      // Handle sign out logic here
                      console.log("Sign out clicked");
                    }}
                  >
                    Sign Out
                  </Button>
                </Box>

                {/* User Info Section */}
                <Box sx={{ mt: 3 }}>
                  <Paper
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      bgcolor: "rgba(255,255,255,0.15)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    <Typography
                      variant="h6"
                      sx={{
                        color: "white",
                        fontWeight: 700,
                        mb: 2,
                        fontSize: "1.1rem",
                      }}
                    >
                      User Information
                    </Typography>
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6} md={3}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <BadgeOutlinedIcon sx={{ color: "white", opacity: 0.9, fontSize: 20 }} />
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "rgba(255,255,255,0.8)",
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                display: "block",
                              }}
                            >
                              User ID
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: "white",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                              }}
                            >
                              TRFN 56157223
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <LocationOnOutlinedIcon sx={{ color: "white", opacity: 0.9, fontSize: 20 }} />
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "rgba(255,255,255,0.8)",
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                display: "block",
                              }}
                            >
                              Location
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: "white",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                              }}
                            >
                              Bangalore
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <AccountCircleOutlinedIcon sx={{ color: "white", opacity: 0.9, fontSize: 20 }} />
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "rgba(255,255,255,0.8)",
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                display: "block",
                              }}
                            >
                              Rank
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: "white",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                              }}
                            >
                              Gold Partner
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <TrendingUpOutlinedIcon sx={{ color: "white", opacity: 0.9, fontSize: 20 }} />
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "rgba(255,255,255,0.8)",
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                display: "block",
                              }}
                            >
                              Status
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: "white",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                              }}
                            >
                              Active
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

          {/* Top Achievers Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: `1px solid ${COLORS.border}` }}>
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: COLORS.text, mb: 3, fontSize: { xs: "1.3rem", md: "1.5rem" } }}>
                  🏆 Top Achievers
                </Typography>
                <Box sx={{ overflowX: "auto", pb: 2 }}>
                  <Stack direction="row" spacing={2} sx={{ minWidth: "max-content" }}>
                    {achievers.map((achiever, index) => (
                      <motion.div
                        key={achiever.rank}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: index * 0.1 }}
                      >
                        <AchieverCard {...achiever} />
                      </motion.div>
                    ))}
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </motion.div>

          {/* Metrics Sections */}
          <Grid container spacing={3}>
            {/* Pincode Metrics */}
            <Grid item xs={12} lg={6}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: `1px solid ${COLORS.border}`, height: "100%" }}>
                  <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.text, mb: 3, fontSize: "1.1rem" }}>
                      📍 Pincode Metrics
                    </Typography>
                    <Grid container spacing={2}>
                      {pincodeMetrics.map((metric, index) => (
                        <Grid item xs={6} sm={4} key={index}>
                          <MetricBox {...metric} />
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>

            {/* Consumer Metrics */}
            <Grid item xs={12} lg={6}>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: `1px solid ${COLORS.border}`, height: "100%" }}>
                  <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.text, mb: 3, fontSize: "1.1rem" }}>
                      👥 Consumer Metrics
                    </Typography>
                    <Grid container spacing={2}>
                      {consumerMetrics.map((metric, index) => (
                        <Grid item xs={6} key={index}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 2, p: 2, borderRadius: 2, bgcolor: COLORS.background }}>
                            <Box sx={{ color: COLORS.primary, fontSize: 24 }}>
                              {metric.icon}
                            </Box>
                            <Box>
                              <Typography variant="h6" sx={{ fontWeight: 800, color: COLORS.success, fontSize: "1.1rem" }}>
                                {metric.value}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                                {metric.label}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          </Grid>

          {/* Growth Chart Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: `1px solid ${COLORS.border}` }}>
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3, flexWrap: "wrap", gap: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: COLORS.text, fontSize: { xs: "1.3rem", md: "1.5rem" } }}>
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
                          "&:hover": {
                            bgcolor: selectedTab === tab ? COLORS.primaryDark : `${COLORS.primary}10`,
                          },
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
                <GrowthBar data={selectedData} maxValue={maxDataValue} />
              </CardContent>
            </Card>
          </motion.div>
        </Stack>
      </Container>
    </Box>
  );
};

export default React.memo(HomeScreen);