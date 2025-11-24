import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  TextField,
  MenuItem,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  Stack,
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

  // Filters
  const [filters, setFilters] = useState({
    country: "",
    state: "",
    city: "",
    pincode: "",
    category: "",
    name: "",
  });

  // Cascading dropdown sources
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  const countryObj = useMemo(
    () => countries.find((c) => c.name === filters.country) || null,
    [countries, filters.country]
  );
  const stateObj = useMemo(
    () => states.find((s) => s.name === filters.state) || null,
    [states, filters.state]
  );

  // Products
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });

  // UI state for e-commerce layout
  const [sort, setSort] = useState("");
  const [dense, setDense] = useState(true);
  const [quickView, setQuickView] = useState({ open: false, product: null });

  useEffect(() => {
    async function loadCountries() {
      setLoadingCountries(true);
      try {
        const res = await API.get("/location/countries/");
        setCountries(Array.isArray(res.data) ? res.data : res.data?.results || []);
      } catch {
        setCountries([]);
      } finally {
        setLoadingCountries(false);
      }
    }
    loadCountries();
  }, []);

  useEffect(() => {
    async function loadStates() {
      if (!countryObj?.id) {
        setStates([]);
        return;
      }
      setLoadingStates(true);
      try {
        const res = await API.get("/location/states/", { params: { country: countryObj.id } });
        setStates(Array.isArray(res.data) ? res.data : res.data?.results || []);
      } catch {
        setStates([]);
      } finally {
        setLoadingStates(false);
      }
    }
    // reset deeper filters when parent changes
    setFilters((f) => ({ ...f, state: "", city: "" }));
    setCities([]);
    loadStates();
  }, [countryObj?.id]);

  useEffect(() => {
    async function loadCities() {
      if (!stateObj?.id) {
        setCities([]);
        return;
      }
      setLoadingCities(true);
      try {
        const res = await API.get("/location/cities/", { params: { state: stateObj.id } });
        setCities(Array.isArray(res.data) ? res.data : res.data?.results || []);
      } catch {
        setCities([]);
      } finally {
        setLoadingCities(false);
      }
    }
    setFilters((f) => ({ ...f, city: "" }));
    loadCities();
  }, [stateObj?.id]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.country) params.country = filters.country;
      if (filters.state) params.state = filters.state;
      if (filters.city) params.city = filters.city;
      if (filters.pincode) params.pincode = filters.pincode;
      if (filters.category) params.category = filters.category;
      if (filters.name) params.name = filters.name;
      if (sort) params.sort = sort;
      const res = await API.get("/products", { params: { ...params, _: Date.now() } });
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setRows(arr);
    } catch {
      setRows([]);
      setSnack({ open: true, type: "error", msg: "Failed to load products" });
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

  // Refresh on window focus to avoid stale stock after approvals
  useEffect(() => {
    const onFocus = () => {
      fetchProducts();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);


  const onFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((f) => ({ ...f, [name]: value }));
  };

  const onApply = async (e) => {
    e.preventDefault();
    await fetchProducts();
  };

  const onClear = () => {
    setFilters({
      country: "",
      state: "",
      city: "",
      pincode: "",
      category: "",
      name: "",
    });
    setStates([]);
    setCities([]);
    fetchProducts();
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: "#0C2D48" }}>
        Trikonekt Products
      </Typography>

      <Paper elevation={1} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Box component="form" onSubmit={onApply}>
          <Grid container spacing={{ xs: 1, sm: 2 }}>
            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                label="Country"
                name="country"
                value={filters.country}
                onChange={onFilterChange}
              >
                {loadingCountries ? (
                  <MenuItem disabled>
                    <CircularProgress size={18} sx={{ mr: 1 }} /> Loading...
                  </MenuItem>
                ) : (
                  countries.map((c) => (
                    <MenuItem key={c.id} value={c.name}>
                      {c.name}
                    </MenuItem>
                  ))
                )}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                label="State"
                name="state"
                value={filters.state}
                onChange={onFilterChange}
                disabled={!countryObj}
              >
                {loadingStates ? (
                  <MenuItem disabled>
                    <CircularProgress size={18} sx={{ mr: 1 }} /> Loading...
                  </MenuItem>
                ) : (
                  states.map((s) => (
                    <MenuItem key={s.id} value={s.name}>
                      {s.name}
                    </MenuItem>
                  ))
                )}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                label="City"
                name="city"
                value={filters.city}
                onChange={onFilterChange}
                disabled={!stateObj}
              >
                {loadingCities ? (
                  <MenuItem disabled>
                    <CircularProgress size={18} sx={{ mr: 1 }} /> Loading...
                  </MenuItem>
                ) : (
                  cities.map((c) => (
                    <MenuItem key={c.id} value={c.name}>
                      {c.name}
                    </MenuItem>
                  ))
                )}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Pincode"
                name="pincode"
                value={filters.pincode}
                onChange={onFilterChange}
                inputProps={{ maxLength: 10 }}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Category"
                name="category"
                value={filters.category}
                onChange={onFilterChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Search by Product Name"
                name="name"
                value={filters.name}
                onChange={onFilterChange}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  width: { xs: "100%", md: "auto" },
                  flexWrap: "wrap",
                  justifyContent: { xs: "flex-start", md: "flex-end" }
                }}
              >
                <Button type="button" variant="text" onClick={onClear}>
                  Clear
                </Button>
                <Button type="submit" variant="contained">
                  Apply
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Paper>

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
