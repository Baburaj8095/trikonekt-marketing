import React, { useEffect, useRef, useState } from "react";
import { Box, Stack, Typography, Avatar, LinearProgress, CircularProgress } from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import API from "../../../api/api";
import V2PageContainer from "../V2PageContainer";
import V2SectionCard from "../components/V2SectionCard";
import colors from "../theme/colors";

/**
 * Helper formatting
 */
function fmtAmount(v) {
  const num = Number(v || 0);
  return num.toFixed(2);
}
function humanizeType(t) {
  try {
    const s = String(t || "TX").toLowerCase().replace(/_/g, " ");
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return String(t || "TX");
  }
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function labelForDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  const now = new Date();
  const yest = new Date();
  yest.setDate(now.getDate() - 1);
  if (isSameDay(d, now)) return "Today";
  if (isSameDay(d, yest)) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: now.getFullYear() === d.getFullYear() ? undefined : "numeric" });
}

/**
 * Transaction Row (matches the provided dark, rounded card design)
 */
function TxItem({ tx }) {
  const amount = Number(tx.commission ?? tx.amount ?? 0);
  const positive = amount >= 0;
  const title = tx?.type ? humanizeType(tx.type) : positive ? "Received" : "Sent";
  const subtitle = tx?.created_at ? new Date(tx.created_at).toLocaleString() : (tx?.source_type || "-");

  const mainColor = positive ? colors.successBright : colors.error;
  const tintColor = mainColor;
  const avatarBg = positive ? colors.successTintBg : colors.errorTintBg;
  const avatarBorder = positive ? colors.successTintBorder : colors.errorTintBorder;

  return (
    <V2SectionCard>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Avatar
            variant="circular"
            sx={{
              width: 36,
              height: 36,
              bgcolor: avatarBg,
              border: `1px solid ${avatarBorder}`,
              color: mainColor,
            }}
          >
            {positive ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />}
          </Avatar>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{title}</Typography>
            <Typography sx={{ fontSize: 11.5, color: colors.textMuted }}>
              {Math.abs(amount).toFixed(4)} {/* secondary line akin to BTC units in screenshot */}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ textAlign: "right" }}>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: mainColor, lineHeight: 1 }}>
            {positive ? "+" : "-"}
            {Math.abs(amount).toFixed(4)}
          </Typography>
          <Typography sx={{ fontSize: 12, color: tintColor }}>
            ₹ {fmtAmount(Math.abs(amount))}
          </Typography>
        </Box>
      </Stack>

      {/* Meta line */}
      <Typography sx={{ mt: 0.5, fontSize: 11, color: colors.textMuted }}>
        {subtitle}
      </Typography>
    </V2SectionCard>
  );
}

/**
 * History2 - V2 UX
 * - Dark background, group by day (Today / Yesterday / Date)
 * - Rounded glassy cards for each transaction
 * - Infinite scroll (same API as History.jsx)
 */
