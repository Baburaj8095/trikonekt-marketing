import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Stack,
  Button,
} from "@mui/material";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import LocalActivityIcon from "@mui/icons-material/LocalActivity";
import LoopIcon from "@mui/icons-material/Loop";
import GroupIcon from "@mui/icons-material/Group";
import API from "../../api/api";

function money(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? `₹${n.toFixed(2)}` : "-";
}

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [metrics, setMetrics] = useState({});

  const loadData = async () => {
    setLoading(true);
    setErr("");
    try {
      // 1. Fetch users (latest 1000 users for geo mapping)
      const usersRes = await API.get("/api/admin/users/", {
        params: { page_size: 1000 },
      });
      // Handle array or paginated response format
      const usersData = Array.isArray(usersRes?.data) 
        ? usersRes.data 
        : (Array.isArray(usersRes?.data?.results) ? usersRes.data.results : []);
      setUsers(usersData);

      // 2. Fetch central ledger (latest 200 entries for cash flow)
      const ledgerRes = await API.get("/admin/wallets/ledger/", {
        params: { page_size: 200 },
      });
      const ledgerData = Array.isArray(ledgerRes?.data)
        ? ledgerRes.data
        : (Array.isArray(ledgerRes?.data?.results) ? ledgerRes.data.results : []);
      setTransactions(ledgerData);

      // 3. Fetch system metrics for coupons count
      const metricsRes = await API.get("admin/metrics/");
      setMetrics(metricsRes?.data || {});

    } catch (e) {
      console.error(e);
      setErr("Failed to load analytics data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Geodemographic calculations ---
  const geoStats = useMemo(() => {
    const pincodesMap = {};
    const districtsMap = {};
    const statesMap = {};

    users.forEach((u) => {
      // 1. Pincodes
      const pin = u.pincode || u.address_pincode || "Unknown Pincode";
      pincodesMap[pin] = (pincodesMap[pin] || 0) + 1;

      // 2. Districts (City)
      const dist = u.city || "Unknown District";
      districtsMap[dist] = (districtsMap[dist] || 0) + 1;

      // 3. States
      const state = u.state || "Unknown State";
      statesMap[state] = (statesMap[state] || 0) + 1;
    });

    const topPincodes = Object.entries(pincodesMap)
      .map(([key, val]) => ({ name: key, count: val }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topDistricts = Object.entries(districtsMap)
      .map(([key, val]) => ({ name: key, count: val }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topStates = Object.entries(statesMap)
      .map(([key, val]) => ({ name: key, count: val }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { topPincodes, topDistricts, topStates };
  }, [users]);

  // --- Cash Flow calculations ---
  const cashFlowStats = useMemo(() => {
    const dailyData = {};
    
    // Group transactions by date (YYYY-MM-DD)
    transactions.forEach((tx) => {
      if (!tx.created_at) return;
      const dateStr = new Date(tx.created_at).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      });
      
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { inflow: 0, outflow: 0 };
      }

      const amt = Math.abs(Number(tx.amount || 0));
      // credits increase balance (inflow), debits/withdrawals decrease balance (outflow)
      if (Number(tx.amount || 0) > 0) {
        dailyData[dateStr].inflow += amt;
      } else {
        dailyData[dateStr].outflow += amt;
      }
    });

    return Object.entries(dailyData)
      .map(([date, vals]) => ({
        date,
        inflow: vals.inflow,
        outflow: vals.outflow,
      }))
      .slice(0, 7); // Show last 7 active transaction days
  }, [transactions]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (err) {
    return (
      <Box sx={{ p: 2, textAlign: "center" }}>
        <Typography color="error" sx={{ fontWeight: 800, mb: 2 }}>{err}</Typography>
        <Button variant="contained" onClick={loadData} startIcon={<LoopIcon />}>Retry</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#0C2D48" }}>
            Geodemographic & Cash Flow Analytics
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
            Real-time geographical performance, daily transaction flows, and coupon distribution.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={loadData} startIcon={<LoopIcon />}>
          Reload
        </Button>
      </Stack>

      <Grid container spacing={2}>
        {/* Row 1: Geodemographic Leaderboards */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid #EEF2F6" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <LocationOnIcon color="primary" />
              <Typography sx={{ fontWeight: 900, color: "#0C2D48" }}>Top Registered Pincodes</Typography>
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Pincode</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>Members</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {geoStats.topPincodes.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: "primary.main" }}>{row.count}</TableCell>
                    </TableRow>
                  ))}
                  {geoStats.topPincodes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} align="center">No data found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid #EEF2F6" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <LocationOnIcon color="secondary" />
              <Typography sx={{ fontWeight: 900, color: "#0C2D48" }}>Top Districts (Cities)</Typography>
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>District/City</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>Members</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {geoStats.topDistricts.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: "secondary.main" }}>{row.count}</TableCell>
                    </TableRow>
                  ))}
                  {geoStats.topDistricts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} align="center">No data found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid #EEF2F6" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <GroupIcon color="success" />
              <Typography sx={{ fontWeight: 900, color: "#0C2D48" }}>Top States</Typography>
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>State</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>Members</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {geoStats.topStates.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: "success.main" }}>{row.count}</TableCell>
                    </TableRow>
                  ))}
                  {geoStats.topStates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} align="center">No data found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Row 2: Cash Flow Analytics & Charts */}
        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid #EEF2F6" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <ShowChartIcon color="primary" />
              <Typography sx={{ fontWeight: 900, color: "#0C2D48" }}>Cash Flow (Inflow vs Outflow)</Typography>
            </Stack>
            
            <Stack spacing={2}>
              {cashFlowStats.map((item, idx) => {
                const total = (item.inflow + item.outflow) || 1;
                const inflowPct = (item.inflow / total) * 100;
                const outflowPct = (item.outflow / total) * 100;

                return (
                  <Box key={idx} sx={{ p: 1.2, borderBottom: "1px solid #F1F5F9" }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.8 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#0C2D48" }}>{item.date}</Typography>
                      <Stack direction="row" spacing={2}>
                        <Typography sx={{ fontSize: 12, fontWeight: 800, color: "success.main" }}>
                          In: {money(item.inflow)}
                        </Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 800, color: "error.main" }}>
                          Out: {money(item.outflow)}
                        </Typography>
                      </Stack>
                    </Stack>
                    {/* Visual Stack bar */}
                    <Box sx={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", bgcolor: "#E2E8F0" }}>
                      <Box sx={{ width: `${inflowPct}%`, bgcolor: "success.main" }} title="Inflow" />
                      <Box sx={{ width: `${outflowPct}%`, bgcolor: "error.main" }} title="Outflow" />
                    </Box>
                  </Box>
                );
              })}
              {cashFlowStats.length === 0 && (
                <Typography variant="body2" sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>
                  No recent cash flow ledger entries found.
                </Typography>
              )}
            </Stack>
          </Paper>
        </Grid>

        {/* Row 3: Coupon System Aggregations */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid #EEF2F6", height: "100%" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <LocalActivityIcon color="primary" />
              <Typography sx={{ fontWeight: 900, color: "#0C2D48" }}>Coupon Summary</Typography>
            </Stack>
            
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Box>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                  Coupons Redeemed
                </Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 950, color: "primary.main", mt: 0.5 }}>
                  {metrics?.coupons?.redeemed ?? "-"}
                </Typography>
                <LinearProgress variant="determinate" value={100} color="primary" sx={{ height: 4, borderRadius: 2, mt: 1 }} />
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                  Active Coupon Purchases
                </Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 950, color: "success.main", mt: 0.5 }}>
                  {metrics?.walletPocketStats?.couponPocket?.totalCount ?? "-"}
                </Typography>
                <LinearProgress variant="determinate" value={100} color="success" sx={{ height: 4, borderRadius: 2, mt: 1 }} />
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                  Self-Rebirth coupons
                </Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 950, color: "secondary.main", mt: 0.5 }}>
                  {metrics?.walletPocketStats?.selfPackagePocket?.totalCount ?? "-"}
                </Typography>
                <LinearProgress variant="determinate" value={100} color="secondary" sx={{ height: 4, borderRadius: 2, mt: 1 }} />
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
