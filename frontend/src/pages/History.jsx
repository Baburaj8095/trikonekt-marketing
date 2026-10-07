import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Grid,
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
  Badge,
  InputAdornment,
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
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import PremiumScreenHeader from "../components/common/PremiumScreenHeader";
import BottomNav from "../components/common/BottomNav";

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
    INCOME_CREDIT_75: "Main Wallet Income",
    SELF_ACCOUNT_CREDIT: "Self Account Credit",
    SELF_ACCOUNT_DEBIT: "Self Account Allocation (₹250)",
    TAX_POOL_CREDIT: "Tax / Admin Pool Credit",
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

  // Self Rebirth 250 source
  if (st === "SELF_REBIRTH_250" || src.includes("REBIRTH_250") || meta.auto_rule === "SELF_REBIRTH_250") {
    if (type === "TAX_POOL_CREDIT") return "Self Rebirth - Franchise / Tax Share";
    if (ot === "DIRECT_REF_BONUS" || type === "DIRECT_REF_BONUS") return "Self Rebirth - Direct Sponsor Bonus";
    if (src.startsWith("FIVE_MATRIX") || ot === "AUTOPOOL_BONUS_FIVE") return "5 Blocks";
    if (src.startsWith("THREE_MATRIX") || ot === "AUTOPOOL_BONUS_THREE") return "3 Blocks";
  }

  // Rank upgrade commissions (override labels to e-Edu)
  const isRankUpgrade = st === "RANK_UPGRADE" || String(meta.kind || "").toUpperCase().startsWith("RANK_UPGRADE_");
  if (isRankUpgrade) {
    const orig = String(meta.orig_type || type || "").toUpperCase();
    if (orig === "DIRECT_REF_BONUS" || type === "DIRECT_REF_BONUS") {
      return "e-Edu Referral Bonus";
    }
    if (orig === "LEVEL_BONUS" || type === "LEVEL_BONUS") {
      const lvl = Number(meta.level ?? meta.level_index);
      return Number.isFinite(lvl) && lvl > 0 ? `e-Edu Layer ${lvl} Bonus` : "e-Edu Layer Bonus";
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

  // Blocks autopool bonuses
  if (src.startsWith("THREE_MATRIX") || ot === "AUTOPOOL_BONUS_THREE") {
    return "3 Blocks";
  }
  if (src.startsWith("FIVE_MATRIX") || ot === "AUTOPOOL_BONUS_FIVE") {
    return "5 Blocks";
  }

  // Monthly 759 / SPP 1000 flows
  const isSpp = st === "MONTHLY_759" || src === "MONTHLY_759" || src.includes("759") || st.startsWith("MONTHLY_FIRST_SEASON") || ot.includes("MONTHLY_759");
  if (isSpp) {
    if (ot === "MONTHLY_759_DIRECT" || type === "MONTHLY_759_DIRECT") {
      return "SPP Direct Referral Bonus";
    }
    if (ot === "MONTHLY_759_LEVEL" || type === "MONTHLY_759_LEVEL") {
      const lvl = Number(meta.level_index ?? meta.level);
      return Number.isFinite(lvl) && lvl > 0 ? `SPP Layer ${lvl} Bonus` : "SPP Layer Bonus";
    }
    if (ot === "AUTOPOOL_BONUS_FIVE" || src.startsWith("FIVE_MATRIX")) {
      const lvl = Number(meta.level_index ?? meta.level);
      return Number.isFinite(lvl) && lvl > 0 ? `5 Blocks Matrix - Layer ${lvl}` : "5 Blocks Matrix";
    }
    if (ot === "AUTOPOOL_BONUS_THREE" || src.startsWith("THREE_MATRIX")) {
      const lvl = Number(meta.level_index ?? meta.level);
      return Number.isFinite(lvl) && lvl > 0 ? `3 Blocks Matrix - Layer ${lvl}` : "3 Blocks Matrix";
    }
    if (ot === "MONTHLY_759_SELF") {
      return "SPP Personal Cashback";
    }
    return "SPP Referral Commission";
  }

  // Main Wallet Specific Transactions
  if (type === "P2P_PACKAGE_COUPON_SEND") {
    const rec = meta.recipient_phone || meta.recipient_id || "User";
    const fee = meta.fee_amount ? ` (7% Fee: -₹${Number(meta.fee_amount).toFixed(2)})` : "";
    return `P2P Coupon Sent to ${rec}${fee}`;
  }
  if (type === "P2P_PACKAGE_COUPON_RECEIVE") {
    const sender = meta.sender_phone || meta.sender_id || "Member";
    return `P2P Coupon Received from ${sender}`;
  }
  if (type === "VOUCHER_REDEEM_CREDIT") {
    const code = meta.voucher_code ? ` [${meta.voucher_code}]` : "";
    const from = meta.creator_username ? ` from ${meta.creator_username}` : "";
    return `Coupon Redeemed to Main Wallet${code}${from}`;
  }
  if (type === "MAIN_TO_COUPON" || type === "COUPON_WALLET_TRANSFER_OUT") return "Transfer to Coupon Wallet";
  if (type === "VOUCHER_CREATE_DEBIT") return "Package Voucher Created";
  if (type === "WITHDRAWAL_DEBIT") return "Withdrawal Payout";
  if (type === "ADJUSTMENT_DEBIT") {
    if (st === "ADMIN_SERVICE_CHARGE" || src.includes("SERVICE_CHARGE")) return "7% Service Charge";
    return "Service / Transfer Charge";
  }
  if (type === "ADJUSTMENT_CREDIT") return "System Balance Adjustment";
  if (type === "TAX_POOL_CREDIT") {
    if (st === "ADMIN_SERVICE_CHARGE" || src.includes("SERVICE_CHARGE")) return "Admin Service Charge";
    return "Tax / Admin Pool Credit";
  }
  if (type === "INCOME_CREDIT_75" || type === "SELF_ACCOUNT_CREDIT") {
    if (ot) {
      const parentLabel = describeSource({ ...tx, type: ot });
      return `${parentLabel}`;
    }
    return type === "SELF_ACCOUNT_CREDIT" ? "Self Account Credit" : "Income Credited";
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

function groupByMonth(items) {
  const map = new Map();
  const order = [];

  (items || []).forEach((it) => {
    let key = "unknown";
    let monthLabel = "Recent Activity";
    if (it?.created_at) {
      const d = new Date(it.created_at);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        key = `${year}-${month}`;
        monthLabel = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      }
    }
    if (!map.has(key)) {
      map.set(key, { label: monthLabel, rows: [], total: 0 });
      order.push(key);
    }
    const entry = map.get(key);
    entry.rows.push(it);
    const amt = Number(it?.amount || 0);
    if (amt > 0) {
      entry.total += amt;
    }
  });

  order.sort((a, b) => {
    if (a === "unknown" && b === "unknown") return 0;
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;
    return a > b ? -1 : a < b ? 1 : 0;
  });

  return order.map((k) => {
    const entry = map.get(k);
    const sortedRows = (entry.rows || []).slice().sort((a, b) => {
      const da = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
    return {
      key: k,
      title: entry.label,
      total: entry.total,
      rows: sortedRows,
    };
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
        width: 38,
        height: 38,
        borderRadius: "50%",
        bgcolor: isCredit ? "#ECFDF5" : "#FEF2F2",
        color: isCredit ? "#059669" : "#DC2626",
        border: isCredit ? "1.5px solid #A7F3D0" : "1.5px solid #FECACA",
      }}
      aria-label={isCredit ? "Credit" : "Debit"}
    >
      {isCredit ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
    </Avatar>
  );
}

function MiniCard({ title, value, icon, color = "primary", onClick, selected }) {
  const colorMap = {
    primary: { border: "#BFDBFE", iconBg: "#EFF6FF", iconColor: "#1D4ED8" },
    success: { border: "#BBF7D0", iconBg: "#ECFDF5", iconColor: "#059669" },
    warning: { border: "#FDE68A", iconBg: "#FFFBEB", iconColor: "#D97706" },
  };
  const themeColors = colorMap[color] || colorMap.primary;

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        minWidth: 160,
        flexShrink: 0,
        p: 1.4,
        borderRadius: 2.5,
        borderColor: selected ? `${color}.main` : "#EEF2F6",
        borderWidth: selected ? 2 : 1,
        borderStyle: "solid",
        cursor: onClick ? "pointer" : "default",
        boxShadow: selected ? "0 6px 18px rgba(12, 45, 72, 0.12)" : "0 1px 4px rgba(15, 23, 42, 0.03)",
        display: "flex",
        alignItems: "center",
        gap: 1.2,
        bgcolor: "#FFFFFF",
        scrollSnapAlign: "start",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": onClick ? {
          borderColor: `${color}.main`,
          boxShadow: "0 6px 16px rgba(12, 45, 72, 0.08)",
          transform: "translateY(-1px)",
        } : {},
        "&:active": onClick ? {
          transform: "scale(0.99)",
        } : {},
      }}
    >
      <Avatar
        sx={{
          bgcolor: themeColors.iconBg,
          color: themeColors.iconColor,
          width: 38,
          height: 38,
          borderRadius: 2,
        }}
      >
        {icon}
      </Avatar>
      <Box>
        <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 800, fontSize: 11 }}>
          {title}
        </Typography>
        <Typography variant="subtitle2" sx={{ fontWeight: 900, mt: 0.15, fontSize: 15, color: "#0F172A" }}>
          {value}
        </Typography>
      </Box>
    </Paper>
  );
}

