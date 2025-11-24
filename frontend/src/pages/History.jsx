import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Chip,
  Stack,
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

  async function fetchTransactions(page = 0, pageSize = txPageSize) {
    try {
      setTxLoading(true);
      setErr("");
      const res = await API.get("/accounts/wallet/me/transactions/", {
        params: { page: page + 1, page_size: pageSize },
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
        {txLoading ? (
          <LinearProgress />
        ) : err ? (
          <Typography variant="body2" color="error">{err}</Typography>
        ) : (
          <React.Fragment>
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
            <TablePagination
              component="div"
              count={txCount}
              page={txPage}
              onPageChange={(e, newPage) => {
                setTxPage(newPage);
                fetchTransactions(newPage, txPageSize);
              }}
              rowsPerPage={txPageSize}
              onRowsPerPageChange={(e) => {
                const newSize = parseInt(e.target.value, 10);
                setTxPageSize(newSize);
                setTxPage(0);
                fetchTransactions(0, newSize);
              }}
              rowsPerPageOptions={[10, 25, 50]}
            />
          </React.Fragment>
        )}
      </Paper>
    </Box>
  );
}
