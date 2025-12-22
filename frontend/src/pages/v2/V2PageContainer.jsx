import React from "react";
import { Box, Typography } from "@mui/material";

/**
 * V2PageContainer
 * Shared container to keep all v2 screens visually consistent with the new UX.
 * - Dark background (inherits from shell)
 * - Optional page title
 * - Optional "flush" mode for pages that already render full layouts
 */
export default function V2PageContainer({ title, children, flush = false, actions = null }) {
  return (
    <Box sx={{ color: "#e5e7eb" }}>
      {title ? (
        <Box sx={{ mb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{title}</Typography>
          {actions}
        </Box>
      ) : null}

      {flush ? (
        <Box>{children}</Box>
      ) : (
        <Box
          sx={{
            bgcolor: "#111827",
            borderRadius: 2,
            border: "1px solid rgba(255,255,255,0.08)",
            p: { xs: 1.5, sm: 2 },
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
}
