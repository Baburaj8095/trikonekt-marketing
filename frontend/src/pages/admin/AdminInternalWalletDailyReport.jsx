import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
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
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import RefreshIcon from "@mui/icons-material/Refresh";
import API from "../../api/api";

function money(v) {
  const n = Number(v || 0);
  return Number.isFinite(n)
    ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";
}

export default function AdminInternalWalletDailyReport() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dt = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dt}`;
    };
    setDateFrom(fmt(firstDay));
    setDateTo(fmt(today));
  }, []);

  async function fetchReport() {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    setErr("");
    try {
      const res = await API.get("/admin/finance/transactions/", {
        params: {
          date_from: dateFrom,
          date_to: dateTo,
          page_size: 200,
        },
      });
      const items = res?.data?.results || [];
      setRows(Array.isArray(items) ? items : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load internal wallet daily report.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchReport();
    }
  }, [dateFrom, dateTo]);

  function exportCSV() {
    if (!rows.length) return;
    const headers = [
      "SLNO",
      "Date",
      "Time",
      "User ID",
      "User Name",
      "Current Wallet Balance",
      "Self Coupon Status",
      "Package Coupon",
      "Withdraw Status",
      "Remaining Balance",
    ];
    const dataRows = rows.map((r, idx) => {
      const dt = r.created_at ? new Date(r.created_at) : new Date();
      return [
        idx + 1,
        dt.toISOString().split("T")[0],
        dt.toTimeString().split(" ")[0],
        r.user?.phone || r.user?.username || r.user_id || "",
        r.user?.full_name || r.user?.username || "",
        r.before_balance || "0.00",
        r.self_coupon_status || "Active",
        r.package_coupon || "Standard",
        r.withdrawal_status || (r.category === "WITHDRAWAL" ? r.status : "—"),
        r.after_balance || "0.00",
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...dataRows.map((e) => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `internal_wallet_daily_report_${dateFrom}_to_${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2} sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a" }}>
            Internal Wallet Transaction Daily Report (Image 4)
          </Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13, mt: 0.3 }}>
            Daily breakdown of internal wallet balance velocity, self coupon usage, package coupons, and closing balances.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchReport} disabled={loading} sx={{ fontWeight: 700, borderRadius: 2, textTransform: "none" }}>
            Refresh
          </Button>
          <Button variant="contained" color="primary" startIcon={<FileDownloadIcon />} onClick={exportCSV} disabled={!rows.length} sx={{ fontWeight: 700, borderRadius: 2, textTransform: "none" }}>
            Export CSV
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2.5, backgroundColor: "#ffffff" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <TextField type="date" label="From Date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} size="small" fullWidth />
          <TextField type="date" label="To Date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} size="small" fullWidth />
          <Button variant="contained" onClick={fetchReport} disabled={loading} sx={{ minWidth: 120, height: 40, fontWeight: 700, borderRadius: 2, textTransform: "none" }}>
            Filter
          </Button>
        </Stack>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: "#f8fafc" }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 800, width: 70 }}>SLNO</TableCell>
              <TableCell sx={{ fontWeight: 800, width: 80 }}>View</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>User ID</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>User Name</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>Current Wallet Balance</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>Self Coupon Status</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>Package Coupon</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>Withdraw Status</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>Remaining Balance</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, idx) => {
              const dt = row.created_at ? new Date(row.created_at) : new Date();
              const dateStr = dt.toISOString().split("T")[0];
              const timeStr = dt.toTimeString().split(" ")[0];
              return (
                <TableRow key={row.id || idx} hover>
                  <TableCell sx={{ fontWeight: 700 }}>{idx + 1}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      style={{
                        padding: "4px 8px",
                        background: "#0f172a",
                        color: "#fff",
                        borderRadius: 6,
                        border: "none",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      onClick={() => alert(`Transaction #${row.id || row.transaction_ref}\nAmount: ₹${money(row.gross_amount || row.amount)}\nType: ${row.category || "Transfer"}`)}
                    >
                      View
                    </button>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{dateStr}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", color: "#64748b" }}>{timeStr}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{row.user?.phone || row.user?.username || row.user_id || "—"}</TableCell>
                  <TableCell>{row.user?.full_name || row.user?.username || "—"}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>₹{money(row.before_balance || row.gross_amount || 0)}</TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={row.self_coupon_status || "Active"} color="success" sx={{ fontSize: 11, fontWeight: 700 }} />
                  </TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={row.package_coupon || "Prime 750"} variant="outlined" sx={{ fontSize: 11, fontWeight: 700 }} />
                  </TableCell>
                  <TableCell align="center">
                    {row.category === "WITHDRAWAL" ? (
                      <Chip size="small" label={row.status || "Approved"} color={row.status === "approved" ? "success" : "warning"} sx={{ fontSize: 11, fontWeight: 700 }} />
                    ) : (
                      <span style={{ color: "#94a3b8" }}>—</span>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: "#1e3a8a" }}>₹{money(row.after_balance || row.net_amount || 0)}</TableCell>
                </TableRow>
              );
            })}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} align="center" sx={{ py: 4, color: "#64748b" }}>
                  No internal wallet transactions found for the selected date range.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
