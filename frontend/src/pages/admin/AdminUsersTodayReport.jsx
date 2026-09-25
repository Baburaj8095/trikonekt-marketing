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

export default function AdminUsersTodayReport() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  async function fetchTodayReport() {
    if (!selectedDate) return;
    setLoading(true);
    setErr("");
    try {
      const res = await API.get("/admin/users/", {
        params: {
          date_joined: selectedDate,
          page_size: 150,
        },
      });
      const items = res?.data?.results || [];
      setRows(Array.isArray(items) ? items : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load Users Today Report.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTodayReport();
  }, [selectedDate]);

  function exportCSV() {
    if (!rows.length) return;
    const headers = [
      "SLNO",
      "User Code",
      "User Name",
      "Sponsor Code",
      "Sponsor Name",
      "Address Pincode",
      "Current Layer Status",
      "Today Earning",
      "Today Use",
      "Self Blocks Count",
      "Package Purchase Coupon Report",
    ];
    const dataRows = rows.map((r, idx) => [
      idx + 1,
      r.phone || r.username || r.user_code || "",
      r.full_name || r.username || "",
      r.sponsor_id || "",
      r.sponsor_name || "",
      r.pincode || r.address_pincode || "",
      r.commission_level ? `Layer ${r.commission_level}` : r.current_rank || "Free Tier",
      r.today_earning || "0.00",
      r.today_spent || "0.00",
      r.self_blocks_count ?? 1,
      r.coupon_pocket || "0.00",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...dataRows.map((e) => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `users_today_report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2} sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a" }}>
            Users Today Report (Image 5)
          </Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13, mt: 0.3 }}>
            Real-time feed of users active or joined today with daily earnings, wallet usage, and self blocks.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchTodayReport} disabled={loading} sx={{ fontWeight: 700, borderRadius: 2, textTransform: "none" }}>
            Refresh
          </Button>
          <Button variant="contained" color="primary" startIcon={<FileDownloadIcon />} onClick={exportCSV} disabled={!rows.length} sx={{ fontWeight: 700, borderRadius: 2, textTransform: "none" }}>
            Export
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2.5, backgroundColor: "#ffffff" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <TextField type="date" label="Select Date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small" fullWidth />
          <Button variant="contained" onClick={fetchTodayReport} disabled={loading} sx={{ minWidth: 120, height: 40, fontWeight: 700, borderRadius: 2, textTransform: "none" }}>
            Fetch Day
          </Button>
        </Stack>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2.5, overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 1250 }}>
          <TableHead sx={{ backgroundColor: "#f8fafc" }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 800, width: 70 }}>SLNO</TableCell>
              <TableCell sx={{ fontWeight: 800, width: 80 }}>View</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>User Code</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>User Name</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Sponser Code</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Sponser Name</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Address Pincode</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>Current Layer Status</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>Today Earning</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>Today Use</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>Self Blocks Count</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>Package Purchase Coupon Report</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>Export</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, idx) => (
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
                    onClick={() => alert(`User: ${row.full_name || row.username}\nPhone: ${row.phone}\nWallet: ₹${money(row.wallet_balance || row.main_wallet)}`)}
                  >
                    View
                  </button>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{row.phone || row.username || row.user_code || "—"}</TableCell>
                <TableCell>{row.full_name || row.username || "—"}</TableCell>
                <TableCell>{row.sponsor_id || "—"}</TableCell>
                <TableCell>{row.sponsor_name || "—"}</TableCell>
                <TableCell>{row.pincode || row.address_pincode || "—"}</TableCell>
                <TableCell align="center">
                  <Chip
                    size="small"
                    label={row.commission_level ? `Layer ${row.commission_level}` : row.current_rank || "Layer 1"}
                    sx={{ backgroundColor: "#e0e7ff", color: "#3730a3", fontWeight: 700, fontSize: 11 }}
                  />
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: "#16a34a" }}>
                  ₹{money(row.today_earning || 0)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: "#dc2626" }}>
                  ₹{money(row.today_spent || 0)}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>
                  {row.self_blocks_count ?? 1}
                </TableCell>
                <TableCell align="center">
                  <Chip size="small" label={row.coupon_pocket ? `₹${money(row.coupon_pocket)}` : "Active"} variant="outlined" sx={{ fontWeight: 700, fontSize: 11 }} />
                </TableCell>
                <TableCell align="center">
                  <Button size="small" onClick={exportCSV} sx={{ textTransform: "none", fontSize: 11, fontWeight: 700 }}>
                    CSV
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={13} align="center" sx={{ py: 4, color: "#64748b" }}>
                  No user activity recorded for {selectedDate}.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
