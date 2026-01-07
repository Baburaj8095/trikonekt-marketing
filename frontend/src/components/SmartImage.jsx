import React from "react";
import { Box } from "@mui/material";

const TYPE_MAP = {
hero: {
    ratio: "16 / 9",
    fit: "cover",
    bg: "#e5e7eb",
    priority: true,
  },
banner: { ratio: "16 / 9", fit: "cover", bg: "#f1f5f9" },
product: { ratio: "1 / 1", fit: "cover", bg: "#f8fafc" },
category: { ratio: "1 / 1", fit: "contain", bg: "#ffffff" },
logo: { ratio: "3 / 2", fit: "contain", bg: "#ffffff" },
thumb: { ratio: "1 / 1", fit: "contain", bg: "#f3f4f6" },
};

export default function SmartImage({ src, alt = "", type = "product", sx = {} }) {
  const cfg = TYPE_MAP[type] || TYPE_MAP.product;
  const isHero = type === "hero";

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        ...(isHero ? {} : { aspectRatio: cfg.ratio }),
        backgroundColor: cfg.bg,
        overflow: "hidden",
        position: "relative",
        ...sx,
      }}
    >
      <Box
        component="img"
        src={src || "/placeholder.png"}
        alt={alt}
        loading="lazy"
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: cfg.fit,
          display: "block",
        }}
      />
    </Box>
  );
}

