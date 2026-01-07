import React from "react";
import { Box, Typography, Button } from "@mui/material";
import ProductCard from "./ProductCard";
import ProductSkeleton from "./ProductSkeleton";

function ProductStrip({ title, products }) {
  return (
    <Box mt={2}>
      <Box display="flex" justifyContent="space-between" mb={1}>
        <Typography fontSize={16} fontWeight={700}>
          {title}
        </Typography>
        <Button size="small">View All</Button>
      </Box>

      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          overflowX: "auto",
          pb: 1,
          WebkitOverflowScrolling: "touch",
          willChange: "transform",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {products.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))
          : products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
      </Box>
    </Box>
  );
}

export default React.memo(ProductStrip);
