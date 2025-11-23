import React, { memo } from "react";
import {
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Box,
  Typography,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Rating,
} from "@mui/material";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

/**
 * ProductCard
 * Reusable e-commerce style card with discount badge, price strike-through,
 * rating, and optional quick view/wishlist actions.
 *
 * Props:
 * - product: {
 *     id, name, price, discount, quantity, image_url,
 *     city, state, country, created_by_name,
 *     rating, reviews_count
 *   }
 * - onSelect(product): click handler (e.g., navigate to details)
 * - onQuickView?(product): optional handler for quick view modal
 * - dense?: boolean (smaller paddings)
 */
function ProductCard({ product, onSelect, onQuickView, dense = false }) {
  const price = Number(product?.price || 0);
  const discount = Number(product?.discount || 0);
  const finalPrice = price * (1 - discount / 100);
  const outOfStock = Number(product?.quantity || 0) <= 0;

  const locationLabel = [product?.city, product?.state, product?.country]
    .filter(Boolean)
    .join(", ");

  const handleClick = () => {
    if (outOfStock) return;
    if (typeof onSelect === "function") onSelect(product);
  };

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 2,
        overflow: "hidden",
        position: "relative",
        "&:hover": { boxShadow: 3 },
        transition: "box-shadow 0.2s ease",
      }}
    >
      <Box sx={{ position: "relative" }}>
        {discount > 0 && (
          <Chip
            label={`${discount}% OFF`}
            color="error"
            size="small"
            sx={{
              position: "absolute",
              top: 8,
              left: 8,
              zIndex: 2,
              fontWeight: 700,
            }}
          />
        )}

        {outOfStock && (
          <Chip
            label="Sold Out"
            color="default"
            size="small"
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 2,
              fontWeight: 700,
              bgcolor: "grey.800",
              color: "#fff",
            }}
          />
        )}

        <CardActionArea onClick={handleClick} sx={{ opacity: outOfStock ? 0.85 : 1 }}>
          {product?.image_url ? (
            <CardMedia
              component="img"
              image={product.image_url}
              alt={product?.name || "Product"}
              loading="lazy"
              sx={{
                width: "100%",
                aspectRatio: "4 / 3",
                objectFit: "cover",
                transition: "transform 0.25s ease",
                "&:hover": { transform: "scale(1.02)" },
              }}
            />
          ) : (
            <Box sx={{ width: "100%", aspectRatio: "4 / 3", bgcolor: "#f1f5f9" }} />
          )}
        </CardActionArea>
      </Box>

      <CardContent sx={{ p: dense ? 1.25 : 1.5 }}>
        {/* Title */}
        <Typography
          variant="subtitle2"
          title={product?.name}
          sx={{
            fontWeight: 700,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: 36,
          }}
        >
          {product?.name}
        </Typography>

        {/* Location */}
        {locationLabel ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: "block",
              mt: 0.25,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={locationLabel}
          >
            {locationLabel}
          </Typography>
        ) : null}

        {/* Price row */}
        <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mt: 0.75 }}>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>
            ₹{isFinite(finalPrice) ? finalPrice.toFixed(2) : "0.00"}
          </Typography>
          {discount > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textDecoration: "line-through" }}
            >
              ₹{isFinite(price) ? price.toFixed(2) : "0.00"}
            </Typography>
          )}
        </Stack>

        {/* Rating and seller */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mt: 0.5 }}
        >
          {typeof product?.rating === "number" ? (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Rating
                name={`rating-${product?.id}`}
                value={Number(product.rating)}
                precision={0.5}
                size="small"
                readOnly
              />
              {typeof product?.reviews_count === "number" && (
                <Typography variant="caption" color="text.secondary">
                  ({product.reviews_count})
                </Typography>
              )}
            </Stack>
          ) : (
            <Box />
          )}

          {product?.created_by_name ? (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              Seller: {product.created_by_name}
            </Typography>
          ) : null}
        </Stack>

        {/* Actions */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="flex-end"
          spacing={0.5}
          sx={{ mt: 0.5 }}
        >
          {typeof onQuickView === "function" && (
            <Tooltip title="Quick view">
              <IconButton size="small" onClick={() => onQuickView(product)}>
                <VisibilityOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Add to wishlist">
            <span>
              <IconButton size="small" disabled>
                <FavoriteBorderIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        {outOfStock && (
          <Typography
            variant="caption"
            color="error"
            sx={{ fontWeight: 700, display: "block", mt: 0.5 }}
          >
            This product is out of stock.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default memo(ProductCard);
