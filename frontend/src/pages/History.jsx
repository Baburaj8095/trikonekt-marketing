import React, { useEffect, useMemo, useState } from "react";
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
      return Number.isFinite(lvl) && lvl > 0 ? `Rank Level ${lvl} Bonus` : "Rank Level Bonus";
    }
  }

  // Referral bonuses
  if (type === "DIRECT_REF_BONUS" || src === "JOIN_REFERRAL" || st === "JOIN_REFERRAL") {
    if (tier) return `Referral Bonus ${tier} Prime`;
    return "Referral Bonus";
  }

  // Prime self activations
  if (ot === "PRIME_150_SELF" || src === "PRIME_150_SELF" || type === "PRIME_150_SELF") return "Prime 150 Self Activation";
  if (ot === "PRIME_750_SELF" || src === "PRIME_750_SELF" || type === "PRIME_750_SELF") return "Prime 750 Self Activation";
  if (ot === "PRIME_759_SELF" || src === "PRIME_759_SELF" || type === "PRIME_759_SELF") return "Prime 1000 Self Activation";

  // Monthly 759 flows
  if (st === "MONTHLY_759" || src === "MONTHLY_759" || src.includes("759")) {
    if (src.startsWith("FIVE_MATRIX")) return "5 Matrix 1000 Prime";
    return "SPP 1000";
  }

  // Matrix autopool bonuses
  if (src.startsWith("THREE_MATRIX")) {
    const t = tier || (src.includes("150") ? 150 : src.includes("750") ? 750 : undefined);
    return `3 Matrix ${t || ""} Prime`.trim();
  }
  if (src.startsWith("FIVE_MATRIX")) {
    const t = tier || (src.includes("150") ? 150 : src.includes("750") ? 750 : src.includes("759") ? 759 : undefined);
    return `5 Matrix ${t || ""} Prime`.trim();
  }

  // Prime direct/self
  if (src === "PRIME_150" || st === "PRIME_150" || tier === 150) return "Prime 150";
  if (src === "PRIME_750" || st === "PRIME_750" || tier === 750) return "Prime 750";

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

