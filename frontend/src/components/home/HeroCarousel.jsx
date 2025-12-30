import { Box } from "@mui/material";
import { useEffect, useState } from "react";

export default function HeroCarousel({ banners = [] }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!banners.length) return;
    const id = setInterval(() => {
      setIdx((p) => (p + 1) % banners.length);
    }, 4000);
    return () => clearInterval(id);
  }, [banners]);

  return (
    <Box sx={{ height: 180, borderRadius: 2, overflow: "hidden" }}>
      <img
        src={banners[idx]}
        alt="banner"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </Box>
  );
}
