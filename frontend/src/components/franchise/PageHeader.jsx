import React from "react";
import { Box, Typography, Button } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { AGENCY_TOKENS } from "./AgencyTokens";

/**
 * Standard PageHeader (Phase 4 & 5)
 * Title + Action button row that wraps responsively on 360px viewports without collisions.
 */
export default function PageHeader({
  title,
  count,
  actionLabel,
  onAction,
  actionIcon = <AddRoundedIcon sx={{ fontSize: 18 }} />,
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 1,
        mb: 1.5,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.8, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: "17px",
            fontWeight: 700,
            color: AGENCY_TOKENS.colors.mainText,
            lineHeight: 1.25,
          }}
        >
          {title}
        </Typography>
        {count !== undefined && count !== null && (
          <Typography
            sx={{
              fontSize: "13px",
              fontWeight: 600,
              color: AGENCY_TOKENS.colors.secondaryText,
            }}
          >
            ({count})
          </Typography>
        )}
      </Box>

      {actionLabel && (
        <Button
          size="small"
          variant="contained"
          startIcon={actionIcon}
          onClick={onAction}
          sx={{
            borderRadius: `${AGENCY_TOKENS.geometry.controlRadius}px`,
            textTransform: "none",
            fontWeight: 600,
            fontSize: "12px",
            bgcolor: AGENCY_TOKENS.colors.primary,
            px: 1.5,
            py: 0.6,
            minHeight: 34,
            boxShadow: "0 2px 6px rgba(37,99,235,0.25)",
            "&:hover": { bgcolor: AGENCY_TOKENS.colors.primaryDark },
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