function MiniCard({ title, value, icon, color = "primary" }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        minWidth: 150,
        flexShrink: 0,
        p: 1.2,
        borderRadius: 2.2,
        borderColor: "#EEF2F6",
        display: "flex",
        alignItems: "center",
        gap: 1.1,
        bgcolor: "#fff",
        scrollSnapAlign: "start", // âœ… for smooth horizontal snapping
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
    : `${describeSource(tx)}${Number.isFinite(levelVal) ? ` - Level ${levelVal}` : ""}`;

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
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [top, setTop] = useState({
    main_income_balance: "0.00",
    self_account_balance: "0.00",
    withdrawable_balance: "0.00",
    shopping_rewards_points: "0.00",
    redeem_points: "0.00",
  });

  const [incoming, setIncoming] = useState([]);
  const [selfAccount, setSelfAccount] = useState([]);
  const [cashback, setCashback] = useState([]);
  const [redeem, setRedeem] = useState([]);
  const [tab, setTab] = useState(0);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        const res = await API.get("/accounts/wallet/me/history/");
        const data = res?.data || {};
        if (!mounted) return;

        setTop({
          main_income_balance: data?.top?.main_income_balance ?? "0.00",
          self_account_balance: data?.top?.self_account_balance ?? "0.00",
          withdrawable_balance: data?.top?.withdrawable_balance ?? "0.00",
          shopping_rewards_points: data?.top?.shopping_rewards_points ?? "0.00",
          redeem_points: data?.top?.redeem_points ?? "0.00",
        });

        setIncoming(Array.isArray(data?.incoming) ? data.incoming : []);
        setSelfAccount(Array.isArray(data?.self_account) ? data.self_account : []);
        setCashback(Array.isArray(data?.cashback) ? data.cashback : []);
        setRedeem(Array.isArray(data?.redeem) ? data.redeem : []);
      } catch (e) {
        setErr("Failed to load history.");
        setIncoming([]);
        setSelfAccount([]);
        setCashback([]);
        setRedeem([]);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const incomingGross = useMemo(
    () =>
      (incoming || []).map((tx) => {
        const g = Number(tx?.meta?.gross);
        return isNaN(g) ? tx : { ...tx, amount: g };
      }),
    [incoming]
  );
  const sectionsIncoming = useMemo(() => groupByDay(incomingGross), [incomingGross]);
  const sectionsSelf = useMemo(() => groupByDay(selfAccount), [selfAccount]);
  const sectionsRewards = useMemo(() => groupByDay(cashback), [cashback]);
  const sectionsRedeem = useMemo(() => groupByDay(redeem), [redeem]);
  const totalGross = useMemo(
    () =>
      (incoming || []).reduce((sum, tx) => {
        const g = Number(tx?.meta?.gross ?? 0);
        return sum + (isNaN(g) ? 0 : g);
      }, 0),
    [incoming]
  );

  const tabs = [
    { label: `Bonus History (${incoming.length})`, key: "incoming" },
    { label: `Self Account (${selfAccount.length})`, key: "self" },
    { label: `Rewards (${cashback.length})`, key: "rewards" },
    { label: `Redeem (${redeem.length})`, key: "redeem" },
  ];

  return (
    <Box
      sx={{
        maxWidth: 520,
        mx: "auto",
        px: 1,
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
        History
      </Typography>

      {/* Main Wallet Summary */}
      <Paper
        elevation={0}
        sx={{
          p: 1.6,
          borderRadius: 2.5,
          mb: 1.2,
          border: "1px solid",
          borderColor: "#EEF2F6",
          bgcolor: "#fff",
        }}
      >
        <Stack direction="row" spacing={1.2} alignItems="center">
          <Avatar
            sx={{
              bgcolor: "primary.light",
              color: "primary.dark",
              width: 38,
              height: 38,
            }}
          >
            <AccountBalanceWalletIcon fontSize="small" />
          </Avatar>

          <Box>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
              Main Wallet
            </Typography>

            <Typography
              sx={{
                fontSize: isMobile ? 22 : 26,
                fontWeight: 900,
                lineHeight: 1.1,
                mt: 0.2,
              }}
            >
              ₹ {fmtAmount(top.main_income_balance)}
            </Typography>
           
          </Box>
        </Stack>
      </Paper>

      {/* Mini Cards (Horizontal scroll) */}
      <Box
        sx={{
          display: "flex",
          gap: 1.2,
          overflowX: "auto",
          pb: 1,
          mb: 1.2,
          px: 0.5, // âœ… prevents cut off on left/right
          scrollSnapType: "x mandatory",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
          <MiniCard
          title="Bonus Wallet"
          value={`₹ ${fmtAmount(totalGross)}`}
          icon={<SavingsIcon fontSize="small" />}
          color="success"
        />
        <MiniCard
          title="Self Account"
          value={`₹ ${fmtAmount(top.self_account_balance)}`}
          icon={<AccountBalanceWalletIcon fontSize="small" />}
          color="warning"
        />
        <MiniCard
          title="Redeem Points"
          value={`${fmtAmount(top.redeem_points)} pts`}
          icon={<RedeemIcon fontSize="small" />}
          color="secondary"
        />
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
              {tab === 0 && <SectionList sections={sectionsIncoming} fallbackRows={incomingGross} />}
              {tab === 1 && <SectionList sections={sectionsSelf} fallbackRows={selfAccount} />}
              {tab === 2 && <SectionList sections={sectionsRewards} fallbackRows={cashback} />}
              {tab === 3 && <SectionList sections={sectionsRedeem} fallbackRows={redeem} />}
            </>
          )}
        </Box>
      </Paper>

      <Box sx={{ height: 16 }} />
    </Box>
  );
}
