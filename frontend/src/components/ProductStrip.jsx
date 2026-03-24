import React from "react";
import { Box, Button, IconButton, Paper, Stack, Typography } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import ProductCard from "./ProductCard";

// Design tokens — keep in sync with UserDashboard T object
const T = {
  bg: "#F5F6FA",
  white: "#FFFFFF",
  primary: "#FF6B35",
  textPrimary: "#1A1D2E",
  textSecondary: "#6B7280",
  border: "#EAECF0",
  shadow: "0 2px 12px rgba(0,0,0,0.07)",
  radius: 2,
};

export default function ProductStrip({ title, products = [], onViewAll, onAddToCart, showAddToCart }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: T.radius,
        bgcolor: T.white,
        boxShadow: T.shadow,
      }}
    >
      {/* Section header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
        <Typography
          sx={{ fontSize: 16, fontWeight: 800, color: T.textPrimary, letterSpacing: "-0.2px" }}
        >
          {title}
        </Typography>
        <Button
          endIcon={<ChevronRightIcon sx={{ fontSize: 15 }} />}
          onClick={onViewAll}
          size="small"
          sx={{
            textTransform: "none",
            fontWeight: 700,
            fontSize: 13,
            color: T.primary,
            px: 0,
            minWidth: 0,
            "&:hover": { background: "none" },
          }}
        >
          View All
        </Button>
      </Stack>

      {/* Horizontal scroll strip */}
      <Box
        sx={{
          display: "flex",
          gap: 1.25,
          overflowX: "auto",
          pb: 0.5,
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {products.map((p) => (
          <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} showAddToCart={showAddToCart} />
        ))}
      </Box>
    </Paper>
  );
}
