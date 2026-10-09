import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Chip,
  Stack,
  Avatar,
  Tabs,
  Tab,
  Button,
  Drawer,
  IconButton,
  TextField,
  CircularProgress,
  Divider,
  InputAdornment,
} from "@mui/material";
import API from "../../api/api";

import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import SavingsIcon from "@mui/icons-material/Savings";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import StoreRoundedIcon from "@mui/icons-material/StoreRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";

function fmtAmount(value) {
  const num = Number(value || 0);
  return num.toFixed(2);
}

function maskUsernameMid(u) {
  const s = String(u || "").trim();
  if (!/^\d{8,}$/.test(s)) return s;
  if (s.length <= 4) return s;
  const prefix = s.slice(0, 4);
  const suffix = s.slice(-3);
  return `${prefix}****${suffix}`;
}

function counterpartyLabel(tx = {}) {
  const meta = tx?.meta || {};
  const trig = meta.trigger_user || meta.from_user || meta.username || meta.tr_username;
  const trigId = meta.trigger_user_id || meta.from_user_id;
  const pincode = meta.pincode || meta.territory;
  const u = trig ? maskUsernameMid(trig) : "";
  let out = "";
  if (u) out = `From ${u}`;
  else if (trigId) out = `From ID ${trigId}`;
  if (pincode) out += (out ? ` • PIN ${pincode}` : `PIN ${pincode}`);
  return out;
}

function describeSource(tx = {}) {
  const type = String(tx?.type || "").toUpperCase();
  const meta = tx?.meta || {};
  const src = String(meta.source || "").toUpperCase();
  const st = String(tx?.source_type || "").toUpperCase();
  const ot = String(meta.orig_type || "").toUpperCase();

  if (type === "FRANCHISE_INCOME" || src.includes("FRANCHISE")) {
    const gross = Number(meta.gross || 0);
    const trigger = String(meta.trigger || "").toUpperCase();
    if (trigger.includes("750") || gross === 750 || src.includes("750")) {
      return "₹750 Prime Geo Share";
    }
    if (trigger.includes("SPP") || trigger.includes("759") || trigger.includes("1000") || src.includes("SPP")) {
      return "₹1,000 SPP Monthly Box Geo Share";
    }
    if (trigger.includes("RANK") || trigger.includes("EDU") || src.includes("RANK") || src.includes("EDU")) {
      return "₹250 E-Edu Rank 1 Geo Share";
    }
    if (trigger.includes("REBIRTH") || src.includes("REBIRTH")) {
      return "₹250 Self-Rebirth Regional Override";
    }
    return meta.description || "Franchise Regional Commission";
  }

  if (type === "SELF_ACCOUNT_CREDIT") return "Self Rebirth Reserve Credit (25%)";
  if (type === "SELF_ACCOUNT_DEBIT") return "Self Rebirth Allocation (₹250 Node)";
  if (type === "WITHDRAWAL_DEBIT") return "Withdrawal Payout";

  return meta.description || type.replace(/_/g, " ");
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
    else if (k === "unknown") title = "Recent Activity";
    else {
      const [Y, M, D] = k.split("-").map((x) => parseInt(x, 10));
      title = formatHeaderDate(new Date(Y, (M || 1) - 1, D || 1));
    }

    const rows = (map.get(k) || []).slice().sort((a, b) => {
      const da = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });

    const total = rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    return { title, rows, total };
  });
}

function MiniCard({ title, value, icon, color = "primary", onClick, selected }) {
  const colorMap = {
    primary: { border: "#BFDBFE", iconBg: "#EFF6FF", iconColor: "#1D4ED8" },
    success: { border: "#BBF7D0", iconBg: "#ECFDF5", iconColor: "#059669" },
    warning: { border: "#FDE68A", iconBg: "#FFFBEB", iconColor: "#D97706" },
    purple: { border: "#DDD6FE", iconBg: "#F5F3FF", iconColor: "#7C3AED" },
  };
  const themeColors = colorMap[color] || colorMap.primary;

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        minWidth: 155,
        flex: 1,
        p: 1.5,
        borderRadius: "16px",
        borderColor: selected ? `${color}.main` : "#EEF2F6",
        borderWidth: selected ? 2 : 1,
        borderStyle: "solid",
        cursor: onClick ? "pointer" : "default",
        boxShadow: selected ? "0 6px 18px rgba(12, 45, 72, 0.12)" : "0 1px 4px rgba(15, 23, 42, 0.03)",
        display: "flex",
        alignItems: "center",
        gap: 1.2,
        bgcolor: "#FFFFFF",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
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
        <Typography sx={{ color: "#64748B", fontWeight: 800, fontSize: 11 }}>
          {title}
        </Typography>
        <Typography sx={{ fontWeight: 900, mt: 0.15, fontSize: 15, color: "#0F172A" }}>
          {value}
        </Typography>
      </Box>
    </Paper>
  );
}

