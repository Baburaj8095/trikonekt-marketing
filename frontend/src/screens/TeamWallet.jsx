import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  Stack,
  LinearProgress,
  Alert,
  Button,
  Divider,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import API from "../api/api";
import WalletCard from "../components/WalletCard";

// Icon components for actions
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import PaymentsIcon from "@mui/icons-material/Payments";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import MoneyOffIcon from "@mui/icons-material/MoneyOff";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import StoreIcon from "@mui/icons-material/Store";
import PeopleIcon from "@mui/icons-material/People";
import CasinoIcon from "@mui/icons-material/Casino";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import WorkIcon from "@mui/icons-material/Work";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import RedeemIcon from "@mui/icons-material/Redeem";

function fmtAmount(value) {
  const num = Number(value || 0);
  return num.toFixed(2);
}

// Wallet definitions with slNo mapping
const WALLET_DEFINITIONS = [
  { slNo: 1, name: "Total Earning Bonus Wallet", section: "core" },
  { slNo: 2, name: "Self Rebirth Wallet", section: "core" },
  { slNo: 3, name: "Shopping Reward Wallet", section: "core" },
  { slNo: 4, name: "Redeem Points Wallet", section: "core" },
  { slNo: 5, name: "Main Wallet", section: "core", highlight: true },
  { slNo: 6, name: "Package Buy / Upload Wallet", section: "operational" },
  { slNo: 7, name: "Shopping Wallet", section: "operational" },
  { slNo: 8, name: "Buy Package from Internal Wallet", section: "operational" },
  { slNo: 9, name: "Wallet to Wallet Transfer", section: "operational" },
  { slNo: 10, name: "Withdrawal Wallet", section: "operational" },
  { slNo: 11, name: "Franchise Referral Wallet", section: "rewards" },
  { slNo: 12, name: "Smart Purchase Spin & Win", section: "rewards" },
  { slNo: 13, name: "Prime Subscription Spin & Win", section: "rewards" },
  { slNo: 14, name: "BOP Meeting Spin & Win", section: "rewards" },
  { slNo: 15, name: "Reward Gift", section: "rewards" },
];

