import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Chip,
  Stack,
  Avatar,
  Tabs,
  Tab,
  Button,
  Drawer,
  IconButton,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import API from "../api/api";

import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import SavingsIcon from "@mui/icons-material/Savings";
import RedeemIcon from "@mui/icons-material/Redeem";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ConfirmationNumberRoundedIcon from "@mui/icons-material/ConfirmationNumberRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";

/** ---------- helpers ---------- */
function fmtAmount(value) {
  const num = Number(value || 0);
  return num.toFixed(2);
}

function maskUsernameMid(u) {
  const s = String(u || "").trim();
  // Mask only numeric-looking usernames (phone-based) and keep others as-is.
  if (!/^\d{8,}$/.test(s)) return s;
  if (s.length <= 4) return s;
  // Example: 8095918105 -> 8095****105
  const prefix = s.slice(0, 4);
  const suffix = s.slice(-3);
  return `${prefix}****${suffix}`;
}

function counterpartyLabel(tx = {}) {
  // Prefer metadata from wallet credit calls
  const meta = tx?.meta || {};
  const from = meta.from_user || meta.tr_username || meta.username;
  const fromId = meta.from_user_id || meta.user_id;
  const u = from ? maskUsernameMid(from) : "";
  if (u) return `From ${u}`;
  if (fromId) return `From ID ${fromId}`;
  return "";
}

function humanizeType(t) {
  const map = {
    WITHDRAWABLE_CREDIT: "Income Credited",
    COMMISSION_CREDIT: "Commission Credit",
    DIRECT_REF_BONUS: "Direct Referral Bonus",
    AUTOPOOL_BONUS_FIVE: "Autopool Bonus",
    AUTOPOOL_BONUS_THREE: "Autopool Bonus",
    INCOME_CREDIT_75: "Income Credited",
    SELF_ACCOUNT_CREDIT: "Self Account Saved",
    SELF_ACCOUNT_DEBIT: "Self Account Allocation (₹250)",
    AUTO_ECOUPON_ISSUED: "E-Coupon Issued",
    AUTO_PURCHASE_DEBIT: "E-Coupon Issued",
  };

  const key = String(t || "").toUpperCase();
  if (map[key]) return map[key];

  try {
    const s = String(t || "TX").toLowerCase().replace(/_/g, " ");
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return String(t || "TX");
  }
}

// Derive prime tier and friendly source message for transactions
function extractPrimeTier(meta = {}, tx = {}) {
  const src = String(meta.source || "").toUpperCase();
  const trig = String(meta.trigger || "").toUpperCase();
  const pool = String(meta.pool_type || "").toUpperCase();
  const st = String(tx?.source_type || "").toUpperCase();

  if (src.includes("_150") || trig.includes("150") || pool.includes("150")) return 150;
  if (src.includes("_750") || trig.includes("750")) return 750;
  if (src.includes("_759") || st === "MONTHLY_759" || src === "MONTHLY_759") return 759;

  const gross = Number(meta.gross);
  if (gross === 150) return 150;
  if (gross === 750) return 750;

  return undefined;
}

function describeSource(tx = {}) {
  const type = String(tx?.type || "").toUpperCase();
  const meta = tx?.meta || {};
  const src = String(meta.source || "").toUpperCase();
  const st = String(tx?.source_type || "").toUpperCase();
  const ot = String(meta.orig_type || "").toUpperCase();
  const tier = extractPrimeTier(meta, tx);

  // Keep existing label for debits
  if (type === "SELF_ACCOUNT_DEBIT") return humanizeType(type);

  // Reward points
  if (type === "RP_EARN") {
    if (st === "MONTHLY_759" || src === "MONTHLY_759" || tier === 759) {
      return "SPP 1000 - Reward Points";
    }
    return "Reward Points Earned";
  }

  // Rank upgrade commissions (override labels)
  const isRankUpgrade = st === "RANK_UPGRADE" || String(meta.kind || "").toUpperCase().startsWith("RANK_UPGRADE_");
  if (isRankUpgrade) {
    const orig = String(meta.orig_type || type || "").toUpperCase();
    if (orig === "DIRECT_REF_BONUS" || type === "DIRECT_REF_BONUS") {
      return "Digital Education Referral Bonus";
    }
    if (orig === "LEVEL_BONUS" || type === "LEVEL_BONUS") {
      const lvl = Number(meta.level ?? meta.level_index);
      return Number.isFinite(lvl) && lvl > 0 ? `Rank Layer ${lvl} Bonus` : "Rank Layer Bonus";
    }
  }

  // Referral bonuses
  if (type === "DIRECT_REF_BONUS" || src === "JOIN_REFERRAL" || st === "JOIN_REFERRAL") {
    if (tier) return `Referral Bonus ${tier} Prime`;
    return "Referral Bonus";
  }

  // Prime self activations
  if (ot === "PRIME_150_SELF" || src === "PRIME_150_SELF" || type === "PRIME_150_SELF") return "Prime 150 Self Activation";
  if (ot === "PRIME_750_SELF" || src === "PRIME_750_SELF" || type === "PRIME_750_SELF") return "Join Subscription (₹1,000)";
  if (ot === "PRIME_759_SELF" || src === "PRIME_759_SELF" || type === "PRIME_759_SELF") return "Prime 1000 Self Activation";

  // Monthly 759 flows
  if (st === "MONTHLY_759" || src === "MONTHLY_759" || src.includes("759")) {
    if (src.startsWith("FIVE_MATRIX")) return "5 Blocks 1000 Prime";
    return "SPP 1000";
  }

  // Blocks autopool bonuses
  if (src.startsWith("THREE_MATRIX")) {
    const t = tier || (src.includes("150") ? 150 : src.includes("750") ? 750 : undefined);
    return `3 Blocks ${t || ""} Prime`.trim();
  }
  if (src.startsWith("FIVE_MATRIX")) {
    const t = tier || (src.includes("150") ? 150 : src.includes("750") ? 750 : src.includes("759") ? 759 : undefined);
    return `5 Blocks ${t || ""} Prime`.trim();
  }

  // Main Wallet Specific Transactions
  if (type === "MAIN_TO_COUPON" || type === "COUPON_WALLET_TRANSFER_OUT") return "Transfer to Coupon Wallet";
  if (type === "VOUCHER_CREATE_DEBIT") return "Package Voucher Created";
  if (type === "WITHDRAWAL_DEBIT") return "Withdrawal Payout";
  if (type === "ADJUSTMENT_DEBIT") {
    if (st === "ADMIN_SERVICE_CHARGE" || src.includes("SERVICE_CHARGE")) return "7% Service Charge";
    return "Service / Transfer Charge";
  }
  if (type === "ADJUSTMENT_CREDIT") return "System Balance Adjustment";
  if (type === "INCOME_CREDIT_75") {
    if (ot) {
      const parentLabel = describeSource({ ...tx, type: ot });
      return `${parentLabel} (75%)`;
    }
    return "Income Credited (75%)";
  }

  // Prime direct/self
  if (src === "PRIME_150" || st === "PRIME_150" || tier === 150) return "Prime 150";
  if (src === "PRIME_750" || st === "PRIME_750" || tier === 750) return "Join Subscription (₹1,000)";

  // Fallback
  return humanizeType(type);
}

