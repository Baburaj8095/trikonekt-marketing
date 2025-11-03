import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Chip,
  Button,
  Card,
  CardMedia,
  CardContent,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import API from "../../api/api";

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyForm, setBuyForm] = useState({
    consumer_name: "",
    consumer_email: "",
    consumer_phone: "",
    consumer_address: "",
    quantity: 1,
  });
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });
  const [payMethod, setPayMethod] = useState("wallet");
  const [walletBalance, setWalletBalance] = useState(0);
  const isLoggedIn = !!(localStorage.getItem("token") || sessionStorage.getItem("token"));

  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user") || sessionStorage.getItem("user");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);

  const finalPrice = useMemo(() => {
    const price = Number(data?.price || 0);
    const discount = Number(data?.discount || 0);
    return price * (1 - discount / 100);
  }, [data?.price, data?.discount]);

  const totalAmount = useMemo(() => {
    const qty = Number(buyForm.quantity || 1);
    return Number(finalPrice || 0) * qty;
  }, [finalPrice, buyForm.quantity]);

  const load = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await API.get(`/products/${id}`, { params: { _: Date.now() } });
      setData(res?.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [id]);

  // Periodically refresh product details while it is still in stock,
  // so that UI reflects approvals that consume stock in near real-time.
  useEffect(() => {
    let timer = null;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await API.get(`/products/${id}`, { params: { _: Date.now() } });
        if (cancelled) return;
        const latest = res?.data || null;
        setData(latest);
      } catch {
        // ignore transient errors
      }
    };

    if (id && Number(data?.quantity ?? 0) > 0) {
      timer = setInterval(tick, 5000);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [id, data?.quantity]);

  const openBuy = async () => {
    try {
      const res = await API.get(`/products/${id}`, { params: { _: Date.now() } });
      const latest = res?.data || null;
      setData(latest);
      if (!latest || Number(latest.quantity || 0) <= 0) {
        setSnack({ open: true, type: "error", msg: "This product is out of stock." });
        setBuyOpen(false);
        return;
      }
      setBuyOpen(true);
    } catch {
      setSnack({ open: true, type: "error", msg: "Unable to fetch product details." });
    }
  };

  // Autofill purchase form from logged-in user's details (if available) when modal opens
  useEffect(() => {
    if (!buyOpen) return;
    const name = storedUser?.full_name || storedUser?.username || "";
    const email = storedUser?.email || "";
    const phone = storedUser?.phone || storedUser?.mobile || storedUser?.contact || "";
    setBuyForm((f) => ({
      ...f,
      consumer_name: f.consumer_name || name,
      consumer_email: f.consumer_email || email,
      consumer_phone: f.consumer_phone || phone,
    }));
  }, [buyOpen, storedUser]);

  // When dialog opens and user is logged in, fetch wallet balance for wallet payment validation
  useEffect(() => {
    let mounted = true;
    async function fetchWallet() {
      if (!buyOpen) return;
      if (!isLoggedIn) return;
      try {
        const res = await API.get("/accounts/wallet/me/");
        if (!mounted) return;
        const bal = Number(res?.data?.balance ?? 0);
        setWalletBalance(bal);
      } catch {
        if (!mounted) return;
        setWalletBalance(0);
      }
    }
    fetchWallet();
    return () => {
      mounted = false;
    };
  }, [buyOpen, isLoggedIn]);

  const onBuyChange = (e) => {
    const { name, value } = e.target;
    setBuyForm((f) => ({ ...f, [name]: value }));
  };

  const submitBuy = async () => {
    if (!id) return;
    try {
      await API.post("/purchase-requests", {
        product: Number(id),
        consumer_name: buyForm.consumer_name,
        consumer_email: buyForm.consumer_email,
        consumer_phone: buyForm.consumer_phone,
        consumer_address: buyForm.consumer_address,
        quantity: Number(buyForm.quantity) || 1,
        payment_method: payMethod,
      });
      setSnack({ open: true, type: "success", msg: "Purchase request submitted." });
      setBuyOpen(false);
      await load();
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        "Failed to submit purchase request.";
      setSnack({ open: true, type: "error", msg });
    }
  };

  if (loading && !data) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="body2">Loading...</Typography>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2">Product not found.</Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            {data.image_url ? (
              <CardMedia
                component="img"
                image={data.image_url}
                alt={data.name}
                sx={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover" }}
              />
            ) : (
              <Box sx={{ width: "100%", aspectRatio: "4 / 3", bgcolor: "#f1f5f9" }} />
            )}
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{data.name}</Typography>
            <Typography variant="body2" color="text.secondary">{data.category}</Typography>

            <Box sx={{ mt: 1, display: "flex", alignItems: "baseline", gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>₹{finalPrice.toFixed(2)}</Typography>
              {Number(data.discount || 0) > 0 && (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ textDecoration: "line-through" }}>
                    ₹{Number(data.price || 0).toFixed(2)}
                  </Typography>
                  <Chip label={`${Number(data.discount)}% OFF`} size="small" color="success" />
                </>
              )}
            </Box>

            <Typography variant="body2" sx={{ mt: 1 }}>
              Seller: {data.created_by_name || "N/A"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Location: {[data.city, data.state, data.country, data.pincode].filter(Boolean).join(", ")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Available Quantity: {data.quantity}
            </Typography>

            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button variant="outlined" onClick={() => navigate(-1)}>Back</Button>
              {Number(data.quantity || 0) > 0 ? (
                <Button variant="contained" onClick={openBuy}>Buy</Button>
              ) : (
                <Button variant="contained" disabled>Out of Stock</Button>
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mt: 2, borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Description</Typography>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 1 }}>
              {data.description || "No description provided."}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={buyOpen} onClose={() => setBuyOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Purchase Request</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 2 }}>
            <TextField
              label="Your Name"
              name="consumer_name"
              value={buyForm.consumer_name}
              onChange={onBuyChange}
              fullWidth
              required
            />
            <TextField
              label="Email"
              name="consumer_email"
              value={buyForm.consumer_email}
              onChange={onBuyChange}
              fullWidth
              type="email"
              required
            />
            <TextField
              label="Phone"
              name="consumer_phone"
              value={buyForm.consumer_phone}
              onChange={onBuyChange}
              fullWidth
              required
            />
            <TextField
              label="Address"
              name="consumer_address"
              value={buyForm.consumer_address}
              onChange={onBuyChange}
              fullWidth
              multiline
              minRows={2}
              required
            />
            <TextField
              label="Quantity"
              name="quantity"
              value={buyForm.quantity}
              onChange={onBuyChange}
              fullWidth
              type="number"
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", min: 1, max: data?.quantity || 1 }}
              required
            />

            <FormControl>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Payment Method</Typography>
              <RadioGroup
                row
                name="payment_method"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
              >
                <FormControlLabel
                  value="wallet"
                  control={<Radio />}
                  label="Wallet"
                  disabled={!isLoggedIn}
                />
                <FormControlLabel value="cash" control={<Radio />} label="Cash" />
              </RadioGroup>
              {!isLoggedIn && (
                <Typography variant="caption" color="text.secondary">
                  Login required to pay via wallet.
                </Typography>
              )}
            </FormControl>

            {payMethod === "wallet" && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2">
                  Wallet balance: ₹ {Number(walletBalance || 0).toFixed(2)}
                </Typography>
                <Typography variant="body2">
                  Total payable: ₹ {Number(totalAmount || 0).toFixed(2)}
                </Typography>
                {isLoggedIn && Number(walletBalance) < Number(totalAmount) && (
                  <Typography variant="caption" color="error">
                    Insufficient wallet balance. Pay with Cash or add funds via coupon.
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBuyOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={submitBuy}
            disabled={payMethod === "wallet" && isLoggedIn && Number(walletBalance) < Number(totalAmount)}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>

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
    </Container>
  );
}
