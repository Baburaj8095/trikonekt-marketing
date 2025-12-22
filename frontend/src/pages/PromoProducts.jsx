import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
  IconButton,
  Stack,
} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { useNavigate, useLocation } from "react-router-dom";
import ProductGrid from "../components/market/ProductGrid";
import { getPromoPackages } from "../api/api";
import { addPromoPackagePrime, subscribe as cartSubscribe } from "../store/cart";

/**
 * PromoProducts
 * Dedicated page that lists only Promo Package Products (e.g., for PRIME 750)
 * Aggregated from /business/promo/packages/ response (promo_products per package).
 * Users can select a promo product, enter shipping address, and add to cart.
 */
export default function PromoProducts() {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine role-scoped base path for cart/checkout navigation
  const roleBase = useMemo(() => {
    const p = location.pathname || "";
    if (p.startsWith("/agency")) return "agency";
    if (p.startsWith("/employee")) return "employee";
    return "user";
  }, [location.pathname]);

  const [promoItems, setPromoItems] = useState([]);
  const [loadingPromo, setLoadingPromo] = useState(false);

  // UI: search (client-side), cart badge, drawer redirect
  const [search, setSearch] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });

  // Address dialog state
  const [addressDlg, setAddressDlg] = useState({ open: false, pkgId: null, product: null, address: "" });

  // Load promo products by aggregating from packages
  const fetchPromoProducts = async () => {
    try {
      setLoadingPromo(true);
      const res = await getPromoPackages();
      const list = Array.isArray(res) ? res : res?.results || [];
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
              _promo: true, // hint ProductCard to not show out-of-stock
            });
          }
        }
      }
      // unique by id
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

  useEffect(() => {
    fetchPromoProducts();
  }, []);

  // Subscribe to cart count badge
  useEffect(() => {
    const unsub = cartSubscribe((s) => {
      try {
        setCartCount(Number(s?.count || 0));
      } catch {
        setCartCount(0);
      }
    });
    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, []);

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return promoItems || [];
    return (promoItems || []).filter((p) => `${p?.name || ""}`.toLowerCase().includes(q));
  }, [promoItems, search]);

  const handleAddSelected = () => {
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
    } catch {
      setSnack({ open: true, type: "error", msg: "Failed to add to cart." });
    }
  };

  const goToCart = () => {
    const path =
      roleBase === "agency"
        ? "/agency/cart"
        : roleBase === "employee"
        ? "/employee/cart"
        : "/user/cart";
    navigate(path);
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0C2D48" }}>
            Promo Products
          </Typography>
          <IconButton size="small" onClick={goToCart} title="Open cart">
            <Badge badgeContent={cartCount} color="primary">
              <ShoppingCartIcon />
            </Badge>
          </IconButton>
        </Stack>
      </Box>

      <Box
        sx={{
          mb: 2,
          p: 1.5,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "#fff",
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
          <TextField
            size="small"
            placeholder="Search promo products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: { xs: "100%", md: 280 } }}
          />
          <Box flex={{ md: 1 }} />
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={fetchPromoProducts}>
              Refresh
            </Button>
          </Stack>
        </Stack>
      </Box>

      {loadingPromo ? (
        <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={20} /> <Typography variant="body2">Loading promo items...</Typography>
        </Box>
      ) : (
        <ProductGrid
          items={filtered || []}
          dense
          emptyMessage="No promo products available."
          onSelect={(p) => {
            setAddressDlg({ open: true, pkgId: p.package_id || null, product: p, address: "" });
          }}
          onQuickView={(p) => {
            setAddressDlg({ open: true, pkgId: p.package_id || null, product: p, address: "" });
          }}
        />
      )}

      <Dialog
        open={addressDlg.open}
        onClose={() => setAddressDlg({ open: false, pkgId: null, product: null, address: "" })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Enter shipping address</DialogTitle>
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
          <Button onClick={() => setAddressDlg({ open: false, pkgId: null, product: null, address: "" })}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleAddSelected}>
            Add to Cart
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
