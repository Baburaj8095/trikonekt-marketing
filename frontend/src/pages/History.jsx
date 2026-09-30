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
  if (type === "INCOME_CREDIT_75") {
    if (ot) {
      const parentLabel = describeSource({ ...tx, type: ot });
      return `${parentLabel}`;
    }
    return "Income Credited";
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

function classifyTransaction(tx) {
  const type = String(tx?.type || "").toUpperCase();
  const meta = tx?.meta || {};
  const src = String(meta.source || "").toUpperCase();
  const st = String(tx?.source_type || "").toUpperCase();
  const ot = String(meta.orig_type || "").toUpperCase();
  const trig = String(meta.trigger || "").toUpperCase();

  // 1. LAYER & AUTOPOOL
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

  // 2. DIRECT BONUS
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

  // 3. P2P TRANSFERS
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

  // 4. ROYALTY BONUS
  if (
    type === "GLOBAL_ROYALTY" ||
    type === "ROYALTY_BONUS" ||
    type === "GLOBAL_ACTIVATION_CREDIT" ||
    src.includes("ROYALTY") ||
    meta.club
  ) {
    return "ROYALTY";
  }

  // 5. MERCHANT, CAPTAIN & FRANCHISE
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

  // 6. WITHDRAWALS
  if (
    type === "WITHDRAWAL_DEBIT" ||
    type === "WITHDRAWABLE_CREDIT" ||
    type === "INTERNAL_WALLET_DEBIT" ||
    src.includes("WITHDRAW")
  ) {
    return "WITHDRAWAL";
  }

  // 7. REDEEM & POCKET / SELF ACCOUNT
  if (
    type.startsWith("SELF_ACCOUNT") ||
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

  const cat = classifyTransaction(tx);
  const catChipLabels = {
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
        p: 1.25,
        borderRadius: 2.2,
        border: "1px solid",
        borderColor: "#EEF2F6",
        bgcolor: "#fff",
        cursor: onClick ? "pointer" : "default",
        transition: "all 150ms ease",
        "&:hover": onClick
          ? {
              borderColor: "#CBD5E1",
              boxShadow: "0 4px 12px rgba(12, 45, 72, 0.05)",
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
            {cat && cat !== "OTHER" && (
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
          </Box>

          {counterpartyLabel(tx) ? (
            <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.2 }}>
              {counterpartyLabel(tx)}
            </Typography>
          ) : null}

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
  const amount = Number(tx?.amount || 0);
  const isCredit = amount >= 0;
  const meta = tx?.meta || {};
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
          <SectionHeader title={sec.title} />
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
    if (!cutoffDate) return rawTransactions;
    return rawTransactions.filter((tx) => tx?.created_at && new Date(tx.created_at) >= cutoffDate);
  }, [rawTransactions, cutoffDate]);

  const categoryCounts = useMemo(() => {
    const counts = {
      ALL: dateFilteredTransactions.length,
      LAYER: 0,
      DIRECT: 0,
      P2P: 0,
      ROYALTY: 0,
      MERCHANT_CAPTAIN: 0,
      WITHDRAWAL: 0,
      REDEEM: 0,
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
    if (sourceFilter === "ALL") return dateFilteredTransactions;
    return dateFilteredTransactions.filter((tx) => classifyTransaction(tx) === sourceFilter);
  }, [dateFilteredTransactions, sourceFilter]);

  const sections = useMemo(() => groupByDay(filteredTransactions), [filteredTransactions]);

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
          setTab(0);
          setActionDrawerOpen(true);
        }}
        sx={{
          p: 1.8,
          borderRadius: 2.5,
          mb: 1.5,
          border: "1px solid",
          borderColor: tab === 0 ? "primary.main" : "#EEF2F6",
          borderWidth: tab === 0 ? 2 : 1,
          bgcolor: "#fff",
          cursor: "pointer",
          transition: "all 0.2s ease",
          boxShadow: tab === 0 ? "0 4px 12px rgba(12, 45, 72, 0.12)" : "0 2px 6px rgba(0,0,0,0.03)",
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
              Main Wallet Balance (Tap for Actions)
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
              fontSize: 12,
              bgcolor: drawerMode === "p2p" ? "#2563EB" : "transparent",
              borderColor: "#2563EB",
              color: drawerMode === "p2p" ? "#fff" : "#2563EB",
            }}
          >
            P2P Send ({p2pTaxPercent}%)
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
              fontSize: 12,
              bgcolor: drawerMode === "redeem" ? "#7C3AED" : "transparent",
              borderColor: "#7C3AED",
              color: drawerMode === "redeem" ? "#fff" : "#7C3AED",
            }}
          >
            Redeem Coupon
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

        {/* Drawer Mode 2: Redeem Coupon */}
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
            {tab === 0 ? "Today's Earnings" : "Today's Self Reserve"}
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
            {tab === 0 ? "Yesterday's Earnings" : "Yesterday's Self Reserve"}
          </Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 900, color: "text.primary", mt: 0.2 }}>
            +₹ {fmtAmount(yesterdaysEarnings)}
          </Typography>
        </Paper>
      </Box>

      {/* Mini Cards (Withdrawable Pocket & Self Account) */}
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
          title="Withdrawable Pocket"
          value={`₹ ${fmtAmount(top.withdrawable_balance)}`}
          icon={<SavingsIcon fontSize="small" />}
          color="success"
          onClick={() => navigate("/user/withdrawal")}
          selected={false}
        />
        <MiniCard
          title="Self Account Balance"
          value={`₹ ${fmtAmount(top.self_account_balance)}`}
          icon={<AccountBalanceWalletIcon fontSize="small" />}
          color="warning"
          onClick={() => setTab(1)}
          selected={tab === 1}
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
            onClick={() => setSourceFilter(sourceFilter === "DIRECT" ? "ALL" : "DIRECT")}
            sx={{
              minWidth: 165,
              p: 1.3,
              borderRadius: 2.2,
              border: "2px solid",
              borderColor: sourceFilter === "DIRECT" ? "#2563EB" : "#EEF2F6",
              bgcolor: sourceFilter === "DIRECT" ? "#EFF6FF" : "#FFFFFF",
              cursor: "pointer",
              scrollSnapAlign: "start",
              transition: "all 0.15s ease",
              boxShadow: sourceFilter === "DIRECT" ? "0 4px 12px rgba(37, 99, 235, 0.15)" : "none",
              "&:hover": { borderColor: "#2563EB" },
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
              Package Direct
            </Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#2563EB", mt: 0.3 }}>
              ₹ {fmtAmount(earningsBreakdown.direct_referral || 0)}
            </Typography>
            <Chip size="small" label="E-edu & Prime Direct" sx={{ mt: 0.5, height: 18, fontSize: 10, bgcolor: sourceFilter === "DIRECT" ? "#DBEAFE" : "#EFF6FF", color: "#2563EB" }} />
          </Paper>

          {/* Card 2: Layer Matrix (5 & 3) */}
          <Paper
            elevation={0}
            onClick={() => setSourceFilter(sourceFilter === "LAYER" ? "ALL" : "LAYER")}
            sx={{
              minWidth: 165,
              p: 1.3,
              borderRadius: 2.2,
              border: "2px solid",
              borderColor: sourceFilter === "LAYER" ? "#7C3AED" : "#EEF2F6",
              bgcolor: sourceFilter === "LAYER" ? "#F5F3FF" : "#FFFFFF",
              cursor: "pointer",
              scrollSnapAlign: "start",
              transition: "all 0.15s ease",
              boxShadow: sourceFilter === "LAYER" ? "0 4px 12px rgba(124, 58, 237, 0.15)" : "none",
              "&:hover": { borderColor: "#7C3AED" },
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
              Layer 5 & 3 Blocks
            </Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#7C3AED", mt: 0.3 }}>
              ₹ {fmtAmount(earningsBreakdown.matrix_autopool || 0)}
            </Typography>
            <Chip size="small" label="5-Blocks & 3-Blocks" sx={{ mt: 0.5, height: 18, fontSize: 10, bgcolor: sourceFilter === "LAYER" ? "#EDE9FE" : "#F5F3FF", color: "#7C3AED" }} />
          </Paper>

          {/* Card 3: Direct Self Block Breakdown */}
          <Paper
            elevation={0}
            onClick={() => setSourceFilter(sourceFilter === "REDEEM" ? "ALL" : "REDEEM")}
            sx={{
              minWidth: 220,
              p: 1.3,
              borderRadius: 2.2,
              border: "2px solid",
              borderColor: sourceFilter === "REDEEM" ? "#059669" : "#EEF2F6",
              bgcolor: sourceFilter === "REDEEM" ? "#ECFDF5" : "#FFFFFF",
              cursor: "pointer",
              scrollSnapAlign: "start",
              transition: "all 0.15s ease",
              boxShadow: sourceFilter === "REDEEM" ? "0 4px 12px rgba(5, 150, 105, 0.15)" : "none",
              "&:hover": { borderColor: "#059669" },
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
            onClick={() => setSourceFilter(sourceFilter === "ROYALTY" ? "ALL" : "ROYALTY")}
            sx={{
              minWidth: 175,
              p: 1.3,
              borderRadius: 2.2,
              border: "2px solid",
              borderColor: sourceFilter === "ROYALTY" ? "#D97706" : "#EEF2F6",
              bgcolor: sourceFilter === "ROYALTY" ? "#FFFBEB" : "#FFFFFF",
              cursor: "pointer",
              scrollSnapAlign: "start",
              transition: "all 0.15s ease",
              boxShadow: sourceFilter === "ROYALTY" ? "0 4px 12px rgba(217, 119, 6, 0.15)" : "none",
              "&:hover": { borderColor: "#D97706" },
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
            onClick={() => setSourceFilter(sourceFilter === "MERCHANT_CAPTAIN" ? "ALL" : "MERCHANT_CAPTAIN")}
            sx={{
              minWidth: 165,
              p: 1.3,
              borderRadius: 2.2,
              border: "2px solid",
              borderColor: sourceFilter === "MERCHANT_CAPTAIN" ? "#059669" : "#EEF2F6",
              bgcolor: sourceFilter === "MERCHANT_CAPTAIN" ? "#ECFDF5" : "#FFFFFF",
              cursor: "pointer",
              scrollSnapAlign: "start",
              transition: "all 0.15s ease",
              boxShadow: sourceFilter === "MERCHANT_CAPTAIN" ? "0 4px 12px rgba(5, 150, 105, 0.15)" : "none",
              "&:hover": { borderColor: "#059669" },
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
              Franchise / Captain
            </Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#059669", mt: 0.3 }}>
              ₹ {fmtAmount(earningsBreakdown.franchise_captain || 0)}
            </Typography>
            <Chip size="small" label="Geo & Zonal Share" sx={{ mt: 0.5, height: 18, fontSize: 10, bgcolor: sourceFilter === "MERCHANT_CAPTAIN" ? "#D1FAE5" : "#ECFDF5", color: "#059669" }} />
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

      {/* Source Category Filter Chips Bar */}
      <Box sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#64748B", mb: 0.8, px: 0.5 }}>
          Filter By Source
        </Typography>
        <Box
          sx={{
            display: "flex",
            gap: 0.8,
            overflowX: "auto",
            pb: 0.5,
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {[
            { key: "ALL", label: `All (${categoryCounts.ALL})` },
            { key: "LAYER", label: `Layer & Blocks (${categoryCounts.LAYER})` },
            { key: "DIRECT", label: `Direct Bonus (${categoryCounts.DIRECT})` },
            { key: "P2P", label: `P2P Transfer (${categoryCounts.P2P})` },
            { key: "ROYALTY", label: `Royalty (${categoryCounts.ROYALTY})` },
            { key: "MERCHANT_CAPTAIN", label: `Merchant / Captain (${categoryCounts.MERCHANT_CAPTAIN})` },
            { key: "WITHDRAWAL", label: `Withdrawals (${categoryCounts.WITHDRAWAL})` },
            { key: "REDEEM", label: `Redeemed / Pocket (${categoryCounts.REDEEM})` },
          ].map((item) => {
            const isSelected = sourceFilter === item.key;
            return (
              <Chip
                key={item.key}
                label={item.label}
                onClick={() => setSourceFilter(item.key)}
                sx={{
                  fontWeight: 800,
                  fontSize: 11.5,
                  borderRadius: 999,
                  bgcolor: isSelected ? "#0F172A" : "#F1F5F9",
                  color: isSelected ? "#FFFFFF" : "#475569",
                  border: "1px solid",
                  borderColor: isSelected ? "#0F172A" : "#E2E8F0",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  "&:hover": {
                    bgcolor: isSelected ? "#1E293B" : "#E2E8F0",
                  },
                }}
              />
            );
          })}
        </Box>
      </Box>

      {/* Unified Transaction Stream List */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 2.5,
          border: "1px solid",
          borderColor: "#EEF2F6",
          bgcolor: "#fff",
          p: 1.2,
          overflow: "hidden",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.2, px: 0.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>
            Transactions ({filteredTransactions.length})
          </Typography>
          {sourceFilter !== "ALL" && (
            <Chip
              size="small"
              label="Reset Filter"
              onClick={() => setSourceFilter("ALL")}
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

      {/* Transaction Details Bottom Sheet */}
      <TxDetailDrawer
        open={txDetailOpen}
        onClose={() => setTxDetailOpen(false)}
        tx={selectedTx}
      />

      <Box sx={{ height: 16 }} />
    </Box>
  );
}
