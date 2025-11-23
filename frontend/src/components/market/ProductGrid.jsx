import React, { memo } from "react";
import { Grid, Paper, Typography, Box } from "@mui/material";
import ProductCard from "./ProductCard";

/**
 * ProductGrid
 * Renders a responsive grid of ProductCard components.
 *
 * Props:
 * - items: array of products
 * - onSelect(product): navigate/select handler
 * - onQuickView?(product): optional quick view handler
 * - dense?: boolean (compact cards)
 * - emptyMessage?: string (fallback message)
 */
function ProductGrid({ items = [], onSelect, onQuickView, dense = false, emptyMessage = "No products found for the selected filters." }) {
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
    <Grid container spacing={2}>
      {items.map((p) => (
        <Grid key={p.id ?? `${p.name}-${p.image_url}-${p.price}`} item xs={12} sm={6} md={4} lg={3}>
          <Box sx={{ height: "100%" }}>
            <ProductCard product={p} onSelect={onSelect} onQuickView={onQuickView} dense={dense} />
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}

export default memo(ProductGrid);
