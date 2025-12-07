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
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import normalizeMediaUrl from "../utils/media";
import {
  getEcouponStoreBootstrap,
  createEcouponOrder,
  createPromoPurchase,
  createProductPurchaseRequest,
} from "../api/api";
import {
  subscribe as subscribeCart,
  getItems as getCartItems,
  getCartTotal as getCartTotalPrice,
  updateQty as cartUpdateQty,
  removeItem as cartRemoveItem,
  clearCart as cartClear,
  setItemFile as cartSetItemFile,
  setItemMeta as cartSetItemMeta,
} from "../store/cart";
import {
  subscribe as subscribeCheckout,
  getState as getCheckoutState,
  setStep as setCheckoutStep,
  setContact as setCheckoutContact,
  setUTR as setCheckoutUTR,
  setNotes as setCheckoutNotes,
  setPaymentFile as setCheckoutPaymentFile,
  resetCheckout as resetCheckoutStore,
} from "../store/checkout";

/**
 * Checkout V2 - 3-step manual checkout
 * Steps:
 *  1) Address & Contact (for PRODUCT items)
 *  2) Manual Payment (UPI QR, UTR, payment proof upload)
 *  3) Review & Confirmation (submits orders -> PENDING VERIFICATION)
 */
export default function CheckoutV2() {
  const navigate = useNavigate();
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);

  // Stepper
  const steps = ["Address", "Payment", "Review"];
  const [activeStep, setActiveStep] = useState(0);

  // Payment config (QR/UPI etc.)
  const [payment, setPayment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("MANUAL"); // MANUAL | ONLINE (placeholder)
  const [ecouponPayment, setEcouponPayment] = useState({
    utr: "",
    notes: "",
    file: null,
  });

  useEffect(() => {
    // Prime cart snapshot
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

  const loadBootstrap = async () => {
    setLoading(true);
    try {
      const data = await getEcouponStoreBootstrap();
      setPayment(data?.payment_config || null);
    } catch {
      // Do not block the page if payment config fails
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

  const grouped = useMemo(() => {
    const out = { ECOUPON: [], PROMO_PACKAGE: [], PRODUCT: [], OTHERS: [] };
    for (const it of items) {
      const t = String(it.type || "").toUpperCase();
      if (t === "ECOUPON") out.ECOUPON.push(it);
      else if (t === "PROMO_PACKAGE") out.PROMO_PACKAGE.push(it);
      else if (t === "PRODUCT") out.PRODUCT.push(it);
      else out.OTHERS.push(it);
    }
    return out;
  }, [items]);

  const [checkingOut, setCheckingOut] = useState(false);

  // Contact details for product requests (prefilled from logged-in user if available)
  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user") || sessionStorage.getItem("user");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  useEffect(() => {
    setContact((c) => ({
      name: c.name || storedUser?.full_name || storedUser?.username || "",
      email: c.email || storedUser?.email || "",
      phone: c.phone || storedUser?.phone || storedUser?.mobile || storedUser?.contact || "",
    }));
  }, [storedUser]);

  // Initialize from checkout store + subscribe for persistence
  useEffect(() => {
    try {
      const s = getCheckoutState ? getCheckoutState() : null;
      if (s && typeof s === "object") {
        setActiveStep(Number.isFinite(s.step) ? s.step : 0);
        setContact((prev) => ({
          name: s.contact?.name ?? prev.name,
          email: s.contact?.email ?? prev.email,
          phone: s.contact?.phone ?? prev.phone,
        }));
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
            setActiveStep(Number.isFinite(next.step) ? next.step : 0);
            setContact({
              name: next?.contact?.name || "",
              email: next?.contact?.email || "",
              phone: next?.contact?.phone || "",
            });
            setEcouponPayment((prev) => ({
              ...prev,
              utr: next?.utr || "",
              notes: next?.notes || "",
              file: next?.file || null,
            }));
          } catch {}
        })
      : null;
    return () => {
      try { unsub && unsub(); } catch {}
    };
  }, []);

  // Product payment method
  const [productPayMethod, setProductPayMethod] = useState("wallet");

  const handleUpdateQty = (key, qty) => {
    try {
      cartUpdateQty(key, qty);
    } catch {}
  };

  const handleRemove = (key) => {
    try {
      cartRemoveItem(key);
    } catch {}
  };

  const handleSetFile = (key, file) => {
    try {
      cartSetItemFile(key, file);
    } catch {}
  };

  const handleSetMeta = (key, partial) => {
    try {
      cartSetItemMeta(key, partial || {});
    } catch {}
  };

  const promoMissingFiles = useMemo(() => {
    return grouped.PROMO_PACKAGE.filter((it) => !it.file).map((it) => it.name);
  }, [grouped.PROMO_PACKAGE]);

  const productMissingAddresses = useMemo(() => {
    return (grouped.PRODUCT || [])
      .filter((it) => !String(it?.meta?.shipping_address || "").trim())
      .map((it) => it.name);
  }, [grouped.PRODUCT]);

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

  // Validation before moving to next step
  const validateStep0 = () => {
    if ((grouped.PRODUCT || []).length > 0) {
      const missing = (grouped.PRODUCT || [])
        .filter((it) => !String(it?.meta?.shipping_address || "").trim())
        .map((it) => it.name);
      if (missing.length > 0) {
        try {
          alert(`Add shipping address for: ${missing.join(", ")}`);
        } catch {}
        return false;
      }
      if (!String(contact.name || "").trim() || !String(contact.phone || "").trim()) {
        try {
          alert("Please provide your name and phone for product orders.");
        } catch {}
        return false;
      }
    }
    return true;
  };

  const validateStep1 = () => {
    // Enforce UTR + screenshot only when there are e-coupon lines to be paid via manual UPI
    if ((grouped.ECOUPON || []).length > 0) {
      const hasUtr = String(ecouponPayment.utr || "").trim().length > 0;
      const hasFile = !!ecouponPayment.file;
      if (!hasUtr || !hasFile) {
        try {
          alert("Enter UTR and attach payment screenshot for e‑coupon orders.");
        } catch {}
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (activeStep === 0) {
      if (!validateStep0()) return;
      setActiveStep(1);
      try { setCheckoutStep && setCheckoutStep(1); } catch {}
    } else if (activeStep === 1) {
      if (!validateStep1()) return;
      setActiveStep(2);
      try { setCheckoutStep && setCheckoutStep(2); } catch {}
    }
  };

  const goBack = () => {
    setActiveStep((s) => {
      const n = Math.max(0, s - 1);
      try { setCheckoutStep && setCheckoutStep(n); } catch {}
      return n;
    });
  };

  const checkout = async () => {
    if (!items.length) {
      try {
        alert("Cart is empty.");
      } catch {}
      return;
    }

    // Preflight validation for PRODUCT lines (defensive)
    if ((grouped.PRODUCT || []).length > 0) {
      const missing = (grouped.PRODUCT || [])
        .filter((it) => !String(it?.meta?.shipping_address || "").trim())
        .map((it) => it.name);
      if (missing.length > 0) {
        try {
          alert(`Add shipping address for: ${missing.join(", ")}`);
        } catch {}
        return;
      }
      if (!String(contact.name || "").trim() || !String(contact.phone || "").trim()) {
        try {
          alert("Please provide your name and phone for product orders.");
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
          const file = it.file || null; // expected for promo packages
          let remarks = "";
          try {
            const ch = String(it?.meta?.prime150_choice || "").toUpperCase();
            if (ch === "EBOOK" || ch === "REDEEM") {
              remarks = `[PRIME150] choice=${ch}`;
            }
          } catch {}
          if (kind === "MONTHLY") {
            const package_number = it?.meta?.package_number ?? null;
            const boxes = Array.isArray(it?.meta?.boxes) ? it.meta.boxes : [];
            await createPromoPurchase({
              package_id: it.id,
              quantity: Math.max(1, parseInt(it.qty || 1, 10)),
              package_number,
              boxes,
              file,
              remarks,
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
              remarks,
            });
          } else {
            // Unknown promo subtype; fallback using qty+file only
            await createPromoPurchase({
              package_id: it.id,
              quantity: Math.max(1, parseInt(it.qty || 1, 10)),
              file,
              remarks,
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

      // 3) Submit PRODUCT items
      for (const it of grouped.PRODUCT) {
        try {
          const addr = String(it?.meta?.shipping_address || "").trim();
          await createProductPurchaseRequest({
            product: it.id,
            quantity: Math.max(1, parseInt(it.qty || 1, 10)),
            consumer_name: contact.name,
            consumer_email: contact.email,
            consumer_phone: contact.phone,
            consumer_address: addr,
            payment_method: productPayMethod,
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
        alert(
          `Submitted ${success} item(s).${failed > 0 ? ` Failed ${failed}.` : ""}`
        );
      } catch {}
      // Reset ecoupon payment form on success if all succeeded
      if (failed === 0) {
        setEcouponPayment({ utr: "", notes: "", file: null });
        try { resetCheckoutStore && resetCheckoutStore(); } catch {}
      }
      // If everything succeeded, go to success page
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

  // UI builders
  const AddressStep = () => (
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
        Address & Contact
      </Typography>

      {grouped.PRODUCT.length > 0 ? (
        <>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Provide shipping address for each product.
          </Typography>
          <TableContainer sx={{ maxWidth: "100%", overflowX: "auto", mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Qty</TableCell>
                  <TableCell>Address</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {grouped.PRODUCT.map((it) => {
                  const qty = Math.max(1, parseInt(it.qty || 1, 10));
                  return (
                    <TableRow key={it.key}>
                      <TableCell>{it.name}</TableCell>
                      <TableCell style={{ maxWidth: 120 }}>
                        <TextField
                          size="small"
                          type="number"
                          inputProps={{ min: 1 }}
                          value={qty}
                          onChange={(e) => handleUpdateQty(it.key, e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          multiline
                          minRows={2}
                          placeholder="Enter delivery address"
                          value={it?.meta?.shipping_address || ""}
                          onChange={(e) =>
                            handleSetMeta(it.key, { shipping_address: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleRemove(it.key)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {productMissingAddresses.length > 0 ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Add shipping address for: {productMissingAddresses.join(", ")}.
            </Alert>
          ) : null}

          <Typography variant="subtitle2" sx={{ mt: 1 }}>Contact details</Typography>
          <Grid container spacing={1.5} sx={{ mb: 1, mt: 0.5 }}>
            <Grid item xs={12} sm={4}>
                <TextField
                  size="small"
                  fullWidth
                  label="Your Name"
                  value={contact.name}
                  onChange={(e) => {
                    const v = e.target.value;
                    setContact((s) => ({ ...s, name: v }));
                    try { setCheckoutContact && setCheckoutContact({ ...contact, name: v }); } catch {}
                  }}
                />
            </Grid>
            <Grid item xs={12} sm={4}>
                <TextField
                  size="small"
                  fullWidth
                  label="Email"
                  type="email"
                  value={contact.email}
                  onChange={(e) => {
                    const v = e.target.value;
                    setContact((s) => ({ ...s, email: v }));
                    try { setCheckoutContact && setCheckoutContact({ ...contact, email: v }); } catch {}
                  }}
                />
            </Grid>
            <Grid item xs={12} sm={4}>
                <TextField
                  size="small"
                  fullWidth
                  label="Phone"
                  value={contact.phone}
                  onChange={(e) => {
                    const v = e.target.value;
                    setContact((s) => ({ ...s, phone: v }));
                    try { setCheckoutContact && setCheckoutContact({ ...contact, phone: v }); } catch {}
                  }}
                />
            </Grid>
            <Grid item xs={12}>
              <FormControl component="fieldset" size="small">
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
            </Grid>
          </Grid>
        </>
      ) : (
        <Alert severity="info" sx={{ mb: 1 }}>
          No physical products in cart. You can proceed to payment.
        </Alert>
      )}

      <Stack direction="row" spacing={1} justifyContent="space-between">
        <Button variant="outlined" onClick={() => {
          const p = window.location.pathname;
          if (p.startsWith("/agency")) navigate("/agency/cart");
          else if (p.startsWith("/employee")) navigate("/employee/cart");
          else navigate("/user/cart");
        }}>
          Back to Cart
        </Button>
        <Button variant="contained" onClick={goNext} sx={{ textTransform: "none", fontWeight: 800 }}>
          Next
        </Button>
      </Stack>
    </Paper>
  );

  const PaymentStep = () => (
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
        Payment (Manual UPI)
      </Typography>

      {loading ? (
        <Box sx={{ py: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={18} />{" "}
          <Typography variant="body2">Loading payment config...</Typography>
        </Box>
      ) : null}

      <FormControl component="fieldset" size="small" sx={{ mb: 1 }}>
        <FormLabel component="legend">Payment Method</FormLabel>
        <RadioGroup
          row
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          <FormControlLabel
            value="MANUAL"
            control={<Radio size="small" />}
            label="Manual (UPI)"
          />
          <FormControlLabel
            value="ONLINE"
            control={<Radio size="small" />}
            label="Online"
            disabled
          />
        </RadioGroup>
      </FormControl>

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
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              ) : (
                <Box sx={{ p: 2, color: "text.secondary" }}>
                  No QR image uploaded.
                </Box>
              )}
            </Box>
          </Grid>
          <Grid item xs={12} md>
            <Grid container spacing={1}>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="caption" color="text.secondary">
                  Payee
                </Typography>
                <div style={{ fontWeight: 800 }}>
                  {payment.payee_name || "—"}
                </div>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="caption" color="text.secondary">
                  UPI ID
                </Typography>
                <div style={{ fontWeight: 800 }}>
                  {payment.upi_id || "—"}
                </div>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Instructions
                </Typography>
                <Box sx={{ whiteSpace: "pre-wrap" }}>
                  {payment.instructions ||
                    "Scan the QR or pay to the UPI ID, then provide UTR and upload payment proof."}
                </Box>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      ) : (
        <Alert severity="warning" sx={{ mb: 1 }}>
          Payments are temporarily unavailable or not configured for e‑coupons.
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
              setEcouponPayment((s) => ({
                ...s,
                notes: v,
              }));
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

      <Stack direction="row" spacing={1} justifyContent="space-between">
        <Button variant="outlined" onClick={goBack}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={goNext}
          sx={{ textTransform: "none", fontWeight: 800 }}
        >
          Submit Payment for Verification
        </Button>
      </Stack>
    </Paper>
  );

  const ReviewStep = () => (
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
        Review & Confirm
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Please review your items and payment details before confirming.
      </Alert>

      {/* Compact items table for final review */}
      <TableContainer sx={{ maxWidth: "100%", overflowX: "auto", mb: 2 }}>
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
              const t = String(it.type || "").toUpperCase();
              return (
                <TableRow key={it.key}>
                  <TableCell>{t}</TableCell>
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

      {promoMissingFiles.length > 0 ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Some Promo Package items do not have a payment proof attached:{" "}
          {promoMissingFiles.join(", ")}. You can attach a proof per item in cart before confirming.
        </Alert>
      ) : null}

      {/* Show selected UTR/file summary if any e-coupon lines */}
      {(grouped.ECOUPON || []).length > 0 ? (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2">Payment Details (E‑Coupon)</Typography>
          <Typography variant="body2" color="text.secondary">
            UTR: {ecouponPayment.utr ? ecouponPayment.utr : "—"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Screenshot: {ecouponPayment.file ? ecouponPayment.file.name : "—"}
          </Typography>
        </Box>
      ) : null}

      <Divider sx={{ my: 1.5 }} />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center" justifyContent="space-between">
        <Button variant="outlined" onClick={goBack}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={checkout}
          disabled={checkingOut || items.length === 0}
          sx={{ textTransform: "none", fontWeight: 800 }}
        >
          {checkingOut ? "Submitting..." : "Confirm & Create Order"}
        </Button>
      </Stack>
    </Paper>
  );

  const SummarySidebar = () => (
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
        Order Summary
      </Typography>
      <Stack spacing={0.75}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary">Items</Typography>
          <Typography variant="body2">{items.length}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary">Subtotal</Typography>
          <Typography variant="body2">₹{Number(total).toLocaleString("en-IN")}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary">Tax</Typography>
          <Typography variant="body2">₹0</Typography>
        </Stack>
        <Divider sx={{ my: 0.5 }} />
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" sx={{ fontWeight: 800 }}>Total</Typography>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>₹{Number(total).toLocaleString("en-IN")}</Typography>
        </Stack>
      </Stack>
      <Divider sx={{ my: 1 }} />
      <Typography variant="caption" color="text.secondary">
        Payments are reviewed by admin. Upon approval, allocations will be made to your account.
      </Typography>
    </Paper>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#0C2D48" }}>
          Checkout
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

      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 2 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

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
            {activeStep === 0 && <AddressStep />}
            {activeStep === 1 && <PaymentStep />}
            {activeStep === 2 && <ReviewStep />}

            {/* Utility: Clear cart + promo file warning in Address step */}
            {activeStep === 0 && (
              <>
                {promoMissingFiles.length > 0 ? (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Some Promo Package items do not have a payment proof attached:{" "}
                    {promoMissingFiles.join(", ")}. You can attach a file for each such item from the cart.
                  </Alert>
                ) : null}
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => cartClear()}>
                    Clear Cart
                  </Button>
                </Stack>
              </>
            )}
          </Grid>
          <Grid item xs={12} md={4}>
            <SummarySidebar />
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
          Role: {roleHint}. This checkout uses a 3‑step manual flow with UPI QR (if configured). Orders are created in pending state and approved by admin.
        </Typography>
      </Paper>
    </Box>
  );
}
