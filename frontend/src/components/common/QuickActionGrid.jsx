import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Paper, Stack, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import { C, R, S } from "../../theme/tokens";

export default function QuickActionGrid({ variant = "dashboard" }) {
  const navigate = useNavigate();

  const actions =
    variant === "wallet"
      ? [
          { label: "Add Money", icon: AddRoundedIcon, color: "#2563eb", bg: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", shadow: "rgba(37, 99, 235, 0.35)", route: "/user/upload-wallet" },
          { label: "Withdraw", icon: ArrowUpwardRoundedIcon, color: "#f97316", bg: "linear-gradient(135deg, #f97316 0%, #ef4444 100%)", shadow: "rgba(249, 115, 22, 0.35)", route: "/user/withdrawal" },
          { label: "Transfer", icon: SwapHorizRoundedIcon, color: "#10b981", bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)", shadow: "rgba(16, 185, 129, 0.35)", route: "/user/team-wallet" },
          { label: "History", icon: HistoryRoundedIcon, color: "#06b6d4", bg: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)", shadow: "rgba(6, 182, 212, 0.35)", route: "/user/history" },
        ]
      : [
          {
            label: "Withdraw",
            subtitle: "Instant Payout",
            icon: ArrowUpwardRoundedIcon,
            color: "#ffffff",
            bg: "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
            shadow: "0 8px 20px rgba(239, 68, 68, 0.38)",
            route: "/user/withdrawal",
          },
          {
            label: "History",
            subtitle: "Transactions",
            icon: HistoryRoundedIcon,
            color: "#ffffff",
            bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            shadow: "0 8px 20px rgba(16, 185, 129, 0.38)",
            route: "/user/history",
          },
        ];

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.25 },
        borderRadius: "18px",
        bgcolor: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 8px 24px rgba(37, 99, 235, 0.05)",
      }}
    >
      <Stack direction="row" justifyContent="space-around" alignItems="center">
        {actions.map((act) => {
          const IconComp = act.icon;
          return (
            <Box
              key={act.label}
              role="button"
              tabIndex={0}
              onClick={() => navigate(act.route)}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.75,
                cursor: "pointer",
                transition: "all 160ms ease",
                "&:hover": { transform: "translateY(-2px)" },
                "&:active": { transform: "scale(0.94)" },
              }}
            >
              <Box
                sx={{
                  width: { xs: 52, sm: 58 },
                  height: { xs: 52, sm: 58 },
                  borderRadius: "16px",
                  background: act.bg,
                  color: act.color || "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: act.shadow || "0 6px 16px rgba(0,0,0,0.1)",
                  transition: "box-shadow 160ms ease",
                }}
              >
                <IconComp sx={{ fontSize: { xs: 26, sm: 30 } }} />
              </Box>
              <Typography
                sx={{
                  fontSize: { xs: 13, sm: 14 },
                  fontWeight: 700,
                  color: "#0f172a",
                  textAlign: "center",
                }}
              >
                {act.label}
              </Typography>
              {act.subtitle ? (
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "#64748b",
                    textAlign: "center",
                    mt: -0.5,
                  }}
                >
                  {act.subtitle}
                </Typography>
              ) : null}
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}
