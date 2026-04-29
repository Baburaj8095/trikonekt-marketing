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
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import API from "../api/api";
import WalletCard from "../components/WalletCard";

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
    label: "To Shopping Wallet",
    helper: "Use for shopping in consumer dashboard and product purchases.",
  },
  {
    value: "internal",
    label: "Buy Package (Internal)",
    helper: "Use this wallet to buy promo packages internally.",
  },
  {
    value: "wallet_to_wallet",
    label: "Wallet to Wallet",
    helper: "Transfer to another consumer via consumer ID + mail OTP.",
  },
  {
    value: "withdrawal",
    label: "To Withdrawal Wallet",
    helper: "Move amount to withdrawal wallet before bank withdrawal.",
  },
];

const WALLET_DEFINITIONS = [
  { slNo: 1, name: "Total Earning Wallet", section: "core" },
  { slNo: 2, name: "Self Rebirth Wallet", section: "core" },
  { slNo: 3, name: "Shopping Reward Wallet", section: "core" },
  { slNo: 4, name: "Redeem Points Wallet", section: "core" },
  { slNo: 5, name: "Main Wallet", section: "core", highlight: true },
  { slNo: 6, name: "Package Buy / Upload Wallet", section: "operational" },
  { slNo: 7, name: "Shopping Wallet", section: "operational" },
  { slNo: 8, name: "Buy Package (Internal)", section: "operational" },
  { slNo: 9, name: "Wallet to Wallet Transfer", section: "operational" },
  { slNo: 10, name: "Withdrawal Wallet", section: "operational" },
  { slNo: 11, name: "Franchise Referral Wallet", section: "rewards" },
  { slNo: 12, name: "Smart Purchase Spin & Win", section: "rewards" },
  { slNo: 13, name: "Prime Subscription Spin & Win", section: "rewards" },
  { slNo: 14, name: "BOP Meeting Spin & Win", section: "rewards" },
  { slNo: 15, name: "Reward Gift", section: "rewards" },
];

// Compact stat pill for the summary bar
function StatPill({ label, value, color = "#0f172a" }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        px: "12px",
        py: "6px",
        bgcolor: "#fff",
        borderRadius: "8px",
        border: "1px solid #e2e8f0",
        minWidth: 80,
        flexShrink: 0,
      }}
    >
      <Typography sx={{ fontSize: 14, fontWeight: 800, color, lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: 10, color: "#94a3b8", mt: "2px", textAlign: "center" }}>
        {label}
      </Typography>
    </Box>
  );
}

