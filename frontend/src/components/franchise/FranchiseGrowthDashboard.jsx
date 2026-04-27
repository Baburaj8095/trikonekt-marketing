import React, { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
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
} from "@mui/material";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";
import FranchiseShell from "../../components/franchise/FranchiseShell";

const achievers = [
  {
    name: "Priya Sharma",
    role: "Top Franchise Leader",
    value: "₹72.4K",
    caption: "Best weekly earnings",
  },
  {
    name: "Amit Verma",
    role: "Growth Champion",
    value: "+18%",
    caption: "Month-over-month expansion",
  },
  {
    name: "Sneha Reddy",
    role: "Regional Coordinator",
    value: "422 members",
    caption: "New recruits this month",
  },
];

const pincodeOverview = [
  { title: "North Zone", value: "3,200", description: "Active customers" },
  { title: "East Zone", value: "1,860", description: "Live pincode reach" },
  { title: "South Zone", value: "2,740", description: "New agent registrations" },
];

const consumerMetrics = [
  { title: "New commissions", value: "1,280", caption: "Today" },
  { title: "Pending approvals", value: "62", caption: "Needs review" },
  { title: "Purchase calls", value: "1,102", caption: "Last 24 hours" },
];

const tabData = {
  Daily: [
    { name: "Mon", value: 420, change: 12 },
    { name: "Tue", value: 510, change: 8 },
    { name: "Wed", value: 470, change: -6 },
    { name: "Thu", value: 560, change: 18 },
    { name: "Fri", value: 620, change: 11 },
    { name: "Sat", value: 710, change: 14 },
    { name: "Sun", value: 760, change: 7 },
  ],
  Monthly: [
    { name: "Jan", value: 5.2, change: 9 },
    { name: "Feb", value: 6.1, change: 17 },
    { name: "Mar", value: 5.8, change: -5 },
    { name: "Apr", value: 6.3, change: 8 },
    { name: "May", value: 6.8, change: 7 },
  ],
  Yearly: [
    { name: "2022", value: 62, change: 14 },
    { name: "2023", value: 71, change: 15 },
    { name: "2024", value: 84, change: 18 },
  ],
};

