import React from "react";
import { TextField, InputAdornment } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

/**
 * Standard SearchField (Matches Image 2 Reference Design)
 * Full-width responsive search field with 16px radius and crisp modern styling.
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
            <SearchRoundedIcon sx={{ color: "#94A3B8", fontSize: 20 }} />
          </InputAdornment>
        ),
        sx: {
          borderRadius: "16px",
          bgcolor: "#FFFFFF",
          fontSize: "13px",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 600,
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
          "& fieldset": { border: "none" },
          "&:hover": { borderColor: "#CBD5E1" },
          "&.Mui-focused": { borderColor: "#5F259F", boxShadow: "0 0 0 3px rgba(95, 37, 159, 0.12)" },
          height: 44,
        },
      }}
      sx={{ mb: 2 }}
    />
  );
}
