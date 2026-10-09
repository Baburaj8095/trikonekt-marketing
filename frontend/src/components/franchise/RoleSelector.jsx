import React from "react";
import { Box, Chip } from "@mui/material";
import { AGENCY_TOKENS } from "./AgencyTokens";

/**
 * Standard Role Selector (Phase 2A)
 * Compact horizontally scrollable role tier selector without page overflow.
 */
export default function RoleSelector({
  tiers = [],
  activeTierKey,
  onSelectTier,
}) {
  return (
    <Box
      sx={{
        width: "100%",
        overflowX: "auto",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
        py: 1,
        px: 2,
        boxSizing: "border-box",
        bgcolor: AGENCY_TOKENS.colors.cardBg,
        borderBottom: `1px solid ${AGENCY_TOKENS.colors.border}`,
      }}
    >
      <Box sx={{ display: "inline-flex", gap: 1, whiteSpace: "nowrap" }}>
        {tiers.map((t) => {
          const isActive = t.key === activeTierKey;
          return (
            <Chip
              key={t.key}
              label={t.label}
              onClick={() => onSelectTier(t.key)}
              size="small"
              sx={{
                height: 28,
                fontSize: "11.5px",
                fontWeight: isActive ? 700 : 500,
                bgcolor: isActive ? AGENCY_TOKENS.colors.primary : AGENCY_TOKENS.colors.surfaceMuted,
                color: isActive ? "#FFFFFF" : AGENCY_TOKENS.colors.secondaryText,
                border: `1px solid ${isActive ? AGENCY_TOKENS.colors.primary : AGENCY_TOKENS.colors.border}`,
                borderRadius: "9999px",
                cursor: "pointer",
                transition: "all 0.15s ease",
                "&:hover": {
                  bgcolor: isActive ? AGENCY_TOKENS.colors.primaryDark : "#E2E8F0",
                },
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}
