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




  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (sort) params.sort = sort;
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
  }, [sort]);

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
    if (!q) return rows || [];
    return (rows || []).filter((p) => {
      const hay = `${p?.name || ""} ${p?.category || ""} ${p?.city || ""} ${p?.state || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

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

  const handleGoCheckout = () => {
    try {
      const p = window.location.pathname;
      if (p.startsWith("/agency")) navigate("/agency/checkout");
      else if (p.startsWith("/employee")) navigate("/employee/checkout");
      else navigate("/user/checkout");
    } catch {}
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: colors.textPrimary }}>
            Trikonekt Products
          </Typography>
          <IconButton size="small" onClick={() => setDrawerOpen(true)} title="Open cart">
            <Badge badgeContent={cartCount} sx={{ "& .MuiBadge-badge": { bgcolor: colors.primary, color: colors.textOnPrimary } }}>
              <ShoppingCartIcon />
            </Badge>
          </IconButton>
        </Stack>
      </Box>


      {/* Filters & Sorting Bar */}
      <Box
        sx={{
          mb: 2,
          p: 2,
          borderRadius: `${cardTokens.radius}px`,
          border: cardTokens.border,
          bgcolor: cardTokens.bg,
          boxShadow: "none",
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
          <TextField
            size="small"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: { xs: "100%", md: 280 } }}
          />
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip
              size="small"
              label="Popular"
              onClick={() => setSort((s) => (s === "rating_desc" ? "" : "rating_desc"))}
              sx={{
                fontWeight: 700,
                bgcolor: sort === "rating_desc" ? colors.primary : colors.white,
                color: sort === "rating_desc" ? colors.textOnPrimary : colors.textPrimary,
                border: `1px solid ${colors.primary}`,
              }}
            />
            <Chip
              size="small"
              label="Newest"
              onClick={() => setSort((s) => (s === "newest" ? "" : "newest"))}
              sx={{
                fontWeight: 700,
                bgcolor: sort === "newest" ? colors.primary : colors.white,
                color: sort === "newest" ? colors.textOnPrimary : colors.textPrimary,
                border: `1px solid ${colors.primary}`,
              }}
            />
            <Chip
              size="small"
              label="Price Low"
              onClick={() => setSort((s) => (s === "price_asc" ? "" : "price_asc"))}
              sx={{
                fontWeight: 700,
                bgcolor: sort === "price_asc" ? colors.primary : colors.white,
                color: sort === "price_asc" ? colors.textOnPrimary : colors.textPrimary,
                border: `1px solid ${colors.primary}`,
              }}
            />
            <Chip
              size="small"
              label="Price High"
              onClick={() => setSort((s) => (s === "price_desc" ? "" : "price_desc"))}
              sx={{
                fontWeight: 700,
                bgcolor: sort === "price_desc" ? colors.primary : colors.white,
                color: sort === "price_desc" ? colors.textOnPrimary : colors.textPrimary,
                border: `1px solid ${colors.primary}`,
              }}
            />
          </Stack>
          <Box flex={{ md: 1 }} />
          <Stack direction="row" spacing={1}>
            <V2Button variant="secondary" onClick={() => setDense((d) => !d)}>
              {dense ? "Cozy View" : "Compact View"}
            </V2Button>
            <V2Button onClick={fetchProducts}>Refresh</V2Button>
          </Stack>
        </Stack>
      </Box>

      {/* Promo Package Section */}
      {/* <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Promo Package
        </Typography>
        {loadingPromo ? (
          <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={20} /> <Typography variant="body2">Loading promo items...</Typography>
          </Box>
        ) : (
          <ProductGrid
            items={promoItems || []}
            dense={dense}
            emptyMessage="No promo package products available."
            onSelect={(p) => {
              if (p && p._promo) {
                setAddressDlg({ open: true, pkgId: p.package_id || null, product: p, address: "" });
              } else if (p?.id) {
                navigate(`${basePath}/products/${p.id}`);
              }
            }}
            onQuickView={(p) => {
              if (p && p._promo) {
                setAddressDlg({ open: true, pkgId: p.package_id || null, product: p, address: "" });
              } else {
                setQuickView({ open: true, product: p });
              }
            }}
          />
        )}
      </Box> */}

      {/* Products Section */}
      {loading ? (
        <Box sx={{ py: 4, display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={22} /> <Typography variant="body2">Loading products...</Typography>
        </Box>
      ) : (
        <>
          <Box
            sx={{
              mb: 1.5,
              display: "flex",
              alignItems: { xs: "flex-start", sm: "center" },
              gap: 1,
              justifyContent: "space-between",
              flexDirection: { xs: "column", sm: "row" }
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Products {rows?.length ? `(${rows.length})` : ""}
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexWrap: "wrap",
                width: { xs: "100%", sm: "auto" },
                justifyContent: { xs: "flex-start", sm: "flex-end" }
              }}
            >
              <TextField
                select
                size="small"
                label="Sort by"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                sx={{ width: { xs: "100%", sm: 180 } }}
              >
                <MenuItem value="">Relevance</MenuItem>
                <MenuItem value="price_asc">Price: Low to High</MenuItem>
                <MenuItem value="price_desc">Price: High to Low</MenuItem>
                <MenuItem value="newest">Newest</MenuItem>
                <MenuItem value="rating_desc">Rating</MenuItem>
              </TextField>
              <V2Button variant="secondary" onClick={() => setDense((d) => !d)}>
                {dense ? "Cozy view" : "Compact view"}
              </V2Button>
              <V2Button onClick={fetchProducts}>Refresh</V2Button>
            </Box>
          </Box>
          <ProductGrid
            items={filteredRows || []}
            dense={dense}
            onSelect={(p) => {
              navigate(`${basePath}/products/${p.id}`);
            }}
            onQuickView={(p) => setQuickView({ open: true, product: p })}
            onAddToCart={handleAddToCart}
            showAddToCart
          />
        </>
      )}

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

      {/* Cart Drawer */}
      <CartDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCheckout={handleGoCheckout}
      />

      {/* Floating cart button on mobile */}
      <Box
        sx={{
          position: "fixed",
          right: 16,
          bottom: 16,
          display: { xs: "block", md: "none" },
          zIndex: 1300,
        }}
      >
        <V2Button
          onClick={() => setDrawerOpen(true)}
          startIcon={
            <Badge badgeContent={cartCount} sx={{ "& .MuiBadge-badge": { bgcolor: colors.primary, color: colors.textOnPrimary } }}>
              <ShoppingCartIcon />
            </Badge>
          }
          sx={{ borderRadius: `${cardTokens.radius}px` }}
        >
          Cart
        </V2Button>
      </Box>

      <Dialog
        open={addressDlg.open}
        onClose={() => setAddressDlg({ open: false, pkgId: null, product: null, address: "" })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Select shipping address</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {addressDlg.product ? `Product: ${addressDlg.product.name}` : ""}
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Shipping Address"
            fullWidth
            multiline
            minRows={3}
            value={addressDlg.address}
            onChange={(e) => setAddressDlg((s) => ({ ...s, address: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <V2Button variant="secondary" onClick={() => setAddressDlg({ open: false, pkgId: null, product: null, address: "" })}>
            Cancel
          </V2Button>
          <V2Button
            onClick={() => {
              const addr = String(addressDlg.address || "").trim();
              if (!addr) {
                setSnack({ open: true, type: "error", msg: "Enter shipping address" });
                return;
              }
              try {
                addPromoPackagePrime({
                  pkgId: addressDlg.pkgId,
                  name: addressDlg.product?.package_name || "Prime 750 Product",
                  unitPrice: Number(addressDlg.product?.package_price || 0),
                  qty: 1,
                  selected_promo_product_id: addressDlg.product?.id ?? null,
                  shipping_address: addr,
                  prime750_choice: "PRODUCT",
                });
                setSnack({ open: true, type: "success", msg: "Added to cart." });
                setAddressDlg({ open: false, pkgId: null, product: null, address: "" });
              } catch (e) {
                setSnack({ open: true, type: "error", msg: "Failed to add to cart." });
              }
            }}
          >
            Add to Cart
          </V2Button>
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
