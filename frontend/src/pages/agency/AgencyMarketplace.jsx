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
  Card,
  CardActionArea,
  CardMedia,
  CardContent,
  Stack,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../../api/api";
import normalizeMediaUrl from "../../utils/media";

export default function AgencyMarketplace() {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith("/agency/marketplace") ? "/agency/marketplace" : "/agency-marketplace";

  // Filters
  const [filters, setFilters] = useState({
    country: "",
    state: "",
    city: "",
    pincode: "",
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

  // Banners
  const [banners, setBanners] = useState([]);
  const [loadingBanners, setLoadingBanners] = useState(false);

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

  const fetchBanners = async () => {
    try {
      setLoadingBanners(true);
      const params = {};
      if (filters.country) params.country = filters.country;
      if (filters.state) params.state = filters.state;
      if (filters.city) params.city = filters.city;
      if (filters.pincode) params.pincode = filters.pincode;
      const res = await API.get("/banners", { params: { ...params, active: 1, _: Date.now() } });
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setBanners(arr);
    } catch {
      setBanners([]);
    } finally {
      setLoadingBanners(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchBanners();
  }, []);

  // Refresh on window focus
  useEffect(() => {
    const onFocus = () => fetchBanners();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const onFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((f) => ({ ...f, [name]: value }));
  };

  const onApply = async (e) => {
    e.preventDefault();
    await fetchBanners();
  };

  const onClear = () => {
    setFilters({
      country: "",
      state: "",
      city: "",
      pincode: "",
    });
    setStates([]);
    setCities([]);
    fetchBanners();
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: "#0C2D48" }}>
        Agency Products
      </Typography>

      {/* Location Filters */}
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

            <Grid item xs={12} md={9} />
            <Grid item xs={12} md={3}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: { xs: "flex-start", md: "flex-end" } }}>
                <Button type="button" variant="text" onClick={onClear}>
                  Clear
                </Button>
                <Button type="submit" variant="contained" disabled={loadingBanners}>
                  Apply
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Banners as "Agency Products" */}
      <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Agency Products</Typography>
          <Button size="small" onClick={fetchBanners} disabled={loadingBanners}>
            {loadingBanners ? "Loading..." : "Refresh"}
          </Button>
        </Box>

        {loadingBanners ? (
          <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={20} /> <Typography variant="body2">Loading banners...</Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {(banners || []).map((b) => (
              <Grid key={b.id} item xs={12} sm={6} md={4} lg={3}>
                <Card variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", width: "100%", maxWidth: 340, mx: "auto" }}>
                  <CardActionArea onClick={() => navigate(`${basePath}/banners/${b.id}`)}>
                    {b.image_url ? (
                      <CardMedia
                        component="img"
                        image={normalizeMediaUrl(b.image_url)}
                        alt={b.title}
                        sx={{ width: "100%", height: 225, objectFit: "cover" }}
                      />
                    ) : (
                      <Box sx={{ width: "100%", height: 225, bgcolor: "#f1f5f9" }} />
                    )}
                    <CardContent sx={{ p: 1.5 }}>
                      <Typography variant="subtitle2" noWrap title={b.title} sx={{ fontWeight: 600 }}>
                        {b.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {[b.city, b.state, b.country].filter(Boolean).join(", ")}
                      </Typography>
                      {Array.isArray(b.items) && b.items.length > 0 ? (
                        <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "text.secondary" }}>
                          {b.items.length} item{b.items.length > 1 ? "s" : ""}
                        </Typography>
                      ) : null}
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
            {(!banners || banners.length === 0) && (
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2, textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    No banners found for the selected filters.
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        )}
      </Paper>
    </Container>
  );
}
