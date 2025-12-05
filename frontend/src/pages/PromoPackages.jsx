import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Stack,
  Button,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import PublishedWithChangesIcon from "@mui/icons-material/PublishedWithChanges";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import dayjs from "dayjs";
import API, {
  getPromoPackages,
  listMyPromoPurchases,
  createPromoPurchase,
} from "../api/api";
import RewardPointsCard from "../components/RewardPointsCard";
import { useNavigate, useLocation } from "react-router-dom";
import normalizeMediaUrl from "../utils/media";

// If a Cloudinary URL 404s (asset not uploaded), fall back to backend /media path.
// Example: https://res.cloudinary.com/.../image/upload/v1/media/products/file.png
//          -> /media/products/file.png (normalized to backend origin)
function cloudinaryBackendFallback(url) {
  try {
    if (!url || typeof url !== "string") return "";
    const u = new URL(url);
    // Match /v<number>/<path>
    const m = u.pathname.match(/\/v\d+\/(.+)$/);
    if (m && m[1]) {
      const rel = m[1].startsWith("media/") ? `/${m[1]}` : `/${m[1]}`;
      return normalizeMediaUrl(rel);
    }
  } catch (_) {}
  return "";
}

function useMediaBase() {
  return useMemo(() => {
    try {
      const b = API?.defaults?.baseURL || "";
      return b.replace(/\/api\/?$/, "");
    } catch {
      return "";
    }
  }, []);
}

function MonthGrid({ year, selectedMonth, onSelect, disabledAllExceptCurrent = true }) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const today = dayjs();
  const currentMonth = today.month() + 1;
  const currentYear = today.year();

  return (
    <Grid container spacing={1}>
      {months.map((m) => {
        const isCurrent = year === currentYear && m === currentMonth;
        const disabled = disabledAllExceptCurrent && !isCurrent;
        return (
          <Grid item xs={3} sm={2} md={1} key={m}>
            <Button
              size="small"
              variant={selectedMonth === m ? "contained" : "outlined"}
              fullWidth
              disabled={disabled}
              onClick={() => onSelect && onSelect(m)}
              sx={{
                textTransform: "none",
                minWidth: 0,
                p: 0.75,
              }}
            >
              {dayjs(`${year}-${String(m).padStart(2, "0")}-01`).format("MMM")}
            </Button>
          </Grid>
        );
      })}
    </Grid>
  );
}

function BoxGrid({ total = 12, purchased = [], selected = [], onToggle }) {
  const boxes = Array.from({ length: Number(total) || 12 }, (_, i) => i + 1);
  const purchasedSet = new Set((purchased || []).map((x) => Number(x)));
  const selectedSet = new Set((selected || []).map((x) => Number(x)));
  return (
    <Grid container spacing={1}>
      {boxes.map((b) => {
        const isPaid = purchasedSet.has(b);
        const isSel = selectedSet.has(b);
        return (
          <Grid item xs={3} sm={2} md={1} key={b}>
            <Button
              size="small"
              variant={isSel ? "contained" : "outlined"}
              fullWidth
              disabled={isPaid}
              onClick={() => onToggle && onToggle(b)}
              sx={{ textTransform: "none", minWidth: 0, p: 0.75 }}
            >
              {isPaid ? "Paid" : b}
            </Button>
          </Grid>
        );
      })}
    </Grid>
  );
}

