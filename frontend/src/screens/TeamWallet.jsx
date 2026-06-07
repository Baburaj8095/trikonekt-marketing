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
    value: "coupon",
    label: "Coupon Pocket Wallet",
    helper: "Use this pocket to create Trizone, online, near store, and package purchase vouchers.",
  },
  {
    value: "internal",
    label: "Self Package Pocket",
    helper: "Use this wallet to buy promo packages internally.",
  },
  {
    value: "withdrawal",
    label: "Withdraw Pocket",
    helper: "Move amount to withdrawal wallet before bank withdrawal.",
  },
];

const WALLET_DEFINITIONS = [
  { slNo: 1, name: "Total Earning Wallet", section: "core" },
  { slNo: 2, name: "Team Consumer Self Re-birth", section: "core" },
  { slNo: 3, name: "Shopping Self Re-birth", section: "core" },
  { slNo: 4, name: "Redeem Points Wallet", section: "core" },
  { slNo: 5, name: "Main Wallet", section: "core", highlight: true },
  { slNo: 6, name: "Coupon Pocket Wallet", section: "operational" },
  { slNo: 7, name: "Self Package Pocket (Buy Package)", section: "operational" },
  { slNo: 9, name: "Add Money (Buy Package)", section: "operational" },
  { slNo: 10, name: "Withdrawal To Pocket", section: "operational" },
  { slNo: 11, name: "Package Purchase Coupon Received (Buy Package)", section: "operational" },
  { slNo: 12, name: "Direct Benefit Wallet", section: "rewards" },
  { slNo: 13, name: "Prime Subscription Spin & Win", section: "rewards" },
  { slNo: 14, name: "Level Benefit Wallet", section: "rewards" },
  { slNo: 15, name: "Reward Gift", section: "rewards" },
  { slNo: 16, name: "Franchisee Self Re-birth", section: "rewards" },
  { slNo: 17, name: "Captain Self Re-birth", section: "rewards" },
  { slNo: 18, name: "Franchise Reference Reward", section: "rewards" },
  { slNo: 19, name: "Zonal Reward", section: "rewards" },
  { slNo: 20, name: "Smart Product Pocket", section: "rewards" },
];

const VOUCHER_TYPES = [
  { value: "TRIZONE", label: "Triozone Coupon", validity: "30 days" },
  { value: "ONLINE", label: "Online Coupon", validity: "30 days" },
  { value: "NEAR_STORE", label: "Near Store Coupon", validity: "7 days" },
  { value: "PACKAGE_PURCHASE", label: "Self Package Coupon", validity: "7 days" },
];

const walletPanelSx = {
  border: "1px solid",
  borderColor: "#e2e8f0",
  borderRadius: 3,
  bgcolor: "#fff",
  overflow: "hidden",
};

const walletTones = [
  { iconBg: "#E0F2FE", iconColor: "#0369A1", amount: "#0369A1" },
  { iconBg: "#DCFCE7", iconColor: "#15803D", amount: "#15803D" },
  { iconBg: "#FFEDD5", iconColor: "#C2410C", amount: "#EA580C" },
  { iconBg: "#EDE9FE", iconColor: "#6D28D9", amount: "#7C3AED" },
  { iconBg: "#CCFBF1", iconColor: "#0F766E", amount: "#0F766E" },
  { iconBg: "#FCE7F3", iconColor: "#BE185D", amount: "#DB2777" },
];

