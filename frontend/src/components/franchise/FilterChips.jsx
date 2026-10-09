import React from "react";
import { Box, Chip } from "@mui/material";
import { AGENCY_TOKENS } from "./AgencyTokens";

/**
 * Standard FilterChips (Phase 5)
 * Horizontally scrollable chips at uniform 30px height.
 */
export default function FilterChips({
  filters = [],
  activeValue,
  onSelect,
}) {
  return (
    <Box
      sx={{
        width: "100%",
        overflowX: "auto",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
        pb: 0.5,
        mb: 1.5,
      }}
    >
      <Box sx={{ display: "inline-flex", gap: 1, whiteSpace: "nowrap" }}>
        {filters.map((f) => {
          const isActive = f.value === activeValue;
          return (
            <Chip
              key={f.value}
              label={f.label}
              onClick={() => onSelect(f.value)}
              size="small"
              sx={{
                height: 30,
                fontSize: "12px",
                fontWeight: isActive ? 700 : 500,
                bgcolor: isActive ? AGENCY_TOKENS.colors.navy : AGENCY_TOKENS.colors.cardBg,
                color: isActive ? "#FFFFFF" : AGENCY_TOKENS.colors.secondaryText,
                border: `1px solid ${isActive ? AGENCY_TOKENS.colors.navy : AGENCY_TOKENS.colors.border}`,
                borderRadius: "9999px",
                cursor: "pointer",
                transition: "all 0.15s ease",
                "&:hover": {
                  bgcolor: isActive ? AGENCY_TOKENS.colors.navy : AGENCY_TOKENS.colors.surfaceMuted,
                },
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}
