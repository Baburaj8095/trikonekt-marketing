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
  getMyEcouponOrders,
  assignConsumerByCount,
  assignEmployeeByCount,
} from "../api/api";
import { addEcoupon } from "../store/cart";
import { useNavigate } from "react-router-dom";

function ProductCard({ product, form, onChange, onAddToCart }) {
  const unit = Number(product?.price_per_unit || 0);
  const qty = Number(form.quantity || 0);
  const total = Number.isFinite(unit * qty) ? unit * qty : 0;
  const available = Number(
    product?.available_count ?? product?.available ?? product?.stock ?? 0
  );
  const maxAllowed = product?.max_per_order
    ? (available ? Math.min(Number(product.max_per_order), available) : Number(product.max_per_order))
    : (available || undefined);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
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
            value={form.quantity ?? ""}
            onChange={(e) => onChange(product.id, "quantity", e.target.value)}
            inputProps={{ min: 1, max: maxAllowed }}
            helperText={`${product?.max_per_order ? `Max per order: ${product.max_per_order}. ` : ""}${Number.isFinite(available) ? `Available: ${available}` : ""}`}
          />
        </Grid>
      </Grid>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1.5 }}>
        <Typography variant="body2" color="text.secondary">Total</Typography>
        <Typography variant="h6" sx={{ fontWeight: 900, color: "#0f172a" }}>
          ₹{total.toFixed(2)}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        <Button
          variant="contained"
          onClick={() =>
            onAddToCart &&
            onAddToCart(
              product.id,
              Math.max(1, parseInt(form.quantity || "1", 10))
            )
          }
          disabled={!form.quantity || Number(form.quantity) <= 0 || available <= 0}
          sx={{ fontWeight: 700 }}
        >
          Add to Cart
        </Button>
      </Stack>
      <Alert severity="info" sx={{ mt: 1 }}>
        Payment is done at Checkout. Use the cart to complete payment.
      </Alert>
    </Paper>
  );
}

export default function ECouponStore() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [products, setProducts] = useState([]);

  const [forms, setForms] = useState({}); // productId -> { quantity }
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersErr, setOrdersErr] = useState("");

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
  const cartPath = useMemo(
    () => (roleHint === "agency" ? "/agency/cart" : roleHint === "employee" ? "/employee/cart" : "/user/cart"),
    [roleHint]
  );
  const navigate = useNavigate();

  const loadBootstrap = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getEcouponStoreBootstrap();
      const prods = Array.isArray(data?.products) ? data.products : [];
      setProducts(prods);

      // Initialize forms with sensible defaults
      const m = {};
      prods.forEach((p) => {
        m[p.id] = { quantity: 1 };
      });
      setForms(m);
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to load store.";
      setError(msg);
      setProducts([]);
      setForms({});
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

  // Cart helpers (centralized cart only)
  const addToCart = (pid, qty = 1) => {
    try {
      const product = (products || []).find((x) => String(x.id) === String(pid));
      const q = Math.max(1, parseInt(qty || "1", 10));
      addEcoupon({
        productId: pid,
        title: product?.display_title || "E‑Coupon",
        unitPrice: Number(product?.price_per_unit || 0),
        qty: q,
        denomination: product?.denomination ?? null,
      });
      try { alert("Added to cart."); } catch {}
    } catch {}
  };

  return (
    <Container maxWidth="lg" sx={{ px: { xs: 0.5, md: 2 }, py: { xs: 1, md: 2 } }}>
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, color: "#0f172a" }}>
              E‑Coupon Store
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Role: {roleHint}. Add products to cart. Payment is completed at Checkout.
            </Typography>
          </Box>
          <Button size="small" variant="outlined" onClick={() => navigate(cartPath)}>
            Open Centralized Cart
          </Button>
        </Stack>
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

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
            <Grid container spacing={2}>
              {(products || []).map((p) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={p.id}>
                  <ProductCard
                    product={p}
                    form={forms[p.id] || { quantity: 1 }}
                    onChange={setForm}
                    onAddToCart={(pid, qty) => addToCart(pid, qty)}
                  />
                </Grid>
              ))}
            </Grid>
          </>
        )}
      </Paper>

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

      {(roleHint === "agency" || roleHint === "employee") ? (
        <Paper elevation={3} sx={{ p: 2, borderRadius: 2, mt: 2 }}>
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
        <Paper elevation={3} sx={{ p: 2, borderRadius: 2, mt: 2 }}>
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
    </Container>
  );
}
