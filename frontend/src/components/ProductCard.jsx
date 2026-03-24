
import React from "react";
import { Box, Typography, IconButton } from "@mui/material";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";

export default function ProductCard({ product, onAddToCart }) {
  return (
    <Box
      sx={{
        minWidth: 160,
        borderRadius: 1,
        bgcolor: "#fff",
        p: 1.5,
        boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
        transition: "0.2s",
        "&:hover": { transform: "scale(1.03)" },
      }}
    >
      <Box sx={{ position: "relative" }}>
        <img src={product.image} style={{ width: "100%", borderRadius: 8 }} />

        <IconButton
          size="small"
          sx={{ position: "absolute", top: 5, right: 5, bgcolor: "#fff" }}
        >
          <FavoriteBorderIcon fontSize="small" />
        </IconButton>
      </Box>

      <Typography fontSize={13} fontWeight={700} mt={1}>
        {product.title}
      </Typography>

      <Typography fontSize={12} color="#16a34a" fontWeight={700}>
        Free delivery
      </Typography>

      <Typography fontSize={14} fontWeight={800}>
        ₹{product.price}
      </Typography>

      <Typography fontSize={11} color="#ef4444">
        Only few left
      </Typography>

      <Box
        onClick={() => onAddToCart && onAddToCart(product)}
        sx={{
          mt: 1,
          bgcolor: "#2563eb",
          color: "#fff",
          textAlign: "center",
          py: 0.5,
          borderRadius: 2,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        Add to Cart
      </Box>
    </Box>
  );
}