export default function History2() {
  const [txs, setTxs] = useState([]);
  const [err, setErr] = useState("");
  const [txLoading, setTxLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [txPage, setTxPage] = useState(0);
  const [txPageSize] = useState(10);

  const containerRef = useRef(null);
  const sentinelRef = useRef(null);
  const pagesFetchedRef = useRef(new Set());
  const ioLockRef = useRef(false);
  const endReachedRef = useRef(false);

  async function fetchTransactions(page = 0, pageSize = txPageSize) {
    try {
      setErr("");
      if (page === 0) {
        try { pagesFetchedRef.current.clear(); } catch (_) {}
        try { endReachedRef.current = false; } catch (_) {}
      }
      if (pagesFetchedRef.current.has(page)) return;
      pagesFetchedRef.current.add(page);

      if (page === 0) setTxLoading(true);
      else setLoadingMore(true);

      const res = await API.get("/accounts/wallet/me/transactions/", {
        params: { page: page + 1, page_size: pageSize },
        dedupe: "cancelPrevious",
      });
      const data = res?.data || {};
      const list = Array.isArray(data) ? data : data?.results || [];

      let newLength = 0;
      setTxs((prev) => {
        const prevLen = (prev || []).length;
        const merged = page === 0 ? list : [...prev, ...list];
        // de-dupe by id or composite key
        const seen = new Set();
        const uniq = [];
        for (const t of merged) {
          const key = t && t.id != null ? `id:${t.id}` : JSON.stringify([t?.created_at, t?.type, t?.amount, t?.balance_after]);
          if (!seen.has(key)) {
            seen.add(key);
            uniq.push(t);
          }
        }
        newLength = uniq.length;
        if (page > 0 && newLength === prevLen) {
          try { endReachedRef.current = true; } catch (_) {}
        }
        return uniq;
      });

      const count = typeof data?.count === "number" ? data.count : undefined;
      const nextHasMore = (typeof count === "number")
        ? newLength < count
        : (list.length === pageSize && list.length > 0);
      setHasMore(nextHasMore);
      if (!nextHasMore) {
        try { endReachedRef.current = true; } catch (_) {}
      }
    } catch (e) {
      if (page === 0) setTxs([]);
      setErr("Failed to load transactions.");
      try { endReachedRef.current = true; } catch (_) {}
      setHasMore(false);
    } finally {
      if (page === 0) setTxLoading(false);
      else setLoadingMore(false);
    }
  }

  useEffect(() => {
    fetchTransactions(0, txPageSize);
  }, []); // intentional: run once on mount

  useEffect(() => {
    const root = containerRef.current || null;
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (endReachedRef.current) return;
        if (ioLockRef.current) return;
        if (txLoading || loadingMore || !hasMore) return;
        const nextPage = txPage + 1;
        if (pagesFetchedRef.current && pagesFetchedRef.current.has(nextPage)) return;
        ioLockRef.current = true;
        setTxPage(nextPage);
        fetchTransactions(nextPage, txPageSize).finally(() => {
          ioLockRef.current = false;
        });
      },
      { root, rootMargin: "200px 0px 200px 0px", threshold: 0 }
    );
    const sent = sentinelRef.current;
    if (sent) observer.observe(sent);
    return () => {
      if (sent) observer.unobserve(sent);
      observer.disconnect();
    };
  }, [txLoading, loadingMore, hasMore, txPage, txPageSize]);

  // Group transactions by day label, in the current order
  const grouped = React.useMemo(() => {
    const groups = [];
    const map = new Map();
    for (const tx of txs || []) {
      const label = labelForDate(tx?.created_at);
      if (!map.has(label)) {
        const bucket = { label, items: [] };
        map.set(label, bucket);
        groups.push(bucket);
      }
      map.get(label).items.push(tx);
    }
    return groups;
  }, [txs]);

  return (
    <V2PageContainer title="History" flush>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          pb: 8,
        }}
        ref={containerRef}
      >
        {txLoading ? (
          <Box>
            <LinearProgress sx={{ mb: 1 }} />
            <V2SectionCard sx={{ opacity: 0.6, mb: 1.25 }} />
            <V2SectionCard sx={{ opacity: 0.6, mb: 1.25 }} />
            <V2SectionCard sx={{ opacity: 0.6, mb: 1.25 }} />
          </Box>
        ) : err ? (
          <Typography sx={{ color: colors.error }}>{err}</Typography>
        ) : (txs || []).length === 0 ? (
          <Typography sx={{ color: colors.textMuted }}>No transactions yet.</Typography>
        ) : (
          grouped.map((group) => (
            <Box key={group.label} sx={{ mb: 1.25 }}>
              <Typography sx={{ px: 0.5, py: 0.5, fontSize: 12, fontWeight: 700, color: colors.textMuted }}>
                {group.label}
              </Typography>
              <Stack spacing={1}>
                {group.items.map((tx) => (
                  <TxItem key={tx.id ?? `${tx.created_at}-${tx.type}-${tx.amount}`} tx={tx} />
                ))}
              </Stack>
            </Box>
          ))
        )}

        <Box ref={sentinelRef} sx={{ display: "flex", justifyContent: "center", py: 1 }}>
          {loadingMore ? (
            <CircularProgress size={20} />
          ) : !hasMore && (txs || []).length > 0 ? (
            <Typography sx={{ fontSize: 12, color: colors.textMuted }}>No more transactions</Typography>
          ) : null}
        </Box>
      </Box>
    </V2PageContainer>
  );
}
