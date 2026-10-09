import React from "react";
import { Box, Chip } from "@mui/material";

/**
 * Standard FilterChips (Matches Image 2 Reference Design)
 * Horizontally scrollable filter pills with PhonePe Royal Purple active state.
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
        mb: 2,
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
                height: 32,
                fontSize: "12px",
                fontWeight: isActive ? 800 : 600,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                bgcolor: isActive ? "#5F259F" : "#FFFFFF",
                color: isActive ? "#FFFFFF" : "#64748B",
                border: `1px solid ${isActive ? "#5F259F" : "#E2E8F0"}`,
                borderRadius: "999px",
                cursor: "pointer",
                boxShadow: isActive ? "0 2px 8px rgba(95, 37, 159, 0.25)" : "none",
                transition: "all 0.15s ease",
                px: 0.5,
                "&:hover": {
                  bgcolor: isActive ? "#4D1A85" : "#F8FAFC",
                  borderColor: isActive ? "#4D1A85" : "#CBD5E1",
                },
                "&:active": { transform: "scale(0.95)" },
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}
