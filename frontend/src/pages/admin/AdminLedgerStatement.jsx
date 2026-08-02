import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  Tabs,
  Tab,
} from "@mui/material";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import SearchIcon from "@mui/icons-material/Search";
import API from "../../api/api";

function money(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? "₹" + n.toFixed(2) : "₹0.00";
}

export default function AdminLedgerStatement() {
  const [username, setUsername] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [activeTab, setActiveTab] = useState(0);

  // Pagination states
  const [txPage, setTxPage] = useState(0);
  const [txRowsPerPage, setTxRowsPerPage] = useState(25);
  const [ledgerPage, setLedgerPage] = useState(0);
  const [ledgerRowsPerPage, setLedgerRowsPerPage] = useState(25);

  async function loadStatement() {
    if (!username.trim()) return;
    try {
      setLoading(true);
      setErr("");
      const res = await API.get("/admin/wallets/statement/", { params: { username } });
      setData(res?.data || null);
      setTxPage(0);
      setLedgerPage(0);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load ledger statement.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const txs = data?.transactions || [];
  const ledgers = data?.ledgers || [];

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.025em", color: "#0f172a" }}>
          Financial Ledger Statement
        </Typography>
        <Typography sx={{ color: "#64748b", fontSize: 14 }}>
          Search any user to view pocket balances and chronological transaction logs.
        </Typography>
      </Box>

      {err && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{err}</Alert>}
      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 2 }} />}

      {/* Search Input Card */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 3, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            size="small"
            placeholder="Search by Username, Phone or prefixed User ID..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadStatement()}
            fullWidth
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: "#94a3b8", mr: 1 }} />,
            }}
          />
          <Button
            variant="contained"
            onClick={loadStatement}
            disabled={loading}
            sx={{ px: 4, borderRadius: 2, textTransform: "none", fontWeight: 700 }}
          >
            Search
          </Button>
        </Stack>
      </Paper>

      {data && (
        <Box>
          {/* User profile & Pockets grid */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Profile Info */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ height: "100%", borderRadius: 4, borderColor: "#e2e8f0" }}>
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                    <Box sx={{ p: 1.5, borderRadius: 3, backgroundColor: "#f1f5f9", color: "#475569" }}>
                      <PersonOutlineRoundedIcon fontSize="large" />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 900, fontSize: 18, color: "#1e293b" }}>
                        {data.user.full_name}
                      </Typography>
                      <Typography sx={{ color: "#64748b", fontSize: 13 }}>
                        ID: {data.user.id} | Joined: {data.user.date_joined.split(" ")[0]}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack spacing={1}>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 13, color: "#64748b" }}>Username:</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{data.user.username}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 13, color: "#64748b" }}>Phone:</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{data.user.phone || "-"}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 13, color: "#64748b" }}>Account Status:</Typography>
                      <Chip
                        label={data.user.is_active ? "Active" : "Inactive"}
                        size="small"
                        color={data.user.is_active ? "success" : "default"}
                        sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Pocket balances */}
            <Grid item xs={12} md={8}>
              <Grid container spacing={2}>
                {/* Main Wallet */}
                <Grid item xs={12} sm={4}>
                  <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "#cbd5e1", background: "linear-gradient(to bottom right, #f8fafc, #f1f5f9)" }}>
                    <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Main Wallet</Typography>
                        <AccountBalanceWalletRoundedIcon sx={{ color: "#2563eb", fontSize: 20 }} />
                      </Stack>
                      <Typography sx={{ fontSize: 22, fontWeight: 900, color: "#1e293b" }}>
                        {money(data.pockets.main?.current_balance)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#64748b" }}>Earning pocket</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Self Account */}
                <Grid item xs={12} sm={4}>
                  <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "#cbd5e1", background: "linear-gradient(to bottom right, #f8fafc, #f1f5f9)" }}>
                    <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Self Account</Typography>
                        <HistoryRoundedIcon sx={{ color: "#059669", fontSize: 20 }} />
                      </Stack>
                      <Typography sx={{ fontSize: 22, fontWeight: 900, color: "#1e293b" }}>
                        {money(data.pockets.self_account?.current_balance)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#64748b" }}>25% auto-accrual</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Coupon Pocket */}
                <Grid item xs={12} sm={4}>
                  <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "#cbd5e1", background: "linear-gradient(to bottom right, #f8fafc, #f1f5f9)" }}>
                    <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Coupon Pocket</Typography>
                        <ReceiptLongRoundedIcon sx={{ color: "#d97706", fontSize: 20 }} />
                      </Stack>
                      <Typography sx={{ fontSize: 22, fontWeight: 900, color: "#1e293b" }}>
                        {money(data.pockets.coupon?.current_balance)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#64748b" }}>Conversion pool</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Add Money Pocket */}
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "#cbd5e1" }}>
                    <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 }, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Add Money Pocket:</Typography>
                      <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#1e293b" }}>
                        {money(data.pockets.add_money?.current_balance)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Withdrawal Wallet */}
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "#cbd5e1" }}>
                    <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 }, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Withdrawal Pocket:</Typography>
                      <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#1e293b" }}>
                        {money(data.pockets.withdrawal?.current_balance)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Grid>
          </Grid>

          {/* Statement tabs */}
          <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
            <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
              <Tab label="Chronological Statement (A to Z)" sx={{ fontWeight: 700, textTransform: "none" }} />
              <Tab label="Double-Entry Ledger Log" sx={{ fontWeight: 700, textTransform: "none" }} />
            </Tabs>
          </Box>

          {/* Tab 0: Chronological Statement */}
          {activeTab === 0 && (
            <Paper variant="outlined" sx={{ borderRadius: 4, overflow: "hidden" }}>
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Tx ID</TableCell>
                      <TableCell sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Timestamp</TableCell>
                      <TableCell sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Transaction Type</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Amount</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Main Bal</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Self Bal</TableCell>
                      <TableCell sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>From User</TableCell>
                      <TableCell sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Level/Trigger</TableCell>
                      <TableCell sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {txs
                      .slice(txPage * txRowsPerPage, txPage * txRowsPerPage + txRowsPerPage)
                      .map((tx, idx) => {
                        const isMainImpact = tx.main_balance !== "-";
                        const isSelfImpact = tx.self_balance !== "-";
                        const isDebit = String(tx.amount).startsWith("-");
                        return (
                          <TableRow hover key={tx.id + "-" + idx}>
                            <TableCell sx={{ fontSize: 12 }}>{tx.id}</TableCell>
                            <TableCell sx={{ fontSize: 12, color: "#475569" }}>{tx.created_at}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>
                              <Chip
                                label={tx.type}
                                size="small"
                                variant="outlined"
                                sx={{
                                  fontSize: 10,
                                  height: 20,
                                  fontWeight: 600,
                                  borderColor: isDebit ? "#fecaca" : "#bbf7d0",
                                  backgroundColor: isDebit ? "#fef2f2" : "#f0fdf4",
                                  color: isDebit ? "#991b1b" : "#166534"
                                }}
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700, color: isDebit ? "#b91c1c" : "#15803d" }}>
                              {isDebit ? "-" : ""}{money(tx.amount.replace("-", ""))}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: 12, fontWeight: isMainImpact ? 800 : 400, color: isMainImpact ? "#2563eb" : "#94a3b8" }}>
                              {isMainImpact ? money(tx.main_balance) : "-"}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: 12, fontWeight: isSelfImpact ? 800 : 400, color: isSelfImpact ? "#059669" : "#94a3b8" }}>
                              {isSelfImpact ? money(tx.self_balance) : "-"}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{tx.from_user}</TableCell>
                            <TableCell sx={{ fontSize: 12, color: "#64748b" }}>
                              {tx.level !== "-" ? `${tx.level} ` : ""}{tx.source}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, color: "#334155" }}>{tx.remarks}</TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[25, 50, 100]}
                component="div"
                count={txs.length}
                rowsPerPage={txRowsPerPage}
                page={txPage}
                onPageChange={(e, p) => setTxPage(p)}
                onRowsPerPageChange={(e) => {
                  setTxRowsPerPage(parseInt(e.target.value, 10));
                  setTxPage(0);
                }}
              />
            </Paper>
          )}

          {/* Tab 1: Ledger Entries */}
          {activeTab === 1 && (
            <Paper variant="outlined" sx={{ borderRadius: 4, overflow: "hidden" }}>
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Entry ID</TableCell>
                      <TableCell sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Timestamp</TableCell>
                      <TableCell sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Pocket</TableCell>
                      <TableCell sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Direction</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Amount</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Before</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>After</TableCell>
                      <TableCell sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Ref ID</TableCell>
                      <TableCell sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ledgers
                      .slice(ledgerPage * ledgerRowsPerPage, ledgerPage * ledgerRowsPerPage + ledgerRowsPerPage)
                      .map((le, idx) => {
                        const isCredit = le.direction === "CREDIT";
                        return (
                          <TableRow hover key={le.id + "-" + idx}>
                            <TableCell sx={{ fontSize: 12 }}>{le.id}</TableCell>
                            <TableCell sx={{ fontSize: 12, color: "#475569" }}>{le.created_at}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>
                              <Chip
                                label={le.pocket}
                                size="small"
                                sx={{ fontSize: 10, height: 20, fontWeight: 700 }}
                              />
                            </TableCell>
                            <TableCell sx={{ fontSize: 12 }}>
                              <Chip
                                label={le.direction}
                                size="small"
                                color={isCredit ? "success" : "error"}
                                sx={{ fontSize: 9, height: 18, fontWeight: 800 }}
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700, color: isCredit ? "#15803d" : "#b91c1c" }}>
                              {money(le.amount)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: 12, color: "#475569" }}>{money(le.balance_before)}</TableCell>
                            <TableCell align="right" sx={{ fontSize: 12, fontWeight: 800, color: "#1e293b" }}>{money(le.balance_after)}</TableCell>
                            <TableCell sx={{ fontSize: 12, fontFamily: "monospace", color: "#64748b" }}>{le.entry_ref}</TableCell>
                            <TableCell sx={{ fontSize: 12, color: "#334155" }}>{le.remarks}</TableCell>
                          </TableRow>
                        );
                      })}
                    {ledgers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 4, color: "#64748b" }}>
                          No post-transition double-entry ledger records found for this user.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[25, 50, 100]}
                component="div"
                count={ledgers.length}
                rowsPerPage={ledgerRowsPerPage}
                page={ledgerPage}
                onPageChange={(e, p) => setLedgerPage(p)}
                onRowsPerPageChange={(e) => {
                  setLedgerRowsPerPage(parseInt(e.target.value, 10));
                  setLedgerPage(0);
                }}
              />
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
}
