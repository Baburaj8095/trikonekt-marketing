import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Alert,
  Divider,
  Grid,
  TextField,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  CircularProgress,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Slider,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import normalizeMediaUrl from "../utils/media";
import {
  getEcouponStoreBootstrap,
  createEcouponOrder,
  createPromoPurchase,
  createProductPurchaseRequest,
  getRewardPointsSummary,
  agencyCreatePaymentRequest,
} from "../api/api";
import {
  subscribe as subscribeCart,
  getItems as getCartItems,
  getCartTotal as getCartTotalPrice,
  removeItem as cartRemoveItem,
  clearCart as cartClear,
  setItemFile as cartSetItemFile,
} from "../store/cart";
import {
  subscribe as subscribeCheckout,
  getState as getCheckoutState,
  setUTR as setCheckoutUTR,
  setNotes as setCheckoutNotes,
  setPaymentFile as setCheckoutPaymentFile,
  resetCheckout as resetCheckoutStore,
} from "../store/checkout";

/**
 * Payment Page
 * - Final read-only items summary
 * - Reward redemption logic (for PRODUCT lines)
 * - Payment method selection (Manual UPI / Online placeholder)
 * - Pay Now submits orders and navigates to Success
 */
export default function Payment() {
  const navigate = useNavigate();

  const [cart, setCart] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  // Role hint for routing
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

  // Payment config (UPI)
  const [payment, setPayment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("MANUAL"); // MANUAL | ONLINE (placeholder)
  const [ecouponPayment, setEcouponPayment] = useState({
    utr: "",
    notes: "",
    file: null,
  });

  // Product payment method specific to physical products (wallet/cash)
  const [productPayMethod, setProductPayMethod] = useState("wallet");

  // Load cart snapshot
  useEffect(() => {
    const pushState = () => {
      try {
        const items = getCartItems();
        const total = getCartTotalPrice();
        setCart({ items, total });
      } catch {
        setCart({ items: [], total: 0 });
      }
    };
    const unsub = subscribeCart(() => pushState());
    pushState();
    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, []);

  // Payment config
  const loadBootstrap = async () => {
    setLoading(true);
    try {
      const data = await getEcouponStoreBootstrap();
      setPayment(data?.payment_config || null);
    } catch {
      setPayment(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadBootstrap();
  }, []);

  const items = cart.items || [];
  const total = Number(cart.total || 0);

  // Group items by type
  const grouped = useMemo(() => {
    const out = { ECOUPON: [], PROMO_PACKAGE: [], AGENCY_PACKAGE: [], PRODUCT: [], OTHERS: [] };
    for (const it of items) {
      const t = String(it.type || "").toUpperCase();
      if (t === "ECOUPON") out.ECOUPON.push(it);
      else if (t === "PROMO_PACKAGE") out.PROMO_PACKAGE.push(it);
      else if (t === "AGENCY_PACKAGE") out.AGENCY_PACKAGE.push(it);
      else if (t === "PRODUCT") out.PRODUCT.push(it);
      else out.OTHERS.push(it);
    }
    return out;
  }, [items]);

  // Checkout store (contact, utr/notes/file)
  useEffect(() => {
    try {
      const s = getCheckoutState ? getCheckoutState() : null;
      if (s && typeof s === "object") {
        setEcouponPayment((prev) => ({
          ...prev,
          utr: s.utr || prev.utr,
          notes: s.notes || prev.notes,
          file: s.file || prev.file,
        }));
      }
    } catch {}
    const unsub = typeof subscribeCheckout === "function"
      ? subscribeCheckout((next) => {
          try {
            setEcouponPayment((prev) => ({
              ...prev,
              utr: next?.utr || prev.utr || "",
              notes: next?.notes || prev.notes || "",
              file: next?.file || prev.file || null,
            }));
          } catch {}
        })
      : null;
    return () => {
      try { unsub && unsub(); } catch {}
    };
  }, []);

  // Reward points summary + order cap and chosen redeem amount (for PRODUCT lines)
  const [rewardSummary, setRewardSummary] = useState({ available: 0 });
  const availablePoints = Number(rewardSummary?.available || rewardSummary?.current_points || 0);

  const orderRewardCap = useMemo(() => {
    try {
      let cap = 0;
      for (const it of grouped.PRODUCT) {
        const unit = Number(it.unitPrice || 0);
        const qty = Math.max(1, parseInt(it.qty || 1, 10));
        const pct = Math.max(0, Number(it?.meta?.max_reward_pct || 0));
        if (pct <= 0) continue;
        const lineCap = (unit * qty * pct) / 100;
        if (isFinite(lineCap) && lineCap > 0) cap += lineCap;
      }
      return Math.max(0, cap);
    } catch {
      return 0;
    }
  }, [grouped.PRODUCT]);
  const [redeemUse, setRedeemUse] = useState(0);
  const redeemMax = Math.max(0, Math.min(availablePoints, orderRewardCap));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getRewardPointsSummary();
        if (!alive) return;
        const pts = Number(res?.current_points || 0);
        setRewardSummary({ ...res, available: isFinite(pts) ? pts : 0 });
      } catch {
        if (!alive) return;
        setRewardSummary({ available: 0 });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Keep chosen redeem within bounds when cap/available changes
  useEffect(() => {
    setRedeemUse((prev) => {
      const n = Number(prev || 0);
      if (!isFinite(n) || n < 0) return 0;
      if (n > redeemMax) return redeemMax;
      return n;
    });
  }, [redeemMax]);

  const SummaryTable = () => (
    <TableContainer sx={{ maxWidth: "100%", overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Type</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Qty</TableCell>
            <TableCell>Unit</TableCell>
            <TableCell>Subtotal</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((it) => {
            const unit = Number(it.unitPrice || 0);
            const qty = Math.max(1, parseInt(it.qty || 1, 10));
            const subtotal = unit * qty;
            return (
              <TableRow key={it.key}>
                <TableCell>{String(it.type || "").toUpperCase()}</TableCell>
                <TableCell>{it.name}</TableCell>
                <TableCell>{qty}</TableCell>
                <TableCell>₹{unit.toLocaleString("en-IN")}</TableCell>
                <TableCell>₹{Number(subtotal).toLocaleString("en-IN")}</TableCell>
              </TableRow>
            );
          })}
          <TableRow>
            <TableCell colSpan={4} align="right" style={{ fontWeight: 800 }}>
              Total
            </TableCell>
            <TableCell style={{ fontWeight: 800 }}>
              ₹{Number(total).toLocaleString("en-IN")}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );

  const PromoProofs = () => {
    if ((grouped.PROMO_PACKAGE || []).length === 0) return null;
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "#fff",
          mb: 2,
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Payment Proofs (Promo Packages)
        </Typography>
        <Stack spacing={1}>
          {grouped.PROMO_PACKAGE.map((it) => (
            <Stack key={it.key} direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={1}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {it.name}
              </Typography>
              <Button variant="outlined" size="small" component="label">
                {it.file ? "Change Proof" : "Attach Proof"}
                <input
                  type="file"
                  hidden
                  accept="image/*,application/pdf"
                  onChange={(e) =>
                    cartSetItemFile(
                      it.key,
                      e.target.files && e.target.files[0] ? e.target.files[0] : null
                    )
                  }
                />
              </Button>
              {it.file ? (
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {it.file.name}
                </Typography>
              ) : null}
            </Stack>
          ))}
        </Stack>
      </Paper>
    );
  };

  const checkout = async () => {
    if (!items.length) {
      try {
        alert("Cart is empty.");
      } catch {}
      return;
    }

    // Defensive: ensure contact info exists for PRODUCT requests (collected on Checkout page)
    let contact = { name: "", email: "", phone: "" };
    try {
      const s = getCheckoutState ? getCheckoutState() : null;
      if (s && typeof s === "object") {
        contact = {
          name: s?.contact?.name || "",
          email: s?.contact?.email || "",
          phone: s?.contact?.phone || "",
        };
      }
    } catch {}

    if ((grouped.PRODUCT || []).length > 0) {
      if (!String(contact.name || "").trim() || !String(contact.phone || "").trim()) {
        try {
          alert("Missing contact details. Go back to Checkout and fill your name and phone.");
        } catch {}
        return;
      }
      // Also ensure shipping addresses on each PRODUCT line (Checkout page sets these).
      const missing = (grouped.PRODUCT || [])
        .filter((it) => !String(it?.meta?.shipping_address || "").trim())
        .map((it) => it.name);
      if (missing.length > 0) {
        try {
          alert(`Add shipping address for: ${missing.join(", ")} on Checkout page.`);
        } catch {}
        return;
      }
    }

    // For e‑coupon orders paid via Manual UPI, enforce UTR + screenshot
    if ((grouped.ECOUPON || []).length > 0 && paymentMethod === "MANUAL") {
      const hasUtr = String(ecouponPayment.utr || "").trim().length > 0;
      const hasFile = !!ecouponPayment.file;
      if (!hasUtr || !hasFile) {
        try {
          alert("Enter UTR and attach payment screenshot for e‑coupon orders.");
        } catch {}
        return;
      }
    }

    setCheckingOut(true);

    const results = [];
    try {
      // 1) Submit ECOUPON line items
      for (const it of grouped.ECOUPON) {
        try {
          const lineFile = it.file || ecouponPayment.file || null;
          await createEcouponOrder({
            product: it.id,
            quantity: it.qty,
            utr: String(ecouponPayment.utr || ""),
            notes: String(`[${paymentMethod}] ` + (ecouponPayment.notes || "")),
            file: lineFile,
          });
          results.push({ key: it.key, ok: true });
        } catch (e) {
          results.push({
            key: it.key,
            ok: false,
            msg:
              e?.response?.data?.detail ||
              e?.message ||
              "Failed to submit e‑coupon order.",
          });
        }
      }

      // 2) Submit PROMO PACKAGE items
      for (const it of grouped.PROMO_PACKAGE) {
        try {
          const kind = String(it?.meta?.kind || "").toUpperCase();
          const file = it.file || null; // proof is optional
          if (kind === "MONTHLY") {
            const package_number = it?.meta?.package_number ?? null;
            const boxes = Array.isArray(it?.meta?.boxes) ? it.meta.boxes : [];
            await createPromoPurchase({
              package_id: it.id,
              quantity: Math.max(1, parseInt(it.qty || 1, 10)),
              package_number,
              boxes,
              file,
            });
          } else if (kind === "PRIME") {
            const selected_product_id =
              it?.meta?.selected_product_id != null
                ? it.meta.selected_product_id
                : null;
            const selected_promo_product_id =
              it?.meta?.selected_promo_product_id != null
                ? it.meta.selected_promo_product_id
                : null;
            const shipping_address = it?.meta?.shipping_address || "";
            const prime150_choice =
              it?.meta?.prime150_choice != null ? it.meta.prime150_choice : null;
            const prime750_choice =
              it?.meta?.prime750_choice != null ? it.meta.prime750_choice : null;
            await createPromoPurchase({
              package_id: it.id,
              quantity: Math.max(1, parseInt(it.qty || 1, 10)),
              selected_product_id,
              selected_promo_product_id,
              shipping_address,
              prime150_choice,
              prime750_choice,
              file,
            });
          } else {
            await createPromoPurchase({
              package_id: it.id,
              quantity: Math.max(1, parseInt(it.qty || 1, 10)),
              file,
            });
          }
          results.push({ key: it.key, ok: true });
        } catch (e) {
          results.push({
            key: it.key,
            ok: false,
            msg:
              e?.response?.data?.detail ||
              e?.message ||
              "Failed to submit promo package.",
          });
        }
      }

      // 2b) Submit AGENCY PACKAGE payment requests (to admin approval)
      for (const it of grouped.AGENCY_PACKAGE) {
        try {
          const unit = Number(it.unitPrice || 0);
          const qty = Math.max(1, parseInt(it.qty || 1, 10));
          const amount = unit * qty;
          await agencyCreatePaymentRequest(it.id, {
            amount,
            method: "UPI",
            utr: String(it?.meta?.reference || ""),
          });
          results.push({ key: it.key, ok: true });
        } catch (e) {
          results.push({
            key: it.key,
            ok: false,
            msg:
              e?.response?.data?.detail ||
              e?.message ||
              "Failed to create agency package payment request.",
          });
        }
      }

      // 3) Submit PRODUCT items with reward allocation up to per-line cap and chosen total
      {
        let remainingRedeem = Math.max(0, Math.min(Number(redeemUse || 0), Number(redeemMax || 0)));
        let contact = { name: "", email: "", phone: "" };
        try {
          const s = getCheckoutState ? getCheckoutState() : null;
          if (s && typeof s === "object") {
            contact = {
              name: s?.contact?.name || "",
              email: s?.contact?.email || "",
              phone: s?.contact?.phone || "",
            };
          }
        } catch {}
        for (const it of grouped.PRODUCT) {
          try {
            const addr = String(it?.meta?.shipping_address || "").trim();
            const unit = Number(it.unitPrice || 0);
            const qty = Math.max(1, parseInt(it.qty || 1, 10));
            const maxPct = Math.max(0, Number(it?.meta?.max_reward_pct || 0));
            const lineCap = maxPct > 0 ? Math.max(0, (unit * qty * maxPct) / 100) : 0;

            let lineRedeem = 0;
            if (remainingRedeem > 0 && lineCap > 0) {
              lineRedeem = Math.min(remainingRedeem, lineCap);
              lineRedeem = Math.round(lineRedeem * 100) / 100;
              remainingRedeem = Math.max(0, Math.round((remainingRedeem - lineRedeem) * 100) / 100);
            }

            await createProductPurchaseRequest({
              product: it.id,
              quantity: qty,
              consumer_name: contact.name,
              consumer_email: contact.email,
              consumer_phone: contact.phone,
              consumer_address: addr,
              payment_method: productPayMethod,
              reward_discount_amount: lineRedeem,
            });
            results.push({ key: it.key, ok: true });
          } catch (e) {
            results.push({
              key: it.key,
              ok: false,
              msg:
                e?.response?.data?.detail ||
                e?.message ||
                "Failed to submit product request.",
            });
          }
        }
      }

      // Remove lines that succeeded
      for (const r of results) {
        if (r.ok) {
          try {
            cartRemoveItem(r.key);
          } catch {}
        }
      }

      const success = results.filter((r) => r.ok).length;
      const failed = results.length - success;
      try {
        alert(`Submitted ${success} item(s).${failed > 0 ? ` Failed ${failed}.` : ""}`);
      } catch {}

      if (failed === 0) {
        setEcouponPayment({ utr: "", notes: "", file: null });
        try { resetCheckoutStore && resetCheckoutStore(); } catch {}
      }

      if (failed === 0) {
        try {
          const p = window.location.pathname;
          if (p.startsWith("/agency")) navigate("/agency/checkout/success", { replace: true });
          else if (p.startsWith("/employee")) navigate("/employee/checkout/success", { replace: true });
          else navigate("/user/checkout/success", { replace: true });
        } catch {}
      }
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#0C2D48" }}>
          Payment
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip size="small" label={`Items: ${items.length}`} />
          <Chip
            size="small"
            color="primary"
            label={`Total: ₹${Number(total || 0).toLocaleString("en-IN")}`}
          />
        </Stack>
      </Stack>

      {items.length === 0 ? (
        <Alert severity="info">
          Cart is empty. Add items from store pages.
          <Button size="small" sx={{ ml: 1 }} onClick={() => {
            const p = window.location.pathname;
            if (p.startsWith("/agency")) navigate("/agency/cart");
            else if (p.startsWith("/employee")) navigate("/employee/cart");
            else navigate("/user/cart");
          }}>Go to Cart</Button>
        </Alert>
      ) : (
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, md: 3 },
                borderRadius: 2,
                mb: 2,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "#fff",
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
                Order Summary
              </Typography>
              <SummaryTable />
            </Paper>

            <PromoProofs />

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, md: 3 },
                borderRadius: 2,
                mb: 2,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "#fff",
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
                Payment Method
              </Typography>

              <FormControl component="fieldset" size="small" sx={{ mb: 1 }}>
                <FormLabel component="legend">Online or Manual</FormLabel>
                <RadioGroup
                  row
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <FormControlLabel value="MANUAL" control={<Radio size="small" />} label="Manual UPI" />
                  <FormControlLabel value="ONLINE" control={<Radio size="small" />} label="Online (coming soon)" disabled />
                </RadioGroup>
              </FormControl>

              {/* Product payment method (wallet/cash) */}
              {grouped.PRODUCT.length > 0 ? (
                <FormControl component="fieldset" size="small" sx={{ mb: 1 }}>
                  <FormLabel component="legend">Product Payment Method</FormLabel>
                  <RadioGroup
                    row
                    value={productPayMethod}
                    onChange={(e) => setProductPayMethod(e.target.value)}
                  >
                    <FormControlLabel value="wallet" control={<Radio size="small" />} label="Wallet" />
                    <FormControlLabel value="cash" control={<Radio size="small" />} label="Cash" />
                  </RadioGroup>
                </FormControl>
              ) : null}

              {loading ? (
                <Box sx={{ py: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                  <CircularProgress size={18} />{" "}
                  <Typography variant="body2">Loading payment config...</Typography>
                </Box>
              ) : null}

              {payment ? (
                <Grid container spacing={2} sx={{ mb: 1 }}>
                  <Grid item xs={12} md="auto">
                    <Box
                      sx={{
                        width: 200,
                        height: 200,
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
                        <Typography variant="caption" color="text.secondary">Payee</Typography>
                        <div style={{ fontWeight: 800 }}>{payment.payee_name || "—"}</div>
                      </Grid>
                      <Grid item xs={12} sm={6} md={4}>
                        <Typography variant="caption" color="text.secondary">UPI ID</Typography>
                        <div style={{ fontWeight: 800 }}>{payment.upi_id || "—"}</div>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary">Instructions</Typography>
                        <Box sx={{ whiteSpace: "pre-wrap" }}>
                          {payment.instructions || "Scan the QR or pay to the UPI ID, then provide UTR and upload payment proof."}
                        </Box>
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>
              ) : (
                <Alert severity="warning" sx={{ mb: 1 }}>
                  Payments are temporarily unavailable or not configured.
                </Alert>
              )}

              <Grid container spacing={1.5} sx={{ mb: 1 }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    size="small"
                    label="UTR / Reference Number"
                    fullWidth
                    value={ecouponPayment.utr}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEcouponPayment((s) => ({ ...s, utr: v }));
                      try { setCheckoutUTR && setCheckoutUTR(v); } catch {}
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={8}>
                  <TextField
                    size="small"
                    label="Notes (optional)"
                    fullWidth
                    value={ecouponPayment.notes}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEcouponPayment((s) => ({ ...s, notes: v }));
                      try { setCheckoutNotes && setCheckoutNotes(v); } catch {}
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button variant="outlined" size="small" component="label">
                    {ecouponPayment.file ? "Change Payment Screenshot" : "Upload Payment Screenshot"}
                    <input
                      type="file"
                      hidden
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                        setEcouponPayment((s) => ({ ...s, file: f }));
                        try { setCheckoutPaymentFile && setCheckoutPaymentFile(f); } catch {}
                      }}
                    />
                  </Button>
                  {ecouponPayment.file ? (
                    <Typography variant="caption" sx={{ ml: 1 }}>
                      {ecouponPayment.file.name}
                    </Typography>
                  ) : null}
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "#fff",
                position: { md: "sticky" },
                top: { md: 16 },
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Rewards & Total
              </Typography>

              {grouped.PRODUCT.length > 0 ? (
                <>
                  <Stack spacing={0.75}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Available</Typography>
                      <Typography variant="caption">₹{Number(availablePoints).toLocaleString("en-IN")}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Max this order</Typography>
                      <Typography variant="caption">₹{Number(redeemMax).toLocaleString("en-IN")}</Typography>
                    </Stack>
                  </Stack>

                  <Slider
                    size="small"
                    value={Math.min(Number(redeemUse || 0), Number(redeemMax || 0))}
                    min={0}
                    max={Math.max(0, Math.floor(Number(redeemMax || 0) * 100) / 100)}
                    step={1}
                    onChange={(_, v) => {
                      const val = Array.isArray(v) ? v[0] : Number(v || 0);
                      if (!isFinite(val) || val < 0) return setRedeemUse(0);
                      if (val > redeemMax) return setRedeemUse(redeemMax);
                      setRedeemUse(val);
                    }}
                  />

                  <TextField
                    size="small"
                    type="number"
                    label="Redeem (₹)"
                    value={redeemUse}
                    inputProps={{ min: 0, max: Math.max(0, Math.floor(redeemMax * 100) / 100), step: "1" }}
                    onChange={(e) => {
                      const v = Number(e.target.value || 0);
                      if (!isFinite(v) || v < 0) return setRedeemUse(0);
                      if (v > redeemMax) return setRedeemUse(redeemMax);
                      setRedeemUse(v);
                    }}
                    fullWidth
                    sx={{ mt: 1 }}
                  />

                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => setRedeemUse(redeemMax)}>
                      Apply Max
                    </Button>
                    <Button size="small" onClick={() => setRedeemUse(0)}>
                      Reset
                    </Button>
                  </Stack>

                  <Divider sx={{ my: 1 }} />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="success.main">Reward Discount</Typography>
                    <Typography variant="body2" color="success.main">-₹{Number(redeemUse).toLocaleString("en-IN")}</Typography>
                  </Stack>
                </>
              ) : (
                <Alert severity="info" sx={{ mb: 1 }}>
                  No physical products in cart. Rewards not applicable.
                </Alert>
              )}

              <Divider sx={{ my: 0.5 }} />
              <Stack direction="row" justifyContent="space-between" sx={{ alignItems: "center" }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>Total</Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  ₹{Math.max(0, Number(total) - Number(redeemUse)).toLocaleString("en-IN")}
                </Typography>
              </Stack>

              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" color="text.secondary">
                Payments are reviewed by admin. Upon approval, allocations will be made to your account.
              </Typography>

              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={checkout}
                  disabled={checkingOut || items.length === 0}
                  sx={{ textTransform: "none", fontWeight: 800 }}
                >
                  {checkingOut ? "Submitting..." : "Pay Now"}
                </Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}

      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "#fff",
          mt: 2,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Role: {roleHint}. Finalize payment here. Address & contact are collected on Checkout.
        </Typography>
      </Paper>
    </Box>
  );
}
