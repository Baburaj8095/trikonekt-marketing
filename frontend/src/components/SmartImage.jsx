import React from "react";
import { Box } from "@mui/material";

const TYPE_MAP = {
  hero: { ratio: "16 / 9", fit: "cover", bg: "#f1f5f9" },
  banner: { ratio: "16 / 9", fit: "cover", bg: "#f1f5f9" },
  product: { ratio: "1 / 1", fit: "cover", bg: "#f8fafc" },
  category: { ratio: "1 / 1", fit: "contain", bg: "#ffffff" },
  logo: { ratio: "3 / 2", fit: "contain", bg: "#ffffff" }
};

export default function SmartImage({ src, alt = "", type = "product", sx }) {
  const cfg = TYPE_MAP[type] || TYPE_MAP.product;

  return (
    <Box
      sx={{
        width: "100%",
        aspectRatio: cfg.ratio,
        backgroundColor: cfg.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        ...sx
      }}
    >
      <Box
        component="img"
        src={src || "/placeholder.png"}
        alt={alt}
        loading="lazy"
        sx={{
          width: "100%",
          height: "100%",
          objectFit: cfg.fit,
          display: "block"
        }}
      />
    </Box>
  );
}
