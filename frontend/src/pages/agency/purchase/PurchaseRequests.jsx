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
  Button,
  Snackbar,
  Alert,
  Chip,
  CircularProgress,
} from "@mui/material";
import API from "../../../api/api";

export default function PurchaseRequests() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });

  const load = async () => {
    try {
      setLoading(true);
      const res = await API.get("/purchase-requests");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setRows(arr);
    } catch (e) {
      setRows([]);
      setSnack({ open: true, type: "error", msg: "Failed to load purchase requests" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id, status) => {
    if (!id) return;
    try {
      setBusyId(id);
      await API.patch(`/purchase-requests/${id}`, { status });
      setSnack({ open: true, type: "success", msg: `Marked ${status}` });
      await load();
    } catch {
      setSnack({ open: true, type: "error", msg: "Failed to update status" });
    } finally {
      setBusyId(null);
    }
  };

  const StatusChip = ({ value }) => {
    const color =
      String(value).toLowerCase() === "approved" ? "success" :
      String(value).toLowerCase() === "rejected" ? "error" : "warning";
    return <Chip size="small" label={value || "Pending"} color={color} />;
  };

  return (
    <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "#0C2D48" }}>
          Purchase Requests
        </Typography>
        <Button size="small" onClick={load}>Refresh</Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={20} /> <Typography variant="body2">Loading...</Typography>
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell>Consumer Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Address</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Payment</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(rows || []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.product_name || r.product}</TableCell>
                <TableCell>{r.consumer_name}</TableCell>
                <TableCell>{r.consumer_email}</TableCell>
                <TableCell>{r.consumer_phone}</TableCell>
                <TableCell>{r.consumer_address}</TableCell>
                <TableCell>{r.quantity}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={(r.payment_method || "wallet").toUpperCase()}
                    color={String(r.payment_method || "").toLowerCase() === "wallet" ? "success" : "default"}
                  />
                </TableCell>
                <TableCell><StatusChip value={r.status} /></TableCell>
                <TableCell align="right">
                  <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={busyId === r.id}
                      onClick={() => updateStatus(r.id, "Approved")}
                      sx={{ backgroundColor: "#2E7D32", "&:hover": { backgroundColor: "#1B5E20" } }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      disabled={busyId === r.id}
                      onClick={() => updateStatus(r.id, "Rejected")}
                    >
                      Reject
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            {(!rows || rows.length === 0) && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography variant="body2" color="text.secondary">No purchase requests yet.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
