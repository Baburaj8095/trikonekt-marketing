import React from "react";
import { Box } from "@mui/material";
import cardTokens from "../theme/card";

/**
 * V2Card
 * Uniform rectangular card for all v2 surfaces.
 * - Radius: 12px
 * - Padding: 16px
 * - Border/Shadow: shared
 * - Hover/active: shared
 */
export default function V2Card({ children, sx = {}, hover = true, ...rest }) {
  return (
    <Box
      sx={{
        p: `${cardTokens.padding}px`,
        borderRadius: `${cardTokens.radius}px`,
        bgcolor: cardTokens.bg,
        border: cardTokens.border,
        boxShadow: cardTokens.shadow,
        transition: "background-color 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
        ...(hover
          ? {
              "&:hover": {
                bgcolor: cardTokens.hover.bg,
                border: cardTokens.hover.border,
                boxShadow: cardTokens.hover.shadow,
              },
            }
          : null),
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}
