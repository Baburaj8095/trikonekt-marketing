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
  assignConsumerByCount,
  assignEmployeeByCount,
} from "../api/api";
import normalizeMediaUrl from "../utils/media";
import { useNavigate } from "react-router-dom";
import {
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Dialog,
  DialogTitle,
  DialogContent,
  Chip,
} from "@mui/material";

function ProductCard({ product, form, onChange, onSubmit, submitting, onAddToCart }) {
  const unit = Number(product?.price_per_unit || 0);
  const qty = Number(form.quantity || 0);
  const total = isFinite(unit * qty) ? unit * qty : 0;
  const available = Number(
    product?.available_count ?? product?.available ?? product?.stock ?? 0
  );
  const maxAllowed = product?.max_per_order
    ? (available ? Math.min(Number(product.max_per_order), available) : Number(product.max_per_order))
    : (available || undefined);

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
          <Box>
            <Typography variant="caption" color="text.secondary">Available</Typography>
            <div style={{ fontWeight: 800 }}>{Number.isFinite(available) ? available : "—"}</div>
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
              inputProps={{ min: 1, max: maxAllowed }}
              helperText={`${product?.max_per_order ? `Max per order: ${product.max_per_order}. ` : ""}${Number.isFinite(available) ? `Available: ${available}` : ""}`}
            />
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
      <CardActions sx={{ p: 2, pt: 0, gap: 1 }}>
        <Button
          variant="contained"
          onClick={() =>
            onAddToCart &&
            onAddToCart(
              product.id,
              Math.max(1, parseInt(form.quantity || "1", 10))
            )
          }
          disabled={!!submitting || !form.quantity || Number(form.quantity) <= 0 || available <= 0}
          sx={{ fontWeight: 700 }}
        >
          Add to Cart
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

  // Cart state (all roles: consumer/agency/employee)
  const [cart, setCart] = useState({}); // { [productId]: quantity }
  const cartItems = useMemo(() => {
    const items = [];
    for (const pid of Object.keys(cart)) {
      const p = (products || []).find((x) => String(x.id) === String(pid));
      if (!p) continue;
      const qty = parseInt(cart[pid] || "0", 10);
      if (qty > 0) {
        const unit = Number(p.price_per_unit || 0);
        const subtotal = isFinite(unit * qty) ? unit * qty : 0;
        items.push({ product: p, qty, subtotal });
      }
    }
    return items;
  }, [cart, products]);
  const cartTotal = useMemo(
    () =>
      (cartItems || []).reduce(
        (sum, it) => sum + (isFinite(it.subtotal) ? it.subtotal : 0),
        0
      ),
    [cartItems]
  );
  const [cartPayment, setCartPayment] = useState({ utr: "", notes: "", file: null });
  const [checkingOut, setCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("MANUAL"); // MANUAL | ONLINE
  const [qrOpen, setQrOpen] = useState(false);

  // Agency/Employee: assign to consumer form state
  const [consumerAssign, setConsumerAssign] = useState({ username: "", count: 1, notes: "" });
  const [assigningConsumer, setAssigningConsumer] = useState(false);
  const [assignConsumerMsg, setAssignConsumerMsg] = useState("");

  // Agency only: distribute to employee form state
  const [empAssign, setEmpAssign] = useState({ username: "", count: 1, notes: "" });
  const [assigningEmp, setAssigningEmp] = useState(false);
  const [assignEmpMsg, setAssignEmpMsg] = useState("");

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
  const navigate = useNavigate();

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

  // Cart helpers
  const addToCart = (pid, qty = 1) => {
    const q = Math.max(1, parseInt(qty || "1", 10));
    setCart((c) => {
      const cur = parseInt(c[pid] || "0", 10);
      const prod = (products || []).find((x) => String(x.id) === String(pid));
      let next = cur + q;
      if (prod) {
        const availRaw = Number(prod?.available_count ?? prod?.available ?? prod?.stock ?? 0);
        const avail = Number.isFinite(availRaw) && availRaw > 0 ? availRaw : Infinity;
        if (Number.isFinite(avail)) {
          next = Math.min(next, avail);
        }
        if (prod.max_per_order) {
          next = Math.min(next, Number(prod.max_per_order));
        }
        if (next <= cur) {
          try { alert("Requested quantity exceeds available stock or max per order."); } catch {}
          return c;
        }
      }
      return { ...c, [pid]: next };
    });
    try { alert("Added to cart."); } catch {}
  };
  const updateCartQty = (pid, qty) => {
    const q = Math.max(1, parseInt(qty || "1", 10));
    setCart((c) => ({ ...c, [pid]: q }));
  };
  const removeFromCart = (pid) => {
    setCart((c) => {
      const next = { ...c };
      delete next[pid];
      return next;
    });
  };
  const clearCart = () => setCart({});

  const checkoutCart = async () => {
    if (!cartItems.length) {
      try { alert("Cart is empty."); } catch {}
      return;
    }
    setCheckingOut(true);
    try {
      for (const it of cartItems) {
        await createEcouponOrder({
          product: it.product.id,
          quantity: it.qty,
          utr: String(cartPayment.utr || ""),
          notes: String(`[${paymentMethod}] ` + (cartPayment.notes || "")),
          file: cartPayment.file || null,
        });
      }
      try { alert("Orders submitted for review."); } catch {}
      clearCart();
      setCartPayment({ utr: "", notes: "", file: null });
      await loadOrders();
    } catch (e) {
      const err = e?.response?.data;
      const msg =
        (typeof err === "string"
          ? err
          : e?.message ||
            err?.detail ||
            JSON.stringify(err || {})) || "Checkout failed.";
      try { alert(msg); } catch {}
    } finally {
      setCheckingOut(false);
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
                    src={normalizeMediaUrl(payment.upi_qr_image_url)}
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
          <>
            {products[0] ? (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6} lg={5}>
                  <ProductCard
                    product={products[0]}
                    form={forms[products[0].id] || { quantity: 1, utr: "", notes: "", file: null }}
                    onChange={setForm}
                    onSubmit={submitOrder}
                    submitting={!!placing[products[0].id]}
                    onAddToCart={(pid, qty) => addToCart(pid, qty)}
                  />
                </Grid>
              </Grid>
            ) : null}
            {products.length > 1 ? (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0f172a", mb: 1 }}>
                  Other Products
                </Typography>
                <Grid container spacing={2}>
                  {products.slice(1).map((p) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={p.id}>
                      <ProductCard
                        product={p}
                        form={forms[p.id] || { quantity: 1, utr: "", notes: "", file: null }}
                        onChange={setForm}
                        onSubmit={submitOrder}
                        submitting={!!placing[p.id]}
                        onAddToCart={(pid, qty) => addToCart(pid, qty)}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ) : null}
          </>
        )}
      </Paper>

      <Paper elevation={3} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a" }}>
            Cart & Payment
          </Typography>
          <Stack direction="row" spacing={1}>
            <Chip size="small" label={`Items: ${cartItems.length}`} />
            <Chip size="small" color="primary" label={`Total: ₹${cartTotal.toFixed(2)}`} />
          </Stack>
        </Stack>

        {cartItems.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Your cart is empty. Add items from above.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Denomination</TableCell>
                  <TableCell>Qty</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Subtotal</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cartItems.map((it) => (
                  <TableRow key={it.product.id}>
                    <TableCell>{it.product.display_title || "E‑Coupon"}</TableCell>
                    <TableCell>₹{it.product.denomination}</TableCell>
                    <TableCell style={{ maxWidth: 120 }}>
                      <TextField
                        size="small"
                        type="number"
                        inputProps={{ min: 1 }}
                        value={it.qty}
                        onChange={(e) => updateCartQty(it.product.id, e.target.value)}
                      />
                    </TableCell>
                    <TableCell>₹{it.product.price_per_unit}</TableCell>
                    <TableCell>₹{it.subtotal.toFixed(2)}</TableCell>
                    <TableCell align="right">
                      <Button size="small" color="error" onClick={() => removeFromCart(it.product.id)}>Remove</Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} align="right" style={{ fontWeight: 800 }}>Total</TableCell>
                  <TableCell style={{ fontWeight: 800 }}>₹{cartTotal.toFixed(2)}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={clearCart}>Clear</Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={1.5}>
          <Grid item xs={12}>
            <FormControl component="fieldset" size="small">
              <FormLabel component="legend">Payment Method</FormLabel>
              <RadioGroup
                row
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <FormControlLabel value="MANUAL" control={<Radio size="small" />} label="Manual (UPI)" />
                <FormControlLabel value="ONLINE" control={<Radio size="small" />} label="Online" />
              </RadioGroup>
            </FormControl>
          </Grid>
          {paymentMethod === "MANUAL" && payment ? (
            <Grid item xs={12}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  sx={{
                    width: 140,
                    height: 140,
                    borderRadius: 2,
                    border: "1px solid #e2e8f0",
                    overflow: "hidden",
                    background: "#fff",
                  }}
                >
                  {payment.upi_qr_image_url ? (
                    <img
                      alt="UPI QR Code"
                      src={normalizeMediaUrl(payment.upi_qr_image_url)}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <Box sx={{ p: 2, color: "text.secondary" }}>No QR</Box>
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Scan and pay via UPI, then provide UTR and optionally upload payment proof.
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => setQrOpen(true)}>
                      View QR Code
                    </Button>
                    {payment.upi_id ? (
                      <Chip size="small" label={`UPI: ${payment.upi_id}`} />
                    ) : null}
                  </Stack>
                </Box>
              </Stack>
            </Grid>
          ) : null}
          <Grid item xs={12} md={4}>
            <TextField
              size="small"
              label="UTR (optional)"
              fullWidth
              value={cartPayment.utr}
              onChange={(e) => setCartPayment((s) => ({ ...s, utr: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={8}>
            <TextField
              size="small"
              label="Notes (optional)"
              fullWidth
              value={cartPayment.notes}
              onChange={(e) => setCartPayment((s) => ({ ...s, notes: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12}>
            <Button variant="outlined" size="small" component="label">
              {cartPayment.file ? "Change Payment Proof" : "Attach Payment Proof (optional)"}
              <input
                type="file"
                hidden
                onChange={(e) =>
                  setCartPayment((s) => ({
                    ...s,
                    file:
                      e.target.files && e.target.files[0]
                        ? e.target.files[0]
                        : null,
                  }))
                }
                accept="image/*,application/pdf"
              />
            </Button>
            {cartPayment.file ? (
              <Typography variant="caption" sx={{ ml: 1 }}>
                {cartPayment.file.name}
              </Typography>
            ) : null}
          </Grid>
          <Grid item xs={12}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button
                variant="contained"
                onClick={checkoutCart}
                disabled={checkingOut || cartItems.length === 0}
                sx={{ fontWeight: 800 }}
              >
                {checkingOut ? "Submitting..." : "Submit for Approval"}
              </Button>
              <Typography variant="caption" color="text.secondary">
                Orders are reviewed by admin. Upon approval, e‑coupon codes will be allocated to your account.
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {(roleHint === "agency" || roleHint === "employee") ? (
        <Paper elevation={3} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a", mb: 1 }}>
            Send E‑Coupons to Consumer (by Count)
          </Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={4}>
              <TextField
                size="small"
                label="Consumer Username"
                fullWidth
                value={consumerAssign.username}
                onChange={(e) => setConsumerAssign((s) => ({ ...s, username: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                size="small"
                label="Count"
                type="number"
                fullWidth
                inputProps={{ min: 1 }}
                value={consumerAssign.count}
                onChange={(e) => setConsumerAssign((s) => ({ ...s, count: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                size="small"
                label="Notes (optional)"
                fullWidth
                value={consumerAssign.notes}
                onChange={(e) => setConsumerAssign((s) => ({ ...s, notes: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Button
                  variant="contained"
                  onClick={async () => {
                    setAssignConsumerMsg("");
                    const u = (consumerAssign.username || "").trim();
                    const c = parseInt(consumerAssign.count || "0", 10);
                    if (!u || !c || c <= 0) {
                      try { alert("Enter consumer username and a valid count (>0)."); } catch {}
                      return;
                    }
                    try {
                      setAssigningConsumer(true);
                      const res = await assignConsumerByCount({
                        consumer_username: u,
                        count: c,
                        notes: consumerAssign.notes || "",
                      });
                      const assigned = Number(res?.assigned || 0);
                      const after = Number(res?.available_after || 0);
                      const samples = Array.isArray(res?.sample_codes) ? res.sample_codes : [];
                      setAssignConsumerMsg(`Assigned ${assigned}. Remaining in your pool: ${after}. Samples: ${samples.join(", ")}`);
                      // reset count only
                      setConsumerAssign((s) => ({ ...s, count: 1, notes: "" }));
                    } catch (e) {
                      const err = e?.response?.data;
                      const msg = (typeof err === "string" ? err : (err?.detail || JSON.stringify(err || {}))) || "Assignment failed.";
                      try { alert(msg); } catch {}
                    } finally {
                      setAssigningConsumer(false);
                    }
                  }}
                  disabled={assigningConsumer}
                  sx={{ fontWeight: 700 }}
                >
                  {assigningConsumer ? "Assigning..." : "Assign to Consumer"}
                </Button>
                {assignConsumerMsg ? <Typography variant="caption" color="text.secondary">{assignConsumerMsg}</Typography> : null}
              </Stack>
            </Grid>
          </Grid>
        </Paper>
      ) : null}

      {roleHint === "agency" ? (
        <Paper elevation={3} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a", mb: 1 }}>
            Distribute to Employee (by Count)
          </Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={6}>
              <TextField
                size="small"
                label="Employee Username"
                fullWidth
                value={empAssign.username}
                onChange={(e) => setEmpAssign((s) => ({ ...s, username: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                size="small"
                label="Count"
                type="number"
                fullWidth
                inputProps={{ min: 1 }}
                value={empAssign.count}
                onChange={(e) => setEmpAssign((s) => ({ ...s, count: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                size="small"
                label="Notes (optional)"
                fullWidth
                value={empAssign.notes}
                onChange={(e) => setEmpAssign((s) => ({ ...s, notes: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Button
                  variant="outlined"
                  onClick={async () => {
                    setAssignEmpMsg("");
                    const u = (empAssign.username || "").trim();
                    const c = parseInt(empAssign.count || "0", 10);
                    if (!u || !c || c <= 0) {
                      try { alert("Enter employee username and a valid count (>0)."); } catch {}
                      return;
                    }
                    try {
                      setAssigningEmp(true);
                      const res = await assignEmployeeByCount({
                        employee_username: u,
                        count: c,
                        notes: empAssign.notes || "",
                      });
                      const assigned = Number(res?.assigned || 0);
                      const after = Number(res?.available_after || 0);
                      const samples = Array.isArray(res?.sample_codes) ? res.sample_codes : [];
                      setAssignEmpMsg(`Assigned ${assigned} to ${u}. Remaining in agency pool: ${after}. Samples: ${samples.join(", ")}`);
                      setEmpAssign((s) => ({ ...s, count: 1, notes: "" }));
                    } catch (e) {
                      const err = e?.response?.data;
                      const msg = (typeof err === "string" ? err : (err?.detail || JSON.stringify(err || {}))) || "Assignment failed.";
                      try { alert(msg); } catch {}
                    } finally {
                      setAssigningEmp(false);
                    }
                  }}
                  disabled={assigningEmp}
                  sx={{ fontWeight: 700 }}
                >
                  {assigningEmp ? "Assigning..." : "Assign to Employee"}
                </Button>
                {assignEmpMsg ? <Typography variant="caption" color="text.secondary">{assignEmpMsg}</Typography> : null}
              </Stack>
            </Grid>
          </Grid>
        </Paper>
      ) : null}

      <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a" }}>
            My Orders
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button onClick={loadOrders} size="small" variant="outlined" disabled={ordersLoading}>
              {ordersLoading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button onClick={() => navigate("/user/redeem-coupon")} size="small" variant="contained">
              Go to E‑Coupons
            </Button>
          </Stack>
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

      <Dialog open={qrOpen} onClose={() => setQrOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>UPI QR Code</DialogTitle>
        <DialogContent>
          {payment && payment.upi_qr_image_url ? (
            <Box sx={{ width: "100%", textAlign: "center" }}>
              <img
                alt="UPI QR Code"
                src={normalizeMediaUrl(payment.upi_qr_image_url)}
                style={{ width: "100%", maxHeight: 360, objectFit: "contain" }}
              />
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2"><strong>Payee:</strong> {payment.payee_name || "—"}</Typography>
                <Typography variant="body2"><strong>UPI ID:</strong> {payment.upi_id || "—"}</Typography>
              </Box>
            </Box>
          ) : (
            <Alert severity="warning">No QR image available.</Alert>
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
}
