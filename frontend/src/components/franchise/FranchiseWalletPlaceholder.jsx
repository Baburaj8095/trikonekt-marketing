import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
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
  IconButton,
  Stack,
  Typography,
  Button,
  LinearProgress,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import API from "../../api/api";
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
function GroupWalletCard({ title, amount, icon, accent, tint, badge, suffix, source, payEnabled, payDisabledReason, onPay, paying }) {
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
              endIcon={source ? null : <ArrowForwardRoundedIcon />}
              fullWidth
              disabled={source ? (!payEnabled || paying) : false}
              onClick={() => source && onPay?.(source)}
              title={source && !payEnabled ? payDisabledReason : undefined}
              sx={{
                borderRadius: 2,
                px: { xs: 1.25, md: 2.25 },
                py: { xs: 0.8, md: 1 },
                border: `1px solid ${COLORS.border}`,
                color: source && payEnabled ? "#fff" : COLORS.muted,
                textTransform: "none",
                fontWeight: 700,
                bgcolor: source && payEnabled ? accent : "#fff",
                fontSize: { xs: "0.78rem", md: "0.92rem" },
                whiteSpace: "nowrap",
                "&:hover": { bgcolor: source && payEnabled ? accent : "#fff" },
              }}
            >
              {source ? (paying ? "Paying..." : "Pay") : "View Details"}
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
  source,
  payEnabled,
  payDisabledReason,
  onPay,
  paying,
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
            {source ? (
              <Button
                size="small"
                disabled={!payEnabled || paying}
                onClick={() => onPay?.(source)}
                title={!payEnabled ? payDisabledReason : undefined}
                sx={{
                  mt: 0.4,
                  minWidth: 58,
                  borderRadius: 2,
                  px: 1,
                  py: 0.25,
                  bgcolor: payEnabled ? accent : "#eef2f7",
                  color: payEnabled ? "#fff" : COLORS.muted,
                  textTransform: "none",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  "&:hover": { bgcolor: payEnabled ? accent : "#eef2f7" },
                }}
              >
                {paying ? "..." : "Pay"}
              </Button>
            ) : null}
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
  const [walletInfo, setWalletInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [payingSource, setPayingSource] = useState("");

  const backTarget = useMemo(
    () =>
      location.pathname.startsWith("/agency/")
        ? "/agency/franchise-dashboard"
        : "/agency/franchise-dashboard",
    [location.pathname]
  );

  const loadWallet = async () => {
    try {
      setErr("");
      setLoading(true);
      const res = await API.get("/accounts/franchise/wallet/me/", { dedupe: "cancelPrevious" });
      setWalletInfo(res?.data || null);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load franchise wallet.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, []);

  const money = (value) => `\u20B9${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const wallets = walletInfo?.wallets || {};
  const displaySummaryStats = [
    {
      label: "Withdrawal Wallet",
      value: money(wallets?.withdrawal?.amount),
      icon: <AccountBalanceWalletRoundedIcon />,
      tint: "#e8f0ff",
      color: COLORS.blue,
    },
  ];
  const displayEarningWallets = [
    {
      title: "Total Earning Wallet",
      amount: money(wallets?.total_earning?.amount),
      icon: <TrendingUpRoundedIcon sx={{ fontSize: 38 }} />,
      accent: COLORS.green,
      tint: "#dff5ec",
      badge: "All-Time",
      suffix: "Total franchise earnings",
    },
    {
      title: "Franchise Self Rebirth",
      amount: money(wallets?.self_rebirth?.amount),
      icon: <SavingsRoundedIcon sx={{ fontSize: 38 }} />,
      accent: COLORS.purple,
      tint: "#efe4ff",
      badge: "25%",
      suffix: "Non-withdrawable bucket",
    },
    {
      title: "Franchise Reward Point",
      amount: money(wallets?.reward_points?.amount),
      icon: <AccountBalanceWalletRoundedIcon sx={{ fontSize: 38 }} />,
      accent: COLORS.green,
      tint: "#dff5ec",
      badge: `Min ${money(wallets?.reward_points?.minimum_transfer || 1000)}`,
      suffix: "Admin credited reward",
      source: "reward_points",
      payEnabled: !!wallets?.reward_points?.pay_enabled,
      payDisabledReason: "Reward transfer opens after reaching the minimum reward balance.",
    },
    {
      title: "Shopping Scanner Wallet",
      amount: money(wallets?.shopping_scanner?.amount),
      icon: <SwapHorizRoundedIcon sx={{ fontSize: 38 }} />,
      accent: COLORS.orange,
      tint: "#ffede5",
      badge: "0",
      suffix: "Reserved for scanner flow",
    },
  ];
  const displayWorkWallets = [
    {
      title: "Active Work Wallet",
      amount: money(wallets?.active_work?.amount),
      icon: <BoltRoundedIcon sx={{ fontSize: 38 }} />,
      accent: COLORS.blue,
      tint: "#e6efff",
      badge: "18.75%",
      suffix: "Pay enabled after admin approval",
      source: "active_work",
      payEnabled: !!wallets?.active_work?.pay_enabled,
      payDisabledReason: "Admin must approve this month's work report first.",
    },
    {
      title: "Inactive Work Wallet",
      amount: money(wallets?.inactive_work?.amount),
      icon: <PowerSettingsNewRoundedIcon sx={{ fontSize: 38 }} />,
      accent: COLORS.orange,
      tint: "#ffede5",
      badge: "18.75%",
      suffix: `Pay day ${walletInfo?.settings?.inactive_work_day || 30}`,
      source: "inactive_work",
      payEnabled: !!wallets?.inactive_work?.pay_enabled,
      payDisabledReason: "Inactive work transfer is available only in the admin-configured window.",
    },
  ];
  const displayOtherWallets = [
    {
      title: "Withdrawal Wallet",
      amount: money(wallets?.withdrawal?.amount),
      icon: <WalletRoundedIcon />,
      tint: "#eef2ff",
      accent: COLORS.blue,
    },
    {
      title: "Company Marketing Wallet",
      amount: money(wallets?.company_marketing?.amount),
      icon: <CampaignRoundedIcon />,
      tint: "#f5f3ff",
      accent: COLORS.purple,
      badge: "37.5%",
      suffix: "Company marketing allocation",
    },
  ];

  const handlePay = async (source) => {
    const sourceWallet = [...displayEarningWallets, ...displayWorkWallets].find((w) => w.source === source);
    const rawAmount = source === "active_work"
      ? wallets?.active_work?.amount
      : source === "inactive_work"
        ? wallets?.inactive_work?.amount
        : wallets?.reward_points?.amount;
    try {
      setErr("");
      setPayingSource(source);
      await API.post("/accounts/franchise/wallet/transfer-to-withdrawal/", { source, amount: rawAmount });
      await loadWallet();
    } catch (e) {
      setErr(e?.response?.data?.detail || `Failed to transfer ${sourceWallet?.title || "wallet"} to withdrawal wallet.`);
    } finally {
      setPayingSource("");
    }
  };

  // ── MOBILE LAYOUT ────────────────────────────────────────────────────────────
if (isMobile) {
  const featuredWallet = {
    title: "Withdrawal Wallet",
    amount: money(wallets?.withdrawal?.amount),
    subtitle: "Transfer approved pockets here",
    icon: <WalletRoundedIcon sx={{ fontSize: 30 }} />,
  };
  const walletTiles = [
    ...displayEarningWallets,
    ...displayWorkWallets,
    ...displayOtherWallets.filter((wallet) => wallet.title !== "Withdrawal Wallet"),
  ];

  return (
    <Box sx={{ bgcolor: "#f4f7fb", minHeight: "100dvh", pb: "calc(92px + env(safe-area-inset-bottom))" }}>
      <Container sx={{ px: 2, pt: 2.5 }}>
        <Stack spacing={2.2} sx={{ pb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1.4} alignItems="center">
              <Box sx={{ width: 58, height: 58, borderRadius: 3, display: "grid", placeItems: "center", bgcolor: "#eaf2ff", color: "#2563eb" }}>
                <WalletRoundedIcon sx={{ fontSize: 30 }} />
              </Box>
              <Box>
                <Typography sx={{ color: "#030712", fontWeight: 950, fontSize: "1.85rem", lineHeight: 1.05 }}>
                  Franchise Wallet
                </Typography>
                <Typography sx={{ color: "#64748b", fontWeight: 700, fontSize: "0.82rem" }}>
                  Growth Wallet
                </Typography>
              </Box>
            </Stack>
            <Chip
              label="KYC Pending"
              sx={{
                bgcolor: "#f59e0b",
                color: "#111827",
                fontWeight: 950,
                borderRadius: 999,
                height: 42,
                px: 1.2,
                "& .MuiChip-label": { px: 1.1, fontSize: "0.88rem" },
              }}
            />
          </Stack>

          {err ? <Alert severity="error">{err}</Alert> : null}
          {loading ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}

          <Card
            sx={{
              borderRadius: 4,
              border: "1px solid #dbe4f0",
              bgcolor: "rgba(255,255,255,0.96)",
              boxShadow: "0 18px 44px rgba(15,23,42,0.08)",
              overflow: "hidden",
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Stack spacing={1.8}>
                <Stack direction="row" spacing={1.1} alignItems="center">
                  <WalletRoundedIcon sx={{ color: "#64748b" }} />
                  <Typography sx={{ color: "#334155", fontWeight: 950, fontSize: "1rem" }}>
                    Growth Wallet
                  </Typography>
                </Stack>

                <Box
                  sx={{
                    borderRadius: 3,
                    p: 2,
                    minHeight: 164,
                    color: "#fff",
                    background: "linear-gradient(135deg, #2563eb 0%, #1d75b9 48%, #0f766e 100%)",
                    boxShadow: "0 16px 34px rgba(37,99,235,0.22)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <Stack direction="row" spacing={1.2} alignItems="center">
                    <Box sx={{ width: 58, height: 58, borderRadius: 3, display: "grid", placeItems: "center", bgcolor: "rgba(255,255,255,0.18)" }}>
                      {featuredWallet.icon}
                    </Box>
                    <Typography sx={{ fontSize: "1.08rem", fontWeight: 950 }}>
                      {featuredWallet.title}
                    </Typography>
                  </Stack>
                  <Box>
                    <Typography sx={{ fontSize: "2.25rem", fontWeight: 950, lineHeight: 1 }}>
                      {featuredWallet.amount}
                    </Typography>
                    <Typography sx={{ mt: 0.7, fontSize: "0.9rem", opacity: 0.9, fontWeight: 700 }}>
                      {featuredWallet.subtitle}
                    </Typography>
                  </Box>
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 1.25,
                    alignItems: "stretch",
                  }}
                >
                  {walletTiles.map((wallet) => (
                    <Box key={wallet.title} sx={{ minWidth: 0 }}>
                      <Card
                        sx={{
                          height: "100%",
                          minHeight: 158,
                          borderRadius: 3,
                          border: "1px solid #dfe7f2",
                          boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
                          bgcolor: "#fff",
                          overflow: "hidden",
                          width: "100%",
                        }}
                      >
                        <CardContent sx={{ p: 1.25, height: "100%" }}>
                          <Stack spacing={0.9} sx={{ height: "100%", minWidth: 0 }}>
                            <Stack spacing={0.8} sx={{ minWidth: 0 }}>
                              <Box
                                sx={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 2.2,
                                  display: "grid",
                                  placeItems: "center",
                                  bgcolor: wallet.tint,
                                  color: wallet.accent,
                                  flexShrink: 0,
                                  "& svg": { fontSize: 22 },
                                }}
                              >
                                {wallet.icon}
                              </Box>
                              <Typography
                                sx={{
                                  color: "#64748b",
                                  fontWeight: 950,
                                  fontSize: "0.73rem",
                                  lineHeight: 1.18,
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                  overflowWrap: "anywhere",
                                }}
                              >
                                {wallet.title}
                              </Typography>
                            </Stack>

                            <Box sx={{ mt: "auto" }}>
                              <Typography
                                sx={{
                                  color: wallet.accent,
                                  fontWeight: 950,
                                  fontSize: "1rem",
                                  lineHeight: 1.05,
                                  wordBreak: "break-word",
                                }}
                              >
                                {wallet.amount}
                              </Typography>
                              {wallet.suffix ? (
                                <Typography
                                  sx={{
                                    mt: 0.45,
                                    color: "#64748b",
                                    fontWeight: 650,
                                    fontSize: "0.68rem",
                                    lineHeight: 1.22,
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  {wallet.suffix}
                                </Typography>
                              ) : null}
                            </Box>

                            {wallet.source ? (
                              <Button
                                size="small"
                                disabled={!wallet.payEnabled || payingSource === wallet.source}
                                onClick={() => handlePay(wallet.source)}
                                title={!wallet.payEnabled ? wallet.payDisabledReason : undefined}
                                sx={{
                                  alignSelf: "flex-start",
                                  minWidth: 58,
                                  borderRadius: 999,
                                  px: 1.2,
                                  py: 0.45,
                                  bgcolor: wallet.payEnabled ? wallet.accent : "#eef2f7",
                                  color: wallet.payEnabled ? "#fff" : "#64748b",
                                  textTransform: "none",
                                  fontWeight: 950,
                                  fontSize: "0.7rem",
                                  "&:hover": { bgcolor: wallet.payEnabled ? wallet.accent : "#eef2f7" },
                                }}
                              >
                                {payingSource === wallet.source ? "..." : "Pay"}
                              </Button>
                            ) : null}
                          </Stack>
                        </CardContent>
                      </Card>
                    </Box>
                  ))}
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Stack spacing={1.2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 5, height: 28, borderRadius: 999, bgcolor: "#2563eb" }} />
              <Typography sx={{ color: "#030712", fontWeight: 950, fontSize: "1.08rem" }}>
                Pockets
              </Typography>
            </Stack>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 1.25,
              }}
            >
              {quickActions.map((action) => (
                <Box key={action.label} sx={{ minWidth: 0 }}>
                  <Card
                    onClick={() => {
                      const route = actionRoutes[action.label];
                      if (route) navigate(route);
                    }}
                    sx={{
                      minHeight: 132,
                      borderRadius: 3,
                      border: "1px solid #dfe7f2",
                      boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    <CardContent sx={{ p: 1.25 }}>
                      <Stack spacing={1.1}>
                        <Box sx={{ width: 40, height: 40, borderRadius: 2.2, display: "grid", placeItems: "center", bgcolor: "#eef2ff", color: "#2563eb", "& svg": { fontSize: 22 } }}>
                          {action.icon}
                        </Box>
                        <Typography sx={{ color: "#64748b", fontWeight: 950, fontSize: "0.76rem", lineHeight: 1.2, overflowWrap: "anywhere" }}>
                          {action.label}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Box>
              ))}
            </Box>
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
                      {displaySummaryStats.map((item, index) => (
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
                                  index !== displaySummaryStats.length - 1
                                    ? `1px solid ${COLORS.border}`
                                    : "none",
                              },
                              borderBottom: {
                                xs:
                                  index !== displaySummaryStats.length - 1
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
                    {displayEarningWallets.map((wallet) => (
                      <Grid item xs={12} md={6} key={wallet.title}>
                        <GroupWalletCard {...wallet} onPay={handlePay} paying={payingSource === wallet.source} />
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
                    {displayWorkWallets.map((wallet) => (
                      <Grid item xs={12} md={6} key={wallet.title}>
                        <GroupWalletCard {...wallet} onPay={handlePay} paying={payingSource === wallet.source} />
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
                  title="Withdrawal Wallet"
                  subtitle="Transfer approved wallet amounts here before withdrawal"
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
                                  Withdrawal Wallet
                                </Typography>
                                <Chip
                                  label="Withdrawable"
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
                                {money(wallets?.withdrawal?.amount)}
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
                                  Ready
                                </Typography>
                                <Typography
                                  sx={{
                                    color: COLORS.muted,
                                    fontWeight: 600,
                                    fontSize: { xs: "0.8rem", md: "0.9rem" },
                                  }}
                                >
                                  for withdrawal
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
                  title="Company Marketing Wallet"
                  subtitle="37.5% company marketing allocation"
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
                                Company Marketing Wallet
                              </Typography>
                              <Typography
                                sx={{
                                  fontSize: { xs: "1.45rem", md: "1.8rem" },
                                  fontWeight: 900,
                                  color: COLORS.purple,
                                  lineHeight: 1.1,
                                }}
                              >
                                {money(wallets?.company_marketing?.amount)}
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
                                  37.5%
                                </Typography>
                                <Typography
                                  sx={{
                                    color: COLORS.muted,
                                    fontWeight: 600,
                                    fontSize: { xs: "0.8rem", md: "0.9rem" },
                                  }}
                                >
                                  allocation
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
