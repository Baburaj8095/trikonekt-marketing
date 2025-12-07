import React, { useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  IconButton,
  Chip,
  Grid,
  Button,
  Divider,
  Pagination,
  Tooltip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

/**
 * OrdersList
 * - Card-style order items with status badges and pagination
 *
 * Props:
 * - orders: array of {
 *     id, product_title, product, denomination_snapshot, quantity, amount_total,
 *     status, reviewed_at, allocated_sample_codes: string[]
 *   }
 * - loading?: boolean
 * - error?: string
 * - onRefresh?: () => void
 * - pageSize?: number (default 8)
 */
export default function OrdersList({
  orders = [],
  loading = false,
  error = "",
  onRefresh,
  pageSize = 8,
}) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil((orders || []).length / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return (orders || []).slice(start, start + pageSize);
  }, [orders, page, pageSize]);

  const statusColor = (st) => {
    const s = String(st || "").toUpperCase();
    if (s.includes("APPROVED") || s.includes("SUCCESS")) return "success";
    if (s.includes("PENDING") || s.includes("REVIEW")) return "warning";
    if (s.includes("REJECT") || s.includes("FAILED")) return "error";
    return "default";
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "#fff",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a" }}>
          My Orders
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip size="small" label={`${orders.length} orders`} />
          <Tooltip title="Refresh">
            <span>
              <IconButton size="small" onClick={onRefresh} disabled={loading}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {error ? (
        <Typography variant="body2" color="error" sx={{ mb: 1 }}>
          {error}
        </Typography>
      ) : null}

      {orders.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No orders yet.
        </Typography>
      ) : (
        <>
          <Grid container spacing={1.5}>
            {pageItems.map((o) => {
              const samples = Array.isArray(o.allocated_sample_codes)
                ? o.allocated_sample_codes
                : [];
              return (
                <Grid item xs={12} md={6} key={o.id}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: "#fff",
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.5,
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        Order #{o.id}
                      </Typography>
                      <Chip
                        size="small"
                        color={statusColor(o.status)}
                        label={String(o.status || "").replaceAll("_", " ")}
                        sx={{ fontWeight: 700 }}
                      />
                    </Stack>

                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {o.product_title || o.product || "E‑Coupon"}
                    </Typography>

                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="baseline"
                      sx={{ flexWrap: "wrap" }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Denomination:
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 800 }}>
                        ₹{o.denomination_snapshot}
                      </Typography>

                      <Typography variant="caption" color="text.secondary">
                        Qty:
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 800 }}>
                        {o.quantity}
                      </Typography>

                      <Typography variant="caption" color="text.secondary">
                        Total:
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 800 }}>
                        ₹{Number(o.amount_total || 0).toLocaleString("en-IN")}
                      </Typography>
                    </Stack>

                    <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
                      <Typography variant="caption" color="text.secondary">
                        Approved At:
                      </Typography>
                      <Typography variant="caption">
                        {o.reviewed_at
                          ? new Date(o.reviewed_at).toLocaleString()
                          : "—"}
                      </Typography>
                    </Stack>

                    {samples.length > 0 ? (
                      <>
                        <Divider sx={{ my: 0.5 }} />
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block" }}
                          title={samples.join(", ")}
                        >
                          Samples:{" "}
                          <span style={{ color: "#0f172a", fontWeight: 600 }}>
                            {samples.join(", ")}
                          </span>
                        </Typography>
                      </>
                    ) : null}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>

          {totalPages > 1 ? (
            <Stack direction="row" justifyContent="center" sx={{ mt: 1.5 }}>
              <Pagination
                page={page}
                count={totalPages}
                color="primary"
                onChange={(_, p) => setPage(p)}
                size="small"
              />
            </Stack>
          ) : null}
        </>
      )}
    </Paper>
  );
}
