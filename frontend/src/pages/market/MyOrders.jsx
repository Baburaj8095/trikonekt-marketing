import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  Button,
} from "@mui/material";
import API from "../../api/api";

export default function MyOrders() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });

  const load = async () => {
    try {
      setLoading(true);
      const res = await API.get("/purchase-requests", { params: { mine: 1 } });
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setRows(arr);
    } catch {
      setRows([]);
      setSnack({ open: true, type: "error", msg: "Failed to load your purchase requests" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const StatusChip = ({ value }) => {
    const color =
      String(value).toLowerCase() === "approved" ? "success" :
      String(value).toLowerCase() === "rejected" ? "error" : "warning";
    return <Chip size="small" label={value || "Pending"} color={color} />;
  };

  return (
    <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
          My Orders
        </Typography>
        <Button size="small" onClick={load}>Refresh</Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={20} /> <Typography variant="body2">Loading...</Typography>
        </Box>
      ) : (
        <Box sx={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <Table size="small" sx={{ minWidth: 600 }}>
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell>Quantity</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Requested At</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rows || []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.product_name || r.product}</TableCell>
                  <TableCell>{r.quantity}</TableCell>
                  <TableCell><StatusChip value={r.status} /></TableCell>
                  <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</TableCell>
                </TableRow>
              ))}
              {(!rows || rows.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary">
                      You haven't placed any purchase requests yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.type} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
