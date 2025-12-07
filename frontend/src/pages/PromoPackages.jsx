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
  Checkbox,
  FormGroup,
  IconButton,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import dayjs from "dayjs";
import { getPromoPackages, listMyPromoPurchases } from "../api/api";
import RewardPointsCard from "../components/RewardPointsCard";
import { useNavigate, useLocation } from "react-router-dom";
import normalizeMediaUrl from "../utils/media";
import { addPromoPackagePrime, addPromoPackageMonthly } from "../store/cart";
import QuickViewModal from "../components/market/QuickViewModal";

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

function getPkgImageUrl(pkg) {
  const candidates = [
    pkg?.image,
    pkg?.banner,
    pkg?.thumbnail,
    pkg?.image_url,
    pkg?.cover,
  ].filter(Boolean);
  if (!candidates.length) return "";
  const url = String(candidates[0]);
  // If it's a Cloudinary URL, we may fallback; else normalize relative path.
  const fallback = cloudinaryBackendFallback(url);
  return fallback || normalizeMediaUrl(url);
}

/**
 * Modern ecommerce-style PackageCard
 * - Visual only changes; business logic unchanged
 */
function PackageCard({ pkg, onAddToCart, onOpenDetail }) {
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

  // price and discount visuals (if backend provides discount_price)
  const discountPrice =
    pkg && pkg.discount_price != null ? Number(pkg.discount_price) : null;
  const hasDiscount =
    typeof discountPrice === "number" &&
    isFinite(discountPrice) &&
    discountPrice > 0 &&
    discountPrice < price;

  const imgUrl = getPkgImageUrl(pkg);

  return (
    <Paper
      elevation={0}
      className="rounded-xl shadow-md hover:shadow-lg transition-transform hover:-translate-y-0.5"
      sx={{
        position: "relative",
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#fff",
      }}
    >
      {/* Image / Quick view */}
      <Box sx={{ position: "relative" }}>
        <Box
          onClick={() => typeof onOpenDetail === "function" && onOpenDetail(pkg)}
          sx={{
            width: "100%",
            aspectRatio: "4 / 3",
            bgcolor: "#f8fafc",
            cursor: "pointer",
            overflow: "hidden",
          }}
        >
          {imgUrl ? (
            <Box
              component="img"
              src={imgUrl}
              alt={pkg?.name || "Promo Package"}
              loading="lazy"
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                transition: "transform 0.25s ease",
                "&:hover": { transform: "scale(1.02)" },
              }}
            />
          ) : (
            <Box sx={{ width: "100%", height: "100%", bgcolor: "#f1f5f9" }} />
          )}
        </Box>

        {/* Optional quick view icon */}
        <IconButton
          size="small"
          onClick={() =>
            typeof onOpenDetail === "function" && onOpenDetail(pkg)
          }
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            bgcolor: "rgba(255,255,255,0.9)",
            "&:hover": { bgcolor: "rgba(255,255,255,1)" },
          }}
        >
          <VisibilityOutlinedIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Box sx={{ pr: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 800,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                minHeight: 36,
              }}
              title={pkg?.name}
            >
              {pkg.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Code: {pkg.code} • Type: {pkg.type}
            </Typography>
          </Box>

          <Box sx={{ textAlign: "right", minWidth: 110 }}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ lineHeight: 1 }}
            >
              Price
            </Typography>
            <Stack direction="row" spacing={1} alignItems="baseline" sx={{ justifyContent: "flex-end" }}>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 900,
                  color: "#0f172a",
                }}
              >
                ₹{(hasDiscount ? discountPrice : price).toLocaleString("en-IN")}
              </Typography>
              {hasDiscount && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ textDecoration: "line-through", fontWeight: 700 }}
                >
                  ₹{price.toLocaleString("en-IN")}
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>

        {pkg.description ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              minHeight: 48,
            }}
          >
            {pkg.description}
          </Typography>
        ) : null}

        {/* Feature chips */}
        <SelectList items={selectOptions} />

        <Divider sx={{ my: 1 }} />

        {/* Actions: Configure + Add to Cart */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 0.5 }}
        >
          {isMonthly ? (
            <Typography variant="caption" color="text.secondary">
              {selectedBoxes.length
                ? `${selectedBoxes.length} box(es) selected`
                : "Tap Configure to choose boxes"}
            </Typography>
          ) : (
            <span />
          )}
          <Button
            size="small"
            variant="text"
            onClick={() => setShowConfig((v) => !v)}
            sx={{ textTransform: "none" }}
          >
            {showConfig ? "Hide" : "Configure"}
          </Button>
        </Stack>

        {/* Configuration section (unchanged logic, visually collapsed by default) */}
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
                  <Typography variant="caption" color="text.secondary">
                    Select
                  </Typography>
                  <RadioGroup
                    row
                    value={prime150Choice}
                    onChange={(e) => setPrime150Choice(e.target.value)}
                  >
                    <FormControlLabel
                      value="EBOOK"
                      control={<Radio size="small" />}
                      label="E-Book"
                    />
                    <FormControlLabel
                      value="REDEEM"
                      control={<Radio size="small" />}
                      label="Redeem"
                    />
                  </RadioGroup>
                  <Typography variant="caption" color="text.secondary">
                    Choose E‑Book to access it in your dashboard or Redeem to
                    follow e‑coupon allocation flow with reward credit.
                  </Typography>
                </Box>
              ) : null}

              {isPrime750 ? (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Select
                  </Typography>
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
                    <FormControlLabel
                      value="PRODUCT"
                      control={<Radio size="small" />}
                      label="Products"
                    />
                    <FormControlLabel
                      value="REDEEM"
                      control={<Radio size="small" />}
                      label="Redeem"
                    />
                    <FormControlLabel
                      value="COUPON"
                      control={<Radio size="small" />}
                      label="E‑Coupon"
                    />
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
                          try {
                            window.alert(
                              "Please tap Configure and select at least one box."
                            );
                          } catch {}
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
                        const q = Math.max(
                          1,
                          parseInt(qtyInput || "1", 10)
                        );

                        // PRIME 750 PRODUCT flow: browse Promo Products page instead of in-card selection
                        if (isPrime750 && prime750Choice === "PRODUCT") {
                          try {
                            window.alert(
                              "Browse Promo Products to select an item."
                            );
                          } catch {}
                          navigate(promoProductsPath);
                          return;
                        }

                        onAddToCart({
                          package: pkg,
                          quantity: q,
                          selected_product_id:
                            isPrime750 && prime750Choice === "PRODUCT"
                              ? selectedProductId
                              : null,
                          shipping_address:
                            isPrime750 && prime750Choice === "PRODUCT"
                              ? shippingAddress
                              : "",
                          prime150_choice: isPrime150
                            ? prime150Choice || "EBOOK"
                            : null,
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
      </Box>
      {/* Accent left border preserved subtly for plan kind */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          borderLeft: "6px solid",
          borderLeftColor: accentColor,
          opacity: 0.15,
        }}
      />
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

  const urlFilteredPkgs = useMemo(() => {
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

  // UI Filters + Sorting
  const [filterMonthly, setFilterMonthly] = useState(false);
  const [filterPrime150, setFilterPrime150] = useState(false);
  const [filterPrime750, setFilterPrime750] = useState(false);
  const [sortKey, setSortKey] = useState("newest"); // newest | price-asc | price-desc

  const applyCategoryFilter = useMemo(() => {
    const anySelected = filterMonthly || filterPrime150 || filterPrime750;
    if (!anySelected) return urlFilteredPkgs;
    return urlFilteredPkgs.filter((p) => {
      const type = String(p?.type || "");
      const price = Number(p?.price || 0);
      const name = String(p?.name || "").toLowerCase();
      const code = String(p?.code || "").toLowerCase();
      const isMonthly = type === "MONTHLY";
      const isPrime150 =
        type === "PRIME" &&
        (Math.abs(price - 150) < 0.5 ||
          name.includes("150") ||
          code.includes("150"));
      const isPrime750 =
        type === "PRIME" &&
        (Math.abs(price - 750) < 0.5 ||
          name.includes("750") ||
          code.includes("750"));
      return (
        (filterMonthly && isMonthly) ||
        (filterPrime150 && isPrime150) ||
        (filterPrime750 && isPrime750)
      );
    });
  }, [urlFilteredPkgs, filterMonthly, filterPrime150, filterPrime750]);

  const filteredSortedPkgs = useMemo(() => {
    const list = applyCategoryFilter.slice();
    if (sortKey === "price-asc") {
      return list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    }
    if (sortKey === "price-desc") {
      return list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }
    // newest: prefer created_at desc, else id desc
    return list.sort((a, b) => {
      const aCreated = a?.created_at ? new Date(a.created_at).getTime() : null;
      const bCreated = b?.created_at ? new Date(b.created_at).getTime() : null;
      if (aCreated != null && bCreated != null) return bCreated - aCreated;
      const aId = Number(a?.id || 0);
      const bId = Number(b?.id || 0);
      return bId - aId;
    });
  }, [applyCategoryFilter, sortKey]);

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

  // Add to centralized cart (unchanged business logic)
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

  // Quick view modal mapping
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickProduct, setQuickProduct] = useState(null);

  const openQuickView = (pkg) => {
    const price = Number(pkg?.price || 0);
    const discountPrice =
      pkg && pkg.discount_price != null ? Number(pkg.discount_price) : null;
    let discountPercent = 0;
    if (
      typeof discountPrice === "number" &&
      isFinite(discountPrice) &&
      discountPrice > 0 &&
      discountPrice < price &&
      price > 0
    ) {
      discountPercent = Math.round(((price - discountPrice) / price) * 100);
    }
    const mapped = {
      id: pkg?.id,
      name: pkg?.name,
      price,
      discount: discountPercent, // QuickViewModal expects a percent
      quantity: 999,
      image_url: getPkgImageUrl(pkg),
      description: pkg?.description || "",
      created_by_name: "", // not applicable
    };
    setQuickProduct(mapped);
    setQuickOpen(true);
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

      {/* Available Packages - Modern Ecommerce Layout */}
      <Paper
        elevation={0}
        className="rounded-xl shadow-md"
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 2,
          mb: 2,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "#fff",
        }}
      >
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
          {/* Left filter (sidebar) */}
          <Box
            sx={{
              width: { lg: 260 },
              flexShrink: 0,
              position: { lg: "sticky" },
              top: { lg: 16 },
              alignSelf: { lg: "flex-start" },
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              p: 2,
              bgcolor: "#ffffff",
            }}
            className="rounded-xl"
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
              Filters
            </Typography>
            <Divider sx={{ mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Category
            </Typography>
            <FormGroup sx={{ mt: 0.5 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={filterMonthly}
                    onChange={(e) => setFilterMonthly(e.target.checked)}
                  />
                }
                label="Monthly"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={filterPrime150}
                    onChange={(e) => setFilterPrime150(e.target.checked)}
                  />
                }
                label="Prime 150"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={filterPrime750}
                    onChange={(e) => setFilterPrime750(e.target.checked)}
                  />
                }
                label="Prime 750"
              />
            </FormGroup>
          </Box>

          {/* Right content */}
          <Box sx={{ flex: 1 }}>
            {/* Header row: title, cart, sort */}
            <Stack
              direction={{ xs: "column", md: "row" }}
              alignItems={{ xs: "flex-start", md: "center" }}
              justifyContent="space-between"
              spacing={1.5}
              sx={{ mb: 2 }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
                Available Packages
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ width: { xs: "100%", md: "auto" } }}>
                <TextField
                  select
                  size="small"
                  label="Sort by"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value)}
                  sx={{ minWidth: 200 }}
                >
                  <MenuItem value="newest">Newest First</MenuItem>
                  <MenuItem value="price-asc">Price: Low to High</MenuItem>
                  <MenuItem value="price-desc">Price: High to Low</MenuItem>
                </TextField>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => navigate(cartPath)}
                >
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
              {(filteredSortedPkgs || []).map((pkg) => (
                <Grid item xs={12} sm={6} md={4} xl={3} key={pkg.id}>
                  <PackageCard
                    pkg={pkg}
                    onAddToCart={addToCart}
                    onOpenDetail={openQuickView}
                  />
                </Grid>
              ))}
              {!loading && (filteredSortedPkgs || []).length === 0 ? (
                <Grid item xs={12}>
                  <Alert severity="info">
                    No promo packages available for the selected type.
                  </Alert>
                </Grid>
              ) : null}
            </Grid>
          </Box>
        </Stack>
      </Paper>

      {/* My Purchases (kept as-is) */}
      <Paper
        elevation={0}
        className="rounded-xl shadow-md"
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
                  className="rounded-xl shadow-md"
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

      {/* Quick View Modal */}
      <QuickViewModal
        open={quickOpen}
        product={quickProduct}
        onClose={() => setQuickOpen(false)}
        onGoToDetails={() => setQuickOpen(false)}
      />
    </Box>
  );
}
