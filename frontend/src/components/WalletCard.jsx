import React from "react";
import { Avatar, Box, Paper, Typography, Stack, Button } from "@mui/material";

function fmtAmount(value) {
  const num = Number(value || 0);
  return num.toFixed(2);
}

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
        p: 1.2,
        borderRadius: 2.2,
        border: "1px solid",
        borderColor: highlight ? "primary.main" : "#EEF2F6",
        bgcolor: "#fff",
        minWidth: 0,
        transition: "transform 120ms ease",
        "&:active": { transform: "scale(0.99)" },
        ...sx,
      }}
    >
      <Stack direction="row" spacing={1.1} alignItems="center">
        <Avatar
          sx={{
            width: 34,
            height: 34,
            bgcolor: highlight ? "primary.light" : "#F1F5F9",
            color: highlight ? "primary.dark" : "#0C2D48",
            "& svg": { fontSize: 18 },
          }}
          aria-label={name || `Wallet ${slNo}`}
        >
          {icon || null}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              fontWeight: 800,
              lineHeight: 1.2,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }}
          >
            {name}
          </Typography>

          <Typography
            sx={{
              fontWeight: 900,
              fontSize: 16,
              lineHeight: 1.2,
              mt: 0.2,
            }}
          >
            ₹ {fmtAmount(amount)}
          </Typography>
        </Box>
      </Stack>

      {label ? (
        <Typography
          sx={{
            fontSize: 12,
            color: "text.secondary",
            mt: 0.6,
            lineHeight: 1.25,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}
        >
          {label}
        </Typography>
      ) : null}

      {/* Actions */}
      {actions?.length > 0 && (
        <Stack
          direction="row"
          spacing={0.8}
          sx={{ mt: 1, flexWrap: "wrap", gap: 0.8 }}
        >
          {actions.map((a, i) => (
            <Button
              key={i}
              size="small"
              variant="outlined"
              onClick={(e) => {
                e.stopPropagation();
                a.onClick?.();
              }}
              disabled={a.disabled}
              sx={{
                fontSize: 11,
                px: 1.1,
                py: 0.35,
                minWidth: 0,
                borderRadius: 999,
                lineHeight: 1.2,
                fontWeight: 800,
                textTransform: "none",
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