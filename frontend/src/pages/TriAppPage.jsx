import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  Alert,
  Chip,
  CircularProgress,
  Stack,
} from "@mui/material";
import { getTriApp } from "../api/api";
import normalizeMediaUrl from "../utils/media";
import { addProduct } from "../store/cart";

function Price({ value, currency = "₹" }) {
  try {
    const n = Number(value || 0);
    if (!isFinite(n) || n < 0) return null;
    const sign = currency === "INR" ? "₹" : currency || "₹";
    return (
      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0C2D48" }}>
        {sign}
        {n.toLocaleString("en-IN")}
      </Typography>
    );
  } catch {
    return null;
  }
}

export default function TriAppPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getTriApp(slug);
        if (!alive) return;
        setApp(data || null);
      } catch (e) {
        if (!alive) return;
        setError("Unable to load app. Please try again.");
        setApp(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [slug]);

  const allowPrice = !!app?.allow_price;
  const allowAddToCart = !!app?.allow_add_to_cart;
  const allowPayment = !!app?.allow_payment;

  const bannerUrl = useMemo(() => {
    const u = app?.banner_url || "";
    return u ? normalizeMediaUrl(u) : "";
  }, [app]);

  const products = Array.isArray(app?.products) ? app.products : [];

  const handleAddToCart = (p) => {
    try {
      addProduct({
        productId: p.id,
        name: p.name,
        unitPrice: allowPrice ? Number(p.price || 0) : 0,
        qty: 1,
        shipping_address: "",
        image_url: p.image_url || "",
        // TRI App reward points metadata
        tri: true,
        max_reward_pct: Number(p?.max_reward_points_percent || 0),
        tri_app_slug: slug,
      });
      // Small UX: route to cart quickly?
      // Keep user here but provide quick CTA to cart
      alert("Added to cart");
    } catch {
      // no-op
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#0C2D48" }}>
          {app?.name || "TRI"}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip size="small" label={`Products: ${products.length}`} />
          <Button
            size="small"
            variant="contained"
            onClick={() => navigate("/user/cart")}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            View Cart
          </Button>
        </Stack>
      </Stack>

      {loading ? (
        <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={18} /> <Typography variant="body2">Loading…</Typography>
        </Box>
      ) : null}

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {/* Banner */}
      {bannerUrl ? (
        <Box
          sx={{
            position: "relative",
            borderRadius: 3,
            overflow: "hidden",
            mb: 2,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box
            component="img"
            src={bannerUrl}
            alt={app?.name || "TRI App"}
            sx={{ width: "100%", height: { xs: 160, sm: 220, md: 260 }, objectFit: "cover", display: "block" }}
          />
        </Box>
      ) : null}

      {/* Info / Controls */}
      {app?.description ? (
        <Paper
          elevation={0}
          sx={{ p: 2, mb: 2, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "#fff" }}
        >
          <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "pre-wrap" }}>
            {app.description}
          </Typography>
        </Paper>
      ) : null}

      {!allowPayment ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Payments are currently disabled for this app. You can browse products; checkout will be enabled once the admin turns it on.
        </Alert>
      ) : null}

      {!allowAddToCart ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Add to cart is disabled by admin. You can view product details and price{allowPrice ? "" : " (hidden)"}.
        </Alert>
      ) : null}

      {/* Products */}
      <Grid container spacing={2}>
        {products.map((p) => {
          const img = p?.image_url ? normalizeMediaUrl(p.image_url) : "";
          const priceNode = allowPrice ? <Price value={p?.price} currency={p?.currency || "₹"} /> : null;
          return (
            <Grid item xs={12} sm={6} md={4} key={p.id || p.name}>
              <Paper
                elevation={0}
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "#fff",
                  overflow: "hidden",
                }}
              >
                {img ? (
                  <Box
                    component="img"
                    src={img}
                    alt={p?.name || "Product"}
                    sx={{
                      width: "100%",
                      height: 160,
                      objectFit: "cover",
                      display: "block",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  />
                ) : null}
                <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1, flexGrow: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#0f172a" }}>
                    {p?.name || "Product"}
                  </Typography>
                  {priceNode}
                  {p?.description ? (
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      {p.description}
                    </Typography>
                  ) : null}
                  <Box sx={{ flexGrow: 1 }} />
                  <Stack direction="row" spacing={1}>
                    <Button
                      fullWidth
                      variant="contained"
                      disabled={!allowAddToCart}
                      onClick={() => handleAddToCart(p)}
                      sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                      {allowAddToCart ? "Add to Cart" : "Add to Cart Disabled"}
                    </Button>
                  </Stack>
                </Box>
              </Paper>
            </Grid>
          );
        })}
        {products.length === 0 && !loading ? (
          <Grid item xs={12}>
            <Alert severity="info">No products available.</Alert>
          </Grid>
        ) : null}
      </Grid>
    </Box>
  );
}