// Section header with accent bar
function SectionHeader({ title, accentColor = "primary.main" }) {
  return (
    <Stack direction="row" alignItems="center" spacing="6px" sx={{ mb: "10px" }}>
      <Box
        sx={{
          width: 3,
          height: 16,
          bgcolor: accentColor,
          borderRadius: "2px",
          flexShrink: 0,
        }}
      />
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
        {title}
      </Typography>
    </Stack>
  );
}

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
      setError("Failed to load wallet data. Please try again.");
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

  const withdrawalsList = useMemo(
    () => (Array.isArray(withdrawals) ? withdrawals : []),
    [withdrawals]
  );

  const withdrawnTotal = useMemo(
    () =>
      withdrawalsList
        .filter((item) => String(item?.status || "").toLowerCase() === "approved")
        .reduce((sum, item) => sum + Number(item?.amount || 0), 0),
    [withdrawalsList]
  );

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
          icon = <AccountBalanceWalletIcon />;
          label = "Incl. withdrawn amount";
          break;
        case 2:
          amount = Number(top?.self_account_balance || walletData?.self_account_balance || 0);
          icon = <SwapHorizIcon />;
          label = `${coupons?.selfActivated || 0} IDs activated`;
          break;
        case 3:
          amount = Number(top?.shopping_rewards_points || 0);
          icon = <CardGiftcardIcon />;
          label = "Shopping rewards";
          break;
        case 4:
          amount = Number(top?.redeem_points || walletData?.redeem_points?.self || 0);
          icon = <RedeemIcon />;
          label = "Redeem points";
          break;
        case 5:
          amount = Number(walletData?.main_balance || walletData?.balance || 0);
          icon = <AccountBalanceWalletIcon />;
          label = "Source for all transfers";
          actions = [
            { label: "Transfer", onClick: () => setTransferOpen(true) },
            {
              label: "Withdraw",
              onClick: () => (window.location.href = "/user/wallet"),
              disabled: !kycVerified,
            },
            {
              label: "Buy Pkg",
              onClick: () => (window.location.href = "/user/promo-packages"),
            },
          ];
          break;
        case 6:
          amount = Number(walletData?.balance || 0);
          icon = <LocalShippingIcon />;
          label = "Package buy & upload";
          break;
        case 7:
          amount = Number(transferWallets?.shopping || 0);
          icon = <ShoppingCartIcon />;
          label = "Consumer shopping";
          break;
        case 8:
          amount = Number(transferWallets?.internal || 0);
          icon = <StoreIcon />;
          label = "Buy promo internally";
          break;
        case 9:
          amount = Number(transferWallets?.walletToWallet || 0);
          icon = <SwapHorizIcon />;
          label = "Consumer transfer";
          break;
        case 10:
          amount = Number(transferWallets?.withdrawal || walletData?.withdrawable_balance || 0);
          icon = <PaymentsIcon />;
          label = `Min ₹${limits?.minWithdraw || 500}`;
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
          label = "Franchise referrals";
          break;
        case 12:
          amount = Number(smartPurchase?.seasonPurchasedCount || 0);
          icon = <CasinoIcon />;
          label = `Pending ${smartPurchase?.seasonPendingCount || 0}`;
          break;
        case 13:
          amount = Number(prime?.activeCount || 0);
          icon = <VerifiedUserIcon />;
          label = `Active ${prime?.activeCount || 0}`;
          break;
        case 14:
          amount = walletData?.today?.spinEligible ? 1 : 0;
          icon = <WorkIcon />;
          label = walletData?.today?.spinEligible ? "Spin available" : "No spin today";
          break;
        case 15:
          amount = Number(walletData?.totals?.allEarnings || 0);
          icon = <EmojiEventsIcon />;
          label = "Total reward gift";
          break;
        default:
          amount = 0;
      }

      return { ...def, amount, icon, label, actions };
    });
  }, [coupons, income, kycVerified, limits, prime, smartPurchase, top, totalEarningBonus, transferWallets, walletData]);

  const sections = useMemo(() => ({
    core: wallets.filter((w) => w.section === "core"),
    operational: wallets.filter((w) => w.section === "operational"),
    rewards: wallets.filter((w) => w.section === "rewards"),
  }), [wallets]);

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
      <Box sx={{ px: 2, pt: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2, textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
          Loading wallets…
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        maxWidth: 480,
        mx: "auto",
        px: "12px",
        py: "12px",
        bgcolor: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      {/* ── Header ── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: "12px" }}>
        <Stack direction="row" alignItems="center" spacing="8px">
          <AccountBalanceWalletIcon sx={{ fontSize: 22, color: "#2563eb" }} />
          <Typography sx={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
            Team Wallet
          </Typography>
        </Stack>
        <Chip
          size="small"
          color={kycVerified ? "success" : "warning"}
          label={kycVerified ? "KYC ✓" : "KYC Pending"}
          sx={{ fontSize: 11, height: 24 }}
        />
      </Stack>

      {/* ── Alerts ── */}
      {error && (
        <Alert severity="error" sx={{ mb: "8px", py: "2px", fontSize: 12 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: "8px", py: "2px", fontSize: 12 }}>
          {success}
        </Alert>
      )}

      {/* ── Stats strip ── */}
      <Box
        sx={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          pb: "4px",
          mb: "14px",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        <StatPill
          label="Total Earnings"
          value={`₹${fmtAmount(totalEarningBonus)}`}
          color="#16a34a"
        />
        <StatPill
          label="Main Wallet"
          value={`₹${fmtAmount(walletData?.main_balance)}`}
          color="#2563eb"
        />
        <StatPill
          label="Redeem Pts"
          value={`${fmtAmount(top?.redeem_points)} pts`}
          color="#7c3aed"
        />
        <StatPill
          label="Withdrawn"
          value={`₹${fmtAmount(withdrawnTotal)}`}
          color="#b45309"
        />
        <StatPill
          label="Self Rebirth"
          value={String(coupons?.selfActivated || 0)}
          color="#0369a1"
        />
      </Box>

      {/* ── Transfer quick-actions ── */}
      <Box sx={{ mb: "14px" }}>
        <SectionHeader title="Quick Transfer" />
        <Box
          sx={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {TRANSFER_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="small"
              variant="outlined"
              onClick={() => {
                setTransferForm({ transfer_type: option.value, amount: "", consumer_id: "", otp: "" });
                setLookupResult(null);
                setOtpRequested(false);
                setTransferOpen(true);
              }}
              sx={{
                fontSize: 11,
                fontWeight: 700,
                borderRadius: "8px",
                px: "10px",
                py: "5px",
                borderColor: "#cbd5e1",
                color: "#334155",
                textTransform: "none",
                lineHeight: 1.3,
              }}
            >
              {option.label}
            </Button>
          ))}
        </Box>
      </Box>

      {/* ── Core Wallets ── */}
      <Box sx={{ mb: "14px" }}>
        <SectionHeader title="Core Wallets" />
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          {sections.core.map((wallet) => (
            <Box
              key={wallet.slNo}
              sx={{ flex: "0 0 calc(50% - 4px)", minWidth: 0 }}
            >
              <WalletCard
                slNo={wallet.slNo}
                name={wallet.name}
                amount={wallet.amount}
                icon={wallet.icon}
                label={wallet.label}
                actions={wallet.actions}
                highlight={wallet.highlight}
              />
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Operational Wallets ── */}
      <Box sx={{ mb: "14px" }}>
        <SectionHeader title="Operational Wallets" />
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          {sections.operational.map((wallet) => (
            <Box
              key={wallet.slNo}
              sx={{ flex: "0 0 calc(50% - 4px)", minWidth: 0 }}
            >
              <WalletCard
                slNo={wallet.slNo}
                name={wallet.name}
                amount={wallet.amount}
                icon={wallet.icon}
                label={wallet.label}
                actions={wallet.actions}
              />
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Rewards & Feature Wallets ── */}
      <Box sx={{ mb: "14px" }}>
        <SectionHeader title="Rewards & Features" accentColor="success.main" />
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          {sections.rewards.map((wallet) => (
            <Box
              key={wallet.slNo}
              sx={{ flex: "0 0 calc(50% - 4px)", minWidth: 0 }}
            >
              <WalletCard
                slNo={wallet.slNo}
                name={wallet.name}
                amount={wallet.amount}
                icon={wallet.icon}
                label={wallet.label}
                actions={wallet.actions}
              />
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Withdrawal history ── */}
      <Box sx={{ mb: "14px" }}>
        <SectionHeader title="Recent Withdrawals" />
        {withdrawalsList.slice(0, 5).length ? (
          <Stack spacing="6px">
            {withdrawalsList.slice(0, 5).map((item, index) => (
              <Box
                key={`${item?.id || index}`}
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  bgcolor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  px: "12px",
                  py: "8px",
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                    ₹{fmtAmount(item?.amount)}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: "#94a3b8" }}>
                    {item?.requested_at
                      ? new Date(item.requested_at).toLocaleDateString()
                      : "—"}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  color={
                    String(item?.status || "").toLowerCase() === "approved"
                      ? "success"
                      : String(item?.status || "").toLowerCase() === "rejected"
                        ? "error"
                        : "warning"
                  }
                  label={String(item?.status || "pending").toUpperCase()}
                  sx={{ fontSize: 10, height: 22 }}
                />
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography sx={{ fontSize: 12, color: "#94a3b8", textAlign: "center", py: "8px" }}>
            No withdrawal history yet.
          </Typography>
        )}
      </Box>

      {/* ── Bank info ── */}
      <Box sx={{ mb: "14px" }}>
        <SectionHeader title="Bank Linked" />
        {banksData?.banks?.length ? (
          <Stack spacing="6px">
            {banksData.banks.map((bank) => (
              <Box
                key={bank.id}
                sx={{
                  bgcolor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  px: "12px",
                  py: "8px",
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                  {bank.label}
                </Typography>
                <Typography sx={{ fontSize: 11, color: "#64748b", mt: "2px" }}>
                  {bank.account_number_masked || bank.account_number_full || "—"} · {bank.ifsc || "—"}
                </Typography>
              </Box>
            ))}
          </Stack>
        ) : (
          <Alert severity="warning" sx={{ fontSize: 12, py: "4px" }}>
            No bank details. Update KYC before withdrawal.
          </Alert>
        )}
      </Box>

      {/* ── Transfer Dialog ── */}
      <Dialog
        open={transferOpen}
        onClose={() => !actionLoading && setTransferOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: "16px", mx: "12px" } }}
      >
        <DialogTitle sx={{ fontSize: 15, fontWeight: 800, pb: 1 }}>
          Main Wallet Transfer
        </DialogTitle>
        <DialogContent sx={{ pt: "4px !important" }}>
          <Stack spacing="12px">
            <TextField
              select
              label="Transfer Type"
              value={transferForm.transfer_type}
              onChange={(e) => handleTransferChange("transfer_type", e.target.value)}
              fullWidth
              size="small"
            >
              {TRANSFER_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <Alert severity="info" sx={{ fontSize: 12, py: "2px" }}>
              {transferPreviewText}
            </Alert>
            <TextField
              label="Amount"
              type="number"
              value={transferForm.amount}
              onChange={(e) => handleTransferChange("amount", e.target.value)}
              fullWidth
              size="small"
            />
            {transferForm.transfer_type === "wallet_to_wallet" && (
              <>
                <Stack direction="row" spacing="8px">
                  <TextField
                    label="Consumer ID / TR Code"
                    value={transferForm.consumer_id}
                    onChange={(e) => handleTransferChange("consumer_id", e.target.value)}
                    fullWidth
                    size="small"
                  />
                  <Button variant="outlined" size="small" onClick={handleConsumerLookup}>
                    Verify
                  </Button>
                </Stack>
                {lookupResult && (
                  <Box
                    sx={{
                      bgcolor: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "8px",
                      p: "10px",
                    }}
                  >
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                      {lookupResult.full_name || lookupResult.username}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                      {lookupResult.username} · {lookupResult.prefixed_id || "—"}
                    </Typography>
                  </Box>
                )}
              </>
            )}
            {otpRequested && (
              <TextField
                label="Mail OTP"
                value={transferForm.otp}
                onChange={(e) => handleTransferChange("otp", e.target.value)}
                fullWidth
                size="small"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: "16px", pb: "16px", gap: "8px" }}>
          <Button
            onClick={() => setTransferOpen(false)}
            disabled={actionLoading}
            size="small"
            sx={{ fontSize: 13 }}
          >
            Cancel
          </Button>
          {!otpRequested ? (
            <Button
              variant="contained"
              onClick={handleRequestOtp}
              disabled={actionLoading}
              size="small"
              sx={{ fontSize: 13 }}
            >
              {actionLoading ? "Sending…" : "Send OTP"}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleConfirmTransfer}
              disabled={actionLoading}
              size="small"
              sx={{ fontSize: 13 }}
            >
              {actionLoading ? "Processing…" : "Confirm"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}