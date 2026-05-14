import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { listMyPromoPurchases, listMyRankUpgrades } from "../api/api";

const tabDefs = [
  {
    key: "join",
    label: "Join Subscription",
    cta: "Buy Join Subscription",
    route: "/user/packages/join-subscription",
  },
  {
    key: "spp",
    label: "SPP",
    cta: "Buy SPP",
    route: "/user/packages/spp",
  },
  {
    key: "education",
    label: "Educational Video",
    cta: "Buy Educational Video",
    route: "/user/packages/digital-education-prime",
  },
  {
    key: "tour",
    label: "Tri Tour",
    cta: "Explore Tri Tour",
    route: "/user/tri/tri-holidays",
  },
];

const approx = (a, b, eps = 0.75) => Math.abs(Number(a || 0) - Number(b || 0)) < eps;

function paymentModeLabel(mode, row = {}) {
  const value = String(mode || "").trim().toUpperCase();
  if (value === "WALLET") return "Wallet";
  if (value === "GATEWAY") return "Gateway";
  if (value === "ONLINE") return "Online";
  if (value === "MANUAL") return "Online / Gateway";
  if (row?.latest_payment_utr || row?.latest_payment_proof) return "Online / Gateway";
  return "Online / Gateway";
}

function statusColor(status) {
  const value = String(status || "").toUpperCase();
  if (value === "APPROVED" || value === "SUCCESS") return "success";
  if (value === "PENDING" || value === "INITIATED") return "warning";
  if (value === "REJECTED" || value === "FAILED" || value === "CANCELLED") return "error";
  return "default";
}

function promoAmount(row) {
  const paid = Number(row?.amount_paid || 0);
  if (paid > 0) return paid;
  const price = Number(row?.package?.price || 0);
  const qty = Math.max(1, Number(row?.quantity || 1));
  return price * qty;
}

function normalizePromoRow(row, type) {
  const packageName = row?.package?.name || "Package";
  const selected = row?.selected_product_name || "";
  const boxes = Array.isArray(row?.boxes_json) && row.boxes_json.length
    ? `Boxes: ${row.boxes_json.join(", ")}`
    : "";
  const detail = [selected, boxes].filter(Boolean).join(" | ");
  return {
    id: `${type}-${row?.id}`,
    type,
    packageName: type === "tour" && selected ? selected : packageName,
    detail,
    amount: promoAmount(row),
    status: row?.status || "-",
    paymentMode: paymentModeLabel(row?.payment_mode, row),
    date: row?.approved_at || row?.requested_at || "",
  };
}

function normalizeRankRow(row) {
  return {
    id: `education-${row?.id}`,
    type: "education",
    packageName: row?.to_rank_name
      ? `Educational Video ${row.to_rank_name}`
      : "Educational Video",
    detail: row?.latest_payment_utr ? `UTR: ${row.latest_payment_utr}` : "",
    amount: Number(row?.upgrade_amount || 0),
    status: row?.payment_status || "-",
    paymentMode: paymentModeLabel("ONLINE", row),
    date: row?.upgraded_at || row?.latest_payment_at || row?.created_at || "",
  };
}

function HistoryRow({ row }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 1,
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "1.4fr 0.8fr 0.7fr auto" },
        gap: 1,
        alignItems: "center",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography fontWeight={800} noWrap title={row.packageName}>
          {row.packageName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {row.date ? dayjs(row.date).format("DD MMM YYYY, hh:mm A") : "Date not available"}
        </Typography>
        {row.detail ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {row.detail}
          </Typography>
        ) : null}
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary">
          Payment Mode
        </Typography>
        <Typography fontWeight={700}>{row.paymentMode}</Typography>
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary">
          Amount
        </Typography>
        <Typography fontWeight={800}>Rs {Number(row.amount || 0).toLocaleString("en-IN")}</Typography>
      </Box>

      <Chip size="small" color={statusColor(row.status)} label={String(row.status || "-").toUpperCase()} />
    </Paper>
  );
}

export default function PackageSummary() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("join");
  const [promoRows, setPromoRows] = useState([]);
  const [rankRows, setRankRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [promoRes, rankRes] = await Promise.allSettled([
          listMyPromoPurchases(),
          listMyRankUpgrades(),
        ]);
        if (!alive) return;
        if (promoRes.status === "fulfilled") {
          setPromoRows(Array.isArray(promoRes.value) ? promoRes.value : []);
        } else if (!promoRes.reason?.__canceled) {
          setError(promoRes.reason?.response?.data?.detail || "Failed to load package summary.");
        }
        if (rankRes.status === "fulfilled") {
          setRankRows(Array.isArray(rankRes.value) ? rankRes.value : []);
        }
      } catch (e) {
        if (alive) setError(e?.response?.data?.detail || e?.message || "Failed to load package summary.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const rows = { join: [], spp: [], education: [], tour: [] };

    (promoRows || []).forEach((row) => {
      const type = String(row?.package?.type || "").toUpperCase();
      const slug = String(row?.tri_app_slug || "").toLowerCase();
      const price = Number(row?.package?.price || 0);
      const code = String(row?.package?.code || "").toLowerCase();
      const name = String(row?.package?.name || "").toLowerCase();

      if (slug === "tri-holidays" || slug === "tri-tour" || name.includes("tour")) {
        rows.tour.push(normalizePromoRow(row, "tour"));
        return;
      }
      if (type === "MONTHLY" || code.includes("spp") || approx(price, 1000)) {
        rows.spp.push(normalizePromoRow(row, "spp"));
        return;
      }
      if (approx(price, 750) || code.includes("750") || name.includes("join")) {
        rows.join.push(normalizePromoRow(row, "join"));
      }
    });

    (rankRows || []).forEach((row) => {
      rows.education.push(normalizeRankRow(row));
    });

    Object.keys(rows).forEach((key) => {
      rows[key].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    });
    return rows;
  }, [promoRows, rankRows]);

  const activeDef = tabDefs.find((item) => item.key === tab) || tabDefs[0];
  const activeRows = grouped[tab] || [];

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1.5} sx={{ mb: 1.5 }}>
        <Box>
          <Typography fontWeight={900} fontSize={20}>
            Package Summary
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View purchased package history and payment mode.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => navigate(activeDef.route)} sx={{ textTransform: "none", fontWeight: 800 }}>
          {activeDef.cta}
        </Button>
      </Stack>

      <Box sx={{ borderBottom: "1px solid", borderColor: "divider", mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons={false}>
          {tabDefs.map((item) => (
            <Tab
              key={item.key}
              value={item.key}
              label={`${item.label} (${(grouped[item.key] || []).length})`}
              sx={{ textTransform: "none", fontWeight: 800 }}
            />
          ))}
        </Tabs>
      </Box>

      {loading ? (
        <Stack direction="row" alignItems="center" spacing={1}>
          <CircularProgress size={18} />
          <Typography variant="body2">Loading package summary...</Typography>
        </Stack>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : activeRows.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
          <Typography fontWeight={800}>{activeDef.label}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            No purchase history found for this package type.
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          <Button variant="outlined" onClick={() => navigate(activeDef.route)} sx={{ textTransform: "none" }}>
            {activeDef.cta}
          </Button>
        </Paper>
      ) : (
        <Stack spacing={1}>
          {activeRows.map((row) => (
            <HistoryRow key={row.id} row={row} />
          ))}
        </Stack>
      )}
    </Box>
  );
}