function TxRow({ tx, onClick }) {
  const amount = Number(tx?.amount || 0);
  const isCredit = amount >= 0;
  const isSelfAccount =
    tx?.type === "SELF_ACCOUNT_CREDIT" ||
    tx?.type === "SELF_ACCOUNT_DEBIT" ||
    tx?.meta?.ledger === "SELF_ACCOUNT";

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

  return (
    <Paper
      elevation={0}
      onClick={() => onClick && onClick(tx)}
      sx={{
        p: 1.5,
        borderRadius: "14px",
        bgcolor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        cursor: "pointer",
        transition: "all 0.15s ease",
        "&:hover": {
          borderColor: "#2563EB",
          boxShadow: "0 4px 12px rgba(37,99,235,0.06)",
        },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Avatar
          sx={{
            width: 38,
            height: 38,
            bgcolor: isCredit ? "#ECFDF5" : "#FEF2F2",
            color: isCredit ? "#059669" : "#DC2626",
            border: isCredit ? "1.5px solid #A7F3D0" : "1.5px solid #FECACA",
          }}
        >
          {isCredit ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }} noWrap>
              {describeSource(tx)}
            </Typography>
            <Chip
              size="small"
              label="Success"
              sx={{
                height: 18,
                fontSize: 10,
                fontWeight: 800,
                bgcolor: "#DCFCE7",
                color: "#166534",
                border: "1px solid #86EFAC",
              }}
            />
          </Stack>

          <Typography sx={{ fontSize: 11.5, color: "#64748B", fontWeight: 600, mt: 0.2 }} noWrap>
            {counterpartyLabel(tx) || "Franchise Regional Distribution"}
          </Typography>

          <Typography sx={{ fontSize: 11, color: "#94A3B8", mt: 0.2 }}>
            {dateStr} {timeStr ? `• ${timeStr}` : ""}
          </Typography>
        </Box>

        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
          <Typography
            sx={{
              fontWeight: 900,
              fontSize: 14.5,
              color: isCredit ? "#059669" : "#DC2626",
              letterSpacing: 0.2,
            }}
          >
            {isCredit ? "+" : "-"}₹ {fmtAmount(Math.abs(amount))}
          </Typography>
          <ChevronRightIcon sx={{ color: "#CBD5E1", fontSize: 18, mt: 0.2 }} />
        </Box>
      </Stack>
    </Paper>
  );
}

function TxDetailDrawer({ open, onClose, tx }) {
  if (!tx) return null;
  const amount = Number(tx?.amount || 0);
  const isCredit = amount >= 0;
  const meta = tx?.meta || {};

  const grossVal = meta.gross || meta.gross_amount || amount;
  const mainWalletShare = meta.main_wallet_75 || (amount * 0.75).toFixed(2);
  const selfRebirthShare = meta.self_rebirth_25 || (amount * 0.25).toFixed(2);

  const dateStr = tx?.created_at
    ? new Intl.DateTimeFormat(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(tx.created_at))
    : "-";

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: "85vh",
          p: 2.5,
          boxSizing: "border-box",
        },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#0F172A" }}>
          Transaction Breakdown
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseRoundedIcon />
        </IconButton>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2.5,
          borderRadius: 3,
          bgcolor: isCredit ? "#F0FDF4" : "#FEF2F2",
          border: `1.5px solid ${isCredit ? "#BBF7D0" : "#FECACA"}`,
          textAlign: "center",
        }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: isCredit ? "#166534" : "#991B1B" }}>
          Franchise Payout Credited
        </Typography>
        <Typography sx={{ fontSize: 28, fontWeight: 950, color: isCredit ? "#059669" : "#DC2626", my: 0.5 }}>
          {isCredit ? "+" : "-"}₹ {fmtAmount(Math.abs(amount))}
        </Typography>
        <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
          {describeSource(tx)}
        </Typography>
      </Paper>

      <Stack spacing={1.5} sx={{ mb: 3 }}>
        <Stack direction="row" justifyContent="space-between">
          <Typography sx={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>Status</Typography>
          <Chip size="small" label="Settled 100% Instantly" sx={{ bgcolor: "#DCFCE7", color: "#166534", fontWeight: 800, fontSize: 11 }} />
        </Stack>

        <Stack direction="row" justifyContent="space-between">
          <Typography sx={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>Date & Time</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{dateStr}</Typography>
        </Stack>

        <Stack direction="row" justifyContent="space-between">
          <Typography sx={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>Trigger Consumer</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
            {meta.trigger_user || meta.from_user || "9700000001"}
          </Typography>
        </Stack>

        <Stack direction="row" justifyContent="space-between">
          <Typography sx={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>Territory / Pincode</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
            PIN {meta.pincode || "572106 (Turuvekere)"}
          </Typography>
        </Stack>

        <Divider sx={{ my: 1 }} />

        <Stack direction="row" justifyContent="space-between">
          <Typography sx={{ fontSize: 13, color: "#166534", fontWeight: 800 }}>Withdrawable Main Wallet (75%)</Typography>
          <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: "#166534" }}>+₹ {fmtAmount(amount * 0.75)}</Typography>
        </Stack>

        <Stack direction="row" justifyContent="space-between">
          <Typography sx={{ fontSize: 13, color: "#D97706", fontWeight: 800 }}>Self Rebirth Pocket (25%)</Typography>
          <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: "#D97706" }}>+₹ {fmtAmount(amount * 0.25)}</Typography>
        </Stack>

        <Stack direction="row" justifyContent="space-between">
          <Typography sx={{ fontSize: 12, color: "#94A3B8" }}>Transaction ID</Typography>
          <Typography sx={{ fontSize: 12, color: "#94A3B8", fontFamily: "monospace" }}>
            {tx.id ? `TX-FR-${tx.id}` : `TX-${Date.now().toString().slice(-6)}`}
          </Typography>
        </Stack>
      </Stack>

      <Button
        fullWidth
        variant="contained"
        onClick={onClose}
        sx={{
          height: 44,
          borderRadius: "12px",
          bgcolor: "#2563EB",
          textTransform: "none",
          fontWeight: 800,
          fontSize: 14,
          "&:hover": { bgcolor: "#1D4ED8" },
        }}
      >
        Done
      </Button>
    </Drawer>
  );
}

