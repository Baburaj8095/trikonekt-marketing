import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import API from "../api/api";
import WalletCard from "../components/WalletCard";

// Icon components for actions
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import PaymentsIcon from "@mui/icons-material/Payments";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
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

const TRANSFER_OPTIONS = [
  {
    value: "shopping",
    label: "Transfer to Shopping Wallet",
    helper: "Use this wallet for shopping in consumer dashboard and for product purchases.",
  },
  {
    value: "internal",
    label: "Transfer to Buy Package from Internal Wallet",
    helper: "Use this wallet to buy promo packages internally.",
  },
  {
    value: "wallet_to_wallet",
    label: "Wallet to Wallet Transfer",
    helper: "Transfer wallet amount to another consumer by passing valid consumer ID and mail OTP.",
  },
  {
    value: "withdrawal",
    label: "Transfer to Withdrawal Wallet",
    helper: "Move amount from main wallet to withdrawal wallet before bank withdrawal.",
  },
];

function KpiCard({ title, value, subtitle, tone = "primary" }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid #e5e7eb", height: "100%" }}>
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 900, color: `${tone}.main`, mt: 0.5 }}>
        {value}
      </Typography>
      {subtitle ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {subtitle}
        </Typography>
      ) : null}
    </Paper>
  );
}

// Wallet definitions with slNo mapping
const WALLET_DEFINITIONS = [
  { slNo: 1, name: "Total Earning Wallet", section: "core" },
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
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [walletData, setWalletData] = useState({});
  const [historyData, setHistoryData] = useState({});
  const [kycData, setKycData] = useState({});
  const [banksData, setBanksData] = useState({ banks: [], default_bank_id: null });
  const [withdrawals, setWithdrawals] = useState([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [transferForm, setTransferForm] = useState({
    transfer_type: "shopping",
    amount: "",
    consumer_id: "",
    otp: "",
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [walletRes, kycRes, historyRes, banksRes, withdrawalsRes] = await Promise.all([
        API.get("/accounts/wallet/me/"),
        API.get("/accounts/kyc/me/"),
        API.get("/accounts/wallet/me/history/"),
        API.get("/accounts/wallet/me/banks/"),
        API.get("/accounts/withdrawals/me/"),
      ]);
      setWalletData(walletRes?.data || {});
      setKycData(kycRes?.data || {});
      setHistoryData(historyRes?.data || {});
      setBanksData(banksRes?.data || { banks: [], default_bank_id: null });
      setWithdrawals(
        Array.isArray(withdrawalsRes?.data)
          ? withdrawalsRes.data
          : Array.isArray(withdrawalsRes?.data?.results)
            ? withdrawalsRes.data.results
            : []
      );
    } catch (err) {
      console.error("Failed to fetch wallet data:", err);
      setError("Failed to load team wallet data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const top = historyData?.top || {};
  const income = walletData?.income || {};
  const transferWallets = walletData?.transfer_wallets || {};
  const smartPurchase = walletData?.smart_purchase || {};
  const prime = walletData?.prime || {};
  const coupons = walletData?.coupons || {};
  const limits = walletData?.limits || {};
  const kycVerified = Boolean(kycData?.verified);

  const withdrawalsList = useMemo(() => {
    return Array.isArray(withdrawals) ? withdrawals : [];
  }, [withdrawals]);

  const withdrawnTotal = useMemo(() => {
    return withdrawalsList
      .filter((item) => String(item?.status || "").toLowerCase() === "approved")
      .reduce((sum, item) => sum + Number(item?.amount || 0), 0);
  }, [withdrawalsList]);

  const latestWithdrawalItems = useMemo(() => withdrawalsList.slice(0, 5), [withdrawalsList]);

  const totalEarningBonus = useMemo(
    () => Number(walletData?.totals?.allEarnings || 0),
    [walletData]
  );

  const wallets = useMemo(() => {
    return WALLET_DEFINITIONS.map((def) => {
      let amount = 0;
      let label = "";
      let icon = null;
      let actions = [];

      switch (def.slNo) {
        case 1:
          amount = totalEarningBonus;
          label = `Overall total earnings including already withdrawn amount`;
          icon = <AccountBalanceWalletIcon />;
          break;
        case 2:
          amount = Number(top?.self_account_balance || walletData?.self_account_balance || 0);
          icon = <SwapHorizIcon />;
          label = `${coupons?.selfActivated || 0} self rebirth IDs activated`;
          break;
        case 3:
          amount = Number(top?.shopping_rewards_points || 0);
          icon = <CardGiftcardIcon />;
          label = "History-style shopping rewards amount";
          break;
        case 4:
          amount = Number(top?.redeem_points || walletData?.redeem_points?.self || 0);
          icon = <RedeemIcon />;
          label = "Redeem points shown same as history";
          break;
        case 5:
          amount = Number(walletData?.main_balance || walletData?.balance || 0);
          icon = <AccountBalanceWalletIcon />;
          label = "Main source wallet for all 4 transfers";
          actions = [
            {
              label: "Transfer",
              onClick: () => setTransferOpen(true),
            },
            {
              label: "Withdraw",
              onClick: () => (window.location.href = "/user/wallet"),
              disabled: !kycVerified,
            },
            {
              label: "Buy Package",
              onClick: () => (window.location.href = "/user/promo-packages"),
            },
          ];
          break;
        case 6:
          amount = Number(walletData?.balance || 0);
          icon = <LocalShippingIcon />;
          label = "Upload / package buy funding wallet";
          break;
        case 7:
          amount = Number(transferWallets?.shopping || 0);
          icon = <ShoppingCartIcon />;
          label = "Used to shop in consumer dashboard";
          break;
        case 8:
          amount = Number(transferWallets?.internal || 0);
          icon = <StoreIcon />;
          label = "Used to buy promo packages internally";
          break;
        case 9:
          amount = Number(transferWallets?.walletToWallet || 0);
          icon = <SwapHorizIcon />;
          label = "Consumer to consumer transfer value";
          break;
        case 10:
          amount = Number(transferWallets?.withdrawal || walletData?.withdrawable_balance || 0);
          icon = <PaymentsIcon />;
          label = `Withdrawn so far ₹${fmtAmount(withdrawnTotal)} • Min ₹${limits?.minWithdraw || 500}`;
          actions = [
            {
              label: "Withdraw",
              onClick: () => (window.location.href = "/user/wallet"),
              disabled: !kycVerified,
            },
          ];
          break;
        case 11:
          amount = Number(income?.franchise || 0);
          icon = <PeopleIcon />;
          label = "Franchise referral earnings";
          break;
        case 12:
          amount = Number(smartPurchase?.seasonPurchasedCount || 0);
          icon = <CasinoIcon />;
          label = `Purchased ${smartPurchase?.seasonPurchasedCount || 0}, Pending ${smartPurchase?.seasonPendingCount || 0}`;
          break;
        case 13:
          amount = Number(prime?.activeCount || 0);
          icon = <VerifiedUserIcon />;
          label = `Prime active ${prime?.activeCount || 0}`;
          break;
        case 14:
          amount = walletData?.today?.spinEligible ? 1 : 0;
          icon = <WorkIcon />;
          label = walletData?.today?.spinEligible ? "Spin available today" : "No active spin today";
          break;
        case 15:
          amount = Number(walletData?.totals?.allEarnings || 0);
          icon = <EmojiEventsIcon />;
          label = "Reward gift equivalent of total earnings";
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
  }, [coupons, income, kycVerified, limits, prime, smartPurchase, top, totalEarningBonus, transferWallets, walletData]);

  // Group wallets by section
  const sections = useMemo(() => {
    const core = wallets.filter((w) => w.section === "core");
    const operational = wallets.filter((w) => w.section === "operational");
    const rewards = wallets.filter((w) => w.section === "rewards");
    return { core, operational, rewards };
  }, [wallets]);

  const transferPreviewText = useMemo(
    () => TRANSFER_OPTIONS.find((item) => item.value === transferForm.transfer_type)?.helper || "",
    [transferForm.transfer_type]
  );

  const handleTransferChange = (field, value) => {
    setTransferForm((prev) => ({ ...prev, [field]: value }));
    if (field === "consumer_id") setLookupResult(null);
    if (field === "transfer_type") {
      setOtpRequested(false);
      setLookupResult(null);
      setTransferForm((prev) => ({ ...prev, transfer_type: value, otp: "" }));
    }
  };

  const handleConsumerLookup = async () => {
    if (!transferForm.consumer_id) return;
    try {
      setError("");
      const res = await API.get("/accounts/wallet/transfer/lookup-consumer/", {
        params: { consumer_id: transferForm.consumer_id },
      });
      setLookupResult(res?.data || null);
    } catch (err) {
      setLookupResult(null);
      setError(err?.response?.data?.detail || "Consumer lookup failed.");
    }
  };

  const handleRequestOtp = async () => {
    try {
      setActionLoading(true);
      setError("");
      setSuccess("");
      const payload = {
        transfer_type: transferForm.transfer_type,
        amount: transferForm.amount,
      };
      if (transferForm.transfer_type === "wallet_to_wallet") {
        payload.consumer_id = transferForm.consumer_id;
      }
      const res = await API.post("/accounts/wallet/transfer/request-otp/", payload);
      setOtpRequested(true);
      setSuccess(res?.data?.detail || "OTP sent to your email.");
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to send OTP.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmTransfer = async () => {
    try {
      setActionLoading(true);
      setError("");
      setSuccess("");
      await API.post("/accounts/wallet/transfer/confirm/", {
        transfer_type: transferForm.transfer_type,
        otp: transferForm.otp,
      });
      setSuccess("Transfer completed successfully.");
      setTransferOpen(false);
      setOtpRequested(false);
      setLookupResult(null);
      setTransferForm({ transfer_type: "shopping", amount: "", consumer_id: "", otp: "" });
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.detail || "Transfer confirmation failed.");
    } finally {
      setActionLoading(false);
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
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <AccountBalanceWalletIcon color="primary" sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: "#0C2D48" }}>
              Team Wallet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Wallet balances, earnings, redeem points and transfers in one screen
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip color={kycVerified ? "success" : "warning"} label={kycVerified ? "KYC Verified" : "KYC Pending"} />
          <Chip color="primary" label={`Main Wallet ₹${fmtAmount(walletData?.main_balance)}`} />
        </Stack>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {success ? <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert> : null}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Total Earning Wallet" value={`₹ ${fmtAmount(totalEarningBonus)}`} subtitle="Overall total earnings including withdrawn and current wallet earnings" tone="success" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Main Wallet" value={`₹ ${fmtAmount(top?.main_income_balance || walletData?.main_balance)}`} subtitle="Source wallet for shopping, internal, wallet-to-wallet and withdrawal" tone="primary" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Self Rebirth IDs" value={`${coupons?.selfActivated || 0}`} subtitle={`Reserve earned ₹ ${fmtAmount(top?.self_account_balance)}`} tone="warning" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard title="Redeem Points" value={`${fmtAmount(top?.redeem_points)} pts`} subtitle="Same amount source already used in history" tone="secondary" />
        </Grid>
      </Grid>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, mb: 3, border: "1px solid #e5e7eb", bgcolor: "#fff" }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, color: "#0C2D48" }}>
          Main Wallet Transfer Options
        </Typography>
        <Grid container spacing={2}>
          {TRANSFER_OPTIONS.map((option) => (
            <Grid item xs={12} md={6} key={option.value}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, height: "100%" }}>
                <Typography sx={{ fontWeight: 800 }}>{option.label}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 1.5 }}>
                  {option.helper}
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setTransferForm({ transfer_type: option.value, amount: "", consumer_id: "", otp: "" });
                    setLookupResult(null);
                    setOtpRequested(false);
                    setTransferOpen(true);
                  }}
                >
                  Start Transfer
                </Button>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, mb: 3, border: "1px solid #e5e7eb", bgcolor: "#fff" }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, color: "#0C2D48" }}>
          Smart Purchase Plan Wallet KPI
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <KpiCard title="Purchased Seasons" value={String(smartPurchase?.seasonPurchasedCount || 0)} subtitle={`Season numbers: ${(smartPurchase?.seasonNumbers || []).join(", ") || "-"}`} tone="primary" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <KpiCard title="Pending Seasons" value={String(smartPurchase?.seasonPendingCount || prime?.monthlyPendingCount || 0)} subtitle="Pending season promo packages" tone="warning" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <KpiCard title="Prime Active" value={String(prime?.activeCount || 0)} subtitle={`Monthly active count ${prime?.monthlyActiveCount || 0}`} tone="success" />
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, mb: 3, border: "1px solid #e5e7eb", bgcolor: "#fff" }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, color: "#0C2D48" }}>
          Withdrawal Summary & History
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={4}>
            <KpiCard title="Total Withdrawn" value={`₹ ${fmtAmount(withdrawnTotal)}`} subtitle="Approved withdrawal amount" tone="warning" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <KpiCard title="Withdrawal Requests" value={String(withdrawalsList.length)} subtitle="All withdrawal history entries" tone="primary" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <KpiCard title="Current Withdrawable" value={`₹ ${fmtAmount(walletData?.withdrawable_balance)}`} subtitle="Current withdrawal wallet balance" tone="success" />
          </Grid>
        </Grid>

        {latestWithdrawalItems.length ? (
          <Stack spacing={1.25}>
            {latestWithdrawalItems.map((item, index) => (
              <Paper key={`${item?.id || index}-${item?.requested_at || index}`} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>₹ {fmtAmount(item?.amount)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item?.requested_at ? new Date(item.requested_at).toLocaleString() : "No date"}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      size="small"
                      color={String(item?.status || "").toLowerCase() === "approved" ? "success" : String(item?.status || "").toLowerCase() === "rejected" ? "error" : "warning"}
                      label={String(item?.status || "pending").toUpperCase()}
                    />
                    {item?.payout_ref ? <Chip size="small" variant="outlined" label={`Ref: ${item.payout_ref}`} /> : null}
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Alert severity="info">No withdrawal history found yet.</Alert>
        )}
      </Paper>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, mb: 3, border: "1px solid #e5e7eb", bgcolor: "#fff" }}>
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
            alignItems: "stretch",
          }}
        >
          {sections.core.map((wallet) => (
            <Box
              key={wallet.slNo}
              sx={{
                flex: { xs: "1 1 100%", md: "0 0 calc(50% - 6px)" },
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

      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, mb: 3, border: "1px solid #e5e7eb", bgcolor: "#fff" }}>
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
            alignItems: "stretch",
          }}
        >
          {sections.operational.map((wallet) => (
            <Box
              key={wallet.slNo}
              sx={{
                flex: { xs: "1 1 100%", md: "0 0 calc(50% - 6px)" },
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

      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, mb: 3, border: "1px solid #e5e7eb", bgcolor: "#fff" }}>
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
            alignItems: "stretch",
          }}
        >
          {sections.rewards.map((wallet) => (
            <Box
              key={wallet.slNo}
              sx={{
                flex: { xs: "1 1 100%", md: "0 0 calc(50% - 6px)" },
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

      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid #e5e7eb", bgcolor: "#fff" }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: "#0C2D48", mb: 2 }}>
          Withdrawal and Bank Information
        </Typography>
        {banksData?.banks?.length ? (
          banksData.banks.map((bank) => (
            <Paper key={bank.id} variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 1.5 }}>
              <Typography sx={{ fontWeight: 700 }}>{bank.label}</Typography>
              <Typography variant="body2" color="text.secondary">
                A/C: {bank.account_number_masked || bank.account_number_full || "-"} • IFSC: {bank.ifsc || "-"}
              </Typography>
            </Paper>
          ))
        ) : (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No bank details found in KYC. Please update KYC before withdrawal transfer.
          </Alert>
        )}
      </Paper>

      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>Main Wallet:</strong> You can now transfer to Shopping Wallet, Buy Package from Internal Wallet,
          Wallet to Wallet transfer, and Withdrawal Wallet. Wallet to Wallet transfer uses valid consumer ID and mail OTP.
        </Typography>
      </Alert>

      <Dialog open={transferOpen} onClose={() => !actionLoading && setTransferOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Main Wallet Transfer</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Transfer Type"
              value={transferForm.transfer_type}
              onChange={(e) => handleTransferChange("transfer_type", e.target.value)}
              fullWidth
            >
              {TRANSFER_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <Alert severity="info">{transferPreviewText}</Alert>
            <TextField
              label="Amount"
              type="number"
              value={transferForm.amount}
              onChange={(e) => handleTransferChange("amount", e.target.value)}
              fullWidth
            />

            {transferForm.transfer_type === "wallet_to_wallet" ? (
              <>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    label="Consumer ID / Username / TR Code"
                    value={transferForm.consumer_id}
                    onChange={(e) => handleTransferChange("consumer_id", e.target.value)}
                    fullWidth
                  />
                  <Button variant="outlined" onClick={handleConsumerLookup}>
                    Validate
                  </Button>
                </Stack>
                {lookupResult ? (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography sx={{ fontWeight: 700 }}>{lookupResult.full_name || lookupResult.username}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {lookupResult.username} • {lookupResult.prefixed_id || "No prefixed id"}
                    </Typography>
                  </Paper>
                ) : null}
              </>
            ) : null}

            {otpRequested ? (
              <TextField
                label="Mail OTP"
                value={transferForm.otp}
                onChange={(e) => handleTransferChange("otp", e.target.value)}
                fullWidth
              />
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setTransferOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          {!otpRequested ? (
            <Button variant="contained" onClick={handleRequestOtp} disabled={actionLoading}>
              {actionLoading ? "Sending OTP..." : "Send OTP"}
            </Button>
          ) : (
            <Button variant="contained" onClick={handleConfirmTransfer} disabled={actionLoading}>
              {actionLoading ? "Processing..." : "Confirm Transfer"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}