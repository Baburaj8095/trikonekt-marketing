import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Grid,
  LinearProgress,
  Paper,
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

export default function AdminDailySalesReport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Initialize with the current month's range
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const formatDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };

    setFrom(formatDate(firstDay));
    setTo(formatDate(today));
  }, []);

  async function loadReport() {
    if (!from || !to) return;
    try {
      setLoading(true);
      setErr("");
      const res = await API.get("/admin/analytics/sales/", {
        params: { from, to },
      });
      setData(res?.data || null);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load sales report.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // Load report when dates are initialized
  useEffect(() => {
    if (from && to) {
      loadReport();
    }
  }, [from, to]);

  // Export local state to CSV
  function handleExportCSV() {
    if (!data?.results || data.results.length === 0) return;
    
    const headers = [
      "Date",
      "Packages Sold (Count)",
      "Packages Revenue (₹)",
      "Upgrades Completed (Count)",
      "Upgrades Revenue (₹)",
      "Total Daily Revenue (₹)"
    ];
    
    const rows = data.results.map((r) => [
      r.date,
      r.packages_count,
      money(r.packages_amount),
      r.upgrades_count,
      money(r.upgrades_amount),
      money(r.total_amount)
    ]);
    
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_report_${from}_to_${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Daily Sales Analytics Report
          </Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Track daily revenue generated from packages subscriptions and matrix rank upgrades.
          </Typography>
        </Box>
        {data?.results && data.results.length > 0 && (
          <Button variant="outlined" onClick={handleExportCSV}>
            Export to CSV
          </Button>
        )}
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
      {loading && <LinearProgress sx={{ mb: 1 }} />}

      {/* Date Filters */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
          <TextField
            type="date"
            label="From Date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            fullWidth
          />
          <TextField
            type="date"
            label="To Date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            fullWidth
          />
          <Button variant="contained" onClick={loadReport} disabled={loading} sx={{ minWidth: 100 }}>
            Run
          </Button>
        </Stack>
      </Paper>

      {data && (
        <Box>
          {/* Executive Summary Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: "center", backgroundColor: "#f8fafc" }}>
                <Typography sx={{ color: "#64748b", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
                  Total Consolidated Revenue
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, color: "#1e3a8a", mt: 0.5 }}>
                  ₹{money(data.summary.total_revenue)}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: "center", backgroundColor: "#f8fafc" }}>
                <Typography sx={{ color: "#64748b", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
                  Packages Revenue
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f766e", mt: 0.5 }}>
                  ₹{money(data.summary.packages_amount)}
                </Typography>
                <Typography sx={{ color: "#64748b", fontSize: 11, mt: 0.5 }}>
                  ({data.summary.packages_count} activations)
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: "center", backgroundColor: "#f8fafc" }}>
                <Typography sx={{ color: "#64748b", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
                  Rank Upgrades Revenue
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: "#b45309", mt: 0.5 }}>
                  ₹{money(data.summary.upgrades_amount)}
                </Typography>
                <Typography sx={{ color: "#64748b", fontSize: 11, mt: 0.5 }}>
                  ({data.summary.upgrades_count} upgrades)
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Daily Table */}
          <Typography sx={{ fontWeight: 900, mb: 1.5 }}>Daily Breakdown</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: "#f1f5f9" }}>
                <TableRow>
                  <TableCell><b>Date</b></TableCell>
                  <TableCell align="right"><b>Packages Count</b></TableCell>
                  <TableCell align="right"><b>Packages Volume</b></TableCell>
                  <TableCell align="right"><b>Upgrades Count</b></TableCell>
                  <TableCell align="right"><b>Upgrades Volume</b></TableCell>
                  <TableCell align="right"><b>Total Sales Revenue</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.results && data.results.length > 0 ? (
                  data.results.map((row) => (
                    <TableRow key={row.date} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{row.date}</TableCell>
                      <TableCell align="right">{row.packages_count}</TableCell>
                      <TableCell align="right">₹{money(row.packages_amount)}</TableCell>
                      <TableCell align="right">{row.upgrades_count}</TableCell>
                      <TableCell align="right">₹{money(row.upgrades_amount)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: "#1e3a8a" }}>
                        ₹{money(row.total_amount)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No sales records found in selected range.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
}
