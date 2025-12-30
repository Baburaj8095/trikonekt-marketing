import React from "react";
import { Box, Typography } from "@mui/material";
import SmartImage from "./SmartImage";

export default function AppIconTile({ label, image, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        textAlign: "center",
        cursor: "pointer"
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          mx: "auto",
          borderRadius: 2,
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <SmartImage
          src={image}
          type="logo"
          sx={{ width: 32, height: 32, border: "none" }}
        />
      </Box>

      <Typography
        sx={{
          fontSize: 12,
          fontWeight: 600,
          mt: 0.75,
          color: "#111827"
        }}
        noWrap
      >
        {label}
      </Typography>
    </Box>
  );
}