function StatCard({ title, value, label, icon }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider", minHeight: 140 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.9 }}>
              {title}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: 1 }}>
              {value}
            </Typography>
          </Box>
          <Avatar sx={{ bgcolor: "primary.light", color: "primary.main", width: 48, height: 48 }}>
            {icon}
          </Avatar>
        </Stack>
        {label ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {label}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

function GrowthBar({ data, maxValue }) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-end" justifyContent="space-between" sx={{ minHeight: 220 }}>
      {data.map((item) => (
        <Box key={item.name} sx={{ width: "100%", textAlign: "center" }}>
          <Box
            sx={{
              height: `${Math.max(20, (item.value / maxValue) * 100)}%`,
              bgcolor: "primary.main",
              borderRadius: 3,
              transition: "height 0.3s ease",
              mb: 1,
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {item.name}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

export default function FranchiseGrowthDashboard() {
  const [selectedTab, setSelectedTab] = useState("Daily");

  const selectedSeries = tabData[selectedTab];
  const maxSeriesValue = useMemo(
    () => Math.max(...selectedSeries.map((item) => item.value), 1),
    [selectedSeries]
  );

  return (
    <FranchiseShell>
      <Container maxWidth="xl" sx={{ py: 4, minHeight: "100vh" }}>
        <Stack spacing={4}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems="center" spacing={2}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
                  Franchise Growth Dashboard
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 720 }}>
                  Monitor franchise performance, regional reach, consumer engagement, and commission health in one unified panel.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button variant="outlined" size="medium" component={RouterLink} to="/user/franchise-settings">
                  Franchise Settings
                </Button>
                <Button variant="contained" size="medium">
                  Create Campaign
                </Button>
              </Stack>
            </Stack>
          </motion.div>

          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card sx={{ borderRadius: 3, overflow: "hidden", position: "relative", bgcolor: "primary.dark", color: "common.white" }}>
                <Box sx={{ p: 3, background: "linear-gradient(135deg, rgba(79,70,229,0.95), rgba(59,130,246,0.92))" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                    <Box>
                      <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.72)", letterSpacing: 1.2 }}>
                        Franchise Profile
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, mt: 2 }}>
                        North Star Group
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: "rgba(255,255,255,0.18)", width: 56, height: 56 }}>
                      <PersonOutlineIcon sx={{ color: "common.white" }} />
                    </Avatar>
                  </Stack>
                </Box>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      842 active users, 18 team members, 42 locations managed.
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
                      <Chip label="Top 5% performer" color="info" size="small" />
                      <Chip label="Renewal due" color="warning" size="small" />
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            {[
              { title: "Active Members", value: "1,248", label: "Current network size", icon: <PeopleOutlineIcon /> },
              { title: "Monthly Sales", value: "₹12.6L", label: "+14% vs last month", icon: <MonetizationOnOutlinedIcon /> },
              { title: "Pending Commissions", value: "₹3.2L", label: "8 payouts pending", icon: <BoltOutlinedIcon /> },
            ].map((item) => (
              <Grid item xs={12} md={4} key={item.title}>
                <StatCard {...item} />
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} lg={8}>
              <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider" }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" spacing={2}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
                        Growth Preview
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, mt: 1 }}>
                        {selectedTab} revenue activity
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      {Object.keys(tabData).map((label) => (
                        <Button
                          key={label}
                          size="small"
                          variant={selectedTab === label ? "contained" : "outlined"}
                          onClick={() => setSelectedTab(label)}
                        >
                          {label}
                        </Button>
                      ))}
                    </Stack>
                  </Stack>

                  <Box sx={{ my: 3, px: 1 }}>
                    <GrowthBar data={selectedSeries} maxValue={maxSeriesValue} />
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: "grey.50" }}>
                        <CardContent>
                          <Typography variant="subtitle2" color="text.secondary">
                            Highest performing region
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 800, mt: 1 }}>
                            South Zone
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: "grey.50" }}>
                        <CardContent>
                          <Typography variant="subtitle2" color="text.secondary">
                            New memberships
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 800, mt: 1 }}>
                            128
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: "grey.50" }}>
                        <CardContent>
                          <Typography variant="subtitle2" color="text.secondary">
                            Strategic alerts
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                            <Chip label="Review sales plan" color="warning" size="small" />
                            <Chip label="Support backlog" color="info" size="small" />
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider" }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
                        Quick actions
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, mt: 1 }}>
                        Fast operations
                      </Typography>
                    </Box>
                    <NotificationsOutlinedIcon color="action" />
                  </Stack>
                  <Stack spacing={1}>
                    <Button fullWidth variant="outlined" component={RouterLink} to="/user/franchise-orders">
                      Review franchise orders
                    </Button>
                    <Button fullWidth variant="outlined" component={RouterLink} to="/user/franchise-users">
                      Manage users & teams
                    </Button>
                    <Button fullWidth variant="outlined" component={RouterLink} to="/user/franchise-support">
                      Create support ticket
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider" }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
                    Pincode overview
                  </Typography>
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    {pincodeOverview.map((item) => (
                      <Grid key={item.title} item xs={12} sm={4}>
                        <Box sx={{ p: 2, borderRadius: 3, border: 1, borderColor: "divider" }}>
                          <Typography variant="subtitle2" color="text.secondary">
                            {item.title}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, mt: 1 }}>
                            {item.value}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {item.description}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider" }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
                    Consumer metrics
                  </Typography>
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    {consumerMetrics.map((item) => (
                      <Grid key={item.title} item xs={12} sm={4}>
                        <Box sx={{ p: 2, borderRadius: 3, border: 1, borderColor: "divider" }}>
                          <Typography variant="subtitle2" color="text.secondary">
                            {item.title}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, mt: 1 }}>
                            {item.value}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {item.caption}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            {achievers.map((item) => (
              <Grid key={item.name} item xs={12} md={4}>
                <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider" }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Avatar sx={{ bgcolor: "primary.light", color: "primary.main" }}>
                        <TrendingUpOutlinedIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          {item.role}
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.5 }}>
                          {item.name}
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography variant="h5" sx={{ fontWeight: 800, mt: 3 }}>
                      {item.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {item.caption}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </Container>
    </FranchiseShell>
  );
}
