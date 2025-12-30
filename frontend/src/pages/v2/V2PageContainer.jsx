import React from "react";
import { Box, Typography } from "@mui/material";
import colors from "./theme/colors";
import V2Card from "./components/V2Card";

/**
 * V2PageContainer
 * Shared container to keep all v2 screens visually consistent with the new UX.
 * - Dark background (inherits from shell)
 * - Optional page title
 * - Optional "flush" mode for pages that already render full layouts
 */
export default function V2PageContainer({ title, children, flush = false, actions = null }) {
  return (
    <Box sx={{ color: colors.textPrimary }}>
      {title ? (
        <Box sx={{ mb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: colors.textPrimary }}>{title}</Typography>
          {actions}
        </Box>
      ) : null}

      {flush ? <Box>{children}</Box> : <V2Card>{children}</V2Card>}
    </Box>
  );
}