function ymd(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatHeaderDate(d) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return d.toDateString();
  }
}

function groupByDay(items) {
  const now = new Date();
  const todayKey = ymd(now);
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const yestKey = ymd(yest);

  const map = new Map();
  const order = [];

  (items || []).forEach((it) => {
    const k = it?.created_at ? ymd(it.created_at) : "unknown";
    if (!map.has(k)) {
      map.set(k, []);
      order.push(k);
    }
    map.get(k).push(it);
  });

  order.sort((a, b) => {
    if (a === "unknown" && b === "unknown") return 0;
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;
    return a > b ? -1 : a < b ? 1 : 0;
  });

  return order.map((k) => {
    let title = "";
    if (k === todayKey) title = "Today";
    else if (k === yestKey) title = "Yesterday";
    else if (k === "unknown") title = "Unknown";
    else {
      const [Y, M, D] = k.split("-").map((x) => parseInt(x, 10));
      title = formatHeaderDate(new Date(Y, (M || 1) - 1, D || 1));
    }

    const rows = (map.get(k) || []).slice().sort((a, b) => {
      const da = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });

    return { title, rows };
  });
}

/** ---------- UI atoms ---------- */
function StatusChip({ tx }) {
  const pending =
    (tx?.meta && (tx.meta.pending_due_to_inactive === true || tx.meta.pending === true)) ||
    String(tx?.status || "").toLowerCase() === "pending";

  return (
    <Chip
      size="small"
      label={pending ? "Pending" : "Success"}
      variant={pending ? "outlined" : "filled"}
      sx={{
        height: 20,
        fontSize: 11,
        fontWeight: 800,
        borderRadius: 999,
        px: 0.5,
        bgcolor: pending ? "transparent" : "success.light",
        color: pending ? "warning.main" : "success.dark",
        borderColor: pending ? "warning.main" : "transparent",
      }}
    />
  );
}

function AmountBadge({ value }) {
  const num = Number(value || 0);
  const isCredit = num >= 0;
  return (
    <Typography
      sx={{
        fontWeight: 900,
        fontSize: 14,
        color: isCredit ? "success.main" : "error.main",
        lineHeight: 1.1,
        letterSpacing: 0.2,
      }}
    >
      {isCredit ? "+" : "-"}₹ {fmtAmount(Math.abs(num))}
    </Typography>
  );
}

function RowIcon({ value }) {
  const num = Number(value || 0);
  const isCredit = num >= 0;

  return (
    <Avatar
      sx={{
        width: 34,
        height: 34,
        // âœ… premium: neutral icon background, green only for amount/chip
        bgcolor: isCredit ? "#F1F5F9" : "#FDECEC",
        color: isCredit ? "#0C2D48" : "#B42318",
      }}
      aria-label={isCredit ? "Credit" : "Debit"}
    >
      {isCredit ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
    </Avatar>
  );
}

function MiniCard({ title, value, icon, color = "primary", onClick, selected }) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        minWidth: 150,
        flexShrink: 0,
        p: 1.2,
        borderRadius: 2.2,
        borderColor: selected ? `${color}.main` : "#EEF2F6",
        borderWidth: selected ? 2 : 1,
        cursor: onClick ? "pointer" : "default",
        boxShadow: selected ? `0 4px 12px rgba(12, 45, 72, 0.12)` : "none",
        display: "flex",
        alignItems: "center",
        gap: 1.1,
        bgcolor: "#fff",
        scrollSnapAlign: "start",
        transition: "all 0.2s ease",
        "&:hover": onClick ? {
          borderColor: `${color}.main`,
          boxShadow: "0 4px 12px rgba(12, 45, 72, 0.08)",
          transform: "translateY(-1px)",
        } : {},
        "&:active": onClick ? {
          transform: "scale(0.99)",
        } : {},
      }}
    >
      <Avatar
        sx={{
          bgcolor: `${color}.light`,
          color: `${color}.dark`,
          width: 34,
          height: 34,
        }}
      >
        {icon}
      </Avatar>
      <Box>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="subtitle2" sx={{ fontWeight: 900, mt: 0.15 }}>
          {value}
        </Typography>
      </Box>
    </Paper>
  );
}

function SectionHeader({ title }) {
  return (
    <Box sx={{ mt: 1.2, mb: 1 }}>
      <Typography
        sx={{
          fontSize: 12,
          fontWeight: 900,
          color: "text.secondary",
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {title}
      </Typography>
    </Box>
  );
}

function HistoryRow({ tx, onClick }) {
  const amount = Number(tx?.amount || 0);

  const dateStr = tx?.created_at
    ? new Intl.DateTimeFormat(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(tx.created_at))
    : "-";

  const timeStr = tx?.created_at
    ? new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(tx.created_at))
    : "";

  const levelVal = Number(tx?.meta?.level_index ?? tx?.meta?.level);
  const isRankUpgradeRow =
    String(tx?.source_type || "").toUpperCase() === "RANK_UPGRADE" ||
    String(tx?.meta?.kind || "").toUpperCase().startsWith("RANK_UPGRADE_");
  const typeName = isRankUpgradeRow
    ? describeSource(tx)
    : `${describeSource(tx)}${Number.isFinite(levelVal) ? ` - Layer ${levelVal}` : ""}`;

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 1.15, // âœ… slightly more breathing space
        borderRadius: 2,
        border: "1px solid",
        borderColor: "#EEF2F6",
        bgcolor: "#fff",
        cursor: onClick ? "pointer" : "default",
        transition: "transform 120ms ease, box-shadow 120ms ease",
        "&:active": { transform: "scale(0.99)" },
      }}
    >
      <Stack direction="row" spacing={1.1} alignItems="center">
        <RowIcon value={amount} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 900,
              fontSize: 14,
              lineHeight: 1.25,
              whiteSpace: "normal",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }}
          >
            {typeName}
          </Typography>

          {counterpartyLabel(tx) ? (
            <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.15 }}>
              {counterpartyLabel(tx)}
            </Typography>
          ) : null}

          <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.25 }}>
            {dateStr} {timeStr ? `• ${timeStr}` : ""}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ textAlign: "right" }}>
            <AmountBadge value={amount} />
            {/* <Box sx={{ mt: 0.35, display: "flex", justifyContent: "flex-end" }}>
              <StatusChip tx={tx} />
            </Box> */}
          </Box>

          <ChevronRightIcon sx={{ color: "#A0AEC0", fontSize: 20 }} />
        </Stack>
      </Stack>
    </Paper>
  );
}

