import React from "react";
import { TextField, InputAdornment } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { AGENCY_TOKENS } from "./AgencyTokens";

/**
 * Standard SearchField (Phase 5)
 * Full-width responsive search field with 12px radius.
 */
export default function SearchField({
  value,
  onChange,
  placeholder = "Search...",
}) {
  return (
    <TextField
      fullWidth
      size="small"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchRoundedIcon sx={{ color: AGENCY_TOKENS.colors.secondaryText, fontSize: 20 }} />
          </InputAdornment>
        ),
        sx: {
          borderRadius: `${AGENCY_TOKENS.geometry.controlRadius}px`,
          bgcolor: AGENCY_TOKENS.colors.cardBg,
          fontSize: "13px",
          border: `1px solid ${AGENCY_TOKENS.colors.border}`,
          "& fieldset": { border: "none" },
          "&:hover": { borderColor: AGENCY_TOKENS.colors.primary },
          height: 42,
        },
      }}
      sx={{ mb: 1.5 }}
    />
  );
}