function SectionHeader({ title, total }) {
  return (
    <Box sx={{ mt: 2, mb: 1.2, display: "flex", justifyContent: "space-between", alignItems: "center", px: 0.5 }}>
      <Typography
        sx={{
          fontSize: 14,
          fontWeight: 800,
          color: "#0F172A",
          letterSpacing: "0.2px",
        }}
      >
        {title}
      </Typography>
      {Number(total) > 0 && (
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#64748B" }}>
          ₹ {fmtAmount(total)} ▾
        </Typography>
      )}
    </Box>
  );
}

function classifyTransaction(tx) {
  const type = String(tx?.type || "").toUpperCase();
  const meta = tx?.meta || {};
  const src = String(meta.source || "").toUpperCase();
  const st = String(tx?.source_type || "").toUpperCase();
  const ot = String(meta.orig_type || "").toUpperCase();
  const trig = String(meta.trigger || "").toUpperCase();

  // 1. SELF ACCOUNT / REPURCHASE POCKET
  if (
    type.startsWith("SELF_ACCOUNT") ||
    meta.ledger === "SELF_ACCOUNT" ||
    type === "SELF_ACCOUNT_CREDIT" ||
    type === "SELF_ACCOUNT_DEBIT"
  ) {
    return "SELF_ACCOUNT";
  }

  // 2. LAYER & AUTOPOOL
  if (
    type === "LEVEL_BONUS" ||
    type === "AUTOPOOL_BONUS_FIVE" ||
    type === "AUTOPOOL_BONUS_THREE" ||
    (st === "RANK_UPGRADE" && (ot.includes("LEVEL") || type.includes("LEVEL") || String(meta.kind || "").toUpperCase().includes("LEVEL"))) ||
    type === "PRIME_150_SELF" ||
    type === "PRIME_750_SELF" ||
    type === "PRIME_759_SELF" ||
    src.startsWith("THREE_MATRIX") ||
    src.startsWith("FIVE_MATRIX") ||
    (type === "INCOME_CREDIT_75" && (
      ot.includes("LEVEL") ||
      ot.includes("AUTOPOOL") ||
      src.includes("MATRIX") ||
      trig === "PRIME_150" ||
      trig === "PRIME_750" ||
      trig === "PRIME_759"
    ))
  ) {
    return "LAYER";
  }

  // 3. DIRECT BONUS
  if (
    type === "DIRECT_REF_BONUS" ||
    type === "MONTHLY_759_DIRECT" ||
    src.includes("REFERRAL") ||
    st.includes("REFERRAL") ||
    (st === "RANK_UPGRADE" && (ot.includes("DIRECT") || type.includes("DIRECT"))) ||
    (type === "INCOME_CREDIT_75" && (
      ot.includes("DIRECT") ||
      src.includes("DIRECT") ||
      trig === "PACKAGE_DIRECT" ||
      trig === "JOIN_REFERRAL"
    ))
  ) {
    return "DIRECT";
  }

  // 4. P2P TRANSFERS
  if (
    type === "P2P_PACKAGE_COUPON_SEND" ||
    type === "P2P_PACKAGE_COUPON_RECEIVE" ||
    type === "MAIN_TO_COUPON" ||
    type === "COUPON_WALLET_TRANSFER_OUT" ||
    type === "COUPON_PURCHASE_CREDIT" ||
    type === "VOUCHER_CREATE_DEBIT" ||
    type.includes("P2P")
  ) {
    return "P2P";
  }

  // 5. ROYALTY BONUS
  if (
    type === "GLOBAL_ROYALTY" ||
    type === "ROYALTY_BONUS" ||
    type === "GLOBAL_ACTIVATION_CREDIT" ||
    src.includes("ROYALTY") ||
    meta.club
  ) {
    return "ROYALTY";
  }

  // 6. MERCHANT, CAPTAIN & FRANCHISE
  if (
    type === "FRANCHISE_INCOME" ||
    type === "CAPTAIN_INCOME" ||
    type === "COMMISSION_CREDIT" ||
    src.includes("FRANCHISE") ||
    src.includes("CAPTAIN") ||
    src.includes("MERCHANT") ||
    src.includes("ZONAL") ||
    st.includes("FRANCHISE")
  ) {
    return "MERCHANT_CAPTAIN";
  }

  // 7. WITHDRAWALS
  if (
    type === "WITHDRAWAL_DEBIT" ||
    type === "WITHDRAWABLE_CREDIT" ||
    type === "INTERNAL_WALLET_DEBIT" ||
    src.includes("WITHDRAW")
  ) {
    return "WITHDRAWAL";
  }

  // 8. REDEEM & COUPONS
  if (
    type.includes("ECOUPON") ||
    type.includes("VOUCHER") ||
    type === "REDEEM_ECOUPON_CREDIT" ||
    type === "AUTO_ECOUPON_ISSUED" ||
    type === "AUTO_PURCHASE_DEBIT" ||
    type.startsWith("RP_")
  ) {
    return "REDEEM";
  }

  return "OTHER";
}

function HistoryRow({ tx, onClick }) {
  const rawAmount = Number(tx?.amount || 0);
  const meta = tx?.meta || {};
  const isP2pReceive = tx?.type === "P2P_PACKAGE_COUPON_RECEIVE";
  const amount = isP2pReceive && rawAmount === 0
    ? Number(meta.net_amount ?? meta.gross_amount ?? 0)
    : rawAmount;
  const isCouponUnredeemed = isP2pReceive && (meta.status === "VOUCHER_ASSIGNED" || !meta.redeemed_at);

  const isSelfAccount =
    tx?.type === "SELF_ACCOUNT_CREDIT" ||
    tx?.type === "SELF_ACCOUNT_DEBIT" ||
    meta?.ledger === "SELF_ACCOUNT" ||
    String(tx?.type || "").startsWith("SELF_ACCOUNT");

  const isMainWalletCredit =
    tx?.type === "INCOME_CREDIT_75" ||
    meta?.ledger === "MAIN" ||
    (amount > 0 && !isSelfAccount && !isP2pReceive);

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

  const cat = classifyTransaction(tx);
  const catChipLabels = {
    SELF_ACCOUNT: "Self blocks",
    LAYER: "Layer & Blocks",
    DIRECT: "Direct Bonus",
    P2P: "P2P Transfer",
    ROYALTY: "Royalty Bonus",
    MERCHANT_CAPTAIN: "Merchant & Captain",
    WITHDRAWAL: "Withdrawal",
    REDEEM: "Redeemed / Pocket",
    OTHER: "Wallet Flow",
  };

  const isCredit = amount >= 0;

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 1.4,
        borderRadius: 2.5,
        border: "1px solid",
        borderColor: isSelfAccount ? "#FDE68A" : "#EEF2F6",
        bgcolor: isSelfAccount ? "#FFFDF5" : "#FFFFFF",
        cursor: onClick ? "pointer" : "default",
        transition: "all 180ms cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.02)",
        "&:hover": onClick
          ? {
              borderColor: isSelfAccount ? "#F59E0B" : "#CBD5E1",
              boxShadow: "0 4px 14px rgba(12, 45, 72, 0.06)",
              transform: "translateY(-1px)",
            }
          : {},
        "&:active": { transform: "scale(0.99)" },
      }}
    >
      <Stack direction="row" spacing={1.2} alignItems="center">
        <RowIcon value={amount} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, flexWrap: "wrap" }}>
            <Typography
              sx={{
                fontWeight: 900,
                fontSize: 13.5,
                lineHeight: 1.25,
                color: "#0F172A",
                whiteSpace: "normal",
                wordBreak: "break-word",
              }}
            >
              {typeName}
            </Typography>

            {/* Dedicated Primary Badge for Wallet Split Type */}
            {isSelfAccount ? (
              <Chip
                size="small"
                label="Self Account Credit"
                sx={{
                  height: 18,
                  fontSize: 10,
                  fontWeight: 800,
                  borderRadius: 1,
                  bgcolor: "#FEF3C7",
                  color: "#92400E",
                  border: "1px solid #FCD34D",
                }}
              />
            ) : isMainWalletCredit ? (
              <Chip
                size="small"
                label="Main Wallet Credit"
                sx={{
                  height: 18,
                  fontSize: 10,
                  fontWeight: 800,
                  borderRadius: 1,
                  bgcolor: "#DCFCE7",
                  color: "#166534",
                  border: "1px solid #86EFAC",
                }}
              />
            ) : cat && cat !== "OTHER" && (
              <Chip
                size="small"
                label={catChipLabels[cat] || cat}
                sx={{
                  height: 18,
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 1,
                  bgcolor: isCredit ? "#F0FDF4" : "#FEF2F2",
                  color: isCredit ? "#166534" : "#991B1B",
                }}
              />
            )}

            {isP2pReceive && (
              <Chip
                size="small"
                label={isCouponUnredeemed ? "Not Redeemed" : "Redeemed"}
                sx={{
                  height: 18,
                  fontSize: 10,
                  fontWeight: 800,
                  borderRadius: 1,
                  bgcolor: isCouponUnredeemed ? "#FEF3C7" : "#DCFCE7",
                  color: isCouponUnredeemed ? "#92400E" : "#166534",
                  border: isCouponUnredeemed ? "1px solid #FCD34D" : "1px solid #86EFAC",
                }}
              />
            )}
          </Box>

          <Typography sx={{ fontSize: 12, color: isSelfAccount ? "#B45309" : isMainWalletCredit ? "#047857" : "text.secondary", fontWeight: 700, mt: 0.2 }}>
            {isSelfAccount ? "25% Repurchase Self Account" : isMainWalletCredit ? "75% Withdrawable Main Wallet" : ""}
            {counterpartyLabel(tx) ? ` • ${counterpartyLabel(tx)}` : ""}
          </Typography>

          <Typography sx={{ fontSize: 11.5, color: "#94A3B8", mt: 0.25 }}>
            {dateStr} {timeStr ? `• ${timeStr}` : ""}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.8} alignItems="center">
          <Box sx={{ textAlign: "right" }}>
            <AmountBadge value={amount} />
          </Box>
          <ChevronRightIcon sx={{ color: "#CBD5E1", fontSize: 18 }} />
        </Stack>
      </Stack>
    </Paper>
  );
}

