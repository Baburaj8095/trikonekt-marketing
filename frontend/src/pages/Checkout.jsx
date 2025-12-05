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

/**
 * Dedicated Checkout page
 * - Same submission logic as Cart
 * - Always focuses user on payment section (shows QR if configured)
 */
export default function Checkout() {
  const navigate = useNavigate();
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);

  // ECOUPON payment config (QR/UPI etc.)
  const [payment, setPayment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("MANUAL"); // MANUAL | ONLINE (placeholder)
  const [ecouponPayment, setEcouponPayment] = useState({
    utr: "",
    notes: "",
    file: null, // optional global file to apply to each e-coupon order if line.file not set
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

  // Product payment method
  const [productPayMethod, setProductPayMethod] = useState("wallet");

  const checkout = async () => {
    if (!items.length) {
      try {
        alert("Cart is empty.");
      } catch {}
      return;
    }

    // Preflight validation for PRODUCT lines
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
            const shipping_address = it?.meta?.shipping_address || "";
            await createPromoPurchase({
              package_id: it.id,
              quantity: Math.max(1, parseInt(it.qty || 1, 10)),
              selected_product_id,
              shipping_address,
              file,
            });
          } else {
            // Unknown promo subtype; fallback using qty+file only
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
      }
      // If everything succeeded, take user back to role cart or dashboard
      if (failed === 0) {
        try {
          const p = window.location.pathname;
          if (p.startsWith("/agency")) navigate("/agency/cart", { replace: true });
          else if (p.startsWith("/employee")) navigate("/employee/cart", { replace: true });
          else navigate("/user/cart", { replace: true });
        } catch {}
      }
    } finally {
      setCheckingOut(false);
    }
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

      {loading ? (
        <Box sx={{ py: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={18} />{" "}
          <Typography variant="body2">Loading payment config...</Typography>
        </Box>
      ) : null}

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
        <>
          {/* Items (readonly edits except qty/address/proof) */}
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
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}
            >
              Review Items
            </Typography>
            <TableContainer sx={{ maxWidth: "100%", overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Details</TableCell>
                    <TableCell>Qty</TableCell>
                    <TableCell>Unit</TableCell>
                    <TableCell>Subtotal</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((it) => {
                    const unit = Number(it.unitPrice || 0);
                    const qty = Math.max(1, parseInt(it.qty || 1, 10));
                    const subtotal = unit * qty;
                    const t = String(it.type || "").toUpperCase();
                    const details =
                      t === "PROMO_PACKAGE" ? (
                        <div style={{ fontSize: 12, color: "#475569" }}>
                          {String(it?.meta?.kind || "").toUpperCase() ===
                          "MONTHLY" ? (
                            <>
                              Package #{it?.meta?.package_number ?? "-"}
                              {" • "}Boxes:{" "}
                              {Array.isArray(it?.meta?.boxes)
                                ? it.meta.boxes.join(", ")
                                : "-"}
                            </>
                          ) : (
                            <>
                              {String(it?.meta?.kind || "")}
                              {it?.meta?.selected_product_id != null
                                ? ` • Product: ${it.meta.selected_product_id}`
                                : ""}
                              {it?.meta?.shipping_address
                                ? ` • Address: ${it.meta.shipping_address}`
                                : ""}
                            </>
                          )}
                        </div>
                      ) : t === "ECOUPON" ? (
                        <div style={{ fontSize: 12, color: "#475569" }}>
                          Denomination:{" "}
                          {it?.meta?.denomination != null
                            ? `₹${it.meta.denomination}`
                            : "—"}
                        </div>
                      ) : t === "PRODUCT" ? (
                        <div style={{ fontSize: 12, color: "#475569" }}>
                          <div>Shipping address:</div>
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
                        </div>
                      ) : null;

                    return (
                      <TableRow key={it.key}>
                        <TableCell>{t}</TableCell>
                        <TableCell>{it.name}</TableCell>
                        <TableCell>{details}</TableCell>
                        <TableCell style={{ maxWidth: 120 }}>
                          <TextField
                            size="small"
                            type="number"
                            inputProps={{ min: 1 }}
                            value={qty}
                            onChange={(e) =>
                              handleUpdateQty(it.key, e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell>₹{unit.toLocaleString("en-IN")}</TableCell>
                        <TableCell>
                          ₹{Number(subtotal).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            {String(it.type || "").toUpperCase() ===
                            "PROMO_PACKAGE" ? (
                              <Button
                                size="small"
                                variant="outlined"
                                component="label"
                              >
                                {it.file ? "Change Proof" : "Attach Proof"}
                                <input
                                  type="file"
                                  hidden
                                  accept="image/*,application/pdf"
                                  onChange={(e) =>
                                    handleSetFile(
                                      it.key,
                                      e.target.files && e.target.files[0]
                                        ? e.target.files[0]
                                        : null
                                    )
                                  }
                                />
                              </Button>
                            ) : null}
                            <Button
                              size="small"
                              color="error"
                              onClick={() => handleRemove(it.key)}
                            >
                              Remove
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell colSpan={5} align="right" style={{ fontWeight: 800 }}>
                      Total
                    </TableCell>
                    <TableCell style={{ fontWeight: 800 }}>
                      ₹{Number(total).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => cartClear()}>
                        Clear
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            {promoMissingFiles.length > 0 ? (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Some Promo Package items do not have a payment proof attached:{" "}
                {promoMissingFiles.join(", ")}. You can attach a file for each
                such item before submitting. Submission will still be attempted.
              </Alert>
            ) : null}
          </Paper>

          {/* Payment section */}
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
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}
            >
              Payment
            </Typography>

            {/* Payment instructions (Manual UPI) */}
            {items.length > 0 ? (
              <>
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
                              "Scan the QR or pay to the UPI ID, then provide UTR and optionally upload payment proof."}
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
                      label="UTR (optional)"
                      fullWidth
                      value={ecouponPayment.utr}
                      onChange={(e) =>
                        setEcouponPayment((s) => ({ ...s, utr: e.target.value }))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <TextField
                      size="small"
                      label="Notes (optional)"
                      fullWidth
                      value={ecouponPayment.notes}
                      onChange={(e) =>
                        setEcouponPayment((s) => ({
                          ...s,
                          notes: e.target.value,
                        }))
                      }
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button variant="outlined" size="small" component="label">
                      {ecouponPayment.file ? "Change Payment Proof" : "Attach Payment Proof (optional)"}
                      <input
                        type="file"
                        hidden
                        accept="image/*,application/pdf"
                        onChange={(e) =>
                          setEcouponPayment((s) => ({
                            ...s,
                            file:
                              e.target.files && e.target.files[0]
                                ? e.target.files[0]
                                : null,
                          }))
                        }
                      />
                    </Button>
                    {ecouponPayment.file ? (
                      <Typography variant="caption" sx={{ ml: 1 }}>
                        {ecouponPayment.file.name}
                      </Typography>
                    ) : null}
                  </Grid>
                </Grid>
              </>
            ) : (
              <Alert severity="info" sx={{ mb: 1 }}>
                No items in cart.
              </Alert>
            )}

            {/* Product contact and payment */}
            {grouped.PRODUCT.length > 0 ? (
              <>
                <Typography variant="subtitle2" sx={{ mt: 1 }}>Product checkout details</Typography>
                <Grid container spacing={1.5} sx={{ mb: 1, mt: 0.5 }}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      size="small"
                      fullWidth
                      label="Your Name"
                      value={contact.name}
                      onChange={(e) => setContact((s) => ({ ...s, name: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      size="small"
                      fullWidth
                      label="Email"
                      type="email"
                      value={contact.email}
                      onChange={(e) => setContact((s) => ({ ...s, email: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      size="small"
                      fullWidth
                      label="Phone"
                      value={contact.phone}
                      onChange={(e) => setContact((s) => ({ ...s, phone: e.target.value }))}
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
                {productMissingAddresses.length > 0 ? (
                  <Alert severity="warning" sx={{ mb: 1 }}>
                    Add shipping address for: {productMissingAddresses.join(", ")}.
                  </Alert>
                ) : null}
              </>
            ) : null}

            <Divider sx={{ my: 1.5 }} />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
              <Button
                variant="contained"
                onClick={checkout}
                disabled={checkingOut || items.length === 0}
                sx={{ textTransform: "none", fontWeight: 800 }}
              >
                {checkingOut ? "Submitting..." : "Submit for Approval"}
              </Button>
              <Typography variant="caption" color="text.secondary">
                Orders are reviewed by admin. Upon approval, allocations will be made to your account.
              </Typography>
            </Stack>
          </Paper>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              onClick={() => {
                const p = window.location.pathname;
                if (p.startsWith("/agency")) navigate("/agency/cart");
                else if (p.startsWith("/employee")) navigate("/employee/cart");
                else navigate("/user/cart");
              }}
            >
              Back to Cart
            </Button>
          </Stack>
        </>
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
          Role: {roleHint}. This checkout shows UPI QR (if configured) and submits e‑coupon orders, promo purchases, and product requests together.
        </Typography>
      </Paper>
    </Box>
  );
}
