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

export default function FranchiseGrowthDashboardDemo() {
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
                          <PersonOutlineIcon sx={{ color: "white", opacity: 0.9, fontSize: 20 }} />
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
                              Franchise Type
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: "white",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                              }}
                            >
                              Premium Partner
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <AssignmentOutlinedIcon sx={{ color: "white", opacity: 0.9, fontSize: 20 }} />
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

          {/* User Profile Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                border: `1px solid ${COLORS.border}`,
                overflow: "hidden",
              }}
            >
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={8}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 2 }}>
                      <Avatar
                        sx={{
                          width: 64,
                          height: 64,
                          bgcolor: `linear-gradient(135deg, ${COLORS.success}, ${COLORS.primary})`,
                          border: `3px solid ${COLORS.surface}`,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        }}
                      >
                        <AccountCircleOutlinedIcon sx={{ fontSize: 32, color: "white" }} />
                      </Avatar>
                      <Box>
                        <Typography
                          variant="h5"
                          sx={{
                            fontWeight: 700,
                            color: COLORS.text,
                            fontSize: { xs: "1.25rem", md: "1.5rem" },
                            mb: 0.5,
                          }}
                        >
                          Prakash J
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "text.secondary",
                            fontSize: "0.9rem",
                            fontWeight: 500,
                          }}
                        >
                          Franchise Partner
                        </Typography>
                      </Box>
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ p: 2, bgcolor: COLORS.background, borderRadius: 2 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                              display: "block",
                              mb: 0.5,
                            }}
                          >
                            Franchise Type
                          </Typography>
                          <Typography
                            variant="body1"
                            sx={{
                              fontWeight: 600,
                              color: COLORS.text,
                              fontSize: "0.95rem",
                            }}
                          >
                            Pincode (560073)
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ p: 2, bgcolor: COLORS.background, borderRadius: 2 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                              display: "block",
                              mb: 0.5,
                            }}
                          >
                            Status
                          </Typography>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                bgcolor: COLORS.success,
                              }}
                            />
                            <Typography
                              variant="body1"
                              sx={{
                                fontWeight: 600,
                                color: COLORS.text,
                                fontSize: "0.95rem",
                              }}
                            >
                              Active
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Box
                      sx={{
                        p: 3,
                        bgcolor: `linear-gradient(135deg, ${COLORS.success}15, ${COLORS.primary}10)`,
                        borderRadius: 3,
                        border: `1px solid ${COLORS.success}20`,
                        textAlign: "center",
                      }}
                    >
                      <TrendingUpOutlinedIcon
                        sx={{
                          fontSize: 48,
                          color: COLORS.success,
                          mb: 2,
                          opacity: 0.8,
                        }}
                      />
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          color: COLORS.success,
                          mb: 1,
                          fontSize: "1.1rem",
                        }}
                      >
                        Performance Score
                      </Typography>
                      <Typography
                        variant="h3"
                        sx={{
                          fontWeight: 800,
                          color: COLORS.success,
                          fontSize: "2rem",
                        }}
                      >
                        94%
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </motion.div>

          {/* Achievement Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card
              sx={{
                background: `linear-gradient(135deg, ${COLORS.success} 0%, ${COLORS.primary} 100%)`,
                borderRadius: 4,
                boxShadow: "0 8px 32px rgba(34, 197, 94, 0.3)",
                border: "none",
                overflow: "hidden",
              }}
            >
              <CardContent sx={{ p: { xs: 3, md: 4 }, textAlign: "center" }}>
                <TrendingUpOutlinedIcon
                  sx={{
                    fontSize: { xs: 48, md: 56 },
                    color: "white",
                    mb: 2,
                    opacity: 0.9,
                  }}
                />
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 800,
                    color: "white",
                    fontSize: { xs: "1.25rem", md: "1.75rem" },
                    mb: 1,
                  }}
                >
                  Turn every week into a revenue sprint
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: "rgba(255,255,255,0.9)",
                    fontSize: { xs: "0.9rem", md: "1rem" },
                    fontWeight: 500,
                  }}
                >
                  Maximize your performance and achieve your goals
                </Typography>
              </CardContent>
            </Card>
          </motion.div>

          {/* Franchise Achievers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: COLORS.text,
                      fontSize: { xs: "1.1rem", md: "1.25rem" },
                      mb: 0.5,
                    }}
                  >
                    Top Franchise Achievers
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.9rem",
                    }}
                  >
                    Celebrating our highest performing partners
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    gap: 2,
                    overflowX: "auto",
                    pb: 2,
                    px: 0.5,
                    mx: -0.5,
                    "&::-webkit-scrollbar": {
                      height: 8,
                    },
                    "&::-webkit-scrollbar-thumb": {
                      bgcolor: COLORS.primary,
                      borderRadius: 4,
                    },
                  }}
                >
                  {achievers.map((item) => (
                    <Box key={item.rank} sx={{ minWidth: 200, flexShrink: 0 }}>
                      <AchieverCard {...item} />
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </motion.div>

          {/* Pincode Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: COLORS.text,
                      fontSize: { xs: "1.1rem", md: "1.25rem" },
                      mb: 0.5,
                    }}
                  >
                    Pincode Overview
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.9rem",
                    }}
                  >
                    Geographic performance distribution
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    gap: 3,
                    overflowX: "auto",
                    pb: 2,
                    px: 0.5,
                    mx: -0.5,
                    "&::-webkit-scrollbar": {
                      height: 8,
                    },
                    "&::-webkit-scrollbar-thumb": {
                      bgcolor: COLORS.primary,
                      borderRadius: 4,
                    },
                  }}
                >
                  {pincodeMetrics.map((item, idx) => (
                    <Paper
                      key={idx}
                      sx={{
                        minWidth: 240,
                        borderRadius: 3,
                        p: 3,
                        textAlign: "center",
                        border: `1px solid ${COLORS.border}`,
                        flexShrink: 0,
                        transition: "all 0.3s ease",
                        "&:hover": {
                          transform: "translateY(-4px)",
                          boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
                          borderColor: COLORS.primary,
                        },
                        bgcolor: COLORS.surface,
                      }}
                    >
                      <Avatar
                        src={`https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?auto=format&fit=crop&w=120&q=60&sat=-100&blend=ffffff&bm=multiply`}
                        alt="Pincode"
                        sx={{
                          width: 64,
                          height: 64,
                          mx: "auto",
                          mb: 2,
                          border: `3px solid ${COLORS.primary}30`,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />
                      <MetricBox value={item.value} label={item.label} />
                    </Paper>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </motion.div>

          {/* Consumer & Franchise Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: COLORS.text,
                      fontSize: { xs: "1.1rem", md: "1.25rem" },
                      mb: 0.5,
                    }}
                  >
                    Consumer & Franchise Metrics
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.9rem",
                    }}
                  >
                    Key performance indicators and metrics overview
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    gap: 3,
                    overflowX: "auto",
                    pb: 2,
                    px: 0.5,
                    mx: -0.5,
                    "&::-webkit-scrollbar": {
                      height: 8,
                    },
                    "&::-webkit-scrollbar-thumb": {
                      bgcolor: COLORS.primary,
                      borderRadius: 4,
                    },
                  }}
                >
                  {consumerMetrics.map((item, idx) => (
                    <Paper
                      key={idx}
                      sx={{
                        minWidth: 300,
                        borderRadius: 3,
                        p: 3,
                        border: `1px solid ${COLORS.border}`,
                        flexShrink: 0,
                        transition: "all 0.3s ease",
                        "&:hover": {
                          transform: "translateY(-4px)",
                          boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
                          borderColor: COLORS.success,
                        },
                        bgcolor: COLORS.surface,
                      }}
                    >
                      <Stack direction="row" spacing={3} alignItems="center">
                        <Avatar
                          sx={{
                            bgcolor: `linear-gradient(135deg, ${COLORS.success}20, ${COLORS.primary}15)`,
                            color: COLORS.success,
                            flexShrink: 0,
                            width: 56,
                            height: 56,
                            border: `2px solid ${COLORS.success}30`,
                          }}
                        >
                          {item.icon}
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography
                            variant="h4"
                            sx={{
                              fontWeight: 800,
                              color: COLORS.success,
                              fontSize: { xs: "1.25rem", sm: "1.5rem" },
                              mb: 0.5,
                              lineHeight: 1.2,
                            }}
                          >
                            {item.value}
                          </Typography>
                          <Typography
                            variant="body1"
                            sx={{
                              color: "text.secondary",
                              fontSize: { xs: "0.85rem", sm: "0.9rem" },
                              fontWeight: 500,
                              textTransform: "capitalize",
                            }}
                          >
                            {item.label.toLowerCase()}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </motion.div>

          {/* Growth Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
          >
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: { xs: "wrap", sm: "nowrap" }, gap: 2 }}>
                  <Box>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        color: COLORS.text,
                        fontSize: { xs: "1.1rem", md: "1.25rem" },
                        mb: 0.5,
                      }}
                    >
                      Growth Preview
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary",
                        fontSize: "0.9rem",
                      }}
                    >
                      Track your performance trends over time
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                    {Object.keys(growthData).map((label) => (
                      <Button
                        key={label}
                        size="small"
                        variant={selectedTab === label ? "contained" : "outlined"}
                        onClick={() => setSelectedTab(label)}
                        sx={{
                          bgcolor: selectedTab === label ? COLORS.success : "transparent",
                          borderColor: COLORS.success,
                          color: selectedTab === label ? COLORS.surface : COLORS.success,
                          textTransform: "none",
                          fontSize: { xs: "0.75rem", sm: "0.85rem" },
                          fontWeight: 600,
                          px: 2,
                          py: 0.75,
                          borderRadius: 2,
                          "&:hover": {
                            bgcolor: selectedTab === label ? COLORS.success : `${COLORS.success}10`,
                            borderColor: COLORS.success,
                          },
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </Stack>
                </Box>

                <Paper
                  sx={{
                    borderRadius: 3,
                    p: { xs: 2, md: 3 },
                    bgcolor: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <GrowthBar data={selectedData} maxValue={maxDataValue} />
                </Paper>
              </CardContent>
            </Card>
          </motion.div>
        </Stack>
      </Container>
    </Box>
  );
}