export default function TeamWallet() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [walletData, setWalletData] = useState({});
  const [kycVerified, setKycVerified] = useState(false);

  // Fetch wallet data from existing API
  useEffect(() => {
    let mounted = true;
    const fetchWalletData = async () => {
      try {
        setLoading(true);
        setError("");

        // Fetch wallet summary (same as Wallet.jsx uses)
        const [walletRes, kycRes] = await Promise.all([
          API.get("/accounts/wallet/me/"),
          API.get("/accounts/kyc/me/"),
        ]);

        if (!mounted) return;

        const w = walletRes?.data || {};
        setWalletData(w);
        setKycVerified(kycRes?.data?.verified || false);
      } catch (err) {
        console.error("Failed to fetch wallet data:", err);
        setError("Failed to load wallet data. Please try again.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchWalletData();
    return () => {
      mounted = false;
    };
  }, []);

  // Build wallet array with dynamic data
  const wallets = useMemo(() => {
    const w = walletData;

    // Extract values from API response
    const mainBalance = Number(w?.main_balance || w?.balance || 0);
    const withdrawableBalance = Number(w?.withdrawable_balance || 0);
    const selfAccountBalance = Number(w?.self_account_balance || 0);
    const shoppingRewards = Number(w?.shopping_rewards_points || 0);
    const redeemPoints = Number(w?.redeem_points?.self || w?.redeem_points || 0);

    // Calculate derived values from income breakdown
    const income = w?.income || {};
    const directReferral = Number(income?.directReferral || 0);
    const matrixFive = Number(income?.matrixFive || 0);
    const matrixThree = Number(income?.matrixThree || 0);
    const levelBonus = Number(income?.levelBonus || 0);
    const globalTri = Number(income?.globalTri || 0);
    const globalTurnover = Number(income?.globalTurnover || 0);
    const withdrawalBenefit = Number(income?.withdrawalBenefit || 0);
    const directRefWithdrawCommission = Number(income?.directRefWithdrawCommission || 0);
    const commission = Number(income?.commission || 0);
    const franchise = Number(income?.franchise || 0);

    // Total earning bonus (sum of all income sources) - calculated directly
    const totalEarningBonus =
      directReferral +
      matrixFive +
      matrixThree +
      levelBonus +
      globalTri +
      globalTurnover +
      withdrawalBenefit +
      directRefWithdrawCommission +
      commission +
      franchise;

    // Map wallet definitions to actual values
    return WALLET_DEFINITIONS.map((def) => {
      let amount = 0;
      let actions = [];
      let label = "";
      let icon = null;

      switch (def.slNo) {
        case 1: // Total Earning Bonus Wallet
          amount = totalEarningBonus;
          icon = <AccountBalanceWalletIcon />;
          break;
        case 2: // Self Rebirth Wallet
          amount = selfAccountBalance;
          icon = <SwapHorizIcon />;
          label = "Auto-activation reserve";
          break;
        case 3: // Shopping Reward Wallet
          amount = shoppingRewards;
          icon = <CardGiftcardIcon />;
          label = "Earned from shopping";
          break;
        case 4: // Redeem Points Wallet
          amount = redeemPoints;
          icon = <RedeemIcon />;
          label = "Based on purchased package";
          break;
        case 5: // Main Wallet
          amount = mainBalance;
          icon = <AccountBalanceWalletIcon />;
          actions = [
            {
              label: "Transfer",
              variant: "outlined",
              color: "primary",
              onClick: () => handleWalletAction("transfer"),
            },
            {
              label: "Withdraw",
              variant: "contained",
              color: "primary",
              onClick: () => handleWalletAction("withdraw"),
              disabled: !kycVerified || withdrawableBalance <= 0,
            },
            {
              label: "Buy Package",
              variant: "outlined",
              color: "secondary",
              onClick: () => handleWalletAction("buyPackage"),
            },
          ];
          break;
        case 6: // Package Buy / Upload Wallet
          amount = 0; // Mock - would come from specific transaction type
          icon = <LocalShippingIcon />;
          label = "For package purchases";
          break;
        case 7: // Shopping Wallet
          amount = 0; // Mock - separate from rewards
          icon = <ShoppingCartIcon />;
          label = "Used for shopping";
          break;
        case 8: // Buy Package from Internal Wallet
          amount = 0; // Mock
          icon = <StoreIcon />;
          label = "Internal purchases";
          break;
        case 9: // Wallet to Wallet Transfer
          amount = 0; // Mock - transfer history
          icon = <SwapHorizIcon />;
          label = "Transfer history";
          break;
        case 10: // Withdrawal Wallet
          amount = withdrawableBalance;
          icon = <PaymentsIcon />;
          label = `Available to withdraw`;
          actions = [
            {
              label: "Withdraw",
              variant: "contained",
              color: "primary",
              onClick: () => handleWalletAction("withdraw"),
              disabled: !kycVerified || withdrawableBalance <= 0,
            },
          ];
          break;
        case 11: // Franchise Referral Wallet
          amount = franchise;
          icon = <PeopleIcon />;
          label = "Franchise referral earnings";
          break;
        case 12: // Smart Purchase Spin & Win
          amount = 0; // Mock - would come from spin & win
          icon = <CasinoIcon />;
          label = "Spin & Win rewards";
          break;
        case 13: // Prime Subscription Spin & Win
          amount = 0; // Mock
          icon = <VerifiedUserIcon />;
          label = "Prime Spin rewards";
          break;
        case 14: // BOP Meeting Spin & Win
          amount = 0; // Mock
          icon = <WorkIcon />;
          label = "BOP meeting rewards";
          break;
        case 15: // Reward Gift
          amount = 0; // Mock
          icon = <EmojiEventsIcon />;
          label = "Gift rewards";
          break;
        default:
          amount = 0;
      }

      return {
        ...def,
        amount,
        icon,
        label,
        actions,
      };
    });
  }, [walletData, kycVerified]);

  // Group wallets by section
  const sections = useMemo(() => {
    const core = wallets.filter((w) => w.section === "core");
    const operational = wallets.filter((w) => w.section === "operational");
    const rewards = wallets.filter((w) => w.section === "rewards");
    return { core, operational, rewards };
  }, [wallets]);

  const handleWalletAction = (actionType) => {
    // Navigate to appropriate screen or show action modal
    switch (actionType) {
      case "transfer":
        // TODO: Implement transfer functionality
        console.log("Transfer clicked");
        break;
      case "withdraw":
        // Navigate to withdrawal section in Wallet page
        window.location.href = "/user/wallet";
        break;
      case "buyPackage":
        // Navigate to package purchase
        window.location.href = "/user/promo-packages";
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2, textAlign: "center" }}>Loading wallets...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        maxWidth: 1200,
        mx: "auto",
        px: { xs: 2, sm: 3 },
        py: { xs: 2, sm: 3 },
        bgcolor: "#f7fafc",
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <AccountBalanceWalletIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#0C2D48" }}>
            Team Wallet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All wallet balances at a glance
          </Typography>
        </Box>
      </Stack>

      {/* Section A: Core Wallets (Top) */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          mb: 3,
          border: "1px solid #e5e7eb",
          bgcolor: "#fff",
        }}
      >
        <Typography
          variant="h6"
          sx={{
            mb: 2.5,
            fontWeight: 800,
            color: "#0C2D48",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Box
            sx={{
              width: 4,
              height: 24,
              bgcolor: "primary.main",
              borderRadius: 2,
            }}
          />
          Core Wallets
        </Typography>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1.5,
            alignItems: "stretch", // 👈 ensures equal height
          }}
        >
          {sections.core.map((wallet) => (
            <Box
              sx={{
                flex: "0 0 calc(50% - 6px)",  // 👈 FIX
              }}
            >
              <WalletCard
                slNo={wallet.slNo}
                name={wallet.name}
                amount={wallet.amount}
                icon={wallet.icon}
                label={wallet.label}
                actions={wallet.actions}
                highlight={wallet.highlight}
                sx={{ height: "100%" }}
              />
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Section B: Operational Wallets */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          mb: 3,
          border: "1px solid #e5e7eb",
          bgcolor: "#fff",
        }}
      >
        <Typography
          variant="h6"
          sx={{
            mb: 2.5,
            fontWeight: 800,
            color: "#0C2D48",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Box
            sx={{
              width: 4,
              height: 24,
              bgcolor: "primary.main",
              borderRadius: 2,
            }}
          />
          Operational Wallets
        </Typography>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1.5,
            alignItems: "stretch", // 👈 ensures equal height
          }}
        >
          {sections.operational.map((wallet) => (
            <Box
              sx={{
                flex: "0 0 calc(50% - 6px)",  // 👈 FIX
              }}
            >
              <WalletCard
                slNo={wallet.slNo}
                name={wallet.name}
                amount={wallet.amount}
                icon={wallet.icon}
                label={wallet.label}
                actions={wallet.actions}
                sx={{ height: "100%" }}
              />
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Section C: Rewards & Feature Wallets */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          mb: 3,
          border: "1px solid #e5e7eb",
          bgcolor: "#fff",
        }}
      >
        <Typography
          variant="h6"
          sx={{
            mb: 2.5,
            fontWeight: 800,
            color: "#0C2D48",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Box
            sx={{
              width: 4,
              height: 24,
              bgcolor: "success.main",
              borderRadius: 2,
            }}
          />
          Rewards & Feature Wallets
        </Typography>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1.5,
            alignItems: "stretch", // 👈 ensures equal height
          }}
        >
          {sections.rewards.map((wallet) => (
            <Box
              sx={{
                flex: "0 0 calc(50% - 6px)",  // 👈 FIX
              }}
            >
              <WalletCard
                slNo={wallet.slNo}
                name={wallet.name}
                amount={wallet.amount}
                icon={wallet.icon}
                label={wallet.label}
                actions={wallet.actions}
                sx={{ height: "100%" }}
              />
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Info Alert for Main Wallet Actions */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>Main Wallet:</strong> Use Transfer, Withdraw, or Buy Package buttons to manage your main earnings.
          Withdrawals require KYC verification and sufficient available balance.
        </Typography>
      </Alert>
    </Box>
  );
}