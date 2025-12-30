import React from "react";
import { Box, Typography } from "@mui/material";

/**
 * Section wrapper to maintain vertical rhythm and simple headings.
 * Props:
 * - title?: string
 * - children: ReactNode
 * - mb?: number | object (spacing after section)
 */
export default function Section({ title, children, mb = { xs: 2, sm: 3 } }) {
  return (
    <Box sx={{ display: "grid", gap: 1.5, mb }}>
      {title ? (
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 700, color: "text.primary", px: 0.5 }}
        >
          {title}
        </Typography>
      ) : null}
      {children}
    </Box>
  );
}
