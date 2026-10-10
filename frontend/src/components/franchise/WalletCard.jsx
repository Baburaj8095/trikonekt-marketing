import React from "react";
import { Paper, Box, Typography, Button, Stack } from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

/**
 * Standard WalletCard (Exact Native Mobile Reference)
 * High-fidelity royal purple hero card with bar chart visualization, wallet CTA, and info badge.
 */
export default function WalletCard({
  title = "Total Earnings",
  balance = "0.00",
  growthBadge = null,
  monthlyGrowth = "₹ 0.00 Total Geo Payouts",
  isWalletScreen = false,
  onWithdraw,
  onViewHistory,
  onBankDetails,
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.25, sm: 2.5 },
        borderRadius: "22px",
        background: "linear-gradient(135deg, #5F259F 0%, #4D1A85 55%, #3B0764 100%)",
        color: "#FFFFFF",
        boxShadow: "0 10px 28px rgba(95, 37, 159, 0.35)",
        mb: 2,
        width: "100%",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Background Translucent Bar Chart Visualization on the Right */}
      <Box
        sx={{
          position: "absolute",
          right: 20,
          bottom: 70,
          display: "flex",
          alignItems: "flex-end",
          gap: "6px",
          pointerEvents: "none",
          opacity: 0.22,
        }}
      >
        <Box sx={{ width: 8, height: 16, bgcolor: "#FFFFFF", borderRadius: "3px" }} />
        <Box sx={{ width: 8, height: 26, bgcolor: "#FFFFFF", borderRadius: "3px" }} />
        <Box sx={{ width: 8, height: 38, bgcolor: "#FFFFFF", borderRadius: "3px" }} />
        <Box sx={{ width: 8, height: 52, bgcolor: "#FFFFFF", borderRadius: "3px" }} />
        <Box sx={{ width: 8, height: 68, bgcolor: "#FFFFFF", borderRadius: "3px" }} />
      </Box>

      {/* Top Header Row */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={0.6}>
          <Typography
            sx={{
              fontSize: "13px",
              fontWeight: 700,
              color: "rgba(255, 255, 255, 0.9)",
              letterSpacing: "0.1px",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {title}
          </Typography>
          {!isWalletScreen && (
            <InfoOutlinedIcon sx={{ fontSize: 15, color: "rgba(255, 255, 255, 0.75)" }} />
          )}
        </Stack>

        {isWalletScreen ? (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              bgcolor: "#10B981",
              color: "#FFFFFF",
              fontSize: "11px",
              fontWeight: 800,
              borderRadius: "999px",
              px: 1.25,
              py: 0.3,
            }}
          >
            Active
          </Box>
        ) : (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              bgcolor: "rgba(255, 255, 255, 0.16)",
              backdropFilter: "blur(8px)",
              color: "#FFFFFF",
              fontSize: "11px",
              fontWeight: 700,
              borderRadius: "999px",
              border: "1px solid rgba(255, 255, 255, 0.22)",
              px: 1.2,
              py: 0.3,
              cursor: "pointer",
            }}
          >
            This Month
            <ExpandMoreRoundedIcon sx={{ fontSize: 15, ml: 0.3 }} />
          </Box>
        )}
      </Box>

      {/* Balance Amount + Growth Pill */}
      <Box sx={{ mb: 0.8 }}>
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <Typography
            sx={{
              fontSize: { xs: "30px", sm: "34px" },
              fontWeight: 900,
              color: "#FFFFFF",
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              textShadow: "0 2px 8px rgba(0,0,0,0.2)",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            ₹ {balance}
          </Typography>

          {growthBadge && (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  bgcolor: "#10B981",
                  color: "#FFFFFF",
                  fontSize: "11px",
                  fontWeight: 900,
                  borderRadius: "999px",
                  px: 1,
                  py: 0.2,
                  boxShadow: "0 2px 6px rgba(16, 185, 129, 0.4)",
                }}
              >
                ↑ {growthBadge}
              </Box>
              <Typography
                sx={{
                  fontSize: "9.5px",
                  color: "rgba(255, 255, 255, 0.75)",
                  fontWeight: 600,
                  mt: 0.2,
                  lineHeight: 1,
                }}
              >
                vs last month
              </Typography>
            </Box>
          )}

          {isWalletScreen && (
            <Box sx={{ ml: "auto" }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  bgcolor: "rgba(255, 255, 255, 0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  cursor: "pointer",
                }}
                onClick={onViewHistory}
              >
                <ArrowForwardRoundedIcon sx={{ fontSize: 18 }} />
              </Box>
            </Box>
          )}
        </Stack>
      </Box>

      {/* Monthly Subtext */}
      <Typography
        sx={{
          fontSize: "12px",
          color: "rgba(255, 255, 255, 0.9)",
          fontWeight: 600,
          letterSpacing: "0.1px",
          mb: 1.8,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        This Month: <b style={{ color: "#FFFFFF" }}>{monthlyGrowth}</b>
      </Typography>

      {/* 2 Action Buttons Row */}
      <Stack direction="row" spacing={1.2}>
        <Button
          fullWidth
          variant="contained"
          onClick={onWithdraw}
          startIcon={<AccountBalanceWalletRoundedIcon sx={{ fontSize: "18px !important", color: "#5F259F" }} />}
          sx={{
            bgcolor: "#FFFFFF",
            color: "#5F259F",
            fontSize: "12.5px",
            fontWeight: 800,
            textTransform: "none",
            borderRadius: "999px",
            py: 0.8,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            "&:hover": { bgcolor: "#F8FAFC", color: "#4D1A85" },
            "&:active": { transform: "scale(0.96)" },
          }}
        >
          Withdraw
        </Button>

        {isWalletScreen ? (
          <Button
            fullWidth
            variant="outlined"
            onClick={onBankDetails}
            sx={{
              color: "#FFFFFF",
              fontSize: "12.5px",
              fontWeight: 800,
              textTransform: "none",
              bgcolor: "rgba(255, 255, 255, 0.16)",
              backdropFilter: "blur(8px)",
              borderRadius: "999px",
              border: "1px solid rgba(255, 255, 255, 0.35)",
              py: 0.8,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              "&:hover": { bgcolor: "rgba(255, 255, 255, 0.26)" },
              "&:active": { transform: "scale(0.96)" },
            }}
          >
            Bank Details
          </Button>
        ) : (
          <Button
            fullWidth
            variant="outlined"
            onClick={onViewHistory}
            endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{
              color: "#FFFFFF",
              fontSize: "12.5px",
              fontWeight: 800,
              textTransform: "none",
              bgcolor: "rgba(255, 255, 255, 0.16)",
              backdropFilter: "blur(8px)",
              borderRadius: "999px",
              border: "1px solid rgba(255, 255, 255, 0.35)",
              py: 0.8,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              "&:hover": { bgcolor: "rgba(255, 255, 255, 0.26)" },
              "&:active": { transform: "scale(0.96)" },
            }}
          >
            View History
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
