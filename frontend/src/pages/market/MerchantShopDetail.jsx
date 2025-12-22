import React, { useEffect, useState } from "react";
import { Box, Typography, Chip, Button, Grid, Paper, Divider, Skeleton } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import NearMeIcon from "@mui/icons-material/NearMe";
import PlaceIcon from "@mui/icons-material/Place";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { useParams, useNavigate } from "react-router-dom";
import { getShopDetail } from "../../api/api";

export default function MerchantShopDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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
                      {shop.city || "—"}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <PlaceIcon fontSize="small" sx={{ color: "text.secondary" }} />
                  <Typography variant="body2" color="text.secondary">
                    {shop.city || "—"}
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
                  {shop.contact_number || "—"}
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
                  Added on {shop.created_at ? new Date(shop.created_at).toLocaleString() : "—"}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
