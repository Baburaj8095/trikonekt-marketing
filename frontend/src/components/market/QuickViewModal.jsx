import React, { memo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Stack,
  Rating,
  Chip,
} from "@mui/material";
import normalizeMediaUrl from "../../utils/media";

/**
 * QuickViewModal
 * Lightweight modal to preview a product without leaving the listing.
 *
 * Props:
 * - open: boolean
 * - product: product object (nullable)
 * - onClose(): void
 * - onGoToDetails(): void
 */
function QuickViewModal({ open, product, onClose, onGoToDetails }) {
  const price = Number(product?.price || 0);
  const discount = Number(product?.discount || 0);
  const finalPrice = price * (1 - discount / 100);
  const outOfStock = Number(product?.quantity || 0) <= 0;

  const locationLabel = [product?.city, product?.state, product?.country]
    .filter(Boolean)
    .join(", ");

  return (
    <Dialog open={!!open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pr: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, flexGrow: 1 }}>
            {product?.name || "Product"}
          </Typography>
          {discount > 0 && <Chip label={`${discount}% OFF`} color="error" size="small" />}
          {outOfStock && (
            <Chip
              label="Sold Out"
              color="default"
              size="small"
              sx={{ bgcolor: "grey.800", color: "#fff" }}
            />
          )}
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Box
            sx={{
              flex: { xs: "none", md: "0 0 48%" },
              borderRadius: 2,
              overflow: "hidden",
              bgcolor: "#f8fafc",
            }}
          >
            {product?.image_url ? (
              <Box
                component="img"
                src={normalizeMediaUrl(product.image_url)}
                alt={product?.name || "Product"}
                loading="lazy"
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  aspectRatio: "4 / 3",
                }}
              />
            ) : (
              <Box sx={{ width: "100%", aspectRatio: "4 / 3", bgcolor: "#f1f5f9" }} />
            )}
          </Box>

          <Box sx={{ flex: 1 }}>
            {locationLabel ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                {locationLabel}
              </Typography>
            ) : null}

            <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                ₹{isFinite(finalPrice) ? finalPrice.toFixed(2) : "0.00"}
              </Typography>
              {discount > 0 && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textDecoration: "line-through" }}
                >
                  ₹{isFinite(price) ? price.toFixed(2) : "0.00"}
                </Typography>
              )}
            </Stack>

            {/* Rating */}
            {typeof product?.rating === "number" && (
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
                <Rating value={Number(product.rating)} precision={0.5} size="small" readOnly />
                {typeof product?.reviews_count === "number" && (
                  <Typography variant="caption" color="text.secondary">
                    ({product.reviews_count})
                  </Typography>
                )}
              </Stack>
            )}

            {/* Seller */}
            {product?.created_by_name ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                Seller: {product.created_by_name}
              </Typography>
            ) : null}

            {/* Optional description if available */}
            {product?.description ? (
              <Typography
                variant="body2"
                sx={{
                  display: "-webkit-box",
                  WebkitLineClamp: 6,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {product.description}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No description provided.
              </Typography>
            )}

            {outOfStock && (
              <Typography variant="caption" color="error" sx={{ fontWeight: 700, display: "block", mt: 1 }}>
                This product is out of stock.
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          onClick={onGoToDetails}
          disabled={outOfStock || !product?.id}
        >
          View details
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default memo(QuickViewModal);
