import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
} from "@mui/material";
import { getTriApp } from "../api/api";
import normalizeMediaUrl from "../utils/media";
import { addProduct as addCartProduct } from "../store/cart";

function Price({ value, currency = "₹" }) {
  const n = Number(value || 0);
  if (!isFinite(n) || n < 0) return null;
  const sign = currency === "INR" ? "₹" : currency || "₹";
  return (
    <Typography sx={{ fontWeight: 800, fontSize: 14, color: "#0C2D48" }}>
      {sign}
      {n.toLocaleString("en-IN")}
    </Typography>
  );
}

export default function TriAppPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const data = await getTriApp(slug);
        if (alive) setApp(data || null);
      } catch {
        if (alive) setError("Unable to load products.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => (alive = false);
  }, [slug]);

  const products = Array.isArray(app?.products) ? app.products : [];

  const bannerUrl = useMemo(() => {
    return app?.banner_url ? normalizeMediaUrl(app.banner_url) : "";
  }, [app]);

  return (
    <Box sx={{ px: 1, py: 2, width: "100%" }}>
      {/* ===== HEADER ===== */}
      <Box
        sx={{
          mb: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 800 }}>
            {app?.name || "TRI"}
          </Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
            {products.length} products
          </Typography>
        </Box>

        <Button
          size="small"
          variant="contained"
          onClick={() => navigate("/user/cart")}
          sx={{
            textTransform: "none",
            fontSize: 12,
            fontWeight: 700,
            px: 1.5,
          }}
        >
          Cart
        </Button>
      </Box>

      {/* ===== LOADING / ERROR ===== */}
      {loading && (
        <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2">Loading…</Typography>
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {/* ===== BANNER ===== */}
      {bannerUrl && (
        <Box
          component="img"
          src={bannerUrl}
          alt={app?.name}
          sx={{
            width: "100%",
            height: 110,
            objectFit: "cover",
            borderRadius: 2,
            mb: 2,
          }}
        />
      )}

      {/* ===== PRODUCT GRID (PURE CSS GRID) ===== */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 1,
          width: "100%",
        }}
      >
        {products.map((p) => {
          const img = p?.image_url ? normalizeMediaUrl(p.image_url) : "";

          return (
            <Paper
              key={p.id}
              elevation={0}
              onClick={() =>
                navigate(`/trikonekt-products/products/${p.id}`)
              }
              sx={{
                height: 240,
                display: "flex",
                flexDirection: "column",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                bgcolor: "#fff",
                cursor: "pointer",
                overflow: "hidden",
              }}
            >
              {/* Image */}
              <Box
                sx={{
                  height: 110,
                  bgcolor: "#f8fafc",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {img && (
                  <Box
                    component="img"
                    src={img}
                    alt={p.name}
                    sx={{
                      maxWidth: "90%",
                      maxHeight: "90%",
                      objectFit: "contain",
                    }}
                  />
                )}
              </Box>

              {/* Content */}
              <Box
                sx={{
                  p: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.5,
                  flexGrow: 1,
                }}
              >
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.4,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {p.name}
                </Typography>

                <Price value={p.price} currency={p.currency} />

                <Typography variant="caption" color="text.secondary">
                  Earn up to {p?.max_reward_points_percent || 0}% rewards
                </Typography>

                <Button
                  variant="contained"
                  size="small"
                  fullWidth
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    try {
                      addCartProduct({
                        productId: p.id,
                        name: p.name,
                        unitPrice: Number(p.price || 0),
                        qty: 1,
                        shipping_address: "",
                        image_url: p?.image_url || "",
                        tri: true,
                        max_reward_pct: Number(p?.max_reward_points_percent || 0),
                        tri_app_slug: slug || "",
                      });
                    } catch {}
                  }}
                  sx={{ mt: 0.5, textTransform: "none", fontWeight: 800 }}
                >
                  Add to Cart
                </Button>

                <Box sx={{ flexGrow: 1 }} />

                {/* <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "primary.main",
                  }}
                >
                  View →
                </Typography> */}
              </Box>
            </Paper>
          );
        })}
      </Box>

      {!loading && products.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No products available.
        </Alert>
      )}
    </Box>
  );
}
