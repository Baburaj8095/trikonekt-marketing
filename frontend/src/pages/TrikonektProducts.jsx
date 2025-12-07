import React, { useEffect, useState } from "react";
import {
  Box,
  Container,
  Typography,
  TextField,
  MenuItem,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import API, { getPromoPackages } from "../api/api";
import { addPromoPackagePrime } from "../store/cart";
import ProductGrid from "../components/market/ProductGrid";
import QuickViewModal from "../components/market/QuickViewModal";

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
  const [dense, setDense] = useState(true);
  const [quickView, setQuickView] = useState({ open: false, product: null });
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





  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: "#0C2D48" }}>
        Trikonekt Products
      </Typography>


      {/* Promo Package Section */}
      <Box sx={{ mb: 2 }}>
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
      </Box>

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
              <Button size="small" variant="outlined" onClick={() => setDense((d) => !d)}>
                {dense ? "Cozy view" : "Compact view"}
              </Button>
              <Button size="small" onClick={fetchProducts}>Refresh</Button>
            </Box>
          </Box>
          <ProductGrid
            items={rows || []}
            dense={dense}
            onSelect={(p) => {
              navigate(`${basePath}/products/${p.id}`);
            }}
            onQuickView={(p) => setQuickView({ open: true, product: p })}
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
          <Button onClick={() => setAddressDlg({ open: false, pkgId: null, product: null, address: "" })}>
            Cancel
          </Button>
          <Button
            variant="contained"
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
