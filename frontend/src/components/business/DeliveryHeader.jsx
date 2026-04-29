import React from "react";
import { alpha } from "@mui/material/styles";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";

const UI = {
  primary: "#0F52BA",
  secondary: "#2f6fd0",
  surface: "#ffffff",
  border: "#e5e7eb",
  text: "#1f2937",
};

export default function DeliveryHeader({ title = "Tri Sarathi Delivery", onBack, children }) {
  return (
    <Box
      component="header"
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1300,
        bgcolor: UI.surface,
        borderBottom: `1px solid ${UI.border}`,
        boxShadow: "0 8px 24px rgba(15,82,186,0.08)",
      }}
    >
      <Box sx={{ maxWidth: 720, mx: "auto", px: { xs: 1.25, sm: 2 }, py: 1 }}>
        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minHeight: 40 }}>
            <IconButton
              aria-label="Back"
              onClick={onBack}
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                color: UI.text,
                bgcolor: alpha(UI.primary, 0.07),
                flexShrink: 0,
              }}
            >
              <ArrowBackRoundedIcon sx={{ fontSize: 21 }} />
            </IconButton>
            <Typography
              sx={{
                fontSize: { xs: 17, sm: 19 },
                fontWeight: 900,
                color: UI.text,
                lineHeight: 1.1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </Typography>
          </Stack>
          {children}
        </Stack>
      </Box>
    </Box>
  );
}
