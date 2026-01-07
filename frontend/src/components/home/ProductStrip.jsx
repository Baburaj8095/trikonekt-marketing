import React from "react";
import { Box, Typography, Button } from "@mui/material";
import ProductImageCard from "./ProductImageCard";

export default function ProductStrip({ title, items = [], onViewAll, renderItem }) {
  return (
    <Box sx={{ width: "100%" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: { xs: 0.75, sm: 1 },
        }}
      >
        <Typography sx={{ fontSize: { xs: 14, sm: 16 }, fontWeight: 600 }}>
          {title}
        </Typography>
        {onViewAll && (
          <Button
            size="small"
            onClick={onViewAll}
            sx={{ textTransform: "none", fontWeight: 600, minWidth: "auto" }}
          >
            View All
          </Button>
        )}
      </Box>

      <Box
        sx={{
          display: "flex",
          gap: 1.25,
          overflowX: "auto",
          overflowY: "hidden",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          pb: 0.5,
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {items.map((it) => {
          const content = renderItem
            ? renderItem(it)
            : (
              <ProductImageCard
                title={it.title}
                image={it.image}
                onClick={it.onClick}
              />
            );

          return (
            <Box
              key={it.id || it.title}
              sx={{
                scrollSnapAlign: "start",
                flex: "0 0 auto",
                minWidth: { xs: "78vw", sm: "60vw", md: 260, lg: 280 }
              }}
            >
              {content}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
