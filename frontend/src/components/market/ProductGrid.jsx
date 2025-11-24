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
    <Grid container spacing={dense ? 1 : 2}>
      {items.map((p) => (
        <Grid key={p.id ?? `${p.name}-${p.image_url}-${p.price}`} item xs={dense ? 6 : 6} sm={dense ? 4 : 4} md={dense ? 3 : 3} lg={dense ? 2 : 3}>
          <Box sx={{ height: "100%", maxWidth: 320, mx: "auto", width: "100%" }}>
            <ProductCard product={p} onSelect={onSelect} onQuickView={onQuickView} dense={dense} />
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}

export default memo(ProductGrid);
