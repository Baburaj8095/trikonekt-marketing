import { Box } from "@mui/material";

const MAP = {
  hero: {
    ratio: "16 / 9",
    fit: "cover",
    bg: "#e5e7eb",
    priority: true,
  },
  category: {
    ratio: "1 / 1",
    fit: "contain",
    bg: "#ffffff",
  },
  product: {
    ratio: "1 / 1",
    fit: "cover",
    bg: "#ffffff",
  },

  promo: {
    ratio: "auto",
    fit: "contain",
    bg: "#ffffff",
  },
};

export default function SmartImage2({ src, type = "product", sx = {} }) {
  const cfg = MAP[type];

  return (
    <Box
      sx={{
        bgcolor: cfg.bg,
        borderRadius: 2,
        overflow: "hidden",
        aspectRatio:
          cfg.ratio && cfg.ratio !== "auto" ? cfg.ratio : undefined,
        ...sx,
      }}
    >
      <img
        src={src}
        alt=""
        loading={cfg.priority ? "eager" : "lazy"}
        style={{
          width: "100%",
          height: "100%",
          maxHeight: "100%",
          objectFit: cfg.fit, // 🔥 contain for promo
          display: "block",
        }}
      />
    </Box>
  );
}
