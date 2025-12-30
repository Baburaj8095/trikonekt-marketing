import React from "react";
import { Box } from "@mui/material";

const TYPE_MAP = {
  hero: { ratio: "16 / 9", fit: "cover" },
  product: { ratio: "4 / 3", fit: "contain" },
  category: { ratio: "1 / 1", fit: "contain" },
  banner: { ratio: "16 / 9", fit: "cover" },
  logo: { ratio: "3 / 2", fit: "contain" }
};

export default function SmartImage({ src, alt = "", type = "product", sx }) {
  const cfg = TYPE_MAP[type] || TYPE_MAP.product;

  return (
    <Box
      sx={{
        width: "100%",
        aspectRatio: cfg.ratio,
        backgroundColor: "#ffffff",
        border: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        ...sx
      }}
    >
      {src ? (
        <Box
          component="img"
          src={src}
          alt={alt}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          sx={{
            width: "100%",
            height: "100%",
            objectFit: cfg.fit
          }}
        />
      ) : null}
    </Box>
  );
}