function WalletPanel({
  title,
  amount,
  caption,
  icon,
  highlight = false,
  onClick,
  idCount,
  actions,
  amountPrefix = "Rs.",
  tone = 0,
}) {
  const colors = highlight
    ? { iconBg: "rgba(255,255,255,0.18)", iconColor: "#ffffff", amount: "#ffffff" }
    : walletTones[tone % walletTones.length];
  const visibleActions = highlight ? [] : actions;

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        ...walletPanelSx,
        borderColor: highlight ? "transparent" : "#e2e8f0",
        bgcolor: highlight ? "transparent" : "#fff",
        background: highlight ? "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)" : "#fff",
        color: highlight ? "#fff" : "inherit",
        cursor: onClick ? "pointer" : "default",
        minHeight: highlight ? { xs: 108, sm: 120 } : { xs: 104, sm: 112 },
        width: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 3,
        boxShadow: highlight ? "0 18px 34px rgba(37,99,235,0.24)" : "0 10px 24px rgba(15,23,42,0.06)",
        transition: "transform 140ms ease, box-shadow 160ms ease",
        "&:active": onClick ? { transform: "scale(0.985)" } : undefined,
      }}
    >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            px: { xs: 1.15, sm: 1.35 },
            py: { xs: 1, sm: 1.2 },
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Box
              sx={{
                width: highlight ? 36 : 32,
                height: highlight ? 36 : 32,
                borderRadius: 2.2,
                bgcolor: colors.iconBg,
                color: colors.iconColor,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                "& svg": { fontSize: highlight ? 21 : 18 },
              }}
            >
              {icon}
            </Box>
            <Typography
              sx={{
                color: highlight ? "rgba(255,255,255,0.86)" : "text.secondary",
                fontSize: highlight ? { xs: 12.5, sm: 13 } : { xs: 11, sm: 11.5 },
                fontWeight: 850,
                lineHeight: 1.2,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                overflowWrap: "anywhere",
              }}
            >
              {title}
            </Typography>
          </Stack>

          {idCount !== undefined ? (
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ mt: 0.9, borderTop: "1px solid #eef2f7", pt: 0.75 }}
            >
              <Typography sx={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>
                ID Count
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
                {idCount}
              </Typography>
              <Box sx={{ flex: 1, height: 1, bgcolor: "#e2e8f0" }} />
              <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: colors.amount }}>
                {amountPrefix} {fmtAmount(amount)}
              </Typography>
            </Stack>
          ) : (
            <>
              <Typography
                sx={{
                  mt: highlight ? "auto" : 0.35,
                  color: colors.amount,
                  fontSize: highlight ? { xs: 24, sm: 27 } : { xs: 15, sm: 16 },
                  lineHeight: 1.15,
                  fontWeight: 900,
                }}
              >
                {amountPrefix} {fmtAmount(amount)}
              </Typography>
              {caption ? (
                <Typography
                  sx={{
                    mt: 0.2,
                    color: highlight ? "rgba(255,255,255,0.78)" : "text.secondary",
                    fontSize: 10.5,
                    lineHeight: 1.25,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    overflowWrap: "anywhere",
                  }}
                >
                  {caption}
                </Typography>
              ) : null}
            </>
          )}

          {visibleActions?.length ? (
            <Stack direction="row" spacing={0.7} sx={{ mt: "auto", pt: 0.9, flexWrap: "wrap", gap: 0.7 }}>
              {visibleActions.map((action) => (
                <Button
                  key={action.label}
                  size="small"
                  variant="outlined"
                  disabled={action.disabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    action.onClick?.();
                  }}
                  sx={{
                    minWidth: 0,
                    px: 1,
                    py: 0.25,
                    borderRadius: 999,
                    fontSize: 10.5,
                    fontWeight: 800,
                    textTransform: "none",
                    bgcolor: "#fff",
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </Stack>
          ) : null}
        </Box>
    </Paper>
  );
}

// Section header with accent bar
function SectionHeader({ title, accentColor = "primary.main" }) {
  return (
    <Stack direction="row" alignItems="center" spacing="8px" sx={{ mb: "10px", mt: 0.5 }}>
      <Box
        sx={{
          width: 4,
          height: 18,
          bgcolor: accentColor,
          borderRadius: "2px",
          flexShrink: 0,
        }}
      />
      <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
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
  const [rootsBreakdown, setRootsBreakdown] = useState(null);
  const [voucherData, setVoucherData] = useState({ results: [] });
  const [kycData, setKycData] = useState({});
  const [withdrawals, setWithdrawals] = useState([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherForm, setVoucherForm] = useState({
    voucher_type: "TRIZONE",
    amount: "",
    assigned_to: "",
    note: "",
  });
  const [otpRequested, setOtpRequested] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [transferForm, setTransferForm] = useState({
    transfer_type: "coupon",
    amount: "",
    consumer_id: "",
    otp: "",
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [walletRes, kycRes, historyRes, withdrawalsRes, vouchersRes, rootsRes] = await Promise.all([
        API.get("/accounts/wallet/me/"),
        API.get("/accounts/kyc/me/"),
        API.get("/accounts/wallet/me/history/"),
        API.get("/accounts/withdrawals/me/"),
        API.get("/accounts/wallet/vouchers/"),
        API.get("/accounts/genealogy/roots/breakdown/").catch(() => ({ data: null })),
      ]);
      setWalletData(walletRes?.data || {});
      setVoucherData(vouchersRes?.data || { results: [] });
      setRootsBreakdown(rootsRes?.data || null);
      setKycData(kycRes?.data || {});
      setHistoryData(historyRes?.data || {});
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

  const addMoneyPocketBalance = useMemo(() => {
    const summaryBalance = Number(
      transferWallets?.packageUpload ??
        transferWallets?.addMoney ??
        walletData?.add_money_pocket_balance ??
        0
    );
    if (summaryBalance) return summaryBalance;

    const seen = new Set();
    const historyRows = [
      ...(Array.isArray(historyData?.incoming) ? historyData.incoming : []),
      ...(Array.isArray(historyData?.recent) ? historyData.recent : []),
    ].filter((row) => {
      const key = row?.id ?? `${row?.type || ""}:${row?.source_type || ""}:${row?.source_id || ""}:${row?.created_at || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return historyRows.reduce((sum, row) => {
      const meta = row?.meta || {};
      const isAddMoney =
        String(row?.source_type || "").toUpperCase() === "WALLET_UPLOAD" ||
        String(meta?.wallet || "").toUpperCase() === "ADD_MONEY" ||
        String(meta?.destination_wallet || "").toUpperCase() === "ADD_MONEY_POCKET" ||
        String(meta?.legacy_wallet_type || "").toUpperCase() === "ADD_MONEY_POCKET" ||
        String(meta?.wallet_source || "").toLowerCase() === "package_upload";
      return isAddMoney ? sum + Number(row?.amount || 0) : sum;
    }, 0);
  }, [historyData, transferWallets, walletData]);

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

  const totalEarningBonus = useMemo(() => {
    const summaryCandidates = [
      walletData?.totals?.allEarnings,
      walletData?.totals?.all_earnings,
      walletData?.totals?.totalEarning,
      walletData?.totals?.total_earning,
      walletData?.totalEarning,
      walletData?.total_earning,
      walletData?.total_earnings,
      top?.totalEarning,
      top?.total_earning,
      top?.total_earnings,
    ];

    const summaryTotal = summaryCandidates
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value) && value > 0);
    if (summaryTotal !== undefined) return summaryTotal;

    const historyTotal = (Array.isArray(historyData?.incoming) ? historyData.incoming : []).reduce(
      (sum, tx) => {
        const gross = Number(tx?.meta?.gross);
        const amount = Number(tx?.amount);
        const value = Number.isFinite(gross) && gross > 0 ? gross : amount;
        return Number.isFinite(value) && value > 0 ? sum + value : sum;
      },
      0
    );
    if (historyTotal > 0) return historyTotal;

    const currentMain = Number(
      top?.main_income_balance ??
        walletData?.main_income_balance ??
        walletData?.main_balance ??
        walletData?.balance ??
        0
    );
    return (Number.isFinite(currentMain) ? currentMain : 0) + withdrawnTotal;
  }, [historyData, top, walletData, withdrawnTotal]);

  const selfRebirthStats = useMemo(() => {
    const roots = [
      ...(Array.isArray(rootsBreakdown?.five?.roots) ? rootsBreakdown.five.roots : []),
      ...(Array.isArray(rootsBreakdown?.three?.roots) ? rootsBreakdown.three.roots : []),
    ].filter((root) => String(root?.category || root?.inferred_category || "").toUpperCase() === "SELF_REBIRTH");
    const uniqueIds = new Set(roots.map((root) => `${String(root?.pool_type || "")}:${String(root?.id || "")}`));
    const earned = roots.reduce((sum, root) => sum + Number(root?.total_earned || 0), 0);
    return {
      count: uniqueIds.size || Number(coupons?.selfActivated || 0),
      earned: earned || Number(top?.self_account_balance || walletData?.self_account_balance || 0),
    };
  }, [coupons, rootsBreakdown, top, walletData]);

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
          amount = selfRebirthStats.earned;
          icon = <SwapHorizIcon />;
          label = `${selfRebirthStats.count || 0} self rebirth IDs`;
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
          amount = Number(
            transferWallets?.coupon ||
              voucherData?.coupon_wallet_balance ||
              0
          );
          icon = <LocalShippingIcon />;
          label = "Create 30-day/7-day vouchers";
          actions = [
            { label: "Voucher", onClick: () => setVoucherOpen(true) },
          ];
          break;
        case 7:
          amount = Number(transferWallets?.internal || 0);
          icon = <StoreIcon />;
          label = "Use for Join Subscription, SPP, Digital Education Prime, and Tri Tour package purchase";
          break;
        case 8:
          amount = Number(transferWallets?.withdrawal || walletData?.withdrawable_balance || 0);
          icon = <PaymentsIcon />;
          label = `Min Rs. ${limits?.minWithdraw || 500}`;
          actions = [
            {
              label: "Withdraw",
              onClick: () => (window.location.href = "/user/wallet"),
              disabled: !kycVerified,
            },
          ];
          break;
        case 9:
          amount = addMoneyPocketBalance;
          icon = <AccountBalanceWalletIcon />;
          label = "Admin-approved uploaded money for buying packages";
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
          amount = Number(transferWallets?.packagePurchaseCoupon || voucherData?.package_coupon_wallet_balance || 0);
          icon = <PeopleIcon />;
          label = "Coupons received and redeemed for buying packages";
          break;
        case 12:
          amount = Number(income?.directReferral || 0);
          icon = <CasinoIcon />;
          label = "Direct bonus/reward";
          break;
        case 13:
          amount = Number(prime?.activeCount || 0);
          icon = <VerifiedUserIcon />;
          label = `Active ${prime?.activeCount || 0}`;
          break;
        case 14:
          amount = Number(income?.matrixLevel || income?.levelBonus || 0);
          icon = <WorkIcon />;
          label = "Level income";
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
  }, [addMoneyPocketBalance, coupons, income, kycVerified, limits, prime, selfRebirthStats, smartPurchase, top, totalEarningBonus, transferWallets, voucherData, walletData]);

  const sections = useMemo(() => ({
    core: wallets.filter((w) => w.section === "core"),
    operational: wallets.filter((w) => w.section === "operational"),
    rewards: wallets.filter((w) => w.section === "rewards"),
  }), [wallets]);

  const walletByNo = useMemo(
    () => wallets.reduce((acc, wallet) => ({ ...acc, [wallet.slNo]: wallet }), {}),
    [wallets]
  );

  const transferPockets = useMemo(
    () => [
      {
        no: 1,
        transferType: "coupon",
        title: "Coupon Pocket",
        wallet: walletByNo[6],
        onClick: () => (window.location.href = "/user/coupon-pocket"),
      },
      {
        no: 2,
        title: "Self Package Pocket",
        wallet: walletByNo[7],
        disabled: true,
      },
      {
        no: 3,
        transferType: "withdrawal",
        title: "Withdrawal To Pocket",
        wallet: walletByNo[10],
        onClick: () => (window.location.href = "/user/wallet"),
      },
      {
        no: 4,
        title: "Add Money (Buy Package)",
        wallet: walletByNo[9],
        disabled: true,
      },
      {
        no: 5,
        title: "Package Purchase Coupon Received (Buy Package)",
        wallet: walletByNo[11],
        onClick: () => (window.location.href = "/user/package-coupon-pocket"),
      },
    ],
    [walletByNo]
  );

  const summaryWallets = useMemo(
    () => [
      { title: "Total Earning", wallet: walletByNo[1] },
      { title: "Team Consumer Self Re-birth", wallet: walletByNo[2], idCount: selfRebirthStats.count || 0 },
      { title: "Redeem Points", wallet: walletByNo[4] },
    ],
    [selfRebirthStats, walletByNo]
  );

  const manualWallets = useMemo(
    () => [
      {
        title: "Shopping Self Re-birth",
        amount: 0,
        icon: walletByNo[3]?.icon,
        caption: walletByNo[3]?.label,
        idCount: 0,
        tone: 4,
      },
      {
        title: "Franchisee Self Re-birth",
        amount: walletByNo[11]?.amount,
        icon: walletByNo[11]?.icon,
        caption: "Franchisee rebirth",
        idCount: coupons?.franchiseActivated || 0,
        tone: 5,
      },
      {
        title: "Captain Self Re-birth",
        amount: Number(income?.captain || walletData?.captain_self_rebirth || 0),
        icon: <VerifiedUserIcon />,
        caption: "Captain rebirth",
        idCount: coupons?.captainActivated || 0,
        tone: 1,
      },
      {
        title: "Franchise Reference Reward",
        amount: Number(income?.franchise_reference || income?.franchise || 0),
        icon: <PeopleIcon />,
        caption: "Reference reward",
        tone: 2,
      },
      {
        title: "Direct Benefit",
        amount: Number(income?.directReferral || 0),
        icon: <PaymentsIcon />,
        caption: "Direct bonus/reward",
        tone: 1,
      },
      {
        title: "Level Benefit",
        amount: Number(income?.matrixLevel || income?.levelBonus || 0),
        icon: <AccountBalanceWalletIcon />,
        caption: "Level income",
        tone: 2,
      },
      {
        title: "Zonal Reward",
        amount: Number(income?.zonal || walletData?.zonal_reward || 0),
        icon: <EmojiEventsIcon />,
        caption: "Zonal reward",
        tone: 0,
      },
    ],
    [coupons, income, selfRebirthStats, walletByNo, walletData]
  );

  const openTransferType = (transferType) => {
    setTransferForm({ transfer_type: transferType, amount: "", consumer_id: "", otp: "" });
    setLookupResult(null);
    setOtpRequested(false);
    setTransferOpen(true);
  };

  const transferPreviewText = useMemo(
    () => TRANSFER_OPTIONS.find((item) => item.value === transferForm.transfer_type)?.helper || "",
    [transferForm.transfer_type]
  );

  const transferChargeText = useMemo(() => {
    const pct = transferForm.transfer_type === "withdrawal" ? 10 : ["coupon", "internal"].includes(transferForm.transfer_type) ? 7 : 0;
    const amount = Number(transferForm.amount || 0);
    if (!pct || !amount) return "";
    const charge = amount * pct / 100;
    return `${pct}% admin service charge: Rs. ${fmtAmount(charge)}. Net credit: Rs. ${fmtAmount(amount - charge)}.`;
  }, [transferForm.amount, transferForm.transfer_type]);

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
      setTransferForm({ transfer_type: "coupon", amount: "", consumer_id: "", otp: "" });
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.detail || "Transfer confirmation failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoucherChange = (field, value) => {
    setVoucherForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateVoucher = async () => {
    try {
      setActionLoading(true);
      setError("");
      setSuccess("");
      const payload = {
        voucher_type: voucherForm.voucher_type,
        amount: voucherForm.amount,
        note: voucherForm.note,
      };
      if (voucherForm.voucher_type === "PACKAGE_PURCHASE") {
        payload.assigned_to = voucherForm.assigned_to;
      }
      const res = await API.post("/accounts/wallet/vouchers/", payload);
      setSuccess(`Voucher created: ${res?.data?.code || ""}`);
      setVoucherForm((prev) => ({ ...prev, amount: "", assigned_to: "", note: "" }));
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to create voucher.");
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
      className="consumer-fintech-page"
      sx={{
        maxWidth: 840,
        mx: "auto",
        px: { xs: "2px", sm: "16px" },
        py: { xs: "6px", sm: "18px" },
      }}
    >
      {/* ── Header ── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.6 }}>
        <Stack direction="row" alignItems="center" spacing="8px">
          <Box sx={{ width: 38, height: 38, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "#eff6ff", color: "#2563eb" }}>
            <AccountBalanceWalletIcon sx={{ fontSize: 22 }} />
          </Box>
          <Typography sx={{ fontSize: { xs: 19, sm: 23 }, fontWeight: 950, color: "#0f172a" }}>
            Team Wallet
          </Typography>
        </Stack>
        <Chip
          size="small"
          color={kycVerified ? "success" : "warning"}
          label={kycVerified ? "KYC ✓" : "KYC Pending"}
          sx={{ fontSize: 11, height: 26 }}
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

      <Paper
        elevation={0}
        className="consumer-fintech-card"
        sx={{
          p: { xs: 1.15, sm: 1.5 },
          mb: 2,
          borderRadius: 3,
          bgcolor: "#fff",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 260px" },
            gap: 1.2,
            alignItems: "start",
          }}
        >
          <Stack direction="row" spacing={0.8} alignItems="center">
            <AccountBalanceWalletIcon sx={{ fontSize: 20, color: "#64748b" }} />
            <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: "#475569" }}>
              Growth Wallet
            </Typography>
          </Stack>
          <WalletPanel
            title="Main Wallet"
            amount={walletByNo[5]?.amount}
            icon={walletByNo[5]?.icon}
            caption="Choose a pocket after click"
            highlight
            tone={5}
            onClick={() => openTransferType("coupon")}
          />
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))" },
            gap: { xs: 1, sm: 1.2 },
            mt: 1.2,
          }}
        >
          {summaryWallets.map((item, index) => (
            <WalletPanel
              key={item.title}
              title={item.title}
              amount={item.wallet?.amount}
              icon={item.wallet?.icon}
              caption={item.wallet?.label}
              idCount={item.idCount}
              tone={index}
            />
          ))}
        </Box>
      </Paper>

      <Box sx={{ mb: "14px" }}>
        <SectionHeader title="Pockets" />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: { xs: 1, sm: 1.2 },
          }}
        >
          {transferPockets.map((pocket) => {
            const wallet = pocket.wallet;
            return (
              <WalletPanel
                key={pocket.no}
                title={`${pocket.no}. ${pocket.title}`}
                amount={wallet?.amount}
                icon={wallet?.icon}
                caption={wallet?.label}
                actions={pocket.disabled || pocket.transferType === "withdrawal" ? [] : wallet?.actions}
                tone={pocket.no + 1}
                onClick={pocket.disabled ? undefined : pocket.onClick || (pocket.transferType ? () => openTransferType(pocket.transferType) : undefined)}
              />
            );
          })}
        </Box>
      </Box>

      <Box sx={{ mb: "14px" }}>
        <SectionHeader title="Purchase Coupon Entry & Buy Package" accentColor="success.main" />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: { xs: 1, sm: 1.2 },
          }}
        >
          {manualWallets.map((wallet) => (
            <WalletPanel
              key={wallet.title}
              title={wallet.title}
              amount={wallet.amount}
              icon={wallet.icon}
              caption={wallet.caption}
              idCount={wallet.idCount}
              tone={wallet.tone}
            />
          ))}
        </Box>
      </Box>

      {/* ── Transfer Dialog ── */}
      <Dialog
        open={voucherOpen}
        onClose={() => !actionLoading && setVoucherOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3, mx: "12px" } }}
      >
        <DialogTitle sx={{ fontSize: 18, fontWeight: 900, pb: 1 }}>
          Coupon Pocket Vouchers
        </DialogTitle>
        <DialogContent sx={{ pt: "4px !important" }}>
          <Stack spacing="12px">
            <Alert severity="info" sx={{ fontSize: 12, py: "2px" }}>
              Coupon Pocket Balance: Rs. {fmtAmount(transferWallets?.coupon || voucherData?.coupon_wallet_balance || 0)}
            </Alert>
            <TextField
              select
              label="Voucher Type"
              value={voucherForm.voucher_type}
              onChange={(e) => handleVoucherChange("voucher_type", e.target.value)}
              fullWidth
              size="small"
            >
              {VOUCHER_TYPES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label} ({option.validity})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Amount"
              type="number"
              value={voucherForm.amount}
              onChange={(e) => handleVoucherChange("amount", e.target.value)}
              fullWidth
              size="small"
            />
            {voucherForm.voucher_type === "PACKAGE_PURCHASE" && (
              <TextField
                label="Receiver Consumer ID"
                value={voucherForm.assigned_to}
                onChange={(e) => handleVoucherChange("assigned_to", e.target.value)}
                fullWidth
                size="small"
              />
            )}
            <TextField
              label="Note"
              value={voucherForm.note}
              onChange={(e) => handleVoucherChange("note", e.target.value)}
              fullWidth
              size="small"
              multiline
              minRows={2}
            />
            <Button
              variant="contained"
              onClick={handleCreateVoucher}
              disabled={actionLoading}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              {actionLoading ? "Creating..." : "Create Voucher"}
            </Button>

            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 900, color: "#64748b", mb: 0.8 }}>
                Recent Vouchers
              </Typography>
              <Stack spacing="8px" sx={{ maxHeight: 210, overflow: "auto" }}>
                {(voucherData?.results || []).slice(0, 8).map((item) => (
                  <Box
                    key={item.id}
                    sx={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 2,
                      p: 1,
                      bgcolor: "#fff",
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" spacing="8px">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>
                          {item.code} - Rs. {fmtAmount(item.amount)}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                          {item.voucher_type_label || item.voucher_type} - Valid till {item.expires_at ? new Date(item.expires_at).toLocaleDateString() : "-"}
                        </Typography>
                      </Box>
                      <Chip size="small" label={item.status} sx={{ height: 20, fontSize: 10, fontWeight: 800 }} />
                    </Stack>
                  </Box>
                ))}
                {!(voucherData?.results || []).length && (
                  <Typography sx={{ fontSize: 12, color: "#94a3b8" }}>
                    No vouchers yet.
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: "16px", pb: "16px" }}>
          <Button onClick={() => setVoucherOpen(false)} disabled={actionLoading} size="small">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={transferOpen}
        onClose={() => !actionLoading && setTransferOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3, mx: "12px" } }}
      >
        <DialogTitle sx={{ fontSize: 18, fontWeight: 900, pb: 1 }}>
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
              {transferPreviewText} {transferChargeText}
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
