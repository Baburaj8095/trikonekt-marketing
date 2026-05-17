import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  IconButton,
  Stack,
  Typography,
  Button,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import WalletRoundedIcon from "@mui/icons-material/WalletRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import CurrencyRupeeRoundedIcon from "@mui/icons-material/CurrencyRupeeRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import PowerSettingsNewRoundedIcon from "@mui/icons-material/PowerSettingsNewRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import SyncAltRoundedIcon from "@mui/icons-material/SyncAltRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import { useLocation, useNavigate } from "react-router-dom";

const COLORS = {
  page: "#f7f9ff",
  surface: "#ffffff",
  text: "#16214a",
  muted: "#7a84a6",
  border: "#e3e8f6",
  green: "#15a37a",
  purple: "#7c3aed",
  blue: "#2b6de8",
  orange: "#fb6514",
};

const summaryStats = [
  {
    label: "Rewards",
    value: "\u20B9 2,55,500",
    icon: <AccountBalanceWalletRoundedIcon />,
    tint: "#e8f0ff",
    color: COLORS.blue,
  },
  // {
  //   label: "Last Updated",
  //   value: "Today, 10:30 AM",
  //   icon: <AccessTimeRoundedIcon />,
  //   tint: "#eef4ff",
  //   color: COLORS.blue,
  // },
];

const earningWallets = [
  {
    title: "Franchise Total Earnings",
    amount: "\u20B91,00,000",
    icon: <TrendingUpRoundedIcon sx={{ fontSize: 38 }} />,
    accent: COLORS.green,
    tint: "#dff5ec",
    badge: "All-Time",
    suffix: "(Includes Withdrawn)",
  },
  {
    title: "Self Birth Earnings",
    amount: "8,500 Pts",
    icon: <SavingsRoundedIcon sx={{ fontSize: 38 }} />,
    accent: COLORS.purple,
    tint: "#efe4ff",
    badge: "Locked",
    suffix: "Non-withdrawable",
  },
];

const workWallets = [
  {
    title: "Active work",
    amount: "18,750",
    icon: <BoltRoundedIcon sx={{ fontSize: 38 }} />,
    accent: COLORS.blue,
    tint: "#e6efff",
    badge: "85%",
    suffix: "of work targets",
  },
  {
    title: "In Active work",
    amount: "18,750",
    icon: <PowerSettingsNewRoundedIcon sx={{ fontSize: 38 }} />,
    accent: COLORS.orange,
    tint: "#ffede5",
    badge: "85%",
    suffix: "of work targets",
  },
];

const quickActions = [
  { label: "Transaction History", icon: <ReceiptLongRoundedIcon /> },
  { label: "Withdrawal History", icon: <FileDownloadRoundedIcon /> },
  { label: "Reports & Analytics", icon: <BarChartRoundedIcon /> },
];

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle, color }) {
  return (
    <Stack spacing={0.5} sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1.2} alignItems="center">
        <Box sx={{ color, display: "flex", alignItems: "center" }}>{icon}</Box>
        <Typography
          sx={{
            fontSize: { xs: "1rem", sm: "1.1rem", md: "1.35rem" },
            fontWeight: 800,
            color,
            lineHeight: 1.2,
          }}
        >
          {title}
        </Typography>
      </Stack>
      <Typography
        sx={{
          color: COLORS.muted,
          fontSize: { xs: "0.78rem", md: "0.9rem" },
          pl: 0.5,
        }}
      >
        {subtitle}
      </Typography>
    </Stack>
  );
}

