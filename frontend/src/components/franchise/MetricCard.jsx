import React from "react";
import { Paper, Box, Typography } from "@mui/material";

/**
 * Standard MetricCard (Exact Mobile Native Feel)
 * Uniform metric tile for KPI grids with soft pastel styling and status indicators.
 */
export default function MetricCard({
  label,
  value,
  subtext,
  dotColor,
  icon: IconComponent,
  iconColor = "#2563EB",
  iconBg = "#EFF6FF",
  cardBg = "#FFFFFF",
  cardBorder = "rgba(226, 232, 240, 0.85)",
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.6, sm: 2 },
        borderRadius: "20px",
        bgcolor: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 112,
        boxSizing: "border-box",
        transition: "all 160ms ease",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "0 6px 16px rgba(15, 23, 42, 0.06)",
        },
        "&:active": { transform: "scale(0.97)" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.6 }}>
        <Typography
          noWrap
          sx={{
            fontSize: "12.5px",
            fontWeight: 700,
            color: "#64748B",
            letterSpacing: "0.1px",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          {label}
        </Typography>
        {IconComponent && (
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: "10px",
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
          fontSize: { xs: "24px", sm: "26px" },
          fontWeight: 900,
          color: "#0F172A",
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          mb: 0.4,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        {value}
      </Typography>

      {subtext && (
        <Box sx={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden" }}>
          {dotColor && (
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: dotColor,
                flexShrink: 0,
              }}
            />
          )}
          <Typography
            noWrap
            sx={{
              fontSize: "11px",
              fontWeight: 700,
              color: dotColor || "#64748B",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {subtext}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
