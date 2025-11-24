import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Chip,
  Stack,
  TextField,
  Button,
  Avatar,
} from "@mui/material";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
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

// Format a Date to YYYY-MM-DD for HTML date input, respecting local timezone
function toDateInputValue(d = new Date()) {
  try {
    const tzoffset = d.getTimezoneOffset() * 60000; // offset in ms
    return new Date(d.getTime() - tzoffset).toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
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
  const [dateFrom, setDateFrom] = useState(toDateInputValue());
  const [dateTo, setDateTo] = useState(toDateInputValue());

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  async function fetchTransactions(page = 0, pageSize = txPageSize, from = dateFrom, to = dateTo) {
    try {
      setTxLoading(true);
      setErr("");
      const res = await API.get("/accounts/wallet/me/transactions/", {
        params: { page: page + 1, page_size: pageSize, date_from: from, date_to: to },
      });
      const data = res?.data || {};
      const list = Array.isArray(data) ? data : data?.results || [];
      const count = typeof data?.count === "number" ? data.count : list.length;
      setTxs(list);
      setTxCount(count);
    } catch (e) {
      setErr("Failed to load transactions.");
      setTxs([]);
      setTxCount(0);
    } finally {
      setTxLoading(false);
    }
  }

  useEffect(() => {
    fetchTransactions(0, txPageSize);
  }, []);

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700, color: "#0C2D48" }}>
        History
      </Typography>

      <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 1 }}>
          Recent Activity
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 1 }}>
          <TextField
            label="From"
            type="date"
            size="small"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={() => {
              // Guard: if from is after to, swap
              let f = dateFrom, t = dateTo;
              try {
                if (f && t && new Date(f) > new Date(t)) {
                  const tmp = f; f = t; t = tmp;
                  setDateFrom(f);
                  setDateTo(t);
                }
              } catch {}
              setTxPage(0);
              fetchTransactions(0, txPageSize, f, t);
            }}
            sx={{ textTransform: "none" }}
          >
            Apply
          </Button>
          <Button
            variant="text"
            size="small"
            onClick={() => {
              const today = toDateInputValue();
              setDateFrom(today);
              setDateTo(today);
              setTxPage(0);
              fetchTransactions(0, txPageSize, today, today);
            }}
            sx={{ textTransform: "none" }}
          >
            Today
          </Button>
        </Stack>

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
                <Stack spacing={1} sx={{ maxHeight: 520, overflowY: "auto", pr: 0.5 }}>
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
                </Stack>
              )
            ) : (
              <TableContainer sx={{ maxHeight: 520 }}>
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
              </TableContainer>
            )}
            <TablePagination
              component="div"
              count={txCount}
              page={txPage}
              onPageChange={(e, newPage) => {
                setTxPage(newPage);
                fetchTransactions(newPage, txPageSize, dateFrom, dateTo);
              }}
              rowsPerPage={txPageSize}
              onRowsPerPageChange={(e) => {
                const newSize = parseInt(e.target.value, 10);
                setTxPageSize(newSize);
                setTxPage(0);
                fetchTransactions(0, newSize, dateFrom, dateTo);
              }}
              rowsPerPageOptions={[10, 25, 50]}
            />
          </React.Fragment>
        )}
      </Paper>
    </Box>
  );
}
