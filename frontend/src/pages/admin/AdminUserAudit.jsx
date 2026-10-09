import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  TextField,
  Button,
  Chip,
  Grid,
  Divider,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import HubIcon from "@mui/icons-material/Hub";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import HistoryIcon from "@mui/icons-material/History";
import API from "../../api/api";

function money(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "₹0.00";
}

export default function AdminUserAudit() {
  const [query, setQuery] = useState("9999999999");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [matrixTab, setMatrixTab] = useState(0);

  const fetchAudit = async (searchParam) => {
    const q = searchParam !== undefined ? searchParam : query;
    if (!q || !q.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await API.get("/admin/wallets/user-audit/", { params: { q: q.trim() } });
      if (res.data?.success) {
        setData(res.data);
      } else {
        setError(res.data?.error || "User audit data could not be fetched.");
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Failed to load audit data.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit("9999999999");
  }, []);

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1} sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 1 }}>
            <AccountBalanceWalletIcon color="primary" /> User Wallet & Earnings Audit
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b" }}>
            Granular breakdown of user balance, revenue streams, 5-Block & 3-Block payouts, vouchers, and reconciliations.
          </Typography>
        </Box>
        {data && (
          <Chip
            icon={<CheckCircleIcon />}
            label="Ledger Reconciled"
            color="success"
            sx={{ fontWeight: 700 }}
          />
        )}
      </Stack>

      {/* Search Bar */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 3, bgcolor: "#fff" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
          <TextField
            size="small"
            placeholder="Search by phone (e.g. 9999999999), username, or User ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchAudit()}
            fullWidth
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: "#94a3b8", mr: 1 }} />,
            }}
          />
          <Button
            variant="contained"
            onClick={() => fetchAudit()}
            disabled={loading}
            sx={{ minWidth: 120, height: 40, fontWeight: 700, borderRadius: 2 }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : "Audit User"}
          </Button>
        </Stack>

        {/* Quick Chips */}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} alignItems="center">
          <Typography variant="caption" sx={{ color: "#94a3b8", fontWeight: 600 }}>Quick search:</Typography>
          {["9999999999", "admin"].map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              onClick={() => {
                setQuery(tag);
                fetchAudit(tag);
              }}
              clickable
              sx={{ bgcolor: "#f1f5f9", fontWeight: 600, "&:hover": { bgcolor: "#e2e8f0" } }}
            />
          ))}
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {data && (
        <Stack spacing={3}>
          {/* 1. User Profile & Wallet Cards */}
          <Grid container spacing={2}>
            {/* User Profile Card */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ borderRadius: 3, height: "100%", bgcolor: "#fff" }}>
                <CardContent>
                  <Typography variant="caption" sx={{ textTransform: "uppercase", fontWeight: 800, color: "#64748b", letterSpacing: 0.5 }}>
                    User Profile
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", mt: 0.5 }}>
                    {data.user?.full_name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#64748b", mb: 2 }}>
                    @{data.user?.username} • ID: {data.user?.id} ({data.user?.prefixed_id})
                  </Typography>

                  <Divider sx={{ my: 1.5 }} />

                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: "#64748b" }}>Phone:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{data.user?.phone}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: "#64748b" }}>Status:</Typography>
                      <Chip
                        size="small"
                        label={data.user?.account_active ? "Active" : "Inactive"}
                        color={data.user?.account_active ? "success" : "default"}
                        sx={{ height: 22, fontWeight: 700 }}
                      />
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: "#64748b" }}>Sponsor:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{data.user?.sponsor}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: "#64748b" }}>Joined:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {data.user?.date_joined ? new Date(data.user.date_joined).toLocaleString("en-IN") : "N/A"}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Wallet Balances Card */}
            <Grid item xs={12} md={8}>
              <Card variant="outlined" sx={{ borderRadius: 3, height: "100%", bgcolor: "#fff" }}>
                <CardContent>
                  <Typography variant="caption" sx={{ textTransform: "uppercase", fontWeight: 800, color: "#64748b", letterSpacing: 0.5 }}>
                    Wallet Balances & Breakdown
                  </Typography>
                  <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    <Grid item xs={6} sm={3}>
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc", textAlign: "center" }}>
                        <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700 }}>Main Wallet</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: "#059669", mt: 0.5 }}>
                          {money(data.wallet?.main_balance)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#94a3b8" }}>Spendable</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc", textAlign: "center" }}>
                        <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700 }}>Ledger Balance</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: "#0f172a", mt: 0.5 }}>
                          {money(data.wallet?.ledger_balance)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#94a3b8" }}>Total Ledger</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc", textAlign: "center" }}>
                        <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700 }}>Self 25% Reserve</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: "#7c3aed", mt: 0.5 }}>
                          {money(data.wallet?.self_account_balance)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#94a3b8" }}>Next Rebirth ₹250</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc", textAlign: "center" }}>
                        <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700 }}>Bonus / Reward</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: "#2563eb", mt: 0.5 }}>
                          {money(data.wallet?.bonus_wallet)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#94a3b8" }}>Coin Balance</Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  {/* Flow Summary Bar */}
                  <Paper variant="outlined" sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: "#f1f5f9" }}>
                    <Grid container spacing={1} alignItems="center">
                      <Grid item xs={12} sm={4}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TrendingUpIcon color="success" />
                          <Box>
                            <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 600 }}>Total Inflows</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: "#059669" }}>{money(data.reconciliation?.total_inflows)}</Typography>
                          </Box>
                        </Stack>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TrendingDownIcon color="error" />
                          <Box>
                            <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 600 }}>Total Outflows</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: "#dc2626" }}>{money(data.reconciliation?.total_outflows)}</Typography>
                          </Box>
                        </Stack>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Box sx={{ textAlign: { sm: "right" } }}>
                          <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 600 }}>Net Flow Balance</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: "#0f172a" }}>{money(data.reconciliation?.calculated_net)}</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* 2. Inflows & Earnings by Revenue Stream */}
          <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: "#fff" }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", mb: 1.5 }}>
                Earnings & Inflow Breakdown ({data.credits_by_stream?.length || 0} Streams)
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f8fafc" }}>
                      <TableCell sx={{ fontWeight: 800 }}>Revenue Stream</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Source / Module</TableCell>
                      <TableCell sx={{ fontWeight: 800 }} align="center">Transactions</TableCell>
                      <TableCell sx={{ fontWeight: 800 }} align="right">Total Credited</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.credits_by_stream?.map((c, i) => (
                      <TableRow key={i} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{c.stream}</TableCell>
                        <TableCell sx={{ color: "#64748b" }}>{c.source}</TableCell>
                        <TableCell align="center">{c.count}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: "#059669" }}>
                          {money(c.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: "#f8fafc" }}>
                      <TableCell colSpan={3} sx={{ fontWeight: 800 }}>TOTAL INFLOW CREDITS</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: "#059669", fontSize: 15 }}>
                        {money(data.total_credits)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* 3. Block Roots Breakdown (5-Block vs 3-Block) */}
          <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: "#fff" }}>
            <CardContent>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 1 }}>
                    <HubIcon color="secondary" /> Block Seats & Per-Account Earnings Breakdown
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#64748b" }}>
                    Per-ID earnings for Root ID, Join Subscription (750), Smart SSP, and Self Rebirth (₹250) IDs.
                  </Typography>
                </Box>
                <Tabs value={matrixTab} onChange={(_, v) => setMatrixTab(v)}>
                  <Tab label="5-Block (FIVE_150)" sx={{ fontWeight: 700 }} />
                  <Tab label="3-Block (THREE_150)" sx={{ fontWeight: 700 }} />
                </Tabs>
              </Stack>

              {/* Tab 0: 5-Block */}
              {matrixTab === 0 && (
                <Box>
                  {/* Category totals */}
                  <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    {Object.entries(data.matrix_5?.totals_by_category || {}).map(([cat, info]) => (
                      <Grid item xs={6} sm={3} key={cat}>
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc" }}>
                          <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700 }}>
                            {cat === "OTHER" ? "MAIN ROOT ID" : cat}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", mt: 0.5 }}>
                            {info.count} ID{info.count > 1 ? "s" : ""}
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "#059669" }}>
                            Earned: {money(info.earned)}
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>

                  {/* Active Nodes Table */}
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Active 5-Block Roots with Earnings</Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: "#f8fafc" }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Account ID</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Username Key</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">Total Earned</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.matrix_5?.roots?.filter((r) => Number(r.total_earned || 0) > 0).map((r) => (
                          <TableRow key={r.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>#{r.id}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: "#2563eb" }}>{r.username_key}</TableCell>
                            <TableCell>
                              <Chip size="small" label={r.category} sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, color: "#059669" }}>
                              {money(r.total_earned)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Tab 1: 3-Block */}
              {matrixTab === 1 && (
                <Box>
                  {/* Category totals */}
                  <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    {Object.entries(data.matrix_3?.totals_by_category || {}).map(([cat, info]) => (
                      <Grid item xs={6} sm={3} key={cat}>
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc" }}>
                          <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700 }}>
                            {cat === "OTHER" ? "MAIN ROOT ID" : cat}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", mt: 0.5 }}>
                            {info.count} ID{info.count > 1 ? "s" : ""}
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "#059669" }}>
                            Earned: {money(info.earned)}
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>

                  {/* Active Nodes Table */}
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Active 3-Block Roots with Earnings</Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: "#f8fafc" }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Account ID</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Username Key</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">Total Earned</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.matrix_3?.roots?.filter((r) => Number(r.total_earned || 0) > 0).map((r) => (
                          <TableRow key={r.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>#{r.id}</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: "#7c3aed" }}>{r.username_key}</TableCell>
                            <TableCell>
                              <Chip size="small" label={r.category} sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, color: "#059669" }}>
                              {money(r.total_earned)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* 4. Debits & Outflows Breakdown */}
          <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: "#fff" }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", mb: 1.5 }}>
                Purchases & Outflows Summary
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f8fafc" }}>
                      <TableCell sx={{ fontWeight: 800 }}>Debit Category</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Source / Module</TableCell>
                      <TableCell sx={{ fontWeight: 800 }} align="center">Count</TableCell>
                      <TableCell sx={{ fontWeight: 800 }} align="right">Total Debited</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.debits_by_stream?.map((d, i) => (
                      <TableRow key={i} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{d.type}</TableCell>
                        <TableCell sx={{ color: "#64748b" }}>{d.source}</TableCell>
                        <TableCell align="center">{d.count}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: "#dc2626" }}>
                          {money(d.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: "#f8fafc" }}>
                      <TableCell colSpan={3} sx={{ fontWeight: 800 }}>TOTAL DEBITED</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: "#dc2626", fontSize: 15 }}>
                        {money(data.total_debits)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* 5. Vouchers / Gift Cards Assigned */}
          <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: "#fff" }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                <CardGiftcardIcon color="warning" /> Assigned P2P Vouchers & Gift Cards ({data.vouchers?.length || 0})
              </Typography>
              {data.vouchers && data.vouchers.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: "#f8fafc" }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Sender</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="center">Status</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Redeemed At</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.vouchers.map((v) => (
                        <TableRow key={v.id} hover>
                          <TableCell sx={{ fontWeight: 700, fontFamily: "monospace" }}>{v.code}</TableCell>
                          <TableCell>{v.sender}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800 }}>{money(v.amount)}</TableCell>
                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={v.status}
                              color={v.status === "REDEEMED" ? "success" : "warning"}
                              sx={{ fontWeight: 700, height: 22 }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: "#64748b" }}>
                            {v.redeemed_at ? new Date(v.redeemed_at).toLocaleString("en-IN") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" sx={{ color: "#94a3b8" }}>No vouchers found for this user.</Typography>
              )}
            </CardContent>
          </Card>

          {/* 6. Recent 50 Ledger Transactions */}
          <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: "#fff" }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                <HistoryIcon color="info" /> Recent Ledger Transactions (Last 50)
              </Typography>
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, bgcolor: "#f8fafc" }}>ID</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: "#f8fafc" }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: "#f8fafc" }}>Source</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: "#f8fafc" }} align="right">Amount</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: "#f8fafc" }}>Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.recent_transactions?.map((t) => {
                      const isPositive = Number(t.amount) > 0;
                      return (
                        <TableRow key={t.id} hover>
                          <TableCell sx={{ color: "#94a3b8" }}>#{t.id}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{t.type}</TableCell>
                          <TableCell sx={{ color: "#64748b" }}>
                            {t.source_type} {t.source_id ? `(${t.source_id})` : ""}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: isPositive ? "#059669" : "#dc2626" }}>
                            {isPositive ? "+" : ""}{money(t.amount)}
                          </TableCell>
                          <TableCell sx={{ color: "#64748b", whiteSpace: "nowrap" }}>
                            {t.created_at ? new Date(t.created_at).toLocaleString("en-IN") : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Stack>
      )}
    </Box>
  );
}
