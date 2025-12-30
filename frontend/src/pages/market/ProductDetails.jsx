import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Chip,
  Button,
  Card,
  CardMedia,
  Stack,
  TextField,
  Snackbar,
  Alert,
} from "@mui/material";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import API from "../../api/api";
import normalizeMediaUrl from "../../utils/media";
import { addProduct } from "../../store/cart";


export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qtyInput, setQtyInput] = useState("1");
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });

  const finalPrice = useMemo(() => {
    const price = Number(data?.price || 0);
    const discount = Number(data?.discount || 0);
    return price * (1 - discount / 100);
  }, [data?.price, data?.discount]);

  const totalAmount = useMemo(() => {
    const qty = Math.max(1, parseInt(qtyInput || "1", 10));
    return Number(finalPrice || 0) * qty;
  }, [finalPrice, qtyInput]);

  const load = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await API.get(`/products/${id}`, {
        dedupe: "cancelPrevious",
        cacheTTL: 15000,
      });
      setData(res?.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading && !data) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="body2">Loading...</Typography>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2">Product not found.</Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            {data.image_url ? (
              <CardMedia
                component="img"
                image={normalizeMediaUrl(data.image_url)}
                alt={data.name}
                sx={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover" }}
              />
            ) : (
              <Box sx={{ width: "100%", aspectRatio: "4 / 3", bgcolor: "#f1f5f9" }} />
            )}
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{data.name}</Typography>
            <Typography variant="body2" color="text.secondary">{data.category}</Typography>

            <Box sx={{ mt: 1, display: "flex", alignItems: "baseline", gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>₹{finalPrice.toFixed(2)}</Typography>
              {Number(data.discount || 0) > 0 && (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ textDecoration: "line-through" }}>
                    ₹{Number(data.price || 0).toFixed(2)}
                  </Typography>
                  <Chip label={`${Number(data.discount)}% OFF`} size="small" color="success" />
                </>
              )}
              {Number(data?.max_reward_redeem_percent || 0) > 0 && (
                <Chip label={`Rewards up to ${Number(data.max_reward_redeem_percent)}%`} size="small" />
              )}
            </Box>

            <Typography variant="body2" sx={{ mt: 1 }}>
              Seller: {data.created_by_name || "N/A"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Location: {[data.city, data.state, data.country, data.pincode].filter(Boolean).join(", ")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Available Quantity: {data.quantity}
            </Typography>

            <Stack direction="row" spacing={1} sx={{ mt: 2 }} alignItems="center">
              <Button variant="outlined" onClick={() => navigate(-1)}>Back</Button>
              {Number(data.quantity || 0) > 0 ? (
                <>
                  <TextField
                    size="small"
                    type="number"
                    value={qtyInput}
                    onChange={(e) => setQtyInput(e.target.value)}
                    onBlur={() => {
                      let q = parseInt(qtyInput, 10);
                      if (!Number.isFinite(q) || q < 1) q = 1;
                      setQtyInput(String(q));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        let q = parseInt(qtyInput, 10);
                        if (!Number.isFinite(q) || q < 1) q = 1;
                        setQtyInput(String(q));
                        try { e.currentTarget.blur(); } catch {}
                      }
                    }}
                    inputProps={{ min: 1 }}
                    sx={{ width: 100 }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => {
                      try {
                        const q = Math.max(1, parseInt(qtyInput || "1", 10));
                        const isTri = (location.pathname || "").includes("/trikonekt-products");
                        addProduct({
                          productId: Number(id),
                          name: data.name,
                          unitPrice: Number((Number(data?.price || 0) * (1 - Number(data?.discount || 0) / 100)).toFixed(2)),
                          qty: q,
                          shipping_address: "",
                          tri: isTri,
                          max_reward_pct: Number(data?.max_reward_redeem_percent || 0),
                          tri_app_slug: isTri ? "trikonekt" : "",
                        });
                        setSnack({ open: true, type: "success", msg: "Added to cart." });
                      } catch {
                        setSnack({ open: true, type: "error", msg: "Failed to add to cart." });
                      }
                    }}
                  >
                    Add to Cart
                  </Button>
                  <Button variant="contained" onClick={() => {
                    try {
                      const p = location.pathname || "";
                      if (p.startsWith("/agency")) navigate("/agency/cart");
                      else if (p.startsWith("/employee")) navigate("/employee/cart");
                      else navigate("/user/cart");
                    } catch {
                      navigate("/user/cart");
                    }
                  }}>Go to Cart</Button>
                </>
              ) : (
                <Button variant="contained" disabled>Out of Stock</Button>
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mt: 2, borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Description</Typography>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 1 }}>
              {data.description || "No description provided."}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

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
