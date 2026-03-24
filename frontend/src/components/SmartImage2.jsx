import { Box } from "@mui/material";

const MAP = {
  hero: {
    maxHeight: 220,
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

  if (type === "hero") {
    return (
      <Box
        sx={{
          bgcolor: cfg.bg,
          overflow: "hidden",
          width: "100%",
          maxHeight: cfg.maxHeight,
          lineHeight: 0,
          ...sx,
        }}
      >
        <img
          src={src}
          alt=""
          loading="eager"
          style={{
            width: "100%",
            height: "100%",
            maxHeight: cfg.maxHeight,
            objectFit: "cover",
            display: "block",
          }}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: cfg.bg,
        borderRadius: 2,
        overflow: "hidden",
        aspectRatio: cfg.ratio && cfg.ratio !== "auto" ? cfg.ratio : undefined,
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
          objectFit: cfg.fit,
          display: "block",
        }}
      />
    </Box>
  );
}