// ─── Desktop Wallet Card ──────────────────────────────────────────────────────
function GroupWalletCard({ title, amount, icon, accent, tint, badge, suffix }) {
  return (
    <Card
      sx={{
        height: "100%",
        borderRadius: 3,
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 10px 30px rgba(22,33,74,0.05)",
        overflow: "hidden",
        position: "relative",
        "&:before": {
          content: '""',
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          bgcolor: accent,
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 1.5, md: 2.5 }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Stack
            direction="row"
            spacing={{ xs: 1.5, md: 2.2 }}
            alignItems="center"
            sx={{ minWidth: 0, flex: 1 }}
          >
            <Box
              sx={{
                width: { xs: 56, md: 78 },
                height: { xs: 56, md: 78 },
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                bgcolor: tint,
                color: accent,
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                sx={{
                  fontSize: { xs: "0.85rem", md: "1.12rem" },
                  fontWeight: 800,
                  color: COLORS.text,
                  mb: 0.3,
                  // Allow wrapping on small screens
                  whiteSpace: { xs: "normal", md: "nowrap" },
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {title}
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: "1.2rem", md: "1.9rem" },
                  fontWeight: 900,
                  color: accent,
                  lineHeight: 1.15,
                  mb: 0.6,
                }}
              >
                {amount}
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
              >
                <Chip
                  label={badge}
                  size="small"
                  sx={{
                    bgcolor: tint,
                    color: accent,
                    fontWeight: 800,
                    borderRadius: 2,
                    height: { xs: 20, md: 24 },
                    "& .MuiChip-label": {
                      px: 1,
                      fontSize: { xs: "0.68rem", md: "0.8rem" },
                    },
                  }}
                />
                {suffix && (
                  <Typography
                    sx={{
                      color: COLORS.muted,
                      fontWeight: 600,
                      fontSize: { xs: "0.74rem", md: "0.9rem" },
                    }}
                  >
                    {suffix}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>

          <Stack
            alignItems={{ xs: "stretch", sm: "flex-end" }}
            spacing={{ xs: 1, md: 2 }}
          >
            <IconButton
              sx={{
                color: COLORS.muted,
                alignSelf: { xs: "flex-end", sm: "auto" },
              }}
            >
              <MoreHorizRoundedIcon />
            </IconButton>
            <Button
              endIcon={<ArrowForwardRoundedIcon />}
              fullWidth
              sx={{
                borderRadius: 2,
                px: { xs: 1.25, md: 2.25 },
                py: { xs: 0.8, md: 1 },
                border: `1px solid ${COLORS.border}`,
                color: COLORS.muted,
                textTransform: "none",
                fontWeight: 700,
                bgcolor: "#fff",
                fontSize: { xs: "0.78rem", md: "0.92rem" },
                whiteSpace: "nowrap",
              }}
            >
              View Details
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ─── Desktop Bottom Panel ─────────────────────────────────────────────────────
function BottomWalletPanel({ icon, title, subtitle, children }) {
  return (
    <Card
      sx={{
        height: "100%",
        borderRadius: 3,
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 10px 30px rgba(22,33,74,0.05)",
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction="row"
          spacing={1.2}
          alignItems="center"
          sx={{ mb: 0.25 }}
        >
          <Box sx={{ color: COLORS.blue, display: "flex", alignItems: "center" }}>
            {icon}
          </Box>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: "0.9rem", md: "0.98rem" },
              color: COLORS.text,
            }}
          >
            {title}
          </Typography>
        </Stack>
        <Typography
          sx={{
            color: COLORS.muted,
            fontSize: { xs: "0.78rem", md: "0.86rem" },
            mb: 2.2,
          }}
        >
          {subtitle}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

// ─── Mobile Wallet Row Card ───────────────────────────────────────────────────
const MobileWalletRowCard = ({
  title,
  amount,
  icon,
  suffix,
  badge,
  tint,
  accent,
}) => {
  return (
    <Card
      sx={{
        borderRadius: 2.5,
        border: "1px solid #e6ebf5",
        boxShadow: "none",
      }}
    >
      <CardContent sx={{ py: 1.2, px: 1.5 }}>
        <Stack direction="row" spacing={1.2} alignItems="center">

          {/* ICON */}
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: tint,
              display: "grid",
              placeItems: "center",
              color: accent,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>

          {/* TEXT */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              fontSize="0.85rem"
              fontWeight={600}
              sx={{
                whiteSpace: "normal",
                wordBreak: "break-word",
                lineHeight: 1.2,
              }}
            >
              {title}
            </Typography>

            {suffix && (
              <Typography
                fontSize="0.72rem"
                color="text.secondary"
                sx={{ whiteSpace: "normal" }}
              >
                {suffix}
              </Typography>
            )}
          </Box>

          {/* RIGHT SIDE */}
          <Stack alignItems="flex-end" spacing={0.2}>
            <Typography fontWeight={700} fontSize="0.9rem">
              {amount}
            </Typography>

            {badge && (
              <Typography fontSize="0.7rem" color="text.secondary">
                {badge}
              </Typography>
            )}
          </Stack>

        </Stack>
      </CardContent>
    </Card>
  );
};
// ─── Main Component ───────────────────────────────────────────────────────────
export default function FranchiseWalletPlaceholder() {
  const navigate = useNavigate();
  const actionRoutes = {
  "Transaction History": "/agency/transactions",
  "Withdrawal History": "/agency/withdrawals",
};
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md")); // < 900px

  const backTarget = useMemo(
    () =>
      location.pathname.startsWith("/agency/")
        ? "/agency/franchise-dashboard"
        : "/agency/franchise-dashboard",
    [location.pathname]
  );

  // ── MOBILE LAYOUT ────────────────────────────────────────────────────────────
if (isMobile) {
  return (
  //  <Box sx={{ minHeight: "100dvh", bgcolor: "#f6f9fc" }}>
  <Box sx={{ bgcolor: "#f6f9fc",  paddingBottom: "80px" }}>
  <Container sx={{ px: 2, pt: 2 }}>
    <Stack spacing={2.2} sx={{ pb: 10 }}>

          {/* HEADER */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1.2} alignItems="center">
              <IconButton
                onClick={() => navigate(backTarget)}
                sx={{
                  bgcolor: "#eef2ff",
                  color: COLORS.text,
                  width: 36,
                  height: 36,
                }}
              >
                <ArrowBackRoundedIcon fontSize="small" />
              </IconButton>

              <Typography fontWeight={700} fontSize="1.1rem">
                Wallets
              </Typography>
            </Stack>

            <Avatar sx={{ width: 34, height: 34 }}>A</Avatar>
          </Stack>

          {/* SUMMARY */}
          <Card sx={{ borderRadius: 3, border: "1px solid #e6ebf5", boxShadow: "none" }}>
            <CardContent sx={{ py: 1.5 }}>
              <Stack spacing={1}>
                {summaryStats.map((item) => (
                  <Stack key={item.label} direction="row" justifyContent="space-between">
                    <Typography color="text.secondary">{item.label}</Typography>
                    <Typography fontWeight={600}>{item.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>

          {/* EARNINGS + WORK */}
          {[ 
            { title: "Earnings", data: earningWallets },
            { title: "Work", data: workWallets },
          ].map((section) => (
            <Stack key={section.title} spacing={1.2}>
              <Typography fontWeight={600} fontSize="0.9rem" color="text.secondary">
                {section.title}
              </Typography>

              <Stack spacing={1}>
                {section.data.map((wallet) => (
                  <MobileWalletRowCard key={wallet.title} {...wallet} />
                ))}
              </Stack>
            </Stack>
          ))}

          {/* OTHER WALLETS */}
          <Stack spacing={1.2}>
            <Typography fontWeight={600} fontSize="0.9rem" color="text.secondary">
              Other Wallets
            </Typography>

            <MobileWalletRowCard
              title="Main Wallet"
              amount="₹76,000"
              icon={<WalletRoundedIcon />}
              tint="#eef2ff"
              accent={COLORS.blue}
            />

            <MobileWalletRowCard
              title="Company Marketing"
              amount="34,500 Pts"
              icon={<CampaignRoundedIcon />}
              tint="#f5f3ff"
              accent={COLORS.purple}
            />
          </Stack>

          {/* QUICK ACTIONS */}
          <Stack spacing={1.2}>
            <Typography fontWeight={600} fontSize="0.9rem" color="text.secondary">
              Quick Actions
            </Typography>

            {quickActions.map((action) => (
              <Card
                key={action.label}
                onClick={() => {
                const route = actionRoutes[action.label];
                if (route) navigate(route);
                }}
                sx={{
                  borderRadius: 3,
                  border: "1px solid #e6ebf5",
                  boxShadow: "none",
                  cursor: "pointer",
                }}
              >
                <CardContent sx={{ py: 1.2 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Stack direction="row" spacing={1}>
                      {action.icon}
                      <Typography>{action.label}</Typography>
                    </Stack>
                    <ArrowForwardRoundedIcon fontSize="small" />
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>

        </Stack>
      </Container>
    </Box>
  );
}
  // ── DESKTOP LAYOUT ───────────────────────────────────────────────────────────
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.page, py: { xs: 2, md: 3 } }}>
      <Container maxWidth={false} sx={{ px: { xs: 2, md: 4 } }}>
        <Stack spacing={2.5}>
          <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }}>
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", lg: "row" },
                alignItems: { xs: "stretch", lg: "flex-start" },
                justifyContent: "space-between",
                gap: 2.5,
              }}
            >
              {/* Title + back */}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack
                  direction="row"
                  spacing={{ xs: 1.1, md: 1.5 }}
                  alignItems="flex-start"
                >
                  <IconButton
                    onClick={() => navigate(backTarget)}
                    sx={{
                      mt: 0.2,
                      width: 38,
                      height: 38,
                      color: "white",
                      bgcolor: COLORS.green,
                      "&:hover": { bgcolor: "#12886a" },
                    }}
                  >
                    <ArrowBackRoundedIcon />
                  </IconButton>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={{ xs: 0.8, md: 1.2 }}
                      alignItems="center"
                    >
                      <SavingsRoundedIcon
                        sx={{ color: COLORS.green, fontSize: { xs: 24, md: 30 } }}
                      />
                      <Typography
                        sx={{
                          fontSize: { xs: "1.45rem", md: "2.1rem" },
                          fontWeight: 900,
                          color: COLORS.text,
                          lineHeight: 1.1,
                        }}
                      >
                        All Wallets
                      </Typography>
                    </Stack>
                    <Typography
                      sx={{
                        mt: 0.65,
                        color: COLORS.muted,
                        fontSize: { xs: "0.8rem", md: "1rem" },
                      }}
                    >
                      Overview of all your wallets and earnings
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              {/* Summary stats card */}
              <Box
                sx={{
                  width: { xs: "100%", lg: "auto" },
                  ml: { xs: 0, lg: "auto" },
                  display: "flex",
                  justifyContent: { xs: "stretch", lg: "flex-end" },
                  alignSelf: { xs: "stretch", lg: "flex-start" },
                }}
              >
                <Card
                  sx={{
                    width: { xs: "100%", lg: "auto" },
                    borderRadius: 3,
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: "0 10px 30px rgba(22,33,74,0.04)",
                  }}
                >
                  <CardContent sx={{ p: { xs: 1.15, md: 2 } }}>
                    <Grid container justifyContent="flex-end">
                      {summaryStats.map((item, index) => (
                        <Grid item xs={12} sm={6} key={item.label}>
                          <Stack
                            direction="row"
                            spacing={{ xs: 0.9, md: 1.4 }}
                            alignItems="center"
                            sx={{
                              px: { xs: 0.6, md: 1.2 },
                              py: { xs: 0.7, md: 0.6 },
                              borderRight: {
                                sm:
                                  index !== summaryStats.length - 1
                                    ? `1px solid ${COLORS.border}`
                                    : "none",
                              },
                              borderBottom: {
                                xs:
                                  index !== summaryStats.length - 1
                                    ? `1px solid ${COLORS.border}`
                                    : "none",
                                sm: "none",
                              },
                            }}
                          >
                            <Box
                              sx={{
                                width: { xs: 38, md: 48 },
                                height: { xs: 38, md: 48 },
                                borderRadius: "50%",
                                display: "grid",
                                placeItems: "center",
                                bgcolor: item.tint,
                                color: item.color,
                                flexShrink: 0,
                              }}
                            >
                              {item.icon}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                sx={{
                                  color: COLORS.muted,
                                  fontWeight: 600,
                                  fontSize: { xs: "0.74rem", md: "0.86rem" },
                                }}
                              >
                                {item.label}
                              </Typography>
                              <Typography
                                sx={{
                                  color: COLORS.text,
                                  fontWeight: 900,
                                  fontSize: { xs: "0.84rem", md: "1.1rem" },
                                }}
                              >
                                {item.value}
                              </Typography>
                            </Box>
                          </Stack>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </motion.div>

          {/* Earnings + Work Wallets */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <Card
              sx={{
                borderRadius: 3,
                border: `1px solid ${COLORS.border}`,
                boxShadow: "0 10px 30px rgba(22,33,74,0.04)",
              }}
            >
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ p: { xs: 2, md: 2.75 } }}>
                  <SectionHeader
                    icon={<SavingsRoundedIcon sx={{ fontSize: 28 }} />}
                    title="Earnings Wallets"
                    subtitle="Track all your earning related wallets"
                    color={COLORS.green}
                  />
                  <Grid container spacing={2.5}>
                    {earningWallets.map((wallet) => (
                      <Grid item xs={12} md={6} key={wallet.title}>
                        <GroupWalletCard {...wallet} />
                      </Grid>
                    ))}
                  </Grid>
                </Box>

                <Divider />

                <Box sx={{ p: { xs: 2, md: 2.75 } }}>
                  <SectionHeader
                    icon={<WorkRoundedIcon sx={{ fontSize: 28 }} />}
                    title="Work Wallets"
                    subtitle="Manage your work status wallets"
                    color={COLORS.blue}
                  />
                  <Grid container spacing={2.5}>
                    {workWallets.map((wallet) => (
                      <Grid item xs={12} md={6} key={wallet.title}>
                        <GroupWalletCard {...wallet} />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              </CardContent>
            </Card>
          </motion.div>

          {/* Bottom panels */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
          >
            <Grid container spacing={{ xs: 1.5, md: 2.5 }}>
              {/* Main Wallet */}
              <Grid item xs={12} lg={4}>
                <BottomWalletPanel
                  icon={<WalletRoundedIcon />}
                  title="Main Wallet"
                  subtitle="Primary wallet for all transactions"
                >
                  <Card
                    sx={{
                      borderRadius: 3,
                      border: `1px solid #d5e3ff`,
                      bgcolor: "#eef4ff",
                      boxShadow: "none",
                    }}
                  >
                    <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                      <Stack spacing={2}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                          alignItems={{ xs: "stretch", sm: "flex-start" }}
                          spacing={{ xs: 1.2, sm: 0 }}
                        >
                          <Stack
                            direction="row"
                            spacing={{ xs: 1.2, md: 1.6 }}
                            alignItems="center"
                          >
                            <Box
                              sx={{
                                width: { xs: 58, md: 72 },
                                height: { xs: 58, md: 72 },
                                borderRadius: "50%",
                                display: "grid",
                                placeItems: "center",
                                bgcolor: "#dbe7ff",
                                color: COLORS.blue,
                                alignSelf: "flex-start",
                                flexShrink: 0,
                              }}
                            >
                              <WalletRoundedIcon
                                sx={{ fontSize: { xs: 26, md: 34 } }}
                              />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                sx={{ mb: 0.65 }}
                                flexWrap="wrap"
                                useFlexGap
                              >
                                <Typography
                                  sx={{
                                    fontWeight: 800,
                                    fontSize: { xs: "0.92rem", md: "1.02rem" },
                                    color: COLORS.text,
                                  }}
                                >
                                  Main Wallet
                                </Typography>
                                <Chip
                                  label="Primary"
                                  size="small"
                                  sx={{
                                    bgcolor: "#dbeafe",
                                    color: COLORS.blue,
                                    fontWeight: 800,
                                  }}
                                />
                              </Stack>
                              <Typography
                                sx={{
                                  fontSize: { xs: "1.45rem", md: "1.8rem" },
                                  fontWeight: 900,
                                  color: COLORS.blue,
                                  lineHeight: 1.1,
                                }}
                              >
                                {"\u20B976,000"}
                              </Typography>
                              <Stack
                                direction="row"
                                spacing={0.8}
                                alignItems="center"
                                sx={{ mt: 1 }}
                              >
                                <TrendingUpRoundedIcon
                                  sx={{ fontSize: 18, color: COLORS.green }}
                                />
                                <Typography
                                  sx={{
                                    color: COLORS.green,
                                    fontWeight: 800,
                                    fontSize: { xs: "0.8rem", md: "0.9rem" },
                                  }}
                                >
                                  +10.3%
                                </Typography>
                                <Typography
                                  sx={{
                                    color: COLORS.muted,
                                    fontWeight: 600,
                                    fontSize: { xs: "0.8rem", md: "0.9rem" },
                                  }}
                                >
                                  this month
                                </Typography>
                              </Stack>
                            </Box>
                          </Stack>
                          <IconButton
                            sx={{
                              color: COLORS.muted,
                              alignSelf: { xs: "flex-end", sm: "auto" },
                            }}
                          >
                            <MoreHorizRoundedIcon />
                          </IconButton>
                        </Stack>

                        <Grid container spacing={1.2}>
                          <Grid item xs={12} sm={6}>
                            <Button
                              fullWidth
                              startIcon={<WalletRoundedIcon />}
                              sx={{
                                py: { xs: 0.95, md: 1.2 },
                                borderRadius: 2,
                                bgcolor: COLORS.blue,
                                color: "white",
                                textTransform: "none",
                                fontWeight: 800,
                                fontSize: { xs: "0.8rem", md: "0.92rem" },
                                "&:hover": { bgcolor: "#1f5ad2" },
                              }}
                            >
                              Withdraw Now
                            </Button>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Button
                              fullWidth
                              startIcon={<ArrowForwardRoundedIcon />}
                              sx={{
                                py: { xs: 0.95, md: 1.2 },
                                borderRadius: 2,
                                border: `1px solid #cfd8ee`,
                                color: COLORS.muted,
                                textTransform: "none",
                                fontWeight: 800,
                                bgcolor: "#fff",
                                fontSize: { xs: "0.8rem", md: "0.92rem" },
                              }}
                            >
                              View Details
                            </Button>
                          </Grid>
                        </Grid>
                      </Stack>
                    </CardContent>
                  </Card>
                </BottomWalletPanel>
              </Grid>

              {/* Company Marketing */}
              <Grid item xs={12} lg={4}>
                <BottomWalletPanel
                  icon={<CampaignRoundedIcon sx={{ color: COLORS.purple }} />}
                  title="Company Marketing"
                  subtitle="Non-withdrawable marketing points"
                >
                  <Card
                    sx={{
                      borderRadius: 3,
                      border: `1px solid #e8d8ff`,
                      bgcolor: "#f7f1ff",
                      boxShadow: "none",
                    }}
                  >
                    <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                      <Stack spacing={2}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                          alignItems={{ xs: "stretch", sm: "flex-start" }}
                          spacing={{ xs: 1.2, sm: 0 }}
                        >
                          <Stack
                            direction="row"
                            spacing={{ xs: 1.2, md: 1.6 }}
                            alignItems="center"
                          >
                            <Box
                              sx={{
                                width: { xs: 58, md: 72 },
                                height: { xs: 58, md: 72 },
                                borderRadius: "50%",
                                display: "grid",
                                placeItems: "center",
                                bgcolor: "#efe2ff",
                                color: COLORS.purple,
                                alignSelf: "flex-start",
                                flexShrink: 0,
                              }}
                            >
                              <CampaignRoundedIcon
                                sx={{ fontSize: { xs: 26, md: 34 } }}
                              />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                sx={{
                                  fontWeight: 800,
                                  fontSize: { xs: "0.92rem", md: "1.02rem" },
                                  color: COLORS.text,
                                  mb: 0.65,
                                }}
                              >
                                Company Marketing
                              </Typography>
                              <Typography
                                sx={{
                                  fontSize: { xs: "1.45rem", md: "1.8rem" },
                                  fontWeight: 900,
                                  color: COLORS.purple,
                                  lineHeight: 1.1,
                                }}
                              >
                                {"34,500 Pts"}
                              </Typography>
                              <Stack
                                direction="row"
                                spacing={0.8}
                                alignItems="center"
                                sx={{ mt: 1 }}
                              >
                                <TrendingUpRoundedIcon
                                  sx={{ fontSize: 18, color: COLORS.green }}
                                />
                                <Typography
                                  sx={{
                                    color: COLORS.green,
                                    fontWeight: 800,
                                    fontSize: { xs: "0.8rem", md: "0.9rem" },
                                  }}
                                >
                                  +6.7%
                                </Typography>
                                <Typography
                                  sx={{
                                    color: COLORS.muted,
                                    fontWeight: 600,
                                    fontSize: { xs: "0.8rem", md: "0.9rem" },
                                  }}
                                >
                                  this month
                                </Typography>
                              </Stack>
                            </Box>
                          </Stack>
                          <IconButton
                            sx={{
                              color: COLORS.muted,
                              alignSelf: { xs: "flex-end", sm: "auto" },
                            }}
                          >
                            <MoreHorizRoundedIcon />
                          </IconButton>
                        </Stack>

                        <Grid container spacing={1.2}>
                          <Grid item xs={12} sm={6}>
                            <Button
                              fullWidth
                              startIcon={<ArrowForwardRoundedIcon />}
                              sx={{
                                py: { xs: 0.95, md: 1.2 },
                                borderRadius: 2,
                                bgcolor: "#efe2ff",
                                border: `1px solid #cfaefb`,
                                color: COLORS.purple,
                                textTransform: "none",
                                fontWeight: 800,
                                fontSize: { xs: "0.8rem", md: "0.92rem" },
                              }}
                            >
                              View Details
                            </Button>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Button
                              fullWidth
                              startIcon={<AccessTimeRoundedIcon />}
                              sx={{
                                py: { xs: 0.95, md: 1.2 },
                                borderRadius: 2,
                                border: `1px solid #cfd8ee`,
                                color: COLORS.muted,
                                textTransform: "none",
                                fontWeight: 800,
                                bgcolor: "#fff",
                                fontSize: { xs: "0.8rem", md: "0.92rem" },
                              }}
                            >
                              History
                            </Button>
                          </Grid>
                        </Grid>
                      </Stack>
                    </CardContent>
                  </Card>
                </BottomWalletPanel>
              </Grid>

              {/* Quick Actions */}
              <Grid item xs={12} lg={4}>
                <BottomWalletPanel
                  icon={<BoltRoundedIcon sx={{ color: COLORS.purple }} />}
                  title="Quick Actions"
                  subtitle="Common wallet actions"
                >
                  <Stack spacing={1.4}>
                    {quickActions.map((action) => (
                      <Card
                        key={action.label}
                        sx={{
                          borderRadius: 2,
                          border: `1px solid ${COLORS.border}`,
                          boxShadow: "none",
                        }}
                      >
                        <CardContent sx={{ p: { xs: 1.2, md: 1.5 } }}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            spacing={1}
                          >
                            <Stack
                              direction="row"
                              spacing={{ xs: 1, md: 1.5 }}
                              alignItems="center"
                              sx={{ minWidth: 0 }}
                            >
                              <Box
                                sx={{
                                  width: { xs: 32, md: 36 },
                                  height: { xs: 32, md: 36 },
                                  borderRadius: 1.6,
                                  display: "grid",
                                  placeItems: "center",
                                  bgcolor: "#f4f6ff",
                                  color: COLORS.blue,
                                  flexShrink: 0,
                                }}
                              >
                                {action.icon}
                              </Box>
                              <Typography
                                sx={{
                                  fontWeight: 700,
                                  color: COLORS.text,
                                  fontSize: { xs: "0.84rem", md: "0.95rem" },
                                }}
                              >
                                {action.label}
                              </Typography>
                            </Stack>
                            <ArrowForwardRoundedIcon
                              sx={{ color: COLORS.muted, fontSize: 18, flexShrink: 0 }}
                            />
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </BottomWalletPanel>
              </Grid>
            </Grid>
          </motion.div>
        </Stack>
      </Container>
    </Box>
  );
}
