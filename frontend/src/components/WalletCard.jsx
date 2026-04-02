import React from "react";
import { Box, Paper, Typography, Stack, Button } from "@mui/material";

const WalletCard = ({
  slNo,
  name,
  amount,
  icon,
  label,
  actions,
  highlight = false,
  sx = {},
}) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: "10px 12px",
        borderRadius: "10px",
        border: highlight ? "1.5px solid" : "1px solid",
        borderColor: highlight ? "primary.main" : "#e2e8f0",
        bgcolor: highlight ? "#eff6ff" : "#fff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minWidth: 0,
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        "&:active": {
          transform: "scale(0.97)",
        },
        "&:hover": {
          boxShadow: highlight
            ? "0 4px 14px rgba(37,99,235,0.18)"
            : "0 2px 8px rgba(0,0,0,0.07)",
        },
        ...sx,
      }}
    >
      {/* Icon + Title row */}
      <Stack direction="row" spacing="6px" alignItems="flex-start">
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "7px",
            bgcolor: highlight ? "#2563eb" : "#f1f5f9",
            color: highlight ? "#fff" : "#334155",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            "& svg": { fontSize: 16 },
          }}
        >
          {icon || "💼"}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1.25,
              color: "#334155",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
            }}
          >
            {name}
          </Typography>
        </Box>
      </Stack>

      {/* Amount */}
      <Typography
        sx={{
          mt: "6px",
          fontWeight: 800,
          fontSize: 17,
          color: highlight ? "#1d4ed8" : "#0f172a",
          letterSpacing: "-0.3px",
          lineHeight: 1,
        }}
      >
        ₹{Number(amount || 0).toFixed(2)}
      </Typography>

      {/* Subtitle label */}
      {label && (
        <Typography
          sx={{
            mt: "3px",
            fontSize: 10,
            color: "#94a3b8",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </Typography>
      )}

      {/* Actions */}
      {actions?.length > 0 && (
        <Stack
          direction="row"
          spacing="4px"
          sx={{ mt: "8px", flexWrap: "wrap", gap: "4px" }}
        >
          {actions.map((a, i) => (
            <Button
              key={i}
              size="small"
              variant={highlight ? "contained" : "outlined"}
              onClick={(e) => {
                e.stopPropagation();
                a.onClick?.();
              }}
              disabled={a.disabled}
              sx={{
                fontSize: 10,
                px: "8px",
                py: "2px",
                minWidth: 0,
                borderRadius: "6px",
                lineHeight: 1.4,
                fontWeight: 700,
                ...(highlight
                  ? { bgcolor: "#2563eb", color: "#fff" }
                  : { borderColor: "#cbd5e1", color: "#475569" }),
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