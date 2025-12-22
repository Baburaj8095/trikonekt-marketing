import React, { useEffect, useState, useRef } from "react";
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  CircularProgress,
  Chip,
  Stack,
  Avatar,
} from "@mui/material";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import API from "../api/api";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

function fmtAmount(value) {
  const num = Number(value || 0);
  return num.toFixed(2);
}

function Amount({ value }) {
  const num = Number(value || 0);
  const color = num >= 0 ? "success.main" : "error.main";
  const sign = num >= 0 ? "+" : "";
  return (
    <Typography component="span" sx={{ color, fontWeight: 600 }}>
      {sign}
      {fmtAmount(num)}
    </Typography>
  );
}


function humanizeType(t) {
  try {
    const s = String(t || "TX").toLowerCase().replace(/_/g, " ");
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return String(t || "TX");
  }
}

function TxTypeChip({ type }) {
  let color = "default";
  if (type === "COMMISSION_CREDIT" || (type || "").endsWith("_CREDIT")) color = "success";
  if ((type || "").endsWith("_DEBIT")) color = "warning";
  return <Chip size="small" color={color} label={type || "TX"} />;
}

export default function History() {
  const [txs, setTxs] = useState([]);
  const [txPage, setTxPage] = useState(0);
  const [txPageSize, setTxPageSize] = useState(10);
  const [txCount, setTxCount] = useState(0);
  const [txLoading, setTxLoading] = useState(false);
  const [err, setErr] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const containerRef = useRef(null);
  const sentinelRef = useRef(null);
  const pagesFetchedRef = useRef(new Set());
  const ioLockRef = useRef(false);
  const endReachedRef = useRef(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  async function fetchTransactions(page = 0, pageSize = txPageSize) {
    try {
      setErr("");
      // prevent duplicate page fetches
      if (page === 0) {
        try { pagesFetchedRef.current.clear(); } catch (_) {}
        try { endReachedRef.current = false; } catch (_) {}
      }
      if (pagesFetchedRef.current.has(page)) {
        return;
      }
      pagesFetchedRef.current.add(page);
      if (page === 0) setTxLoading(true);
      else setLoadingMore(true);
      const res = await API.get("/accounts/wallet/me/transactions/", {
        params: { page: page + 1, page_size: pageSize },
        dedupe: "cancelPrevious",
      });
      const data = res?.data || {};
      const list = Array.isArray(data) ? data : data?.results || [];
      const count = typeof data?.count === "number" ? data.count : undefined;
      let newLength = 0;
      setTxs((prev) => {
        const prevLen = (prev || []).length;
        const merged = page === 0 ? list : [...prev, ...list];
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
      setTxCount(typeof count === "number" ? count : newLength);
      const nextHasMore = (typeof count === "number") ? newLength < count : (list.length === pageSize && list.length > 0);
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
  }, []);

  useEffect(() => {
    const root = containerRef.current || null;
    const observer = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (!first.isIntersecting) return;
      if (endReachedRef.current) return;
      if (ioLockRef.current) return;
      if (txLoading || loadingMore || !hasMore) return;
      const nextPage = txPage + 1;
      if (pagesFetchedRef.current && pagesFetchedRef.current.has(nextPage)) {
        return;
      }
      ioLockRef.current = true;
      setTxPage(nextPage);
      fetchTransactions(nextPage, txPageSize).finally(() => {
        ioLockRef.current = false;
      });
    }, { root, rootMargin: "200px 0px 200px 0px", threshold: 0 });
    const sent = sentinelRef.current;
    if (sent) observer.observe(sent);
    return () => {
      if (sent) observer.unobserve(sent);
      observer.disconnect();
    };
  }, [txLoading, loadingMore, hasMore, txPage, txPageSize]);

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700, color: "#0C2D48" }}>
        History
      </Typography>

      <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 1 }}>
          Recent Activity
        </Typography>


        {txLoading ? (
          <LinearProgress />
        ) : err ? (
          <Typography variant="body2" color="error">{err}</Typography>
        ) : (
          <React.Fragment>
            {isMobile ? (
              (txs || []).length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary", p: 2 }}>
                  No transactions yet.
                </Typography>
              ) : (
                <Stack spacing={1} sx={{ maxHeight: 520, overflowY: "auto", pr: 0.5 }} ref={containerRef}>
                  {(txs || []).map((tx) => {
                    const created = tx.created_at ? new Date(tx.created_at).toLocaleString() : "-";
                    const amount = Number((tx.commission ?? tx.amount ?? 0));
                    const positive = amount >= 0;
                    return (
                      <Paper key={tx.id} variant="outlined" sx={{ p: 1.25, borderRadius: 1.5 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar
                              sx={{
                                width: 32,
                                height: 32,
                                bgcolor: positive ? "success.light" : "warning.light",
                                color: positive ? "success.dark" : "warning.dark",
                              }}
                            >
                              {positive ? (
                                <ArrowDownwardIcon fontSize="small" />
                              ) : (
                                <ArrowUpwardIcon fontSize="small" />
                              )}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {humanizeType(tx.type)}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                {tx.source_type || "-"}
                              </Typography>
                            </Box>
                          </Stack>
                          <Box sx={{ textAlign: "right" }}>
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 800, color: positive ? "success.main" : "error.main" }}
                            >
                              {positive ? "+" : "-"}₹ {fmtAmount(Math.abs(amount))}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                              Bal: ₹ {fmtAmount(tx.balance_after)}
                            </Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5, color: "text.secondary" }}>
                          <Typography variant="caption">{created}</Typography>
                        </Stack>
                        <Typography variant="caption" sx={{ mt: 0.5, color: "text.secondary" }}>
                          {(tx.tr_username || "-")}
                          {tx.pincode ? ` · ${tx.pincode}` : ""}
                          {tx.full_name ? ` · ${tx.full_name}` : ""}
                        </Typography>
                      </Paper>
                    );
                  })}
                  <Box ref={sentinelRef} sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                    {loadingMore ? <CircularProgress size={20} /> : !hasMore && (
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>No more transactions</Typography>
                    )}
                  </Box>
                </Stack>
              )
            ) : (
              <TableContainer sx={{ maxHeight: 520 }} ref={containerRef}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>TR Username</TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Full Name</TableCell>
                      <TableCell>Pincode</TableCell>
                      <TableCell align="right">Commission (₹)</TableCell>
                      <TableCell sx={{ display: { xs: "none", md: "table-cell" } }} align="right">Bal After (₹)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(txs || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            No transactions yet.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      (txs || []).map((tx) => (
                        <TableRow key={tx.id} hover>
                          <TableCell>
                            {tx.created_at ? new Date(tx.created_at).toLocaleString() : "-"}
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <TxTypeChip type={tx.type} />
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                {tx.source_type || "-"}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>{tx.tr_username || "-"}</TableCell>
                          <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                            {tx.full_name || "-"}
                          </TableCell>
                          <TableCell>{tx.pincode || "-"}</TableCell>
                          <TableCell align="right">
                            <Amount value={tx.commission ?? tx.amount} />
                          </TableCell>
                          <TableCell sx={{ display: { xs: "none", md: "table-cell" } }} align="right">
                            ₹ {fmtAmount(tx.balance_after)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <Box ref={sentinelRef} sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                  {loadingMore ? <CircularProgress size={20} /> : !hasMore && (
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>No more transactions</Typography>
                  )}
                </Box>
              </TableContainer>
            )}
          </React.Fragment>
        )}
      </Paper>
    </Box>
  );
}