function PackageCard({
  pkg,
  onSubmit,
  onAddToCart,
}) {
  const MEDIA_BASE = useMediaBase();
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  // Legacy month/year kept only for backward compatibility (not used in new Monthly flow)
  const [month, setMonth] = useState(null);
  const [year, setYear] = useState(dayjs().year());
  // Quantity for PRIME packages only. For MONTHLY, quantity = selectedBoxes.length
  const [qty, setQty] = useState(1);

  const isMonthly = String(pkg?.type || "") === "MONTHLY";
  const price = Number(pkg?.price || 0);
  const isPrime750 =
    String(pkg?.type || "") === "PRIME" && Math.abs(Number(pkg?.price || 0) - 750) < 0.5;

  // PRIME 750 product selection
  const promoProducts = Array.isArray(pkg?.promo_products) ? pkg.promo_products : [];
  const [selectedProductId, setSelectedProductId] = useState(promoProducts[0]?.id || "");
  const [shippingAddress, setShippingAddress] = useState("");

  // MONTHLY: package numbers and boxes
  const monthlyMeta = pkg?.monthly_meta || null;
  const totalBoxes = Number(monthlyMeta?.total_boxes || 12);
  const purchasedBoxes = Array.isArray(monthlyMeta?.purchased_boxes)
    ? monthlyMeta.purchased_boxes.map((x) => Number(x))
    : [];
  const availableNumbers = Array.isArray(monthlyMeta?.available_numbers)
    ? monthlyMeta.available_numbers.map((x) => Number(x))
    : [1];
  const allowedNumber = Number(
    monthlyMeta?.current_package_number || availableNumbers?.[0] || 1
  );
  const [packageNumber, setPackageNumber] = useState(allowedNumber);
  const [selectedBoxes, setSelectedBoxes] = useState([]);

  const handleFile = (e) => {
    try {
      const f = e.target?.files?.[0];
      if (f) setFile(f);
    } catch {}
  };

  useEffect(() => {
    // Reset selections when package changes
    setSelectedProductId(promoProducts[0]?.id || "");
    const defNum = Number(pkg?.monthly_meta?.current_package_number || pkg?.monthly_meta?.available_numbers?.[0] || 1);
    setPackageNumber(defNum);
    setSelectedBoxes([]);
  }, [pkg?.id]); 

  const doSubmit = async () => {
    setErr("");
    if (!file) {
      setErr("Please attach a payment proof file (image/PDF).");
      return;
    }
    // MONTHLY: require at least one box selected
    if (isMonthly) {
      if (!packageNumber || !Array.isArray(selectedBoxes) || selectedBoxes.length === 0) {
        setErr("Please select at least one box.");
        return;
      }
    }
    if (isPrime750 && !selectedProductId) {
      setErr("Please select a product for the ₹750 promo package.");
      return;
    }
    try {
      setSubmitting(true);
      if (isMonthly) {
        await onSubmit({
          package_id: pkg.id,
          package_number: packageNumber,
          boxes: selectedBoxes.slice(),
          file,
        });
      } else {
        await onSubmit({
          package_id: pkg.id,
          quantity: qty,
          year: null,
          month: null,
          file,
          ...(isPrime750
            ? {
                selected_product_id: selectedProductId,
                shipping_address: shippingAddress,
              }
            : {}),
        });
      }
      setFile(null);
      setMonth(null);
      if (isMonthly) setSelectedBoxes([]);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to submit.";
      setErr(String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper elevation={1} sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider", height: "100%", display: "flex", flexDirection: "column", gap: 1.25 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {pkg.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Code: {pkg.code} • Type: {pkg.type}
          </Typography>
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 900, color: "#0C2D48" }}>
          ₹{price.toLocaleString("en-IN")}
        </Typography>
      </Stack>

      {pkg.description ? (
        <Typography variant="body2" color="text.secondary">
          {pkg.description}
        </Typography>
      ) : null}

      <Divider sx={{ my: 1 }} />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography variant="caption" color="text.secondary">
            Pay using QR / UPI
          </Typography>
          <Box sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            {pkg.payment_qr ? (
              <Box
                component="img"
                src={normalizeMediaUrl(pkg.payment_qr)}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "https://via.placeholder.com/120?text=QR"; }}
                alt="Payment QR"
                sx={{
                  width: 120,
                  height: 120,
                  objectFit: "contain",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "#fff",
                }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                QR not set by Admin
              </Typography>
            )}
            <Box sx={{ minWidth: 180 }}>
              <Typography variant="caption" color="text.secondary">UPI ID</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {pkg.upi_id || "-"}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                <Tooltip title="Attach your payment proof and submit. Admin will approve to activate your package.">
                  <InfoOutlinedIcon fontSize="small" color="action" />
                </Tooltip>
                <Typography variant="caption" color="text.secondary">
                  Admin approval required to activate
                </Typography>
              </Stack>
            </Box>
          </Box>
        </Box>

        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography variant="caption" color="text.secondary">Payment proof</Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <Button
              component="label"
              size="small"
              startIcon={<CloudUploadIcon />}
              variant="outlined"
              sx={{ textTransform: "none" }}
            >
              {file ? "Change file" : "Attach file"}
              <input type="file" hidden accept="image/*,application/pdf" onChange={handleFile} />
            </Button>
            {file ? (
              <Typography variant="caption" color="text.secondary">
                {file.name}
              </Typography>
            ) : null}
          </Stack>

          {!isMonthly ? (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">Quantity</Typography>
              <TextField
                size="small"
                type="number"
                value={qty}
                onChange={(e) => {
                  const v = parseInt(e.target.value || "1", 10);
                  setQty(Number.isFinite(v) ? Math.max(1, v) : 1);
                }}
                inputProps={{ min: 1 }}
                sx={{ width: 120, mt: 0.5 }}
              />
            </Box>
          ) : (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">Package</Typography>
              <TextField
                select
                size="small"
                value={packageNumber}
                onChange={(e) => setPackageNumber(Number(e.target.value))}
                sx={{ width: 160, mt: 0.5 }}
                helperText="Only the current package is enabled"
              >
                {availableNumbers.map((n) => (
                  <MenuItem key={n} value={n} disabled={Number(n) !== Number(allowedNumber)}>
                    Package #{n}
                  </MenuItem>
                ))}
              </TextField>

              <Typography variant="caption" color="text.secondary" sx={{ mt: 1.25, display: "block" }}>
                Select boxes (paid boxes disabled)
              </Typography>
              <BoxGrid
                total={totalBoxes}
                purchased={purchasedBoxes}
                selected={selectedBoxes}
                onToggle={(b) => {
                  if (purchasedBoxes.includes(b)) return;
                  setSelectedBoxes((prev) => {
                    const set = new Set(prev);
                    if (set.has(b)) set.delete(b); else set.add(b);
                    return Array.from(set).sort((a, b) => a - b);
                  });
                }}
              />
            </Box>
          )}

          {isPrime750 ? (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary">Select Product</Typography>
              <Grid container spacing={1} sx={{ mt: 0.5 }}>
                {promoProducts.map((p) => (
                  <Grid item xs={6} sm={4} md={4} key={p.id}>
                    <Paper
                      elevation={selectedProductId === p.id ? 2 : 0}
                      onClick={() => setSelectedProductId(p.id)}
                      sx={{
                        p: 1,
                        cursor: "pointer",
                        borderRadius: 2,
                        border: "2px solid",
                        borderColor: selectedProductId === p.id ? "primary.main" : "divider",
                        textAlign: "center",
                      }}
                    >
                      <Box
                        component="img"
                        src={normalizeMediaUrl(p.image_url)}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          const fb = cloudinaryBackendFallback(p.image_url);
                          e.currentTarget.src = fb || "https://via.placeholder.com/200x120?text=No+Image";
                        }}
                        alt={p.name || "Product"}
                        sx={{ width: "100%", height: 120, objectFit: "contain", bgcolor: "#fff" }}
                      />
                      <Typography variant="body2" sx={{ mt: 0.5, fontWeight: selectedProductId === p.id ? 700 : 500 }}>
                        {p.name}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                Shipping address
              </Typography>
              <TextField
                multiline
                minRows={2}
                size="small"
                placeholder="House/Street, City, Pincode"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                sx={{ width: "100%", maxWidth: 400, mt: 0.5 }}
              />
            </Box>
          ) : null}

          {/* Monthly month selection replaced by boxes flow */}

          {err ? <Alert severity="error" sx={{ mt: 1 }}>{err}</Alert> : null}

          <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
            <Button
              variant="contained"
              startIcon={<PublishedWithChangesIcon />}
              disabled={submitting || !file || (isMonthly ? selectedBoxes.length === 0 : (Number(qty) || 0) <= 0)}
              onClick={doSubmit}
              sx={{ textTransform: "none" }}
            >
              {submitting ? "Submitting..." : "Submit Payment"}
            </Button>
            <Button
              variant="outlined"
              disabled={(isMonthly ? selectedBoxes.length === 0 : (Number(qty) || 0) <= 0)}
              onClick={() => {
                if (onAddToCart) {
                  if (isMonthly) {
                    onAddToCart({
                      package: pkg,
                      package_number: packageNumber,
                      boxes: selectedBoxes.slice(),
                      // quantity derived by API from boxes.length; store for display as well
                      quantity: selectedBoxes.length,
                    });
                  } else {
                    onAddToCart({
                      package: pkg,
                      quantity: Math.max(1, parseInt(qty || 1, 10)),
                      selected_product_id: isPrime750 ? selectedProductId : null,
                      shipping_address: isPrime750 ? shippingAddress : "",
                    });
                  }
                  try { window.alert("Added to cart."); } catch {}
                }
              }}
              sx={{ textTransform: "none" }}
            >
              Add to Cart
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

export default function PromoPackages() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [pkgs, setPkgs] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [pErr, setPErr] = useState("");
  const [pLoading, setPLoading] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const selectedFilter = useMemo(() => {
    try {
      const params = new URLSearchParams(location.search || "");
      return String(params.get("pkg") || "").toLowerCase();
    } catch {
      return "";
    }
  }, [location.search]);

  const filteredPkgs = useMemo(() => {
    const list = pkgs || [];
    if (selectedFilter === "monthly") {
      return list.filter((p) => String(p.type) === "MONTHLY");
    }
    if (selectedFilter === "prime150") {
      return list.filter((p) => {
        const price = Number(p.price || 0);
        const name = String(p.name || "").toLowerCase();
        const code = String(p.code || "").toLowerCase();
        return String(p.type) === "PRIME" && (Math.abs(price - 150) < 0.5 || name.includes("150") || code.includes("150"));
      });
    }
    if (selectedFilter === "prime750") {
      return list.filter((p) => {
        const price = Number(p.price || 0);
        const name = String(p.name || "").toLowerCase();
        const code = String(p.code || "").toLowerCase();
        return String(p.type) === "PRIME" && (Math.abs(price - 750) < 0.5 || name.includes("750") || code.includes("750"));
      });
    }
    return list.slice();
  }, [pkgs, selectedFilter]);

  const cartTotal = useMemo(
    () => (cartItems || []).reduce((sum, it) => sum + Number(it?.pkg?.price || 0) * (Number(it?.quantity) || 0), 0),
    [cartItems]
  );

  const loadPkgs = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await getPromoPackages();
      const list = Array.isArray(res) ? res : (res?.results || []);
      setPkgs(list || []);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to load packages.");
      setPkgs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPurchases = async () => {
    setPLoading(true);
    setPErr("");
    try {
      const res = await listMyPromoPurchases();
      const list = Array.isArray(res) ? res : (res?.results || []);
      setPurchases(list || []);
    } catch (e) {
      setPErr(e?.response?.data?.detail || e?.message || "Failed to load purchases.");
      setPurchases([]);
    } finally {
      setPLoading(false);
    }
  };

  useEffect(() => {
    loadPkgs();
    loadPurchases();
  }, []);

  // Promo Cart helpers
  const addToCart = ({
    package: pkg,
    quantity = 1,
    selected_product_id = null,
    shipping_address = "",
    // Monthly
    package_number = null,
    boxes = [],
  }) => {
    try {
      const isMonthly = String(pkg?.type || "") === "MONTHLY";
      const boxesArr = Array.isArray(boxes) ? boxes.map((x) => Number(x)).filter((x) => Number.isFinite(x)) : [];
      const boxesKey = boxesArr.length ? boxesArr.slice().sort((a, b) => a - b).join(".") : "";
      const key = isMonthly
        ? `${pkg?.id || "pkg"}-pkg${package_number || ""}-b:${boxesKey}`
        : `${pkg?.id || "pkg"}-${selected_product_id || ""}`;

      setCartItems((prev) => {
        const idx = prev.findIndex((x) => x.key === key);
        if (idx >= 0) {
          const next = [...prev];
          if (isMonthly) {
            // For monthly, boxes are explicit; merge selections
            const prevBoxes = Array.isArray(next[idx].boxes) ? next[idx].boxes : [];
            const merged = Array.from(new Set([...prevBoxes, ...boxesArr])).sort((a, b) => a - b);
            next[idx] = {
              ...next[idx],
              boxes: merged,
              quantity: merged.length,
            };
          } else {
            const curQty = Math.max(1, parseInt(next[idx].quantity || "1", 10));
            next[idx] = { ...next[idx], quantity: curQty + Math.max(1, parseInt(quantity || "1", 10)) };
          }
          return next;
        }
        return [
          ...prev,
          {
            key,
            pkg,
            // PRIME
            quantity: isMonthly ? boxesArr.length || 1 : Math.max(1, parseInt(quantity || "1", 10)),
            selected_product_id,
            shipping_address,
            // MONTHLY
            package_number: isMonthly ? package_number : null,
            boxes: isMonthly ? boxesArr : [],
            // Common
            file: null,
          },
        ];
      });
    } catch {}
  };
  const updateCartQty = (key, qty) => {
    setCartItems((prev) =>
      prev.map((x) =>
        x.key === key
          ? { ...x, quantity: Math.max(1, parseInt(qty || "1", 10)) }
          : x
      )
    );
  };
  const setCartItemFile = (key, file) => {
    setCartItems((prev) => prev.map((x) => (x.key === key ? { ...x, file } : x)));
  };
  const removeCartItem = (key) => setCartItems((prev) => prev.filter((x) => x.key !== key));
  const clearCart = () => setCartItems([]);
  const checkoutCart = async () => {
    if (!cartItems.length) {
      try { window.alert("Cart is empty."); } catch {}
      return;
    }
    setCheckingOut(true);
    const results = [];
    for (const it of cartItems) {
      try {
        await createPromoPurchase({
          package_id: it.pkg.id,
          quantity: it.quantity,
          file: it.file,
          selected_product_id: it.selected_product_id ?? null,
          shipping_address: it.shipping_address || "",
          // Monthly flow (if present on item)
          package_number: it.package_number ?? null,
          boxes: Array.isArray(it.boxes) ? it.boxes : [],
        });
        results.push({ key: it.key, ok: true });
      } catch (e) {
        results.push({ key: it.key, ok: false, msg: e?.response?.data?.detail || e?.message || "Submission failed." });
      }
    }
    const success = results.filter((r) => r.ok).length;
    const failed = results.length - success;
    try {
      window.alert(`Submitted ${success} item(s).${failed > 0 ? ` Failed ${failed}.` : ""}`);
    } catch {}
    // Remove successful ones
    setCartItems((prev) => prev.filter((x) => !results.some((r) => r.key === x.key && r.ok)));
    setCheckingOut(false);
    await loadPurchases();
  };

  const onSubmit = async ({
    package_id,
    quantity = 1,
    year = null,
    month = null,
    file = null,
    selected_product_id = null,
    shipping_address = "",
    // Monthly boxes flow
    package_number = null,
    boxes = [],
  }) => {
    await createPromoPurchase({
      package_id,
      quantity,
      year,
      month,
      file,
      selected_product_id,
      shipping_address,
      package_number,
      boxes,
    });
    try {
      window.alert("Payment submitted. Awaiting admin approval.");
    } catch {}
    await loadPurchases();
  };

  const primePkgs = (pkgs || []).filter((p) => String(p.type) === "PRIME");
  const monthlyPkgs = (pkgs || []).filter((p) => String(p.type) === "MONTHLY");

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 800, color: "#0C2D48", mb: 2 }}>
        Promo Packages
      </Typography>

      {/* Reward Points */}
      <Box sx={{ mb: 2 }}>
        <RewardPointsCard />
      </Box>

      {/* Available Packages */}
      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, mb: 2, border: "1px solid", borderColor: "divider", bgcolor: "#fff" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
            Available Packages
          </Typography>
          {loading ? <Typography variant="body2" color="text.secondary">Loading...</Typography> : null}
        </Stack>
        {err ? <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert> : null}

        <Grid container spacing={2}>
          {filteredPkgs.map((pkg) => (
            <Grid item xs={12} md={6} key={pkg.id}>
              <PackageCard pkg={pkg} onSubmit={onSubmit} onAddToCart={addToCart} />
            </Grid>
          ))}
          {(!loading && filteredPkgs.length === 0) ? (
            <Grid item xs={12}>
              <Alert severity="info">No promo packages available for the selected type.</Alert>
            </Grid>
          ) : null}
        </Grid>
      </Paper>

      {/* Promo Cart */}
      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, mb: 2, border: "1px solid", borderColor: "divider", bgcolor: "#fff" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
            Promo Cart & Payment
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Total: ₹{Number(cartTotal || 0).toLocaleString("en-IN")}
          </Typography>
        </Stack>
        {cartItems.length === 0 ? (
          <Alert severity="info">Your cart is empty. Add packages above.</Alert>
        ) : (
          <Stack spacing={1.5}>
            {cartItems.map((it) => {
              const unit = Number(it?.pkg?.price || 0);
              const subtotal = unit * (Number(it.quantity) || 0);
              const isMonthly = String(it?.pkg?.type || "") === "MONTHLY";
              const monthLabel = null;
              const boxesArr = Array.isArray(it.boxes) ? it.boxes : [];
              return (
                <Paper key={it.key} elevation={0} sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                  <Grid container spacing={1}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{it.pkg?.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Type: {it.pkg?.type}{isMonthly ? ` • Package #${it.package_number || "-"}` : ""}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Typography variant="caption" color="text.secondary">Unit</Typography>
                      <Typography variant="body2">₹{unit.toLocaleString("en-IN")}</Typography>
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Typography variant="caption" color="text.secondary">{isMonthly ? "Boxes" : "Quantity"}</Typography>
                      {isMonthly ? (
                        <Typography variant="body2">{boxesArr.length} selected</Typography>
                      ) : (
                        <TextField
                          size="small"
                          type="number"
                          value={it.quantity}
                          onChange={(e) => updateCartQty(it.key, e.target.value)}
                          inputProps={{ min: 1 }}
                          sx={{ maxWidth: 140 }}
                        />
                      )}
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <Typography variant="caption" color="text.secondary">Subtotal</Typography>
                      <Typography variant="body2">₹{Number(subtotal).toLocaleString("en-IN")}</Typography>
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" color="error" onClick={() => removeCartItem(it.key)}>Remove</Button>
                      </Stack>
                    </Grid>
                    <Grid item xs={12}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Button component="label" size="small" variant="outlined">
                          {it.file ? "Change Payment Proof" : "Attach Payment Proof"}
                          <input
                            type="file"
                            hidden
                            accept="image/*,application/pdf"
                            onChange={(e) => setCartItemFile(it.key, e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                          />
                        </Button>
                        {it.file ? <Typography variant="caption" color="text.secondary">{it.file.name}</Typography> : null}
                      </Stack>
                    </Grid>
                  </Grid>
                </Paper>
              );
            })}
            <Divider />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
              <Button
                variant="contained"
                onClick={checkoutCart}
                disabled={checkingOut || cartItems.length === 0}
                sx={{ textTransform: "none" }}
              >
                {checkingOut ? "Submitting..." : "Submit for Approval"}
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate("/user/redeem-coupon")}
                sx={{ textTransform: "none" }}
              >
                Go to E‑Coupons
              </Button>
              <Button
                size="small"
                onClick={clearCart}
                disabled={cartItems.length === 0 || checkingOut}
              >
                Clear Cart
              </Button>
            </Stack>
          </Stack>
        )}
      </Paper>

      {/* My Purchases */}
      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, mb: 2, border: "1px solid", borderColor: "divider", bgcolor: "#fff" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
            My Purchases
          </Typography>
          {pLoading ? <Typography variant="body2" color="text.secondary">Loading...</Typography> : null}
        </Stack>
        {pErr ? <Alert severity="error" sx={{ mb: 1 }}>{pErr}</Alert> : null}
        <Grid container spacing={2}>
          {(purchases || []).map((pp) => {
            const status = String(pp.status || "");
            const color =
              status === "APPROVED" ? "success.main" :
              status === "REJECTED" ? "error.main" :
              status === "CANCELLED" ? "text.secondary" : "warning.main";
            const activeRange = (pp.active_from || pp.active_to) ? `${pp.active_from || "-"} → ${pp.active_to || "-"}` : "-";
            return (
              <Grid item xs={12} md={6} key={pp.id}>
                <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        {pp?.package?.name} <Typography component="span" variant="caption" color="text.secondary">({pp?.package?.type})</Typography>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Paid: ₹{Number(pp.amount_paid || 0).toLocaleString("en-IN")}</Typography>
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 800, color }}>
                      {status}
                    </Typography>
                  </Stack>
                  <Divider sx={{ my: 1 }} />
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Requested</Typography>
                      <Typography variant="body2">{pp.requested_at ? dayjs(pp.requested_at).format("YYYY-MM-DD HH:mm") : "-"}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Approved</Typography>
                      <Typography variant="body2">{pp.approved_at ? dayjs(pp.approved_at).format("YYYY-MM-DD HH:mm") : "-"}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Quantity</Typography>
                      <Typography variant="body2">{pp.quantity || 1}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Product</Typography>
                      <Typography variant="body2">{pp.selected_product_name || "-"}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Delivery By</Typography>
                      <Typography variant="body2">{pp.delivery_by || "-"}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Shipping Address</Typography>
                      <Typography variant="body2">{pp.shipping_address || "-"}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Active Period</Typography>
                      <Typography variant="body2">{activeRange}</Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            );
          })}
          {(!pLoading && purchases && purchases.length === 0) ? (
            <Grid item xs={12}>
              <Alert severity="info">No purchases yet. Buy a package above to get started.</Alert>
            </Grid>
          ) : null}
        </Grid>
      </Paper>
    </Box>
  );
}