function SectionList({ sections, fallbackRows = [] }) {
  const empty =
    !sections ||
    sections.length === 0 ||
    sections.every((s) => !s.rows || s.rows.length === 0);

  if (empty) {
    if (Array.isArray(fallbackRows) && fallbackRows.length > 0) {
      return (
        <Stack spacing={1}>
          {fallbackRows.map((tx, i) => (
            <HistoryRow key={`${tx.id || i}-${tx.created_at || i}`} tx={tx} />
          ))}
        </Stack>
      );
    }
    return (
      <Typography variant="body2" sx={{ color: "text.secondary", p: 2 }}>
        No transactions yet.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.2}>
      {sections.map((sec, idx) => (
        <Box key={`${sec.title}-${idx}`}>
          <SectionHeader title={sec.title} />
          <Stack spacing={1}>
            {sec.rows.map((tx, i) => (
              <HistoryRow key={`${tx.id || i}-${tx.created_at || i}`} tx={tx} />
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

/** ---------- main page ---------- */
export default function History() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState("p2p"); // "p2p" | "redeem" | "menu"

  const [top, setTop] = useState({
    main_income_balance: "0.00",
    self_account_balance: "0.00",
    withdrawable_balance: "0.00",
    shopping_rewards_points: "0.00",
    redeem_points: "0.00",
    all_earnings_total: "0.00",
  });

  const [mainWallet, setMainWallet] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [selfAccount, setSelfAccount] = useState([]);
  const [cashback, setCashback] = useState([]);
  const [redeem, setRedeem] = useState([]);
  const [tab, setTab] = useState(0);

  // In-Drawer P2P Transfer State
  const [p2pForm, setP2pForm] = useState({
    recipient_phone: "",
    amount: "",
    coupon_type: "PACKAGE_COUPON",
  });
  const [p2pBusy, setP2pBusy] = useState(false);
  const [p2pError, setP2pError] = useState("");
  const [p2pSuccess, setP2pSuccess] = useState("");

  // In-Drawer Redeem Coupon State
  const [redeemForm, setRedeemForm] = useState({
    coupon_code: "",
    category: "ECOMMERCE_SHOPPING",
  });
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [redeemSuccess, setRedeemSuccess] = useState("");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const fetchHistory = async () => {
    try {
      setErr("");
      const res = await API.get("/accounts/wallet/me/history/");
      const data = res?.data || {};

      setTop({
        main_income_balance: data?.top?.main_income_balance ?? "0.00",
        self_account_balance: data?.top?.self_account_balance ?? "0.00",
        withdrawable_balance: data?.top?.withdrawable_balance ?? "0.00",
        shopping_rewards_points: data?.top?.shopping_rewards_points ?? "0.00",
        redeem_points: data?.top?.redeem_points ?? "0.00",
        all_earnings_total: data?.top?.all_earnings_total ?? "0.00",
        today_bonus_100: data?.top?.today_bonus_100,
        yesterday_bonus_100: data?.top?.yesterday_bonus_100,
        today_main_75: data?.top?.today_main_75,
        yesterday_main_75: data?.top?.yesterday_main_75,
        today_self_25: data?.top?.today_self_25,
        yesterday_self_25: data?.top?.yesterday_self_25,
      });

      setMainWallet(Array.isArray(data?.main_wallet) ? data.main_wallet : (Array.isArray(data?.recent) ? data.recent : []));
      setIncoming(Array.isArray(data?.incoming) ? data.incoming : []);
      setSelfAccount(Array.isArray(data?.self_account) ? data.self_account : []);
      setCashback(Array.isArray(data?.cashback) ? data.cashback : []);
      setRedeem(Array.isArray(data?.redeem) ? data.redeem : []);

      // Load dynamic admin-configured platform taxes
      try {
        const taxRes = await API.get("/business/platform-taxes/");
        if (taxRes?.data) {
          setTaxConfig({
            p2p_package_tax_percent: Number(taxRes.data.p2p_package_tax_percent ?? 7),
            p2p_coupon_tax_percent: Number(taxRes.data.p2p_coupon_tax_percent ?? 7),
            withdrawal_tax_percent: Number(taxRes.data.withdrawal_tax_percent ?? 10),
          });
        }
      } catch (err) {
        console.error("Failed to load platform taxes:", err);
      }
    } catch (e) {
      setErr("Failed to load history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Platform Tax Configuration
  const [taxConfig, setTaxConfig] = useState({
    p2p_package_tax_percent: 7,
    p2p_coupon_tax_percent: 7,
    withdrawal_tax_percent: 10,
  });

  // Pockets Transfer State (Main Wallet -> P2P Coupon Pocket / Withdrawal Pocket)
  const [pocketType, setPocketType] = useState("coupon"); // "coupon" or "withdrawal"
  const [pocketAmount, setPocketAmount] = useState("");
  const [pocketBusy, setPocketBusy] = useState(false);
  const [pocketError, setPocketError] = useState("");
  const [pocketSuccess, setPocketSuccess] = useState("");

  const pocketTaxPercent = pocketType === "withdrawal"
    ? Number(taxConfig.withdrawal_tax_percent || 10)
    : Number(taxConfig.p2p_coupon_tax_percent || 7);
  const pocketGross = Number(pocketAmount || 0);
  const pocketTax = pocketGross > 0 ? Number(((pocketGross * pocketTaxPercent) / 100).toFixed(2)) : 0;
  const pocketNet = pocketGross > 0 ? Number((pocketGross - pocketTax).toFixed(2)) : 0;

  const handlePocketTransfer = async () => {
    if (pocketGross <= 0) {
      setPocketError("Please enter a valid transfer amount.");
      return;
    }
    const avail = Number(top.main_income_balance || top.withdrawable_balance || 0);
    if (pocketGross > avail) {
      setPocketError(`Insufficient balance. Available withdrawable balance is ₹${fmtAmount(avail)}.`);
      return;
    }
    try {
      setPocketBusy(true);
      setPocketError("");
      setPocketSuccess("");

      const res = await API.post("/accounts/wallet/transfer/request-otp/", {
        transfer_type: pocketType,
        amount: pocketGross,
      });

      setPocketSuccess(
        `Transfer initiated for ₹${fmtAmount(pocketGross)} to ${pocketType === "withdrawal" ? "Withdrawal Pocket" : "P2P Coupon Pocket"} (${pocketTaxPercent}% Tax: ₹${fmtAmount(pocketTax)}, Net Credit: ₹${fmtAmount(pocketNet)}). OTP sent to registered email.`
      );
      setPocketAmount("");
      fetchHistory();
    } catch (err) {
      setPocketError(err?.response?.data?.detail || "Failed to process pocket transfer.");
    } finally {
      setPocketBusy(false);
    }
  };

  const p2pGross = Number(p2pForm.amount || 0);
  const p2pTaxPercent = Number(taxConfig.p2p_package_tax_percent || 7);
  const p2pFee = p2pGross > 0 ? Number(((p2pGross * p2pTaxPercent) / 100).toFixed(2)) : 0;
  const p2pNet = p2pGross > 0 ? Number((p2pGross - p2pFee).toFixed(2)) : 0;

  const handleP2pTransfer = async () => {
    if (!p2pForm.recipient_phone.trim()) {
      setP2pError("Please enter recipient phone number.");
      return;
    }
    if (p2pGross <= 0) {
      setP2pError("Please enter a valid transfer amount.");
      return;
    }
    const avail = Number(top.main_income_balance || top.withdrawable_balance || 0);
    if (p2pGross > avail) {
      setP2pError(`Insufficient balance. Your available balance is ₹${fmtAmount(avail)}.`);
      return;
    }
    try {
      setP2pBusy(true);
      setP2pError("");
      setP2pSuccess("");

      const res = await API.post("/business/coupons/p2p-transfer/", {
        recipient_phone: p2pForm.recipient_phone.trim(),
        amount: p2pGross,
        coupon_type: p2pForm.coupon_type,
      });

      const vCode = res.data?.voucher_code;
      setP2pSuccess(`Successfully sent ₹${fmtAmount(p2pNet)} to ${p2pForm.recipient_phone}! (${p2pTaxPercent}% Tax: ₹${fmtAmount(p2pFee)})${vCode ? ` • Voucher Code: ${vCode}` : ""}`);
      setP2pForm({ recipient_phone: "", amount: "", coupon_type: "PACKAGE_COUPON" });
      fetchHistory();
    } catch (err) {
      setP2pError(err?.response?.data?.detail || "Failed to complete P2P transfer.");
    } finally {
      setP2pBusy(false);
    }
  };

  const handleRedeemCoupon = async () => {
    if (!redeemForm.coupon_code.trim()) {
      setRedeemError("Please enter a coupon code to redeem.");
      return;
    }
    try {
      setRedeemBusy(true);
      setRedeemError("");
      setRedeemSuccess("");

      await API.post("/accounts/wallet/vouchers/redeem/", {
        code: redeemForm.coupon_code.trim(),
        category: redeemForm.category,
      });

      setRedeemSuccess(`Coupon ${redeemForm.coupon_code} redeemed successfully for ${redeemForm.category.replace(/_/g, " ")}!`);
      setRedeemForm({ coupon_code: "", category: "ECOMMERCE_SHOPPING" });
      fetchHistory();
    } catch (err) {
      setRedeemError(err?.response?.data?.detail || err?.response?.data?.message || "Failed to redeem coupon.");
    } finally {
      setRedeemBusy(false);
    }
  };

  const [filterDays, setFilterDays] = useState("all");

  const cutoffDate = useMemo(() => {
    if (filterDays === "all") return null;
    const date = new Date();
    date.setDate(date.getDate() - Number(filterDays));
    date.setHours(0, 0, 0, 0);
    return date;
  }, [filterDays]);

  const filteredMainWallet = useMemo(() => {
    if (!cutoffDate) return mainWallet;
    return mainWallet.filter(tx => new Date(tx.created_at) >= cutoffDate);
  }, [mainWallet, cutoffDate]);

  const incomingGross = useMemo(
    () =>
      (incoming || []).map((tx) => {
        const grossVal = (tx?.meta?.gross !== undefined && tx?.meta?.gross !== null && tx?.meta?.gross !== "") 
          ? tx.meta.gross 
          : (tx?.amount ?? 0);
        const g = Number(grossVal);
        return isNaN(g) ? tx : { ...tx, amount: g };
      }),
    [incoming]
  );

  const filteredIncoming = useMemo(() => {
    if (!cutoffDate) return incomingGross;
    return incomingGross.filter(tx => new Date(tx.created_at) >= cutoffDate);
  }, [incomingGross, cutoffDate]);

  const filteredSelf = useMemo(() => {
    if (!cutoffDate) return selfAccount;
    return selfAccount.filter(tx => new Date(tx.created_at) >= cutoffDate);
  }, [selfAccount, cutoffDate]);

  const filteredRewards = useMemo(() => {
    if (!cutoffDate) return cashback;
    return cashback.filter(tx => new Date(tx.created_at) >= cutoffDate);
  }, [cashback, cutoffDate]);

  const filteredRedeem = useMemo(() => {
    if (!cutoffDate) return redeem;
    return redeem.filter(tx => new Date(tx.created_at) >= cutoffDate);
  }, [redeem, cutoffDate]);

  const sectionsMainWallet = useMemo(() => groupByDay(filteredMainWallet), [filteredMainWallet]);
  const sectionsIncoming = useMemo(() => groupByDay(filteredIncoming), [filteredIncoming]);
  const sectionsSelf = useMemo(() => groupByDay(filteredSelf), [filteredSelf]);
  const sectionsRewards = useMemo(() => groupByDay(filteredRewards), [filteredRewards]);
  const sectionsRedeem = useMemo(() => groupByDay(filteredRedeem), [filteredRedeem]);

  const totalGross = useMemo(
    () =>
      (incoming || []).reduce((sum, tx) => {
        const grossVal = (tx?.meta?.gross !== undefined && tx?.meta?.gross !== null && tx?.meta?.gross !== "") 
          ? tx.meta.gross 
          : (tx?.amount ?? 0);
        const g = Number(grossVal);
        return sum + (isNaN(g) ? 0 : g);
      }, 0),
    [incoming]
  );

  const todaysEarnings = useMemo(() => {
    if (tab === 0) {
      if (top.today_bonus_100 !== undefined && top.today_bonus_100 !== null) {
        return Number(top.today_bonus_100);
      }
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      return incomingGross
        .filter(tx => new Date(tx.created_at) >= startOfToday && Number(tx.amount) > 0)
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    }
    if (tab === 1) {
      if (top.today_main_75 !== undefined && top.today_main_75 !== null) {
        return Number(top.today_main_75);
      }
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      return filteredMainWallet
        .filter(tx => new Date(tx.created_at) >= startOfToday && Number(tx.amount) > 0)
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    }
    if (tab === 2) {
      if (top.today_self_25 !== undefined && top.today_self_25 !== null) {
        return Number(top.today_self_25);
      }
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      return selfAccount
        .filter(tx => new Date(tx.created_at) >= startOfToday && Number(tx.amount) > 0)
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    }
    return 0;
  }, [tab, top, filteredMainWallet, incomingGross, selfAccount]);

  const yesterdaysEarnings = useMemo(() => {
    if (tab === 0) {
      if (top.yesterday_bonus_100 !== undefined && top.yesterday_bonus_100 !== null) {
        return Number(top.yesterday_bonus_100);
      }
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      const endOfYesterday = new Date(startOfToday);
      endOfYesterday.setMilliseconds(-1);
      return incomingGross
        .filter(tx => {
          const txDate = new Date(tx.created_at);
          return txDate >= startOfYesterday && txDate <= endOfYesterday && Number(tx.amount) > 0;
        })
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    }
    if (tab === 1) {
      if (top.yesterday_main_75 !== undefined && top.yesterday_main_75 !== null) {
        return Number(top.yesterday_main_75);
      }
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      const endOfYesterday = new Date(startOfToday);
      endOfYesterday.setMilliseconds(-1);
      return filteredMainWallet
        .filter(tx => {
          const txDate = new Date(tx.created_at);
          return txDate >= startOfYesterday && txDate <= endOfYesterday && Number(tx.amount) > 0;
        })
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    }
    if (tab === 2) {
      if (top.yesterday_self_25 !== undefined && top.yesterday_self_25 !== null) {
        return Number(top.yesterday_self_25);
      }
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      const endOfYesterday = new Date(startOfToday);
      endOfYesterday.setMilliseconds(-1);
      return selfAccount
        .filter(tx => {
          const txDate = new Date(tx.created_at);
          return txDate >= startOfYesterday && txDate <= endOfYesterday && Number(tx.amount) > 0;
        })
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    }
    return 0;
  }, [tab, top, filteredMainWallet, incomingGross, selfAccount]);

  const earningsBreakdown = useMemo(() => {
    let direct_referral = 0;
    let matrix_autopool = 0;
    let franchise_captain = 0;

    (incoming || []).forEach((tx) => {
      const type = String(tx?.type || "").toUpperCase();
      const meta = tx?.meta || {};
      const src = String(meta.source || "").toUpperCase();
      const st = String(tx?.source_type || "").toUpperCase();
      const amt = Number(tx?.amount || meta.gross || 0);

      if (type === "DIRECT_REF_BONUS" || src.includes("REFERRAL") || st.includes("REFERRAL")) {
        direct_referral += amt;
      } else if (src.includes("MATRIX") || type.includes("AUTOPOOL") || src.includes("AUTOPOOL")) {
        matrix_autopool += amt;
      } else if (src.includes("FRANCHISE") || src.includes("CAPTAIN") || src.includes("ZONAL") || st.includes("FRANCHISE")) {
        franchise_captain += amt;
      }
    });

    return { direct_referral, matrix_autopool, franchise_captain };
  }, [incoming]);

  const tabs = [
    { label: `Bonus History (${filteredIncoming.length})`, key: "incoming" },
    { label: `Main Wallet (${filteredMainWallet.length})`, key: "main" },
    { label: `Self Account (${filteredSelf.length})`, key: "self" },
  ];

  return (
    <Box
      sx={{
        maxWidth: 560,
        mx: "auto",
        px: { xs: 1, sm: 1.5 },
        py: 1,
        bgcolor: "#F7FAFC",
        minHeight: "100vh",
      }}
    >
      <Typography
        variant="h6"
        sx={{
          mb: 1.2,
          fontWeight: 900,
          color: "#0C2D48",
        }}
      >
        History & Wallet
      </Typography>

      {/* Main Wallet Summary Card with Top Actions */}
      <Paper
        elevation={0}
        onClick={() => {
          setTab(1);
          setActionDrawerOpen(true);
        }}
        sx={{
          p: 1.8,
          borderRadius: 2.5,
          mb: 1.5,
          border: "1px solid",
          borderColor: tab === 1 ? "primary.main" : "#EEF2F6",
          borderWidth: tab === 1 ? 2 : 1,
          bgcolor: "#fff",
          cursor: "pointer",
          transition: "all 0.2s ease",
          boxShadow: tab === 1 ? "0 4px 12px rgba(12, 45, 72, 0.12)" : "0 2px 6px rgba(0,0,0,0.03)",
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar
            sx={{
              bgcolor: "primary.light",
              color: "primary.dark",
              width: 44,
              height: 44,
            }}
          >
            <AccountBalanceWalletIcon fontSize="medium" />
          </Avatar>

          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
              Main Wallet (75% Withdrawable • Tap for Actions)
            </Typography>

            <Typography
              sx={{
                fontSize: isMobile ? 24 : 28,
                fontWeight: 900,
                lineHeight: 1.1,
                mt: 0.2,
                color: "#0F172A",
              }}
            >
              ₹ {fmtAmount(top.main_income_balance)}
            </Typography>
          </Box>
        </Stack>

        {/* Top 3 Quick Actions inside Wallet Card */}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid #EEF2F6" }}>
          <Button
            size="small"
            variant="contained"
            startIcon={<SendRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={(e) => {
              e.stopPropagation();
              setDrawerMode("p2p");
              setActionDrawerOpen(true);
            }}
            sx={{
              flex: 1,
              fontSize: 11.5,
              fontWeight: 700,
              textTransform: "none",
              borderRadius: 2,
              bgcolor: "#2563EB",
              boxShadow: "none",
              "&:hover": { bgcolor: "#1D4ED8" },
            }}
          >
            P2P Send
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SchoolRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={(e) => {
              e.stopPropagation();
              window.open("https://triacademy.trikonekt.com", "_blank", "noopener,noreferrer");
            }}
            sx={{
              flex: 1,
              fontSize: 11.5,
              fontWeight: 700,
              textTransform: "none",
              borderRadius: 2,
              borderColor: "#2563EB",
              color: "#2563EB",
            }}
          >
            E-Edu Academy
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AccountBalanceRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={(e) => {
              e.stopPropagation();
              navigate("/user/withdrawal");
            }}
            sx={{
              flex: 1,
              fontSize: 11.5,
              fontWeight: 700,
              textTransform: "none",
              borderRadius: 2,
              borderColor: "#059669",
              color: "#059669",
            }}
          >
            Withdraw
          </Button>
        </Stack>
      </Paper>

      {/* Bottom Sheet Drawer for Main Wallet Actions & In-Drawer P2P Transfer */}
      <Drawer
        anchor="bottom"
        open={actionDrawerOpen}
        onClose={() => setActionDrawerOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            p: { xs: 2, sm: 2.5 },
            pb: { xs: 4, sm: 3.5 },
            maxWidth: 600,
            mx: "auto",
            bgcolor: "#FFFFFF",
            boxShadow: "0 -12px 40px rgba(15,23,42,0.18)",
            maxHeight: "85vh",
            overflowY: "auto",
          },
        }}
      >
        {/* Drag pill indicator */}
        <Box sx={{ width: 40, height: 4, bgcolor: "#CBD5E1", borderRadius: 2, mx: "auto", mb: 2 }} />

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: 17, fontWeight: 900, color: "#0F172A" }}>
              Main Wallet Transfer & Actions
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#059669", fontWeight: 700 }}>
              Available Balance: ₹ {fmtAmount(top.main_income_balance)}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setActionDrawerOpen(false)}>
            <CloseRoundedIcon />
          </IconButton>
        </Box>

        {/* Action Mode Toggle Pills */}
        <Stack direction="row" spacing={0.8} sx={{ mb: 2 }}>
          <Button
            size="small"
            variant={drawerMode === "p2p" ? "contained" : "outlined"}
            onClick={() => setDrawerMode("p2p")}
            sx={{
              flex: 1,
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 800,
              fontSize: 11.5,
              bgcolor: drawerMode === "p2p" ? "#2563EB" : "transparent",
              borderColor: "#2563EB",
              color: drawerMode === "p2p" ? "#fff" : "#2563EB",
            }}
          >
            P2P Send ({p2pTaxPercent}%)
          </Button>
          <Button
            size="small"
            variant={drawerMode === "pockets" ? "contained" : "outlined"}
            onClick={() => setDrawerMode("pockets")}
            sx={{
              flex: 1,
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 800,
              fontSize: 11.5,
              bgcolor: drawerMode === "pockets" ? "#0D9488" : "transparent",
              borderColor: "#0D9488",
              color: drawerMode === "pockets" ? "#fff" : "#0D9488",
            }}
          >
            Pockets (Taxable)
          </Button>
          <Button
            size="small"
            variant={drawerMode === "redeem" ? "contained" : "outlined"}
            onClick={() => setDrawerMode("redeem")}
            sx={{
              flex: 1,
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 800,
              fontSize: 11.5,
              bgcolor: drawerMode === "redeem" ? "#7C3AED" : "transparent",
              borderColor: "#7C3AED",
              color: drawerMode === "redeem" ? "#fff" : "#7C3AED",
            }}
          >
            Redeem
          </Button>
          <Button
            size="small"
            variant={drawerMode === "menu" ? "contained" : "outlined"}
            onClick={() => setDrawerMode("menu")}
            sx={{
              flex: 0.8,
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 800,
              fontSize: 11.5,
              bgcolor: drawerMode === "menu" ? "#0F172A" : "transparent",
              borderColor: "#CBD5E1",
              color: drawerMode === "menu" ? "#fff" : "#475569",
            }}
          >
            More
          </Button>
        </Stack>

        {/* Drawer Mode 1: P2P Transfer */}
        {drawerMode === "p2p" && (
          <Box sx={{ bgcolor: "#F8FAFC", p: 2, borderRadius: 3, border: "1px solid #E2E8F0", mb: 2 }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A", mb: 0.5 }}>
              Instant Peer-to-Peer Transfer
            </Typography>
            <Typography sx={{ fontSize: 12, color: "#64748B", mb: 1.5 }}>
              Transfers package coupon directly to another member with {p2pTaxPercent}% GST/Tax deducted.
            </Typography>

            {p2pError && <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2, fontSize: 12.5 }}>{p2pError}</Alert>}
            {p2pSuccess && <Alert severity="success" sx={{ mb: 1.5, borderRadius: 2, fontSize: 12.5 }}>{p2pSuccess}</Alert>}

            <Stack spacing={1.5}>
              <TextField
                fullWidth
                size="small"
                label="Recipient Phone Number or ID"
                placeholder="Enter 10-digit mobile number"
                value={p2pForm.recipient_phone}
                onChange={(e) => setP2pForm({ ...p2pForm, recipient_phone: e.target.value })}
                inputProps={{ maxLength: 15 }}
                sx={{ bgcolor: "#fff", borderRadius: 2 }}
              />

              <TextField
                fullWidth
                size="small"
                label="Transfer Amount (₹)"
                placeholder="e.g. 1000"
                type="number"
                value={p2pForm.amount}
                onChange={(e) => setP2pForm({ ...p2pForm, amount: e.target.value })}
                sx={{ bgcolor: "#fff", borderRadius: 2 }}
              />

              {p2pGross > 0 && (
                <Paper elevation={0} sx={{ p: 1.5, bgcolor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 2 }}>
                  <Stack spacing={0.5}>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 12, color: "#1E3A8A" }}>Transfer Amount:</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#1E3A8A" }}>₹ {p2pGross.toFixed(2)}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 12, color: "#DC2626" }}>Transfer GST/Tax ({p2pTaxPercent}%):</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#DC2626" }}>- ₹ {p2pFee.toFixed(2)}</Typography>
                    </Box>
                    <Divider sx={{ my: 0.5, borderColor: "#BFDBFE" }} />
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#1D4ED8" }}>Recipient Receives:</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#1D4ED8" }}>₹ {p2pNet.toFixed(2)}</Typography>
                    </Box>
                  </Stack>
                </Paper>
              )}

              <Button
                fullWidth
                variant="contained"
                disabled={p2pBusy || p2pGross <= 0 || !p2pForm.recipient_phone.trim()}
                onClick={handleP2pTransfer}
                startIcon={p2pBusy ? <CircularProgress size={16} color="inherit" /> : <SendRoundedIcon />}
                sx={{
                  py: 1.25,
                  borderRadius: 2.5,
                  fontWeight: 800,
                  fontSize: 14,
                  textTransform: "none",
                  bgcolor: "#2563EB",
                  "&:hover": { bgcolor: "#1D4ED8" },
                }}
              >
                {p2pBusy ? "Processing Transfer..." : `Transfer ₹${p2pGross > 0 ? fmtAmount(p2pGross) : "0.00"} (Net: ₹${fmtAmount(p2pNet)})`}
              </Button>
            </Stack>
          </Box>
        )}

        {/* Drawer Mode 2: Transfer to Pockets (P2P Coupon Pocket / Withdrawal Pocket) */}
        {drawerMode === "pockets" && (
          <Box sx={{ bgcolor: "#F0FDFA", p: 2, borderRadius: 3, border: "1px solid #99F6E4", mb: 2 }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#0F766E", mb: 0.5 }}>
              Transfer to Dedicated Pockets (Taxable)
            </Typography>
            <Typography sx={{ fontSize: 12, color: "#64748B", mb: 1.5 }}>
              Transfer from Main Wallet to P2P Coupon Pocket or Withdrawal Pocket with configured tax.
            </Typography>

            {pocketError && <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2, fontSize: 12.5 }}>{pocketError}</Alert>}
            {pocketSuccess && <Alert severity="success" sx={{ mb: 1.5, borderRadius: 2, fontSize: 12.5 }}>{pocketSuccess}</Alert>}

            <Stack spacing={1.5}>
              <TextField
                fullWidth
                select
                size="small"
                label="Destination Pocket"
                value={pocketType}
                onChange={(e) => setPocketType(e.target.value)}
                sx={{ bgcolor: "#fff", borderRadius: 2 }}
              >
                <MenuItem value="coupon">P2P Coupon Pocket ({taxConfig.p2p_coupon_tax_percent}% Tax)</MenuItem>
                <MenuItem value="withdrawal">Withdrawal Pocket ({taxConfig.withdrawal_tax_percent}% TDS/Tax)</MenuItem>
              </TextField>

              <TextField
                fullWidth
                size="small"
                label="Transfer Amount (₹)"
                placeholder="e.g. 1000"
                type="number"
                value={pocketAmount}
                onChange={(e) => setPocketAmount(e.target.value)}
                sx={{ bgcolor: "#fff", borderRadius: 2 }}
              />

              {pocketGross > 0 && (
                <Paper elevation={0} sx={{ p: 1.5, bgcolor: "#CCFBF1", border: "1px solid #5EEAD4", borderRadius: 2 }}>
                  <Stack spacing={0.5}>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 12, color: "#115E59" }}>Transfer Amount:</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#115E59" }}>₹ {pocketGross.toFixed(2)}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 12, color: "#DC2626" }}>
                        {pocketType === "withdrawal" ? `TDS / Admin Charge (${pocketTaxPercent}%):` : `P2P Coupon Transfer Tax (${pocketTaxPercent}%):`}
                      </Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#DC2626" }}>- ₹ {pocketTax.toFixed(2)}</Typography>
                    </Box>
                    <Divider sx={{ my: 0.5, borderColor: "#5EEAD4" }} />
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0F766E" }}>Net Credited to Pocket:</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#0F766E" }}>₹ {pocketNet.toFixed(2)}</Typography>
                    </Box>
                  </Stack>
                </Paper>
              )}

              <Button
                fullWidth
                variant="contained"
                disabled={pocketBusy || pocketGross <= 0}
                onClick={handlePocketTransfer}
                startIcon={pocketBusy ? <CircularProgress size={16} color="inherit" /> : <AccountBalanceWalletRoundedIcon />}
                sx={{
                  py: 1.25,
                  borderRadius: 2.5,
                  fontWeight: 800,
                  fontSize: 14,
                  textTransform: "none",
                  bgcolor: "#0D9488",
                  "&:hover": { bgcolor: "#0F766E" },
                }}
              >
                {pocketBusy ? "Processing..." : `Transfer ₹${pocketGross > 0 ? fmtAmount(pocketGross) : "0.00"} to Pocket (Net: ₹${fmtAmount(pocketNet)})`}
              </Button>
            </Stack>
          </Box>
        )}

        {/* Drawer Mode 3: Redeem Coupon */}
        {drawerMode === "redeem" && (
          <Box sx={{ bgcolor: "#FDF4FF", p: 2, borderRadius: 3, border: "1px solid #F0ABFC", mb: 2 }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#701A75", mb: 1.5 }}>
              Redeem Universal Vouchers & Coupons
            </Typography>

            {redeemError && <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2, fontSize: 12.5 }}>{redeemError}</Alert>}
            {redeemSuccess && <Alert severity="success" sx={{ mb: 1.5, borderRadius: 2, fontSize: 12.5 }}>{redeemSuccess}</Alert>}

            <Stack spacing={1.5}>
              <TextField
                fullWidth
                size="small"
                label="Coupon / Voucher Code"
                placeholder="e.g. SPP-A89F-XXXX"
                value={redeemForm.coupon_code}
                onChange={(e) => setRedeemForm({ ...redeemForm, coupon_code: e.target.value })}
                sx={{ bgcolor: "#fff", borderRadius: 2 }}
              />

              <TextField
                fullWidth
                select
                size="small"
                label="Redeem Category"
                value={redeemForm.category}
                onChange={(e) => setRedeemForm({ ...redeemForm, category: e.target.value })}
                sx={{ bgcolor: "#fff", borderRadius: 2 }}
              >
                <MenuItem value="ECOMMERCE_SHOPPING">E-Commerce Shopping Products</MenuItem>
                <MenuItem value="TRIZONE_STORE">Trizone Verified Stores</MenuItem>
                <MenuItem value="NEAR_STORE">Near Store Merchant Discount</MenuItem>
                <MenuItem value="TRI_HOLIDAY">Tri Holiday Travel Voucher</MenuItem>
              </TextField>

              <Button
                fullWidth
                variant="contained"
                disabled={redeemBusy || !redeemForm.coupon_code.trim()}
                onClick={handleRedeemCoupon}
                startIcon={redeemBusy ? <CircularProgress size={16} color="inherit" /> : <ConfirmationNumberRoundedIcon />}
                sx={{
                  py: 1.25,
                  borderRadius: 2.5,
                  fontWeight: 800,
                  fontSize: 14,
                  textTransform: "none",
                  bgcolor: "#7C3AED",
                  "&:hover": { bgcolor: "#6D28D9" },
                }}
              >
                {redeemBusy ? "Processing Redemption..." : "Redeem Coupon"}
              </Button>
            </Stack>
          </Box>
        )}

        {/* Quick External & Portal Actions */}
        <Stack spacing={1.2}>
          {/* E-edu Academy */}
          <Paper
            elevation={0}
            onClick={() => {
              setActionDrawerOpen(false);
              window.open("https://triacademy.trikonekt.com", "_blank", "noopener,noreferrer");
            }}
            sx={{
              p: 1.5,
              borderRadius: 2.5,
              border: "1px solid #E2E8F0",
              bgcolor: "#F8FAFC",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "all 0.15s ease",
              "&:hover": { bgcolor: "#F5F3FF", borderColor: "#7C3AED" },
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: "#F5F3FF", color: "#7C3AED", width: 40, height: 40 }}>
                <SchoolRoundedIcon fontSize="small" />
              </Avatar>
              <Box>
                <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>
                  E-edu Agent Academy (₹2,000)
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: "#64748B" }}>
                  Official learning & certification portal at triacademy.trikonekt.com
                </Typography>
              </Box>
            </Stack>
            <ChevronRightIcon sx={{ color: "#94A3B8", fontSize: 20 }} />
          </Paper>

          {/* Self Withdrawal */}
          <Paper
            elevation={0}
            onClick={() => {
              setActionDrawerOpen(false);
              navigate("/user/withdrawal");
            }}
            sx={{
              p: 1.5,
              borderRadius: 2.5,
              border: "1px solid #E2E8F0",
              bgcolor: "#F8FAFC",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "all 0.15s ease",
              "&:hover": { bgcolor: "#ECFDF5", borderColor: "#059669" },
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: "#ECFDF5", color: "#059669", width: 40, height: 40 }}>
                <AccountBalanceRoundedIcon fontSize="small" />
              </Avatar>
              <Box>
                <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>
                  Self Withdrawal
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: "#64748B" }}>
                  Instant payout to your verified bank account
                </Typography>
              </Box>
            </Stack>
            <ChevronRightIcon sx={{ color: "#94A3B8", fontSize: 20 }} />
          </Paper>
        </Stack>
      </Drawer>

      {/* Today & Yesterday Earnings Stats */}
      <Box sx={{ display: "flex", gap: 1.2, mb: 1.5 }}>
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            p: 1.2,
            borderRadius: 2.2,
            border: "1px solid",
            borderColor: "#EEF2F6",
            bgcolor: "#EDFDF5",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 64,
          }}
        >
          <Typography variant="caption" sx={{ color: "success.dark", fontWeight: 800 }}>
            {tab === 0 ? "Today's Bonus (100%)" : tab === 1 ? "Today's Main (75%)" : "Today's Reserve (25%)"}
          </Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 900, color: "success.main", mt: 0.2 }}>
            +₹ {fmtAmount(todaysEarnings)}
          </Typography>
        </Paper>
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            p: 1.2,
            borderRadius: 2.2,
            border: "1px solid",
            borderColor: "#EEF2F6",
            bgcolor: "#F8FAFC",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 64,
          }}
        >
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
            {tab === 0 ? "Yesterday's Bonus (100%)" : tab === 1 ? "Yesterday's Main (75%)" : "Yesterday's Reserve (25%)"}
          </Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 900, color: "text.primary", mt: 0.2 }}>
            +₹ {fmtAmount(yesterdaysEarnings)}
          </Typography>
        </Paper>
      </Box>

      {/* Mini Cards (Bonus Wallet & Self Account) */}
      <Box
        sx={{
          display: "flex",
          gap: 1.2,
          overflowX: "auto",
          pb: 1,
          mb: 1.5,
          px: 0.5,
          scrollSnapType: "x mandatory",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        <MiniCard
          title="Bonus Wallet (100% Inflow)"
          value={`₹ ${fmtAmount(top.all_earnings_total)}`}
          icon={<SavingsIcon fontSize="small" />}
          color="success"
          onClick={() => setTab(0)}
          selected={tab === 0}
        />
        <MiniCard
          title="Self Account (25% Saved)"
          value={`₹ ${fmtAmount(top.self_account_balance)}`}
          icon={<AccountBalanceWalletIcon fontSize="small" />}
          color="warning"
          onClick={() => setTab(2)}
          selected={tab === 2}
        />
      </Box>

      {/* Horizontal Sliding "My Earnings" breakdown */}
      <Box sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0C2D48", mb: 0.8, px: 0.5 }}>
          My Earnings Breakdown
        </Typography>
        <Box
          sx={{
            display: "flex",
            gap: 1.2,
            overflowX: "auto",
            pb: 1,
            px: 0.5,
            scrollSnapType: "x mandatory",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {/* Card 1: Direct Referral / Package Direct */}
          <Paper
            elevation={0}
            sx={{
              minWidth: 165,
              p: 1.3,
              borderRadius: 2.2,
              border: "1px solid #EEF2F6",
              bgcolor: "#FFFFFF",
              scrollSnapAlign: "start",
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
              Package Direct
            </Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#2563EB", mt: 0.3 }}>
              ₹ {fmtAmount(earningsBreakdown.direct_referral || 0)}
            </Typography>
            <Chip size="small" label="E-edu & Prime Direct" sx={{ mt: 0.5, height: 18, fontSize: 10, bgcolor: "#EFF6FF", color: "#2563EB" }} />
          </Paper>

          {/* Card 2: Layer Matrix (5 & 3) */}
          <Paper
            elevation={0}
            sx={{
              minWidth: 165,
              p: 1.3,
              borderRadius: 2.2,
              border: "1px solid #EEF2F6",
              bgcolor: "#FFFFFF",
              scrollSnapAlign: "start",
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
              Layer 5 & 3 Blocks
            </Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#7C3AED", mt: 0.3 }}>
              ₹ {fmtAmount(earningsBreakdown.matrix_autopool || 0)}
            </Typography>
            <Chip size="small" label="5-Blocks & 3-Blocks" sx={{ mt: 0.5, height: 18, fontSize: 10, bgcolor: "#F5F3FF", color: "#7C3AED" }} />
          </Paper>

          {/* Card 3: Direct Self Block Breakdown */}
          <Paper
            elevation={0}
            sx={{
              minWidth: 220,
              p: 1.3,
              borderRadius: 2.2,
              border: "1px solid #EEF2F6",
              bgcolor: "#FFFFFF",
              scrollSnapAlign: "start",
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
              Direct Self Block Breakdown
            </Typography>
            <Stack spacing={0.3} sx={{ mt: 0.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: 11, color: "text.secondary" }}>E-edu Agent:</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>₹10 / ₹400</Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: 11, color: "text.secondary" }}>Shopping:</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>₹2 / ₹50</Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: 11, color: "text.secondary" }}>Franchise:</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>₹4 / ₹100</Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: 11, color: "text.secondary" }}>Captain:</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>₹5 / ₹125</Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Card 4: Royalty */}
          <Paper
            elevation={0}
            sx={{
              minWidth: 175,
              p: 1.3,
              borderRadius: 2.2,
              border: "1px solid #EEF2F6",
              bgcolor: "#FFFFFF",
              scrollSnapAlign: "start",
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
              Royalty Bonus
            </Typography>
            <Stack spacing={0.3} sx={{ mt: 0.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: 11, color: "text.secondary" }}>Club 1:</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#D97706" }}>₹10k / ₹2.5k</Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: 11, color: "text.secondary" }}>Club 2:</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#D97706" }}>₹40k / ₹25k</Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Card 5: Franchise / Captain */}
          <Paper
            elevation={0}
            sx={{
              minWidth: 165,
              p: 1.3,
              borderRadius: 2.2,
              border: "1px solid #EEF2F6",
              bgcolor: "#FFFFFF",
              scrollSnapAlign: "start",
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
              Franchise / Captain
            </Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#059669", mt: 0.3 }}>
              ₹ {fmtAmount(earningsBreakdown.franchise_captain || 0)}
            </Typography>
            <Chip size="small" label="Geo & Zonal Share" sx={{ mt: 0.5, height: 18, fontSize: 10, bgcolor: "#ECFDF5", color: "#059669" }} />
          </Paper>
        </Box>
      </Box>

      {/* Date Filter Pills Row */}
      <Box
        sx={{
          display: "flex",
          gap: 1,
          overflowX: "auto",
          pb: 1,
          mb: 1.2,
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {[
          { label: "All Time", value: "all" },
          { label: "7 Days", value: "7" },
          { label: "10 Days", value: "10" },
          { label: "15 Days", value: "15" },
          { label: "30 Days", value: "30" },
        ].map((p) => {
          const selected = filterDays === p.value;
          return (
            <Chip
              key={p.value}
              label={p.label}
              onClick={() => setFilterDays(p.value)}
              sx={{
                fontWeight: 800,
                fontSize: 12,
                borderRadius: 999,
                bgcolor: selected ? "primary.main" : "#fff",
                color: selected ? "#fff" : "text.secondary",
                border: "1px solid",
                borderColor: selected ? "primary.main" : "#E2E8F0",
                "&:hover": {
                  bgcolor: selected ? "primary.dark" : "#F1F5F9",
                },
              }}
            />
          );
        })}
      </Box>

      {/* Tabs */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 2.5,
          border: "1px solid",
          borderColor: "#EEF2F6",
          bgcolor: "#fff",
          overflow: "hidden",
        }}
      >
        <Box sx={{ px: 1, pt: 1 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons={false}
            sx={{
              minHeight: 34,
              "& .MuiTabs-indicator": { display: "none" },
              "& .MuiTab-root": {
                textTransform: "none",
                minHeight: 30,
                px: 1.2,
                borderRadius: 999,
                mr: 1,
                fontWeight: 900,
                fontSize: 12,
                color: "text.secondary",
                bgcolor: "#F1F5F9",
              },
              "& .Mui-selected": {
                bgcolor: "primary.main",
                color: "#fff !important",
              },
            }}
          >
            {tabs.map((t, i) => (
              <Tab key={t.key} label={t.label} value={i} />
            ))}
          </Tabs>
        </Box>

        <Box sx={{ p: 1.2 }}>
          {loading ? (
            <LinearProgress />
          ) : err ? (
            <Typography variant="body2" color="error">
              {err}
            </Typography>
          ) : (
            <>
              {tab === 0 && <SectionList sections={sectionsIncoming} fallbackRows={filteredIncoming} />}
              {tab === 1 && <SectionList sections={sectionsMainWallet} fallbackRows={filteredMainWallet} />}
              {tab === 2 && <SectionList sections={sectionsSelf} fallbackRows={filteredSelf} />}
              {tab === 3 && <SectionList sections={sectionsRewards} fallbackRows={filteredRewards} />}
              {tab === 4 && <SectionList sections={sectionsRedeem} fallbackRows={filteredRedeem} />}
            </>
          )}
        </Box>
      </Paper>

      <Box sx={{ height: 16 }} />
    </Box>
  );
}
