import React, { useState } from "react";
import { Box, IconButton, Paper, Stack, Typography } from "@mui/material";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import { C, R, S } from "../../theme/tokens";

export default function BalanceCard({
  title = "Main Wallet Balance",
  amount = 0,
  subtitle = "View wallet details",
  onClick,
  showToggle = true,
}) {
  const [visible, setVisible] = useState(true);
  const numAmount = Number(amount || 0);

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: `${R.card}px`,
        background: C.mainWalletGradient,
        color: "#ffffff",
        boxShadow: "0 10px 28px rgba(37, 99, 235, 0.28)",
        cursor: onClick ? "pointer" : "default",
        position: "relative",
        overflow: "hidden",
        transition: "transform 140ms ease, box-shadow 140ms ease",
        "&:active": onClick ? { transform: "scale(0.99)" } : undefined,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: `${R.subCard}px`,
              bgcolor: "rgba(255, 255, 255, 0.18)",
              backdropFilter: "blur(6px)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              flexShrink: 0,
            }}
          >
            <AccountBalanceWalletRoundedIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{
                fontSize: 12.5,
                fontWeight: 500,
                color: "rgba(255, 255, 255, 0.85)",
                letterSpacing: "0.02em",
              }}
            >
              {title}
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontSize: { xs: 24, sm: 28 },
                fontWeight: 700,
                color: "#ffffff",
                lineHeight: 1.2,
                mt: 0.25,
              }}
            >
              {visible ? `₹ ${numAmount.toFixed(2)}` : "₹ ••••••••"}
            </Typography>
            {subtitle && (
              <Typography
                sx={{
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: "rgba(255, 255, 255, 0.8)",
                  mt: 0.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                }}
              >
                {subtitle} →
              </Typography>
            )}
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={0.5}>
          {showToggle && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setVisible((v) => !v);
              }}
              aria-label={visible ? "Hide balance" : "Show balance"}
              sx={{
                color: "rgba(255, 255, 255, 0.85)",
                bgcolor: "rgba(255, 255, 255, 0.12)",
                "&:hover": { bgcolor: "rgba(255, 255, 255, 0.2)" },
              }}
            >
              {visible ? <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          )}
          {onClick && (
            <IconButton
              size="small"
              aria-label="View wallet details"
              sx={{
                color: "#ffffff",
                bgcolor: "rgba(255, 255, 255, 0.15)",
                "&:hover": { bgcolor: "rgba(255, 255, 255, 0.25)" },
              }}
            >
              <ArrowForwardIosRoundedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
