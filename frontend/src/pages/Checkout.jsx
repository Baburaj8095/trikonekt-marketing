import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Alert,
  Divider,
  TextField,
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
  getRewardPointsSummary,
} from "../api/api";
import {
  subscribe as subscribeCart,
  getItems as getCartItems,
  getCartTotal as getCartTotalPrice,
  removeItem as cartRemoveItem,
  setItemFile as cartSetItemFile,
  setItemMeta as cartSetItemMeta,
} from "../store/cart";

export default function Checkout() {
  const navigate = useNavigate();
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);

  // Payment config for UPI/manual method
  const [payment, setPayment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("MANUAL"); // MANUAL | ONLINE (disabled)
  const [ecouponPayment, setEcouponPayment] = useState({
    utr: "",
    notes: "",
    file: null, // optional global file to apply to each e‑coupon order if line.file not set
  });

  // Sync cart snapshot
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

  // Load payment bootstrap
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

  // Step control
  const [step, setStep] = useState(1);

  // Contact details (prefill from user if available)
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
      phone:
        c.phone ||
        storedUser?.phone ||
        storedUser?.mobile ||
        storedUser?.contact ||
        "",
    }));
  }, [storedUser]);

  // STEP 1: Delivery address (apply to all PRODUCT and PRIME promo items)
  const initialAddress = useMemo(() => {
    const firstAddr =
      (grouped.PRODUCT.find((i) =>
        String(i?.meta?.shipping_address || "").trim()
      )?.meta?.shipping_address) ||
      (grouped.PROMO_PACKAGE.find(
        (i) =>
          String(i?.meta?.shipping_address || "").trim() &&
          String(i?.meta?.kind || "").toUpperCase() === "PRIME"
      )?.meta?.shipping_address) ||
      "";
    return firstAddr;
  }, [grouped.PRODUCT, grouped.PROMO_PACKAGE]);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  useEffect(() => {
    setDeliveryAddress((prev) => (prev ? prev : initialAddress));
  }, [initialAddress]);

  const applyAddressToItems = () => {
    const addr = String(deliveryAddress || "").trim();
    try {
      for (const it of grouped.PRODUCT) {
        cartSetItemMeta(it.key, { shipping_address: addr });
      }
      for (const it of grouped.PROMO_PACKAGE) {
        const kind = String(it?.meta?.kind || "").toUpperCase();
        if (kind === "PRIME") {
          cartSetItemMeta(it.key, { shipping_address: addr });
        }
      }
    } catch {}
  };

  // PRODUCT payment method + rewards
  const [productPayMethod, setProductPayMethod] = useState("wallet");
  const [rewardSummary, setRewardSummary] = useState({ available: 0 });
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
  const availablePoints = Number(
    rewardSummary?.available || rewardSummary?.current_points || 0
  );
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

  useEffect(() => {
    setRedeemUse((prev) => {
      const n = Number(prev || 0);
      if (!isFinite(n) || n < 0) return 0;
      if (n > redeemMax) return redeemMax;
      return n;
    });
  }, [redeemMax]);

  const [checkingOut, setCheckingOut] = useState(false);

  const checkout = async () => {
    if (!items.length) {
      try {
        alert("Cart is empty.");
      } catch {}
      return;
    }

    // Validate product lines
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
      // 1) ECOUPON lines
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

      // 2) PROMO PACKAGE lines
      for (const it of grouped.PROMO_PACKAGE) {
        try {
          const kind = String(it?.meta?.kind || "").toUpperCase();
          const file = it.file || null; // optional proof
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

      // 3) PRODUCT lines with reward allocation
      {
        let remainingRedeem = Math.max(
          0,
          Math.min(Number(redeemUse || 0), Number(redeemMax || 0))
        );
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
              remainingRedeem = Math.max(
                0,
                Math.round((remainingRedeem - lineRedeem) * 100) / 100
              );
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

      // Remove succeeded lines
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
      if (failed === 0) {
        setEcouponPayment({ utr: "", notes: "", file: null });
      }
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

  // UI pieces

  const OrderSummaryCard = ({ it }) => {
    const unit = Number(it.unitPrice || 0);
    const qty = Math.max(1, parseInt(it.qty || 1, 10));
    const subtotal = unit * qty;
    const img =
      (it?.meta?.image_url && normalizeMediaUrl(it.meta.image_url)) || null;
    const t = String(it.type || "").toUpperCase();

    return (
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "#fff",
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 1.5,
              overflow: "hidden",
              bgcolor: img ? "#f8fafc" : "#f1f5f9",
              flexShrink: 0,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            {img ? (
              <Box
                component="img"
                src={img}
                alt={it.name}
                sx={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <Stack
                sx={{ width: "100%", height: "100%" }}
                alignItems="center"
                justifyContent="center"
              >
                <Typography variant="caption" color="text.secondary">
                  {t.slice(0, 1) || "P"}
                </Typography>
              </Stack>
            )}
          </Box>

          <Stack sx={{ flex: 1, minWidth: 0, gap: 0.5 }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, lineHeight: 1.2 }}
              noWrap
            >
              {it.name}
            </Typography>

            <Typography variant="body2" color="text.secondary">
              Qty: {qty}
            </Typography>

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2">
                ₹{unit.toLocaleString("en-IN")}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                ₹{Number(subtotal).toLocaleString("en-IN")}
              </Typography>
            </Stack>

            {/* Optional per-line proof for PROMO_PACKAGE only (read-only otherwise) */}
            {t === "PROMO_PACKAGE" ? (
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                <Button variant="outlined" size="small" component="label">
                  {it.file ? "Change Proof" : "Attach Proof"}
                  <input
                    type="file"
                    hidden
                    accept="image/*,application/pdf"
                    onChange={(e) =>
                      cartSetItemFile(
                        it.key,
                        e.target.files && e.target.files[0]
                          ? e.target.files[0]
                          : null
                      )
                    }
                  />
                </Button>
                {it.file ? (
                  <Typography variant="caption" color="text.secondary">
                    {it.file.name || "Attached"}
                  </Typography>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </Stack>
      </Paper>
    );
  };

  const StepOne = (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "#fff",
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Delivery Address
      </Typography>
      <TextField
        size="small"
        fullWidth
        multiline
        minRows={3}
        placeholder="Enter delivery address"
        value={deliveryAddress}
        onChange={(e) => setDeliveryAddress(e.target.value)}
      />
      <Divider sx={{ my: 1.5 }} />
      <Button
        variant="contained"
        onClick={() => {
          applyAddressToItems();
          setStep(2);
        }}
        disabled={items.length === 0}
        sx={{ textTransform: "none", fontWeight: 800 }}
        fullWidth
      >
        Continue
      </Button>
    </Paper>
  );

  const StepTwo = (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "#fff",
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Contact Details
      </Typography>
      <Stack spacing={1.5}>
        <TextField
          size="small"
          fullWidth
          label="Name"
          value={contact.name}
          onChange={(e) => setContact((s) => ({ ...s, name: e.target.value }))}
        />
        <TextField
          size="small"
          fullWidth
          label="Email"
          type="email"
          value={contact.email}
          onChange={(e) => setContact((s) => ({ ...s, email: e.target.value }))}
        />
        <TextField
          size="small"
          fullWidth
          label="Phone"
          value={contact.phone}
          onChange={(e) => setContact((s) => ({ ...s, phone: e.target.value }))}
        />
      </Stack>
      <Divider sx={{ my: 1.5 }} />
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          onClick={() => setStep(1)}
          sx={{ textTransform: "none" }}
          fullWidth
        >
          Back
        </Button>
        <Button
          variant="contained"
          onClick={() => setStep(3)}
          sx={{ textTransform: "none", fontWeight: 800 }}
          fullWidth
        >
          Continue
        </Button>
      </Stack>
    </Paper>
  );

  const StepThree = (
    <Stack spacing={1.5}>
      {/* Order Summary (read-only) */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "#fff",
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Review & Payment
        </Typography>

        {items.length === 0 ? (
          <Alert severity="info">No items in cart.</Alert>
        ) : (
          <Stack spacing={1}>
            {items.map((it) => (
              <OrderSummaryCard key={it.key} it={it} />
            ))}
          </Stack>
        )}

        <Divider sx={{ my: 1.5 }} />
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">
            Total amount
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            ₹{Number(total).toLocaleString("en-IN")}
          </Typography>
        </Stack>
      </Paper>

      {/* Payment method and details (ecoupon / manual UPI) */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "#fff",
        }}
      >
        {loading ? (
          <Box sx={{ py: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={18} />
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
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Payee
            </Typography>
            <div style={{ fontWeight: 800 }}>{payment.payee_name || "—"}</div>
            <Typography variant="caption" color="text.secondary">
              UPI ID
            </Typography>
            <div style={{ fontWeight: 800 }}>{payment.upi_id || "—"}</div>
            <Typography variant="caption" color="text.secondary">
              Instructions
            </Typography>
            <Box sx={{ whiteSpace: "pre-wrap" }}>
              {payment.instructions ||
                "Scan the QR or pay to the UPI ID, then provide UTR and optionally upload payment proof."}
            </Box>
          </Box>
        ) : (
          <Alert severity="warning" sx={{ mb: 1 }}>
            Payments are temporarily unavailable or not configured for e‑coupons.
          </Alert>
        )}

        <Stack spacing={1.5}>
          <TextField
            size="small"
            label="UTR (optional)"
            fullWidth
            value={ecouponPayment.utr}
            onChange={(e) =>
              setEcouponPayment((s) => ({ ...s, utr: e.target.value }))
            }
          />
          <TextField
            size="small"
            label="Notes (optional)"
            fullWidth
            value={ecouponPayment.notes}
            onChange={(e) =>
              setEcouponPayment((s) => ({ ...s, notes: e.target.value }))
            }
          />
          <Button
            variant="outlined"
            size="small"
            component="label"
            sx={{ alignSelf: "flex-start" }}
          >
            {ecouponPayment.file
              ? "Change Payment Proof"
              : "Attach Payment Proof (optional)"}
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
            <Typography variant="caption">{ecouponPayment.file.name}</Typography>
          ) : null}
        </Stack>
      </Paper>

      {/* Product payment + rewards */}
      {grouped.PRODUCT.length > 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "#fff",
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Product Payment
          </Typography>
          <FormControl component="fieldset" size="small" sx={{ mb: 1 }}>
            <FormLabel component="legend">Payment Method</FormLabel>
            <RadioGroup
              row
              value={productPayMethod}
              onChange={(e) => setProductPayMethod(e.target.value)}
            >
              <FormControlLabel
                value="wallet"
                control={<Radio size="small" />}
                label="Wallet"
              />
              <FormControlLabel
                value="cash"
                control={<Radio size="small" />}
                label="Cash"
              />
            </RadioGroup>
          </FormControl>

          <Box
            sx={{
              mt: 1,
              p: 1.5,
              borderRadius: 1.5,
              border: "1px dashed",
              borderColor: "divider",
              bgcolor: "#fafafa",
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Redeem Reward Points (eligible products only)
            </Typography>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">
                  Available
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  ₹{Number(availablePoints).toLocaleString("en-IN")}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">
                  Max this order (cap)
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  ₹{Number(orderRewardCap).toLocaleString("en-IN")}
                </Typography>
              </Stack>
              <TextField
                size="small"
                label={`Redeem amount (₹, max ₹${Number(
                  redeemMax
                ).toLocaleString("en-IN")})`}
                type="number"
                inputProps={{
                  min: 0,
                  max: Math.max(0, Math.floor(redeemMax * 100) / 100),
                  step: "0.50",
                }}
                value={redeemUse}
                onChange={(e) => {
                  const v = Number(e.target.value || 0);
                  if (!isFinite(v) || v < 0) return setRedeemUse(0);
                  if (v > redeemMax) return setRedeemUse(redeemMax);
                  setRedeemUse(v);
                }}
                fullWidth
              />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Payable</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  ₹
                  {Math.max(0, Number(total) - Number(redeemUse)).toLocaleString(
                    "en-IN"
                  )}
                </Typography>
              </Stack>
              {redeemUse > 0 && productPayMethod === "cash" ? (
                <Typography variant="caption" color="text.secondary">
                  Note: For cash method, discount will be recorded with your
                  request; no wallet debit is performed online.
                </Typography>
              ) : null}
            </Stack>
          </Box>
        </Paper>
      ) : null}

      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          onClick={() => setStep(2)}
          sx={{ textTransform: "none" }}
          fullWidth
        >
          Back
        </Button>
        <Button
          variant="contained"
          onClick={checkout}
          disabled={checkingOut || items.length === 0}
          sx={{ textTransform: "none", fontWeight: 800 }}
          fullWidth
        >
          {checkingOut ? "Submitting..." : "Continue to Payment"}
        </Button>
      </Stack>
    </Stack>
  );

  return (
    <Box sx={{ p: 2, pb: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
        Checkout
      </Typography>

      {items.length === 0 ? (
        <Alert
          severity="info"
          action={
            <Button
              size="small"
              onClick={() => {
                const p = window.location.pathname;
                if (p.startsWith("/agency")) navigate("/agency/cart");
                else if (p.startsWith("/employee")) navigate("/employee/cart");
                else navigate("/user/cart");
              }}
            >
              Go to Cart
            </Button>
          }
        >
          Cart is empty. Add items from store pages.
        </Alert>
      ) : (
        <>
          <Stepper activeStep={step - 1} alternativeLabel sx={{ mb: 2 }}>
            {["Address", "Contact", "Review"].map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Stack spacing={1.5}>
            {step === 1 ? StepOne : null}
            {step === 2 ? StepTwo : null}
            {step === 3 ? StepThree : null}
          </Stack>
        </>
      )}
    </Box>
  );
}
