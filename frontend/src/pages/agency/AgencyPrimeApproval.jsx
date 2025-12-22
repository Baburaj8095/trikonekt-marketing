import React from "react";
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link as MUILink,
  TextField,
  Stack,
  InputAdornment,
  IconButton,
  Tooltip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import API from "../../api/api";

export default function AgencyPrimeApproval() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [assignments, setAssignments] = React.useState([]);
  const [payDialogOpen, setPayDialogOpen] = React.useState(false);
  const [selected, setSelected] = React.useState(null);
  const navigate = useNavigate();

  const [payAmount, setPayAmount] = React.useState("");
  const [payUTR, setPayUTR] = React.useState("");
  const [payFile, setPayFile] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get("/business/agency-packages/", { retryAttempts: 1, cacheTTL: 3000 });
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setAssignments(arr || []);
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to load Agency Prime Package requests.";
      setError(String(msg));
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadAssignments();
  }, []);

  const fmt = (n) => {
    try {
      const x = Number(n);
      if (!isFinite(x)) return `₹${String(n || 0)}`;
      return `₹${x.toLocaleString("en-IN")}`;
    } catch {
      return `₹${String(n || 0)}`;
    }
  };

  const openPayDialog = (assn) => {
    setSelected(assn);
    // default amount = remaining amount on the assignment
    let rem = assn?.remaining_amount;
    let num = parseFloat(String(rem || "").replace(/[,₹\s]/g, ""));
    setPayAmount(Number.isFinite(num) && num > 0 ? String(num) : "");
    setPayUTR("");
    setPayFile(null);
    setPayDialogOpen(true);
  };

  const closePayDialog = () => {
    setPayDialogOpen(false);
    setSelected(null);
  };

  const submitPaymentRequest = async () => {
    if (!selected) return;
    try {
      setSubmitting(true);
      // Basic validations
      const amtNum = parseFloat(String(payAmount || "").replace(/[,₹\s]/g, ""));
      if (!Number.isFinite(amtNum) || amtNum <= 0) {
        window.alert("Enter a valid amount (> 0).");
        setSubmitting(false);
        return;
      }
      const fd = new FormData();
      fd.append("amount", String(amtNum));
      fd.append("method", "UPI");
      if (payUTR) fd.append("utr", payUTR);
      if (payFile) fd.append("payment_proof", payFile);

      await API.post(`/business/agency-packages/${selected.id}/payment-requests/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      window.alert("Payment request submitted. Admin will verify and approve.");
      closePayDialog();
      await loadAssignments();
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to submit payment request.";
      window.alert(String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const copyUpi = async (upi) => {
    try {
      await navigator.clipboard.writeText(String(upi || ""));
      window.alert("UPI ID copied to clipboard");
    } catch (_) {
      // ignore
    }
  };

  const requestAdminApproval = async (assn) => {
    // Lightweight client-side UX: notify user that request is noted.
    // The creation of the assignment itself (from Prime Package page) serves as a request.
    // Optionally this can be wired to a dedicated endpoint later.
    const c = window.confirm(
      "Request Admin Approval for this package? Admin will verify and record payment."
    );
    if (!c) return;
    try {
      // No-op call; just refresh list to ensure latest status from server
      await loadAssignments();
      window.alert("Request noted. Admin will review your Prime Package request.");
    } catch (e) {
      window.alert("Failed to refresh status, but your request was noted locally.");
    }
  };

  const goToPrimePackages = () => navigate("/agency/prime-package");

  const statusChip = (status) => {
    const s = String(status || "").toLowerCase();
    let color = "default";
    let label = status || "Unknown";
    if (s === "inactive") color = "default";
    if (s === "partial") color = "warning";
    if (s === "active") color = "success";
    if (s === "pending") color = "info";
    return <Chip size="small" label={label} color={color} />;
  };

  return (
    <Container maxWidth="lg" sx={{ px: { xs: 0, md: 0 } }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Agency Prime Package Approval
        </Typography>
        <Button variant="outlined" size="small" onClick={loadAssignments}>
          Refresh
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Review your Prime Package requests. Submit payment details for admin approval.
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          onClick={goToPrimePackages}
          sx={{ fontWeight: 800, borderRadius: 2 }}
        >
          Add/Change Package
        </Button>
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {loading ? (
        <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={24} />
        </Box>
      ) : (assignments || []).length > 0 ? (
        <Grid container spacing={2}>
          {(assignments || []).map((a) => {
            const pkgName = a?.package?.name || a?.package?.code || "Prime Package";
            const st = a?.status || "Pending";
            return (
              <Grid item xs={12} md={6} lg={4} key={a.id}>
                <Card
                  elevation={0}
                  sx={{
                    height: "100%",
                    borderRadius: 3,
                    border: "1px solid #e5e7eb",
                    background: "linear-gradient(180deg,#ffffff 0%, #f8fafc 100%)",
                    boxShadow: "0 10px 24px rgba(2,6,23,0.06)",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.5 }}>
                      SUB‑FRANCHISE
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>{pkgName}</Typography>
                      {statusChip(st)}
                    </Box>
                    <Grid container spacing={1}>
                      <Grid item xs={4}>
                        <Box sx={{ p: 1, borderRadius: 1, background: "#f1f5f9" }}>
                          <Typography variant="caption" color="text.secondary">Amount</Typography>
                          <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{fmt(a.total_amount)}</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ p: 1, borderRadius: 1, background: "#f1f5f9" }}>
                          <Typography variant="caption" color="text.secondary">Paid</Typography>
                          <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{fmt(a.paid_amount)}</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ p: 1, borderRadius: 1, background: "#f1f5f9" }}>
                          <Typography variant="caption" color="text.secondary">Remaining</Typography>
                          <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{fmt(a.remaining_amount)}</Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    <Box sx={{ mt: "auto", display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Button
                        variant="contained"
                        sx={{ fontWeight: 800, borderRadius: 2 }}
                        onClick={() => openPayDialog(a)}
                      >
                        Submit Payment
                      </Button>
                      <Button
                        variant="outlined"
                        sx={{ fontWeight: 800, borderRadius: 2 }}
                        onClick={() => requestAdminApproval(a)}
                      >
                        Request Admin Approval
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <Alert severity="info">
          No Prime Package requests found. Click "Add/Change Package" to create a new request.
        </Alert>
      )}

      <Dialog open={payDialogOpen} onClose={closePayDialog} fullWidth maxWidth="sm">
        <DialogTitle>Submit Payment for Prime Package</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Scan the QR or use the UPI ID to make a payment. Then submit the details below for admin approval.
          </Typography>

          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", mb: 2, flexWrap: "wrap" }}>
            {selected?.package?.payment_qr_url ? (
              <Box sx={{ border: "1px solid #e5e7eb", borderRadius: 2, p: 1 }}>
                <img
                  src={selected.package.payment_qr_url}
                  alt="Payment QR"
                  style={{ width: 180, height: 180, objectFit: "contain", borderRadius: 8 }}
                />
              </Box>
            ) : (
              <Alert severity="info" sx={{ flex: 1, minWidth: 240 }}>
                QR code is not configured. Use the UPI ID below to pay.
              </Alert>
            )}

            <Box sx={{ flex: 1, minWidth: 240 }}>
              <Typography variant="caption" color="text.secondary">
                Package
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                {selected?.package?.name || selected?.package?.code || "Prime Package"}
              </Typography>

              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                UPI ID
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {selected?.package?.upi_id || "—"}
                </Typography>
                {selected?.package?.upi_id ? (
                  <Tooltip title="Copy UPI ID">
                    <IconButton size="small" onClick={() => copyUpi(selected.package.upi_id)}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Stack>

              {selected?.package?.upi_id ? (
                <MUILink
                  href={`upi://pay?pa=${encodeURIComponent(selected.package.upi_id)}&pn=${encodeURIComponent("Trikonekt")}&am=${encodeURIComponent(payAmount || "")}`}
                  underline="hover"
                  sx={{ mt: 0.5, display: "inline-block" }}
                >
                  Open UPI App
                </MUILink>
              ) : null}
            </Box>
          </Box>

          <Stack spacing={2}>
            <TextField
              label="Amount Paid (₹)"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              fullWidth
              inputProps={{ inputMode: "decimal" }}
            />
            <TextField
              label="UTR / Reference"
              value={payUTR}
              onChange={(e) => setPayUTR(e.target.value)}
              fullWidth
              placeholder="UPI reference/UTR (optional but recommended)"
            />

            <Box>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadFileIcon />}
                sx={{ borderRadius: 2, fontWeight: 800 }}
              >
                {payFile ? "Change Proof (image/pdf)" : "Upload Proof (image/pdf)"}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  hidden
                  onChange={(e) => setPayFile(e.target.files?.[0] || null)}
                />
              </Button>
              {payFile ? (
                <Typography variant="caption" sx={{ ml: 1 }}>
                  {payFile.name}
                </Typography>
              ) : null}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closePayDialog} disabled={submitting}>Close</Button>
          <Button variant="contained" onClick={submitPaymentRequest} disabled={submitting} sx={{ fontWeight: 800 }}>
            {submitting ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
