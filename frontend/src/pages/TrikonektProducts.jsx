import React, { useEffect, useState } from "react";
import {
  Box,
  Container,
  Typography,
  TextField,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Badge,
  Chip,
  Stack,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import API, { getPromoPackages } from "../api/api";
import { addPromoPackagePrime, addProduct, subscribe as cartSubscribe } from "../store/cart";
import ProductGrid from "../components/market/ProductGrid";
import QuickViewModal from "../components/market/QuickViewModal";
import CartDrawer from "../components/ecoupon/CartDrawer";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import colors from "./v2/theme/colors";
import cardTokens from "./v2/theme/card";
import V2Button from "./v2/components/V2Button";

export default function TrikonektProducts() {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine base path depending on the current role's mount point
  const basePath = location.pathname.startsWith("/agency/trikonekt-products")
    ? "/agency/trikonekt-products"
    : location.pathname.startsWith("/employee/trikonekt-products")
    ? "/employee/trikonekt-products"
    : "/trikonekt-products";




  // Products
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });

  // UI state for e-commerce layout
  const [sort, setSort] = useState("");
  const [search, setSearch] = useState("");
  const [dense, setDense] = useState(true);
  const [quickView, setQuickView] = useState({ open: false, product: null });
  const [cartCount, setCartCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Promo Package products
  const [promoItems, setPromoItems] = useState([]);
  const [loadingPromo, setLoadingPromo] = useState(false);
  const [addressDlg, setAddressDlg] = useState({ open: false, pkgId: null, product: null, address: "" });
  // Optional category filter via ?category=slug
  const [category, setCategory] = useState("");
  useEffect(() => {
    try {
      const qs = new URLSearchParams(location.search || "");
      const c = (qs.get("category") || "").trim();
      setCategory(c);
    } catch {}
  }, [location.search]);




  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (sort) params.sort = sort;
      if (category) params.category = category;
      const res = await API.get("/products", { params: { ...params, _: Date.now() } });
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setRows(arr);
    } catch {
      setRows([]);
      //setSnack({ open: true, type: "error", msg: "Failed to load products" });
    } finally {
      setLoading(false);
    }
  };

  const fetchPromoProducts = async () => {
    try {
      setLoadingPromo(true);
      const pkgs = await getPromoPackages();
      const list = Array.isArray(pkgs) ? pkgs : pkgs?.results || [];
      const items = [];
      for (const pkg of list) {
        if (Array.isArray(pkg?.promo_products)) {
          for (const p of pkg.promo_products) {
            items.push({
              id: p.id,
              name: p.name,
              price: Number(p.price || 0),
              image_url: p.image_url,
              package_id: p.package_id || pkg.id,
              package_name: pkg.name,
              package_price: Number(pkg.price || 0),
              _promo: true,
            });
          }
        }
      }
      const seen = new Set();
      const unique = [];
      for (const it of items) {
        const key = it.id || `${it.name}-${it.image_url}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(it);
      }
      setPromoItems(unique);
    } catch {
      setPromoItems([]);
    } finally {
      setLoadingPromo(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchProducts();
    fetchPromoProducts();
  }, []);

  // Apply sorting automatically when changed
  useEffect(() => {
    fetchProducts();
  }, [sort, category]);

  // Disabled auto-refresh on window focus to prevent reload when returning from new tab
  useEffect(() => {
    // no-op
  }, []);

  // Subscribe to cart to show item count badge
  useEffect(() => {
    const unsub = cartSubscribe((s) => {
      try {
        setCartCount(Number(s?.count || 0));
      } catch {
        setCartCount(0);
      }
    });
    return () => {
      try { unsub && unsub(); } catch {}
    };
  }, []);





  // Derived filtered list (client-side search)
  const filteredRows = React.useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q && !category) return rows || [];
    return (rows || []).filter((p) => {
      const hay = `${p?.name || ""} ${p?.category || ""} ${p?.city || ""} ${p?.state || ""}`.toLowerCase();
      const matchesSearch = q ? hay.includes(q) : true;
      if (!matchesSearch) return false;
      if (category) {
        const cat = String(p?.category || "").toLowerCase().trim();
        if (cat !== category.toLowerCase()) return false;
      }
      return true;
    });
  }, [rows, search, category]);

  // Add physical product to centralized cart (uses discount price if available)
  const handleAddToCart = (product) => {
    try {
      const price = Number(product?.price || 0);
      const discount = Number(product?.discount || 0);
      const unit = price * (1 - (Number.isFinite(discount) ? discount : 0) / 100);
      addProduct({
        productId: product.id,
        name: product?.name || "Product",
        unitPrice: Number.isFinite(unit) ? unit : price,
        qty: 1,
        image_url: product?.image_url || "",
        // Mark Trikonekt products as TRI with admin-configured max redeem %
        tri: true,
        max_reward_pct: Number(product?.max_reward_redeem_percent || 0),
        tri_app_slug: "trikonekt",
      });
      setSnack({ open: true, type: "success", msg: "Added to cart." });
      setDrawerOpen(true);
    } catch {
      setSnack({ open: true, type: "error", msg: "Failed to add to cart." });
    }
  };

  const clearCategory = () => {
    try {
      const qs = new URLSearchParams(location.search || "");
      qs.delete("category");
      const query = qs.toString();
      navigate(`${basePath}${query ? `?${query}` : ""}`);
    } catch {}
  };

  const handleGoCheckout = () => {
    try {
      const p = window.location.pathname;
      if (p.startsWith("/agency")) navigate("/agency/checkout");
      else if (p.startsWith("/employee")) navigate("/employee/checkout");
      else navigate("/user/checkout");
    } catch {}
  };

  return (
  <Box sx={{ bgcolor: "#f7f7f7", minHeight: "100vh" }}>
    {/* Top Sticky Header like Blinkit */}
    <Box
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 1200,
        bgcolor: "#fff",
        borderBottom: "1px solid #eee",
      }}
    >
      <Container maxWidth="xl" sx={{ py: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 0.5 }}>
              Trikonekt
            </Typography>

            <TextField
              fullWidth
              size="small"
              placeholder="Search for products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                bgcolor: "#f3f3f3",
                borderRadius: 2,
                "& fieldset": { border: "none" },
              }}
            />
          </Box>

          <IconButton
            onClick={() => setDrawerOpen(true)}
            sx={{
              ml: 1,
              bgcolor: "#ff6d00",
              color: "#fff",
              "&:hover": { bgcolor: "#ff6d00" },
              borderRadius: 2,
              width: 44,
              height: 44,
            }}
          >
            <Badge
              badgeContent={cartCount}
              sx={{
                "& .MuiBadge-badge": {
                  bgcolor: "#000",
                  color: "#fff",
                  fontWeight: 700,
                },
              }}
            >
              <ShoppingCartIcon />
            </Badge>
          </IconButton>
        </Stack>
      </Container>

      {/* Sort + Chips row (Blinkit-like) */}
      <Box sx={{ px: 1.5, pb: 1 }}>
        <Container maxWidth="xl">
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              select
              size="small"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              sx={{
                width: 160,
                bgcolor: "#fff",
                "& fieldset": { borderRadius: 2 },
              }}
            >
              <MenuItem value="">Relevance</MenuItem>
              <MenuItem value="newest">Newest</MenuItem>
              <MenuItem value="price_asc">Price Low</MenuItem>
              <MenuItem value="price_desc">Price High</MenuItem>
              <MenuItem value="rating_desc">Top Rated</MenuItem>
            </TextField>

            <Box sx={{ flex: 1, overflowX: "auto" }}>
              <Stack direction="row" spacing={1} sx={{ minWidth: "max-content", pb: 0.5 }}>
                <Chip
                  size="small"
                  label="Popular"
                  onClick={() => setSort((s) => (s === "rating_desc" ? "" : "rating_desc"))}
                  sx={{
                    fontWeight: 700,
                    bgcolor: sort === "rating_desc" ? "#ff6d00" : "#fff",
                    color: sort === "rating_desc" ? "#fff" : "#111",
                    border: "1px solid #eee",
                  }}
                />
                <Chip
                  size="small"
                  label="Newest"
                  onClick={() => setSort((s) => (s === "newest" ? "" : "newest"))}
                  sx={{
                    fontWeight: 700,
                    bgcolor: sort === "newest" ? "#ff6d00" : "#fff",
                    color: sort === "newest" ? "#fff" : "#111",
                    border: "1px solid #eee",
                  }}
                />
                <Chip
                  size="small"
                  label="Price Low"
                  onClick={() => setSort((s) => (s === "price_asc" ? "" : "price_asc"))}
                  sx={{
                    fontWeight: 700,
                    bgcolor: sort === "price_asc" ? "#ff6d00" : "#fff",
                    color: sort === "price_asc" ? "#fff" : "#111",
                    border: "1px solid #eee",
                  }}
                />
                <Chip
                  size="small"
                  label="Price High"
                  onClick={() => setSort((s) => (s === "price_desc" ? "" : "price_desc"))}
                  sx={{
                    fontWeight: 700,
                    bgcolor: sort === "price_desc" ? "#ff6d00" : "#fff",
                    color: sort === "price_desc" ? "#fff" : "#111",
                    border: "1px solid #eee",
                  }}
                />

                {category ? (
                  <Chip
                    size="small"
                    label={`Category: ${category}`}
                    onDelete={clearCategory}
                    sx={{
                      fontWeight: 700,
                      bgcolor: "#fff",
                      color: "#111",
                      border: "1px solid #eee",
                    }}
                  />
                ) : null}
              </Stack>
            </Box>

            <V2Button
              variant="secondary"
              onClick={() => setDense((d) => !d)}
              sx={{ borderRadius: 2, height: 36 }}
            >
              {dense ? "Cozy" : "Compact"}
            </V2Button>
          </Stack>
        </Container>
      </Box>
    </Box>

    {/* Product Section */}
    <Container maxWidth="xl" sx={{ py: 2 }}>
      {loading ? (
        <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1 }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: 16 }}>
              Products {filteredRows?.length ? `(${filteredRows.length})` : ""}
            </Typography>

            <V2Button onClick={fetchProducts} sx={{ borderRadius: 2 }}>
              Refresh
            </V2Button>
          </Stack>

          {/* IMPORTANT: This grid must be Blinkit-like */}
          <ProductGrid
            items={filteredRows || []}
            dense={dense}
            onSelect={(p) => navigate(`${basePath}/products/${p.id}`)}
            onQuickView={(p) => setQuickView({ open: true, product: p })}
            onAddToCart={handleAddToCart}
            showAddToCart
          />
        </>
      )}
    </Container>

    {/* Modals */}
    <QuickViewModal
      open={quickView.open}
      product={quickView.product}
      onClose={() => setQuickView({ open: false, product: null })}
      onGoToDetails={() => {
        if (quickView.product?.id) {
          navigate(`${basePath}/products/${quickView.product.id}`);
          setQuickView({ open: false, product: null });
        }
      }}
    />

    <CartDrawer
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      onCheckout={handleGoCheckout}
    />

    {/* Snackbar */}
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
  </Box>
);
}

