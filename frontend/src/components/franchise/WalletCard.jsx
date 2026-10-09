import React from "react";
import { Paper, Box, Typography, Chip, Button } from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { AGENCY_TOKENS } from "./AgencyTokens";

/**
 * Standard WalletCard (Phase 5)
 * Full-width gradient hero card for earnings display.
 */
export default function WalletCard({
  balance = "0.00",
  monthlyGrowth = "+₹0.00",
  onViewHistory,
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: `${AGENCY_TOKENS.geometry.cardRadius}px`,
        background: AGENCY_TOKENS.colors.purpleGradient,
        color: "#FFFFFF",
        boxShadow: AGENCY_TOKENS.shadows.walletCard,
        mb: 2,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.8 }}>
        <Typography
          sx={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#DDD6FE",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Total Cumulative Earnings
        </Typography>
        <Chip
          label="Active Yield"
          size="small"
          sx={{
            height: 20,
            fontSize: "10px",
            fontWeight: 750,
            bgcolor: "rgba(255,255,255,0.2)",
            color: "#FFFFFF",
          }}
        />
      </Box>

      <Typography
        sx={{
          fontSize: "28px",
          fontWeight: 700,
          color: "#FFFFFF",
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          mb: 1.2,
        }}
      >
        ₹ {balance}
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Typography
          sx={{
            fontSize: "12px",
            color: "#EDE9FE",
            fontWeight: 500,
          }}
        >
          This Month: <b>{monthlyGrowth}</b>
        </Typography>

        {onViewHistory && (
          <Button
            size="small"
            onClick={onViewHistory}
            endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 15 }} />}
            sx={{
              color: "#FFFFFF",
              fontSize: "11.5px",
              fontWeight: 700,
              textTransform: "none",
              bgcolor: "rgba(255,255,255,0.15)",
              borderRadius: "8px",
              px: 1.2,
              py: 0.4,
              minHeight: 28,
              "&:hover": { bgcolor: "rgba(255,255,255,0.25)" },
            }}
          >
            History
          </Button>
        )}
      </Box>
    </Paper>
  );
}
