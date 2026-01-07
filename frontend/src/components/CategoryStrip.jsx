import React from "react";
import { Box, Typography } from "@mui/material";
import SmartImage from "./SmartImage";

function CategoryStrip({ categories, onClick }) {
  return (
    <Box mt={2}>
      <Typography fontSize={16} fontWeight={700} mb={1}>
        Shop by Categories
      </Typography>

      <Box
        sx={{
          display: "flex",
          gap: 2,
          overflowX: "auto",
          pb: 1,
          WebkitOverflowScrolling: "touch",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {categories.map((c) => (
          <Box
            key={c.label}
            onClick={() => onClick(c.route)}
            sx={{ minWidth: 72, textAlign: "center", cursor: "pointer" }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                mx: "auto",
                borderRadius: "50%",
                bgcolor: "#fff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SmartImage
                type="category"
                src={c.image}
                sx={{ width: 32, height: 32 }}
              />
            </Box>

            <Typography fontSize={12} fontWeight={600} mt={0.5}>
              {c.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default React.memo(CategoryStrip);
