import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Chip,
  Card,
  CardMedia,
  LinearProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
  FormControl,
  RadioGroup,
  Radio,
  FormControlLabel,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import API from "../../api/api";

function fmtMoney(x) {
  const n = Number(x || 0);
  return n.toFixed(2);
}
function fmtPct(x) {
  const n = Number(x || 0);
  return n.toFixed(2) + "%";
}

export default function BannerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [buyOpen, setBuyOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [buyForm, setBuyForm] = useState({
    consumer_name: "",
    consumer_email: "",
    consumer_phone: "",
    consumer_address: "",
    quantity: 1,
  });
  const [payMethod, setPayMethod] = useState("wallet");
  const [walletBalance, setWalletBalance] = useState(0);
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });
  const isLoggedIn = !!(localStorage.getItem("token") || sessionStorage.getItem("token"));
  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user") || sessionStorage.getItem("user");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);

  const load = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setErr("");
      const res = await API.get(`/banners/${id}`, { params: { _: Date.now() } });
      setData(res?.data || null);
    } catch (e) {
      setData(null);
      setErr("Failed to load banner.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const onBuyChange = (e) => {
    const { name, value } = e.target;
    setBuyForm((f) => ({ ...f, [name]: value }));
  };

  const openBuy = async (item) => {
    try {
      // Refresh latest banner and item stock
      const res = await API.get(`/banners/${id}`, { params: { _: Date.now() } });
      const latest = res?.data || null;
      setData(latest);
      const latestItem = (latest?.items || []).find((it) => it.id === item.id) || item;
      if (!latestItem || Number(latestItem.quantity || 0) <= 0) {
        setSnack({ open: true, type: "error", msg: "This item is out of stock." });
        setBuyOpen(false);
        return;
      }
      setSelectedItem(latestItem);
      setBuyForm((f) => ({ ...f, quantity: 1 }));
      setPayMethod("wallet");
      setBuyOpen(true);
    } catch {
      setSnack({ open: true, type: "error", msg: "Unable to fetch latest banner details." });
    }
  };

  // Prefill form details when dialog opens
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

  // Fetch wallet balance when dialog opens for wallet option
  useEffect(() => {
    let mounted = true;
    async function fetchWallet() {
      if (!buyOpen) return;
      if (!isLoggedIn) return;
      try {
        const res = await API.get("/accounts/wallet/me/");
        if (!mounted) return;
        setWalletBalance(Number(res?.data?.balance ?? 0));
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

  const submitBuy = async () => {
    if (!id || !selectedItem?.id) return;
    try {
      await API.post(`/banners/${id}/items/${selectedItem.id}/purchase-requests`, {
        consumer_name: buyForm.consumer_name,
        consumer_email: buyForm.consumer_email,
        consumer_phone: buyForm.consumer_phone,
        consumer_address: buyForm.consumer_address,
        quantity: Number(buyForm.quantity) || 1,
        payment_method: payMethod,
      });
      setSnack({ open: true, type: "success", msg: "Purchase request submitted." });
      setBuyOpen(false);
      setSelectedItem(null);
      await load();
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to submit purchase request.";
      setSnack({ open: true, type: "error", msg });
    }
  };

  if (loading && !data) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <LinearProgress />
      </Container>
    );
  }

  if (!data) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2">{err || "Banner not found."}</Typography>
        </Paper>
      </Container>
    );
  }

  const items = Array.isArray(data.items) ? data.items : [];

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            {data.image_url ? (
              <CardMedia
                component="img"
                image={data.image_url}
                alt={data.title}
                sx={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover" }}
              />
            ) : (
              <Box sx={{ width: "100%", aspectRatio: "4 / 3", bgcolor: "#f1f5f9" }} />
            )}
          </Card>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mt: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{data.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", mt: 1 }}>
              {data.description || ""}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              {data.is_active ? <Chip size="small" color="success" label="Active" /> : <Chip size="small" label="Inactive" />}
              {data.created_by_name ? <Chip size="small" label={`Seller: ${data.created_by_name}`} /> : null}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              Location: {[data.city, data.state, data.country, data.pincode].filter(Boolean).join(", ")}
            </Typography>
            <Button variant="text" sx={{ mt: 1 }} onClick={() => navigate(-1)}>
              Back
            </Button>
          </Paper>
        </Grid>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Product List
            </Typography>
            <Box sx={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Discount %</TableCell>
                <TableCell align="right">Selling Price</TableCell>
                <TableCell align="right">Coupon Redeem %</TableCell>
                <TableCell align="right">Commission Pool %</TableCell>
                <TableCell align="right">Gift</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
              <TableBody>
                {(items || []).map((it) => {
                  const selling = it.selling_price != null ? Number(it.selling_price) : (Number(it.price || 0) * (1 - Number(it.discount || 0) / 100));
                  return (
                    <TableRow key={it.id}>
                      <TableCell>{it.name}</TableCell>
                      <TableCell align="right">₹{fmtMoney(it.price)}</TableCell>
                      <TableCell align="right">{Number(it.quantity || 0)}</TableCell>
                      <TableCell align="right">{fmtPct(it.discount)}</TableCell>
                      <TableCell align="right">₹{fmtMoney(selling)}</TableCell>
                      <TableCell align="right">{fmtPct(it.coupon_redeem_percent)}</TableCell>
                      <TableCell align="right">{fmtPct(it.commission_pool_percent)}</TableCell>
                      <TableCell align="right">{it.gift || "-"}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => openBuy(it)}
                          disabled={Number(it.quantity || 0) <= 0}
                        >
                          {Number(it.quantity || 0) > 0 ? "Buy" : "Sold Out"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!items || items.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Typography variant="body2" color="text.secondary">No items configured by the agency yet.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={buyOpen} onClose={() => setBuyOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Purchase Request</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {selectedItem?.name || ""}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Unit price: ₹{Number(selectedItem?.selling_price ?? (Number(selectedItem?.price || 0) * (1 - Number(selectedItem?.discount || 0) / 100))).toFixed(2)}
            </Typography>

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
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", min: 1, max: selectedItem?.quantity || 1 }}
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

            {(() => {
              const unit = Number(selectedItem?.selling_price ?? (Number(selectedItem?.price || 0) * (1 - Number(selectedItem?.discount || 0) / 100)));
              const total = Number(unit || 0) * (Number(buyForm.quantity || 1));
              return (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    Total payable: ₹ {total.toFixed(2)}
                  </Typography>
                  {payMethod === "wallet" && (
                    <>
                      <Typography variant="body2">
                        Wallet balance: ₹ {Number(walletBalance || 0).toFixed(2)}
                      </Typography>
                      {isLoggedIn && Number(walletBalance) < total && (
                        <Typography variant="caption" color="error">
                          Insufficient wallet balance. Pay with Cash or add funds via coupon.
                        </Typography>
                      )}
                    </>
                  )}
                </Box>
              );
            })()}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBuyOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={submitBuy}
            disabled={(() => {
              if (payMethod !== "wallet" || !isLoggedIn) return false;
              const unit = Number(selectedItem?.selling_price ?? (Number(selectedItem?.price || 0) * (1 - Number(selectedItem?.discount || 0) / 100)));
              const total = Number(unit || 0) * (Number(buyForm.quantity || 1));
              return Number(walletBalance) < total;
            })()}
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
