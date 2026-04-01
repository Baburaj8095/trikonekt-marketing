import React from "react";
import { Box, Paper, Typography, Stack, Avatar, Button, Chip } from "@mui/material";

const WalletCard = ({
  slNo,
  name,
  amount,
  icon,
  label,
  actions,
  highlight = false,
}) => {
  return (
    <Paper
      elevation={highlight ? 2 : 0}
      sx={{
  p: { xs: 1.2, sm: 2 },
  borderRadius: 3,
  border: highlight ? "2px solid" : "1px solid",
  borderColor: highlight ? "primary.main" : "#e5e7eb",
  bgcolor: highlight ? "primary.light" : "#fff",

  // ✅ FIX 2: Equal height cards
  height: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",

  // ✅ FIX 3: Prevent layout breaking
  minWidth: 0,
  overflow: "hidden",

  position: "relative",
  transition: "all 0.2s ease",

  "&:hover": {
    transform: "translateY(-2px)",
    boxShadow: highlight
      ? "0 8px 20px rgba(14,165,233,0.3)"
      : "0 4px 12px rgba(0,0,0,0.08)",
  },
}}
    >
      {/* SlNo */}
      <Chip
        label={`#${slNo}`}
        size="small"
        sx={{
          alignSelf: "flex-start",
          mb: 0.5,
          height: 20,
          fontSize: 10,
          bgcolor: highlight ? "#fff" : "#e0f2fe",
          color: highlight ? "#0ea5e9" : "#0284c7",
        }}
      />

      {/* Header */}
      <Stack direction="row" spacing={1} alignItems="center">
        <Avatar
          sx={{
            width: { xs: 28, sm: 34 },
            height: { xs: 28, sm: 34 },
            fontSize: 16,
            bgcolor: highlight ? "#0284c7" : "#f1f5f9",
            color: highlight ? "#fff" : "#0f172a",
          }}
        >
          {icon || "💼"}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: { xs: 11, sm: 13 },
              fontWeight: 700,
              lineHeight: 1.2,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {name}
          </Typography>

          {label && (
            <Typography
              sx={{
                fontSize: 10,
                opacity: 0.7,
              }}
            >
              {label}
            </Typography>
          )}
        </Box>
      </Stack>

      {/* Amount */}
      <Typography
        sx={{
          mt: 1,
          fontWeight: 800,
          fontSize: { xs: 16, sm: 20 },
        }}
      >
        ₹ {Number(amount || 0).toFixed(2)}
      </Typography>

      {/* Actions */}
      {actions?.length > 0 && (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            mt: 1,
            overflowX: "auto",
          }}
        >
          {actions.map((a, i) => (
            <Button
              key={i}
              size="small"
              variant="contained"
              onClick={a.onClick}
              disabled={a.disabled}
              sx={{
                fontSize: 10,
                px: 1,
                py: 0.3,
                minWidth: 60,
                bgcolor: highlight ? "#fff" : "#0ea5e9",
                color: highlight ? "#0284c7" : "#fff",
                "&:hover": {
                  bgcolor: highlight ? "#e0f2fe" : "#0284c7",
                },
              }}
            >
              {a.label}
            </Button>
          ))}
        </Stack>
      )}
    </Paper>
  );
};

export default WalletCard;