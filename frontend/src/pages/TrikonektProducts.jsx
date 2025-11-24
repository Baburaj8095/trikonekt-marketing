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
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../api/api";
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

  // Initial load
  useEffect(() => {
    fetchProducts();
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