function TxDetailDrawer({ open, onClose, tx }) {
  if (!tx) return null;
  const rawAmount = Number(tx?.amount || 0);
  const meta = tx?.meta || {};
  const isP2pReceive = tx?.type === "P2P_PACKAGE_COUPON_RECEIVE";
  const amount = isP2pReceive && rawAmount === 0
    ? Number(meta.net_amount ?? meta.gross_amount ?? 0)
    : rawAmount;
  const isCredit = amount >= 0;
  const isCouponUnredeemed = isP2pReceive && (meta.status === "VOUCHER_ASSIGNED" || !meta.redeemed_at);
  const cat = classifyTransaction(tx);

  const dateStr = tx?.created_at
    ? new Intl.DateTimeFormat(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(tx.created_at))
    : "-";

  const grossVal = meta.gross_amount ?? meta.gross;
  const feeVal = meta.fee_amount ?? meta.admin_fee ?? meta.tax_amount;
  const netVal = meta.net_amount;

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          p: { xs: 2, sm: 2.5 },
          pb: { xs: 4, sm: 3.5 },
          maxWidth: 560,
          mx: "auto",
          bgcolor: "#FFFFFF",
          boxShadow: "0 -12px 40px rgba(15,23,42,0.18)",
        },
      }}
    >
      <Box sx={{ width: 40, height: 4, bgcolor: "#CBD5E1", borderRadius: 2, mx: "auto", mb: 2 }} />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography sx={{ fontSize: 16.5, fontWeight: 900, color: "#0F172A" }}>
          Transaction Details
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2.5,
          bgcolor: isCredit ? "#F0FDF4" : "#FEF2F2",
          border: "1px solid",
          borderColor: isCredit ? "#BBF7D0" : "#FECACA",
          textAlign: "center",
          mb: 2,
        }}
      >
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: isCredit ? "#166534" : "#991B1B", mb: 0.3 }}>
          {describeSource(tx)}
        </Typography>
        <Typography sx={{ fontSize: 26, fontWeight: 900, color: isCredit ? "#15803D" : "#B91C1C" }}>
          {isCredit ? "+" : "-"}₹ {fmtAmount(Math.abs(amount))}
        </Typography>
        <Chip
          size="small"
          label={cat.replace(/_/g, " ")}
          sx={{
            mt: 0.8,
            height: 20,
            fontSize: 10.5,
            fontWeight: 800,
            bgcolor: isCredit ? "#DCFCE7" : "#FEE2E2",
            color: isCredit ? "#166534" : "#991B1B",
          }}
        />
      </Paper>

      <Stack spacing={1.2} sx={{ bgcolor: "#F8FAFC", p: 1.8, borderRadius: 2, border: "1px solid #E2E8F0" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Transaction ID</Typography>
          <Typography sx={{ fontSize: 12, color: "#0F172A", fontWeight: 800 }}>#{tx.id || "N/A"}</Typography>
        </Box>
        <Divider />

        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Timestamp</Typography>
          <Typography sx={{ fontSize: 12, color: "#0F172A", fontWeight: 700 }}>{dateStr}</Typography>
        </Box>
        <Divider />

        {counterpartyLabel(tx) && (
          <>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Counterparty</Typography>
              <Typography sx={{ fontSize: 12, color: "#2563EB", fontWeight: 800 }}>{counterpartyLabel(tx)}</Typography>
            </Box>
            <Divider />
          </>
        )}

        {isP2pReceive && meta.voucher_code && (
          <>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Coupon Code</Typography>
              <Typography sx={{ fontSize: 12, color: "#2563EB", fontWeight: 800 }}>{meta.voucher_code}</Typography>
            </Box>
            <Divider />
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Coupon Status</Typography>
              <Typography sx={{ fontSize: 12, color: isCouponUnredeemed ? "#B45309" : "#166534", fontWeight: 800 }}>
                {isCouponUnredeemed ? "Active (Not Redeemed)" : "Redeemed"}
              </Typography>
            </Box>
            <Divider />
          </>
        )}

        {grossVal !== undefined && grossVal !== null && (
          <>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Gross Amount</Typography>
              <Typography sx={{ fontSize: 12, color: "#0F172A", fontWeight: 800 }}>₹ {fmtAmount(grossVal)}</Typography>
            </Box>
            <Divider />
          </>
        )}

        {feeVal !== undefined && feeVal !== null && Number(feeVal) > 0 && (
          <>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Platform Tax / Fee</Typography>
              <Typography sx={{ fontSize: 12, color: "#DC2626", fontWeight: 800 }}>-₹ {fmtAmount(feeVal)}</Typography>
            </Box>
            <Divider />
          </>
        )}

        {netVal !== undefined && netVal !== null && (
          <>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Net Value</Typography>
              <Typography sx={{ fontSize: 12, color: "#059669", fontWeight: 900 }}>₹ {fmtAmount(netVal)}</Typography>
            </Box>
            <Divider />
          </>
        )}

        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Status</Typography>
          <Typography sx={{ fontSize: 12, color: "#166534", fontWeight: 800 }}>Completed</Typography>
        </Box>
      </Stack>

      <Button
        fullWidth
        variant="contained"
        onClick={onClose}
        sx={{
          mt: 2,
          py: 1.1,
          borderRadius: 2,
          fontWeight: 800,
          textTransform: "none",
          bgcolor: "#0F172A",
          "&:hover": { bgcolor: "#1E293B" },
        }}
      >
        Done
      </Button>
    </Drawer>
  );
}

