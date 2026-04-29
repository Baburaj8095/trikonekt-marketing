import React from "react";
import { alpha } from "@mui/material/styles";
import { Box, InputBase, Stack, Typography } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";

const UI = {
  primary: "#0F52BA",
  surface: "#ffffff",
  border: "#e5e7eb",
  text: "#1f2937",
  textMuted: "#6b7280",
};

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search for items or stores",
  location = "Delivering near you",
}) {
  return (
    <Stack spacing={0.8}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          minHeight: 44,
          px: 1.25,
          borderRadius: 2.5,
          bgcolor: alpha(UI.primary, 0.06),
          border: `1px solid ${alpha(UI.primary, 0.12)}`,
        }}
      >
        <SearchRoundedIcon sx={{ color: UI.textMuted, fontSize: 21, flexShrink: 0 }} />
        <InputBase
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          fullWidth
          sx={{
            fontSize: 13,
            fontWeight: 700,
            color: UI.text,
            minWidth: 0,
            "& input::placeholder": {
              color: UI.textMuted,
              opacity: 1,
            },
          }}
          inputProps={{ "aria-label": placeholder }}
        />
      </Box>
      <Box
        role="button"
        tabIndex={0}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          minWidth: 0,
          color: UI.text,
        }}
      >
        <LocationOnOutlinedIcon sx={{ fontSize: 18, color: UI.primary, flexShrink: 0 }} />
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 800,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {location}
        </Typography>
        <KeyboardArrowDownRoundedIcon sx={{ fontSize: 18, color: UI.textMuted, flexShrink: 0 }} />
      </Box>
    </Stack>
  );
}
