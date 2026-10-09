import React from "react";
import { Paper, Box, Typography } from "@mui/material";
import { AGENCY_TOKENS } from "./AgencyTokens";

/**
 * Standard MetricCard (Phase 5)
 * Uniform metric tile for 2-column KPI grids.
 */
export default function MetricCard({
  label,
  value,
  subtext,
  icon: IconComponent,
  iconColor = AGENCY_TOKENS.colors.primary,
  iconBg = AGENCY_TOKENS.colors.primaryLight,
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.8,
        borderRadius: `${AGENCY_TOKENS.geometry.cardRadius}px`,
        bgcolor: AGENCY_TOKENS.colors.cardBg,
        border: `1px solid ${AGENCY_TOKENS.colors.border}`,
        boxShadow: AGENCY_TOKENS.shadows.card,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 104,
        boxSizing: "border-box",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.8 }}>
        <Typography
          noWrap
          sx={{
            fontSize: "12px",
            fontWeight: 600,
            color: AGENCY_TOKENS.colors.secondaryText,
          }}
        >
          {label}
        </Typography>
        {IconComponent && (
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: "8px",
              bgcolor: iconBg,
              color: iconColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {IconComponent}
          </Box>
        )}
      </Box>

      <Typography
        sx={{
          fontSize: "22px",
          fontWeight: 700,
          color: AGENCY_TOKENS.colors.mainText,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          mb: 0.4,
        }}
      >
        {value}
      </Typography>

      {subtext && (
        <Typography
          noWrap
          sx={{
            fontSize: "11px",
            fontWeight: 600,
            color: AGENCY_TOKENS.colors.success,
          }}
        >
          {subtext}
        </Typography>
      )}
    </Paper>
  );
}