function SectionList({ sections, fallbackRows = [], onRowClick }) {
  const empty =
    !sections ||
    sections.length === 0 ||
    sections.every((s) => !s.rows || s.rows.length === 0);

  if (empty) {
    if (Array.isArray(fallbackRows) && fallbackRows.length > 0) {
      return (
        <Stack spacing={1}>
          {fallbackRows.map((tx, i) => (
            <HistoryRow
              key={`${tx.id || i}-${tx.created_at || i}`}
              tx={tx}
              onClick={() => onRowClick && onRowClick(tx)}
            />
          ))}
        </Stack>
      );
    }
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 700 }}>
          No transactions found for this source or filter.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1.5}>
      {sections.map((sec, idx) => (
        <Box key={`${sec.title}-${idx}`}>
          <SectionHeader title={sec.title} total={sec.total} />
          <Stack spacing={1}>
            {sec.rows.map((tx, i) => (
              <HistoryRow
                key={`${tx.id || i}-${tx.created_at || i}`}
                tx={tx}
                onClick={() => onRowClick && onRowClick(tx)}
              />
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

function PhonePeFilterDrawer({
  open,
  onClose,
  datePreset,
  setDatePreset,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  flowFilter,
  setFlowFilter,
  sourceFilter,
  setSourceFilter,
  onReset,
}) {
  const datePresets = [
    { label: "All Time", value: "all" },
    { label: "Today", value: "today" },
    { label: "This Month", value: "this_month" },
    { label: "Last Month", value: "last_month" },
    { label: "Last 30 Days", value: "30_days" },
    { label: "Custom Range", value: "custom" },
  ];

  const flowOptions = [
    { label: "All", value: "ALL" },
    { label: "Money Received (+ Credits)", value: "CREDIT" },
    { label: "Self Account", value: "DEBIT" },
  ];

  const sourceOptions = [
    { label: "All Sources", value: "ALL" },
    { label: "Self blocks", value: "SELF_ACCOUNT" },
    { label: "Layer & Blocks", value: "LAYER" },
    { label: "Direct Bonus", value: "DIRECT" },
    { label: "P2P Transfer", value: "P2P" },
    { label: "Royalty Bonus", value: "ROYALTY" },
    { label: "Merchant & Captain", value: "MERCHANT_CAPTAIN" },
    { label: "Withdrawals", value: "WITHDRAWAL" },
  ];

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          p: { xs: 2, sm: 2.5 },
          pb: { xs: 4, sm: 3.5 },
          maxWidth: 560,
          mx: "auto",
          bgcolor: "#FFFFFF",
          boxShadow: "0 -12px 40px rgba(15,23,42,0.18)",
          maxHeight: "85vh",
          overflowY: "auto",
        },
      }}
    >
      <Box sx={{ width: 40, height: 4, bgcolor: "#CBD5E1", borderRadius: 2, mx: "auto", mb: 2 }} />

      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 17, fontWeight: 900, color: "#0F172A" }}>
            Filter Transactions
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#64748B" }}>
            PhonePe-style date range & source filters
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="small"
            onClick={onReset}
            sx={{ textTransform: "none", fontSize: 12, fontWeight: 700, color: "#DC2626" }}
          >
            Reset All
          </Button>
          <IconButton size="small" onClick={onClose}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </Box>

      {/* Section 1: Date Range */}
      <Box sx={{ mb: 2.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#1E293B", mb: 1 }}>
          📅 Date Range
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1.2 }}>
          {datePresets.map((p) => {
            const isSelected = datePreset === p.value;
            return (
              <Chip
                key={p.value}
                label={p.label}
                onClick={() => setDatePreset(p.value)}
                sx={{
                  fontWeight: 800,
                  fontSize: 12,
                  borderRadius: 999,
                  bgcolor: isSelected ? "#2563EB" : "#F1F5F9",
                  color: isSelected ? "#FFFFFF" : "#475569",
                  border: "1px solid",
                  borderColor: isSelected ? "#2563EB" : "#E2E8F0",
                  cursor: "pointer",
                }}
              />
            );
          })}
        </Box>

        {/* Custom Date Pickers */}
        {datePreset === "custom" && (
          <Paper elevation={0} sx={{ p: 1.5, bgcolor: "#F8FAFC", borderRadius: 2, border: "1px solid #E2E8F0", mt: 1 }}>
            <Typography sx={{ fontSize: 11.5, color: "#64748B", fontWeight: 700, mb: 1 }}>
              Pick Start Date and End Date
            </Typography>
            <Stack direction="row" spacing={1.2}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="From Date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ bgcolor: "#fff" }}
              />
              <TextField
                fullWidth
                size="small"
                type="date"
                label="To Date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ bgcolor: "#fff" }}
              />
            </Stack>
          </Paper>
        )}
      </Box>

      {/* Section 2: Transaction Flow */}
      <Box sx={{ mb: 2.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#1E293B", mb: 1 }}>
          ↕️ Transaction Flow
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8 }}>
          {flowOptions.map((f) => {
            const isSelected = flowFilter === f.value;
            return (
              <Chip
                key={f.value}
                label={f.label}
                onClick={() => setFlowFilter(f.value)}
                sx={{
                  fontWeight: 800,
                  fontSize: 12,
                  borderRadius: 999,
                  bgcolor: isSelected ? "#0F172A" : "#F1F5F9",
                  color: isSelected ? "#FFFFFF" : "#475569",
                  border: "1px solid",
                  borderColor: isSelected ? "#0F172A" : "#E2E8F0",
                  cursor: "pointer",
                }}
              />
            );
          })}
        </Box>
      </Box>

      {/* Section 3: Income Source / Category */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#1E293B", mb: 1 }}>
          🏷️ Source Category
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8 }}>
          {sourceOptions.map((s) => {
            const isSelected = sourceFilter === s.value;
            return (
              <Chip
                key={s.value}
                label={s.label}
                onClick={() => setSourceFilter(s.value)}
                sx={{
                  fontWeight: 800,
                  fontSize: 12,
                  borderRadius: 999,
                  bgcolor: isSelected ? "#2563EB" : "#F1F5F9",
                  color: isSelected ? "#FFFFFF" : "#475569",
                  border: "1px solid",
                  borderColor: isSelected ? "#2563EB" : "#E2E8F0",
                  cursor: "pointer",
                }}
              />
            );
          })}
        </Box>
      </Box>

      {/* Apply Button */}
      <Button
        fullWidth
        variant="contained"
        onClick={onClose}
        sx={{
          py: 1.3,
          borderRadius: 2.5,
          fontWeight: 800,
          fontSize: 14,
          textTransform: "none",
          bgcolor: "#2563EB",
          "&:hover": { bgcolor: "#1D4ED8" },
        }}
      >
        Apply Filters
      </Button>
    </Drawer>
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
  const [allTransactions, setAllTransactions] = useState([]);
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [selectedTx, setSelectedTx] = useState(null);
  const [txDetailOpen, setTxDetailOpen] = useState(false);
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

  // Recipient Verification State
  const [recipientValid, setRecipientValid] = useState(null); // null | true | false
  const [recipientChecking, setRecipientChecking] = useState(false);
  const [recipientInfo, setRecipientInfo] = useState(null);

  // PhonePe-Style Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [flowFilter, setFlowFilter] = useState("ALL"); // "ALL" | "CREDIT" | "DEBIT"
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Explicit Recipient Verification
  const handleVerifyRecipient = async () => {
    const val = String(p2pForm.recipient_phone || "").trim();
    if (!val) {
      setRecipientValid(false);
      setRecipientInfo(null);
      return;
    }
    setRecipientChecking(true);
    setRecipientValid(null);
    setRecipientInfo(null);
    try {
      let found = false;
      let info = null;

      // Check 1: Sponsor / Region lookup
      try {
        const res = await API.get("/accounts/regions/by-sponsor/", {
          params: { sponsor: val, level: "state" },
        });
        const sp = res?.data?.sponsor;
        if (sp && sp.username) {
          found = true;
          info = {
            name: sp.full_name || sp.username,
            username: sp.username,
            phone: sp.phone || sp.username,
            pincode: sp.pincode,
          };
        }
      } catch {}

      // Check 2: User hierarchy lookup fallback
      if (!found) {
        try {
          const res2 = await API.get("/accounts/hierarchy/", {
            params: { username: val },
          });
          const u = res2?.data?.user || res2?.data;
          if (u && (u.username || u.full_name)) {
            found = true;
            info = {
              name: u.full_name || u.username,
              username: u.username,
              phone: u.phone || u.username,
              pincode: u.pincode,
            };
          }
        } catch {}
      }

      if (found && info) {
        setRecipientValid(true);
        setRecipientInfo(info);
      } else {
        setRecipientValid(false);
        setRecipientInfo(null);
      }
    } catch {
      setRecipientValid(false);
      setRecipientInfo(null);
    } finally {
      setRecipientChecking(false);
    }
  };

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

      setAllTransactions(Array.isArray(data?.all_transactions) ? data.all_transactions : []);
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
  const [pocketType, setPocketType] = useState("withdrawal"); // "withdrawal" or "coupon"
  const [pocketAmount, setPocketAmount] = useState("");
  const [pocketOtpSent, setPocketOtpSent] = useState(false);
  const [pocketOtp, setPocketOtp] = useState("");
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
    if (pocketGross < 100) {
      setPocketError("Minimum transfer amount is ₹100.");
      return;
    }
    const avail = Number(top.main_income_balance || 0);
    if (pocketGross > avail) {
      setPocketError(`Insufficient balance. Available Main Wallet balance is ₹${fmtAmount(avail)}.`);
      return;
    }
    try {
      setPocketBusy(true);
      setPocketError("");
      setPocketSuccess("");

      await API.post("/accounts/wallet/transfer/request-otp/", {
        transfer_type: pocketType,
        amount: pocketGross,
      });

      setPocketOtpSent(true);
      setPocketSuccess(
        `OTP sent to your registered email to confirm transfer of ₹${fmtAmount(pocketGross)} to ${pocketType === "withdrawal" ? "Withdrawable Pocket" : "P2P Coupon Pocket"}.`
      );
    } catch (err) {
      setPocketError(err?.response?.data?.detail || "Failed to process transfer OTP.");
    } finally {
      setPocketBusy(false);
    }
  };

  const handleConfirmPocketOtp = async () => {
    if (!pocketOtp.trim()) {
      setPocketError("Please enter the 6-digit OTP.");
      return;
    }
    try {
      setPocketBusy(true);
      setPocketError("");
      setPocketSuccess("");

      await API.post("/accounts/wallet/transfer/confirm-otp/", {
        transfer_type: pocketType,
        otp: pocketOtp.trim(),
      });

      setPocketSuccess(
        `Successfully transferred ₹${fmtAmount(pocketNet)} into ${pocketType === "withdrawal" ? "Withdrawable Pocket" : "P2P Coupon Pocket"} (${pocketTaxPercent}% Tax: ₹${fmtAmount(pocketTax)})!`
      );
      setPocketAmount("");
      setPocketOtp("");
      setPocketOtpSent(false);
      fetchHistory();
    } catch (err) {
      setPocketError(err?.response?.data?.detail || "Failed to confirm transfer.");
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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (datePreset !== "all" || customStartDate || customEndDate) count++;
    if (flowFilter !== "ALL") count++;
    if (sourceFilter !== "ALL") count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [datePreset, customStartDate, customEndDate, flowFilter, sourceFilter, searchQuery]);

  const handleResetFilters = () => {
    setDatePreset("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setFlowFilter("ALL");
    setSourceFilter("ALL");
    setSearchQuery("");
  };

  const isTxInDateRange = (txDateStr) => {
    if (!txDateStr) return false;
    const txDate = new Date(txDateStr);

    if (datePreset === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return txDate >= today;
    }
    if (datePreset === "this_month") {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return txDate >= startOfMonth;
    }
    if (datePreset === "last_month") {
      const now = new Date();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return txDate >= startOfLastMonth && txDate <= endOfLastMonth;
    }
    if (datePreset === "30_days") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      d.setHours(0, 0, 0, 0);
      return txDate >= d;
    }
    if (datePreset === "custom" || customStartDate || customEndDate) {
      if (customStartDate) {
        const start = new Date(customStartDate + "T00:00:00");
        if (txDate < start) return false;
      }
      if (customEndDate) {
        const end = new Date(customEndDate + "T23:59:59");
        if (txDate > end) return false;
      }
      return true;
    }
    return true; // "all"
  };

  const rawTransactions = useMemo(() => {
    const list = Array.isArray(allTransactions) && allTransactions.length > 0
      ? allTransactions
      : [...mainWallet, ...incoming, ...selfAccount, ...redeem];

    const map = new Map();
    list.forEach((tx) => {
      if (!tx) return;
      const key = `${tx.id || ""}_${tx.type || ""}_${tx.created_at || ""}`;
      if (!map.has(key)) {
        map.set(key, tx);
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const da = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
  }, [allTransactions, mainWallet, incoming, selfAccount, redeem]);

  const dateFilteredTransactions = useMemo(() => {
    return rawTransactions.filter((tx) => isTxInDateRange(tx?.created_at));
  }, [rawTransactions, datePreset, customStartDate, customEndDate]);

  const categoryCounts = useMemo(() => {
    const counts = {
      ALL: dateFilteredTransactions.length,
      SELF_ACCOUNT: 0,
      LAYER: 0,
      DIRECT: 0,
      P2P: 0,
      ROYALTY: 0,
      MERCHANT_CAPTAIN: 0,
      WITHDRAWAL: 0,
    };
    dateFilteredTransactions.forEach((tx) => {
      const cat = classifyTransaction(tx);
      if (counts[cat] !== undefined) {
        counts[cat] += 1;
      }
    });
    return counts;
  }, [dateFilteredTransactions]);

  const filteredTransactions = useMemo(() => {
    return dateFilteredTransactions.filter((tx) => {
      const amt = Number(tx?.amount || 0);
      const type = String(tx?.type || "");
      const meta = tx?.meta || {};
      const isSelf = type === "SELF_ACCOUNT_CREDIT" || type === "SELF_ACCOUNT_DEBIT" || meta?.ledger === "SELF_ACCOUNT";

      // Flow filter
      if (flowFilter === "CREDIT" && (isSelf || amt < 0)) return false;
      if (flowFilter === "DEBIT" && !isSelf) return false;

      // Source filter
      if (sourceFilter !== "ALL" && classifyTransaction(tx) !== sourceFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const title = describeSource(tx).toLowerCase();
        const counterparty = counterpartyLabel(tx).toLowerCase();
        const idStr = String(tx?.id || "").toLowerCase();
        const amtStr = String(Math.abs(amt));
        const phoneMeta = String(tx?.meta?.recipient_phone || tx?.meta?.sender_phone || tx?.meta?.username || "").toLowerCase();
        if (
          !title.includes(q) &&
          !counterparty.includes(q) &&
          !idStr.includes(q) &&
          !amtStr.includes(q) &&
          !phoneMeta.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [dateFilteredTransactions, flowFilter, sourceFilter, searchQuery]);

  const sections = useMemo(() => groupByMonth(filteredTransactions), [filteredTransactions]);

  const ledgerSummary = useMemo(() => {
    let mainCredits = 0;
    let mainCount = 0;
    let selfCredits = 0;
    let selfDebits = 0;
    let selfCount = 0;
    let creditCount = 0;

    (allTransactions || []).forEach((tx) => {
      const raw = Number(tx?.amount || 0);
      const meta = tx?.meta || {};
      const type = String(tx?.type || "");
      const isSelf = type === "SELF_ACCOUNT_CREDIT" || type === "SELF_ACCOUNT_DEBIT" || meta?.ledger === "SELF_ACCOUNT";
      const isP2pReceive = tx?.type === "P2P_PACKAGE_COUPON_RECEIVE";
      const amt = isP2pReceive && raw === 0 ? Number(meta.net_amount ?? meta.gross_amount ?? 0) : raw;

      if (isSelf) {
        if (amt > 0) {
          selfCredits += amt;
          creditCount += 1;
        } else {
          selfDebits += Math.abs(amt);
        }
        selfCount += 1;
      } else if (amt > 0) {
        mainCredits += amt;
        mainCount += 1;
        creditCount += 1;
      }
    });

    // 100% Total Gross Credits = Combination of Main Credits (75%) + Self Account Credits (25%)
    // (Never reduced by ₹250 rebirth debits or withdrawals)
    const totalCredits = mainCredits + selfCredits;
    const selfBalance = Number(top.self_account_balance || (selfCredits - selfDebits));

    return { totalCredits, creditCount, mainCredits, mainCount, selfCredits, selfDebits, totalSelf: selfBalance, selfCount };
  }, [allTransactions, top.self_account_balance]);

  const dateLabel = useMemo(() => {
    if (datePreset === "all") return "All Time";
    if (datePreset === "today") return "Today";
    if (datePreset === "this_month") return "This Month";
    if (datePreset === "last_month") return "Last Month";
    if (datePreset === "30_days") return "Last 30 Days";
    if (datePreset === "custom") {
      if (customStartDate && customEndDate) return `${customStartDate} to ${customEndDate}`;
      if (customStartDate) return `From ${customStartDate}`;
      if (customEndDate) return `Up to ${customEndDate}`;
      return "Custom Range";
    }
    return "All Time";
  }, [datePreset, customStartDate, customEndDate]);

  const flowLabel = useMemo(() => {
    if (flowFilter === "CREDIT") return "Money Received (+)";
    if (flowFilter === "DEBIT") return "Self Account";
    return "All Flows";
  }, [flowFilter]);

  const sourceLabel = useMemo(() => {
    const map = {
      ALL: "All Sources",
      SELF_ACCOUNT: "Self blocks",
      LAYER: "Layer & Blocks",
      DIRECT: "Direct Bonus",
      P2P: "P2P Transfer",
      ROYALTY: "Royalty Bonus",
      MERCHANT_CAPTAIN: "Merchant & Captain",
      WITHDRAWAL: "Withdrawals",
    };
    return map[sourceFilter] || "All Sources";
  }, [sourceFilter]);

  const earningsBreakdown = useMemo(() => {
    let direct_referral = 0;
    let matrix_autopool = 0;
    let franchise_captain = 0;
    let royalty_total = 0;

    rawTransactions.forEach((tx) => {
      const cat = classifyTransaction(tx);
      const amt = Number(tx?.amount || tx?.meta?.gross || 0);
      if (amt <= 0) return;

      if (cat === "DIRECT") {
        direct_referral += amt;
      } else if (cat === "LAYER") {
        matrix_autopool += amt;
      } else if (cat === "ROYALTY") {
        royalty_total += amt;
      } else if (cat === "MERCHANT_CAPTAIN") {
        franchise_captain += amt;
      }
    });

    const topLevel = Number(top.level_earnings_total || 0);
    if (topLevel > matrix_autopool) {
      matrix_autopool = topLevel;
    }

    return {
      direct_referral,
      matrix_autopool,
      franchise_captain,
      royalty_total,
    };
  }, [rawTransactions, top.level_earnings_total]);

  const todaysEarnings = useMemo(() => {
    if (top.today_bonus_100 !== undefined && top.today_bonus_100 !== null) {
      return Number(top.today_bonus_100);
    }
    if (top.today_main_75 !== undefined && top.today_main_75 !== null) {
      return Number(top.today_main_75);
    }
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return rawTransactions
      .filter((tx) => new Date(tx.created_at) >= startOfToday && Number(tx.amount) > 0)
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  }, [top, rawTransactions]);

  const yesterdaysEarnings = useMemo(() => {
    if (top.yesterday_bonus_100 !== undefined && top.yesterday_bonus_100 !== null) {
      return Number(top.yesterday_bonus_100);
    }
    if (top.yesterday_main_75 !== undefined && top.yesterday_main_75 !== null) {
      return Number(top.yesterday_main_75);
    }
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const endOfYesterday = new Date(startOfToday);
    endOfYesterday.setMilliseconds(-1);
    return rawTransactions
      .filter((tx) => {
        const txDate = new Date(tx.created_at);
        return txDate >= startOfYesterday && txDate <= endOfYesterday && Number(tx.amount) > 0;
      })
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  }, [top, rawTransactions]);

  return (
    <Box
      sx={{
        bgcolor: "#F4F7FC",
        minHeight: "100dvh",
        position: "relative",
        pb: { xs: 12, sm: 14 },
      }}
    >
      <PremiumScreenHeader
        title="Transaction History"
        onBack={() => navigate(-1)}
        onNotifications={() => {
          try {
            window.dispatchEvent(new CustomEvent("trikonekt:open-consumer-sidebar"));
          } catch (_) {}
        }}
        onSecondary={() => navigate("/user/spp-gift-cards")}
        hasBackdrop={true}
      />

      <Box
        sx={{
          maxWidth: 600,
          mx: "auto",
          px: { xs: 2, sm: 2.5 },
          pt: 1,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* 1. MAIN WALLET HERO CARD */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.2, sm: 2.5 },
            borderRadius: "22px",
            mb: 1.8,
            position: "relative",
            overflow: "hidden",
            background: "linear-gradient(135deg, #07152E 0%, #091E3A 40%, #0256B4 100%)",
            color: "#FFFFFF",
            boxShadow: "0 14px 34px -8px rgba(2, 86, 180, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.14)",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "14px",
                bgcolor: "rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(12px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                flexShrink: 0,
              }}
            >
              <AccountBalanceWalletIcon sx={{ fontSize: 24, color: "#FFFFFF" }} />
            </Box>
            <Box>
              <Typography sx={{ color: "rgba(255, 255, 255, 0.8)", fontWeight: 700, fontSize: 11.5, letterSpacing: 0.3 }}>
                Main Wallet Balance
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: 26, sm: 30 },
                  fontWeight: 900,
                  lineHeight: 1.1,
                  mt: 0.2,
                  color: "#FFFFFF",
                  letterSpacing: "-0.5px",
                }}
              >
                ₹ {fmtAmount(top.main_income_balance)}
              </Typography>
            </Box>
          </Stack>

          {/* 3 Action Buttons Inside Card - Sleek & Compact */}
          <Stack direction="row" spacing={1} sx={{ mt: 1.8 }}>
            <Button
              size="small"
              variant="contained"
              startIcon={<ArrowUpwardIcon sx={{ fontSize: 14 }} />}
              onClick={() => {
                setDrawerMode("pockets");
                setPocketType("withdrawal");
                setActionDrawerOpen(true);
              }}
              sx={{
                flex: 1.2,
                py: 0.6,
                minHeight: 36,
                fontSize: { xs: 10.5, sm: 11.5 },
                fontWeight: 800,
                textTransform: "none",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #059669 0%, #10B981 100%)",
                boxShadow: "0 2px 8px rgba(5, 150, 105, 0.3)",
                color: "#FFFFFF",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                whiteSpace: "nowrap",
                "&:hover": { background: "linear-gradient(135deg, #047857 0%, #059669 100%)" },
              }}
            >
              Withdraw Wallet
            </Button>

            <Button
              size="small"
              variant="contained"
              startIcon={<RedeemIcon sx={{ fontSize: 14 }} />}
              onClick={() => {
                setDrawerMode("pockets");
                setPocketType("coupon");
                setActionDrawerOpen(true);
              }}
              sx={{
                flex: 1.1,
                py: 0.6,
                minHeight: 36,
                fontSize: { xs: 10.5, sm: 11.5 },
                fontWeight: 800,
                textTransform: "none",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #0284C7 0%, #0256B4 100%)",
                boxShadow: "0 2px 8px rgba(2, 86, 180, 0.3)",
                color: "#FFFFFF",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                whiteSpace: "nowrap",
                "&:hover": { background: "linear-gradient(135deg, #0369A1 0%, #0047AB 100%)" },
              }}
            >
              P2P Coupon
            </Button>

            <Button
              size="small"
              variant="contained"
              onClick={() => {
                setDrawerMode("menu");
                setActionDrawerOpen(true);
              }}
              sx={{
                minWidth: 38,
                height: 36,
                p: 0,
                fontSize: 11,
                fontWeight: 800,
                textTransform: "none",
                borderRadius: "10px",
                bgcolor: "rgba(255, 255, 255, 0.16)",
                backdropFilter: "blur(8px)",
                color: "#FFFFFF",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                "&:hover": { bgcolor: "rgba(255, 255, 255, 0.25)" },
              }}
            >
              <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
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
              Move to Pockets & Wallet Actions
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
            variant={drawerMode === "withdrawal" || drawerMode === "pockets" || drawerMode === "coupon" ? "contained" : "outlined"}
            onClick={() => { setDrawerMode("pockets"); }}
            sx={{
              flex: 1.2,
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 800,
              fontSize: 12,
              bgcolor: drawerMode === "withdrawal" || drawerMode === "pockets" || drawerMode === "coupon" ? "#0256B4" : "transparent",
              borderColor: "#0256B4",
              color: drawerMode === "withdrawal" || drawerMode === "pockets" || drawerMode === "coupon" ? "#fff" : "#0256B4",
            }}
          >
            Transfer from Wallet
          </Button>
          <Button
            size="small"
            variant={drawerMode === "p2p" ? "contained" : "outlined"}
            onClick={() => setDrawerMode("p2p")}
            sx={{
              flex: 1,
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 800,
              fontSize: 12,
              bgcolor: drawerMode === "p2p" ? "#0066E6" : "transparent",
              borderColor: "#0066E6",
              color: drawerMode === "p2p" ? "#fff" : "#0066E6",
            }}
          >
            P2P Send ({p2pTaxPercent}%)
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
              fontSize: 12,
              bgcolor: drawerMode === "menu" ? "#0F172A" : "transparent",
              borderColor: "#CBD5E1",
              color: drawerMode === "menu" ? "#fff" : "#475569",
            }}
          >
            Quick Links
          </Button>
        </Stack>

        {/* Unified Transfer from Main Wallet Sheet */}
        {(drawerMode === "withdrawal" || drawerMode === "pockets" || drawerMode === "coupon") && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0F172A", mb: 1 }}>
              Select Destination
            </Typography>

            {/* Destination Selection Cards */}
            <Grid container spacing={1.2} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <Paper
                  elevation={0}
                  onClick={() => setPocketType("withdrawal")}
                  sx={{
                    p: 1.5,
                    borderRadius: "14px",
                    cursor: "pointer",
                    border: "2px solid",
                    borderColor: pocketType === "withdrawal" ? "#059669" : "#E2E8F0",
                    bgcolor: pocketType === "withdrawal" ? "#ECFDF5" : "#FFFFFF",
                    transition: "all 140ms ease",
                  }}
                >
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: pocketType === "withdrawal" ? "#059669" : "#0F172A" }}>
                    Withdrawable Wallet
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: "#64748B", mt: 0.3 }}>
                    Bank payout • 10% TDS
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={6}>
                <Paper
                  elevation={0}
                  onClick={() => setPocketType("coupon")}
                  sx={{
                    p: 1.5,
                    borderRadius: "14px",
                    cursor: "pointer",
                    border: "2px solid",
                    borderColor: pocketType === "coupon" ? "#0256B4" : "#E2E8F0",
                    bgcolor: pocketType === "coupon" ? "#EFF6FF" : "#FFFFFF",
                    transition: "all 140ms ease",
                  }}
                >
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: pocketType === "coupon" ? "#0256B4" : "#0F172A" }}>
                    P2P Coupon Wallet
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: "#64748B", mt: 0.3 }}>
                    P2P transfer • 7% Fee
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {Number(top.main_income_balance) < 100 && (
              <Alert severity="info" sx={{ mb: 1.5, borderRadius: 2, fontSize: 12.5 }}>
                Minimum ₹100 in Main Wallet is required to transfer funds.
              </Alert>
            )}

            {pocketError && <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2, fontSize: 12.5 }}>{pocketError}</Alert>}
            {pocketSuccess && <Alert severity="success" sx={{ mb: 1.5, borderRadius: 2, fontSize: 12.5 }}>{pocketSuccess}</Alert>}

            {!pocketOtpSent ? (
              <Stack spacing={1.5}>
                <Box>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#334155", mb: 0.6 }}>
                    Enter Amount
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Min ₹100"
                    type="number"
                    value={pocketAmount}
                    onChange={(e) => {
                      setPocketAmount(e.target.value);
                      setPocketError("");
                    }}
                    disabled={Number(top.main_income_balance) < 100}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                      endAdornment: (
                        <Button
                          size="small"
                          onClick={() => {
                            setPocketAmount(String(fmtAmount(top.main_income_balance)));
                            setPocketError("");
                          }}
                          sx={{ fontWeight: 800, fontSize: 11.5, minWidth: 44, color: "#0256B4" }}
                        >
                          MAX
                        </Button>
                      ),
                    }}
                    sx={{ bgcolor: "#FFFFFF", borderRadius: "12px" }}
                  />
                  <Typography sx={{ fontSize: 11.5, color: "#64748B", mt: 0.5 }}>
                    Available Balance: ₹ {fmtAmount(top.main_income_balance)}
                  </Typography>
                </Box>

                {pocketGross > 0 && (
                  <Box sx={{ p: 1.4, bgcolor: "#F8FAFC", borderRadius: "14px", border: "1px solid #E2E8F0" }}>
                    <Stack spacing={0.5}>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography sx={{ fontSize: 12, color: "#64748B" }}>Gross Amount:</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>₹ {pocketGross.toFixed(2)}</Typography>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography sx={{ fontSize: 12, color: "#DC2626" }}>{pocketTaxPercent}% Tax / Platform Fee:</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#DC2626" }}>- ₹ {pocketTax.toFixed(2)}</Typography>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", pt: 0.5, borderTop: "1px dashed #CBD5E1" }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "#059669" }}>Net Credited to Destination:</Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#059669" }}>₹ {pocketNet.toFixed(2)}</Typography>
                      </Box>
                    </Stack>
                  </Box>
                )}

                <Button
                  fullWidth
                  variant="contained"
                  disabled={pocketBusy || pocketGross < 100 || pocketGross > Number(top.main_income_balance || 0) || Number(top.main_income_balance) < 100}
                  onClick={handlePocketTransfer}
                  sx={{
                    py: 1.25,
                    borderRadius: "14px",
                    fontWeight: 800,
                    fontSize: 13.5,
                    textTransform: "none",
                    background: "linear-gradient(135deg, #0256B4 0%, #0066E6 100%)",
                    "&:hover": { background: "linear-gradient(135deg, #0047AB 0%, #0256B4 100%)" },
                  }}
                >
                  {pocketBusy ? "Sending OTP..." : "Continue →"}
                </Button>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                <TextField
                  fullWidth
                  size="small"
                  label="Enter 6-Digit Email OTP"
                  placeholder="e.g. 123456"
                  value={pocketOtp}
                  onChange={(e) => {
                    setPocketOtp(e.target.value);
                    setPocketError("");
                  }}
                  sx={{ bgcolor: "#fff", borderRadius: 2 }}
                />
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setPocketOtpSent(false);
                      setPocketOtp("");
                    }}
                    sx={{ borderRadius: "12px", textTransform: "none", fontWeight: 700 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    fullWidth
                    variant="contained"
                    disabled={pocketBusy || !pocketOtp.trim()}
                    onClick={handleConfirmPocketOtp}
                    sx={{
                      borderRadius: "12px",
                      fontWeight: 800,
                      textTransform: "none",
                      bgcolor: "#059669",
                      "&:hover": { bgcolor: "#047857" },
                    }}
                  >
                    {pocketBusy ? "Verifying..." : "Confirm & Credit Pocket"}
                  </Button>
                </Stack>
              </Stack>
            )}
          </Box>
        )}

        {/* Drawer Mode 1: P2P Transfer */}
        {drawerMode === "p2p" && (
          <Box sx={{ bgcolor: "#F8FAFC", p: 2, borderRadius: 3, border: "1px solid #E2E8F0", mb: 2 }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A", mb: 0.5 }}>
              Instant Peer-to-Peer Transfer
            </Typography>
            <Typography sx={{ fontSize: 12, color: "#64748B", mb: 1.5 }}>
              Transfers package coupon directly to another verified member with {p2pTaxPercent}% GST/Fee deducted.
            </Typography>

            {p2pError && <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2, fontSize: 12.5 }}>{p2pError}</Alert>}
            {p2pSuccess && <Alert severity="success" sx={{ mb: 1.5, borderRadius: 2, fontSize: 12.5 }}>{p2pSuccess}</Alert>}

            <Stack spacing={1.5}>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    fullWidth
                    size="small"
                    label="Recipient Phone Number or User ID"
                    placeholder="Enter 10-digit mobile number"
                    value={p2pForm.recipient_phone}
                    onChange={(e) => {
                      setP2pForm({ ...p2pForm, recipient_phone: e.target.value });
                      setP2pError("");
                      setRecipientValid(null);
                      setRecipientInfo(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleVerifyRecipient();
                      }
                    }}
                    inputProps={{ maxLength: 15 }}
                    sx={{ bgcolor: "#fff", borderRadius: 2 }}
                  />
                  <Button
                    variant="contained"
                    disabled={recipientChecking || !p2pForm.recipient_phone.trim()}
                    onClick={handleVerifyRecipient}
                    sx={{
                      py: 1,
                      px: 2,
                      borderRadius: 2,
                      textTransform: "none",
                      fontWeight: 800,
                      fontSize: "12.5px",
                      bgcolor: "#0F172A",
                      "&:hover": { bgcolor: "#1E293B" },
                      whiteSpace: "nowrap",
                      minWidth: 80,
                    }}
                  >
                    {recipientChecking ? <CircularProgress size={14} color="inherit" /> : "Verify"}
                  </Button>
                </Stack>

                {!recipientChecking && recipientValid === true && recipientInfo && (
                  <Paper
                    elevation={0}
                    sx={{
                      mt: 1,
                      p: 1,
                      px: 1.2,
                      borderRadius: 2,
                      bgcolor: "#ECFDF5",
                      border: "1px solid #A7F3D0",
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <CheckCircleRoundedIcon sx={{ color: "#059669", fontSize: 18 }} />
                    <Box>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#065F46" }}>
                        Verified: {recipientInfo.name}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#047857" }}>
                        ID/Phone: {recipientInfo.username} {recipientInfo.pincode ? `• PIN: ${recipientInfo.pincode}` : ""}
                      </Typography>
                    </Box>
                  </Paper>
                )}

                {!recipientChecking && recipientValid === false && (
                  <Typography sx={{ fontSize: 11.5, color: "#DC2626", fontWeight: 600, mt: 0.8, px: 0.5 }}>
                    ⚠ Recipient not found. Please verify the mobile number or user ID.
                  </Typography>
                )}
              </Box>

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
                      <Typography sx={{ fontSize: 12, color: "#DC2626" }}>Transfer Fee / Tax ({p2pTaxPercent}%):</Typography>
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
                disabled={p2pBusy || p2pGross <= 0 || !p2pForm.recipient_phone.trim() || recipientValid !== true}
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
                {p2pBusy ? "Processing Transfer..." : recipientValid === true ? `Transfer ₹${p2pGross > 0 ? fmtAmount(p2pGross) : "0.00"} (Net: ₹${fmtAmount(p2pNet)})` : "Verify Recipient to Transfer"}
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
                  E-edu Agent Academy
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

      {/* 2. TOTAL CREDITS & SELF ACCOUNT SUMMARY CARDS */}
      <Grid container spacing={1.5} sx={{ mb: 1.8 }}>
        <Grid item xs={6}>
          <Paper
            elevation={0}
            sx={{
              p: 1.8,
              borderRadius: "18px",
              bgcolor: "#FFFFFF",
              border: "1px solid #EEF2F6",
              boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  bgcolor: "#ECFDF5",
                  color: "#059669",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid #A7F3D0",
                }}
              >
                <ArrowUpwardIcon sx={{ fontSize: 16 }} />
              </Box>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>
                Total Credits
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: { xs: 20, sm: 22 }, fontWeight: 900, color: "#059669", letterSpacing: "-0.02em" }}>
              ₹ {fmtAmount(ledgerSummary.totalCredits)}
            </Typography>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", mt: 0.2 }}>
              {ledgerSummary.creditCount} transactions
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={6}>
          <Paper
            elevation={0}
            sx={{
              p: 1.8,
              borderRadius: "18px",
              bgcolor: "#FFFFFF",
              border: "1px solid #EEF2F6",
              boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  bgcolor: "#F5F3FF",
                  color: "#7C3AED",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid #DDD6FE",
                }}
              >
                <SavingsIcon sx={{ fontSize: 16 }} />
              </Box>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>
                Self Account
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: { xs: 20, sm: 22 }, fontWeight: 900, color: "#7C3AED", letterSpacing: "-0.02em" }}>
              ₹ {fmtAmount(Number(top.self_account_balance || 0) > 0 ? top.self_account_balance : ledgerSummary.totalSelf)}
            </Typography>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", mt: 0.2 }}>
              {ledgerSummary.selfCount} transactions
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* 3. SEARCH + HORIZONTAL FILTER BAR */}
      <Stack spacing={1.2} sx={{ mb: 1.8 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            fullWidth
            size="small"
            placeholder="Search by name, phone, reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ color: "#0256B4", fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery("")} sx={{ p: 0.5 }}>
                    <CloseRoundedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
              sx: {
                borderRadius: "24px",
                bgcolor: "#FFFFFF",
                fontSize: 13,
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
                "& fieldset": { borderColor: "#E2E8F0" },
                "&:hover fieldset": { borderColor: "#CBD5E1" },
                "&.Mui-focused fieldset": { borderColor: "#0256B4" },
              },
            }}
          />

          <Button
            variant="outlined"
            onClick={() => setFilterDrawerOpen(true)}
            startIcon={
              <Badge
                badgeContent={activeFilterCount}
                color="error"
                sx={{
                  "& .MuiBadge-badge": {
                    fontSize: 10,
                    height: 16,
                    minWidth: 16,
                    top: -2,
                    right: -2,
                  },
                }}
              >
                <TuneRoundedIcon sx={{ fontSize: 18, color: activeFilterCount > 0 ? "#0256B4" : "#475569" }} />
              </Badge>
            }
            sx={{
              height: 40,
              minWidth: 96,
              borderRadius: "24px",
              textTransform: "none",
              fontWeight: 800,
              fontSize: 12.5,
              bgcolor: activeFilterCount > 0 ? "#EFF6FF" : "#FFFFFF",
              borderColor: activeFilterCount > 0 ? "#0256B4" : "#E2E8F0",
              color: activeFilterCount > 0 ? "#0256B4" : "#334155",
              boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
              flexShrink: 0,
              "&:hover": { borderColor: "#0256B4", bgcolor: "#EFF6FF" },
            }}
          >
            Filters
          </Button>
        </Stack>

        {/* Horizontally Scrolling Filter Chips */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.8,
            overflowX: "auto",
            pb: 0.4,
            "&::-webkit-scrollbar": { display: "none" },
            scrollbarWidth: "none",
          }}
        >
          <Chip
            icon={<CalendarMonthRoundedIcon sx={{ fontSize: "14px !important" }} />}
            label={`Date: ${dateLabel} ▾`}
            onClick={() => setFilterDrawerOpen(true)}
            sx={{
              fontWeight: 700,
              fontSize: 11,
              borderRadius: "999px",
              bgcolor: datePreset !== "all" ? "#EFF6FF" : "#FFFFFF",
              color: datePreset !== "all" ? "#1D4ED8" : "#475569",
              border: "1px solid",
              borderColor: datePreset !== "all" ? "#3B82F6" : "#E2E8F0",
              cursor: "pointer",
            }}
          />

          <Chip
            label={flowFilter === "ALL" ? "Flow: All ▾" : `Flow: ${flowLabel} ▾`}
            onClick={() => setFilterDrawerOpen(true)}
            sx={{
              fontWeight: 700,
              fontSize: 11,
              borderRadius: "999px",
              bgcolor: flowFilter !== "ALL" ? "#F5F3FF" : "#FFFFFF",
              color: flowFilter !== "ALL" ? "#7C3AED" : "#475569",
              border: "1px solid",
              borderColor: flowFilter !== "ALL" ? "#8B5CF6" : "#E2E8F0",
              cursor: "pointer",
            }}
          />

          <Chip
            label={sourceFilter === "ALL" ? "Source: All ▾" : `Source: ${sourceLabel} ▾`}
            onClick={() => setFilterDrawerOpen(true)}
            sx={{
              fontWeight: 700,
              fontSize: 11,
              borderRadius: "999px",
              bgcolor: sourceFilter !== "ALL" ? "#F0FDF4" : "#FFFFFF",
              color: sourceFilter !== "ALL" ? "#15803D" : "#475569",
              border: "1px solid",
              borderColor: sourceFilter !== "ALL" ? "#22C55E" : "#E2E8F0",
              cursor: "pointer",
            }}
          />

          <Chip
            label="Wallet: All ▾"
            onClick={() => setFilterDrawerOpen(true)}
            sx={{
              fontWeight: 700,
              fontSize: 11,
              borderRadius: "999px",
              bgcolor: "#FFFFFF",
              color: "#475569",
              border: "1px solid #E2E8F0",
              cursor: "pointer",
            }}
          />

          <Chip
            label="Category: All ▾"
            onClick={() => setFilterDrawerOpen(true)}
            sx={{
              fontWeight: 700,
              fontSize: 11,
              borderRadius: "999px",
              bgcolor: "#FFFFFF",
              color: "#475569",
              border: "1px solid #E2E8F0",
              cursor: "pointer",
            }}
          />

          {activeFilterCount > 0 && (
            <Chip
              label={`✕ Reset (${activeFilterCount})`}
              onClick={handleResetFilters}
              sx={{
                fontWeight: 700,
                fontSize: 11,
                borderRadius: "999px",
                bgcolor: "#FEF2F2",
                color: "#DC2626",
                border: "1px solid #FCA5A5",
                cursor: "pointer",
              }}
            />
          )}
        </Box>

        {/* Compact Segmented Tabs: All (X), Credits (X), Debits (X) */}
        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
          <Button
            size="small"
            onClick={() => setFlowFilter("ALL")}
            sx={{
              flex: 1,
              py: 0.7,
              borderRadius: "20px",
              fontSize: 12,
              fontWeight: 800,
              textTransform: "none",
              bgcolor: flowFilter === "ALL" ? "#0F172A" : "#FFFFFF",
              color: flowFilter === "ALL" ? "#FFFFFF" : "#64748B",
              border: "1px solid",
              borderColor: flowFilter === "ALL" ? "#0F172A" : "#E2E8F0",
              "&:hover": { bgcolor: flowFilter === "ALL" ? "#1E293B" : "#F8FAFC" },
            }}
          >
            All ({allTransactions.length})
          </Button>

          <Button
            size="small"
            onClick={() => setFlowFilter("CREDIT")}
            sx={{
              flex: 1,
              py: 0.7,
              borderRadius: "20px",
              fontSize: 12,
              fontWeight: 800,
              textTransform: "none",
              bgcolor: flowFilter === "CREDIT" ? "#059669" : "#FFFFFF",
              color: flowFilter === "CREDIT" ? "#FFFFFF" : "#64748B",
              border: "1px solid",
              borderColor: flowFilter === "CREDIT" ? "#059669" : "#E2E8F0",
              "&:hover": { bgcolor: flowFilter === "CREDIT" ? "#047857" : "#F8FAFC" },
            }}
          >
            Credits ({ledgerSummary.creditCount})
          </Button>

          <Button
            size="small"
            onClick={() => setFlowFilter("DEBIT")}
            sx={{
              flex: 1,
              py: 0.7,
              borderRadius: "20px",
              fontSize: 12,
              fontWeight: 800,
              textTransform: "none",
              bgcolor: flowFilter === "DEBIT" ? "#7C3AED" : "#FFFFFF",
              color: flowFilter === "DEBIT" ? "#FFFFFF" : "#64748B",
              border: "1px solid",
              borderColor: flowFilter === "DEBIT" ? "#7C3AED" : "#E2E8F0",
              "&:hover": { bgcolor: flowFilter === "DEBIT" ? "#6D28D9" : "#F8FAFC" },
            }}
          >
            Self Account ({ledgerSummary.selfCount})
          </Button>
        </Stack>
      </Stack>

      {/* 4. MONTHLY TRANSACTION GROUPING STREAM */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: "20px",
          border: "1px solid #EEF2F6",
          bgcolor: "#FFFFFF",
          p: { xs: 1.5, sm: 2 },
          overflow: "hidden",
          boxShadow: "0 2px 12px rgba(15, 23, 42, 0.04)",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.2, px: 0.5 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: "#0F172A" }}>
            Transactions ({filteredTransactions.length})
          </Typography>
          {activeFilterCount > 0 && (
            <Chip
              size="small"
              label="Reset Filters"
              onClick={handleResetFilters}
              sx={{ height: 20, fontSize: 10.5, fontWeight: 700, cursor: "pointer", bgcolor: "#F1F5F9" }}
            />
          )}
        </Box>

        {loading ? (
          <LinearProgress />
        ) : err ? (
          <Typography variant="body2" color="error">
            {err}
          </Typography>
        ) : (
          <SectionList
            sections={sections}
            fallbackRows={filteredTransactions}
            onRowClick={(tx) => {
              setSelectedTx(tx);
              setTxDetailOpen(true);
            }}
          />
        )}
      </Paper>

      {/* PhonePe Filter Bottom Sheet */}
      <PhonePeFilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        datePreset={datePreset}
        setDatePreset={setDatePreset}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        flowFilter={flowFilter}
        setFlowFilter={setFlowFilter}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
        onReset={handleResetFilters}
      />

      {/* Transaction Details Bottom Sheet */}
      <TxDetailDrawer
        open={txDetailOpen}
        onClose={() => setTxDetailOpen(false)}
        tx={selectedTx}
      />

      </Box>
    </Box>
  );
}
