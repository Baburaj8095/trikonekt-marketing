import React from "react";
import { Box } from "@mui/material";

export default function SmartPromoImage({ src, alt = "", sx = {} }) {
  const [ratio, setRatio] = React.useState("16 / 9"); // default banner

  React.useEffect(() => {
    if (!src) return;

    const img = new Image();
    img.src = src;

    img.onload = () => {
      const w = img.naturalWidth || 1;
      const h = img.naturalHeight || 1;

      // portrait
      if (h > w) setRatio("3 / 4");
      // square
      else if (Math.abs(w - h) < 30) setRatio("1 / 1");
      // landscape
      else setRatio("16 / 9");
    };
  }, [src]);

  return (
    <Box
      sx={{
        width: "100%",
        aspectRatio: ratio,
        borderRadius: 3,
        overflow: "hidden",
        backgroundColor: "#fff",
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
          objectFit: "fill", // âœ… always looks premium
          display: "block",
        }}
      />
    </Box>
  );
}