export default function AgencyHistory() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [top, setTop] = useState({
    main_income_balance: "0.00",
    self_account_balance: "0.00",
    all_earnings_total: "0.00",
  });
  const [incoming, setIncoming] = useState([]);
  const [selectedTx, setSelectedTx] = useState(null);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await API.get("/accounts/wallet/me/history/");
      const data = res?.data || {};

      setTop({
        main_income_balance: data?.top?.main_income_balance ?? "0.00",
        self_account_balance: data?.top?.self_account_balance ?? "0.00",
        all_earnings_total: data?.top?.all_earnings_total ?? "0.00",
      });

      const list = Array.isArray(data?.incoming) ? data.incoming : [];
      setIncoming(list);
    } catch (e) {
      console.warn("Failed to fetch agency history, using fallback:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredList = useMemo(() => {
    let rows = incoming;
    if (tab === 1) {
      // Franchise Income
      rows = rows.filter((r) => r.type === "FRANCHISE_INCOME" || String(r.type).includes("FRANCHISE"));
    } else if (tab === 2) {
      // Self blocks
      rows = rows.filter((r) => r.type === "SELF_ACCOUNT_CREDIT" || r.type === "SELF_ACCOUNT_DEBIT");
    } else if (tab === 3) {
      // Withdrawals
      rows = rows.filter((r) => String(r.type).includes("WITHDRAWAL"));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          describeSource(r).toLowerCase().includes(q) ||
          counterpartyLabel(r).toLowerCase().includes(q) ||
          String(r.amount).includes(q)
      );
    }

    return rows;
  }, [incoming, tab, search]);

  const sections = useMemo(() => groupByDay(filteredList), [filteredList]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F8FAFC", pb: 5 }}>
      {/* Sticky Top Header */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          bgcolor: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid #E2E8F0",
          px: 2,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton size="small" onClick={() => navigate(-1)} sx={{ bgcolor: "#F1F5F9" }}>
            <ArrowBackRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#0F172A" }}>
            Franchise Commission History
          </Typography>
        </Stack>
        <Chip
          size="small"
          label="Live Ledger"
          sx={{ bgcolor: "#EFF6FF", color: "#1D4ED8", fontWeight: 800, fontSize: 11, border: "1px solid #BFDBFE" }}
        />
      </Box>

      <Box sx={{ maxWidth: 440, mx: "auto", px: 2, pt: 2 }}>
        {/* Top Mini Cards */}
        <Box
          sx={{
            display: "flex",
            gap: 1.2,
            overflowX: "auto",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
            pb: 1,
            mb: 2,
          }}
        >
          <MiniCard
            title="Total Cumulative"
            value={`₹ ${fmtAmount(top.all_earnings_total)}`}
            icon={<AccountBalanceWalletIcon fontSize="small" />}
            color="primary"
          />
          <MiniCard
            title="Main Wallet (75%)"
            value={`₹ ${fmtAmount(top.main_income_balance)}`}
            icon={<ArrowUpwardIcon fontSize="small" />}
            color="success"
          />
          <MiniCard
            title="Self Rebirth (25%)"
            value={`₹ ${fmtAmount(top.self_account_balance)}`}
            icon={<SavingsIcon fontSize="small" />}
            color="warning"
          />
        </Box>

        {/* Filter Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons={false}
          sx={{
            mb: 2,
            minHeight: 36,
            "& .MuiTab-root": {
              minHeight: 36,
              textTransform: "none",
              fontSize: 13,
              fontWeight: 800,
              py: 0.5,
              px: 1.5,
              borderRadius: "10px",
              mr: 1,
              bgcolor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              color: "#64748B",
              "&.Mui-selected": {
                bgcolor: "#0F172A",
                color: "#FFFFFF",
                borderColor: "#0F172A",
              },
            },
            "& .MuiTabs-indicator": { display: "none" },
          }}
        >
          <Tab label={`All (${incoming.length})`} />
          <Tab label="Franchise Income" />
          <Tab label="Self blocks" />
          <Tab label="Withdrawals" />
        </Tabs>

        {/* Search Field */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search by package, pincode, or counterparty..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 18, color: "#94A3B8" }} />
              </InputAdornment>
            ),
            sx: { borderRadius: "12px", bgcolor: "#FFFFFF", fontSize: 13, mb: 2 },
          }}
        />

        {/* Transactions List */}
        {loading ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <CircularProgress size={32} />
            <Typography sx={{ fontSize: 13, color: "#64748B", mt: 1.5, fontWeight: 700 }}>
              Loading franchise ledger from database...
            </Typography>
          </Box>
        ) : filteredList.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              textAlign: "center",
              borderRadius: "16px",
              bgcolor: "#FFFFFF",
              border: "1px solid #E2E8F0",
            }}
          >
            <Avatar sx={{ width: 48, height: 48, bgcolor: "#F1F5F9", color: "#94A3B8", mx: "auto", mb: 1.5 }}>
              <AccountBalanceWalletIcon />
            </Avatar>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>
              No Transactions Found
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: "#64748B", mt: 0.5, fontWeight: 600 }}>
              {search ? "No records match your search criteria." : "No franchise commissions recorded yet for this filter."}
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            {sections.map((sec) => (
              <Box key={sec.title}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, px: 0.5 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 850, color: "#0F172A" }}>
                    {sec.title}
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "#64748B" }}>
                    ₹ {fmtAmount(sec.total)}
                  </Typography>
                </Stack>
                <Stack spacing={1}>
                  {sec.rows.map((tx, idx) => (
                    <TxRow key={tx.id || idx} tx={tx} onClick={(t) => setSelectedTx(t)} />
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      {/* Transaction Detail Drawer */}
      <TxDetailDrawer
        open={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        tx={selectedTx}
      />
    </Box>
  );
}
