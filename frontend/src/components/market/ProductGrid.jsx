import React, { memo } from "react";
import { Grid, Paper, Typography, Box } from "@mui/material";
import ProductCard from "./ProductCard";

/**
 * ProductGrid
 * Responsive grid of ProductCard components.
 *
 * Props:
 * - items: array of products
 * - onSelect(product): navigate/select handler
 * - onQuickView?(product): optional quick view handler
 * - onAddToCart?(product): optional add-to-cart handler
 * - showAddToCart?: boolean (show Add to Cart button on cards)
 * - dense?: boolean (compact cards)
 * - emptyMessage?: string (fallback message)
 */
function ProductGrid({
  items = [],
  onSelect,
  onQuickView,
  onAddToCart,
  showAddToCart = false,
  dense = false,
  emptyMessage = "No products found for the selected filters.",
}) {
  if (!items || items.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      </Paper>
    );
  }

  return (
    <Grid container spacing={dense ? 1 : 2}>
      {items.map((p) => (
        <Grid
          key={p.id ?? `${p.name}-${p.image_url}-${p.price}`}
          item
          xs={12}
          sm={6}
          md={4}
          lg={4}
        >
          <Box sx={{ height: "100%", maxWidth: 360, mx: "auto", width: "100%" }}>
            <ProductCard
              product={p}
              onSelect={onSelect}
              onQuickView={onQuickView}
              onAddToCart={onAddToCart}
              showAddToCart={showAddToCart}
              dense={dense}
            />
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}

export default memo(ProductGrid);
