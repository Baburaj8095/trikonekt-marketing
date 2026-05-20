
import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import ImageIcon from "@mui/icons-material/Image";
import API from "../../api/api";
import { formatDateTime } from "../../utils/format";
import { DataGrid } from "@mui/x-data-grid";

export default function AdminWalletUploadRequests() {
  const [loading, setLoading] = useState(true);
  const [screenError, setScreenError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [openImageDialog, setOpenImageDialog] = useState(false);
  const [openRejectDialog, setOpenRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    setScreenError("");
    try {
      const res = await API.get("/business/admin/wallet-upload-requests/");
      setRequests(res.data);
    } catch (err) {
      setScreenError("Failed to load wallet upload requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleViewImage = (imageUrl) => {
    setSelectedRequest((prev) => ({ ...prev, bill_url: imageUrl }));
    setOpenImageDialog(true);
  };

  const handleApprove = async (id) => {
    if (!window.confirm("Are you sure you want to approve this request?")) {
      return;
    }
    setSubmitting(true);
    setScreenError("");
    setSuccessMsg("");
    try {
      await API.post(`/business/admin/wallet-upload-requests/${id}/approve/`);
      setSuccessMsg("Wallet upload request approved successfully.");
      fetchRequests();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to approve request.";
      setScreenError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectClick = (request) => {
    setSelectedRequest(request);
    setOpenRejectDialog(true);
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    if (!rejectReason.trim()) {
      setScreenError("Please provide a reason for rejection.");
      return;
    }

    setSubmitting(true);
    setScreenError("");
    setSuccessMsg("");
    try {
      await API.post(`/business/admin/wallet-upload-requests/${selectedRequest.id}/reject/`, { remarks: rejectReason });
      setSuccessMsg("Wallet upload request rejected successfully.");
      setOpenRejectDialog(false);
      setRejectReason("");
      setSelectedRequest(null);
      fetchRequests();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to reject request.";
      setScreenError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { field: "id", headerName: "ID", width: 70 },
    { field: "user", headerName: "Consumer", width: 150 },
    { field: "amount", headerName: "Amount", width: 100 },
    { field: "utr", headerName: "UTR No.", width: 150 },
    {
      field: "bill",
      headerName: "Bill Screenshot",
      width: 150,
      renderCell: (params) => (
        <Button
          variant="outlined"
          size="small"
          startIcon={<ImageIcon />}
          onClick={() => handleViewImage(params.row.bill_url)}
        >
          View
        </Button>
      ),
    },
    { field: "status", headerName: "Status", width: 120 },
    { field: "requested_at", headerName: "Requested At", width: 180, valueFormatter: (params) => formatDateTime(params.value) },
    { field: "approved_at", headerName: "Approved At", width: 180, valueFormatter: (params) => formatDateTime(params.value) },
    { field: "approved_by", headerName: "Approved By", width: 150 },
    { field: "remarks", headerName: "Remarks", width: 200 },
    {
      field: "actions",
      headerName: "Actions",
      width: 200,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          {params.row.status === "PENDING" ? (
            <>
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<CheckCircleRoundedIcon />}
                onClick={() => handleApprove(params.row.id)}
                disabled={submitting}
              >
                Approve
              </Button>
              <Button
                variant="contained"
                color="error"
                size="small"
                startIcon={<CancelRoundedIcon />}
                onClick={() => handleRejectClick(params.row)}
                disabled={submitting}
              >
                Reject
              </Button>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {params.row.status}
            </Typography>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 1, sm: 2 }, py: 2 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0C2D48" }}>
            Wallet Upload Requests
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            Manage consumer requests to upload funds to their main wallet.
          </Typography>
        </Box>
      </Stack>

      {screenError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {screenError}
        </Alert>
      ) : null}

      {successMsg ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      ) : null}

      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          border: "1px solid #E2E8F0",
          overflow: "hidden",
          height: 600,
          width: "100%",
        }}
      >
        {loading ? (
          <Box sx={{ py: 6, display: "grid", placeItems: "center" }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ width: "100%", height: "100%", overflowX: "auto" }}>
            <Box sx={{ minWidth: 1650, height: "100%" }}>
              <DataGrid
                rows={requests}
                columns={columns}
                pageSize={10}
                rowsPerPageOptions={[10]}
                disableSelectionOnClick
                getRowId={(row) => row.id}
                sx={{
                  minWidth: 1650,
                  "& .MuiDataGrid-cell": {
                    alignItems: "center",
                  },
                }}
              />
            </Box>
          </Box>
        )}
      </Paper>

      {/* Image Dialog */}
      <Dialog open={openImageDialog} onClose={() => setOpenImageDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Payment Screenshot</DialogTitle>
        <DialogContent>
          {selectedRequest?.bill_url ? (
            <Box
              component="img"
              src={selectedRequest.bill_url}
              alt="Payment Screenshot"
              sx={{ maxWidth: "100%", height: "auto" }}
            />
          ) : (
            <Typography>No image available.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenImageDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={openRejectDialog} onClose={() => setOpenRejectDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Wallet Upload Request</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Reason for Rejection"
            type="text"
            fullWidth
            multiline
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRejectDialog(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleReject} color="error" disabled={submitting}>
            {submitting ? "Rejecting..." : "Reject"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
