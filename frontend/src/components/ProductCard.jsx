import React from "react";
import { Card, Box, Typography, Button } from "@mui/material";
import SmartImage from "./SmartImage";

function ProductCard({ product }) {
  const discount =
    product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;

  return (
    <Card sx={{ minWidth: 170, borderRadius: 2 }}>
      <Box sx={{ position: "relative", height: 120 }}>
        <SmartImage type="product" src={product.image} />

        {discount > 0 && (
          <Box
            sx={{
              position: "absolute",
              top: 8,
              left: 8,
              bgcolor: "#dc2626",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
            }}
          >
            {discount}% OFF
          </Box>
        )}
      </Box>

      <Box p={1}>
        <Typography fontSize={13} fontWeight={600} noWrap>
          {product.title}
        </Typography>

        <Box display="flex" gap={0.5} alignItems="center">
          <Typography fontWeight={700} color="#16a34a">
            ₹{product.price}
          </Typography>
          <Typography
            fontSize={12}
            sx={{ textDecoration: "line-through", color: "#64748b" }}
          >
            ₹{product.mrp}
          </Typography>
        </Box>

        {/* <Button
          fullWidth
          size="small"
          variant="contained"
          sx={{ mt: 0.5, py: 0.6, fontSize: 13, borderRadius: 1.5 }}
        >
          Add to Cart
        </Button> */}
      </Box>
    </Card>
  );
}

export default React.memo(ProductCard);
