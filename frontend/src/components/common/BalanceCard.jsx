import React, { useState } from "react";
import { Box, IconButton, Paper, Stack, Typography } from "@mui/material";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import { C, R, S } from "../../theme/tokens";

export default function BalanceCard({
  title = "MAIN WALLET",
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
        p: { xs: 2.25, sm: 2.75 },
        borderRadius: `${R.hero}px`,
        background: "linear-gradient(135deg, #0B192C 0%, #1E3E62 60%, #1D4ED8 100%)",
        color: "#ffffff",
        boxShadow: "0 12px 32px rgba(11, 25, 44, 0.35)",
        cursor: onClick ? "pointer" : "default",
        position: "relative",
        overflow: "hidden",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        transition: "transform 140ms ease, box-shadow 140ms ease",
        "&:active": onClick ? { transform: "scale(0.99)" } : undefined,
      }}
    >
      {/* Decorative background geometry */}
      <Box
        sx={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 140,
          height: 140,
          borderRadius: "50%",
          bgcolor: "rgba(37, 99, 235, 0.15)",
          filter: "blur(20px)",
          pointerEvents: "none",
        }}
      />

      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography
            sx={{
              fontSize: 11.5,
              fontWeight: 800,
              color: "rgba(255, 255, 255, 0.75)",
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            {title}
          </Typography>

          <Stack direction="row" alignItems="center" spacing={0.75}>
            {showToggle && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setVisible((v) => !v);
                }}
                aria-label={visible ? "Hide balance" : "Show balance"}
                sx={{
                  color: "rgba(255, 255, 255, 0.8)",
                  bgcolor: "rgba(255, 255, 255, 0.1)",
                  p: 0.6,
                  "&:hover": { bgcolor: "rgba(255, 255, 255, 0.2)" },
                }}
              >
                {visible ? <VisibilityOffRoundedIcon sx={{ fontSize: 16 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            )}
            {onClick && (
              <IconButton
                size="small"
                aria-label="View wallet details"
                sx={{
                  color: "#ffffff",
                  bgcolor: "rgba(255, 255, 255, 0.12)",
                  p: 0.6,
                  "&:hover": { bgcolor: "rgba(255, 255, 255, 0.22)" },
                }}
              >
                <ArrowForwardIosRoundedIcon sx={{ fontSize: 13 }} />
              </IconButton>
            )}
          </Stack>
        </Stack>

        <Box>
          <Typography
            sx={{
              fontSize: { xs: 28, sm: 34 },
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.5px",
              lineHeight: 1.1,
            }}
          >
            {visible ? `₹ ${numAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "₹ ••••••••"}
          </Typography>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 500,
              color: "rgba(255, 255, 255, 0.7)",
              mt: 0.5,
            }}
          >
            Available balance
          </Typography>
        </Box>

        {subtitle && (
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.9)",
              pt: 0.5,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            {subtitle} →
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
