import React from "react";
import { Box, Typography } from "@mui/material";
import SmartImage from "../SmartImage";

export default function ProductImageCard({ title, image, onClick }) {
  return (
    <Box
      onClick={onClick}
      role={onClick ? "button" : undefined}
      sx={{
        width: "100%",
        flex: "0 0 auto",
        cursor: onClick ? "pointer" : "default",
        borderRadius: 1.5,
        overflow: "hidden",
        bgcolor: "#fff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)", // elevation allowed ONLY here
      }}
      aria-label={title}
      title={title}
    >
      <Box sx={{ width: "100%", height: { xs: 185, sm: 205, md: 235 } }}>
        <SmartImage
          src={image}
          alt={title}
          type="product"
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            aspectRatio: "auto",
            border: "none",
            boxShadow: "none",
            borderRadius: 0,
          }}
        />
      </Box>

      <Box sx={{ p: 0.75 }}>
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.25,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          noWrap
        >
          {title}
        </Typography>
      </Box>
    </Box>
  );
}
