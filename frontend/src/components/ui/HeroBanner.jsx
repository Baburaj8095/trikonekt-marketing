import React from "react";
import { Box, Chip, Typography } from "@mui/material";

/**
 * HeroBanner — compact top banner with background image and badge
 *
 * Props:
 * - title: string
 * - badge?: string
 * - imageUrl?: string
 * - onClick?: () => void
 *
 * Notes:
 * - Rounded rectangle (16px), not oval.
 * - Compact height (mobile-first), premium gradient overlay.
 * - Text always readable; image is decorative.
 */
export default function HeroBanner({ title, badge, imageUrl, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        position: "relative",
        height: { xs: 120, sm: 140 },
        borderRadius: 12,
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        boxShadow: "0 8px 24px rgba(2,6,12,0.10)",
        background:
          imageUrl
            ? `linear-gradient(180deg, rgba(2,6,12,0.18) 0%, rgba(2,6,12,0.44) 100%), url(${imageUrl}) center/cover no-repeat`
            : "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
      }}
    >
      {/* Optional subtle pattern overlay (disabled by default) */}
      {/* <Box sx={{ position: "absolute", inset: 0, opacity: 0.06, backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "16px 16px" }} /> */}
      {badge ? (
        <Chip
          size="small"
          label={badge}
          sx={{
            position: "absolute",
            top: 10,
            right: 10,
            fontWeight: 600,
            bgcolor: "rgba(255,255,255,0.18)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.28)",
          }}
        />
      ) : null}

      <Box
        sx={{
          position: "absolute",
          left: 16,
          bottom: 14,
          right: 16,
          color: "#fff",
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.9 }}>
          Tap to explore
        </Typography>
      </Box>
    </Box>
  );
}
