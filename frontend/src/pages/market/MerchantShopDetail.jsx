import React, { useEffect, useState } from "react";
import { Box, Typography, Chip, Button, Grid, Paper, Divider, Skeleton, Alert, Stack } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import NearMeIcon from "@mui/icons-material/NearMe";
import PlaceIcon from "@mui/icons-material/Place";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { useParams, useNavigate } from "react-router-dom";
import { getShopDetail, listShopProductsPublic } from "../../api/api";

export default function MerchantShopDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Public products for this ACTIVE shop
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [prodErr, setProdErr] = useState("");
  const [ordering, setOrdering] = useState("newest");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getShopDetail(id);
        if (!cancelled) {
          setShop(data || null);
        }
      } catch (e) {
        if (!cancelled) setErr("Failed to load shop details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Load public products for this shop
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingProducts(true);
        setProdErr("");
        const data = await listShopProductsPublic(id, ordering ? { ordering } : {});
        const arr = Array.isArray(data) ? data : data?.results || [];
        if (alive) setProducts(arr);
      } catch (_) {
        if (alive) setProdErr("Failed to load products.");
      } finally {
        if (alive) setLoadingProducts(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, ordering]);

  const openInMaps = () => {
    if (!shop) return;
    const hasCoords =
      shop.latitude !== null &&
      shop.latitude !== undefined &&
      shop.longitude !== null &&
      shop.longitude !== undefined &&
      String(shop.latitude).trim() !== "" &&
      String(shop.longitude).trim() !== "";
    if (hasCoords) {
      const url = `https://www.google.com/maps?q=${encodeURIComponent(shop.latitude)},${encodeURIComponent(shop.longitude)}(${encodeURIComponent(shop.shop_name || "Shop")})`;
      window.open(url, "_blank", "noopener");
      return;
    }
    const q = [shop.shop_name, shop.address, shop.city].filter(Boolean).join(", ");
    if (q) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
      window.open(url, "_blank", "noopener");
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Button
          variant="text"
          size="small"
          startIcon={<ArrowBackIosNewIcon />}
          onClick={() => navigate("/merchant-marketplace")}
        >
          Back to shops
        </Button>
      </Box>

      {loading ? (
        <Box>
          <Skeleton variant="rectangular" height={180} sx={{ mb: 2, borderRadius: 2 }} />
          <Skeleton variant="text" width={220} />
          <Skeleton variant="text" width={160} />
          <Skeleton variant="text" width="60%" />
        </Box>
      ) : err ? (
        <Typography variant="body2" color="error">
          {err}
        </Typography>
      ) : !shop ? (
        <Typography variant="body2" color="text.secondary">
          Shop not found or inactive.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p: 1.5, borderRadius: 2 }}>
              {shop.image_url || shop.shop_image ? (
                <img
                  src={shop.image_url || shop.shop_image}
                  alt={shop.shop_name}
                  style={{ width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 8 }}
                />
              ) : (
                <Box
                  sx={{
                    height: 180,
                    borderRadius: 2,
                    bgcolor: "rgba(0,0,0,0.04)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "text.secondary",
                  }}
                >
                  No image
                </Box>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {shop.shop_name}
                </Typography>
                <Chip
                  size="small"
                  label={String(shop.status || "").toUpperCase()}
                  color={shop.status === "ACTIVE" ? "success" : shop.status === "PENDING" ? "warning" : "default"}
                  variant={shop.status === "ACTIVE" ? "filled" : "outlined"}
                />
              </Box>

              {shop.address ? (
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 0.5 }}>
                  <PlaceIcon fontSize="small" sx={{ color: "text.secondary", mt: "2px" }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {shop.address}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {shop.city || ""}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <PlaceIcon fontSize="small" sx={{ color: "text.secondary" }} />
                  <Typography variant="body2" color="text.secondary">
                    {shop.city || ""}
                  </Typography>
                </Box>
              )}

              {(shop.distance_km !== null &&
                shop.distance_km !== undefined &&
                !Number.isNaN(Number(shop.distance_km))) ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <NearMeIcon fontSize="inherit" /> {Number(shop.distance_km).toFixed(1)} km away
                </Typography>
              ) : null}

              <Divider sx={{ my: 1.5 }} />

              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <PhoneIphoneIcon fontSize="small" sx={{ color: "text.secondary" }} />
                <Typography variant="body2" color="text.secondary">
                  {shop.contact_number || ""}
                </Typography>
              </Box>

              {(shop.latitude != null && shop.longitude != null) ? (
                <Typography variant="caption" color="text.secondary">
                  Lat/Lng: {shop.latitude}, {shop.longitude}
                </Typography>
              ) : null}

              <Box sx={{ mt: 1.5, display: "flex", gap: 1 }}>
                <Button variant="contained" onClick={openInMaps}>
                  Open in Maps
                </Button>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CalendarTodayIcon fontSize="small" sx={{ color: "text.secondary" }} />
                <Typography variant="caption" color="text.secondary">
                  Added on {shop.created_at ? new Date(shop.created_at).toLocaleString() : ""}
                </Typography>
              </Box>
            </Paper>
          </Grid>
          {/* PRODUCTS */}
          <Grid item xs={12}>
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Products
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant={ordering === "newest" ? "contained" : "outlined"} onClick={() => setOrdering("newest")}>
                    Newest
                  </Button>
                  <Button size="small" variant={ordering === "price" ? "contained" : "outlined"} onClick={() => setOrdering("price")}>
                    Price ↑
                  </Button>
                  <Button size="small" variant={ordering === "price_desc" ? "contained" : "outlined"} onClick={() => setOrdering("price_desc")}>
                    Price ↓
                  </Button>
                </Stack>
              </Box>

              {prodErr ? <Alert severity="error" sx={{ mb: 1 }}>{prodErr}</Alert> : null}

              <Grid container spacing={1.25}>
                {loadingProducts
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <Grid item key={i} xs={6} sm={4} md={3}>
                        <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2, mb: 0.5 }} />
                        <Skeleton variant="text" width="80%" />
                        <Skeleton variant="text" width="60%" />
                      </Grid>
                    ))
                  : (products || []).map((p) => (
                      <Grid item key={p.id} xs={6} sm={4} md={3}>
                        <Paper elevation={1} sx={{ p: 1, borderRadius: 2, height: "100%" }}>
                          <Box sx={{ height: 120, borderRadius: 1, overflow: "hidden", bgcolor: "#f8fafc", mb: 0.5 }}>
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.title}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              <Box
                                sx={{
                                  width: "100%",
                                  height: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "text.secondary",
                                  fontSize: 12,
                                }}
                              >
                                No image
                              </Box>
                            )}
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap title={p.title}>
                            {p.title}
                          </Typography>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="body2">₹{Number(p.price).toFixed(2)}</Typography>
                            {Number(p.discount_percent) > 0 ? (
                              <Typography variant="caption" color="text.secondary" sx={{ textDecoration: "line-through" }}>
                                ₹{Number(p.mrp).toFixed(2)}
                              </Typography>
                            ) : null}
                            {Number(p.discount_percent) > 0 ? (
                              <Chip size="small" color="success" label={`${Number(p.discount_percent).toFixed(0)}% OFF`} />
                            ) : null}
                          </Box>
                          <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                            {p.online_delivery ? <Chip size="small" label="Online" /> : null}
                            {p.offline_delivery ? <Chip size="small" label="Offline" /> : null}
                            <Chip
                              size="small"
                              label={p.stock_qty > 0 ? "In stock" : "Out of stock"}
                              color={p.stock_qty > 0 ? "default" : "warning"}
                            />
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                {!loadingProducts && (products || []).length === 0 ? (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      No products added yet.
                    </Typography>
                  </Grid>
                ) : null}
              </Grid>
            </Box>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
