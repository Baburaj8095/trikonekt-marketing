import React from "react";
import { Paper, Box, Typography, Chip, Avatar } from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { AGENCY_TOKENS } from "./AgencyTokens";

/**
 * Standard CaptainCard (Phase 5)
 * Matches MerchantCard structure and sizing exactly.
 */
export default function CaptainCard({
  captain,
  onClick,
}) {
  const isActive = captain.status === "Active";

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 1.6,
        borderRadius: `${AGENCY_TOKENS.geometry.cardRadius}px`,
        bgcolor: AGENCY_TOKENS.colors.cardBg,
        border: `1px solid ${AGENCY_TOKENS.colors.border}`,
        boxShadow: AGENCY_TOKENS.shadows.card,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        transition: "transform 0.12s ease, box-shadow 0.12s ease",
        "&:active": { transform: "scale(0.985)" },
        "&:hover": { borderColor: AGENCY_TOKENS.colors.primaryBorder },
      }}
    >
      {/* Fixed-size avatar thumbnail */}
      <Avatar
        src={captain.avatar}
        variant="rounded"
        sx={{
          width: 50,
          height: 50,
          borderRadius: "12px",
          bgcolor: AGENCY_TOKENS.colors.surfaceMuted,
          flexShrink: 0,
        }}
      />

      {/* Flexible text column */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: Name + Status */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, flexWrap: "wrap", mb: 0.3 }}>
          <Typography
            sx={{
              fontSize: "14px",
              fontWeight: 700,
              color: AGENCY_TOKENS.colors.mainText,
              lineHeight: 1.3,
            }}
          >
            {captain.name}
          </Typography>
          <Chip
            label={captain.status}
            size="small"
            sx={{
              height: 18,
              fontSize: "10px",
              fontWeight: 700,
              bgcolor: isActive ? AGENCY_TOKENS.colors.successBg : AGENCY_TOKENS.colors.surfaceMuted,
              color: isActive ? AGENCY_TOKENS.colors.success : AGENCY_TOKENS.colors.secondaryText,
            }}
          />
        </Box>

        {/* Row 2: ID & Locality */}
        <Typography
          noWrap
          sx={{
            fontSize: "11.5px",
            color: AGENCY_TOKENS.colors.secondaryText,
            fontWeight: 500,
            mb: 0.3,
          }}
        >
          {captain.id} • {captain.area}
        </Typography>

        {/* Row 3: Managed Metrics */}
        <Typography
          noWrap
          sx={{
            fontSize: "11.5px",
            color: AGENCY_TOKENS.colors.primary,
            fontWeight: 700,
          }}
        >
          {captain.merchants || 0} merchants • {captain.services || 0} services • {captain.customers || 0} customers
        </Typography>
      </Box>

      {/* Trailing chevron */}
      <ChevronRightRoundedIcon
        sx={{ color: "#CBD5E1", fontSize: 20, flexShrink: 0 }}
      />
    </Paper>
  );
}
