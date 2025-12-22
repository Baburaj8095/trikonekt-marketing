import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Divider,
  Pagination,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import NearMeIcon from "@mui/icons-material/NearMe";
import PlaceIcon from "@mui/icons-material/Place";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { useNavigate, useLocation } from "react-router-dom";
import { getPublicShops } from "../../api/api";

function useQuery() {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search || ""), [location.search]);
}

export default function MerchantShops() {
  const navigate = useNavigate();
  const query = useQuery();

  const [q, setQ] = useState(query.get("q") || "");
  const [city, setCity] = useState(query.get("city") || "");
  const [lat, setLat] = useState(query.get("lat") || "");
  const [lng, setLng] = useState(query.get("lng") || "");
  const [radiusKm, setRadiusKm] = useState(query.get("radius_km") || "25");

  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(Number(query.get("page") || 1));
  const pageSize = 20;

  const paramsForApi = useMemo(() => {
    const p = { q: q || undefined, city: city || undefined };
    if (lat && lng) {
      p.lat = lat;
      p.lng = lng;
      if (radiusKm) p.radius_km = radiusKm;
    }
    p.page = page;
    return p;
  }, [q, city, lat, lng, radiusKm, page]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await getPublicShops(paramsForApi);
        let rows = [];
        let total = 0;
        if (Array.isArray(res)) {
          rows = res;
          total = res.length;
        } else if (res && typeof res === "object") {
          rows = Array.isArray(res.results) ? res.results : [];
          total = Number(res.count || rows.length || 0);
        }
        if (!cancelled) {
          setShops(rows);
          setCount(total);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paramsForApi]);

  const totalPages = useMemo(() => {
    if (!count) return 1;
    return Math.max(1, Math.ceil(count / pageSize));
  }, [count]);

  const applyFilters = () => {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (city) usp.set("city", city);
    if (lat && lng) {
      usp.set("lat", String(lat));
      usp.set("lng", String(lng));
      if (radiusKm) usp.set("radius_km", String(radiusKm));
    }
    usp.set("page", "1");
    navigate({ pathname: "/merchant-marketplace", search: `?${usp.toString()}` }, { replace: false });
    setPage(1);
  };

  const clearGeo = () => {
    setLat("");
    setLng("");
  };

  const useMyLocation = () => {
    if (!navigator?.geolocation) {
      alert("Geolocation not supported on this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
      },
      () => alert("Unable to fetch your location."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handlePageChange = (_, p) => {
    setPage(p);
    const usp = new URLSearchParams(window.location.search || "");
    usp.set("page", String(p));
    navigate({ pathname: "/merchant-marketplace", search: `?${usp.toString()}` }, { replace: false });
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
        Nearby Shops
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Discover merchant shops near you. Use city keywords or enable location for more relevant results.
      </Typography>

      <Grid container spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            placeholder="Search shops..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            placeholder="City (optional)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PlaceIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <TextField
            fullWidth
            label="Radius (km)"
            type="number"
            inputProps={{ min: 1, max: 100, step: 1 }}
            value={radiusKm}
            onChange={(e) => setRadiusKm(e.target.value)}
            disabled={!lat || !lng}
          />
        </Grid>
        <Grid item xs={6} md="auto">
          <Button
            variant="outlined"
            startIcon={<NearMeIcon />}
            onClick={useMyLocation}
            sx={{ height: "100%", minHeight: 40 }}
          >
            Use my location
          </Button>
        </Grid>
        <Grid item xs={6} md="auto">
          <Button variant="contained" onClick={applyFilters} sx={{ height: "100%", minHeight: 40 }}>
            Apply
          </Button>
        </Grid>
        {lat && lng ? (
          <Grid item xs={6} md="auto">
            <Button variant="text" onClick={clearGeo} sx={{ height: "100%", minHeight: 40 }}>
              Clear location
            </Button>
          </Grid>
        ) : null}
      </Grid>

      <Divider sx={{ my: 1.5 }} />

      {loading ? (
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      ) : shops.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No shops found. Try adjusting your search or enabling your location.
        </Typography>
      ) : (
        <>
          <Grid container spacing={2}>
            {shops.map((s) => (
              <Grid key={s.id} item xs={12} sm={6} md={4} lg={3}>
                <Card
                  elevation={1}
                  sx={{ height: "100%", display: "flex", flexDirection: "column", cursor: "pointer" }}
                  onClick={() => navigate(`/merchant-marketplace/shops/${encodeURIComponent(s.id)}`)}
                >
                  {s.shop_image ? (
<CardMedia component="img" image={s.image_url || s.shop_image} alt={s.shop_name} sx={{ height: 140, objectFit: "cover" }} />
                  ) : null}
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {s.shop_name}
                      </Typography>
                      <Chip
                        size="small"
                        label={String(s.status || "").toUpperCase()}
                        color={s.status === "ACTIVE" ? "success" : s.status === "PENDING" ? "warning" : "default"}
                        variant={s.status === "ACTIVE" ? "filled" : "outlined"}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {s.address || "—"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {s.city || "—"}
                    </Typography>
{(s.distance_km !== null && s.distance_km !== undefined && !Number.isNaN(Number(s.distance_km))) ? (
  <Typography variant="caption" color="text.secondary">
    <NearMeIcon fontSize="inherit" sx={{ verticalAlign: "middle" }} /> {Number(s.distance_km).toFixed(1)} km away
  </Typography>
) : null}
                    <Box sx={{ mt: 0.75, display: "flex", alignItems: "center", gap: 1 }}>
                      <PhoneIphoneIcon fontSize="small" sx={{ color: "text.secondary" }} />
                      <Typography variant="body2" color="text.secondary">
                        {s.contact_number || "—"}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {totalPages > 1 ? (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Pagination color="primary" count={totalPages} page={page} onChange={handlePageChange} />
            </Box>
          ) : null}
        </>
      )}

      <Box sx={{ mt: 3, p: 1.5, borderRadius: 2, background: "rgba(25,118,210,0.06)", border: "1px solid rgba(25,118,210,0.15)" }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ScheduleIcon fontSize="inherit" />
          Shops listed here are ACTIVE and visible to all users. Merchants manage their shops in the Merchant Dashboard.
        </Typography>
      </Box>
    </Box>
  );
}
