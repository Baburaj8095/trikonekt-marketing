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
  TextField,
  MenuItem,
  Radio,
  RadioGroup,
  FormControlLabel,
  Chip,
} from "@mui/material";
import dayjs from "dayjs";
import API, { getPromoPackages, listMyPromoPurchases } from "../api/api";
import RewardPointsCard from "../components/RewardPointsCard";
import { useNavigate, useLocation } from "react-router-dom";
import normalizeMediaUrl from "../utils/media";
import { addPromoPackagePrime, addPromoPackageMonthly } from "../store/cart";

// If a Cloudinary URL 404s (asset not uploaded), fall back to backend /media path.
function cloudinaryBackendFallback(url) {
  try {
    if (!url || typeof url !== "string") return "";
    const u = new URL(url);
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

function approx(a, b, eps = 0.5) {
  return Math.abs(Number(a) - Number(b)) < eps;
}

function inferPlanKind(pkg) {
  const type = String(pkg?.type || "");
  const price = Number(pkg?.price || 0);
  if (type === "PRIME" && approx(price, 150)) return "PRIME150";
  if (type === "PRIME" && approx(price, 750)) return "PRIME750";
  if (type === "MONTHLY") return "MONTHLY";
  return "OTHER";
}

function getPlanOptions(kind) {
  switch (kind) {
    case "PRIME150":
      return ["E-Book", "Redeem"];
    case "PRIME750":
      return ["Products", "Redeem", "E-Coupon"];
    case "MONTHLY":
      return [
        "Electronic Product",
        "Home Appliance Product",
        "Furniture Product",
        "Travel & Tourism",
      ];
    default:
      return [];
  }
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

function SelectList({ items = [] }) {
  if (!items.length) return null;
  return (
    <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
      {items.map((it, idx) => (
        <Chip key={idx} size="small" variant="outlined" label={it} />
      ))}
    </Stack>
  );
}

function PackageCard({ pkg, onAddToCart }) {
  const MEDIA_BASE = useMediaBase();
  // Quantity input (buffer) for PRIME packages only
  const [qtyInput, setQtyInput] = useState("1");

  const isMonthly = String(pkg?.type || "") === "MONTHLY";
  const price = Number(pkg?.price || 0);
  const kind = inferPlanKind(pkg);
  const selectOptions = getPlanOptions(kind);

  const isPrime150 =
    String(pkg?.type || "") === "PRIME" &&
    Math.abs(Number(pkg?.price || 0) - 150) < 0.5;
  const [prime150Choice, setPrime150Choice] = useState("EBOOK");

  const isPrime750 =
    String(pkg?.type || "") === "PRIME" &&
    Math.abs(Number(pkg?.price || 0) - 750) < 0.5;
  const [prime750Choice, setPrime750Choice] = useState("PRODUCT");

  // PRIME 750 product selection
  const promoProducts = Array.isArray(pkg?.promo_products)
    ? pkg.promo_products
    : [];
  const [selectedProductId, setSelectedProductId] = useState(
    promoProducts[0]?.id || ""
  );
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

  const [showConfig, setShowConfig] = useState(false);

  // Navigate to Promo Products page when needed (role-aware path)
  const navigate = useNavigate();
  const location = useLocation();
  const promoProductsPath = useMemo(() => {
    try {
      const p = location.pathname || "";
      if (p.startsWith("/agency")) return "/agency/trikonekt-products";
      if (p.startsWith("/employee")) return "/employee/trikonekt-products";
      return "/trikonekt-products";
    } catch {
      return "/trikonekt-products";
    }
  }, [location.pathname]);

  useEffect(() => {
    // Reset selections when package changes
    setSelectedProductId(promoProducts[0]?.id || "");
    const defNum = Number(
      pkg?.monthly_meta?.current_package_number ||
        pkg?.monthly_meta?.available_numbers?.[0] ||
        1
    );
    setPackageNumber(defNum);
    setSelectedBoxes([]);
    setQtyInput("1");
    setPrime150Choice("EBOOK");
    setPrime750Choice("PRODUCT");
  }, [pkg?.id]);

  const commitQty = () => {
    let q = parseInt(qtyInput, 10);
    if (!Number.isFinite(q) || q < 1) q = 1;
    setQtyInput(String(q));
    return q;
  };

  const accentColor =
    kind === "PRIME150"
      ? "#0C2D48"
      : kind === "PRIME750"
      ? "#5E35B1"
      : kind === "MONTHLY"
      ? "#EF6C00"
      : "divider";

  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        borderLeft: 6,
        borderLeftStyle: "solid",
        borderLeftColor: accentColor,
        background:
          kind === "PRIME150"
            ? "linear-gradient(180deg, rgba(12,45,72,0.06) 0%, rgba(12,45,72,0.02) 100%)"
            : kind === "PRIME750"
            ? "linear-gradient(180deg, rgba(94,53,177,0.06) 0%, rgba(94,53,177,0.02) 100%)"
            : kind === "MONTHLY"
            ? "linear-gradient(180deg, rgba(239,108,0,0.06) 0%, rgba(239,108,0,0.02) 100%)"
            : "linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0) 100%)",
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {pkg.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Code: {pkg.code} • Type: {pkg.type}
          </Typography>
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>
            Price
          </Typography>
          <Box
            sx={{
              display: "inline-block",
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              bgcolor: accentColor,
              color: "#fff",
              fontWeight: 900,
              fontSize: 18,
              lineHeight: 1.2,
            }}
          >
            ₹{price.toLocaleString("en-IN")}
          </Box>
        </Box>
      </Stack>

      {pkg.description ? (
        <Typography variant="body2" color="text.secondary">
          {pkg.description}
        </Typography>
      ) : null}

      <Typography variant="caption" color="text.secondary">Select</Typography>

      <SelectList items={selectOptions} />

      <Divider sx={{ my: 1 }} />

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        {isMonthly ? (
          <Typography variant="caption" color="text.secondary">
            {selectedBoxes.length ? `${selectedBoxes.length} box(es) selected` : "Tap Configure to choose boxes"}
          </Typography>
        ) : <span />}
        <Button size="small" variant="text" onClick={() => setShowConfig(v => !v)} sx={{ textTransform: "none" }}>
          {showConfig ? "Hide" : "Configure"}
        </Button>
      </Box>

      {/* Configuration section - kept for functionality but visually lightweight */}
      {showConfig ? (
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          {!isMonthly ? (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Quantity
              </Typography>
              <TextField
                size="small"
                type="number"
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                onBlur={commitQty}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitQty();
                    try {
                      e.currentTarget.blur();
                    } catch {}
                  }
                }}
                inputProps={{ min: 1 }}
                sx={{ width: 120, mt: 0.5 }}
              />
            </Box>
          ) : (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Package
              </Typography>
              <TextField
                select
                size="small"
                value={packageNumber}
                onChange={(e) => setPackageNumber(Number(e.target.value))}
                sx={{ width: 160, mt: 0.5 }}
                helperText="Only the current package is enabled"
              >
                {availableNumbers.map((n) => (
                  <MenuItem
                    key={n}
                    value={n}
                    disabled={Number(n) !== Number(allowedNumber)}
                  >
                    Package #{n}
                  </MenuItem>
                ))}
              </TextField>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1.25, display: "block" }}
              >
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
                    if (set.has(b)) set.delete(b);
                    else set.add(b);
                    return Array.from(set).sort((a, b) => a - b);
                  });
                }}
              />
            </Box>
          )}

          {isPrime150 ? (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary">Select</Typography>
              <RadioGroup
                row
                value={prime150Choice}
                onChange={(e) => setPrime150Choice(e.target.value)}
              >
                <FormControlLabel value="EBOOK" control={<Radio size="small" />} label="E-Book" />
                <FormControlLabel value="REDEEM" control={<Radio size="small" />} label="Redeem" />
              </RadioGroup>
              <Typography variant="caption" color="text.secondary">
                Choose E‑Book to access it in your dashboard or Redeem to follow e‑coupon allocation flow with reward credit.
              </Typography>
            </Box>
          ) : null}

          {isPrime750 ? (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary">Select</Typography>
              <RadioGroup
                row
                value={prime750Choice}
                onChange={(e) => {
                  const val = e.target.value;
                  setPrime750Choice(val);
                  if (val === "PRODUCT") {
                    navigate(promoProductsPath);
                  }
                }}
              >
                <FormControlLabel value="PRODUCT" control={<Radio size="small" />} label="Products" />
                <FormControlLabel value="REDEEM" control={<Radio size="small" />} label="Redeem" />
                <FormControlLabel value="COUPON" control={<Radio size="small" />} label="E‑Coupon" />
              </RadioGroup>

              {prime750Choice === "PRODUCT" ? (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Redirecting to Promo Products to select an item.
                </Alert>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  {prime750Choice === "REDEEM"
                    ? "You will receive e‑coupon allocation on approval."
                    : "You will be eligible for Lucky Draw on approval."}
                </Typography>
              )}
            </Box>
          ) : null}

          <Alert severity="info" sx={{ mt: 1 }}>
            Payment will be done at Checkout. Add items to the central cart.
          </Alert>

          <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
            <Button
              variant="outlined"
              onClick={() => {
                if (onAddToCart) {
                  if (isMonthly) {
                    if (!selectedBoxes || selectedBoxes.length === 0) {
                      try { window.alert("Please tap Configure and select at least one box."); } catch {}
                      setShowConfig(true);
                      return;
                    }
                    onAddToCart({
                      package: pkg,
                      package_number: packageNumber,
                      boxes: selectedBoxes.slice(),
                      quantity: selectedBoxes.length,
                    });
                  } else {
                    const q = Math.max(1, parseInt(qtyInput || "1", 10));

                    // PRIME 750 PRODUCT flow: browse Promo Products page instead of in-card selection
                    if (isPrime750 && prime750Choice === "PRODUCT") {
                      try { window.alert("Browse Promo Products to select an item."); } catch {}
                      navigate(promoProductsPath);
                      return;
                    }

                    onAddToCart({
                      package: pkg,
                      quantity: q,
                      selected_product_id: isPrime750 && prime750Choice === "PRODUCT" ? selectedProductId : null,
                      shipping_address: isPrime750 && prime750Choice === "PRODUCT" ? shippingAddress : "",
                      prime150_choice: isPrime150 ? (prime150Choice || "EBOOK") : null,
                      prime750_choice: isPrime750 ? prime750Choice : null,
                    });
                  }
                  try {
                    window.alert("Added to cart.");
                  } catch {}
                }
              }}
              sx={{ textTransform: "none" }}
            >
              Add to Cart
            </Button>
          </Stack>
        </Box>
      </Stack>
      ) : null}
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
  const navigate = useNavigate();
  const location = useLocation();
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
    () =>
      roleHint === "agency"
        ? "/agency/cart"
        : roleHint === "employee"
        ? "/employee/cart"
        : "/user/cart",
    [roleHint]
  );
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
        return (
          String(p.type) === "PRIME" &&
          (Math.abs(price - 150) < 0.5 ||
            name.includes("150") ||
            code.includes("150"))
        );
      });
    }
    if (selectedFilter === "prime750") {
      return list.filter((p) => {
        const price = Number(p.price || 0);
        const name = String(p.name || "").toLowerCase();
        const code = String(p.code || "").toLowerCase();
        return (
          String(p.type) === "PRIME" &&
          (Math.abs(price - 750) < 0.5 ||
            name.includes("750") ||
            code.includes("750"))
        );
      });
    }
    return list.slice();
  }, [pkgs, selectedFilter]);

  const loadPkgs = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await getPromoPackages();
      const list = Array.isArray(res) ? res : res?.results || [];
      setPkgs(list || []);
    } catch (e) {
      setErr(
        e?.response?.data?.detail || e?.message || "Failed to load packages."
      );
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
      const list = Array.isArray(res) ? res : res?.results || [];
      setPurchases(list || []);
    } catch (e) {
      setPErr(
        e?.response?.data?.detail || e?.message || "Failed to load purchases."
      );
      setPurchases([]);
    } finally {
      setPLoading(false);
    }
  };

  useEffect(() => {
    loadPkgs();
    loadPurchases();
  }, []);

  // Add to centralized cart
  const addToCart = ({
    package: pkg,
    quantity = 1,
    selected_product_id = null,
    shipping_address = "",
    prime150_choice = null,
    prime750_choice = null,
    // Monthly
    package_number = null,
    boxes = [],
  }) => {
    try {
      const isMonthly = String(pkg?.type || "") === "MONTHLY";
      if (isMonthly) {
        addPromoPackageMonthly({
          pkgId: pkg?.id,
          name: pkg?.name,
          unitPrice: Number(pkg?.price || 0),
          package_number,
          boxes: Array.isArray(boxes) ? boxes : [],
        });
      } else {
        addPromoPackagePrime({
          pkgId: pkg?.id,
          name: pkg?.name,
          unitPrice: Number(pkg?.price || 0),
          qty: Math.max(1, parseInt(quantity || "1", 10)),
          selected_product_id: selected_product_id ?? null,
          shipping_address: shipping_address || "",
          prime150_choice: prime150_choice || null,
          prime750_choice: prime750_choice || null,
        });
      }
      try {
        window.alert("Added to cart.");
      } catch {}
    } catch {}
  };

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
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1 }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
            Available Packages
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button size="small" variant="outlined" onClick={() => navigate(
              roleHint === "agency"
                ? "/agency/cart"
                : roleHint === "employee"
                ? "/employee/cart"
                : "/user/cart"
            )}>
              Open Centralized Cart
            </Button>
            {loading ? (
              <Typography variant="body2" color="text.secondary">
                Loading...
              </Typography>
            ) : null}
          </Stack>
        </Stack>
        {err ? (
          <Alert severity="error" sx={{ mb: 1 }}>
            {err}
          </Alert>
        ) : null}

        <Grid container spacing={2}>
          {(filteredPkgs || []).map((pkg) => (
            <Grid item xs={12} md={6} key={pkg.id}>
              <PackageCard pkg={pkg} onAddToCart={addToCart} />
            </Grid>
          ))}
          {!loading && (filteredPkgs || []).length === 0 ? (
            <Grid item xs={12}>
              <Alert severity="info">
                No promo packages available for the selected type.
              </Alert>
            </Grid>
          ) : null}
        </Grid>
      </Paper>

      {/* My Purchases */}
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
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1 }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
            My Purchases
          </Typography>
          {pLoading ? (
            <Typography variant="body2" color="text.secondary">
              Loading...
            </Typography>
          ) : null}
        </Stack>
        {pErr ? (
          <Alert severity="error" sx={{ mb: 1 }}>
            {pErr}
          </Alert>
        ) : null}
        <Grid container spacing={2}>
          {(purchases || []).map((pp) => {
            const status = String(pp.status || "");
            const color =
              status === "APPROVED"
                ? "success.main"
                : status === "REJECTED"
                ? "error.main"
                : status === "CANCELLED"
                ? "text.secondary"
                : "warning.main";
            const activeRange =
              pp.active_from || pp.active_to
                ? `${pp.active_from || "-"} → ${pp.active_to || "-"}`
                : "-";
            return (
              <Grid item xs={12} md={6} key={pp.id}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                  >
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        {pp?.package?.name}{" "}
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                        >
                          ({pp?.package?.type})
                        </Typography>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Paid: ₹
                        {Number(pp.amount_paid || 0).toLocaleString("en-IN")}
                      </Typography>
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 800, color }}
                    >
                      {status}
                    </Typography>
                  </Stack>
                  <Divider sx={{ my: 1 }} />
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Requested
                      </Typography>
                      <Typography variant="body2">
                        {pp.requested_at
                          ? dayjs(pp.requested_at).format("YYYY-MM-DD HH:mm")
                          : "-"}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Approved
                      </Typography>
                      <Typography variant="body2">
                        {pp.approved_at
                          ? dayjs(pp.approved_at).format("YYYY-MM-DD HH:mm")
                          : "-"}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Quantity
                      </Typography>
                      <Typography variant="body2">
                        {pp.quantity || 1}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">
                        Product
                      </Typography>
                      <Typography variant="body2">
                        {pp.selected_product_name || "-"}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Delivery By
                      </Typography>
                      <Typography variant="body2">
                        {pp.delivery_by || "-"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">
                        Shipping Address
                      </Typography>
                      <Typography variant="body2">
                        {pp.shipping_address || "-"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">
                        Active Period
                      </Typography>
                      <Typography variant="body2">{activeRange}</Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            );
          })}
          {!pLoading && purchases && purchases.length === 0 ? (
            <Grid item xs={12}>
              <Alert severity="info">
                No purchases yet. Add a package to cart and checkout.
              </Alert>
            </Grid>
          ) : null}
        </Grid>
      </Paper>
    </Box>
  );
}
