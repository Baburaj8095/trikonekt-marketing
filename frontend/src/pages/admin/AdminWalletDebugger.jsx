import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import API from "../../api/api";

function money(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export default function AdminWalletDebugger() {
  const [username, setUsername] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [err, setErr] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Adjustment form states
  const [amount, setAmount] = useState("");
  const [pocket, setPocket] = useState("main");
  const [adjType, setAdjType] = useState("ADJUSTMENT_CREDIT");
  const [reason, setReason] = useState("");

  async function loadUser() {
    if (!username.trim()) return;
    try {
      setLoading(true);
      setErr("");
      setSuccessMsg("");
      const res = await API.get("/admin/wallets/debug/", { params: { username } });
      setData(res?.data || null);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load wallet diagnostics.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    if (!data?.user?.username) return;
    try {
      setActionLoading(true);
      setErr("");
      setSuccessMsg("");
      const res = await API.post("/admin/wallets/debug/", {
        action: "sync",
        username: data.user.username,
      });
      setSuccessMsg(res?.data?.detail || "Wallet balance synced successfully.");
      // Reload user details after sync
      loadUser();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to sync wallet balance.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAdjust() {
    if (!data?.user?.username) return;
    if (!amount) {
      setErr("Adjustment amount is required.");
      return;
    }
    if (!reason.trim()) {
      setErr("Adjustment reason/comment is required.");
      return;
    }

    try {
      setActionLoading(true);
      setErr("");
      setSuccessMsg("");
      const res = await API.post("/admin/wallets/debug/", {
        action: "adjust",
        username: data.user.username,
        amount: amount,
        pocket: pocket,
        type: adjType,
        reason: reason,
      });
      setSuccessMsg(res?.data?.detail || "Manual adjustment applied successfully.");
      // Reset form fields
      setAmount("");
      setReason("");
      // Reload user details
      loadUser();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to apply manual adjustment.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Wallet Debugger & Adjustments
        </Typography>
        <Typography sx={{ color: "#64748b", fontSize: 13 }}>
          Audit cached wallet balances against chronological ledger sums and apply manual adjustments.
        </Typography>
      </Box>

      {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 1 }}>{successMsg}</Alert>}
      {(loading || actionLoading) && <LinearProgress sx={{ mb: 1 }} />}

      {/* Search Section */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField
            size="small"
            label="Search by Username, Phone or ID"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadUser()}
            fullWidth
          />
          <Button variant="contained" onClick={loadUser} disabled={loading}>
            Search
          </Button>
        </Stack>
      </Paper>

      {data && (
        <Grid container spacing={2}>
          {/* Audit Result Cards */}
          <Grid item xs={12} md={8}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
              <Typography sx={{ fontWeight: 900, mb: 1.5 }}>
                Wallet Diagnostics: {data.user.full_name} ({data.user.username})
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, backgroundColor: "#f8fafc" }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#475569", mb: 1 }}>
                      Cached Database Balances
                    </Typography>
                    <Typography sx={{ fontSize: 13 }}>Main Balance: <b>₹{money(data.cached.main)}</b></Typography>
                    <Typography sx={{ fontSize: 13 }}>Self Balance: <b>₹{money(data.cached.self)}</b></Typography>
                    <Typography sx={{ fontSize: 14, mt: 0.5, borderTop: "1px dashed #cbd5e1", pt: 0.5 }}>
                      Total Balance: <b>₹{money(data.cached.total)}</b>
                    </Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, backgroundColor: "#f8fafc" }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#475569", mb: 1 }}>
                      Calculated Ledger Totals
                    </Typography>
                    <Typography sx={{ fontSize: 13 }}>Main Balance: <b>₹{money(data.calculated.main)}</b></Typography>
                    <Typography sx={{ fontSize: 13 }}>Self Balance: <b>₹{money(data.calculated.self)}</b></Typography>
                    <Typography sx={{ fontSize: 14, mt: 0.5, borderTop: "1px dashed #cbd5e1", pt: 0.5 }}>
                      Total Balance: <b>₹{money(data.calculated.total)}</b>
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Mismatch Difference:</Typography>
                  <Chip
                    label={`₹${money(data.diff)}`}
                    color={data.status === "OK" ? "success" : "error"}
                    size="small"
                  />
                  <Chip
                    label={data.status}
                    color={data.status === "OK" ? "success" : "error"}
                    size="small"
                  />
                </Stack>
                {data.status !== "OK" && (
                  <Button
                    variant="contained"
                    color="warning"
                    size="small"
                    onClick={handleSync}
                    disabled={actionLoading}
                  >
                    Force Sync Wallet with Ledger
                  </Button>
                )}
              </Stack>
            </Paper>

            {/* Transaction Ledger list */}
            <Typography sx={{ fontWeight: 900, mb: 1 }}>Recent Ledger History</Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: "#f1f5f9" }}>
                  <TableRow>
                    <TableCell><b>Date/Time</b></TableCell>
                    <TableCell><b>Tx ID</b></TableCell>
                    <TableCell><b>Type</b></TableCell>
                    <TableCell align="right"><b>Amount</b></TableCell>
                    <TableCell align="right"><b>Balance After</b></TableCell>
                    <TableCell><b>Comment/Reason</b></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.transactions && data.transactions.length > 0 ? (
                    data.transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell sx={{ fontSize: 11 }}>{tx.created_at}</TableCell>
                        <TableCell sx={{ fontSize: 11 }}>{tx.id}</TableCell>
                        <TableCell sx={{ fontSize: 11 }}>{tx.type}</TableCell>
                        <TableCell align="right" sx={{ fontSize: 11, color: Number(tx.amount) >= 0 ? "green" : "red" }}>
                          ₹{money(tx.amount)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: 11 }}>₹{money(tx.balance_after)}</TableCell>
                        <TableCell sx={{ fontSize: 11, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tx.meta?.reason || tx.meta?.orig_type || ""}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center">No transactions found for this user.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          {/* Quick Adjustments Sidebar Panel */}
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 900, mb: 2 }}>
                Quick Adjustment Panel
              </Typography>

              <Stack spacing={2}>
                <TextField
                  type="number"
                  label="Adjustment Amount (e.g. 150.00 or -250.00)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  fullWidth
                  size="small"
                />

                <FormControl component="fieldset">
                  <FormLabel component="legend" sx={{ fontSize: 12 }}>Target Pocket</FormLabel>
                  <RadioGroup
                    row
                    value={pocket}
                    onChange={(e) => setPocket(e.target.value)}
                  >
                    <FormControlLabel value="main" control={<Radio size="small" />} label="Main Balance" />
                    <FormControlLabel value="self" control={<Radio size="small" />} label="Self Account" />
                  </RadioGroup>
                </FormControl>

                <FormControl fullWidth size="small">
                  <InputLabel>Transaction Type</InputLabel>
                  <Select
                    value={adjType}
                    label="Transaction Type"
                    onChange={(e) => setAdjType(e.target.value)}
                  >
                    <MenuItem value="ADJUSTMENT_CREDIT">ADJUSTMENT_CREDIT (Direct Credit)</MenuItem>
                    <MenuItem value="ADJUSTMENT_DEBIT">ADJUSTMENT_DEBIT (Direct Debit)</MenuItem>
                    <MenuItem value="INTERNAL_WALLET_CREDIT">INTERNAL_WALLET_CREDIT (Admin Upload)</MenuItem>
                    <MenuItem value="INTERNAL_WALLET_DEBIT">INTERNAL_WALLET_DEBIT (Upgrade Deduction)</MenuItem>
                    <MenuItem value="AUTO_PURCHASE_DEBIT">AUTO_PURCHASE_DEBIT (Prime 150 Auto-Debit)</MenuItem>
                    <MenuItem value="SELF_ACCOUNT_DEBIT">SELF_ACCOUNT_DEBIT (Matrix Auto-Debit)</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="Reason / Comment"
                  multiline
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="Mandatory description logged to transaction meta"
                />

                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleAdjust}
                  disabled={actionLoading}
                  fullWidth
                >
                  Apply Wallet Adjustment
                </Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
