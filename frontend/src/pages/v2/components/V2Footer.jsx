import React from "react";
import { Box, Typography, Link as MUILink } from "@mui/material";
import colors from "../theme/colors";
import spacing from "../theme/spacing";

/**
 * V2Footer
 * Standard footer used across all v2 pages.
 * Structure:
 * - Page container (max-width 1200px)
 * - Small muted text and a few links
 */
export default function V2Footer() {
  return (
    <Box
      component="footer"
      sx={{
        mt: `${spacing.section}px`,
        bgcolor: colors.surface,
        borderTop: `1px solid ${colors.border}`,
        color: colors.textSecondary,
      }}
    >
      <Box
        sx={{
          maxWidth: 1200,
          mx: "auto",
          px: {
            xs: `${spacing.pagePadding.mobile}px`,
            sm: `${spacing.pagePadding.tablet}px`,
            md: `${spacing.pagePadding.desktop}px`,
          },
          py: `${spacing.lg}px`,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: `${spacing.sm}px`,
        }}
      >
        <Typography sx={{ fontSize: 12 }}>
          © {new Date().getFullYear()} Trikonekt. All rights reserved.
        </Typography>

        <Box sx={{ display: "flex", gap: `${spacing.md}px` }}>
          <MUILink href="/user/dashboard2?tab=profile&screen=support2" underline="none" sx={{ fontSize: 12, color: colors.textSecondary }}>
            Support
          </MUILink>
          <MUILink href="/user/dashboard2?tab=profile&screen=support2" underline="none" sx={{ fontSize: 12, color: colors.textSecondary }}>
            About
          </MUILink>
          <MUILink href="/user/terms" underline="none" sx={{ fontSize: 12, color: colors.textSecondary }}>
            Terms
          </MUILink>
        </Box>
      </Box>
    </Box>
  );
}
