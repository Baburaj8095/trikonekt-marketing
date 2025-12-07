import React, { useMemo, useState } from "react";
import {
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Box,
  Typography,
  Chip,
  Stack,
  IconButton,
  TextField,
  Tooltip,
  Button,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import ShoppingCartCheckoutIcon from "@mui/icons-material/ShoppingCartCheckout";

/**
 * ECouponProductCard
 * - Ecommerce look for e-coupons
 * - Shows brand image placeholder, title, denomination, unit price, available, qty stepper, add to cart
 *
 * Props:
 * - product: { id, display_title, display_desc, denomination, price_per_unit }
 * - available?: number | null  // total available across this denomination
 * - onAddToCart?: (productId: string | number, qty: number) => void
 * - onClick?: (product) => void   // optional card click handler
 * - dense?: boolean
 */
export default function ECouponProductCard({ product, available = null, onAddToCart, onClick, dense = false }) {
  const [qty, setQty] = useState(1);
  const unit = Number(product?.price_per_unit || 0);
  const q = Math.max(1, parseInt(qty || 1, 10));
  const total = unit * q;
  const outOfStock = Number.isFinite(available) ? Number(available) <= 0 : false;

  const title = product?.display_title || "E‑Coupon";
  const desc = product?.display_desc || "";

  const handleDec = () => setQty((x) => Math.max(1, parseInt(x || 1, 10) - 1));
  const handleInc = () => setQty((x) => Math.max(1, parseInt(x || 1, 10) + 1));

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 2,
        overflow: "hidden",
        position: "relative",
        transition: "box-shadow 0.2s ease, transform 0.18s ease",
        "&:hover": { boxShadow: 4, transform: "translateY(-2px)" },
      }}
    >
      <Box sx={{ position: "relative" }}>
        {outOfStock && (
          <Chip
            label="Out of Stock"
            size="small"
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 2,
              fontWeight: 800,
              bgcolor: "grey.800",
              color: "#fff",
            }}
          />
        )}
        <CardActionArea
          onClick={() => (typeof onClick === "function" ? onClick(product) : null)}
          sx={{ opacity: outOfStock ? 0.85 : 1 }}
        >
          {/* Image placeholder (brand / rupee) */}
          <CardMedia
            component="img"
            src={"data:image/svg+xml;utf8," + encodeURIComponent(`
              <svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'>
                <rect width='100%' height='100%' fill='#f1f5f9'/>
                <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Montserrat,Arial' font-size='72' fill='#94a3b8'>₹</text>
              </svg>
            `)}
            alt="E‑Coupon"
            loading="lazy"
            style={{ width: "100%", aspectRatio: dense ? "1 / 1" : "4 / 3", objectFit: "cover" }}
          />
        </CardActionArea>
      </Box>

      <CardContent sx={{ p: dense ? 1.25 : 1.5 }}>
        <Typography
          variant={dense ? "body2" : "subtitle2"}
          sx={{
            fontWeight: 800,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: dense ? 28 : 36,
          }}
          title={title}
        >
          {title}
        </Typography>

        {desc ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: "block",
              mt: 0.25,
              minHeight: dense ? 28 : 32,
              overflow: "hidden",
              textOverflow: "ellipsis",
              displayPrint: "none",
            }}
          >
            {desc}
          </Typography>
        ) : null}

        {/* Quick facts */}
        <Stack direction="row" spacing={2} sx={{ mt: 1 }} alignItems="baseline">
          <Stack spacing={0.25}>
            <Typography variant="caption" color="text.secondary">
              Denomination
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 900 }}>
              ₹{product?.denomination}
            </Typography>
          </Stack>
          <Stack spacing={0.25}>
            <Typography variant="caption" color="text.secondary">
              Unit Price
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 900 }}>
              ₹{isFinite(unit) ? unit.toFixed(2) : "0.00"}
            </Typography>
          </Stack>
          <Stack spacing={0.25}>
            <Typography variant="caption" color="text.secondary">
              Available
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 900 }}>
              {Number.isFinite(available) ? available : "—"}
            </Typography>
          </Stack>
        </Stack>

        {/* Qty + Add to Cart */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <IconButton size="small" onClick={handleDec} sx={{ border: "1px solid #e5e7eb" }}>
              <RemoveIcon fontSize="small" />
            </IconButton>
            <TextField
              size="small"
              type="number"
              value={q}
              inputProps={{ min: 1, style: { textAlign: "center", width: 56 } }}
              onChange={(e) => {
                let next = parseInt(e.target.value, 10);
                if (!Number.isFinite(next) || next < 1) next = 1;
                setQty(next);
              }}
            />
            <IconButton size="small" onClick={handleInc} sx={{ border: "1px solid #e5e7eb" }}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Box flex={1} />
          <Tooltip title={outOfStock ? "Out of Stock" : "Add to Cart"}>
            <span>
              <Button
                size="small"
                variant="contained"
                startIcon={<ShoppingCartCheckoutIcon />}
                disabled={outOfStock}
                onClick={() => {
                  if (typeof onAddToCart === "function") onAddToCart(product.id, q);
                }}
                sx={{ fontWeight: 800 }}
              >
                Add
              </Button>
            </span>
          </Tooltip>
        </Stack>

        {/* Total */}
        <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Total:
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 900 }}>
            ₹{isFinite(total) ? total.toFixed(2) : "0.00"}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
