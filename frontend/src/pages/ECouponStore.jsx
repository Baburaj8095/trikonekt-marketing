import React, { useEffect, useMemo, useState } from "react";
import {
  Container,
  Paper,
  Typography,
  Grid,
  Box,
  TextField,
  Button,
  Stack,
  Alert,
  Divider,
  Card,
  CardContent,
  CardActions,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
} from "@mui/material";
import {
  getEcouponStoreBootstrap,
  createEcouponOrder,
  getMyEcouponOrders,
} from "../api/api";

function ProductCard({ product, form, onChange, onSubmit, submitting }) {
  const unit = Number(product?.price_per_unit || 0);
  const qty = Number(form.quantity || 0);
  const total = isFinite(unit * qty) ? unit * qty : 0;

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a" }}>
          {product?.display_title || "E‑Coupon"}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {product?.display_desc || ""}
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Denomination</Typography>
            <div style={{ fontWeight: 800 }}>₹{product?.denomination}</div>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Unit Price</Typography>
            <div style={{ fontWeight: 800 }}>₹{product?.price_per_unit}</div>
          </Box>
        </Stack>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              label="Quantity"
              type="number"
              fullWidth
              value={form.quantity || ""}
              onChange={(e) => onChange(product.id, "quantity", e.target.value)}
              inputProps={{ min: 1, max: product?.max_per_order || undefined }}
              helperText={
                product?.max_per_order ? `Max per order: ${product.max_per_order}` : ""
              }
            />
          </Grid>
          <Grid item xs={12} sm={8}>
            <TextField
              size="small"
              label="UTR (optional)"
              fullWidth
              value={form.utr || ""}
              onChange={(e) => onChange(product.id, "utr", e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              size="small"
              label="Notes (optional)"
              fullWidth
              multiline
              minRows={2}
              value={form.notes || ""}
              onChange={(e) => onChange(product.id, "notes", e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <Button variant="outlined" size="small" component="label">
              {form.file ? "Change Payment Proof" : "Attach Payment Proof"}
              <input
                type="file"
                hidden
                onChange={(e) =>
                  onChange(product.id, "file", e.target.files && e.target.files[0] ? e.target.files[0] : null)
                }
                accept="image/*,application/pdf"
              />
            </Button>
            {form.file ? (
              <Typography variant="caption" sx={{ ml: 1 }}>
                {form.file.name}
              </Typography>
            ) : null}
          </Grid>
        </Grid>
        <Divider sx={{ my: 1.5 }} />
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="body2" color="text.secondary">Total</Typography>
          <Typography variant="h6" sx={{ fontWeight: 900, color: "#0f172a" }}>
            ₹{total.toFixed(2)}
          </Typography>
        </Stack>
      </CardContent>
      <CardActions sx={{ p: 2, pt: 0 }}>
        <Button
          variant="contained"
          onClick={() => onSubmit(product.id)}
          disabled={!!submitting || !form.quantity || Number(form.quantity) <= 0}
          sx={{ fontWeight: 700 }}
        >
          {submitting ? "Submitting..." : "Place Order"}
        </Button>
      </CardActions>
    </Card>
  );
}

export default function ECouponStore() {
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState({}); // productId -> bool
  const [error, setError] = useState("");
  const [products, setProducts] = useState([]);
  const [payment, setPayment] = useState(null);

  const [forms, setForms] = useState({}); // productId -> { quantity, utr, notes, file }
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersErr, setOrdersErr] = useState("");

  const roleHint = useMemo(() => {
    try {
      const p = window.location.pathname;
      if (p.startsWith("/agency")) return "agency";
      if (p.startsWith("/employee")) return "employee";
      return "consumer";
    } catch {
      return "consumer";
    }
  }, []);

  const loadBootstrap = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getEcouponStoreBootstrap();
      const prods = Array.isArray(data?.products) ? data.products : [];
      setProducts(prods);
      setPayment(data?.payment_config || null);

      // Initialize forms with sensible defaults
      const m = {};
      prods.forEach((p) => {
        m[p.id] = { quantity: 1, utr: "", notes: "", file: null };
      });
      setForms(m);
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to load store.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    setOrdersLoading(true);
    setOrdersErr("");
    try {
      const res = await getMyEcouponOrders({ page_size: 50 });
      const arr = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
      setOrders(arr);
    } catch (e) {
      setOrders([]);
      setOrdersErr("Failed to load your orders.");
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    loadBootstrap();
    loadOrders();
  }, []);

  const setForm = (pid, field, value) => {
    setForms((f) => ({ ...f, [pid]: { ...(f[pid] || {}), [field]: value } }));
  };

  const submitOrder = async (productId) => {
    const f = forms[productId] || {};
    const qty = parseInt(f.quantity || "0", 10);
    if (!qty || qty <= 0) {
      try { alert("Enter a valid quantity (>0)."); } catch {}
      return;
    }
    const prod = products.find((p) => p.id === productId);
    if (!prod) {
      try { alert("Invalid product."); } catch {}
      return;
    }
    if (prod.max_per_order && qty > Number(prod.max_per_order)) {
      try { alert(`Max per order is ${prod.max_per_order}.`); } catch {}
      return;
    }

    try {
      setPlacing((m) => ({ ...m, [productId]: true }));
      await createEcouponOrder({
        product: productId,
        quantity: qty,
        utr: String(f.utr || ""),
        notes: String(f.notes || ""),
        file: f.file || null,
      });
      try { alert("Order submitted for review."); } catch {}
      // reset specific form, keep quantity as 1
      setForms((fAll) => ({ ...fAll, [productId]: { quantity: 1, utr: "", notes: "", file: null } }));
      await loadOrders();
    } catch (e) {
      const err = e?.response?.data;
      const msg = (typeof err === "string" ? err : (err?.detail || JSON.stringify(err || {}))) || "Submission failed.";
      try { alert(msg); } catch {}
    } finally {
      setPlacing((m) => ({ ...m, [productId]: false }));
    }
  };

  return (
    <Container maxWidth="lg" sx={{ px: { xs: 0.5, md: 2 }, py: { xs: 1, md: 2 } }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 900, color: "#0f172a" }}>
          E‑Coupon Store
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Role: {roleHint}. Select a product, make payment to the QR shown below, and submit proof for approval.
        </Typography>
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Paper elevation={3} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a", mb: 1 }}>
          Payment Instructions
        </Typography>
        {payment ? (
          <Grid container spacing={2}>
            <Grid item xs={12} md="auto">
              <Box
                sx={{
                  width: 220,
                  height: 220,
                  borderRadius: 2,
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                {payment.upi_qr_image_url ? (
                  <img
                    alt="UPI QR Code"
                    src={payment.upi_qr_image_url}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <Box sx={{ p: 2, color: "text.secondary" }}>No QR image uploaded.</Box>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md>
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6} md={4}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Payee</Typography>
                    <div style={{ fontWeight: 800 }}>{payment.payee_name || "—"}</div>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">UPI ID</Typography>
                    <div style={{ fontWeight: 800 }}>{payment.upi_id || "—"}</div>
                  </Box>
                </Grid>
                <Grid item xs={12} md={12}>
                  <Typography variant="caption" color="text.secondary">Instructions</Typography>
                  <Box sx={{ whiteSpace: "pre-wrap" }}>
                    {payment.instructions || "Scan the QR or pay to the UPI ID, then provide UTR and upload payment proof while placing the order."}
                  </Box>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        ) : (
          <Alert severity="warning">Payments are temporarily unavailable. Please try again later.</Alert>
        )}
      </Paper>

      <Paper elevation={3} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a" }}>
            Available Products
          </Typography>
          <Button onClick={loadBootstrap} size="small" variant="outlined" disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </Stack>
        {loading ? (
          <Box sx={{ py: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={18} /> <Typography variant="body2">Loading...</Typography>
          </Box>
        ) : (products || []).length === 0 ? (
          <Typography variant="body2" color="text.secondary">No products available.</Typography>
        ) : (
          <Grid container spacing={2}>
            {(products || []).map((p) => (
              <Grid item xs={12} md={6} lg={4} key={p.id}>
                <ProductCard
                  product={p}
                  form={forms[p.id] || { quantity: 1, utr: "", notes: "", file: null }}
                  onChange={setForm}
                  onSubmit={submitOrder}
                  submitting={!!placing[p.id]}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a" }}>
            My Orders
          </Typography>
          <Button onClick={loadOrders} size="small" variant="outlined" disabled={ordersLoading}>
            {ordersLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </Stack>
        {ordersErr ? <Alert severity="error" sx={{ mb: 1 }}>{ordersErr}</Alert> : null}
        {ordersLoading ? (
          <Box sx={{ py: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={18} /> <Typography variant="body2">Loading...</Typography>
          </Box>
        ) : (orders || []).length === 0 ? (
          <Typography variant="body2" color="text.secondary">No orders yet.</Typography>
        ) : (
          <TableContainer sx={{ maxWidth: "100%", overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Denomination</TableCell>
                  <TableCell>Qty</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Approved At</TableCell>
                  <TableCell>Samples</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(orders || []).map((o) => {
                  const samples = Array.isArray(o.allocated_sample_codes) ? o.allocated_sample_codes : [];
                  return (
                    <TableRow key={o.id}>
                      <TableCell>#{o.id}</TableCell>
                      <TableCell>{o.product_title || o.product || ""}</TableCell>
                      <TableCell>₹{o.denomination_snapshot}</TableCell>
                      <TableCell>{o.quantity}</TableCell>
                      <TableCell>₹{o.amount_total}</TableCell>
                      <TableCell>{o.status}</TableCell>
                      <TableCell>{o.reviewed_at ? new Date(o.reviewed_at).toLocaleString() : ""}</TableCell>
                      <TableCell style={{ maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {samples.join(", ")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Container>
  );
}
